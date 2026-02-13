import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-slate-200/70 bg-white/90 shadow-soft p-5 sm:p-6 backdrop-blur-[2px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
