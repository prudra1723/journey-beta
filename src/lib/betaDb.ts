// src/lib/betaDb.ts
// Single source of truth for the app: Supabase-backed appDb.
// The old LocalStorage betaDbImpl is intentionally not exported here anymore
// to prevent split backends and circular dependencies.

export type {
  BetaGroup,
  BetaUser,
  PlanDayKey,
  PlanItem,
  TimelinePost,
  TimelineComment,
} from "./db/types";

export {
  upsertUserByName,
  getUserGroups,
  getGroup,
  getMyRole,
  getGroupMeta,
  createGroup,
  joinGroup,
  updateGroupMeta,
  getPlan,
  addPlanItem,
  updatePlanItem,
  deletePlanItem,
  getTimeline,
  addTimelinePost,
  updateTimelinePost,
  toggleLike,
  addComment,
  deletePost,
  readMedia,
  addMedia,
  addMediaCommentReply,
  addMediaComment,
  deleteMedia,
} from "./appDb";
