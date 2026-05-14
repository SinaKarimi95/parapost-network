"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ProfilePreview = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at?: string | null;
};

type AdminUserRow = {
  user_id: string;
  role: string;
};

function getDisplayName(profile: ProfilePreview | null) {
  return profile?.full_name || profile?.username || "Parapost Member";
}

function getInitial(profile: ProfilePreview | null) {
  return getDisplayName(profile).charAt(0).toUpperCase();
}

function isAdminRole(role: string) {
  return ["owner", "admin", "support", "moderator"].includes(role);
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const securityCards = [
  {
    title: "Password",
    description:
      "Send yourself a secure reset email when you want to update your password.",
    label: "Reset by email",
  },
  {
    title: "Active session",
    description:
      "Your browser session keeps you signed in until you sign out or the session expires.",
    label: "Session active",
  },
  {
    title: "Account deletion",
    description:
      "Account and data deletion requests are handled through Data & Account for safety and review.",
    label: "Request flow",
  },
  {
    title: "Support",
    description:
      "Questions about account access, privacy, safety, or deletion can be sent through Parapost support.",
    label: "Contact form",
  },
];

const quickLinks = [
  {
    title: "Profile Settings",
    description: "Edit profile details, avatar, bio, and public/private profile controls.",
    href: "/settings/profile",
  },
  {
    title: "Privacy & Safety",
    description: "Report privacy, safety, moderation, or account concerns.",
    href: "/settings/privacy-safety",
  },
  {
    title: "Data & Account",
    description: "Request account deletion, data deletion, correction, or access help.",
    href: "/settings/data",
  },
  {
    title: "Legal & Policies",
    description: "Review Terms, Privacy Policy, Community Guidelines, and deletion policy areas.",
    href: "/settings/legal",
  },
];

export default function AccountSecuritySettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [lastSignInAt, setLastSignInAt] = useState<string | null>(null);
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [sendingReset, setSendingReset] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canSeeAdminSupport = isAdminRole(adminRole);

  const accountStatusLabel = useMemo(() => {
    if (pageLoading) return "Checking...";
    if (!userId) return "Signed out";
    return "Signed in";
  }, [pageLoading, userId]);

  useEffect(() => {
    let cancelled = false;

    async function loadPageUser() {
      setPageLoading(true);
      setStatusMessage("");
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        setUserId("");
        setUserEmail("");
        setLastSignInAt(null);
        setCurrentProfile(null);
        setAdminRole("");
        setPageLoading(false);
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || "");
      setLastSignInAt(user.last_sign_in_at || null);

      const [{ data: profileData }, { data: adminData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, created_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("admin_users")
          .select("user_id, role")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      setCurrentProfile((profileData as ProfilePreview | null) || null);

      const adminRow = adminData as AdminUserRow | null;
      setAdminRole(adminRow?.role && isAdminRole(adminRow.role) ? adminRow.role : "");
      setPageLoading(false);
    }

    void loadPageUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendPasswordReset = async () => {
    setStatusMessage("");
    setErrorMessage("");

    if (!userEmail) {
      setErrorMessage("Please sign in before requesting a password reset.");
      return;
    }

    setSendingReset(true);

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : undefined;

    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo,
    });

    setSendingReset(false);

    if (error) {
      setErrorMessage(`Could not send password reset email: ${error.message}`);
      return;
    }

    setStatusMessage("Password reset email sent. Check your inbox for the secure reset link.");
  };

  const handleSignOut = async () => {
    setStatusMessage("");
    setErrorMessage("");
    setSigningOut(true);

    const { error } = await supabase.auth.signOut();

    setSigningOut(false);

    if (error) {
      setErrorMessage(`Could not sign out: ${error.message}`);
      return;
    }

    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#05050b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed -right-28 -top-28 h-96 w-96 rounded-full blur-3xl" style={{ background: "var(--parapost-accent-soft)" }} />
      <div className="pointer-events-none fixed left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl" style={{ background: "var(--parapost-accent-muted-bg)" }} />
      <div className="pointer-events-none fixed -bottom-28 -left-28 h-96 w-96 rounded-full blur-3xl" style={{ background: "var(--parapost-accent-soft)" }} />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/settings" className="text-sm font-bold no-underline hover:text-white" style={{ color: "var(--parapost-accent-text)" }}>
              ← Back to Settings
            </Link>

            <Link href="/dashboard" className="text-sm font-bold text-slate-300 no-underline hover:text-white">
              Dashboard
            </Link>
          </div>

          <span className="rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-lg" style={{ borderColor: "var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)", color: "var(--parapost-accent-readable-text)", boxShadow: "0 12px 28px var(--parapost-accent-glow)" }}>
            Settings Phase 4
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-[30px] border p-5 shadow-2xl ring-1 ring-white/[0.035] sm:p-7" style={{ borderColor: "var(--parapost-accent-border)", background: "linear-gradient(135deg, var(--parapost-accent-soft), rgba(255,255,255,0.06), rgba(15,23,42,0.70))", boxShadow: "0 24px 70px rgba(0,0,0,0.38), 0 0 38px var(--parapost-accent-glow)" }}>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--parapost-accent-text)" }}>
              Account & Security
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Manage your Parapost Network account safely.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Review your signed-in account, request a password reset email, sign out, and reach the right
              privacy, data, support, and deletion request areas from one clean Settings page.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSendPasswordReset}
                disabled={sendingReset || pageLoading || !userEmail}
                className="rounded-full px-5 py-3 text-sm font-black shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "linear-gradient(135deg, var(--parapost-accent-1), var(--parapost-accent-2), var(--parapost-accent-3))",
                  color: "var(--parapost-accent-button-text)",
                  boxShadow: "0 12px 26px var(--parapost-accent-glow)",
                }}
              >
                {sendingReset ? "Sending..." : "Send Password Reset"}
              </button>

              <Link
                href="/settings/data"
                className="rounded-full border px-5 py-3 text-sm font-black text-white no-underline shadow-lg transition hover:bg-white/10"
                style={{ borderColor: "var(--parapost-accent-border)", background: "rgba(255,255,255,0.055)" }}
              >
                Data & Deletion
              </Link>

              {canSeeAdminSupport ? (
                <Link
                  href="/admin/support"
                  className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-100 no-underline hover:bg-emerald-400/15"
                >
                  Support Inbox
                </Link>
              ) : null}
            </div>
          </div>

          <aside className="rounded-[30px] border p-5 shadow-2xl ring-1 ring-white/[0.035]" style={{ borderColor: "var(--parapost-accent-border)", background: "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.055), rgba(15,23,42,0.56))", boxShadow: "0 24px 70px rgba(0,0,0,0.30)" }}>
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full text-2xl font-black ring-1 ring-white/15" style={{ background: "linear-gradient(135deg, var(--parapost-accent-1), var(--parapost-accent-2), var(--parapost-accent-3))" }}>
                {currentProfile?.avatar_url ? (
                  <img src={currentProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitial(currentProfile)
                )}
              </div>

              <div className="min-w-0">
                <div className="truncate text-lg font-black">
                  {pageLoading ? "Loading..." : getDisplayName(currentProfile)}
                </div>
                <div className="truncate text-sm text-slate-400">{userEmail || "Signed out"}</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/20">
              <div className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: "var(--parapost-accent-text)" }}>
                Account Status
              </div>
              <div className="mt-2 text-2xl font-black">{accountStatusLabel}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Last sign-in: {formatDate(lastSignInAt)}
              </p>
            </div>

            {userId ? (
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="mt-5 w-full rounded-2xl border border-red-300/25 bg-red-400/10 px-5 py-3 text-sm font-black text-red-100 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            ) : null}
          </aside>
        </section>

        {statusMessage ? (
          <div className="mb-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
            {statusMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section className="rounded-[28px] border p-5 shadow-2xl ring-1 ring-white/[0.035] sm:p-6" style={{ borderColor: "var(--parapost-accent-border)", background: "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.055), rgba(15,23,42,0.55))" }}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--parapost-accent-text)" }}>
                    Security Overview
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">
                    Account controls
                  </h2>
                </div>

                <span className="rounded-full border px-3 py-1.5 text-xs font-black" style={{ borderColor: "var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)", color: "var(--parapost-accent-readable-text)" }}>
                  Controlled
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {securityCards.map((card) => (
                  <article key={card.title} className="rounded-[24px] border border-white/10 bg-black/25 p-4">
                    <span className="rounded-full border px-2.5 py-1 text-[11px] font-black" style={{ borderColor: "var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)", color: "var(--parapost-accent-readable-text)" }}>
                      {card.label}
                    </span>

                    <h3 className="mt-4 text-lg font-black tracking-[-0.02em]">{card.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{card.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-300/20 bg-amber-400/10 p-5 shadow-2xl shadow-amber-950/10 sm:p-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-100">
                Important
              </p>
              <h2 className="text-2xl font-black tracking-[-0.03em] text-white">
                Account deletion stays controlled.
              </h2>
              <p className="mt-4 text-sm leading-7 text-amber-50/85">
                We are not adding an instant delete button here. Account and data deletion should stay inside a
                careful request flow so users understand what happens to their profile, posts, media, messages,
                reports, support history, and safety records.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/settings/data"
                  className="rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-black no-underline transition hover:brightness-110"
                >
                  Open Data & Account
                </Link>

                <Link
                  href="/settings/legal"
                  className="rounded-full border border-amber-200/25 bg-black/20 px-5 py-3 text-sm font-black text-amber-50 no-underline hover:bg-black/30"
                >
                  Legal & Policies
                </Link>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {quickLinks.map((card) => (
              <Link key={card.title} href={card.href} className="block text-white no-underline">
                <section className="rounded-[26px] border p-5 shadow-xl transition hover:bg-white/[0.06]" style={{ borderColor: "var(--parapost-accent-border)", background: "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.045), rgba(15,23,42,0.52))" }}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--parapost-accent-text)" }}>
                      Connected
                    </span>
                    <span className="rounded-full border px-2.5 py-1 text-[11px] font-black text-slate-300" style={{ borderColor: "var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)" }}>
                      Open
                    </span>
                  </div>

                  <h3 className="text-lg font-black tracking-[-0.02em]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{card.description}</p>
                </section>
              </Link>
            ))}
          </aside>
        </section>
      </div>
    </main>
  );
}
