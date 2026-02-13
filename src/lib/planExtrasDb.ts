import { supabase } from "./supabase";

type MenuItem = { id: string; text: string; createdAt: number };
type DinnerState = {
  items: MenuItem[];
  votesByUser: Record<string, string>; // userId -> menuItemId
  closesAt?: number; // unix ms
};

type FacilityState = {
  wifi: string;
  parking: string;
  notes: { id: string; text: string; by: string; createdAt: number }[];
};

type EventNotesState = {
  notes: { id: string; text: string; by: string; createdAt: number }[];
};

type SubPlanItem = {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  foodMenu?: string;
  mapUrl?: string;
  note?: string;
  createdAt: number;
};

type PlanComment = {
  id: string;
  text: string;
  by: string;
  byId?: string;
  createdAt: number;
  imageDataUrl?: string;
};

type ExtrasState = {
  dinner: DinnerState;
  facility: FacilityState;
  eventNotes: EventNotesState;
  about?: string;
  menuText?: string;
  subItems?: SubPlanItem[];
  planComments?: PlanComment[];
};

function key(groupId: string, itemId: string) {
  return `journey_beta_extras_v2:${groupId}:${itemId}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function defaultState(): ExtrasState {
  return {
    dinner: {
      items: [
        { id: uid("m"), text: "Dhindo Set", createdAt: Date.now() },
        {
          id: uid("m"),
          text: "Dalbhat Nepali Thali Set",
          createdAt: Date.now(),
        },
        { id: uid("m"), text: "Fruit salad only", createdAt: Date.now() },
      ],
      votesByUser: {},
      closesAt: undefined,
    },
    facility: {
      wifi: "",
      parking: "",
      notes: [],
    },
    eventNotes: {
      notes: [],
    },
    about: "",
    menuText: "",
    subItems: [],
    planComments: [],
  };
}

function normalizeExtras(raw?: Partial<ExtrasState> | null): ExtrasState {
  const base = defaultState();
  return {
    dinner: raw?.dinner ?? base.dinner,
    facility: raw?.facility ?? base.facility,
    eventNotes: raw?.eventNotes ?? base.eventNotes,
    about: raw?.about ?? "",
    menuText: raw?.menuText ?? "",
    subItems: raw?.subItems ?? [],
    planComments: raw?.planComments ?? [],
  };
}

function readAll(groupId: string, itemId: string): ExtrasState {
  const s = safeParse<ExtrasState>(
    localStorage.getItem(key(groupId, itemId)),
    defaultState(),
  );
  return normalizeExtras(s);
}

function writeAllLocal(groupId: string, itemId: string, next: ExtrasState) {
  localStorage.setItem(key(groupId, itemId), JSON.stringify(next));
}

async function pushExtrasToRemote(
  groupId: string,
  itemId: string,
  next: ExtrasState,
) {
  if (!supabase) return;
  await supabase.from("plan_extras").upsert(
    {
      plan_id: itemId,
      group_id: groupId,
      data: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plan_id" },
  );
}

function writeAll(groupId: string, itemId: string, next: ExtrasState) {
  writeAllLocal(groupId, itemId, next);
  void pushExtrasToRemote(groupId, itemId, next);
}

export async function syncPlanExtrasFromRemote(
  groupId: string,
  itemId: string,
) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("plan_extras")
    .select("data")
    .eq("plan_id", itemId)
    .maybeSingle();
  if (error) throw error;

  if (data?.data) {
    const next = normalizeExtras(data.data as Partial<ExtrasState>);
    writeAllLocal(groupId, itemId, next);
    return next;
  }

  const raw = localStorage.getItem(key(groupId, itemId));
  if (raw) {
    const local = normalizeExtras(
      safeParse<ExtrasState>(raw, defaultState()),
    );
    await pushExtrasToRemote(groupId, itemId, local);
    return local;
  }

  return readAll(groupId, itemId);
}

export async function pushPlanExtrasToRemote(
  groupId: string,
  itemId: string,
) {
  if (!supabase) return;
  const local = normalizeExtras(readAll(groupId, itemId));
  await pushExtrasToRemote(groupId, itemId, local);
  return local;
}

/* ---------------- Dinner menu (custom + voting + deadline) ---------------- */

export function readDinner(groupId: string, itemId: string): DinnerState {
  return readAll(groupId, itemId).dinner;
}

export function addMenuItem(groupId: string, itemId: string, text: string) {
  const all = readAll(groupId, itemId);
  all.dinner.items.unshift({
    id: uid("m"),
    text: text.trim(),
    createdAt: Date.now(),
  });
  all.menuText = all.menuText
    ? `${all.menuText}, ${text.trim()}`
    : text.trim();
  writeAll(groupId, itemId, all);
}

export function removeMenuItem(
  groupId: string,
  itemId: string,
  menuItemId: string,
) {
  const all = readAll(groupId, itemId);
  all.dinner.items = all.dinner.items.filter((x) => x.id !== menuItemId);
  all.menuText = all.dinner.items.map((x) => x.text).join(", ");

  // remove votes pointing to removed item
  for (const [u, voted] of Object.entries(all.dinner.votesByUser)) {
    if (voted === menuItemId) delete all.dinner.votesByUser[u];
  }

  writeAll(groupId, itemId, all);
}

export function voteMenuItem(
  groupId: string,
  itemId: string,
  userId: string,
  menuItemId: string,
) {
  const all = readAll(groupId, itemId);

  // block voting when closed
  if (all.dinner.closesAt && Date.now() > all.dinner.closesAt) return;

  all.dinner.votesByUser[userId] = menuItemId;
  writeAll(groupId, itemId, all);
}

export function setMenuVotingDeadline(
  groupId: string,
  itemId: string,
  minutesFromNow: number,
) {
  const all = readAll(groupId, itemId);
  const mins = Math.max(1, Math.min(7 * 24 * 60, Math.floor(minutesFromNow))); // 1 min .. 7 days
  all.dinner.closesAt = Date.now() + mins * 60_000;
  writeAll(groupId, itemId, all);
}

export function clearMenuVotingDeadline(groupId: string, itemId: string) {
  const all = readAll(groupId, itemId);
  delete all.dinner.closesAt;
  writeAll(groupId, itemId, all);
}

export function readMenuText(groupId: string, itemId: string) {
  return readAll(groupId, itemId).menuText ?? "";
}

export function setMenuItems(
  groupId: string,
  itemId: string,
  items: string[],
  raw?: string,
) {
  const all = readAll(groupId, itemId);
  const cleaned = items.map((x) => x.trim()).filter(Boolean);
  all.dinner.items = cleaned.map((text) => ({
    id: uid("m"),
    text,
    createdAt: Date.now(),
  }));
  all.dinner.votesByUser = {};
  all.menuText = raw ?? cleaned.join(", ");
  writeAll(groupId, itemId, all);
}

/* ---------------- Facilities / accommodation ---------------- */

export function readFacility(groupId: string, itemId: string): FacilityState {
  return readAll(groupId, itemId).facility;
}

export function saveFacilityBasics(
  groupId: string,
  itemId: string,
  patch: Partial<Pick<FacilityState, "wifi" | "parking">>,
) {
  const all = readAll(groupId, itemId);
  all.facility = { ...all.facility, ...patch };
  writeAll(groupId, itemId, all);
}

export function addFacilityNote(
  groupId: string,
  itemId: string,
  by: string,
  text: string,
) {
  const all = readAll(groupId, itemId);
  all.facility.notes.unshift({
    id: uid("fn"),
    text: text.trim(),
    by,
    createdAt: Date.now(),
  });
  writeAll(groupId, itemId, all);
}

export function deleteFacilityNote(
  groupId: string,
  itemId: string,
  noteId: string,
) {
  const all = readAll(groupId, itemId);
  all.facility.notes = all.facility.notes.filter((n) => n.id !== noteId);
  writeAll(groupId, itemId, all);
}

/* ---------------- Event notes (name required) ---------------- */

export function readEventNotes(
  groupId: string,
  itemId: string,
): EventNotesState {
  return readAll(groupId, itemId).eventNotes;
}

export function addEventNote(
  groupId: string,
  itemId: string,
  by: string,
  text: string,
) {
  const all = readAll(groupId, itemId);
  all.eventNotes.notes.unshift({
    id: uid("en"),
    text: text.trim(),
    by,
    createdAt: Date.now(),
  });
  writeAll(groupId, itemId, all);
}

export function deleteEventNote(
  groupId: string,
  itemId: string,
  noteId: string,
) {
  const all = readAll(groupId, itemId);
  all.eventNotes.notes = all.eventNotes.notes.filter((n) => n.id !== noteId);
  writeAll(groupId, itemId, all);
}

export function readAbout(groupId: string, itemId: string) {
  return readAll(groupId, itemId).about ?? "";
}

export function setAbout(groupId: string, itemId: string, about: string) {
  const all = readAll(groupId, itemId);
  all.about = about.trim();
  writeAll(groupId, itemId, all);
}

export function readSubItems(groupId: string, itemId: string): SubPlanItem[] {
  return readAll(groupId, itemId).subItems ?? [];
}

export function setSubItems(
  groupId: string,
  itemId: string,
  items: SubPlanItem[],
) {
  const all = readAll(groupId, itemId);
  all.subItems = items;
  writeAll(groupId, itemId, all);
}

export function readPlanComments(
  groupId: string,
  itemId: string,
): PlanComment[] {
  return readAll(groupId, itemId).planComments ?? [];
}

export function addPlanComment(
  groupId: string,
  itemId: string,
  by: string,
  text: string,
  imageDataUrl?: string,
  byId?: string,
) {
  const all = readAll(groupId, itemId);
  all.planComments = all.planComments ?? [];
  all.planComments.unshift({
    id: uid("pc"),
    text: text.trim(),
    by,
    byId: byId ?? undefined,
    createdAt: Date.now(),
    imageDataUrl: imageDataUrl ?? undefined,
  });
  writeAll(groupId, itemId, all);
}

export function deletePlanComment(
  groupId: string,
  itemId: string,
  commentId: string,
) {
  const all = readAll(groupId, itemId);
  all.planComments = (all.planComments ?? []).filter(
    (c) => c.id !== commentId,
  );
  writeAll(groupId, itemId, all);
}
