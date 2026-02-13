// src/features/chat/components/MessageList.tsx
import type { ChatMessage, ChatUser } from "../../../lib/chatDb";
import { MessageBubble } from "./MessageBubble";

export function MessageList({
  refEl,
  messages,
  me,
  onReply,
  onToggleReaction,
  onVotePoll,
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  messages: ChatMessage[];
  me: ChatUser | null;
  onReply: (r: { id: string; preview: string; name: string }) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
}) {
  return (
    <div
      ref={refEl}
      className="h-[340px] bg-gray-50 overflow-y-auto px-3 py-3 space-y-3"
    >
      {messages.length === 0 ? (
        <div className="text-sm text-gray-600">No messages yet. Say hi 👋</div>
      ) : (
        messages.map((m) => (
          <MessageBubble
            key={m.id}
            m={m}
            me={me}
            onReply={onReply}
            onToggleReaction={onToggleReaction}
            onVotePoll={onVotePoll}
          />
        ))
      )}
    </div>
  );
}
