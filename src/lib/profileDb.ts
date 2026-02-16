// src/lib/profileDb.ts
import { supabase } from "./supabase";

const PROFILE_KEY = "journey_beta_profile_v1";
const AVATAR_BUCKET = "journeyapp";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function compressImage(
  file: File,
  maxSide = 1024,
  quality = 0.86,
): Promise<{ blob: Blob; contentType: string; ext: string }> {
  if (!file.type.startsWith("image/")) {
    const ext = file.name.split(".").pop() || "jpg";
    return {
      blob: file,
      contentType: file.type || "application/octet-stream",
      ext,
    };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxSide / maxDim);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b ?? file),
        "image/jpeg",
        quality,
      );
    });

    return { blob, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    const ext = file.name.split(".").pop() || "jpg";
    return {
      blob: file,
      contentType: file.type || "application/octet-stream",
      ext,
    };
  }
}

export type Profile = {
  avatarDataUrl?: string; // can be signed URL or dataUrl
  coverDataUrl?: string; // can be signed URL or dataUrl
  displayName?: string;
  email?: string;
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
    .select("display_name, email, avatar_url, cover_url, bio, location")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  const avatarUrl = await resolveStorageUrl((data as any)?.avatar_url);
  const coverUrl = await resolveStorageUrl((data as any)?.cover_url);

  const next: Profile = {
    displayName: (data as any)?.display_name ?? undefined,
    email: (data as any)?.email ?? undefined,
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
    email?: string | null;
    avatar_url?: string | null;
    cover_url?: string | null;
    bio?: string | null;
    location?: string | null;
  } = {};

  if ("displayName" in patch) payload.display_name = patch.displayName ?? null;
  if ("email" in patch) payload.email = patch.email ?? null;

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
  const { blob, contentType, ext } = await compressImage(file, 1024, 0.86);
  const path = `avatars/${userId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { upsert: true, contentType });

  if (error) throw error;
  return path;
}

export async function uploadProfileCover(userId: string, file: File) {
  const { blob, contentType, ext } = await compressImage(file, 1600, 0.86);
  const path = `covers/${userId}/cover.${ext}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { upsert: true, contentType });

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
