//src/lib/db/storage.ts
import type { DbShape } from "./types";

export const STORAGE_KEY = "journey_beta_db_v1";

export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadDb(): DbShape {
  const fallback: DbShape = {
    users: [],
    groups: [],
    userGroups: {},
    plans: {},
    posts: [],
  };
  const db = safeJsonParse<DbShape>(localStorage.getItem(STORAGE_KEY), fallback);

  // Repair shape
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.groups)) db.groups = [];
  if (!Array.isArray(db.posts)) db.posts = [];
  if (!db.plans) db.plans = {};
  if (!db.userGroups) db.userGroups = {};

  // ✅ Persist repaired shape back to storage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

  return db as DbShape;
}

export function saveDb(db: DbShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}
