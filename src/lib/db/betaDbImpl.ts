import type { BetaGroup, PlanDayKey, PlanItem, TimelinePost } from "./types";
import { loadDb, saveDb } from "./storage";
import { defaultPerms, makeInviteCode, normalizeName, now, uid } from "./utils";
import { seedSydneyPlan } from "./seedSydneyPlan";

export const betaDb = {
  normalizeName,

  // --- Users ---
  upsertUserByName(name: string) {
    const db = loadDb();
    const norm = normalizeName(name);
    let user = db.users.find((u) => normalizeName(u.name) === norm);

    if (!user) {
      user = { id: uid("user"), name: name.trim(), createdAt: now() };
      db.users.push(user);
      db.userGroups[user.id] = db.userGroups[user.id] ?? [];
      saveDb(db);
    }
    return { user };
  },

  // --- Groups ---
  getGroups(): BetaGroup[] {
    return loadDb().groups;
  },
  getUsers() {
    return loadDb().users;
  },

  getUserGroups(userId: string): BetaGroup[] {
    const db = loadDb();
    const ids = db.userGroups[userId] ?? [];
    return db.groups.filter((g) => ids.includes(g.id));
  },

  createGroup(groupName: string, ownerUserId: string) {
    const db = loadDb();
    const owner = db.users.find((u) => u.id === ownerUserId);
    if (!owner) throw new Error("Owner user not found");

    const group: BetaGroup = {
      id: uid("group"),
      name: groupName,
      code: makeInviteCode(),
      createdAt: now(),
      permissions: defaultPerms(),
      members: [
        {
          userId: owner.id,
          name: owner.name,
          role: "host",
          joinedAt: now(),
        },
      ],
    };

    db.groups.push(group);
    db.userGroups[owner.id] = Array.from(
      new Set([...(db.userGroups[owner.id] ?? []), group.id]),
    );

    // Seed plan
    const seed = seedSydneyPlan();
    db.plans[group.id] = Object.values(seed)
      .flat()
      .map((x) => ({
        id: uid("plan"),
        day: x.day,
        startTime: x.startTime,
        endTime: x.endTime,
        title: x.title,
        note: x.note,
        mapUrl: x.mapUrl,
        createdBy: { userId: owner.id, name: owner.name },
        createdAt: now(),
        updatedAt: now(),
      }));

    saveDb(db);
    return group;
  },

  joinGroup(code: string, userId: string) {
    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");

    const group = db.groups.find(
      (g) => g.code.toUpperCase() === code.toUpperCase(),
    );
    if (!group) return null;

    const alreadyMember = group.members.some((m) => m.userId === user.id);
    if (!alreadyMember) {
      group.members.push({
        userId: user.id,
        name: user.name,
        role: "member",
        joinedAt: now(),
      });
    }

    db.userGroups[user.id] = Array.from(
      new Set([...(db.userGroups[user.id] ?? []), group.id]),
    );

    db.plans[group.id] = db.plans[group.id] ?? [];
    saveDb(db);
    return group;
  },

  // --- Plan API ---
  getPlan(groupId: string): PlanItem[] {
    const db = loadDb();
    return (db.plans[groupId] ?? []).slice().sort((a, b) => {
      const dayOrder: Record<PlanDayKey, number> = {
        mon: 0,
        tue: 1,
        wed: 2,
        thu: 3,
        fri: 4,
        sat: 5,
        sun: 6,
      };
      if (dayOrder[a.day] !== dayOrder[b.day])
        return dayOrder[a.day] - dayOrder[b.day];
      return a.startTime.localeCompare(b.startTime);
    });
  },

  addPlanItem(
    groupId: string,
    item: Omit<PlanItem, "id" | "createdAt" | "updatedAt">,
  ) {
    const db = loadDb();
    db.plans[groupId] = db.plans[groupId] ?? [];
    const newItem: PlanItem = {
      ...item,
      id: uid("plan"),
      createdAt: now(),
      updatedAt: now(),
    };
    db.plans[groupId].push(newItem);
    saveDb(db);
    return newItem;
  },

  updatePlanItem(
    groupId: string,
    itemId: string,
    patch: Partial<Omit<PlanItem, "id" | "createdAt">>,
  ) {
    const db = loadDb();
    const items = db.plans[groupId] ?? [];
    const idx = items.findIndex((x) => x.id === itemId);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...patch, updatedAt: now() };
    saveDb(db);
    return items[idx];
  },

  deletePlanItem(groupId: string, itemId: string) {
    const db = loadDb();
    db.plans[groupId] = (db.plans[groupId] ?? []).filter(
      (x) => x.id !== itemId,
    );
    saveDb(db);
  },

  // --- Timeline API ---
  getTimeline(groupId: string): TimelinePost[] {
    const db = loadDb();
    return (db.posts ?? [])
      .filter((p) => p.groupId === groupId)
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  addTimelinePost(
    groupId: string,
    payload: {
      text: string;
      imageDataUrl?: string;
      createdBy: { userId: string; name: string };
    },
  ) {
    const db = loadDb();
    const post: TimelinePost = {
      id: uid("post"),
      groupId,
      text: payload.text,
      imageDataUrl: payload.imageDataUrl,
      createdAt: now(),
      createdBy: payload.createdBy,
      likes: [],
      comments: [],
    };
    db.posts = db.posts ?? [];
    db.posts.push(post);
    saveDb(db);
    return post;
  },

  toggleLike(postId: string, userId: string) {
    const db = loadDb();
    const p = (db.posts ?? []).find((x) => x.id === postId);
    if (!p) return;
    const has = p.likes.includes(userId);
    p.likes = has
      ? p.likes.filter((id) => id !== userId)
      : [...p.likes, userId];
    saveDb(db);
  },

  addComment(
    postId: string,
    payload: { text: string; createdBy: { userId: string; name: string } },
  ) {
    const db = loadDb();
    const p = (db.posts ?? []).find((x) => x.id === postId);
    if (!p) return;
    p.comments.push({
      id: uid("cmt"),
      text: payload.text,
      createdAt: now(),
      createdBy: payload.createdBy,
    });
    saveDb(db);
  },

  deletePost(postId: string, userId: string) {
    const db = loadDb();
    const p = (db.posts ?? []).find((x) => x.id === postId);
    if (!p) return;
    if (p.createdBy.userId !== userId) return; // beta rule
    db.posts = (db.posts ?? []).filter((x) => x.id !== postId);
    saveDb(db);
  },
};
