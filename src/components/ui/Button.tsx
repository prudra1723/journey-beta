import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "orange" | "ghost" | "blue";

export function Button({
  className,
  variant = "primary",
  children,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-sm",
    blue: "bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-sm",
    orange:
      "bg-orange-500 text-white hover:bg-orange-600 border border-orange-500 shadow-sm",
    ghost:
      "bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 shadow-sm",
  };

  return (
    <button
      type={type ?? "button"} // ✅ prevents accidental form submit reload
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 h-10 text-sm font-semibold transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200/70",
        styles[variant],
        props.disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
    >
      {children} {/* ✅ THIS WAS MISSING */}
    </button>
  );
}
