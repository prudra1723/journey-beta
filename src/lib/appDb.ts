// src/lib/appDb.ts
import { supabase } from "./supabase";
import { defaultPerms, makeInviteCode, normalizeName } from "./db/utils";
import type {
  BetaGroup,
  BetaUser,
  PlanDayKey,
  PlanItem,
  TimelinePost,
  TimelineComment,
} from "./db/types";

const dayOrder: Record<PlanDayKey, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

function assertSupabase() {
  if (!supabase) {
    throw new Error("Supabase not configured");
  }
  return supabase;
}

async function mapNamesByIds(ids: string[]) {
  const client = assertSupabase();
  if (ids.length === 0) return new Map<string, string>();
  const unique = Array.from(new Set(ids));
  const { data, error } = await client
    .from("profiles")
    .select("id,display_name")
    .in("id", unique);
  if (error) throw error;
  const map = new Map<string, string>();
  (data ?? []).forEach((row: any) => {
    map.set(row.id, row.display_name ?? "Unknown");
  });
  return map;
}

function mapProfile(row: {
  id: string;
  display_name: string | null;
  created_at: string;
}): BetaUser {
  return {
    id: row.id,
    name: row.display_name ?? "Unknown",
    createdAt: new Date(row.created_at).getTime(),
  };
}

type GroupRow = {
  id: string;
  name: string;
  code: string;
  created_at: string;
  permissions: unknown | null;
};

function mapGroup(row: GroupRow): BetaGroup {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    createdAt: new Date(row.created_at).getTime(),
    permissions:
      (row.permissions as BetaGroup["permissions"]) ?? defaultPerms(),
    members: [],
  };
}

/**
 * NOTE:
 * This function inserts into profiles without specifying id.
 * If your profiles.id is the auth user id (common setup), this may fail.
 * It's not used by your Start flow (you use ensureProfile(userId,...)), so leaving as-is.
 */
export async function upsertUserByName(name: string) {
  const client = assertSupabase();
  const nameKey = normalizeName(name);

  const { data: existing, error: findErr } = await client
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("name_key", nameKey)
    .maybeSingle();

  if (findErr) throw findErr;

  if (existing) {
    return { user: mapProfile(existing) };
  }

  const { data: created, error: insertErr } = await client
    .from("profiles")
    .insert({
      display_name: name,
      name_key: nameKey,
    })
    .select("id, display_name, created_at")
    .single();

  if (insertErr) throw insertErr;
  return { user: mapProfile(created) };
}

export async function getUserGroups(userId: string): Promise<BetaGroup[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("group_members")
    .select("role,group:groups(id,name,code,created_at,permissions)")
    .eq("user_id", userId);

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{ group: GroupRow | null }>;
  return rows
    .map((row) => row.group)
    .filter((g): g is GroupRow => !!g)
    .map((g) => mapGroup(g));
}

export async function getGroup(groupId: string): Promise<BetaGroup | null> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("groups")
    .select("id,name,code,created_at,permissions")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapGroup(data as GroupRow) : null;
}

export async function getMyRole(groupId: string, userId: string) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as "host" | "admin" | "member") ?? "viewer";
}

export type GroupMember = {
  userId: string;
  role: "host" | "admin" | "member";
  name: string;
};

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("group_members")
    .select("user_id,role")
    .eq("group_id", groupId);
  if (error) throw error;

  type MemberRow = { user_id: string; role: string | null };
  const rows = (data ?? []) as unknown as MemberRow[];
  const nameMap = await mapNamesByIds(rows.map((r) => r.user_id));

  return rows.map((row) => ({
    userId: row.user_id,
    role: (row.role as "host" | "admin" | "member") ?? "member",
    name: nameMap.get(row.user_id) ?? "Unknown",
  }));
}

export async function addGroupMember(
  groupId: string,
  userId: string,
  role: "admin" | "member" | "host" = "member",
) {
  const client = assertSupabase();
  const uid = userId.trim();
  if (!uid) throw new Error("User ID required");

  const { data: existing, error: findErr } = await client
    .from("group_members")
    .select("id,role")
    .eq("group_id", groupId)
    .eq("user_id", uid)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    const { error: updateErr } = await client
      .from("group_members")
      .update({ role })
      .eq("group_id", groupId)
      .eq("user_id", uid);
    if (updateErr) throw updateErr;
    return;
  }

  const { data: newProfile, error: profileErr } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", uid)
    .maybeSingle();
  if (profileErr) throw profileErr;
  const newName = (newProfile as { display_name?: string | null } | null)
    ?.display_name?.trim();

  if (newName) {
    const { data: memberRows, error: membersErr } = await client
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);
    if (membersErr) throw membersErr;

    const rows = (memberRows ?? []) as Array<{ user_id: string }>;
    const nameMap = await mapNamesByIds(rows.map((r) => r.user_id));
    const newKey = normalizeName(newName);
    const conflict = rows.some((r) => {
      if (r.user_id === uid) return false;
      const existingName = nameMap.get(r.user_id) ?? "";
      return normalizeName(existingName) === newKey;
    });
    if (conflict) {
      throw new Error(
        "That name is already used in this group. Please choose another name.",
      );
    }
  }

  const { error } = await client.from("group_members").insert({
    group_id: groupId,
    user_id: uid,
    role,
  });
  if (error) throw error;
}

export async function removeGroupMember(groupId: string, userId: string) {
  const client = assertSupabase();
  const { error } = await client
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getGroupMeta(groupId: string) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("groups")
    .select("group_type,description,event_date,timeline_public")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  return {
    groupType: data?.group_type ?? undefined,
    description: data?.description ?? undefined,
    eventDate: data?.event_date ?? undefined,
    timelinePublic: Boolean(data?.timeline_public),
  };
}

export async function getGroupByCode(code: string): Promise<BetaGroup | null> {
  const client = assertSupabase();
  const invite = code.trim();
  if (!invite) throw new Error("Invite code required");
  const { data, error } = await client
    .from("groups")
    .select("id,name,code,created_at,permissions")
    .eq("code", invite)
    .maybeSingle();
  if (error) throw error;
  return data ? mapGroup(data as GroupRow) : null;
}

export async function findMemberByName(
  groupId: string,
  name: string,
): Promise<{ userId: string; name: string } | null> {
  const client = assertSupabase();
  const target = normalizeName(name);
  const { data, error } = await client
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  if (error) throw error;

  const rows = (data ?? []) as Array<{ user_id: string }>;
  if (rows.length === 0) return null;
  const nameMap = await mapNamesByIds(rows.map((r) => r.user_id));
  for (const row of rows) {
    const display = nameMap.get(row.user_id) ?? "";
    if (normalizeName(display) === target) {
      return { userId: row.user_id, name: display || name };
    }
  }
  return null;
}

/**
 * ✅ UPDATED: createGroup
 * - matches your schema: groups.code (not invite_code)
 * - retries if code collides (409/23505)
 * - upserts group_members to avoid duplicate insert conflict
 */
export async function createGroup(
  groupName: string,
  ownerUserId: string,
  meta?: { groupType?: string; description?: string; eventDate?: string },
) {
  const client = assertSupabase();

  if (!groupName.trim()) throw new Error("Group name required");

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeInviteCode();

    const { data: group, error: groupErr } = await client
      .from("groups")
      .insert({
        name: groupName.trim(),
        code, // ✅ your column from CSV
        group_type: meta?.groupType ?? null,
        description: meta?.description ?? null,
        event_date: meta?.eventDate ?? null,
        permissions: defaultPerms(),
      })
      .select("id,name,code,created_at,permissions")
      .single();

    // Retry on unique conflict (invite code collision)
    if (
      groupErr &&
      ((groupErr as any).code === "23505" || (groupErr as any).status === 409)
    ) {
      continue;
    }
    if (groupErr) throw groupErr;

    // Avoid upsert: some DBs may not have a unique constraint on (group_id,user_id)
    const { data: existingMember, error: findMemberErr } = await client
      .from("group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("user_id", ownerUserId)
      .maybeSingle();
    if (findMemberErr) throw findMemberErr;

    if (!existingMember) {
      const { error: memberErr } = await client.from("group_members").insert({
        group_id: group.id,
        user_id: ownerUserId,
        role: "host",
      });
      if (memberErr) throw memberErr;
    }

    return mapGroup(group as GroupRow);
  }

  throw new Error("Could not generate a unique invite code. Try again.");
}

/**
 * ✅ UPDATED: joinGroup
 * - no RPC needed
 * - finds group by groups.code
 * - upserts group_members (no duplicates)
 */
export async function joinGroup(code: string, userId: string) {
  const client = assertSupabase();
  const invite = code.trim();
  if (!invite) throw new Error("Invite code required");

  const { data: group, error: groupErr } = await client
    .from("groups")
    .select("id,name,code,created_at,permissions")
    .eq("code", invite) // ✅ your column
    .maybeSingle();

  if (groupErr) throw groupErr;
  if (!group) return null;

  const { data: meProfile, error: meErr } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  if (meErr) throw meErr;
  const myName = (meProfile as { display_name?: string | null } | null)
    ?.display_name?.trim();

  if (myName) {
    const { data: memberRows, error: membersErr } = await client
      .from("group_members")
      .select("user_id")
      .eq("group_id", (group as any).id);
    if (membersErr) throw membersErr;

    const rows = (memberRows ?? []) as Array<{ user_id: string }>;
    const nameMap = await mapNamesByIds(rows.map((r) => r.user_id));
    const myKey = normalizeName(myName);
    const conflict = rows.some((r) => {
      if (r.user_id === userId) return false;
      const existingName = nameMap.get(r.user_id) ?? "";
      return normalizeName(existingName) === myKey;
    });
    if (conflict) {
      throw new Error(
        "That name is already used in this group. Please change your name.",
      );
    }
  }

  const { data: existingMember, error: findMemberErr } = await client
    .from("group_members")
    .select("id")
    .eq("group_id", (group as any).id)
    .eq("user_id", userId)
    .maybeSingle();
  if (findMemberErr) throw findMemberErr;

  if (!existingMember) {
    const { error: memberErr } = await client.from("group_members").insert({
      group_id: (group as any).id,
      user_id: userId,
      role: "member",
    });
    if (memberErr) throw memberErr;
  }

  return mapGroup(group as GroupRow);
}

export async function updateGroupMeta(
  groupId: string,
  patch: {
    groupType?: string;
    description?: string;
    eventDate?: string;
    timelinePublic?: boolean;
  },
) {
  const client = assertSupabase();
  const updates: Record<string, unknown> = {};
  if (patch.groupType !== undefined) {
    updates.group_type = patch.groupType ?? null;
  }
  if (patch.description !== undefined) {
    updates.description = patch.description ?? null;
  }
  if (patch.eventDate !== undefined) {
    updates.event_date = patch.eventDate ?? null;
  }
  if (patch.timelinePublic !== undefined) {
    updates.timeline_public = patch.timelinePublic;
  }
  const { error } = await client.from("groups").update(updates).eq("id", groupId);
  if (error) throw error;
}

export async function updateGroupName(groupId: string, name: string) {
  const client = assertSupabase();
  const next = name.trim();
  if (!next) throw new Error("Group name required");
  const { error } = await client
    .from("groups")
    .update({ name: next })
    .eq("id", groupId);
  if (error) throw error;
}

export async function updateGroupCode(groupId: string, code: string) {
  const client = assertSupabase();
  const next = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!next) throw new Error("Invite code required");
  if (next.length < 4) throw new Error("Invite code is too short");

  const { data: existing, error: findErr } = await client
    .from("groups")
    .select("id")
    .eq("code", next)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing && (existing as any).id !== groupId) {
    throw new Error("That code is already in use.");
  }

  const { error } = await client
    .from("groups")
    .update({ code: next })
    .eq("id", groupId);
  if (error) throw error;
  return next;
}

export async function getPlan(groupId: string): Promise<PlanItem[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("plans")
    .select(
      "id,day_key,start_time,end_time,title,note,map_url,created_by,created_at,updated_at,profiles:created_by(display_name)",
    )
    .eq("group_id", groupId);
  if (error) throw error;

  type PlanRow = {
    id: string;
    day_key: PlanDayKey;
    start_time: string;
    end_time: string | null;
    title: string;
    note: string | null;
    map_url: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    profiles?: { display_name: string | null } | null;
  };

  return ((data ?? []) as unknown as PlanRow[])
    .map((row) => ({
      id: row.id,
      day: row.day_key as PlanDayKey,
      startTime: row.start_time,
      endTime: row.end_time ?? undefined,
      title: row.title,
      note: row.note ?? undefined,
      mapUrl: row.map_url ?? undefined,
      createdBy: {
        userId: row.created_by,
        name: row.profiles?.display_name ?? "Unknown",
      },
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    }))
    .sort((a, b) => {
      if (dayOrder[a.day] !== dayOrder[b.day]) {
        return dayOrder[a.day] - dayOrder[b.day];
      }
      return a.startTime.localeCompare(b.startTime);
    });
}

export async function addPlanItem(
  groupId: string,
  item: Omit<PlanItem, "id" | "createdAt" | "updatedAt">,
) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("plans")
    .insert({
      group_id: groupId,
      day_key: item.day,
      start_time: item.startTime,
      end_time: item.endTime ?? null,
      title: item.title,
      note: item.note ?? null,
      map_url: item.mapUrl ?? null,
      created_by: item.createdBy.userId,
    })
    .select(
      "id,day_key,start_time,end_time,title,note,map_url,created_by,created_at,updated_at,profiles:created_by(display_name)",
    )
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlanItem(
  groupId: string,
  itemId: string,
  patch: Partial<Omit<PlanItem, "id" | "createdAt">>,
) {
  const client = assertSupabase();
  const { error } = await client
    .from("plans")
    .update({
      day_key: patch.day,
      start_time: patch.startTime,
      end_time: patch.endTime ?? null,
      title: patch.title,
      note: patch.note ?? null,
      map_url: patch.mapUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("group_id", groupId);
  if (error) throw error;
}

export async function deletePlanItem(groupId: string, itemId: string) {
  const client = assertSupabase();
  const { error } = await client
    .from("plans")
    .delete()
    .eq("group_id", groupId)
    .eq("id", itemId);
  if (error) throw error;
}

export async function getTimeline(
  groupId?: string,
  opts: { limit?: number } = {},
): Promise<TimelinePost[]> {
  const client = assertSupabase();
  const limit = opts.limit ?? 50;
  let query = client
    .from("timeline_posts")
    .select(
      "id,group_id,text,image_url,created_by,created_at,profiles:created_by(display_name)",
    );
  if (groupId) {
    query = query.eq("group_id", groupId);
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  type PostRow = {
    id: string;
    group_id: string;
    text: string;
    image_url: string | null;
    created_by: string;
    created_at: string;
    profiles?: { display_name: string | null } | null;
  };

  const posts = (data ?? []) as unknown as PostRow[];
  const postIds = posts.map((p) => p.id);

  const { data: likes } = postIds.length
    ? await client
        .from("timeline_likes")
        .select("post_id,user_id")
        .in("post_id", postIds)
    : { data: [] };

  const { data: comments } = postIds.length
    ? await client
        .from("timeline_comments")
        .select(
          "id,post_id,text,created_at,user_id,profiles:profiles(display_name)",
        )
        .in("post_id", postIds)
    : { data: [] };

  type LikeRow = { post_id: string; user_id: string };
  type CommentRow = {
    id: string;
    post_id: string;
    text: string;
    created_at: string;
    user_id: string;
    profiles?: { display_name: string | null } | null;
  };

  const likeRows = (likes ?? []) as unknown as LikeRow[];
  const commentRows = (comments ?? []) as unknown as CommentRow[];

  return posts.map((row) => {
    const postLikes = likeRows
      .filter((l) => l.post_id === row.id)
      .map((l) => l.user_id);

    const postComments: TimelineComment[] = commentRows
      .filter((c) => c.post_id === row.id)
      .map((c) => ({
        id: c.id,
        text: c.text,
        createdAt: new Date(c.created_at).getTime(),
        createdBy: {
          userId: c.user_id,
          name: c.profiles?.display_name ?? "Unknown",
        },
      }));

    return {
      id: row.id,
      groupId: row.group_id,
      text: row.text,
      imageDataUrl: row.image_url ?? undefined,
      createdAt: new Date(row.created_at).getTime(),
      createdBy: {
        userId: row.created_by,
        name: row.profiles?.display_name ?? "Unknown",
      },
      likes: postLikes,
      comments: postComments,
    };
  });
}

// Reels (short video)
export type ReelItem = {
  id: string;
  groupId: string;
  videoUrl: string;
  caption?: string | null;
  createdBy: string;
  createdAt: number;
  likeCount: number;
  commentCount: number;
  viewerLiked?: boolean;
};

export type ReelComment = {
  id: string;
  reelId: string;
  userId: string;
  text: string;
  createdAt: number;
};

export async function uploadReelVideo(
  groupId: string,
  file: File,
): Promise<string> {
  const client = assertSupabase();
  const ext = file.name.split(".").pop() || "mp4";
  const path = `${groupId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;
  const { error: uploadErr } = await client.storage
    .from("reels")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (uploadErr) throw uploadErr;
  const { data } = client.storage.from("reels").getPublicUrl(path);
  return data.publicUrl;
}

export async function createReel(
  groupId: string,
  videoUrl: string,
  createdBy: string,
  caption?: string,
) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("reels")
    .insert({
      group_id: groupId,
      video_url: videoUrl,
      caption: caption ?? null,
      created_by: createdBy,
    })
    .select(
      "id,group_id,video_url,caption,created_by,created_at,like_count,comment_count",
    )
    .single();
  if (error) throw error;
  return mapReelRow(data);
}

export async function getReels(
  groupId: string,
  viewerId: string | null,
  page: number,
  pageSize = 8,
): Promise<{ items: ReelItem[]; hasMore: boolean }> {
  const client = assertSupabase();
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await client
    .from("reels")
    .select(
      "id,group_id,video_url,caption,created_by,created_at",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  const base = (data ?? []).map(mapReelRow);
  if (!viewerId || base.length === 0) {
    const ids = base.map((r) => r.id);
    const likeCounts = await getReelLikeCounts(ids);
    const commentCounts = await getReelCommentCounts(ids);
    const items = base.map((r) => ({
      ...r,
      likeCount: likeCounts.get(r.id) ?? 0,
      commentCount: commentCounts.get(r.id) ?? 0,
    }));
    return { items, hasMore: base.length === pageSize };
  }
  const ids = base.map((r) => r.id);
  const { data: likes, error: likeErr } = await client
    .from("reel_likes")
    .select("reel_id")
    .eq("user_id", viewerId)
    .in("reel_id", ids);
  if (likeErr) throw likeErr;
  const likedSet = new Set((likes ?? []).map((l) => l.reel_id as string));
  const likeCounts = await getReelLikeCounts(ids);
  const commentCounts = await getReelCommentCounts(ids);
  const items = base.map((r) => ({
    ...r,
    viewerLiked: likedSet.has(r.id),
    likeCount: likeCounts.get(r.id) ?? 0,
    commentCount: commentCounts.get(r.id) ?? 0,
  }));
  return { items, hasMore: base.length === pageSize };
}

export async function toggleReelLike(reelId: string, userId: string) {
  const client = assertSupabase();
  const { data: existing } = await client
    .from("reel_likes")
    .select("id")
    .eq("reel_id", reelId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    const { error } = await client
      .from("reel_likes")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
    return false;
  }
  const { error } = await client
    .from("reel_likes")
    .insert({ reel_id: reelId, user_id: userId });
  if (error) throw error;
  return true;
}

export async function addReelComment(
  reelId: string,
  userId: string,
  text: string,
) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("reel_comments")
    .insert({ reel_id: reelId, user_id: userId, text })
    .select("id,reel_id,user_id,text,created_at")
    .single();
  if (error) throw error;
  return mapReelCommentRow(data);
}

export async function getReelComments(reelId: string) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("reel_comments")
    .select("id,reel_id,user_id,text,created_at")
    .eq("reel_id", reelId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapReelCommentRow);
}

function mapReelRow(row: {
  id: string;
  group_id: string;
  video_url: string;
  caption: string | null;
  created_by: string;
  created_at: string;
}): ReelItem {
  return {
    id: row.id,
    groupId: row.group_id,
    videoUrl: row.video_url,
    caption: row.caption,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).getTime(),
    likeCount: 0,
    commentCount: 0,
  };
}

function mapReelCommentRow(row: {
  id: string;
  reel_id: string;
  user_id: string;
  text: string;
  created_at: string;
}): ReelComment {
  return {
    id: row.id,
    reelId: row.reel_id,
    userId: row.user_id,
    text: row.text,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function getReelLikeCounts(ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const client = assertSupabase();
  const { data, error } = await client
    .from("reel_likes")
    .select("reel_id")
    .in("reel_id", ids);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.reel_id as string;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

async function getReelCommentCounts(ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const client = assertSupabase();
  const { data, error } = await client
    .from("reel_comments")
    .select("reel_id")
    .in("reel_id", ids);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.reel_id as string;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export async function addTimelinePost(
  groupId: string,
  payload: {
    text: string;
    imageDataUrl?: string;
    createdBy: { userId: string; name: string };
  },
) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("timeline_posts")
    .insert({
      group_id: groupId,
      text: payload.text,
      image_url: payload.imageDataUrl ?? null,
      created_by: payload.createdBy.userId,
    })
    .select(
      "id,group_id,text,image_url,created_by,created_at,profiles:created_by(display_name)",
    )
    .single();

  if (error) throw error;

  const profiles = data.profiles as
    | { display_name?: string | null }
    | Array<{ display_name?: string | null }>
    | null
    | undefined;

  const displayName = Array.isArray(profiles)
    ? profiles[0]?.display_name
    : profiles?.display_name;

  return {
    id: data.id,
    groupId: data.group_id,
    text: data.text,
    imageDataUrl: data.image_url ?? undefined,
    createdAt: new Date(data.created_at).getTime(),
    createdBy: {
      userId: data.created_by,
      name: displayName ?? payload.createdBy.name,
    },
    likes: [],
    comments: [],
  } as TimelinePost;
}

export async function updateTimelinePost(
  postId: string,
  userId: string,
  patch: { text?: string; imageDataUrl?: string | null },
) {
  const client = assertSupabase();
  const { error } = await client
    .from("timeline_posts")
    .update({
      text: patch.text ?? null,
      image_url: patch.imageDataUrl ?? null,
    })
    .eq("id", postId)
    .eq("created_by", userId);
  if (error) throw error;
}

export async function toggleLike(postId: string, userId: string) {
  const client = assertSupabase();
  const { data: existing, error: findErr } = await client
    .from("timeline_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    const { error } = await client
      .from("timeline_likes")
      .delete()
      .eq("id", (existing as any).id);
    if (error) throw error;
    return;
  }

  const { error } = await client.from("timeline_likes").insert({
    post_id: postId,
    user_id: userId,
  });
  if (error) throw error;
}

export async function addComment(
  postId: string,
  payload: { text: string; createdBy: { userId: string; name: string } },
) {
  const client = assertSupabase();
  const { error } = await client.from("timeline_comments").insert({
    post_id: postId,
    user_id: payload.createdBy.userId,
    text: payload.text,
  });
  if (error) throw error;
}

export async function deletePost(postId: string, userId: string) {
  const client = assertSupabase();
  const { error } = await client
    .from("timeline_posts")
    .delete()
    .eq("id", postId)
    .eq("created_by", userId);
  if (error) throw error;
}

export async function readMedia(groupId: string) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("media_items")
    .select(
      "id,image_url,visibility,created_by,created_at,profiles:created_by(display_name)",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  type MediaRow = {
    id: string;
    image_url: string;
    visibility: "group" | "private" | "shared" | null;
    created_by: string;
    created_at: string;
    comments?: unknown;
    profiles?: { display_name: string | null } | null;
  };

  return ((data ?? []) as unknown as MediaRow[]).map((row) => ({
    id: row.id,
    dataUrl: row.image_url,
    visibility: row.visibility ?? "group",
    createdAt: new Date(row.created_at).getTime(),
    createdBy: {
      userId: row.created_by,
      name: row.profiles?.display_name ?? "Unknown",
    },
  }));
}

export async function updateMediaImage(
  mediaId: string,
  userId: string,
  imageUrl: string,
) {
  const client = assertSupabase();
  const { error } = await client
    .from("media_items")
    .update({ image_url: imageUrl })
    .eq("id", mediaId)
    .eq("created_by", userId);
  if (error) throw error;
}

export async function readTimelineImages(groupId?: string) {
  const client = assertSupabase();
  const query = groupId
    ? client
        .from("timeline_images")
        .select("post_id,image_url,position,timeline_posts!inner(group_id)")
        .eq("timeline_posts.group_id", groupId)
    : client.from("timeline_images").select("post_id,image_url,position");
  const { data, error } = await query.order("position", { ascending: true });

  if (error) throw error;

  const map: Record<string, string[]> = {};
  (data ?? []).forEach((row: any) => {
    const key = row.post_id as string;
    map[key] = map[key] ?? [];
    map[key].push(row.image_url as string);
  });
  return map;
}

export async function readTimelineImagesForPosts(postIds: string[]) {
  const client = assertSupabase();
  if (postIds.length === 0) return {};
  const { data, error } = await client
    .from("timeline_images")
    .select("post_id,image_url,position")
    .in("post_id", postIds)
    .order("position", { ascending: true });
  if (error) throw error;
  const map: Record<string, string[]> = {};
  (data ?? []).forEach((row: any) => {
    const key = row.post_id as string;
    map[key] = map[key] ?? [];
    map[key].push(row.image_url as string);
  });
  return map;
}

export async function saveTimelineImages(postId: string, urls: string[]) {
  const client = assertSupabase();
  const { error: delErr } = await client
    .from("timeline_images")
    .delete()
    .eq("post_id", postId);
  if (delErr) throw delErr;

  if (urls.length === 0) return;

  const rows = urls.map((url, index) => ({
    post_id: postId,
    image_url: url,
    position: index,
  }));
  const { error } = await client.from("timeline_images").insert(rows);
  if (error) throw error;
}

export async function addMediaComment(
  mediaId: string,
  createdBy: { userId: string; name: string },
  text: string,
) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("media_items")
    .select("comments")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) throw error;

  const existing = Array.isArray((data as any)?.comments)
    ? ([...(data as any).comments] as any[])
    : [];

  const comment = {
    id: `mc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim(),
    createdAt: Date.now(),
    createdBy,
    replies: [],
  };

  existing.unshift(comment);

  const { error: updateErr } = await client
    .from("media_items")
    .update({ comments: existing })
    .eq("id", mediaId);
  if (updateErr) throw updateErr;

  return comment;
}

export async function addMediaCommentReply(
  mediaId: string,
  commentId: string,
  createdBy: { userId: string; name: string },
  text: string,
) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("media_items")
    .select("comments")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) throw error;

  const existing = Array.isArray((data as any)?.comments)
    ? ([...(data as any).comments] as any[])
    : [];

  const idx = existing.findIndex((c) => c.id === commentId);
  if (idx === -1) return;
  const comment = existing[idx];
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  replies.push({
    id: `mcr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim(),
    createdAt: Date.now(),
    createdBy,
  });
  existing[idx] = { ...comment, replies };

  const { error: updateErr } = await client
    .from("media_items")
    .update({ comments: existing })
    .eq("id", mediaId);
  if (updateErr) throw updateErr;
}

export async function addMedia(
  groupId: string,
  dataUrl: string,
  createdBy: { userId: string; name: string },
  visibility: "group" | "private" | "shared" = "group",
) {
  const client = assertSupabase();
  const { error } = await client.from("media_items").insert({
    group_id: groupId,
    image_url: dataUrl,
    visibility,
    created_by: createdBy.userId,
  });
  if (error) throw error;
}

export async function deleteMedia(
  groupId: string,
  mediaId: string,
  userId: string,
) {
  const client = assertSupabase();
  const { error } = await client
    .from("media_items")
    .delete()
    .eq("id", mediaId)
    .eq("group_id", groupId)
    .eq("created_by", userId);
  if (error) throw error;
}

export type OrderListItem = {
  id: string;
  label: string;
  checked: boolean;
};

export async function readOrderList(groupId: string) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("order_lists")
    .select("items,is_created,updated_at,created_by")
    .eq("group_id", groupId)
    .maybeSingle();
  if (error) throw error;

  const items = Array.isArray(data?.items) ? data?.items : [];
  const normalized = items
    .filter((item: any) => item?.id && item?.label)
    .map((item: any) => ({
      id: String(item.id),
      label: String(item.label),
      checked: Boolean(item.checked),
    }));

  return {
    items: normalized as OrderListItem[],
    created: Boolean(data?.is_created),
    updatedAt: data?.updated_at ?? null,
    createdBy: data?.created_by ?? null,
  };
}

export async function saveOrderList(
  groupId: string,
  items: OrderListItem[],
  created: boolean,
  userId: string,
) {
  const client = assertSupabase();
  const payload = {
    group_id: groupId,
    items,
    is_created: created,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client
    .from("order_lists")
    .upsert(payload, { onConflict: "group_id" });
  if (error) throw error;
}

export function subscribeOrderList(
  groupId: string,
  onChange: () => void,
) {
  const client = assertSupabase();
  const channel = client
    .channel(`order_list_${groupId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_lists",
        filter: `group_id=eq.${groupId}`,
      },
      () => {
        onChange();
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

// -------- Marketplace (Bands) --------
export type BandProfile = {
  id: string;
  ownerId: string;
  name: string;
  bandType?: string | null;
  description?: string | null;
  location?: string | null;
  coverRange?: string | null;
  youtubeUrl?: string | null;
  coverImageUrl?: string | null;
  availability?: string[];
  createdAt: number;
  updatedAt: number;
};

export type BandBookingRequest = {
  id: string;
  bandId: string;
  requesterId: string;
  eventDate?: string | null;
  message?: string | null;
  status: string;
  createdAt: number;
  band?: Pick<BandProfile, "id" | "name" | "bandType" | "location" | "coverImageUrl">;
  requesterName?: string | null;
};

export type BandRequestMessage = {
  id: string;
  requestId: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: number;
};

function mapBandProfile(row: any): BandProfile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    bandType: row.band_type ?? null,
    description: row.description ?? null,
    location: row.location ?? null,
    coverRange: row.cover_range ?? null,
    youtubeUrl: row.youtube_url ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    availability: Array.isArray(row.availability) ? row.availability : [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at ?? row.created_at).getTime(),
  };
}

export async function getBandProfiles(): Promise<BandProfile[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("band_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapBandProfile);
}

export async function getMyBandProfile(
  ownerId: string,
): Promise<BandProfile | null> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("band_profiles")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapBandProfile(data) : null;
}

export async function upsertBandProfile(
  ownerId: string,
  payload: {
    name: string;
    bandType?: string;
    description?: string;
    location?: string;
    coverRange?: string;
    youtubeUrl?: string;
    coverImageUrl?: string | null;
    availability?: string[];
  },
) {
  const client = assertSupabase();
  const existing = await getMyBandProfile(ownerId);
  const now = new Date().toISOString();
  const data = {
    owner_id: ownerId,
    name: payload.name,
    band_type: payload.bandType ?? null,
    description: payload.description ?? null,
    location: payload.location ?? null,
    cover_range: payload.coverRange ?? null,
    youtube_url: payload.youtubeUrl ?? null,
    cover_image_url: payload.coverImageUrl ?? null,
    availability: payload.availability ?? [],
    updated_at: now,
  };

  if (!existing) {
    const { data: created, error } = await client
      .from("band_profiles")
      .insert({ ...data, created_at: now })
      .select("*")
      .single();
    if (error) throw error;
    return mapBandProfile(created);
  }

  const { data: updated, error } = await client
    .from("band_profiles")
    .update(data)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw error;
  return mapBandProfile(updated);
}

export async function createBandRequest(
  bandId: string,
  requesterId: string,
  payload: { eventDate?: string; message?: string },
) {
  const client = assertSupabase();
  const { data, error } = await client
    .from("band_booking_requests")
    .insert({
      band_id: bandId,
      requester_id: requesterId,
      event_date: payload.eventDate ?? null,
      message: payload.message ?? null,
      status: "pending",
    })
    .select(
      "id,band_id,requester_id,event_date,message,status,created_at",
    )
    .single();
  if (error) throw error;
  return {
    id: data.id,
    bandId: data.band_id,
    requesterId: data.requester_id,
    eventDate: data.event_date,
    message: data.message,
    status: data.status,
    createdAt: new Date(data.created_at).getTime(),
  } as BandBookingRequest;
}

export async function getBandRequestsIncoming(
  ownerId: string,
): Promise<BandBookingRequest[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("band_booking_requests")
    .select(
      "id,band_id,requester_id,event_date,message,status,created_at,band:band_profiles(id,name,band_type,location,cover_image_url,owner_id),requester:profiles!requester_id(display_name)",
    )
    .eq("band.owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    bandId: row.band_id,
    requesterId: row.requester_id,
    eventDate: row.event_date,
    message: row.message,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    band: row.band
      ? {
          id: row.band.id,
          name: row.band.name,
          bandType: row.band.band_type ?? null,
          location: row.band.location ?? null,
          coverImageUrl: row.band.cover_image_url ?? null,
        }
      : undefined,
    requesterName: row.requester?.display_name ?? null,
  }));
}

export async function getBandRequestsOutgoing(
  requesterId: string,
): Promise<BandBookingRequest[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("band_booking_requests")
    .select(
      "id,band_id,requester_id,event_date,message,status,created_at,band:band_profiles(id,name,band_type,location,cover_image_url,owner_id)",
    )
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    bandId: row.band_id,
    requesterId: row.requester_id,
    eventDate: row.event_date,
    message: row.message,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    band: row.band
      ? {
          id: row.band.id,
          name: row.band.name,
          bandType: row.band.band_type ?? null,
          location: row.band.location ?? null,
          coverImageUrl: row.band.cover_image_url ?? null,
        }
      : undefined,
  }));
}

export async function updateBandRequestStatus(
  requestId: string,
  status: string,
) {
  const client = assertSupabase();
  const { error } = await client
    .from("band_booking_requests")
    .update({ status })
    .eq("id", requestId);
  if (error) throw error;
}

export async function getBandRequestMessages(
  requestId: string,
): Promise<BandRequestMessage[]> {
  const client = assertSupabase();
  const { data, error } = await client
    .from("band_request_messages")
    .select("id,request_id,sender_id,message,created_at,profiles:sender_id(display_name)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    requestId: row.request_id,
    senderId: row.sender_id,
    senderName: row.profiles?.display_name ?? "Unknown",
    message: row.message ?? "",
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function addBandRequestMessage(
  requestId: string,
  senderId: string,
  message: string,
) {
  const client = assertSupabase();
  const { error } = await client.from("band_request_messages").insert({
    request_id: requestId,
    sender_id: senderId,
    message,
  });
  if (error) throw error;
}
