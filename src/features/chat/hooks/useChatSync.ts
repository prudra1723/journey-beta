// src/features/chat/hooks/useChatSync.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatUser } from "../../../lib/chatDb";
import {
  addMessage,
  addDirectMessage,
  getDirectMessages,
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
  mode = "group",
  peerId,
}: {
  groupId: string;
  me: ChatUser | null;
  open: boolean;
  mode?: "group" | "direct";
  peerId?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [knownMembers, setKnownMembers] = useState<ChatUser[]>([]);
  const [online, setOnline] = useState<ChatUser[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [lastIncoming, setLastIncoming] = useState<ChatMessage | null>(null);

  const lastSeenAtRef = useRef<number>(0);
  const lastNotifiedIdRef = useRef<string | null>(null);
  const lastSeenKey = useMemo(() => {
    if (!groupId || !me?.userId) return "";
    const peerKey = mode === "direct" ? peerId ?? "none" : "group";
    return `journey_beta_chat_last_seen:${groupId}:${me.userId}:${mode}:${peerKey}`;
  }, [groupId, me?.userId, mode, peerId]);

  useEffect(() => {
    if (!lastSeenKey) return;
    const raw = localStorage.getItem(lastSeenKey);
    const ts = raw ? Number(raw) : 0;
    if (Number.isFinite(ts)) lastSeenAtRef.current = ts;
  }, [lastSeenKey]);

  const unreadCount = useMemo(() => {
    if (open) return 0;
    const lastSeen = lastSeenAtRef.current;
    if (!lastSeen) return messages.length;
    return messages.reduce(
      (acc, m) => (m.createdAt > lastSeen ? acc + 1 : acc),
      0,
    );
  }, [messages, open]);

  function persistLastSeen(ts: number) {
    lastSeenAtRef.current = ts;
    if (lastSeenKey) {
      localStorage.setItem(lastSeenKey, String(ts));
    }
  }

  const canFetchMessages =
    mode === "group" ? true : Boolean(groupId && me?.userId && peerId);

  async function fetchMessages() {
    if (!canFetchMessages) return [] as ChatMessage[];
    if (mode === "direct") {
      return getDirectMessages(groupId, me!.userId, peerId!);
    }
    return getMessages(groupId);
  }

  async function refreshAll() {
    const [msgs, members, on] = await Promise.all([
      fetchMessages(),
      getKnownMembers(groupId),
      getOnlineMembers(groupId),
    ]);

    setMessages(msgs);
    setKnownMembers(members);
    setOnline(on);

    if (open && msgs.length) {
      persistLastSeen(msgs[msgs.length - 1].createdAt);
    }
  }

  async function refreshMessagesOnly({ notify }: { notify: boolean }) {
    const msgs = await fetchMessages();
    setMessages(msgs);

    if (!msgs.length) return;
    const latest = msgs[msgs.length - 1];

    if (open) {
      persistLastSeen(latest.createdAt);
      lastNotifiedIdRef.current = null;
      return;
    }

    const lastSeen = lastSeenAtRef.current;
    if (
      notify &&
      latest.createdAt > lastSeen &&
      latest.id !== lastNotifiedIdRef.current &&
      latest.createdBy.userId !== me?.userId
    ) {
      lastNotifiedIdRef.current = latest.id;
      setToast(latest.text || `${latest.createdBy.name} sent a message`);
      setLastIncoming(latest);
    }
  }

  // Load base data only when chat is opened (faster page load)
  useEffect(() => {
    if (!groupId || !open) return;
    refreshAll().catch((e) => setToast(e?.message ?? "Chat load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, open, mode, peerId, me?.userId]);

  // When opened, mark read and refresh
  useEffect(() => {
    if (!open) return;
    refreshAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, peerId, me?.userId]);

  // Poll messages: faster when open, slower when closed (to update unread + toast)
  useEffect(() => {
    if (!groupId) return;
    const intervalMs = open ? 3000 : 10000;
    const fn = () => {
      if (open) {
        refreshAll().catch(() => {});
      } else {
        refreshMessagesOnly({ notify: true }).catch(() => {});
      }
    };
    fn();
    const t = window.setInterval(fn, intervalMs);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, open, mode, peerId, me?.userId]);

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
    if (mode === "direct" && !peerId) {
      setToast("Pick a member to message.");
      return;
    }

    try {
      if (mode === "direct") {
        await addDirectMessage(groupId, me, peerId!, payload.text ?? "");
      } else {
        await addMessage(groupId, {
          text: payload.text ?? "",
          createdBy: me,
          imageDataUrl: payload.imageDataUrl,
          replyTo: payload.replyTo,
          reactions: {},
          poll: payload.poll,
          mentions: payload.mentions,
        });
      }

      // optimistic refresh
      const msgs = await fetchMessages();
      setMessages(msgs);
      if (open && msgs.length) {
        persistLastSeen(msgs[msgs.length - 1].createdAt);
      }
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
    lastIncoming,
    clearIncoming: () => setLastIncoming(null),
    sendMessage,
    toggleReactionUI,
    votePollUI,
  };
}
