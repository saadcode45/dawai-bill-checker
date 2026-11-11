"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";

// Email + password only. No magic link, no email-confirmation dependency:
// the Supabase project must have "Confirm email" OFF (see supabase/schema.sql),
// so sign-up returns a session immediately and is never blocked by email
// rate limits. If the dashboard setting is still ON, sign-up shows a clear
// message instead of failing silently.

const inputCls =
  "w-full min-h-[52px] rounded-xl border border-neutral-300 bg-white px-4 text-[16px] outline-none focus:border-emerald-700";
const btn =
  "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-5 text-[17px] font-bold";

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password. Check both and try again.";
  if (m.includes("user already registered") || m.includes("already registered"))
    return "An account with this email already exists. Sign in instead.";
  if (m.includes("email not confirmed"))
    return "Email confirmation is ON in Supabase. Turn OFF 'Confirm email' in Supabase Dashboard > Authentication, then try again.";
  if (m.includes("password should be at least")) return "Password must be at least 6 characters.";
  if (m.includes("unable to validate email")) return "That email address doesn't look valid.";
  return message;
}

export default function AuthForm() {
  const [view, setView] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const sb = getSupabaseBrowser();
    if (!sb) {
      setErr("Supabase is not configured yet. Add the keys to .env.local (see README).");
      return;
    }
    setBusy(true);
    try {
      if (view === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) setErr(friendlyError(error.message));
        else window.location.reload();
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) setErr(friendlyError(error.message));
        else if (data.session) {
          setMsg("Account created. You are signed in.");
          setTimeout(() => window.location.reload(), 600);
        } else {
          setErr(
            "Account created but no session came back — 'Confirm email' is ON in Supabase. Turn it OFF in Supabase Dashboard > Authentication, then sign in."
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-[18px] font-bold">
        {view === "signin" ? "Owner Sign In" : "Owner Register"}
      </h2>
      <p className="text-[14px] text-neutral-600">
        Pharmacy owner only. Patients never need to log in.
      </p>
      <input
        className={inputCls}
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <input
        className={inputCls}
        type="password"
        required
        minLength={6}
        placeholder="Password (min 6 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={view === "signin" ? "current-password" : "new-password"}
      />
      {err && <p className="rounded-xl bg-red-50 p-3 text-[15px] font-semibold text-red-700">{err}</p>}
      {msg && <p className="rounded-xl bg-emerald-50 p-3 text-[15px] font-semibold text-emerald-700">{msg}</p>}
      <button type="submit" disabled={busy} className={`${btn} bg-emerald-700 text-white disabled:opacity-50`}>
        {busy ? "Please wait…" : view === "signin" ? "Sign In" : "Create Account"}
      </button>
      <button
        type="button"
        onClick={() => { setView(view === "signin" ? "signup" : "signin"); setErr(""); setMsg(""); }}
        className="w-full py-2 text-center text-[15px] font-semibold text-emerald-700"
      >
        {view === "signin" ? "No account yet? Register" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
