// src/features/chat/components/MessageBubble.tsx
import type { ChatMessage, ChatUser } from "../../../lib/chatDb";
import { timeAgo } from "../lib/chatUi";
import { MessagePoll } from "./MessagePoll";
import { ReactionBar } from "./ReactionBar";

export function MessageBubble({
  m,
  me,
  onReply,
  onToggleReaction,
  onVotePoll,
}: {
  m: ChatMessage;
  me: ChatUser | null;
  onReply: (r: { id: string; preview: string; name: string }) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
}) {
  const mine = me ? m.createdBy.userId === me.userId : false;

  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[85%] rounded-2xl border p-3",
          mine
            ? "bg-blue-600 border-blue-600 text-white"
            : "bg-white border-gray-200 text-gray-900",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-extrabold truncate">
            {mine ? "You" : m.createdBy.name}
          </div>
          <div
            className={[
              "text-xs font-bold",
              mine ? "text-white/80" : "text-gray-500",
            ].join(" ")}
          >
            {timeAgo(m.createdAt)}
          </div>
        </div>

        {m.replyTo && (
          <div
            className={[
              "mt-2 rounded-2xl border px-3 py-2 text-xs",
              mine
                ? "border-white/30 bg-white/10"
                : "border-gray-200 bg-gray-50",
            ].join(" ")}
          >
            Replying to <span className="font-extrabold">{m.replyTo.name}</span>
            : <span className="font-semibold">{m.replyTo.preview}</span>
          </div>
        )}

        {m.text && (
          <div className="mt-2 text-sm whitespace-pre-wrap">{m.text}</div>
        )}

        {m.imageDataUrl && (
          <div className="mt-2 overflow-hidden rounded-2xl border border-white/20">
            <img
              src={m.imageDataUrl}
              alt="shared"
              className="w-full max-h-[220px] object-cover cursor-pointer"
              onClick={() =>
                window.open(m.imageDataUrl!, "_blank", "noopener,noreferrer")
              }
            />
          </div>
        )}

        <MessagePoll m={m} me={me} onVote={onVotePoll} />
        <ReactionBar m={m} me={me} onToggle={onToggleReaction} />

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onReply({
                id: m.id,
                name: m.createdBy.name,
                preview: (
                  m.text || (m.imageDataUrl ? "📷 Photo" : "Message")
                ).slice(0, 42),
              })
            }
            className={[
              "text-xs font-extrabold hover:underline",
              mine ? "text-white/90" : "text-blue-700",
            ].join(" ")}
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}
