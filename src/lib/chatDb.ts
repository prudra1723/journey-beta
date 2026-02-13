// src/lib/chatDb.ts
import { supabase } from "./supabase";

export type ChatUser = { userId: string; name: string };
export type ChatReaction = Record<string, string[]>; // emoji -> userIds[]

export type ChatPoll = {
  question: string;
  options: { id: string; text: string }[];
  votes: Record<string, string>; // userId -> optionId
  closesAt?: number;
};

export type ChatMessage = {
  id: string;
  groupId: string;
  text: string;
  createdAt: number;
  createdBy: ChatUser;
  replyTo?: { id: string; preview: string; name: string };
  imageDataUrl?: string;
  reactions?: ChatReaction;
  poll?: ChatPoll;
  mentions?: string[];
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase not configured");
  return supabase;
}

let presenceDisabled = false;
let membersDisabled = false;

async function mapNames(userIds: string[]) {
  const client = assertSupabase();
  const uniq = Array.from(new Set(userIds)).filter(Boolean);
  if (uniq.length === 0) return new Map<string, string>();

  const { data, error } = await client
    .from("profiles")
    .select("id,display_name")
    .in("id", uniq);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.id, row.display_name ?? "Unknown");
  }
  return map;
}

export async function getMessages(groupId: string): Promise<ChatMessage[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("chat_messages")
    .select("id,group_id,text,user_id,created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  type ChatRow = {
    id: string;
    group_id: string;
    text: string | null;
    user_id: string;
    created_at: string;
  };

  const rows = (data ?? []) as unknown as ChatRow[];
  const nameMap = await mapNames(rows.map((r) => r.user_id));

  return rows.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    text: row.text ?? "",
    createdAt: new Date(row.created_at).getTime(),
    createdBy: {
      userId: row.user_id,
      name: nameMap.get(row.user_id) ?? "Unknown",
    },
  }));
}

/** ✅ NOTE: exported name MUST be addMessage (your hook imports this) */
export async function addMessage(
  groupId: string,
  msg: Omit<ChatMessage, "id" | "groupId" | "createdAt">,
) {
  const client = assertSupabase();

  const { error } = await client.from("chat_messages").insert({
    group_id: groupId,
    text: msg.text ?? "",
    user_id: msg.createdBy.userId,
  });

  if (error) throw error;
}

export async function toggleReaction(
  groupId: string,
  messageId: string,
  emoji: string,
  userId: string,
) {
  // Reactions not supported with minimal schema
  void groupId;
  void messageId;
  void emoji;
  void userId;
}

export async function votePoll(
  groupId: string,
  messageId: string,
  userId: string,
  optionId: string,
) {
  // Polls not supported with minimal schema
  void groupId;
  void messageId;
  void userId;
  void optionId;
}

/** ✅ NOTE: exported name MUST be getKnownMembers (your hook imports this) */
export async function getKnownMembers(groupId: string): Promise<ChatUser[]> {
  const client = assertSupabase();
  if (membersDisabled) return [];
  const { data, error } = await client
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  if (error) {
    membersDisabled = true;
    return [];
  }

  type MemberRow = {
    user_id: string;
  };

  const rows = (data ?? []) as unknown as MemberRow[];
  const nameMap = await mapNames(rows.map((r) => r.user_id));

  return rows.map((row) => ({
    userId: row.user_id,
    name: nameMap.get(row.user_id) ?? "Unknown",
  }));
}

/** Presence */
export async function heartbeat(groupId: string, user: ChatUser) {
  const client = assertSupabase();
  if (presenceDisabled) return;
  const { error } = await client.from("chat_presence").upsert(
    {
      group_id: groupId,
      user_id: user.userId,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "group_id,user_id" },
  );

  if (error) {
    // If schema/policy isn't ready, stop hammering
    presenceDisabled = true;
  }
}

export async function getOnlineMembers(
  groupId: string,
  withinMs = 45_000,
): Promise<ChatUser[]> {
  const client = assertSupabase();
  const since = new Date(Date.now() - withinMs).toISOString();
  if (presenceDisabled) return [];

  const { data, error } = await client
    .from("chat_presence")
    .select("user_id,last_seen")
    .eq("group_id", groupId)
    .gt("last_seen", since);

  if (error) {
    presenceDisabled = true;
    return [];
  }

  type PresenceRow = {
    user_id: string;
    last_seen: string;
  };

  const rows = (data ?? []) as unknown as PresenceRow[];
  const nameMap = await mapNames(rows.map((r) => r.user_id));

  return rows.map((row) => ({
    userId: row.user_id,
    name: nameMap.get(row.user_id) ?? "Unknown",
  }));
}

/** No realtime yet */
export function subscribe() {
  return () => {};
}
