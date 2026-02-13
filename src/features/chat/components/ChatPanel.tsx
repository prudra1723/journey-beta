// src/features/chat/components/ChatPanel.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../../../components/ui/Card";
import type { ChatMessage, ChatUser } from "../../../lib/chatDb";

import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";

export function ChatPanel({
  me,
  online,
  knownMembers,
  messages,
  onClose,
  onSend,
  onToggleReaction,
  onVotePoll,
}: {
  me: ChatUser | null;
  online: ChatUser[];
  knownMembers: ChatUser[];
  messages: ChatMessage[];
  onClose: () => void;
  onSend: (payload: {
    text: string;
    imageDataUrl?: string | null;
    replyTo?: { id: string; preview: string; name: string } | null;
    poll?: { question: string; options: { id: string; text: string }[] } | null;
  }) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onVotePoll: (messageId: string, optionId: string) => void;
}) {
  const [replyTo, setReplyTo] = useState<{
    id: string;
    preview: string;
    name: string;
  } | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);

  // auto scroll when messages change
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const memberNames = useMemo(() => {
    const set = new Set<string>();
    for (const u of knownMembers) set.add(u.name);
    return Array.from(set);
  }, [knownMembers]);

  return (
    <div className="fixed bottom-20 right-5 z-[9999] w-[380px] max-w-[92vw]">
      <Card className="overflow-hidden">
        <ChatHeader online={online} onClose={onClose} />

        <MessageList
          refEl={listRef}
          messages={messages}
          me={me}
          onReply={setReplyTo}
          onToggleReaction={onToggleReaction}
          onVotePoll={onVotePoll}
        />

        <ChatComposer
          me={me}
          memberNames={memberNames}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={(payload) => {
            onSend({ ...payload, replyTo });
            setReplyTo(null);
          }}
        />
      </Card>
    </div>
  );
}
