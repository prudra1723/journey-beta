// src/features/group/lib/groupMetaDb.ts

export type GroupMeta = {
  groupType?: string;
  description?: string;
  eventDate?: string; // ISO date string
  timelinePublic?: boolean;
};

const KEY = "journey_beta_group_meta_v1";

function readDb(): Record<string, GroupMeta> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, GroupMeta>) : {};
  } catch {
    return {};
  }
}

function writeDb(db: Record<string, GroupMeta>) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function readGroupMeta(groupId: string): GroupMeta {
  const db = readDb();
  return db[groupId] ?? {};
}

export function saveGroupMeta(groupId: string, meta: GroupMeta) {
  const db = readDb();
  db[groupId] = meta;
  writeDb(db);
}
