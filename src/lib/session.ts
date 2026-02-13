import { readJSON, writeJSON } from "./storage";
import type { BetaUser } from "./betaDb";

const SESSION_KEY = "journey_beta_session_v1";

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
