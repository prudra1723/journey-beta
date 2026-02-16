// src/features/chat/components/ChatToast.tsx
import { useEffect } from "react";

export function ChatToast({
  text,
  onClose,
  onOpen,
  isMobile,
}: {
  text: string;
  onClose: () => void;
  onOpen?: () => void;
  isMobile?: boolean;
}) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={
        isMobile
          ? "fixed top-16 left-1/2 z-[9999] w-[92vw] max-w-[420px] -translate-x-1/2"
          : "fixed bottom-24 right-5 z-[9999] w-[320px] max-w-[90vw]"
      }
    >
      <div className="rounded-2xl border border-gray-200 bg-white shadow-soft p-3">
        <div className="text-sm font-extrabold text-gray-900">New message</div>
        <div className="mt-1 text-sm text-gray-700 line-clamp-2">{text}</div>
        <div className="mt-2 flex items-center gap-3">
          {onOpen && (
            <button
              className="text-xs font-bold text-blue-700 hover:underline"
              onClick={onOpen}
              type="button"
            >
              Open chat
            </button>
          )}
          <button
            className="text-xs font-bold text-gray-600 hover:underline"
            onClick={onClose}
            type="button"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
