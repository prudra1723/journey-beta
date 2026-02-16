// src/pages/Dashboard.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

import {
  clearSession,
  getSession,
  setSessionFromProfile,
} from "../lib/session";
import {
  createGroup as createGroupApi,
  getUserGroups,
  joinGroup as joinGroupApi,
} from "../lib/betaDb";

import { ensureProfile, signOut } from "../lib/auth";
import {
  fetchProfileRemote,
  getSignedStorageUrl,
  readProfile,
  readProfileAvatar,
  saveProfile,
  saveProfileRemote,
  uploadProfileAvatar,
} from "../lib/profileDb";

type DashboardProps = {
  onLogout: () => void;
  onOpenGroup: (groupId: string) => void;
};

export function Dashboard({ onLogout, onOpenGroup }: DashboardProps) {
  // freeze session
  const [session] = useState(() => getSession());

  const [sessionName, setSessionName] = useState(session?.name ?? "");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [privacyAck, setPrivacyAck] = useState(false);
  const [termsAck, setTermsAck] = useState(false);
  const [cookiesAck, setCookiesAck] = useState(false);

  const [groups, setGroups] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const profileRef = useRef<HTMLInputElement | null>(null);

  const [profileName, setProfileName] = useState(() => {
    if (!session) return "";
    const p = readProfile(session.userId);
    return p.displayName ?? session.name ?? "";
  });

  const [profileAvatar, setProfileAvatar] = useState<string | null>(() => {
    if (!session) return null;
    return readProfileAvatar(session.userId) ?? null;
  });

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<Record<string, "idle" | "ok" | "fail">>({});

  const loadGroups = useCallback(async () => {
    if (!session) return;
    setLoadingGroups(true);
    setGroupError(null);

    try {
      const list = await getUserGroups(session.userId);
      setGroups(list);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? "Could not load groups.";
      setGroupError(msg);
    } finally {
      setLoadingGroups(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      // ✅ app is screen-based, so logout takes user to Start
      onLogout();
      return;
    }
    void loadGroups();
  }, [loadGroups, onLogout, session]);

  useEffect(() => {
    if (!session) return;

    fetchProfileRemote(session.userId)
      .then((p) => {
        if (p.displayName) {
          setProfileName(p.displayName);
          setSessionName(p.displayName);
        }
        if (p.avatarDataUrl) setProfileAvatar(p.avatarDataUrl);
      })
      .catch(() => {});
  }, [session?.userId]);

  if (!session) return null;
  const sessionUserId = session.userId;

  async function copyInviteCode(code: string, id: string) {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopyState((prev) => ({ ...prev, [id]: "ok" }));
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopyState((prev) => ({ ...prev, [id]: "ok" }));
      } catch {
        setCopyState((prev) => ({ ...prev, [id]: "fail" }));
      }
    } finally {
      setTimeout(
        () => setCopyState((prev) => ({ ...prev, [id]: "idle" })),
        1500,
      );
    }
  }

  async function saveProfileInfo() {
    const nextName = profileName.trim();
    if (nextName.length < 2) {
      setProfileError("Name must be at least 2 characters.");
      return false;
    }

    setProfileError(null);
    setProfileSaving(true);

    try {
      const updated = await ensureProfile(sessionUserId, nextName);
      await saveProfileRemote(sessionUserId, {
        displayName: updated.display_name ?? nextName,
      });

      setSessionFromProfile(sessionUserId, updated.display_name ?? nextName);
      setSessionName(updated.display_name ?? nextName);
      return true;
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? "Could not save profile.";
      setProfileError(msg);
      return false;
    } finally {
      setProfileSaving(false);
    }
  }

  function openGroup(id: string) {
    const name = profileName.trim();
    if (name.length < 2) {
      setProfileError("Name is required before entering the group.");
      return;
    }

    // Save profile in background, but don't block navigation
    void saveProfileInfo();
    onOpenGroup(id);
  }

  async function createGroup() {
    if (!privacyAck || !termsAck || !cookiesAck) return;
    if (!groupName.trim()) return;

    try {
      const created = await createGroupApi(groupName.trim(), sessionUserId);
      await loadGroups();
      setGroupName("");
      openGroup(created.id);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? "Could not create group.";
      setGroupError(msg);
    }
  }

  async function joinGroup() {
    if (!privacyAck || !termsAck || !cookiesAck) return;
    if (!joinCode.trim()) return;

    setJoinError(null);
    try {
      const displayName = (profileName || sessionName || session?.name || "")
        .trim();
      const g = await joinGroupApi(
        joinCode.trim(),
        sessionUserId,
        displayName,
      );
      if (!g) {
        setJoinError("Invalid invite code.");
        return;
      }
      await loadGroups();
      setJoinCode("");
      openGroup(g.id);
    } catch (err) {
      const msg =
        (err as { message?: string })?.message ?? "Could not join group.";
      setJoinError(msg);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50">
      <header className="sticky top-3 z-20 mx-auto w-[95%] max-w-6xl rounded-3xl border border-gray-200 bg-white shadow-soft">
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xl font-extrabold text-gray-900 tracking-tight">
              Dashboard
            </div>
            <div className="text-sm text-gray-600">
              Logged in as{" "}
              <span className="font-semibold">
                {sessionName || session.name}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              void signOut();
              clearSession();
              onLogout(); // ✅ go back to Start via App.tsx
            }}
            className="w-full sm:w-auto"
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto w-[95%] max-w-6xl py-5">
        <Card>
          <div className="grid gap-5 md:grid-cols-2">
            {/* My Groups */}
            <div className="rounded-3xl border border-gray-200 p-4 shadow-soft bg-white">
              <div className="font-bold text-gray-900">My Groups</div>

              {loadingGroups && (
                <p className="mt-2 text-gray-600">Loading groups…</p>
              )}

              {groupError && (
                <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {groupError}
                </div>
              )}

              {!loadingGroups && groups.length === 0 && (
                <p className="mt-2 text-gray-600">No groups yet</p>
              )}

              {groups.map((g) => (
                <div
                  key={g.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openGroup(g.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openGroup(g.id);
                  }}
                  className="mt-3 w-full text-left rounded-2xl border border-gray-200 p-4 hover:bg-gray-50 transition shadow-soft cursor-pointer"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">
                        {g.name}
                      </div>
                      <div className="text-xs text-gray-600">
                        Code: <span className="font-mono">{g.code}</span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      title="Copy invite code"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyInviteCode(g.code, g.id);
                      }}
                      className="w-full sm:w-auto"
                    >
                      {copyState[g.id] === "ok"
                        ? "Copied"
                        : copyState[g.id] === "fail"
                          ? "Copy failed"
                          : "Copy"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Create / Join */}
            <div className="rounded-3xl border border-gray-200 p-4 shadow-soft bg-white space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs font-semibold text-gray-700">
                  Privacy, Terms & Cookies
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                  <Link
                    to="/privacy"
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  <Link
                    to="/terms"
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Terms
                  </Link>
                  <Link
                    to="/cookies"
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Cookies Policy
                  </Link>
                </div>
                <div className="mt-3 space-y-2 text-xs font-semibold text-gray-700">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={privacyAck}
                      onChange={(e) => setPrivacyAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>I understand the privacy policy.</span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={termsAck}
                      onChange={(e) => setTermsAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>I agree to the terms and conditions.</span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={cookiesAck}
                      onChange={(e) => setCookiesAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>I acknowledge cookies/local storage usage.</span>
                  </label>
                </div>
                {(!privacyAck || !termsAck || !cookiesAck) && (
                  <div className="mt-2 text-[11px] text-gray-500">
                    Please acknowledge all items to create or join a group.
                  </div>
                )}
              </div>

              <div>
                <div className="font-bold text-gray-900">Create Group</div>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 p-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                  placeholder="Trip Name"
                />
                <Button
                  className="mt-3 w-full sm:w-auto"
                  onClick={createGroup}
                  disabled={!privacyAck || !termsAck || !cookiesAck}
                >
                  Create
                </Button>
              </div>

              <div>
                <div className="font-bold text-gray-900">Join Group</div>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-gray-200 p-3 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-200"
                  placeholder="Invite Code"
                />
                <Button
                  variant="orange"
                  className="mt-3 w-full sm:w-auto"
                  onClick={joinGroup}
                  disabled={!privacyAck || !termsAck || !cookiesAck}
                >
                  Join
                </Button>
                {joinError && (
                  <div className="mt-2 text-xs font-semibold text-red-600">
                    {joinError}
                  </div>
                )}
              </div>
            </div>

            {/* Profile setup */}
            <div className="rounded-3xl border border-gray-200 p-4 shadow-soft bg-white md:col-span-2">
              <div className="font-bold text-gray-900">Profile Setup</div>

              <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-3xl border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                    {profileAvatar ? (
                      <img
                        src={profileAvatar}
                        alt="avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">👤</span>
                    )}
                  </div>

                  <div>
                    <input
                      ref={profileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;

                        try {
                          const path = await uploadProfileAvatar(
                            session.userId,
                            f,
                          );
                          await saveProfileRemote(session.userId, {
                            avatarDataUrl: path,
                          });

                          const signed = await getSignedStorageUrl(path);
                          saveProfile(session.userId, {
                            avatarDataUrl: signed,
                          });
                          setProfileAvatar(signed);
                        } catch (err) {
                          const msg =
                            (err as { message?: string })?.message ??
                            "Could not upload image.";
                          setProfileError(msg);
                        } finally {
                          if (profileRef.current) profileRef.current.value = "";
                        }
                      }}
                    />

                    <Button
                      variant="ghost"
                      onClick={() => profileRef.current?.click()}
                    >
                      Upload photo
                    </Button>
                    <div className="mt-1 text-xs text-gray-500">
                      Image stored in private storage.
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <label className="text-sm font-semibold text-gray-900">
                    Display name (required)
                  </label>
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-gray-200 p-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                    placeholder="Your name"
                  />

                  <div className="mt-3">
                    <Button
                      variant="primary"
                      disabled={profileSaving}
                      onClick={saveProfileInfo}
                    >
                      {profileSaving ? "Saving..." : "Save profile"}
                    </Button>
                  </div>

                  {profileError && (
                    <div className="mt-2 text-xs font-semibold text-red-600">
                      {profileError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
