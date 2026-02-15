import { readJSON, writeJSON } from "./storage";
import type { BetaUser } from "./betaDb";

const SESSION_KEY = "journey_beta_session_v1";
const LAST_GROUP_KEY = "journey_beta_last_group_v1";

export type BetaSession = {
  userId: string;
  name: string;
};

export function getSession(): BetaSession | null {
  return readJSON<BetaSession | null>(SESSION_KEY, null);
}

export function setSession(user: BetaUser) {
  writeJSON<BetaSession>(SESSION_KEY, {
    userId: user.id,
    name: user.name,
  });
}

export function setSessionFromProfile(userId: string, name: string) {
  writeJSON<BetaSession>(SESSION_KEY, { userId, name });
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getLastGroupId(): string | null {
  try {
    return localStorage.getItem(LAST_GROUP_KEY);
  } catch {
    return null;
  }
}

export function setLastGroupId(groupId: string) {
  try {
    localStorage.setItem(LAST_GROUP_KEY, groupId);
  } catch {
    // ignore
  }
}

export function clearLastGroupId() {
  try {
    localStorage.removeItem(LAST_GROUP_KEY);
  } catch {
    // ignore
  }
}
