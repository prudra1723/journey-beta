import { supabase } from "./supabase";
import { normalizeName } from "./db/utils";

export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data; // { user, session }
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const configuredRedirect = (
    import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined
  )?.trim();
  const redirectTo =
    configuredRedirect && /^https?:\/\//i.test(configuredRedirect)
      ? configuredRedirect
      : typeof window !== "undefined"
      ? `${window.location.origin}/`
      : undefined;
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: redirectTo,
    },
  });
  if (error) {
    if (/already registered/i.test(error.message)) {
      throw new Error("Email already registered. Please login.");
    }
    throw error;
  }
  // Supabase may return an obfuscated user for existing emails.
  const identities = (data.user as { identities?: unknown[] } | null)?.identities;
  if (data.user && Array.isArray(identities) && identities.length === 0) {
    throw new Error("Email already registered. Please login.");
  }
  return data;
}

export async function signInWithEmailPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) throw error;
  return data;
}

export async function getAuthSession() {
  return supabase.auth.getSession();
}
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function ensureProfile(
  userId: string,
  displayName?: string,
  email?: string,
  loginPin?: string,
) {
  const name = displayName?.trim() || "User";
  const emailValue = email?.trim();
  const pinValue = loginPin?.trim();

  const { data: existing, error: findErr } = await supabase
    .from("profiles")
    .select("id,display_name,email,login_pin")
    .eq("id", userId)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    const updatePayload: {
      display_name: string;
      name_key: string;
      email?: string | null;
      login_pin?: string | null;
    } = {
      display_name: name,
      name_key: normalizeName(name),
    };
    if (emailValue) updatePayload.email = emailValue;
    if (pinValue) updatePayload.login_pin = pinValue;

    const { data: updated, error: updateErr } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id,display_name,email")
      .single();
    if (updateErr) throw updateErr;
    return updated;
  }

  const insertPayload: {
    id: string;
    display_name: string;
    name_key: string;
    email?: string | null;
    login_pin?: string | null;
  } = {
    id: userId,
    display_name: name,
    name_key: normalizeName(name),
  };
  if (emailValue) insertPayload.email = emailValue;
  if (pinValue) insertPayload.login_pin = pinValue;

  const { data: created, error: insertErr } = await supabase
    .from("profiles")
    .insert(insertPayload)
    .select("id,display_name,email")
    .single();

  if (insertErr) throw insertErr;
  return created;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,email,login_pin")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
