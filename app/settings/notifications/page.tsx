"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type NotificationCategory =
  | "friend_requests"
  | "parachat"
  | "comments_likes"
  | "reels"
  | "badges"
  | "support_updates";

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

type NotificationPrefs = Record<NotificationCategory, boolean>;

const defaultPrefs: NotificationPrefs = {
  friend_requests: true,
  parachat: true,
  comments_likes: true,
  reels: true,
  badges: true,
  support_updates: true,
};

const preferenceOptions: Array<{
  key: NotificationCategory;
  title: string;
  description: string;
  examples: string[];
  status: "planned" | "ready";
}> = [
  {
    key: "friend_requests",
    title: "Friend Requests",
    description: "Notifications for new friend requests, accepted requests, and friend activity.",
    examples: ["New request", "Request accepted", "Friend activity"],
    status: "ready",
  },
  {
    key: "parachat",
    title: "Parachat",
    description: "Notifications for messages, unread conversations, and future Parachat activity.",
    examples: ["New message", "Unread chat", "Conversation updates"],
    status: "planned",
  },
  {
    key: "comments_likes",
    title: "Comments & Likes",
    description: "Notifications when people like, comment, reply, or interact with your posts.",
    examples: ["Post likes", "Comments", "Replies"],
    status: "ready",
  },
  {
    key: "reels",
    title: "Parapost Reels",
    description: "Notifications for Reel likes, comments, shares, saves, and creator activity.",
    examples: ["Reel likes", "Reel comments", "Reel shares"],
    status: "ready",
  },
  {
    key: "badges",
    title: "Badges",
    description: "Notifications when badges are earned, awarded, or shown in profile activity.",
    examples: ["Badge earned", "Profile award", "Milestones"],
    status: "ready",
  },
  {
    key: "support_updates",
    title: "Support Updates",
    description: "Notifications for support replies, account/data requests, privacy reviews, and safety requests.",
    examples: ["Support reply", "Request update", "Safety review"],
    status: "planned",
  },
];

const quickLinks = [
  {
    title: "Privacy & Safety",
    description: "Manage reporting, privacy concerns, and support contact.",
    href: "/settings/privacy-safety",
  },
  {
    title: "Data & Account",
    description: "Request account/data support, deletion help, or privacy assistance.",
    href: "/settings/data",
  },
  {
    title: "Profile Settings",
    description: "Manage your profile, bio, avatar, and public/private setting.",
    href: "/settings/profile",
  },
  {
    title: "Legal & Policies",
    description: "Review launch policy sections and app-store readiness areas.",
    href: "/settings/legal",
  },
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

export default function NotificationSettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canSeeAdminSupport = isAdminRole(adminRole);

  const enabledCount = useMemo(() => {
    return Object.values(prefs).filter(Boolean).length;
  }, [prefs]);

  useEffect(() => {
    let cancelled = false;

    async function loadPageUser() {
      setPageLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setCurrentUserId("");
        setUserEmail("");
        setCurrentProfile(null);
        setAdminRole("");
        setPageLoading(false);
        return;
      }

      setCurrentUserId(user.id);
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

    void loadPageUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = (key: NotificationCategory) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setStatusMessage("");
    setErrorMessage("");
  };

  const handleSavePreferences = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setStatusMessage("");
    setErrorMessage("");

    if (!currentUserId) {
      setErrorMessage("Please sign in before saving notification preferences.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("support_messages").insert({
      user_id: currentUserId,
      user_email: userEmail || null,
      user_name: getDisplayName(currentProfile),
      topic: "other",
      message:
        "Notification preferences placeholder saved during Settings setup. This creates an internal record until notification preferences are connected to a dedicated database table.",
      status: "open",
      priority: "low",
      source: "notification_settings_placeholder",
      page_url: typeof window !== "undefined" ? window.location.href : null,
      metadata: {
        submitted_from: "settings_notifications_page",
        notification_preferences_preview: prefs,
      },
    });

    setSaving(false);

    if (error) {
      setErrorMessage(`Could not save notification preference preview: ${error.message}`);
      return;
    }

    setStatusMessage(
      "Notification preferences preview saved. A dedicated notification preferences table can be connected in the next backend pass."
    );
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#05050b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed -right-28 -top-28 h-96 w-96 rounded-full bg-purple-600/25 blur-3xl" />
      <div className="pointer-events-none fixed left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-28 h-96 w-96 rounded-full bg-indigo-500/12 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/settings" className="text-sm font-bold text-purple-200 no-underline hover:text-white">
              ← Back to Settings
            </Link>

            <Link href="/dashboard" className="text-sm font-bold text-slate-300 no-underline hover:text-white">
              Dashboard
            </Link>
          </div>

          <span className="rounded-full border border-purple-300/30 bg-purple-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-purple-100 shadow-lg shadow-purple-950/20">
            Settings Phase 2.5
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="rounded-[30px] border border-purple-200/15 bg-gradient-to-br from-purple-500/14 via-white/[0.065] to-slate-950/70 p-5 shadow-2xl shadow-purple-950/20 ring-1 ring-white/[0.035] sm:p-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
              Notifications
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Control how Parapost Network keeps you updated.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              This page prepares notification controls for friend requests, Parachat, comments, likes,
              Parapost Reels, badges, and support updates. The UI is ready now, and backend preference storage
              can be connected in the next pass.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#notification-preferences"
                className="rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/40 transition hover:brightness-110"
              >
                Notification Controls
              </a>

              <Link
                href="/notifications"
                className="rounded-full border border-purple-200/20 bg-purple-400/10 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/10 transition hover:bg-purple-400/15"
              >
                Open Notifications
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

          <aside className="rounded-[30px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035]">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-slate-950 text-2xl font-black ring-1 ring-white/15">
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

            <div className="mt-5 rounded-2xl border border-purple-200/15 bg-black/30 p-4 shadow-inner shadow-purple-950/10">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-purple-200">
                Active Preview
              </div>
              <div className="mt-2 text-2xl font-black">{enabledCount}/6 On</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                These controls are prepared for launch. A dedicated notification preference table can make them fully persistent.
              </p>
            </div>

            {!pageLoading && !currentUserId ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Sign in is required to save notification preferences.
              </div>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section
              id="notification-preferences"
              className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                    Notification Preferences
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">
                    Choose what you want to be notified about.
                  </h2>
                </div>

                <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-100">
                  UI Ready
                </span>
              </div>

              <form onSubmit={handleSavePreferences} className="space-y-4">
                <div className="grid gap-3">
                  {preferenceOptions.map((item) => {
                    const enabled = prefs[item.key];

                    return (
                      <div
                        key={item.key}
                        className="rounded-[24px] border border-purple-200/15 bg-black/25 p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="m-0 text-lg font-black tracking-[-0.02em]">
                                {item.title}
                              </h3>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${
                                  item.status === "ready"
                                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                                    : "border-amber-300/25 bg-amber-400/10 text-amber-100"
                                }`}
                              >
                                {item.status === "ready" ? "Ready" : "Planned"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {item.description}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.examples.map((example) => (
                                <span
                                  key={example}
                                  className="rounded-full border border-purple-200/15 bg-black/30 px-3 py-1.5 text-xs font-bold text-slate-300"
                                >
                                  {example}
                                </span>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            aria-pressed={enabled}
                            onClick={() => handleToggle(item.key)}
                            className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border transition ${
                              enabled
                                ? "border-purple-300/40 bg-gradient-to-r from-violet-500 to-fuchsia-500"
                                : "border-white/10 bg-white/15"
                            }`}
                          >
                            <span
                              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition ${
                                enabled ? "translate-x-8" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-purple-200/15 bg-purple-400/[0.045] p-4 text-sm leading-6 text-slate-300">
                  These controls are set up as a launch-ready UI preview. The next backend pass can connect them
                  to a dedicated notification preferences table instead of saving a support preview record.
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-500">
                    {enabledCount} notification categories enabled
                  </span>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {saving ? "Saving..." : "Save Preference Preview"}
                  </button>
                </div>

                {statusMessage ? (
                  <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                    {statusMessage}
                  </div>
                ) : null}

                {errorMessage ? (
                  <div className="rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">
                    {errorMessage}
                  </div>
                ) : null}
              </form>
            </section>

            <section className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                Notification System Notes
              </p>
              <h2 className="text-2xl font-black tracking-[-0.03em]">
                Ready for a dedicated backend table.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                The current Notifications page already exists for viewing activity. This Settings page prepares
                user controls so Parapost Network can later respect each user&apos;s notification preferences
                across friend requests, Parachat, comments, Reels, badges, and support updates.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  "Friend request controls",
                  "Parachat alerts",
                  "Post interaction alerts",
                  "Parapost Reels alerts",
                  "Badge award alerts",
                  "Support update alerts",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-purple-200/15 bg-black/30 px-4 py-3 text-sm font-bold text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {quickLinks.map((card) => (
              <Link key={card.title} href={card.href} className="block text-white no-underline">
                <section className="rounded-[26px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.045] to-slate-950/55 p-5 shadow-xl shadow-purple-950/10 transition hover:bg-purple-400/10">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-200">
                      Connected
                    </span>
                    <span className="rounded-full border border-purple-200/15 bg-purple-400/10 px-2.5 py-1 text-[11px] font-black text-slate-300">
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
