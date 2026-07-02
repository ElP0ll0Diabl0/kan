import { t } from "@lingui/core/macro";
import { HiOutlineUserPlus } from "react-icons/hi2";

import Avatar from "~/components/Avatar";
import CheckboxDropdown from "~/components/CheckboxDropdown";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

interface ChecklistItemMemberSelectorProps {
  cardPublicId: string;
  checklistItemPublicId: string;
  members: {
    key: string;
    value: string;
    selected: boolean;
    leftIcon: React.ReactNode;
    imageUrl: string | undefined;
  }[];
  disabled?: boolean;
}

export default function ChecklistItemMemberSelector({
  cardPublicId,
  checklistItemPublicId,
  members,
  disabled = false,
}: ChecklistItemMemberSelectorProps) {
  const utils = api.useUtils();
  const { showPopup } = usePopup();

  const addOrRemoveItemMember = api.checklist.addOrRemoveItemMember.useMutation({
    onMutate: async (update) => {
      await utils.card.byId.cancel({ cardPublicId });

      const previous = utils.card.byId.getData({ cardPublicId });

      utils.card.byId.setData({ cardPublicId }, (old) => {
        if (!old) return old;

        const updatedChecklists = old.checklists.map((cl) => ({
          ...cl,
          items: cl.items.map((ci) => {
            if (ci.publicId !== checklistItemPublicId) return ci;

            const members = ci.members ?? [];
            const hasMember = members.some(
              (m) => m.publicId === update.workspaceMemberPublicId,
            );

            return {
              ...ci,
              members: hasMember
                ? members.filter(
                    (m) => m.publicId !== update.workspaceMemberPublicId,
                  )
                : [...members, { publicId: update.workspaceMemberPublicId }],
            };
          }),
        }));

        return { ...old, checklists: updatedChecklists } as typeof old;
      });

      return { previous };
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.previous)
        utils.card.byId.setData({ cardPublicId }, ctx.previous);
      showPopup({
        header: t`Unable to update task members`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
    },
  });

  const selectedMembers = members.filter((member) => member.selected);

  return (
    <CheckboxDropdown
      items={members}
      handleSelect={(_, member) => {
        addOrRemoveItemMember.mutate({
          checklistItemPublicId,
          workspaceMemberPublicId: member.key,
        });
      }}
      disabled={disabled}
      position="right"
      asChild
    >
      {selectedMembers.length ? (
        <div className="isolate flex justify-end -space-x-1 overflow-hidden">
          {selectedMembers.map(({ value, imageUrl }) => (
            <Avatar
              key={value}
              size="sm"
              name={value}
              imageUrl={imageUrl}
              email={value}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md text-light-900 opacity-0 transition-opacity hover:bg-light-200 group-hover:opacity-100 dark:text-dark-700 dark:hover:bg-dark-200"
          aria-label={t`Assign members`}
        >
          <HiOutlineUserPlus size={16} />
        </div>
      )}
    </CheckboxDropdown>
  );
}
