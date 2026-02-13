export type MediaItem = {
  id: string;
  dataUrl: string;
  createdAt: number;
  createdBy: { userId: string; name: string };
};

const MEDIA_KEY = "journey_beta_media_v1";

type MediaStore = Record<string, MediaItem[]>;

function readDb(): MediaStore {
  try {
    const raw = localStorage.getItem(MEDIA_KEY);
    return raw ? (JSON.parse(raw) as MediaStore) : {};
  } catch {
    return {};
  }
}

function writeDb(db: MediaStore) {
  localStorage.setItem(MEDIA_KEY, JSON.stringify(db));
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function readMedia(groupId: string): MediaItem[] {
  const db = readDb();
  return db[groupId] ?? [];
}

export function addMedia(
  groupId: string,
  dataUrl: string,
  createdBy: { userId: string; name: string },
) {
  const db = readDb();
  const list = db[groupId] ?? [];
  const item: MediaItem = {
    id: uid("media"),
    dataUrl,
    createdAt: Date.now(),
    createdBy,
  };
  db[groupId] = [item, ...list];
  writeDb(db);
  return item;
}

export function deleteMedia(groupId: string, mediaId: string) {
  const db = readDb();
  db[groupId] = (db[groupId] ?? []).filter((m) => m.id !== mediaId);
  writeDb(db);
}
