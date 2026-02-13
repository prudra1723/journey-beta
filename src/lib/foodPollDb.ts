export type MealType = "breakfast" | "lunch" | "dinner" | "other";

export type FoodOption = {
  id: string;
  label: string;
  createdAt: number;
};

export type FoodPoll = {
  mealType: MealType;
  closesAt: number;
  options: FoodOption[];
  votes: Record<string, string>; // userId -> optionId
  approvedOptionId?: string;
};

function key(groupId: string, itemId: string) {
  return `journey_beta_foodpoll_v1:${groupId}:${itemId}`;
}

function defaultPoll(): FoodPoll {
  const now = Date.now();
  return {
    mealType: "lunch",
    closesAt: now + 30 * 60 * 1000,
    options: [
      { id: "opt_1", label: "Dhindo Set", createdAt: now },
      { id: "opt_2", label: "Dalbhat Nepali Thali Set", createdAt: now },
      { id: "opt_3", label: "Fruit Salad", createdAt: now },
    ],
    votes: {},
  };
}

export function loadFoodPoll(groupId: string, itemId: string): FoodPoll {
  try {
    const raw = localStorage.getItem(key(groupId, itemId));
    if (!raw) {
      const p = defaultPoll();
      localStorage.setItem(key(groupId, itemId), JSON.stringify(p));
      return p;
    }
    const parsed = JSON.parse(raw) as FoodPoll;
    return {
      mealType: parsed.mealType ?? "lunch",
      closesAt: parsed.closesAt ?? Date.now() + 30 * 60 * 1000,
      options: parsed.options ?? [],
      votes: parsed.votes ?? {},
      approvedOptionId: parsed.approvedOptionId,
    };
  } catch {
    const p = defaultPoll();
    localStorage.setItem(key(groupId, itemId), JSON.stringify(p));
    return p;
  }
}

export function saveFoodPoll(groupId: string, itemId: string, poll: FoodPoll) {
  localStorage.setItem(key(groupId, itemId), JSON.stringify(poll));
}

export function countVotes(poll: FoodPoll, optionId: string) {
  return Object.values(poll.votes).filter((x) => x === optionId).length;
}

export function computeWinner(poll: FoodPoll) {
  if (poll.options.length === 0) return undefined;
  let bestId = poll.options[0].id;
  let best = countVotes(poll, bestId);
  for (const o of poll.options) {
    const c = countVotes(poll, o.id);
    if (c > best) {
      best = c;
      bestId = o.id;
    }
  }
  return bestId;
}

export function formatDeadline(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

export function toDatetimeLocalValue(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export function fromDatetimeLocalValue(v: string) {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Date.now();
}
