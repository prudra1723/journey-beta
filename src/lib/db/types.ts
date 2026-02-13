export type Role = "host" | "admin" | "member";

export type BetaUser = {
  id: string;
  name: string;
  createdAt: number;
};

export type GroupMember = {
  userId: string;
  name: string;
  role: Role;
  joinedAt: number;
};

export type PermissionToggles = {
  canPost: boolean;
  canUploadMedia: boolean;
  canCreateMenu: boolean;
  canEditPlan: boolean;
  canDeleteOwnPosts: boolean;
  canDeleteOwnMedia: boolean;
};

export type BetaGroup = {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  members: GroupMember[];
  permissions: PermissionToggles;
};

export type PlanDayKey =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";

export type PlanItem = {
  id: string;
  day: PlanDayKey;
  startTime: string;
  endTime?: string;
  title: string;
  note?: string;
  mapUrl?: string;
  createdBy: { userId: string; name: string };
  createdAt: number;
  updatedAt: number;
};

export type TimelineComment = {
  id: string;
  text: string;
  createdAt: number;
  createdBy: { userId: string; name: string };
};

export type TimelinePost = {
  id: string;
  groupId: string;
  text: string;
  imageDataUrl?: string;
  createdAt: number;
  createdBy: { userId: string; name: string };
  likes: string[];
  comments: TimelineComment[];
};

export type DbShape = {
  users: BetaUser[];
  groups: BetaGroup[];
  userGroups: Record<string, string[]>;
  plans: Record<string, PlanItem[]>;
  posts: TimelinePost[];
};
