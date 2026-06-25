import { TRPCError } from "@trpc/server";

import type { dbClient } from "@kan/db/client";
import type { BoardMemberRole } from "@kan/db/schema";
import * as boardRepo from "@kan/db/repository/board.repo";
import * as boardMemberRepo from "@kan/db/repository/boardMember.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as permissionRepo from "@kan/db/repository/permission.repo";
import type { Permission, Role } from "@kan/shared";
import { canManageRole, getDefaultPermissions } from "@kan/shared";

/**
 * Get effective permissions for a member by combining role permissions with overrides
 */
export async function getMemberEffectivePermissions(
  db: dbClient,
  workspaceMemberId: number,
  roleId: number | null,
  roleName: string,
): Promise<Permission[]> {
  let roleDefaults: Set<Permission>;

  // Get role permissions from database or fallback to code defaults
  if (roleId) {
    const dbPermissions = await permissionRepo.getPermissionsByRoleId(
      db,
      roleId,
    );
    roleDefaults = new Set<Permission>(dbPermissions);
  } else {
    const codeDefaults = getDefaultPermissions(roleName as Role);
    roleDefaults = new Set<Permission>([...codeDefaults]);
  }

  // Get and apply custom overrides
  const overrides = await permissionRepo.getMemberPermissionOverrides(
    db,
    workspaceMemberId,
  );

  for (const override of overrides) {
    if (override.granted) {
      roleDefaults.add(override.permission as Permission);
    } else {
      roleDefaults.delete(override.permission as Permission);
    }
  }

  return Array.from(roleDefaults);
}

/**
 * Check if a member has a specific permission
 */
export async function memberHasPermission(
  db: dbClient,
  workspaceMemberId: number,
  roleId: number | null,
  roleName: string,
  permission: Permission,
): Promise<boolean> {
  let hasRoleDefault: boolean;

  // Check role permission from database or fallback to code defaults
  if (roleId) {
    const dbPermissions = await permissionRepo.getPermissionsByRoleId(
      db,
      roleId,
    );
    hasRoleDefault = dbPermissions.includes(permission);
  } else {
    const codeDefaults = getDefaultPermissions(roleName as Role);
    hasRoleDefault = codeDefaults.includes(permission);
  }

  // Check for override
  const override = await permissionRepo.getMemberPermissionOverride(
    db,
    workspaceMemberId,
    permission,
  );

  // Override takes precedence
  if (override) {
    return override.granted;
  }

  return hasRoleDefault;
}

/**
 * Check if user has a specific permission in a workspace
 */
export async function hasPermission(
  db: dbClient,
  userId: string,
  workspaceId: number,
  permission: Permission,
): Promise<boolean> {
  const member = await permissionRepo.getMemberWithRole(db, userId, workspaceId);

  if (!member) {
    return false;
  }

  return memberHasPermission(
    db,
    member.id,
    member.roleId,
    member.role,
    permission,
  );
}

/**
 * Get all permissions for a user in a workspace
 */
export async function getUserPermissions(
  db: dbClient,
  userId: string,
  workspaceId: number,
): Promise<{
  permissions: Permission[];
  role: string;
  roleId: number | null;
} | null> {
  const member = await permissionRepo.getMemberWithRole(db, userId, workspaceId);

  if (!member) {
    return null;
  }

  const permissions = await getMemberEffectivePermissions(
    db,
    member.id,
    member.roleId,
    member.role,
  );

  return {
    permissions,
    role: member.role,
    roleId: member.roleId,
  };
}

/**
 * Whether a user holds the legacy "admin" role in a workspace.
 */
export async function isWorkspaceAdmin(
  db: dbClient,
  userId: string,
  workspaceId: number,
): Promise<boolean> {
  const member = await permissionRepo.getMemberWithRole(db, userId, workspaceId);
  return member?.role === "admin";
}

/**
 * Assert user has permission - throws FORBIDDEN if not
 */
export async function assertPermission(
  db: dbClient,
  userId: string,
  workspaceId: number,
  permission: Permission,
): Promise<void> {
  const hasIt = await hasPermission(db, userId, workspaceId, permission);

  if (!hasIt) {
    throw new TRPCError({
      message: `You do not have permission to perform this action (${permission})`,
      code: "FORBIDDEN",
    });
  }
}

/**
 * Assert user can assign a specific role (based on hierarchy)
 */
export async function assertCanManageRole(
  db: dbClient,
  managerUserId: string,
  workspaceId: number,
  targetRoleName: string,
): Promise<void> {
  const managerMember = await permissionRepo.getMemberWithRole(
    db,
    managerUserId,
    workspaceId,
  );

  if (!managerMember) {
    throw new TRPCError({
      message: "You are not a member of this workspace",
      code: "FORBIDDEN",
    });
  }

  const managerRole = managerMember.role;

  if (!canManageRole(managerRole, targetRoleName as Role)) {
    throw new TRPCError({
      message: `You cannot assign the "${targetRoleName}" role`,
      code: "FORBIDDEN",
    });
  }
}

/**
 * Assert user can manage another member based on role hierarchy
 */
export async function assertCanManageMember(
  db: dbClient,
  managerUserId: string,
  workspaceId: number,
  targetMemberId: number,
): Promise<void> {
  const managerMember = await permissionRepo.getMemberWithRole(
    db,
    managerUserId,
    workspaceId,
  );

  if (!managerMember) {
    throw new TRPCError({
      message: "You are not a member of this workspace",
      code: "FORBIDDEN",
    });
  }

  const targetMember = await memberRepo.getById(db, targetMemberId);

  if (!targetMember) {
    throw new TRPCError({
      message: "Target member not found",
      code: "NOT_FOUND",
    });
  }

  const managerRole = managerMember.role;
  const targetRole = targetMember.role;

  if (!canManageRole(managerRole, targetRole)) {
    throw new TRPCError({
      message: "You cannot manage this member due to role hierarchy",
      code: "FORBIDDEN",
    });
  }
}

/**
 * Assert user can delete an entity - either has the delete permission OR is the creator
 */
export async function assertCanDelete(
  db: dbClient,
  userId: string,
  workspaceId: number,
  permission: Permission,
  createdBy: string | null,
): Promise<void> {
  // Check if user has the general delete permission
  const hasDeletePermission = await hasPermission(db, userId, workspaceId, permission);

  // If user has permission, allow deletion
  if (hasDeletePermission) {
    return;
  }

  // If user doesn't have permission, check if they are the creator
  if (createdBy && createdBy === userId) {
    return;
  }

  // Neither condition met - deny deletion
  throw new TRPCError({
    message: `You do not have permission to delete this entity (${permission})`,
    code: "FORBIDDEN",
  });
}

/**
 * Assert user can edit an entity - either has the edit permission OR is the creator
 */
export async function assertCanEdit(
  db: dbClient,
  userId: string,
  workspaceId: number,
  permission: Permission,
  createdBy: string | null,
): Promise<void> {
  // Check if user has the general edit permission
  const hasEditPermission = await hasPermission(db, userId, workspaceId, permission);

  // If user has permission, allow editing
  if (hasEditPermission) {
    return;
  }

  // If user doesn't have permission, check if they are the creator
  if (createdBy && createdBy === userId) {
    return;
  }

  // Neither condition met - deny editing
  throw new TRPCError({
    message: `You do not have permission to edit this entity (${permission})`,
    code: "FORBIDDEN",
  });
}

// Permissions a board "editor" holds on a restricted board. A "viewer" gets
// only the ":view" permissions; a board "admin" gets everything.
const BOARD_EDITOR_PERMISSIONS: Permission[] = [
  "board:view",
  "board:edit",
  "list:view",
  "list:create",
  "list:edit",
  "list:delete",
  "card:view",
  "card:create",
  "card:edit",
  "card:delete",
  "comment:view",
  "comment:create",
  "comment:edit",
  "comment:delete",
];

function boardRoleAllows(
  role: BoardMemberRole,
  permission: Permission,
): boolean {
  if (role === "admin") return true;
  if (permission.endsWith(":view")) return true;
  if (role === "viewer") return false;
  return BOARD_EDITOR_PERMISSIONS.includes(permission);
}

/**
 * Board-aware permission assertion. For boards with accessLevel "workspace"
 * this delegates to the existing workspace permission model (no behaviour
 * change). For "restricted" boards, only workspace admins and explicit board
 * members are allowed, gated by their board role.
 *
 * Pass `createdBy` to also allow the entity's creator (mirrors assertCanEdit /
 * assertCanDelete); omit it for a plain permission check.
 */
export async function assertBoardPermission(
  db: dbClient,
  userId: string,
  boardPublicId: string,
  permission: Permission,
  createdBy?: string | null,
): Promise<void> {
  const board = await boardRepo.getAccessByPublicId(db, boardPublicId);

  if (!board) {
    throw new TRPCError({ message: "Board not found", code: "NOT_FOUND" });
  }

  if (board.accessLevel === "workspace") {
    if (createdBy !== undefined) {
      const allowed =
        (await hasPermission(db, userId, board.workspaceId, permission)) ||
        (createdBy !== null && createdBy === userId);
      if (!allowed) {
        throw new TRPCError({
          message: `You do not have permission to perform this action (${permission})`,
          code: "FORBIDDEN",
        });
      }
      return;
    }
    await assertPermission(db, userId, board.workspaceId, permission);
    return;
  }

  // Restricted board: workspace admins and explicit board members only.
  const member = await permissionRepo.getMemberWithRole(
    db,
    userId,
    board.workspaceId,
  );

  if (!member) {
    throw new TRPCError({
      message: "You are not a member of this workspace",
      code: "FORBIDDEN",
    });
  }

  if (member.role === "admin") return;

  const boardMember = await boardMemberRepo.getByBoardAndUser(
    db,
    board.id,
    userId,
  );

  if (!boardMember) {
    throw new TRPCError({
      message: "You do not have access to this board",
      code: "FORBIDDEN",
    });
  }

  // The entity's creator may always act on it, as on workspace-access boards.
  if (createdBy !== undefined && createdBy !== null && createdBy === userId) {
    return;
  }

  if (!boardRoleAllows(boardMember.role, permission)) {
    throw new TRPCError({
      message: `You do not have permission to perform this action (${permission})`,
      code: "FORBIDDEN",
    });
  }
}

/**
 * Whether a user can manage a restricted board's access (its members and
 * access level) — workspace admins and board admins.
 */
export async function assertCanManageBoardAccess(
  db: dbClient,
  userId: string,
  boardId: number,
  workspaceId: number,
): Promise<void> {
  const member = await permissionRepo.getMemberWithRole(
    db,
    userId,
    workspaceId,
  );

  if (!member) {
    throw new TRPCError({
      message: "You are not a member of this workspace",
      code: "FORBIDDEN",
    });
  }

  if (member.role === "admin") return;

  const boardMember = await boardMemberRepo.getByBoardAndUser(
    db,
    boardId,
    userId,
  );

  if (boardMember?.role !== "admin") {
    throw new TRPCError({
      message: "You do not have permission to manage this board's access",
      code: "FORBIDDEN",
    });
  }
}
