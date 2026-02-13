// src/features/chat/components/ChatHeader.tsx
import type { ChatUser } from "../../../lib/chatDb";

export function ChatHeader({
  online,
  onClose,
}: {
  online: ChatUser[];
  onClose: () => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-extrabold text-gray-900 truncate">
          Group Chat
        </div>
        <div className="mt-1 text-xs text-gray-600">
          Online:{" "}
          <span className="font-semibold">
            {online.length > 0
              ? online
                  .map((u) => u.name)
                  .slice(0, 4)
                  .join(", ")
              : "Nobody yet"}
            {online.length > 4 ? ` +${online.length - 4}` : ""}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-9 h-9 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 font-extrabold"
        title="Close"
      >
        ×
      </button>
    </div>
  );
}
