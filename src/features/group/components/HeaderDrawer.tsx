import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import {
  addGroupMember,
  createGroup,
  getGroupMembers,
  getGroupMeta,
  removeGroupMember,
  updateGroupCode,
  updateGroupMeta,
} from "../../../lib/appDb";
import type { GroupMeta } from "../../../lib/groupMetaDb";
import {
  readProfile,
  readProfileAvatar,
  readProfileCover,
  saveProfile,
  saveProfileAvatar,
  saveProfileCover,
  fetchProfileRemote,
  getSignedStorageUrl,
  saveProfileRemote,
  uploadProfileAvatar,
  uploadProfileCover,
  type Profile,
} from "../../../lib/profileDb";
import { clearSession } from "../../../lib/session";
import { signOut } from "../../../lib/auth";
import {
  clearGroupHeaderImage,
  readGroupHeaderImage,
  saveGroupHeaderImage,
} from "../../../lib/groupHeaderImage";
import defaultHeaderImage from "../../../assets/header1.jpg";
import { UserAvatar } from "../../../components/UserAvatar";

type Tab = "group" | "profile" | "settings";
type GroupTypeChoice =
  | "tour"
  | "birthday"
  | "baby_shower"
  | "event"
  | "other"
  | "custom";

const GROUP_TYPE_OPTIONS: Array<{ value: GroupTypeChoice; label: string }> = [
  { value: "tour", label: "Tour / Trip" },
  { value: "birthday", label: "Birthday Party" },
  { value: "baby_shower", label: "Baby Shower" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
  { value: "custom", label: "Custom" },
];

export function HeaderDrawer({
  open,
  onClose,
  groupId,
  groupName,
  groupCode,
  myRole,
  me,
  onMetaChange,
  onHeaderImageChange,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  groupCode: string;
  myRole: "host" | "admin" | "member" | "viewer";
  me: { userId: string; name: string } | null;
  onMetaChange?: () => void;
  onHeaderImageChange?: (next: string | null) => void;
}) {
  const meUserId = me?.userId ?? null;
  const canManageGroup = myRole === "host" || myRole === "admin";
  const [tab, setTab] = useState<Tab>("group");

  const [meta, setMeta] = useState<GroupMeta>({});
  const [avatar, setAvatar] = useState<string | null>(() =>
    meUserId ? readProfileAvatar(meUserId) ?? null : null,
  );
  const [cover, setCover] = useState<string | null>(() =>
    meUserId ? readProfileCover(meUserId) ?? null : null,
  );
  const [profile, setProfile] = useState<Profile>(() =>
    meUserId ? readProfile(meUserId) : { updatedAt: 0 },
  );
  const [headerImage, setHeaderImage] = useState<string | null>(() =>
    readGroupHeaderImage(groupId),
  );

  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<GroupMeta["groupType"]>("tour");
  const [createDesc, setCreateDesc] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [groupTypeChoice, setGroupTypeChoice] =
    useState<GroupTypeChoice>("tour");
  const [customGroupType, setCustomGroupType] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [linkCopyState, setLinkCopyState] = useState<
    "idle" | "ok" | "fail"
  >("idle");
  const [codeDraft, setCodeDraft] = useState(groupCode);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [members, setMembers] = useState<
    Array<{ userId: string; role: "host" | "admin" | "member"; name: string }>
  >([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersVersion, setMembersVersion] = useState(0);
  const [addMemberId, setAddMemberId] = useState("");
  const [addMemberRole, setAddMemberRole] = useState<
    "member" | "admin" | "host"
  >("member");
  const [addMemberError, setAddMemberError] = useState<string | null>(null);
  const [memberBusy, setMemberBusy] = useState(false);
  const [privacyAck, setPrivacyAck] = useState(false);
  const [termsAck, setTermsAck] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const coverRef = useRef<HTMLInputElement | null>(null);
  const headerImageRef = useRef<HTMLInputElement | null>(null);

  function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  }

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setTab("group");
    setAvatar(meUserId ? readProfileAvatar(meUserId) ?? null : null);
    setCover(meUserId ? readProfileCover(meUserId) ?? null : null);
    setProfile(meUserId ? readProfile(meUserId) : { updatedAt: 0 });
    setHeaderImage(readGroupHeaderImage(groupId));

    (async () => {
      const next = await getGroupMeta(groupId);
      if (!mounted) return;
      setMeta({
        groupType: next.groupType as GroupMeta["groupType"],
        description: next.description,
        eventDate: next.eventDate,
        timelinePublic: next.timelinePublic,
      });
    })();

    if (meUserId) {
      fetchProfileRemote(meUserId)
        .then((next) => {
          if (!mounted) return;
          setProfile(next);
          setAvatar(next.avatarDataUrl ?? null);
          setCover(next.coverDataUrl ?? null);
        })
        .catch(() => {
          // ignore remote fetch errors
        });
    }

    return () => {
      mounted = false;
    };
  }, [open, groupId, meUserId]);

  useEffect(() => {
    if (!open) return;
    const raw = meta.groupType?.trim() ?? "";
    const known = GROUP_TYPE_OPTIONS.some((opt) => opt.value === raw);
    setGroupTypeChoice(known ? (raw as GroupTypeChoice) : "custom");
    setCustomGroupType(known ? "" : raw);
    setCodeDraft(groupCode);
    setCodeError(null);
  }, [open, meta.groupType, groupCode]);

  useEffect(() => {
    if (!open) return;
    if (tab !== "group") return;
    if (!canManageGroup) return;

    let mounted = true;
    const load = async () => {
      setMembersLoading(true);
      setMembersError(null);
      try {
        const list = await getGroupMembers(groupId);
        if (!mounted) return;
        setMembers(list);
      } catch (err) {
        const msg =
          (err as { message?: string })?.message ??
          "Could not load members.";
        if (mounted) setMembersError(msg);
      } finally {
        if (mounted) setMembersLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [open, tab, myRole, groupId, membersVersion]);

  const title = useMemo(() => {
    if (tab === "group") return "Group info";
    if (tab === "profile") return "Profile";
    return "Settings";
  }, [tab]);

  // ESC close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function copyInviteCode() {
    if (!groupCode) return;
    try {
      await navigator.clipboard.writeText(groupCode);
      setCopyState("ok");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = groupCode;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopyState("ok");
      } catch {
        setCopyState("fail");
      }
    } finally {
      setTimeout(() => setCopyState("idle"), 1500);
    }
  }

  async function copyShareLink() {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}/?code=${encodeURIComponent(
      groupCode,
    )}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopyState("ok");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = link;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setLinkCopyState("ok");
      } catch {
        setLinkCopyState("fail");
      }
    } finally {
      setTimeout(() => setLinkCopyState("idle"), 1500);
    }
  }

  async function onUpdateCode() {
    const next = codeDraft.trim();
    if (!next) {
      setCodeError("Invite code required.");
      return;
    }
    setCodeError(null);
    setCodeBusy(true);
    try {
      const updated = await updateGroupCode(groupId, next);
      setCodeDraft(updated);
      onMetaChange?.();
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? "Could not update code.";
      setCodeError(msg);
    } finally {
      setCodeBusy(false);
    }
  }

  async function onAddMember() {
    if (!addMemberId.trim()) {
      setAddMemberError("User ID is required.");
      return;
    }
    setAddMemberError(null);
    setMemberBusy(true);
    try {
      await addGroupMember(groupId, addMemberId.trim(), addMemberRole);
      setAddMemberId("");
      setMembersVersion((v) => v + 1);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? "Could not add member.";
      setAddMemberError(msg);
    } finally {
      setMemberBusy(false);
    }
  }

  async function onRemoveMember(userId: string) {
    setMemberBusy(true);
    try {
      await removeGroupMember(groupId, userId);
      setMembersVersion((v) => v + 1);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? "Could not remove member.";
      setMembersError(msg);
    } finally {
      setMemberBusy(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* overlay */}
      <button
        type="button"
        className="fixed inset-0 z-[9997] bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close menu"
      />

      {/* drawer */}
      <div className="fixed top-0 right-0 z-[9998] h-full w-[520px] max-w-[94vw] p-3">
        <div className="h-full translate-x-0 animate-[slideIn_.18s_ease-out]">
          <Card className="h-full overflow-hidden flex flex-col">
            <style>{`
              @keyframes slideIn { 
                from { transform: translateX(10px); opacity: .6; } 
                to { transform: translateX(0); opacity: 1; } 
              }
            `}</style>

            <div className="px-5 py-4 border-b border-gray-200 bg-white flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-500 truncate">
                  {groupName}
                </div>
                <div className="text-lg font-extrabold text-gray-900 truncate tracking-tight">
                  {title}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-5 py-3 border-b border-gray-200 bg-white flex gap-2 flex-wrap">
              {(["group", "profile", "settings"] as Tab[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={[
                    "px-3 py-2 rounded-full border text-sm font-extrabold transition",
                    tab === k
                      ? "bg-yellow-200 border-yellow-300 text-gray-900"
                      : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {k === "group"
                    ? "🎉 Group"
                    : k === "profile"
                      ? "👤 Profile"
                      : "⚙️ Settings"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-gray-50">
              {tab === "group" && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-sm font-extrabold text-gray-900">
                      Invite code
                    </div>
                    <>
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          readOnly
                          value={groupCode}
                          className="w-full flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono"
                        />
                        <Button
                          variant="ghost"
                          onClick={copyInviteCode}
                          title="Copy code"
                          className="w-full sm:w-auto"
                        >
                          {copyState === "ok"
                            ? "Copied"
                            : copyState === "fail"
                              ? "Copy failed"
                              : "Copy"}
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          readOnly
                          value={
                            typeof window === "undefined"
                              ? ""
                              : `${window.location.origin}/?code=${encodeURIComponent(
                                  groupCode,
                                )}`
                          }
                          className="w-full flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
                        />
                        <Button
                          variant="ghost"
                          onClick={copyShareLink}
                          title="Copy share link"
                          className="w-full sm:w-auto"
                        >
                          {linkCopyState === "ok"
                            ? "Link copied"
                            : linkCopyState === "fail"
                              ? "Copy failed"
                              : "Copy link"}
                        </Button>
                      </div>
                      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
                        <div className="text-xs font-semibold text-gray-700">
                          Change join code
                        </div>
                        <input
                          value={codeDraft}
                          onChange={(e) => setCodeDraft(e.target.value)}
                          placeholder="New code (e.g., MYTRIP1)"
                          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                        />
                        <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                          <Button
                            variant="primary"
                            onClick={onUpdateCode}
                            disabled={codeBusy}
                            className="w-full sm:w-auto"
                          >
                            Update code
                          </Button>
                          <div className="text-[11px] text-gray-500">
                            Use 4+ letters/numbers.
                          </div>
                        </div>
                        {codeError && (
                          <div className="mt-2 text-xs text-red-600">
                            {codeError}
                          </div>
                        )}
                      </div>
                    </>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-sm font-extrabold text-gray-900">
                      Group type
                    </div>
                    <select
                      value={groupTypeChoice}
                      onChange={(e) => {
                        const nextChoice = e.target
                          .value as GroupTypeChoice;
                        setGroupTypeChoice(nextChoice);
                        if (nextChoice !== "custom") {
                          const next = {
                            ...meta,
                            groupType: nextChoice,
                          };
                          setMeta(next);
                          updateGroupMeta(groupId, {
                            groupType: next.groupType,
                            description: next.description,
                            eventDate: next.eventDate,
                          }).then(() => onMetaChange?.());
                        }
                      }}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                    >
                      {GROUP_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {groupTypeChoice === "custom" && (
                      <input
                        value={customGroupType}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCustomGroupType(value);
                          const next = {
                            ...meta,
                            groupType: value.trim() ? value.trim() : undefined,
                          };
                          setMeta(next);
                          updateGroupMeta(groupId, {
                            groupType: next.groupType,
                            description: next.description,
                            eventDate: next.eventDate,
                          }).then(() => onMetaChange?.());
                        }}
                        placeholder="e.g., Wedding, Retreat, Workshop"
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                      />
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-sm font-extrabold text-gray-900">
                      Timeline visibility
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Timeline is public across all groups. Anyone logged in can
                      view posts; only members can post, comment, or like.
                    </div>
                    <div className="mt-3 inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                      Public
                    </div>
                  </div>

                  {canManageGroup && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                      <div className="text-sm font-extrabold text-gray-900">
                        Members
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Admin/host can add or remove members by User ID.
                      </div>

                      {membersLoading && (
                        <div className="mt-2 text-xs text-gray-600">
                          Loading members…
                        </div>
                      )}

                      {membersError && (
                        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700">
                          {membersError}
                        </div>
                      )}

                      <div className="mt-3 space-y-2">
                        {members.map((m) => {
                          const isSelf = m.userId === meUserId;
                          const canRemove =
                            myRole === "host"
                              ? !isSelf
                              : myRole === "admin"
                                ? m.role === "member"
                                : false;
                          return (
                            <div
                              key={m.userId}
                              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
                            >
                              <div className="min-w-0 flex items-center gap-2">
                                <UserAvatar
                                  userId={m.userId}
                                  name={m.name}
                                  size={22}
                                />
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 truncate">
                                    {m.name}
                                  </div>
                                  <div className="text-[11px] text-gray-500 truncate">
                                    {m.userId} · {m.role}
                                    {isSelf ? " (you)" : ""}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                onClick={() => onRemoveMember(m.userId)}
                                disabled={!canRemove || memberBusy}
                                className="w-full sm:w-auto"
                              >
                                Remove
                              </Button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
                        <div className="text-xs font-semibold text-gray-700">
                          Add member by User ID
                        </div>
                        <input
                          value={addMemberId}
                          onChange={(e) => setAddMemberId(e.target.value)}
                          placeholder="User ID (UUID)"
                          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                        />
                        <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                          <select
                            value={addMemberRole}
                            onChange={(e) =>
                              setAddMemberRole(
                                e.target.value as "member" | "admin" | "host",
                              )
                            }
                            disabled={myRole !== "host"}
                            className="h-9 w-full sm:w-auto rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            {myRole === "host" && (
                              <option value="host">Host</option>
                            )}
                          </select>
                          <Button
                            variant="primary"
                            onClick={onAddMember}
                            disabled={memberBusy}
                            className="w-full sm:w-auto"
                          >
                            Add member
                          </Button>
                        </div>
                        {addMemberError && (
                          <div className="mt-2 text-xs text-red-600">
                            {addMemberError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-sm font-extrabold text-gray-900">
                      Description
                    </div>
                    <textarea
                      defaultValue={meta.description ?? ""}
                      placeholder="Write short group info..."
                      className="mt-2 w-full min-h-[90px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                      onBlur={(e) => {
                        const next = {
                          ...meta,
                          description: e.target.value.trim(),
                        };
                        setMeta(next);
                        updateGroupMeta(groupId, {
                          groupType: next.groupType,
                          description: next.description,
                          eventDate: next.eventDate,
                        }).then(() => onMetaChange?.());
                      }}
                    />
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="text-sm font-extrabold text-gray-900">
                      Event date (optional)
                    </div>
                    <input
                      type="date"
                      defaultValue={meta.eventDate ?? ""}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                      onBlur={(e) => {
                        const next = {
                          ...meta,
                          eventDate: e.target.value || undefined,
                        };
                        setMeta(next);
                        updateGroupMeta(groupId, {
                          groupType: next.groupType,
                          description: next.description,
                          eventDate: next.eventDate,
                        }).then(() => onMetaChange?.());
                      }}
                    />
                  </div>
                </div>
              )}

              {tab === "profile" && (
                <div className="space-y-4">
                  <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden">
                    <div className="relative h-32 bg-gradient-to-r from-slate-200 via-blue-100 to-orange-100">
                      {cover && (
                        <img
                          src={cover}
                          alt="cover"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                      <div className="absolute right-3 top-3">
                        <input
                          ref={coverRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            if (!me) return;
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const path = await uploadProfileCover(
                                me.userId,
                                f,
                              );
                              await saveProfileRemote(me.userId, {
                                coverDataUrl: path,
                              });
                              const signed = await getSignedStorageUrl(path);
                              saveProfileCover(me.userId, signed);
                              setCover(signed);
                            } catch (err) {
                              const msg =
                                (err as { message?: string })?.message ??
                                "Could not upload image. Try a smaller file.";
                              alert(msg);
                            } finally {
                              if (coverRef.current)
                                coverRef.current.value = "";
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          onClick={() => coverRef.current?.click()}
                          disabled={!me}
                        >
                          Edit cover
                        </Button>
                      </div>
                    </div>

                    <div className="px-4 pb-5">
                      <div className="-mt-10 flex items-end gap-3">
                        <div className="w-20 h-20 rounded-3xl border-4 border-white bg-gray-50 overflow-hidden flex items-center justify-center shadow-md">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt="avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">👤</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-lg font-extrabold text-gray-900 truncate tracking-tight">
                            {profile.displayName || me?.name || "Profile"}
                          </div>
                          <div className="text-xs text-gray-600">
                            {profile.location || "Add your city"}
                          </div>
                        </div>
                        <div className="ml-auto">
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                          onChange={async (e) => {
                            if (!me) return;
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              const path = await uploadProfileAvatar(
                                me.userId,
                                f,
                              );
                              await saveProfileRemote(me.userId, {
                                avatarDataUrl: path,
                                displayName: profile.displayName ?? me.name,
                              });
                              const signed = await getSignedStorageUrl(path);
                              saveProfileAvatar(me.userId, signed, me.name);
                              setAvatar(signed);
                              setProfile((p) => ({
                                ...p,
                                displayName: p.displayName ?? me.name,
                              }));
                            } catch (err) {
                              const msg =
                                (err as { message?: string })?.message ??
                                "Could not upload image. Try a smaller file.";
                              alert(msg);
                            } finally {
                              if (fileRef.current)
                                  fileRef.current.value = "";
                              }
                            }}
                          />
                          <Button
                            variant="primary"
                            onClick={() => fileRef.current?.click()}
                            disabled={!me}
                          >
                            Change photo
                          </Button>
                        </div>
                      </div>

                      {!me && (
                        <div className="mt-2 text-xs text-red-600 font-semibold">
                          Login/session required.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1fr,1.3fr]">
                    <Card>
                      <div className="text-sm font-extrabold text-gray-900">
                        Intro
                      </div>
                      <div className="mt-3 space-y-3">
                        <div>
                          <div className="text-xs font-extrabold text-gray-700">
                            Display name
                          </div>
                          <input
                            defaultValue={profile.displayName ?? me?.name ?? ""}
                            className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                            onBlur={(e) => {
                              if (!me) return;
                              const next = e.target.value.trim();
                              setProfile((p) => ({
                                ...p,
                                displayName: next,
                              }));
                              saveProfile(me.userId, { displayName: next });
                              void saveProfileRemote(me.userId, {
                                displayName: next,
                              });
                            }}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-gray-700">
                            Bio
                          </div>
                          <textarea
                            defaultValue={profile.bio ?? ""}
                            placeholder="Share a short intro..."
                            className="mt-1 w-full min-h-[70px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                            onBlur={(e) => {
                              if (!me) return;
                              const next = e.target.value.trim();
                              setProfile((p) => ({ ...p, bio: next }));
                              saveProfile(me.userId, { bio: next });
                              void saveProfileRemote(me.userId, { bio: next });
                            }}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-gray-700">
                            Location
                          </div>
                          <input
                            defaultValue={profile.location ?? ""}
                            placeholder="City, Country"
                            className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                            onBlur={(e) => {
                              if (!me) return;
                              const next = e.target.value.trim();
                              setProfile((p) => ({ ...p, location: next }));
                              saveProfile(me.userId, { location: next });
                              void saveProfileRemote(me.userId, {
                                location: next,
                              });
                            }}
                          />
                        </div>
                      </div>
                    </Card>

                    <Card>
                      <div className="text-sm font-extrabold text-gray-900">
                        Timeline
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        Your recent activity will show here. Start by creating a
                        group or posting to the timeline.
                      </div>
                      <div className="mt-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                        No posts yet.
                      </div>
                    </Card>

                    <Card>
                      <div className="text-sm font-extrabold text-gray-900">
                        Account
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        {meUserId
                          ? "Logout to end this session."
                          : "Login from the Start page."}
                      </div>
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        {meUserId ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              void signOut();
                              clearSession();
                              window.location.href = "/";
                            }}
                            className="w-full sm:w-auto"
                          >
                            Logout
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => {
                              window.location.href = "/";
                            }}
                            className="w-full sm:w-auto"
                          >
                            Login
                          </Button>
                        )}
                      </div>
                    </Card>
                  </div>

                  <Card>
                    <div className="text-sm font-extrabold text-gray-900">
                      Create a group
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <div className="text-xs font-extrabold text-gray-700">
                          Group name
                        </div>
                        <input
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          placeholder="e.g. Baby Shower Weekend"
                          className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-gray-700">
                          Type
                        </div>
                        <select
                          value={createType ?? "tour"}
                          onChange={(e) =>
                            setCreateType(
                              e.target.value as GroupMeta["groupType"],
                            )
                          }
                          className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                        >
                          <option value="tour">Tour / Trip</option>
                          <option value="birthday">Birthday Party</option>
                          <option value="baby_shower">Baby Shower</option>
                          <option value="event">Event</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs font-extrabold text-gray-700">
                          Event date
                        </div>
                        <input
                          type="date"
                          value={createDate}
                          onChange={(e) => setCreateDate(e.target.value)}
                          className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs font-extrabold text-gray-700">
                          Description
                        </div>
                        <textarea
                          value={createDesc}
                          onChange={(e) => setCreateDesc(e.target.value)}
                          placeholder="Short description for your group..."
                          className="mt-1 w-full min-h-[70px] rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        disabled={!me || !createName.trim()}
                        onClick={async () => {
                          if (!me) return;
                          const name = createName.trim();
                          if (!name) return;
                          const newGroup = await createGroup(name, me.userId, {
                            groupType: createType ?? undefined,
                            description: createDesc.trim() || undefined,
                            eventDate: createDate || undefined,
                          });
                          setCreateName("");
                          setCreateDesc("");
                          setCreateDate("");
                          window.dispatchEvent(
                            new CustomEvent("journey:set-active-group", {
                              detail: { id: newGroup.id },
                            }),
                          );
                          onClose();
                        }}
                      >
                        Create & open
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={!me}
                        onClick={() => {
                          setCreateName("");
                          setCreateDesc("");
                          setCreateDate("");
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    {!me && (
                      <div className="mt-2 text-xs text-red-600 font-semibold">
                        Login/session required.
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {tab === "settings" && (
                <div className="space-y-3">
                  <Card>
                    <div className="text-sm font-extrabold text-gray-900">
                      Header background
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      Upload a header background image for this group.
                    </div>

                    <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200">
                      <img
                        src={headerImage ?? defaultHeaderImage}
                        alt="Header background"
                        className="w-full h-40 object-cover"
                      />
                    </div>
                    {!headerImage && (
                      <div className="mt-2 text-xs font-semibold text-gray-500">
                        Using default header image.
                      </div>
                    )}

                    <input
                      ref={headerImageRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await fileToDataUrl(file);
                          saveGroupHeaderImage(groupId, dataUrl);
                          setHeaderImage(dataUrl);
                          onHeaderImageChange?.(dataUrl);
                        } catch {
                          // ignore
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        onClick={() => headerImageRef.current?.click()}
                      >
                        Upload
                      </Button>
                      {headerImage && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            clearGroupHeaderImage(groupId);
                            setHeaderImage(null);
                            onHeaderImageChange?.(null);
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <div className="text-sm font-extrabold text-gray-900">
                      Privacy Policy (Testing Build)
                    </div>
                    <div className="mt-2 space-y-2 text-xs text-gray-600">
                      <p>
                        This page is designed for testing only and is group
                        member based. Access is via creating a group or joining
                        with an invite code.
                      </p>
                      <p>
                        We do not intentionally collect personal data beyond
                        basic login needs. Cookies/local storage may be used for
                        session and preferences.
                      </p>
                      <Link
                        to="/privacy"
                        className="inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Read more
                      </Link>
                    </div>
                    <label className="mt-3 flex items-start gap-2 text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={privacyAck}
                        onChange={(e) => setPrivacyAck(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        I understand the privacy policy and cookie usage
                        acknowledgement.
                      </span>
                    </label>
                  </Card>

                  <Card>
                    <div className="text-sm font-extrabold text-gray-900">
                      Terms & Conditions
                    </div>
                    <div className="mt-2 space-y-2 text-xs text-gray-600">
                      <p>
                        This app is for fun trip planning and group
                        coordination. Terms can change anytime.
                      </p>
                      <p>
                        Use at your own risk. No hacking activity or abuse is
                        allowed.
                      </p>
                      <p>
                        No commercial use. No copying/selling/reselling this
                        app or its content.
                      </p>
                      <Link
                        to="/terms"
                        className="inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Read more
                      </Link>
                    </div>
                    <label className="mt-3 flex items-start gap-2 text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={termsAck}
                        onChange={(e) => setTermsAck(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>
                        I agree to the terms and conditions acknowledgement.
                      </span>
                    </label>
                  </Card>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-white text-center text-[11px] text-gray-600">
              Design by Nexus Tech Group Sydney · Phone no +61430060860 ·
              Copyright © 2026
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
