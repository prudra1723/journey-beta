// src/features/group/lib/planUiDb.ts
export type FacilityNote = {
  id: string;
  itemId: string;
  name: string; // required
  text: string;
  createdAt: number;
};

export type DinnerSelection = {
  itemId: string;
  choice: string; // Dhindo Set | Dalbhat... | Fruit... | Custom
  customText?: string; // if choice === "Custom"
  name: string; // required
  updatedAt: number;
};

function key(groupId: string) {
  return `journey_beta_planui_v1:${groupId}`;
}

type Store = {
  notes: FacilityNote[];
  dinner: DinnerSelection[];
};

function readStore(groupId: string): Store {
  try {
    const raw = localStorage.getItem(key(groupId));
    if (!raw) return { notes: [], dinner: [] };
    const parsed = JSON.parse(raw) as Store;
    return {
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      dinner: Array.isArray(parsed.dinner) ? parsed.dinner : [],
    };
  } catch {
    return { notes: [], dinner: [] };
  }
}

function writeStore(groupId: string, store: Store) {
  localStorage.setItem(key(groupId), JSON.stringify(store));
}

export function listFacilityNotes(groupId: string, itemId: string) {
  return readStore(groupId).notes.filter((n) => n.itemId === itemId);
}

export function addFacilityNote(
  groupId: string,
  itemId: string,
  name: string,
  text: string,
) {
  const store = readStore(groupId);
  store.notes.unshift({
    id: `note_${Math.random().toString(36).slice(2, 9)}`,
    itemId,
    name: name.trim(),
    text: text.trim(),
    createdAt: Date.now(),
  });
  writeStore(groupId, store);
}

export function deleteFacilityNote(groupId: string, noteId: string) {
  const store = readStore(groupId);
  store.notes = store.notes.filter((n) => n.id !== noteId);
  writeStore(groupId, store);
}

export function getDinnerSelection(groupId: string, itemId: string) {
  return readStore(groupId).dinner.find((d) => d.itemId === itemId) ?? null;
}

export function setDinnerSelection(
  groupId: string,
  itemId: string,
  name: string,
  choice: string,
  customText?: string,
) {
  const store = readStore(groupId);
  const next: DinnerSelection = {
    itemId,
    name: name.trim(),
    choice,
    customText: customText?.trim() || undefined,
    updatedAt: Date.now(),
  };
  const idx = store.dinner.findIndex((d) => d.itemId === itemId);
  if (idx >= 0) store.dinner[idx] = next;
  else store.dinner.push(next);
  writeStore(groupId, store);
}
