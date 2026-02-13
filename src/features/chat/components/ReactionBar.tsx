// src/features/chat/components/ReactionBar.tsx
import type { ChatMessage, ChatUser } from "../../../lib/chatDb";
import { QUICK_EMOJIS } from "../lib/chatUi";

export function ReactionBar({
  m,
  me,
  onToggle,
}: {
  m: ChatMessage;
  me: ChatUser | null;
  onToggle: (messageId: string, emoji: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {QUICK_EMOJIS.map((emo) => {
        const users = m.reactions?.[emo] ?? [];
        const mine = me ? users.includes(me.userId) : false;

        return (
          <button
            key={emo}
            type="button"
            disabled={!me}
            className={[
              "px-2 py-1 rounded-2xl border text-xs font-extrabold transition",
              mine
                ? "bg-yellow-200 border-yellow-300 text-gray-900"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
              !me ? "opacity-70 cursor-not-allowed" : "",
            ].join(" ")}
            onClick={() => {
              if (!me) return;
              onToggle(m.id, emo);
            }}
            title={!me ? "Login required" : "React"}
          >
            {emo} {users.length > 0 ? users.length : ""}
          </button>
        );
      })}
    </div>
  );
}
