// src/features/chat/hooks/useChatSync.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatUser } from "../../../lib/chatDb";
import {
  addMessage,
  getKnownMembers,
  getMessages,
  getOnlineMembers,
  heartbeat,
  toggleReaction,
  votePoll,
} from "../../../lib/chatDb";

function uniqById<T extends { id: string }>(arr: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

export function useChatSync({
  groupId,
  me,
  open,
}: {
  groupId: string;
  me: ChatUser | null;
  open: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [knownMembers, setKnownMembers] = useState<ChatUser[]>([]);
  const [online, setOnline] = useState<ChatUser[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const lastSeenCountRef = useRef(0);
  const lastOpenAtRef = useRef<number>(0);

  const unreadCount = useMemo(() => {
    // Simple unread logic: when closed, count new messages since last open
    if (open) return 0;
    return Math.max(0, messages.length - lastSeenCountRef.current);
  }, [messages.length, open]);

  async function refreshAll() {
    const [msgs, members, on] = await Promise.all([
      getMessages(groupId),
      getKnownMembers(groupId),
      getOnlineMembers(groupId),
    ]);

    setMessages(msgs);
    setKnownMembers(members);
    setOnline(on);

    // If chat is open, mark as read (by count)
    if (open) {
      lastSeenCountRef.current = msgs.length;
    }
  }

  // Load base data only when chat is opened (faster page load)
  useEffect(() => {
    if (!groupId || !open) return;
    refreshAll().catch((e) => setToast(e?.message ?? "Chat load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, open]);

  // When opened, mark read and refresh
  useEffect(() => {
    if (!open) return;
    lastOpenAtRef.current = Date.now();
    refreshAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Poll messages only while open
  useEffect(() => {
    if (!groupId || !open) return;

    const t = window.setInterval(() => {
      refreshAll().catch(() => {});
    }, 3000);

    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, open]);

  // Presence heartbeat (only when we have a session)
  useEffect(() => {
    if (!groupId || !me) return;

    const beat = async () => {
      try {
        await heartbeat(groupId, me);
      } catch {
        // ignore
      }
    };

    beat();
    const t = window.setInterval(beat, 30_000);
    return () => window.clearInterval(t);
  }, [groupId, me]);

  async function sendMessage(payload: {
    text: string;
    imageDataUrl?: string;
    replyTo?: ChatMessage["replyTo"];
    poll?: ChatMessage["poll"];
    mentions?: string[];
  }) {
    if (!me) {
      setToast("Please set your name / login first.");
      return;
    }

    try {
      await addMessage(groupId, {
        text: payload.text ?? "",
        createdBy: me,
        imageDataUrl: payload.imageDataUrl,
        replyTo: payload.replyTo,
        reactions: {},
        poll: payload.poll,
        mentions: payload.mentions,
      });

      // optimistic refresh
      const msgs = await getMessages(groupId);
      setMessages(msgs);
      if (open) lastSeenCountRef.current = msgs.length;
    } catch (e: any) {
      setToast(e?.message ?? "Send failed");
    }
  }

  async function toggleReactionUI(messageId: string, emoji: string) {
    if (!me) return;
    try {
      await toggleReaction(groupId, messageId, emoji, me.userId);
      const next = await getMessages(groupId);
      setMessages(next);
    } catch (e: any) {
      setToast(e?.message ?? "Reaction failed");
    }
  }

  async function votePollUI(messageId: string, optionId: string) {
    if (!me) return;
    try {
      await votePoll(groupId, messageId, me.userId, optionId);
      const next = await getMessages(groupId);
      setMessages(next);
    } catch (e: any) {
      setToast(e?.message ?? "Vote failed");
    }
  }

  // In case duplicates appear from refresh, keep it clean
  useEffect(() => {
    setMessages((m) => uniqById(m));
  }, [messages.length]);

  return {
    messages,
    knownMembers,
    online,
    unreadCount,
    toast,
    setToast,
    sendMessage,
    toggleReactionUI,
    votePollUI,
  };
}
