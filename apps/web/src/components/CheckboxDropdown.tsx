import { Menu } from "@headlessui/react";
import { useEffect, useRef, useState } from "react";
import { HiEllipsisHorizontal, HiMiniPlus } from "react-icons/hi2";

interface Item {
  key: string;
  value: string;
  selected: boolean;
  leftIcon?: React.ReactNode;
}

interface Group {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: Item[];
}

/**
 * Resets the group-drilldown state after the menu closes. This used to live in
 * the `<Transition afterLeave>` callback; the transition wrapper was removed
 * because the menu is now portaled/anchored (see the note on `Menu.Items`).
 */
function SelectedGroupResetter({
  open,
  reset,
}: {
  open: boolean;
  reset: (value: string | null) => void;
}) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) reset(null);
    wasOpen.current = open;
  }, [open, reset]);
  return null;
}

interface CheckboxDropdownProps {
  children: React.ReactNode;
  items?: Item[];
  groups?: Group[];
  createNewItemLabel?: string;
  menuSpacing?: "sm" | "md" | "lg";
  position?: "left" | "right";
  handleSelect: (
    groupKey: string | null,
    item: { key: string; value: string },
  ) => void;
  handleEdit?: (key: string) => void;
  handleCreate?: () => void;
  asChild?: boolean;
  disabled?: boolean;
}

export default function CheckboxDropdown({
  children,
  items,
  groups,
  createNewItemLabel = "Create new",
  menuSpacing = "sm",
  position = "left",
  handleSelect,
  handleEdit,
  handleCreate,
  asChild = true,
  disabled = false,
}: CheckboxDropdownProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const anchorGap = menuSpacing === "lg" ? 10 : menuSpacing === "md" ? 8 : 6;

  const renderMenuItems = (items: Item[], groupKey: string | null) => (
    <>
      {items.length > 0 ? (
        items.map((item) => (
          <Menu.Item key={item.key}>
              <div
                className="group flex items-center rounded-[5px] p-2 hover:bg-light-200 dark:hover:bg-dark-300"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelect(groupKey, { key: item.key, value: item.value });
                }}
              >
              <input
                id={item.key}
                name={item.key}
                type="checkbox"
                className="h-[14px] w-[14px] rounded bg-transparent"
                onClick={(event) => event.stopPropagation()}
                onChange={() =>
                  handleSelect(groupKey, { key: item.key, value: item.value })
                }
                checked={item.selected}
              />
              {item.leftIcon && (
                <span className="ml-3 flex items-center">{item.leftIcon}</span>
              )}
              <label
                htmlFor={item.key}
                className="ml-3 text-[12px] text-dark-900"
              >
                {item.value}
              </label>
              {handleEdit && (
                <button
                  type="button"
                  className="invisible ml-auto group-hover:visible"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleEdit(item.key);
                  }}
                >
                  <HiEllipsisHorizontal size={20} className="text-dark-900" />
                </button>
              )}
            </div>
          </Menu.Item>
        ))
      ) : (
        !handleCreate && (
          <div className="flex items-center p-2 text-[12px] text-dark-900">
            No items
          </div>
        )
      )}
      {handleCreate && (
        <button
          type="button"
          className="flex w-full items-center rounded-[5px] p-2 px-2 text-[12px] text-dark-900 hover:bg-light-200 dark:hover:bg-dark-300"
          onClick={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <HiMiniPlus size={20} className="pr-1.5" />
          {createNewItemLabel}
        </button>
      )}
    </>
  );

  return (
    <Menu
      as="div"
      className="relative flex w-full flex-wrap items-center text-left"
    >
      {({ open }) => (
        <>
          <SelectedGroupResetter open={open} reset={setSelectedGroup} />
          <Menu.Button
            as={asChild ? "div" : undefined}
            disabled={disabled}
            className="h-full w-full cursor-pointer focus-visible:outline-none disabled:cursor-not-allowed"
          >
            {children}
          </Menu.Button>

          {/*
            Anchored + portaled so the menu is not a layout child of the
            surrounding scroll container. Previously it was rendered `absolute`
            inline, so opening/closing it near the scroll bottom changed the
            container's scrollHeight, clamped scrollTop, and fed back into
            Headless UI's open handling — an infinite render loop (React #185).
            Anchoring also flips the menu upward near the viewport edge instead
            of overflowing/clipping.
          */}
          <Menu.Items
            anchor={{
              to: position === "left" ? "bottom start" : "bottom end",
              gap: anchorGap,
            }}
            portal
            transition
            className="z-50 w-56 origin-top rounded-md border-[1px] border-light-200 bg-light-50 shadow-lg ring-1 ring-black ring-opacity-5 transition duration-100 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-dark-500 dark:bg-dark-200"
          >
            <div className="max-h-[350px] overflow-y-auto p-1">
              {!selectedGroup ? (
                <>
                  {items && renderMenuItems(items, null)}

                  {groups?.map((group) => (
                    <Menu.Item key={group.key}>
                      <div
                        className="flex items-center rounded-[5px] p-2 hover:bg-light-200 dark:hover:bg-dark-300"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedGroup(group.key);
                        }}
                      >
                        <span className="mr-2 text-dark-900">{group.icon}</span>
                        <span className="pointer-events-none text-[12px] text-dark-900">
                          {group.label}
                        </span>
                      </div>
                    </Menu.Item>
                  ))}
                </>
              ) : (
                <>
                  {groups?.find((g) => g.key === selectedGroup)?.items &&
                    renderMenuItems(
                      groups.find((g) => g.key === selectedGroup)?.items ?? [],
                      selectedGroup,
                    )}
                </>
              )}
            </div>
          </Menu.Items>
        </>
      )}
    </Menu>
  );
}
