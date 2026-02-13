// src/features/chat/components/ChatFab.tsx
export function ChatFab({
  unreadCount,
  open,
  onToggle,
}: {
  unreadCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-[9998]">
      <button
        type="button"
        onClick={onToggle}
        className="rounded-2xl shadow-soft border border-gray-200 bg-blue-600 text-white px-4 py-3 font-extrabold flex items-center gap-2 hover:opacity-95"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        💬 Chat
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-yellow-300 text-gray-900 text-xs font-extrabold px-2">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
