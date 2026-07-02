import { Menu } from "@headlessui/react";

export default function Dropdown({
  items,
  children,
  disabled,
}: {
  items: { label: string; action?: () => void; icon?: React.ReactNode; disabled?: boolean }[];
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button
          disabled={disabled}
          className="flex h-7 w-7 items-center justify-center rounded-[5px] hover:bg-light-200 focus:outline-none dark:hover:bg-dark-200"
        >
          {children}
        </Menu.Button>
      </div>

      {/*
        Anchored + portaled so the menu is not a layout child of any scroll
        container. Rendering it inline (absolute) inside a scrollable list meant
        that opening/closing it near the scroll bottom changed the container's
        scrollHeight, clamped scrollTop, and fed back into Headless UI's open
        handling — an infinite render loop (React #185). Anchoring also flips the
        menu upward near the viewport edge instead of overflowing.
      */}
      <Menu.Items
        anchor={{ to: "bottom end", gap: 8 }}
        portal
        transition
        className="z-[100] w-56 origin-top rounded-md border border-light-200 bg-white p-1 shadow-lg ring-1 ring-black ring-opacity-5 transition duration-100 ease-out focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0 dark:border-dark-400 dark:bg-dark-300"
      >
        <div className="flex flex-col">
          {items.map((item) => (
            <Menu.Item key={item.label} disabled={item.disabled}>
              <button
                onClick={item.action}
                disabled={item.disabled ?? !item.action}
                className="flex w-auto items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-left text-sm text-neutral-900 hover:bg-light-200 disabled:cursor-not-allowed disabled:opacity-60 dark:text-dark-950 dark:hover:bg-dark-400"
              >
                {item.icon}
                {item.label}
              </button>
            </Menu.Item>
          ))}
        </div>
      </Menu.Items>
    </Menu>
  );
}
