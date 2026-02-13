import { supabase } from "./supabase";
import { normalizeName } from "./db/utils";

export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data; // { user, session }
}

export async function getAuthSession() {
  return supabase.auth.getSession();
}
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function ensureProfile(userId: string, displayName?: string) {
  const name = displayName?.trim() || "User";

  const { data: existing, error: findErr } = await supabase
    .from("profiles")
    .select("id,display_name")
    .eq("id", userId)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    const { data: updated, error: updateErr } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        name_key: normalizeName(name),
      })
      .eq("id", userId)
      .select("id,display_name")
      .single();
    if (updateErr) throw updateErr;
    return updated;
  }

  const { data: created, error: insertErr } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      display_name: name,
      name_key: normalizeName(name),
    })
    .select("id,display_name")
    .single();

  if (insertErr) throw insertErr;
  return created;
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
