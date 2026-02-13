// src/lib/profileDb.ts
import { supabase } from "./supabase";

const PROFILE_KEY = "journey_beta_profile_v1";
const AVATAR_BUCKET = "journeyapp";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type Profile = {
  avatarDataUrl?: string; // can be signed URL or dataUrl
  coverDataUrl?: string; // can be signed URL or dataUrl
  displayName?: string;
  bio?: string;
  location?: string;
  updatedAt: number;
};

type ProfileStore = Record<string, Profile>;

function readDb(): ProfileStore {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ProfileStore) : {};
  } catch {
    return {};
  }
}

function writeDb(db: ProfileStore) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(db));
}

export function readProfile(userId: string): Profile {
  return readDb()[userId] ?? { updatedAt: 0 };
}

export function saveProfile(userId: string, patch: Partial<Profile>) {
  const db = readDb();
  const current = db[userId] ?? { updatedAt: 0 };
  db[userId] = { ...current, ...patch, updatedAt: Date.now() };
  writeDb(db);
}

export function readProfileAvatar(userId: string): string | undefined {
  return readProfile(userId)?.avatarDataUrl;
}

export function readProfileCover(userId: string): string | undefined {
  return readProfile(userId)?.coverDataUrl;
}

// Some components import this name
export function saveProfileAvatar(
  userId: string,
  avatarDataUrl: string,
  displayName?: string,
) {
  saveProfile(userId, { avatarDataUrl, displayName });
}

export function saveProfileCover(userId: string, coverDataUrl: string) {
  saveProfile(userId, { coverDataUrl });
}

async function resolveStorageUrl(value?: string | null) {
  if (!value) return undefined;
  if (value.startsWith("http")) return value;

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);

  if (error) throw error;
  return data.signedUrl;
}

export async function fetchProfileRemote(userId: string): Promise<Profile> {
  if (!userId) throw new Error("fetchProfileRemote: userId missing");

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, cover_url, bio, location")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  const avatarUrl = await resolveStorageUrl((data as any)?.avatar_url);
  const coverUrl = await resolveStorageUrl((data as any)?.cover_url);

  const next: Profile = {
    displayName: (data as any)?.display_name ?? undefined,
    avatarDataUrl: avatarUrl ?? undefined,
    coverDataUrl: coverUrl ?? undefined,
    bio: (data as any)?.bio ?? undefined,
    location: (data as any)?.location ?? undefined,
    updatedAt: Date.now(),
  };

  saveProfile(userId, next);
  return next;
}

export async function saveProfileRemote(
  userId: string,
  patch: Partial<Profile>,
) {
  const payload: {
    display_name?: string | null;
    avatar_url?: string | null;
    cover_url?: string | null;
    bio?: string | null;
    location?: string | null;
  } = {};

  if ("displayName" in patch) payload.display_name = patch.displayName ?? null;

  // DB stores STORAGE PATHS, not signed urls
  if ("avatarDataUrl" in patch)
    payload.avatar_url = patch.avatarDataUrl ?? null;
  if ("coverDataUrl" in patch) payload.cover_url = patch.coverDataUrl ?? null;

  if ("bio" in patch) payload.bio = patch.bio ?? null;
  if ("location" in patch) payload.location = patch.location ?? null;

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);
  if (error) throw error;

  saveProfile(userId, patch);
}

export async function uploadProfileAvatar(userId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `avatars/${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw error;
  return path;
}

export async function uploadProfileCover(userId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `covers/${userId}/cover.${ext}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw error;
  return path;
}

export async function getSignedStorageUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) throw error;
  return data.signedUrl;
}
