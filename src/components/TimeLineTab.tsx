// src/components/TimelineTab.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { UserAvatar } from "./UserAvatar";
import {
  addComment as addCommentApi,
  addTimelinePost,
  updateTimelinePost,
  deletePost as deletePostApi,
  getTimeline,
  readTimelineImagesForPosts,
  saveTimelineImages,
  toggleLike as toggleLikeApi,
} from "../lib/betaDb";
import { uploadImageToR2 } from "../lib/r2Upload";

import { getSession } from "../lib/session";

type DbTimelinePost = {
  id: string;
  groupId: string;
  text: string;
  imageDataUrl?: string;
  createdAt: number;
  createdBy: { userId: string; name: string };
  likes: string[];
  comments: Array<{
    id: string;
    text: string;
    createdAt: number;
    createdBy: { userId: string; name: string };
  }>;
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
}

async function imageFileToDataUrl(
  file: File,
  maxWidth = 1200,
  quality = 0.82,
) {
  if (!file.type.startsWith("image/")) throw new Error("Only images allowed.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", quality);
}

const EXTRA_KEY = "journey_beta_timeline_extra_v1";

type Reply = {
  id: string;
  text: string;
  createdAt: number;
  createdBy: { userId: string; name: string };
};

type ExtraDb = {
  postImages: Record<string, string[]>;
  commentReactions: Record<string, Record<string, string[]>>;
  replies: Record<string, Reply[]>;
  shareCounts: Record<string, number>;
};

function loadExtra(): ExtraDb {
  try {
    const raw = localStorage.getItem(EXTRA_KEY);
    if (!raw)
      return {
        postImages: {},
        commentReactions: {},
        replies: {},
        shareCounts: {},
      };

    const parsed = JSON.parse(raw) as Partial<ExtraDb>;
    return {
      postImages: parsed.postImages ?? {},
      commentReactions: parsed.commentReactions ?? {},
      replies: parsed.replies ?? {},
      shareCounts: parsed.shareCounts ?? {},
    };
  } catch {
    return {
      postImages: {},
      commentReactions: {},
      replies: {},
      shareCounts: {},
    };
  }
}

function saveExtra(db: ExtraDb) {
  localStorage.setItem(EXTRA_KEY, JSON.stringify(db));
}

function kOf(postId: string, commentId: string) {
  return `${postId}:${commentId}`;
}

const REACTION_EMOJIS = ["❤️", "🤗", "👍", "😂", "😮", "😢"] as const;

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function LikeLine({ liked, count }: { liked: boolean; count: number }) {
  if (count <= 0) {
    return <span className="text-sm text-gray-500">Be the first to like</span>;
  }
  const text = liked
    ? `You and ${count - 1} other${count - 1 === 1 ? "" : "s"}`
    : `${count} like${count === 1 ? "" : "s"}`;

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-500 text-white text-sm">
        ❤️
      </span>
      <span className="text-sm text-gray-700 font-semibold">{text}</span>
    </div>
  );
}

/** ---------- Images ---------- */
function MediaThumb({
  src,
  onClick,
  className,
}: {
  src: string;
  onClick: () => void;
  className: string;
}) {
  if (isVideoUrl(src)) {
    return (
      <div className="relative h-full w-full">
        <video
          src={src}
          className={className}
          muted
          playsInline
          preload="metadata"
        />
        <button
          type="button"
          onClick={onClick}
          className="absolute inset-0 flex items-center justify-center bg-black/10 text-white text-3xl font-extrabold"
          aria-label="Play video"
        >
          ▶
        </button>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="post"
      className={className}
      loading="lazy"
      onClick={onClick}
    />
  );
}
function SingleImage({
  src,
  onPreview,
}: {
  src: string;
  onPreview: (index: number) => void;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-200 timeline-image-card">
      <MediaThumb
        src={src}
        onClick={() => onPreview(0)}
        className="w-full h-[320px] sm:h-[520px] lg:h-[680px] object-cover cursor-zoom-in timeline-image"
      />
    </div>
  );
}
function TwoImages({
  images,
  onPreview,
}: {
  images: string[];
  onPreview: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {images.slice(0, 2).map((src, idx) => (
        <div
          key={idx}
          className="overflow-hidden rounded-2xl border border-gray-200 timeline-image-card"
        >
          <MediaThumb
            src={src}
            onClick={() => onPreview(idx)}
            className="w-full h-[200px] sm:h-[260px] object-cover cursor-zoom-in timeline-image"
          />
        </div>
      ))}
    </div>
  );
}
function ThreeImages({
  images,
  onPreview,
}: {
  images: string[];
  onPreview: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-1 row-span-2 overflow-hidden rounded-2xl border border-gray-200 timeline-image-card">
        <MediaThumb
          src={images[0]}
          onClick={() => onPreview(0)}
          className="w-full h-[380px] sm:h-[528px] object-cover cursor-zoom-in timeline-image"
        />
      </div>
      <div className="col-span-1 overflow-hidden rounded-2xl border border-gray-200 timeline-image-card">
        <MediaThumb
          src={images[1]}
          onClick={() => onPreview(1)}
          className="w-full h-[180px] sm:h-[260px] object-cover cursor-zoom-in timeline-image"
        />
      </div>
      <div className="col-span-1 overflow-hidden rounded-2xl border border-gray-200 timeline-image-card">
        <MediaThumb
          src={images[2]}
          onClick={() => onPreview(2)}
          className="w-full h-[180px] sm:h-[260px] object-cover cursor-zoom-in timeline-image"
        />
      </div>
    </div>
  );
}
function FourImages({
  images,
  onPreview,
}: {
  images: string[];
  onPreview: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {images.slice(0, 4).map((src, idx) => (
        <div
          key={idx}
          className="overflow-hidden rounded-2xl border border-gray-200 timeline-image-card"
        >
          <MediaThumb
            src={src}
            onClick={() => onPreview(idx)}
            className="w-full h-[200px] sm:h-[260px] object-cover cursor-zoom-in timeline-image"
          />
        </div>
      ))}
    </div>
  );
}
function ManyImages({
  images,
  onPreview,
}: {
  images: string[];
  onPreview: (index: number) => void;
}) {
  const firstFour = images.slice(0, 4);
  const remaining = images.length - 4;

  return (
    <div className="grid grid-cols-2 gap-2">
      {firstFour.map((src, idx) => (
        <div
          key={idx}
          className="overflow-hidden rounded-2xl border border-gray-200 relative timeline-image-card"
        >
          <MediaThumb
            src={src}
            onClick={() => onPreview(idx)}
            className="w-full h-[200px] sm:h-[260px] object-cover cursor-zoom-in timeline-image"
          />
          {idx === 3 && remaining > 0 && (
            <button
              type="button"
              className="absolute inset-0 bg-black/55 flex items-center justify-center cursor-pointer"
              onClick={() => onPreview(0)}
              title="Open photo"
            >
              <span className="text-white text-2xl font-extrabold">
                +{remaining}
              </span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
function ImageDisplay({
  images,
  onPreview,
}: {
  images: string[];
  onPreview: (index: number) => void;
}) {
  if (images.length === 0) return null;
  if (images.length === 1)
    return <SingleImage src={images[0]} onPreview={onPreview} />;
  if (images.length === 2)
    return <TwoImages images={images} onPreview={onPreview} />;
  if (images.length === 3)
    return <ThreeImages images={images} onPreview={onPreview} />;
  if (images.length === 4)
    return <FourImages images={images} onPreview={onPreview} />;
  return <ManyImages images={images} onPreview={onPreview} />;
}

/** ---------- Share links ---------- */
function buildShareLinks(post: DbTimelinePost) {
  const url = window.location.href;
  const shareUrl = encodeURIComponent(url);
  const text = encodeURIComponent(post.text || "Check this out!");
  return {
    url,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
    whatsapp: `https://wa.me/?text=${text}%20${shareUrl}`,
  };
}

/** ---------- Floating Share Popover ---------- */
type SharePopoverState = {
  postId: string | null;
  open: boolean;
  top: number;
  left: number;
  placement: "top" | "bottom";
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function TimelineTab({
  groupId,
  onMediaRefresh,
  canInteract = true,
  refreshKey,
  publicFeed = false,
}: {
  groupId: string;
  onMediaRefresh?: () => void;
  canInteract?: boolean;
  refreshKey?: number;
  publicFeed?: boolean;
}) {
  const session = getSession();

  const me = useMemo(() => {
    return {
      userId: session?.userId ?? "unknown",
      name: session?.name ?? "Unknown",
    };
  }, [session]);

  const [posts, setPosts] = useState<DbTimelinePost[]>([]);
  const [extra, setExtra] = useState<ExtraDb>(() => loadExtra());
  const [remoteImages, setRemoteImages] = useState<Record<string, string[]>>({});
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const editFileRef = useRef<HTMLInputElement | null>(null);
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  // Composer
  const [text, setText] = useState("");
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  // Drafts
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // UI
  const [openReactionBar, setOpenReactionBar] = useState<
    Record<string, boolean>
  >({});
  const [openWhoReacted, setOpenWhoReacted] = useState<Record<string, boolean>>(
    {},
  );
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Share (portal popover)
  const shareBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [sharePopover, setSharePopover] = useState<SharePopoverState>({
    postId: null,
    open: false,
    top: 0,
    left: 0,
    placement: "top",
  });

  const SHARE_MENU_W = 220;
  const SHARE_MENU_H = 222; // header + 4 rows
  const OFFSET = 10;

  const canInteractWithPost = (postGroupId: string) =>
    canInteract && (!publicFeed || postGroupId === groupId);

  function positionSharePopover(postId: string) {
    const btn = shareBtnRefs.current[postId];
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;

    const placement: "top" | "bottom" =
      spaceBelow < SHARE_MENU_H + OFFSET && spaceAbove > SHARE_MENU_H + OFFSET
        ? "top"
        : "bottom";

    let top =
      placement === "top"
        ? rect.top - SHARE_MENU_H - OFFSET
        : rect.bottom + OFFSET;

    let left = rect.right - SHARE_MENU_W;

    left = clamp(left, 8, vw - SHARE_MENU_W - 8);
    top = clamp(top, 8, vh - SHARE_MENU_H - 8);

    setSharePopover({ postId, open: true, top, left, placement });
  }

  function closeShare() {
    setSharePopover((p) => ({ ...p, open: false, postId: null }));
  }

  function bumpShareCount(postId: string) {
    const db = loadExtra();
    db.shareCounts[postId] = (db.shareCounts[postId] ?? 0) + 1;
    saveExtra(db);
    setExtra(loadExtra());
  }

  // Close on outside click + Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeShare();
    }

    function onMouseDown(e: MouseEvent) {
      if (!sharePopover.open || !sharePopover.postId) return;
      const target = e.target as Node;

      const btn = shareBtnRefs.current[sharePopover.postId];
      const pop = document.getElementById("share-popover");

      const insideBtn = !!btn && btn.contains(target);
      const insidePop = !!pop && pop.contains(target);
      if (!insideBtn && !insidePop) closeShare();
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [sharePopover.open, sharePopover.postId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenuPostId(null);
    }

    function onMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-post-menu]")) return;
      if (target.closest("[data-post-menu-button]")) return;
      setOpenMenuPostId(null);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!sharePopover.open || !sharePopover.postId) return;
    const id = sharePopover.postId;
    const onMove = () => positionSharePopover(id);

    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [sharePopover.open, sharePopover.postId]);

  async function reload() {
    setLoading(true);
    setTimelineError(null);
    try {
      const list = (await getTimeline(publicFeed ? undefined : groupId, {
        limit: publicFeed ? 60 : 40,
      })) as unknown as DbTimelinePost[];
      const postIds = list.map((p) => p.id);
      setPosts(list);
      setExtra(loadExtra());
      // Load images in a second step to make the timeline appear faster.
      readTimelineImagesForPosts(postIds)
        .then((images) => {
          setRemoteImages(images);
        })
        .catch(() => {
          // keep existing images if fetch fails
        });
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ??
        "Could not load timeline.";
      setTimelineError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, refreshKey, publicFeed]);

  async function uploadOrPreview(file: File) {
    try {
      return await uploadImageToR2(file, groupId);
    } catch (err) {
      if (import.meta.env.DEV) {
        if (file.type.startsWith("image/")) {
          return await imageFileToDataUrl(file, 1100, 0.82);
        }
        return URL.createObjectURL(file);
      }
      throw err;
    }
  }

  async function onPickImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const urls = await Promise.all(
        Array.from(files).map((f) => uploadOrPreview(f)),
      );
      setImagePreviews((prev) => [...prev, ...urls]);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      alert("Could not upload one of the files. Try again.");
    }
  }

  function removePreview(idx: number) {
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function startEdit(post: DbTimelinePost) {
    setOpenMenuPostId(null);
    setEditingId(post.id);
    setEditText(post.text ?? "");
    const multi = remoteImages[post.id] ?? [];
    const base =
      multi.length > 0 ? multi : post.imageDataUrl ? [post.imageDataUrl] : [];
    setEditImages(base);
    if (editFileRef.current) editFileRef.current.value = "";
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
    setEditImages([]);
    if (editFileRef.current) editFileRef.current.value = "";
  }

  async function onPickEditImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const urls = await Promise.all(
        Array.from(files).map((f) => uploadOrPreview(f)),
      );
      setEditImages((prev) => [...prev, ...urls]);
      if (editFileRef.current) editFileRef.current.value = "";
    } catch {
      alert("Could not upload one of the files. Try again.");
    }
  }

  function removeEditPreview(idx: number) {
    setEditImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveEdit(post: DbTimelinePost) {
    if (!session) return;
    const t = editText.trim();
    const first = editImages[0] ?? null;

    setBusy(true);
    try {
      await updateTimelinePost(post.id, me.userId, {
        text: t,
        imageDataUrl: first,
      });

      await saveTimelineImages(post.id, editImages);
      setExtra(loadExtra());

      cancelEdit();
      await reload();
      onMediaRefresh?.();
    } finally {
      setBusy(false);
    }
  }

  async function createPost() {
    if (!canInteract) return;
    if (!session) return;
    const t = text.trim();
    if (!t && imagePreviews.length === 0) return;

    setBusy(true);
    try {
      const first = imagePreviews[0];
      const created = await addTimelinePost(groupId, {
        text: t,
        imageDataUrl: first || undefined,
        createdBy: { userId: me.userId, name: me.name },
      });

      await saveTimelineImages(created.id, imagePreviews);

      setText("");
      setImagePreviews([]);
      if (fileRef.current) fileRef.current.value = "";
      setComposerOpen(false);

      await reload();
      onMediaRefresh?.();
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(postId: string, postGroupId: string) {
    if (!canInteractWithPost(postGroupId)) return;
    if (!session) return;
    await toggleLikeApi(postId, me.userId);
    await reload();
  }

  async function addComment(postId: string, postGroupId: string) {
    if (!canInteractWithPost(postGroupId)) return;
    if (!session) return;
    const t = (commentDrafts[postId] ?? "").trim();
    if (!t) return;

    await addCommentApi(postId, {
      text: t,
      createdBy: { userId: me.userId, name: me.name },
    });

    setCommentDrafts((p) => ({ ...p, [postId]: "" }));
    await reload();
  }

  async function deletePost(post: DbTimelinePost) {
    if (!canInteractWithPost(post.groupId)) return;
    if (!session) return;
    if (post.createdBy.userId !== me.userId) return;

    const ok = confirm("Delete this post? This cannot be undone.");
    if (!ok) return;

    await deletePostApi(post.id, me.userId);

    const db = loadExtra();
    delete db.shareCounts[post.id];
    saveExtra(db);

    await reload();
    onMediaRefresh?.();
  }

  function toggleCommentReaction(
    postId: string,
    commentId: string,
    emoji: string,
    postGroupId: string,
  ) {
    if (!canInteractWithPost(postGroupId)) return;
    const db = loadExtra();
    const key = kOf(postId, commentId);

    db.commentReactions[key] = db.commentReactions[key] ?? {};
    const bucket = db.commentReactions[key][emoji] ?? [];
    const has = bucket.includes(me.userId);

    db.commentReactions[key][emoji] = has
      ? bucket.filter((x) => x !== me.userId)
      : [...bucket, me.userId];

    saveExtra(db);
    void reload();
  }

  function addReply(postId: string, commentId: string, postGroupId: string) {
    if (!canInteractWithPost(postGroupId)) return;
    if (!session) return;
    const key = kOf(postId, commentId);
    const t = (replyDrafts[key] ?? "").trim();
    if (!t) return;

    const db = loadExtra();
    db.replies[key] = db.replies[key] ?? [];
    db.replies[key].push({
      id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      text: t,
      createdAt: Date.now(),
      createdBy: { userId: me.userId, name: me.name },
    });

    saveExtra(db);
    setReplyDrafts((p) => ({ ...p, [key]: "" }));
    reload();
  }

  function reactionSummary(postId: string, commentId: string) {
    const key = kOf(postId, commentId);
    const map = extra.commentReactions?.[key] ?? {};
    return Object.entries(map)
      .map(([emoji, userIds]) => ({
        emoji,
        userIds: userIds ?? [],
        count: (userIds ?? []).length,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  // Resolve names without betaDb.getUsers()
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    if (session?.userId) map.set(session.userId, session.name);

    for (const p of posts) {
      map.set(p.createdBy.userId, p.createdBy.name);
      for (const c of p.comments ?? []) {
        map.set(c.createdBy.userId, c.createdBy.name);
        const key = kOf(p.id, c.id);
        const reps = extra.replies?.[key] ?? [];
        for (const r of reps) map.set(r.createdBy.userId, r.createdBy.name);
      }
    }
    return map;
  }, [posts, extra.replies, session]);

  function namesOf(userIds: string[]) {
    const names = userIds.map((id) => nameById.get(id) ?? "Unknown");
    return uniq(names).filter(Boolean);
  }

  return (
    <div className="space-y-[5px]">
      {loading && (
        <Card>
          <div className="text-sm text-gray-600">Loading timeline…</div>
        </Card>
      )}
      {timelineError && (
        <Card>
          <div className="text-sm text-red-700">{timelineError}</div>
        </Card>
      )}
      {/* Composer */}
      {canInteract ? (
        <>
          <Card className="p-3 sm:p-5">
            <div className="flex items-center gap-3">
              <UserAvatar userId={me.userId} name={me.name} size={36} />
              <button
                type="button"
                className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => setComposerOpen(true)}
              >
                Post your thoughts...
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setComposerOpen(true);
                  setTimeout(() => fileRef.current?.click(), 0);
                }}
              >
                🎥 Video
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setComposerOpen(true);
                  setTimeout(() => fileRef.current?.click(), 0);
                }}
              >
                🖼️ Photo
              </button>
            </div>
          </Card>

          {composerOpen &&
            createPortal(
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
                onClick={() => setComposerOpen(false)}
              >
                <div
                  className="w-full max-w-lg rounded-3xl bg-white p-4 sm:p-6 shadow-soft"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-extrabold text-gray-900">
                      Create a post
                    </div>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full border border-gray-200 bg-white text-sm"
                      onClick={() => setComposerOpen(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <UserAvatar userId={me.userId} name={me.name} size={40} />
                    <div className="text-sm font-semibold text-gray-900">
                      {me.name}
                    </div>
                  </div>

                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Post your thoughts..."
                    className="mt-4 w-full min-h-[120px] rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                  />

                  <div className="mt-3 flex items-center gap-3">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      id="timeline_images"
                      className="hidden"
                      onChange={(e) => onPickImages(e.target.files)}
                    />
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      onClick={() => fileRef.current?.click()}
                    >
                      🖼️ Photo / 🎥 Video
                    </button>
                  </div>

                  {imagePreviews.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                        Selected files • {imagePreviews.length}
                      </div>
                      <ImageDisplay
                        images={imagePreviews}
                        onPreview={(index) => {
                          setPreviewImages(imagePreviews);
                          setPreviewIndex(index);
                        }}
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {imagePreviews.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => removePreview(idx)}
                            className="px-3 py-1 rounded-lg border border-gray-300 bg-white text-xs font-medium hover:bg-gray-50"
                          >
                            Remove file {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setComposerOpen(false)}
                      className="px-4"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={createPost}
                      disabled={busy || (!text.trim() && imagePreviews.length === 0)}
                    >
                      {busy ? "Posting…" : "Post"}
                    </Button>
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </>
      ) : (
        <Card>
          <div className="text-sm text-gray-600">
            Public timeline is enabled. Only group members can post, comment, or
            like.
          </div>
        </Card>
      )}

      {/* Feed */}
      {posts.length === 0 ? (
        <Card>
          <div className="text-lg font-extrabold text-gray-900">
            No posts yet
          </div>
          <p className="mt-2 text-gray-600">Be the first to post a status 👇</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {posts.map((p) => {
            const liked = (p.likes ?? []).includes(me.userId);
            const postCanInteract = canInteractWithPost(p.groupId);

            const multi = remoteImages[p.id] ?? [];
            const images =
              multi.length > 0 ? multi : p.imageDataUrl ? [p.imageDataUrl] : [];

            const shareLinks = buildShareLinks(p);
            const shareCount = extra.shareCounts?.[p.id] ?? 0;

            return (
              <Card key={p.id} className="overflow-hidden p-4 sm:p-5">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex items-start gap-3">
                    <UserAvatar
                      userId={p.createdBy.userId}
                      name={p.createdBy.name}
                      size={36}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-base font-extrabold text-gray-900 truncate">
                          {p.createdBy.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {timeAgo(p.createdAt)}
                        </div>
                        {publicFeed && p.groupId !== groupId && (
                          <span className="text-[10px] uppercase tracking-wide rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                            Other group
                          </span>
                        )}
                      </div>

                    {editingId === p.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full min-h-[110px] rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                          placeholder="Update your post..."
                        />

                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            ref={editFileRef}
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            id={`edit_images_${p.id}`}
                            className="hidden"
                            onChange={(e) => onPickEditImages(e.target.files)}
                          />
                          <label
                            htmlFor={`edit_images_${p.id}`}
                            className="px-4 py-2 rounded-2xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 shadow-soft cursor-pointer"
                          >
                            + Add files
                          </label>
                          {editImages.length > 0 && (
                            <Button
                              variant="ghost"
                              onClick={() => setEditImages([])}
                            >
                              Clear images
                            </Button>
                          )}
                        </div>

                        {editImages.length > 0 && (
                          <div className="space-y-2">
                            <ImageDisplay
                              images={editImages}
                              onPreview={(index) => {
                                setPreviewImages(editImages);
                                setPreviewIndex(index);
                              }}
                            />
                            <div className="flex flex-wrap gap-2">
                              {editImages.map((_, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => removeEditPreview(idx)}
                                  className="px-3 py-1 rounded-lg border border-gray-300 bg-white text-xs font-medium hover:bg-gray-50"
                                >
                                  Remove photo {idx + 1}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      p.text && (
                        <div className="mt-2 text-gray-800 whitespace-pre-wrap">
                          {p.text}
                        </div>
                      )
                    )}
                    </div>
                  </div>

                {session && (
                  <div className="relative self-end sm:self-auto">
                    {editingId === p.id ? (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Button
                          variant="primary"
                          onClick={() => saveEdit(p)}
                          disabled={busy}
                          className="w-full sm:w-auto"
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={cancelEdit}
                          className="w-full sm:w-auto"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          data-post-menu-button
                          onClick={() =>
                            setOpenMenuPostId((prev) =>
                              prev === p.id ? null : p.id,
                            )
                          }
                          className="h-9 w-9 rounded-xl border border-gray-200 bg-white text-lg font-semibold hover:bg-gray-50"
                          aria-label="Post actions"
                          title="Post actions"
                        >
                          ⋯
                        </button>
                        {openMenuPostId === p.id && (
                          <div
                            data-post-menu
                            className="absolute right-0 mt-2 w-44 rounded-2xl border border-gray-200 bg-white shadow-soft overflow-hidden z-10"
                          >
                            <button
                              type="button"
                              disabled={p.createdBy.userId !== me.userId}
                              className={[
                                "w-full px-3 py-2 text-left text-sm font-semibold",
                                p.createdBy.userId === me.userId
                                  ? "text-gray-900 hover:bg-gray-50"
                                  : "text-gray-400 cursor-not-allowed",
                              ].join(" ")}
                              onClick={() => {
                                if (p.createdBy.userId !== me.userId) return;
                                startEdit(p);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={p.createdBy.userId !== me.userId}
                              className={[
                                "w-full px-3 py-2 text-left text-sm font-semibold",
                                p.createdBy.userId === me.userId
                                  ? "text-red-600 hover:bg-red-50"
                                  : "text-gray-400 cursor-not-allowed",
                              ].join(" ")}
                              onClick={() => {
                                if (p.createdBy.userId !== me.userId) return;
                                setOpenMenuPostId(null);
                                deletePost(p);
                              }}
                            >
                              Delete
                            </button>
                            {p.createdBy.userId !== me.userId && (
                              <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
                                Only the author can edit or delete.
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                </div>

                {/* Images */}
                {editingId !== p.id && images.length > 0 && (
                  <div className="mt-2">
                    <ImageDisplay
                      images={images}
                      onPreview={(index) => {
                        setPreviewImages(images);
                        setPreviewIndex(index);
                      }}
                    />
                  </div>
                )}

                {/* Comments */}
                <div className="mt-2 space-y-2">
                  {(p.comments ?? []).map((c) => {
                    const key = kOf(p.id, c.id);
                    const replies = extra.replies?.[key] ?? [];
                    const summary = reactionSummary(p.id, c.id);

                    const allReactors = namesOf(
                      summary.flatMap((x) => x.userIds),
                    );

                    return (
                      <div key={c.id} className="rounded-2xl bg-gray-50 p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar
                              userId={c.createdBy.userId}
                              name={c.createdBy.name}
                              size={26}
                            />
                            <div className="text-sm font-extrabold text-gray-900 truncate">
                              {c.createdBy.name}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {timeAgo(c.createdAt)}
                          </div>
                        </div>

                        <div className="mt-1 text-gray-700 whitespace-pre-wrap">
                          {c.text}
                        </div>

                        {/* Reaction chips */}
                        {summary.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {summary.map((x) => (
                              <button
                                key={x.emoji}
                                type="button"
                                onClick={() =>
                                  setOpenWhoReacted((prev) => ({
                                    ...prev,
                                    [key]: !prev[key],
                                  }))
                                }
                                className="px-2 py-1 rounded-full border border-gray-200 bg-white text-sm hover:bg-gray-50"
                                title="See who reacted"
                              >
                                {x.emoji}{" "}
                                <span className="font-semibold">{x.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Who reacted popover */}
                        {openWhoReacted[key] && summary.length > 0 && (
                          <div className="mt-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-soft">
                            <div className="text-sm font-extrabold text-gray-900">
                              Reacted by
                            </div>
                            <div className="mt-2 text-sm text-gray-700">
                              {allReactors.length
                                ? allReactors.join(", ")
                                : "No data"}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenWhoReacted((prev) => ({
                                  ...prev,
                                  [key]: false,
                                }))
                              }
                              className="mt-2 text-sm font-semibold text-blue-600 hover:underline"
                            >
                              Close
                            </button>
                          </div>
                        )}

                        {/* Comment actions */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                          <button
                            type="button"
                            disabled={!postCanInteract}
                            onClick={() =>
                              postCanInteract &&
                              setOpenReactionBar((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                            className={[
                              "text-blue-600 font-semibold hover:underline",
                              !postCanInteract
                                ? "opacity-60 cursor-not-allowed"
                                : "",
                            ].join(" ")}
                          >
                            React
                          </button>

                          <button
                            type="button"
                            disabled={!postCanInteract}
                            onClick={() =>
                              postCanInteract &&
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [key]: prev[key] ?? "",
                              }))
                            }
                            className={[
                              "text-blue-600 font-semibold hover:underline",
                              !postCanInteract
                                ? "opacity-60 cursor-not-allowed"
                                : "",
                            ].join(" ")}
                          >
                            Reply
                          </button>
                        </div>

                        {/* Emoji bar */}
                        {openReactionBar[key] && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  toggleCommentReaction(
                                    p.id,
                                    c.id,
                                    emoji,
                                    p.groupId,
                                  );
                                  setOpenReactionBar((prev) => ({
                                    ...prev,
                                    [key]: false,
                                  }));
                                }}
                                className="px-3 py-1 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-base"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Replies */}
                        {replies.length > 0 && (
                          <div className="mt-2.5 space-y-2">
                            {replies.map((r) => (
                              <div
                                key={r.id}
                                className="ml-6 rounded-2xl border border-gray-200 bg-white p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <UserAvatar
                                      userId={r.createdBy.userId}
                                      name={r.createdBy.name}
                                      size={24}
                                    />
                                    <div className="text-sm font-extrabold text-gray-900 truncate">
                                      {r.createdBy.name}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {timeAgo(r.createdAt)}
                                  </div>
                                </div>
                                <div className="mt-1 text-gray-700 whitespace-pre-wrap">
                                  {r.text}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply input */}
                        {replyDrafts[key] !== undefined && (
                          <div className="mt-2.5 sm:ml-6 flex flex-col sm:flex-row gap-2">
                            <input
                              value={replyDrafts[key]}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              placeholder={`Reply to ${c.createdBy.name}…`}
                              disabled={!postCanInteract}
                              className="w-full flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  addReply(p.id, c.id, p.groupId);
                                }
                              }}
                            />
                            <Button
                              variant="primary"
                              onClick={() => addReply(p.id, c.id, p.groupId)}
                              disabled={!replyDrafts[key].trim() || !postCanInteract}
                              className="w-full sm:w-auto"
                            >
                              Send
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add comment */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id={`cbox-${p.id}`}
                      value={commentDrafts[p.id] ?? ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      placeholder={
                        postCanInteract
                          ? "Write a comment…"
                          : "Read-only for other groups"
                      }
                      disabled={!postCanInteract}
                      className="w-full flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          addComment(p.id, p.groupId);
                        }
                      }}
                    />
                    <Button
                      variant="primary"
                      onClick={() => addComment(p.id, p.groupId)}
                      disabled={
                        !postCanInteract || !(commentDrafts[p.id] ?? "").trim()
                      }
                      className="w-full sm:w-auto"
                    >
                      Send
                    </Button>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <LikeLine liked={liked} count={(p.likes ?? []).length} />
                  <div className="text-sm text-gray-600">
                    {(p.comments ?? []).length} comment
                    {(p.comments ?? []).length === 1 ? "" : "s"}
                    {shareCount > 0 ? ` · ${shareCount} share` : ""}
                    {shareCount > 1 ? "s" : ""}
                  </div>
                </div>

                {/* Like/Comment/Share row */}
                <div className="mt-2 pt-2 border-t border-gray-200/50">
                  <div className="grid grid-cols-3 gap-2 text-sm font-semibold sm:flex sm:items-center sm:justify-between">
                    {/* Like */}
                    <button
                      type="button"
                      onClick={() => toggleLike(p.id, p.groupId)}
                      disabled={!postCanInteract}
                      className={[
                        "flex items-center justify-center gap-1 px-2 py-2 rounded-xl transition hover:bg-gray-50 w-full sm:w-auto",
                        liked
                          ? "text-blue-600"
                          : "text-gray-600 hover:text-blue-600",
                        !postCanInteract ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      <span className="text-lg">{liked ? "❤️" : "🤍"}</span>
                      <span>{liked ? "Liked" : "Like"}</span>
                    </button>

                    {/* Comment */}
                    <button
                      type="button"
                      disabled={!postCanInteract}
                      onClick={() => {
                        if (!postCanInteract) return;
                        const el = document.getElementById(`cbox-${p.id}`);
                        el?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                        (el as HTMLInputElement | null)?.focus?.();
                      }}
                      className={[
                        "flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-gray-50 transition w-full sm:w-auto",
                        !postCanInteract ? "opacity-60 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      <span className="text-lg">💬</span>
                      <span>Comment</span>
                    </button>

                    {/* Share */}
                    <button
                      ref={(el) => {
                        shareBtnRefs.current[p.id] = el;
                      }}
                      type="button"
                      onClick={() => {
                        setSharePopover((prev) => {
                          if (prev.open && prev.postId === p.id)
                            return { ...prev, open: false, postId: null };
                          return prev;
                        });
                        setTimeout(() => positionSharePopover(p.id), 0);
                      }}
                      className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-gray-50 transition w-full sm:w-auto"
                    >
                      <span className="text-lg">↗</span>
                      <span>Share</span>
                      {shareCount > 0 && (
                        <span className="ml-1 text-xs font-bold text-gray-500">
                          · {shareCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Share Popover Portal */}
                {sharePopover.open &&
                  sharePopover.postId === p.id &&
                  typeof document !== "undefined" &&
                  createPortal(
                    <div
                      id="share-popover"
                      style={{
                        position: "fixed",
                        top: sharePopover.top,
                        left: sharePopover.left,
                        width: SHARE_MENU_W,
                        zIndex: 9999,
                      }}
                      className="rounded-2xl border border-gray-200 bg-white shadow-soft overflow-hidden"
                    >
                      <div className="px-4 pt-3 pb-2 text-xs font-bold text-gray-500">
                        Share to social
                      </div>

                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          window.open(
                            shareLinks.facebook,
                            "_blank",
                            "noopener,noreferrer",
                          );
                          bumpShareCount(p.id);
                          closeShare();
                        }}
                      >
                        <span>📘</span> Facebook
                      </button>

                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          window.open(
                            shareLinks.whatsapp,
                            "_blank",
                            "noopener,noreferrer",
                          );
                          bumpShareCount(p.id);
                          closeShare();
                        }}
                      >
                        <span>🟢</span> WhatsApp
                      </button>

                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          navigator.clipboard?.writeText(shareLinks.url);
                          bumpShareCount(p.id);
                          alert("Link copied!");
                          closeShare();
                        }}
                      >
                        <span>🔗</span> Copy link
                      </button>

                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => {
                          // Instagram doesn't support a direct share URL from web.
                          // Best: copy link and user pastes into Instagram.
                          navigator.clipboard?.writeText(shareLinks.url);
                          bumpShareCount(p.id);
                          alert("Link copied for Instagram!");
                          closeShare();
                        }}
                      >
                        <span>📸</span> Instagram (copy link)
                      </button>
                    </div>,
                    document.body,
                  )}
              </Card>
            );
          })}
        </div>
      )}

      {previewImages &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewImages(null)}
          >
            <div className="relative max-w-[95vw] max-h-[90vh]">
              {isVideoUrl(previewImages[previewIndex]) ? (
                <video
                  src={previewImages[previewIndex]}
                  className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain"
                  controls
                  autoPlay
                  playsInline
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <img
                  src={previewImages[previewIndex]}
                  alt="preview"
                  className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              {previewImages.length > 1 && (
                <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewIndex((i) =>
                        i === 0 ? previewImages.length - 1 : i - 1,
                      );
                    }}
                    className="h-10 w-10 rounded-full bg-white/90 text-gray-900 shadow-soft"
                    title="Previous"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewIndex((i) =>
                        i === previewImages.length - 1 ? 0 : i + 1,
                      );
                    }}
                    className="h-10 w-10 rounded-full bg-white/90 text-gray-900 shadow-soft"
                    title="Next"
                  >
                    ›
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setPreviewImages(null)}
                className="absolute -top-3 -right-3 h-9 w-9 rounded-full bg-white text-gray-900 shadow-soft"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
