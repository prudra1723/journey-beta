import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ensureProfile, getAuthSession, signInAnonymously } from "../lib/auth";
import { setSessionFromProfile } from "../lib/session";
import { createGroup, getGroupByCode, joinGroup } from "../lib/appDb";

export function Start({ onDone }: { onDone: (groupId?: string) => void }) {
  const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
    | string
    | undefined;
  const keyIssue = !rawAnonKey
    ? "Supabase anon key missing. Set VITE_SUPABASE_ANON_KEY in .env.local."
    : rawAnonKey.startsWith("sb_")
      ? "Wrong key. Use the legacy anon/public key (starts with eyJ...), not sb_publishable."
      : null;

  const initialCode = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("code") ?? "";
  }, []);

  const [mode, setMode] = useState<"create" | "join">(
    initialCode ? "join" : "create",
  );
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState(initialCode);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameHint, setNameHint] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [privacyAck, setPrivacyAck] = useState(false);
  const [termsAck, setTermsAck] = useState(false);
  const [cookiesAck, setCookiesAck] = useState(false);

  const nameKey = useMemo(() => name.trim().toLowerCase(), [name]);

  const canContinue =
    !keyIssue &&
    name.trim().length >= 2 &&
    (mode === "create"
      ? groupName.trim().length >= 2
      : inviteCode.trim().length >= 4) &&
    privacyAck &&
    termsAck &&
    cookiesAck;

  const withTimeout = async <T,>(p: Promise<T>, label: string) => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out (15s)`)), 15000),
    );
    return Promise.race([p, timeout]);
  };

  async function handleContinue() {
    if (!canContinue || busy) return;

    try {
      if (keyIssue) {
        setError(keyIssue);
        return;
      }

      setError(null);
      setBusy(true);

      const trimmedName = name.trim();

      let existingGroup: { id: string } | null = null;

      // ✅ If joining, validate invite code first
      if (mode === "join") {
        setStep("group:lookup");
        existingGroup = await withTimeout(
          getGroupByCode(inviteCode.trim()),
          "Find group",
        );
        if (!existingGroup) {
          throw new Error("Invalid invite code.");
        }
        setNameHint(
          "Joining creates a new device session (names can be reused).",
        );
      }

      // ✅ Reuse existing session if present; only create a new anon session if needed
      setStep("auth:checkSession");
      const sessionRes = await withTimeout(getAuthSession(), "Session check");
      const existingUserId =
        sessionRes?.data?.session?.user?.id ?? sessionRes?.data?.user?.id ?? null;

      let authUserId = existingUserId;
      if (!authUserId) {
        setStep("auth:signInAnonymously");
        const auth = await withTimeout(signInAnonymously(), "Guest login");
        authUserId = auth?.user?.id ?? auth?.session?.user?.id ?? null;
      }
      if (!authUserId) throw new Error("Anonymous login failed");

      // ✅ Ensure profile (should be UPSERT in auth.ts)
      setStep("profile:ensure");
      const profile = await withTimeout(
        ensureProfile(authUserId, trimmedName),
        "Profile setup",
      );

      setSessionFromProfile(profile.id, profile.display_name ?? trimmedName);

      // ✅ Create or Join group
      setStep(mode === "create" ? "group:create" : "group:join");
      let group: { id: string } | null = null;
      if (mode === "create") {
        group = await withTimeout(
          createGroup(groupName.trim(), authUserId),
          "Create group",
        );
      } else {
        group = await withTimeout(
          joinGroup(inviteCode.trim(), authUserId, trimmedName),
          "Join group",
        );
      }

      if (!group?.id) {
        throw new Error(
          mode === "join" ? "Invalid invite code." : "Group create failed.",
        );
      }

      setStep("done");
      onDone(group.id);
    } catch (err: any) {
      setStep("error");
      setError(err?.message || "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50">
      <header className="sticky top-3 z-20 mx-auto w-[95%] max-w-5xl rounded-2xl border border-gray-200 bg-white shadow-md">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="font-extrabold tracking-tight text-gray-900">
            Journey
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-90px)] w-[95%] max-w-5xl items-center justify-center py-6">
        <div className="w-full max-w-xl">
          <Card className="p-6">
            <div className="text-3xl font-extrabold text-gray-900">
              {mode === "create" ? "Create a group" : "Join a group"}
            </div>
            <p className="mt-2 text-gray-600">
              {mode === "create"
                ? "Start a new group and share the code."
                : "Enter the invite code to join instantly."}
            </p>

            <div className="mt-6">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className={[
                    "px-4 py-2 rounded-full border text-sm font-semibold",
                    mode === "create"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-gray-200 text-gray-700",
                  ].join(" ")}
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setMode("join")}
                  className={[
                    "px-4 py-2 rounded-full border text-sm font-semibold",
                    mode === "join"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white border-gray-200 text-gray-700",
                  ].join(" ")}
                >
                  Join
                </button>
              </div>

              <div className="mt-2">
                <label className="text-sm font-semibold text-gray-900">
                  Your name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Rudra Pandey"
                  className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                />
                <div className="mt-2 text-xs text-gray-500">
                  User ID: <span className="font-mono">{nameKey || "-"}</span>
                </div>
              </div>

              {mode === "create" && (
                <div className="mt-4">
                  <label className="text-sm font-semibold text-gray-900">
                    Group name
                  </label>
                  <input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Birthday Trip"
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-200"
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    We’ll generate a shareable code after you create.
                  </div>
                </div>
              )}

              {mode === "join" && (
                <div className="mt-4">
                  <label className="text-sm font-semibold text-gray-900">
                    Invite code
                  </label>
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="e.g., TRIP-7F2A"
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-200"
                  />
                  {nameHint && (
                    <div className="mt-2 text-xs text-gray-500">{nameHint}</div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                variant="primary"
                disabled={!canContinue || busy}
                onClick={handleContinue}
                className="w-full sm:w-auto"
              >
                {busy ? "Working..." : "Continue"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setName("")}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                Clear
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-700">
                Privacy, Terms & Cookies
              </div>
              <div className="mt-2 space-y-2 text-[11px] text-gray-600">
                <p>
                  This app is for testing and group member use only. You can
                  create or join a group using an invite code.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/privacy"
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Read Privacy Policy
                  </Link>
                  <Link
                    to="/terms"
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Read Terms
                  </Link>
                  <Link
                    to="/cookies"
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Cookies Policy
                  </Link>
                </div>
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
            </div>

            {step && (
              <div className="mt-2 text-xs font-mono text-gray-500">
                Step: {step}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
