const KEY_PREFIX = "journey_beta_group_header_bg_v1";

function key(groupId: string) {
  return `${KEY_PREFIX}:${groupId}`;
}

export function readGroupHeaderImage(groupId: string): string | null {
  try {
    return localStorage.getItem(key(groupId));
  } catch {
    return null;
  }
}

export function saveGroupHeaderImage(groupId: string, dataUrl: string) {
  localStorage.setItem(key(groupId), dataUrl);
}

export function clearGroupHeaderImage(groupId: string) {
  localStorage.removeItem(key(groupId));
}
