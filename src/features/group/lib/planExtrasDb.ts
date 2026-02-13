// src/lib/planExtrasDb.ts
export type FoodVoteState = {
  menu: string[]; // menu items
  votes: Record<string, string>; // userId -> menuItem
  approvedItem?: string;
  voteClosesAt?: number; // timestamp ms
  updatedAt: number;
};

type ExtrasRoot = {
  food: Record<string, FoodVoteState>; // key = `${groupId}:${itemId}`
};

const KEY = "journey_beta_plan_extras_v1";

function readRoot(): ExtrasRoot {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { food: {} };
    const parsed = JSON.parse(raw) as ExtrasRoot;
    return parsed?.food ? parsed : { food: {} };
  } catch {
    return { food: {} };
  }
}

function writeRoot(root: ExtrasRoot) {
  localStorage.setItem(KEY, JSON.stringify(root));
}

function k(groupId: string, itemId: string) {
  return `${groupId}:${itemId}`;
}

export function getFoodState(groupId: string, itemId: string): FoodVoteState {
  const root = readRoot();
  const key = k(groupId, itemId);

  const fallback: FoodVoteState = {
    menu: [
      "Dhindo Set",
      "Dalbhat Nepali Thali set",
      "Fruit salad only",
      "Custom",
    ],
    votes: {},
    updatedAt: Date.now(),
  };

  return root.food[key] ?? fallback;
}

export function setFoodState(
  groupId: string,
  itemId: string,
  next: FoodVoteState,
) {
  const root = readRoot();
  root.food[k(groupId, itemId)] = { ...next, updatedAt: Date.now() };
  writeRoot(root);
}

export function addMenuItem(groupId: string, itemId: string, label: string) {
  const s = getFoodState(groupId, itemId);
  const v = label.trim();
  if (!v) return;
  if (s.menu.map((x) => x.toLowerCase()).includes(v.toLowerCase())) return;
  setFoodState(groupId, itemId, { ...s, menu: [...s.menu, v] });
}

export function removeMenuItem(groupId: string, itemId: string, label: string) {
  const s = getFoodState(groupId, itemId);
  const nextMenu = s.menu.filter((x) => x !== label);

  // remove votes that pointed to removed item
  const nextVotes: Record<string, string> = {};
  for (const [uid, choice] of Object.entries(s.votes)) {
    if (choice !== label) nextVotes[uid] = choice;
  }

  const approvedItem = s.approvedItem === label ? undefined : s.approvedItem;

  setFoodState(groupId, itemId, {
    ...s,
    menu: nextMenu.length ? nextMenu : [],
    votes: nextVotes,
    approvedItem,
  });
}

export function voteMenuItem(
  groupId: string,
  itemId: string,
  userId: string,
  choice: string,
) {
  const s = getFoodState(groupId, itemId);

  // voting closed?
  if (s.voteClosesAt && Date.now() > s.voteClosesAt) return;

  setFoodState(groupId, itemId, {
    ...s,
    votes: { ...s.votes, [userId]: choice },
  });
}

export function clearVotes(groupId: string, itemId: string) {
  const s = getFoodState(groupId, itemId);
  setFoodState(groupId, itemId, { ...s, votes: {}, approvedItem: undefined });
}

export function setVotingDeadline(
  groupId: string,
  itemId: string,
  closesAt?: number,
) {
  const s = getFoodState(groupId, itemId);
  setFoodState(groupId, itemId, { ...s, voteClosesAt: closesAt });
}

export function approveWinner(
  groupId: string,
  itemId: string,
  approvedItem?: string,
) {
  const s = getFoodState(groupId, itemId);
  setFoodState(groupId, itemId, { ...s, approvedItem });
}
