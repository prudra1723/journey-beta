import type { ReactNode } from "react";

export function GroupHeader({
  logoSrc,
  appName = "Journey",
  groupName,
  onOpenMenu,
  rightSlot,
}: {
  logoSrc: string;
  appName?: string;
  groupName: string;
  onOpenMenu: () => void;
  rightSlot?: ReactNode;
}) {
  return (
    <header className="sticky top-4 z-20 mx-auto w-[95%] max-w-5xl rounded-2xl border border-gray-200 bg-white shadow-yellow">
      <div className="px-4 py-4 flex items-center justify-between gap-3">
        {/* Left: Logo + names */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={logoSrc}
            alt="App logo"
            className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-contain"
          />

          <div className="min-w-0">
            <div className="text-sm font-extrabold text-gray-900 truncate">
              {appName}
            </div>
            <div className="text-xl md:text-2xl font-extrabold text-gray-900 truncate">
              {groupName}
            </div>
          </div>
        </div>

        {/* Right: Desktop profile button + Mobile hamburger */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop right slot (optional) */}
          <div className="hidden md:block">{rightSlot}</div>

          {/* Mobile + Desktop menu */}
          <button
            type="button"
            onClick={onOpenMenu}
            className="w-11 h-11 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold flex items-center justify-center"
            title="Menu"
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
}
