"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ProfilePreview = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type AdminUserRow = {
  user_id: string;
  role: string;
};

type PreferenceKey =
  | "prioritize_friends"
  | "show_reels"
  | "show_trending"
  | "show_sponsored"
  | "hide_seen_posts"
  | "reduce_sensitive";

type PreferenceItem = {
  key: PreferenceKey;
  title: string;
  description: string;
  status: "Prepared" | "Coming soon";
};

const preferenceItems: PreferenceItem[] = [
  {
    key: "prioritize_friends",
    title: "Prioritize friends",
    description:
      "Future setting to show more posts from friends and accepted connections in the dashboard feed.",
    status: "Prepared",
  },
  {
    key: "show_reels",
    title: "Show Parapost Reels in feed",
    description:
      "Future setting to control whether Reels recommendations appear inside the dashboard timeline.",
    status: "Prepared",
  },
  {
    key: "show_trending",
    title: "Trending in Parapost",
    description:
      "Future setting to control trending topics, popular community posts, and discovery sections.",
    status: "Coming soon",
  },
  {
    key: "show_sponsored",
    title: "Sponsored content",
    description:
      "Future setting area for understanding sponsored posts and promoted placements when ads are live.",
    status: "Coming soon",
  },
  {
    key: "hide_seen_posts",
    title: "Reduce repeated posts",
    description:
      "Future setting to reduce posts you have already seen or interacted with.",
    status: "Coming soon",
  },
  {
    key: "reduce_sensitive",
    title: "Sensitive content controls",
    description:
      "Future controls for reducing certain types of mature, intense, or unwanted content in discovery areas.",
    status: "Coming soon",
  },
];

const mutedExamples = [
  "Muted words",
  "Hidden hashtags",
  "Hidden post topics",
  "Reels content filters",
  "Feed ranking controls",
  "Blocked discovery suggestions",
];

function getDisplayName(profile: ProfilePreview | null) {
  return profile?.full_name || profile?.username || "Parapost Member";
}

function getInitial(profile: ProfilePreview | null) {
  return getDisplayName(profile).charAt(0).toUpperCase();
}

function isAdminRole(role: string) {
  return ["owner", "admin", "support", "moderator"].includes(role);
}

export default function ContentFeedSettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const [draftPreferences, setDraftPreferences] = useState<Record<PreferenceKey, boolean>>({
    prioritize_friends: true,
    show_reels: true,
    show_trending: true,
    show_sponsored: true,
    hide_seen_posts: false,
    reduce_sensitive: false,
  });

  const canSeeAdminSupport = isAdminRole(adminRole);

  const enabledCount = useMemo(() => {
    return Object.values(draftPreferences).filter(Boolean).length;
  }, [draftPreferences]);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      setPageLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setCurrentProfile(null);
        setUserEmail("");
        setAdminRole("");
        setPageLoading(false);
        return;
      }

      setUserEmail(user.email || "");

      const [{ data: profileData }, { data: adminData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
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

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const togglePreference = (key: PreferenceKey) => {
    setDraftPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#05050b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div
        className="pointer-events-none fixed -right-28 -top-28 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "var(--parapost-accent-soft)" }}
      />
      <div
        className="pointer-events-none fixed left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "var(--parapost-accent-muted-bg)" }}
      />
      <div
        className="pointer-events-none fixed -bottom-28 -left-28 h-96 w-96 rounded-full blur-3xl"
        style={{ background: "var(--parapost-accent-soft)" }}
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/settings"
              className="text-sm font-bold no-underline hover:text-white"
              style={{ color: "var(--parapost-accent-text)" }}
            >
              ← Back to Settings
            </Link>

            <Link href="/dashboard" className="text-sm font-bold text-slate-300 no-underline hover:text-white">
              Dashboard
            </Link>
          </div>

          <span
            className="rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.18em] shadow-lg"
            style={{
              borderColor: "var(--parapost-accent-border)",
              background: "var(--parapost-accent-muted-bg)",
              color: "var(--parapost-accent-readable-text)",
              boxShadow: "0 12px 28px var(--parapost-accent-glow)",
            }}
          >
            Settings Phase 8
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div
            className="rounded-[30px] border p-5 shadow-2xl ring-1 ring-white/[0.035] sm:p-7"
            style={{
              borderColor: "var(--parapost-accent-border)",
              background:
                "linear-gradient(135deg, var(--parapost-accent-soft), rgba(255,255,255,0.06), rgba(15,23,42,0.70))",
              boxShadow: "0 24px 70px rgba(0,0,0,0.38), 0 0 38px var(--parapost-accent-glow)",
            }}
          >
            <p
              className="mb-3 text-xs font-black uppercase tracking-[0.18em]"
              style={{ color: "var(--parapost-accent-text)" }}
            >
              Content & Feed
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Shape what appears in your Parapost Network feed.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              This page prepares the future controls for feed ranking, muted words, hidden posts, sensitive content,
              Reels recommendations, trending topics, discovery sections, and sponsored placements.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span
                className="rounded-full px-5 py-3 text-sm font-black shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, var(--parapost-accent-1), var(--parapost-accent-2), var(--parapost-accent-3))",
                  color: "var(--parapost-accent-button-text)",
                  boxShadow: "0 12px 26px var(--parapost-accent-glow)",
                }}
              >
                {enabledCount} preview controls on
              </span>

              <Link
                href="/settings/privacy-safety"
                className="rounded-full border px-5 py-3 text-sm font-black text-white no-underline shadow-lg transition hover:bg-white/10"
                style={{ borderColor: "var(--parapost-accent-border)", background: "rgba(255,255,255,0.055)" }}
              >
                Privacy & Safety
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

          <aside
            className="rounded-[30px] border p-5 shadow-2xl ring-1 ring-white/[0.035]"
            style={{
              borderColor: "var(--parapost-accent-border)",
              background:
                "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.055), rgba(15,23,42,0.56))",
              boxShadow: "0 24px 70px rgba(0,0,0,0.30)",
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full text-2xl font-black ring-1 ring-white/15"
                style={{
                  background:
                    "linear-gradient(135deg, var(--parapost-accent-1), var(--parapost-accent-2), var(--parapost-accent-3))",
                }}
              >
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
              <div
                className="text-xs font-black uppercase tracking-[0.14em]"
                style={{ color: "var(--parapost-accent-text)" }}
              >
                Feed Status
              </div>
              <div className="mt-2 text-2xl font-black">Prepared</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                These controls are staged for future connection to the dashboard, Reels, discovery, and moderation systems.
              </p>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section
              className="rounded-[28px] border p-5 shadow-2xl ring-1 ring-white/[0.035] sm:p-6"
              style={{
                borderColor: "var(--parapost-accent-border)",
                background:
                  "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.055), rgba(15,23,42,0.55))",
              }}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p
                    className="mb-2 text-xs font-black uppercase tracking-[0.18em]"
                    style={{ color: "var(--parapost-accent-text)" }}
                  >
                    Feed Controls
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">
                    Preview controls
                  </h2>
                </div>

                <span
                  className="rounded-full border px-3 py-1.5 text-xs font-black"
                  style={{
                    borderColor: "var(--parapost-accent-border)",
                    background: "var(--parapost-accent-muted-bg)",
                    color: "var(--parapost-accent-readable-text)",
                  }}
                >
                  Coming soon
                </span>
              </div>

              <div className="grid gap-3">
                {preferenceItems.map((item) => {
                  const enabled = draftPreferences[item.key];

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => togglePreference(item.key)}
                      className="rounded-[24px] border p-4 text-left transition hover:bg-white/[0.06]"
                      style={{
                        borderColor: enabled ? "var(--parapost-accent-active-border)" : "rgba(255,255,255,0.10)",
                        background: enabled ? "var(--parapost-accent-muted-bg)" : "rgba(0,0,0,0.25)",
                        boxShadow: enabled ? "0 0 22px var(--parapost-accent-glow)" : "none",
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-black tracking-[-0.02em]">{item.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                        </div>

                        <span
                          className="rounded-full border px-3 py-1.5 text-xs font-black"
                          style={{
                            borderColor: enabled ? "var(--parapost-accent-active-border)" : "rgba(255,255,255,0.12)",
                            background: enabled ? "var(--parapost-accent-active-bg)" : "rgba(255,255,255,0.05)",
                            color: enabled ? "var(--parapost-accent-readable-text)" : "#cbd5e1",
                          }}
                        >
                          {enabled ? "On" : "Off"} · {item.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-300/20 bg-amber-400/10 p-5 shadow-2xl shadow-amber-950/10 sm:p-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-100">
                Important
              </p>
              <h2 className="text-2xl font-black tracking-[-0.03em] text-white">
                These controls are staged, not active ranking logic yet.
              </h2>
              <p className="mt-4 text-sm leading-7 text-amber-50/85">
                The switches are preview controls for the Settings UI. Later, we can save them to Supabase and connect
                them to the dashboard, Reels, discovery, hidden posts, and moderation systems.
              </p>
            </section>
          </div>

          <aside className="space-y-4">
            <section
              className="rounded-[26px] border p-5 shadow-xl"
              style={{
                borderColor: "var(--parapost-accent-border)",
                background:
                  "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.045), rgba(15,23,42,0.52))",
              }}
            >
              <p
                className="mb-2 text-xs font-black uppercase tracking-[0.16em]"
                style={{ color: "var(--parapost-accent-text)" }}
              >
                Future tools
              </p>
              <h3 className="text-lg font-black tracking-[-0.02em]">Content controls to connect later</h3>

              <div className="mt-4 flex flex-wrap gap-2">
                {mutedExamples.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-bold text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>

            <Link href="/settings/blocked-users" className="block text-white no-underline">
              <section
                className="rounded-[26px] border p-5 shadow-xl transition hover:bg-white/[0.06]"
                style={{
                  borderColor: "var(--parapost-accent-border)",
                  background:
                    "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.045), rgba(15,23,42,0.52))",
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className="text-[11px] font-black uppercase tracking-[0.16em]"
                    style={{ color: "var(--parapost-accent-text)" }}
                  >
                    Safety
                  </span>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-black text-slate-300"
                    style={{ borderColor: "var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)" }}
                  >
                    Open
                  </span>
                </div>

                <h3 className="text-lg font-black tracking-[-0.02em]">Blocked Users</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Manage accounts you have blocked and unblock them later.
                </p>
              </section>
            </Link>

            <Link href="/settings/help-support" className="block text-white no-underline">
              <section
                className="rounded-[26px] border p-5 shadow-xl transition hover:bg-white/[0.06]"
                style={{
                  borderColor: "var(--parapost-accent-border)",
                  background:
                    "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.045), rgba(15,23,42,0.52))",
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className="text-[11px] font-black uppercase tracking-[0.16em]"
                    style={{ color: "var(--parapost-accent-text)" }}
                  >
                    Support
                  </span>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-black text-slate-300"
                    style={{ borderColor: "var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)" }}
                  >
                    Open
                  </span>
                </div>

                <h3 className="text-lg font-black tracking-[-0.02em]">Help & Support</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Contact support for account, privacy, data, safety, bug, or policy help.
                </p>
              </section>
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
