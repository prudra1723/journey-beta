import type { PermissionToggles } from "./types";

export function now() {
  return Date.now();
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(
    16,
  )}`;
}

export function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function makeInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function defaultPerms(): PermissionToggles {
  return {
    canPost: true,
    canUploadMedia: true,
    canCreateMenu: true,
    canEditPlan: true,
    canDeleteOwnPosts: true,
    canDeleteOwnMedia: true,
  };
}
