// src/features/chat/components/MessagePoll.tsx
import type { ChatMessage, ChatUser } from "../../../lib/chatDb";

export function MessagePoll({
  m,
  me,
  onVote,
}: {
  m: ChatMessage;
  me: ChatUser | null;
  onVote: (messageId: string, optionId: string) => void;
}) {
  if (!m.poll) return null;

  const meId = me?.userId ?? "";
  const myVote = meId ? m.poll.votes?.[meId] : undefined;

  const count = (optId: string) =>
    Object.values(m.poll?.votes ?? {}).filter((x) => x === optId).length;

  return (
    <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-3">
      <div className="text-sm font-extrabold text-gray-900">
        📊 {m.poll.question}
      </div>

      <div className="mt-2 space-y-2">
        {m.poll.options.map((o) => {
          const c = count(o.id);
          const chosen = myVote === o.id;

          return (
            <button
              key={o.id}
              type="button"
              disabled={!me}
              onClick={() => {
                if (!me) return;
                onVote(m.id, o.id);
              }}
              className={[
                "w-full text-left rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                chosen
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-200 text-gray-900 hover:bg-gray-50",
                !me ? "opacity-70 cursor-not-allowed" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{o.text}</span>
                <span
                  className={[
                    "text-xs font-extrabold",
                    chosen ? "text-white/90" : "text-gray-600",
                  ].join(" ")}
                >
                  {c}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {!me && (
        <div className="mt-2 text-xs text-red-600 font-semibold">
          Login/session required to vote.
        </div>
      )}
    </div>
  );
}
