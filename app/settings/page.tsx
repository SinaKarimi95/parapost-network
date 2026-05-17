"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SupportTopic =
  | "account"
  | "privacy_safety"
  | "report_problem"
  | "data_delete_account"
  | "payments"
  | "bug_report"
  | "legal_policy"
  | "other";

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

const SUPPORT_TOPICS: Array<{ value: SupportTopic; label: string; helper: string }> = [
  {
    value: "account",
    label: "Account",
    helper: "Login, profile, email, password, or account access.",
  },
  {
    value: "privacy_safety",
    label: "Privacy & Safety",
    helper: "Blocking, privacy controls, safety concerns, or unwanted contact.",
  },
  {
    value: "report_problem",
    label: "Report a Problem",
    helper: "Something on Parapost Network is not working correctly.",
  },
  {
    value: "data_delete_account",
    label: "Data / Delete Account",
    helper: "Account deletion, data deletion, or privacy/data help.",
  },
  {
    value: "payments",
    label: "Payments",
    helper: "Future payments, promotions, sponsorships, or billing questions.",
  },
  {
    value: "bug_report",
    label: "Bug Report",
    helper: "Technical bug, layout issue, broken button, or app problem.",
  },
  {
    value: "legal_policy",
    label: "Legal / Policy",
    helper: "Terms, privacy policy, community guidelines, or content policy.",
  },
  {
    value: "other",
    label: "Other",
    helper: "Anything else you want to send to Parapost Network support.",
  },
];

const SETTINGS_CARDS = [
  {
    eyebrow: "Account",
    title: "Account & Security",
    description:
      "Manage sign-in status, email, password reset, account access, sign out, and account security tools.",
    items: ["Signed-in account", "Email & password", "Password reset", "Sign out"],
    href: "/settings/account",
    active: true,
  },
  {
    eyebrow: "Profile",
    title: "Profile Settings",
    description: "Edit your profile details, avatar, bio, and public/private profile controls.",
    items: ["Profile info", "Avatar", "Bio", "Profile controls"],
    href: "/settings/profile",
    active: true,
  },
  {
    eyebrow: "Privacy",
    title: "Privacy & Safety",
    description: "Control profile visibility, blocking, reports, safety support, and community protection tools.",
    items: ["Profile visibility", "Blocked users", "Report support", "Safety tools"],
    href: "/settings/privacy-safety",
    active: true,
  },
  {
    eyebrow: "Safety",
    title: "Blocked Users",
    description: "Review accounts you have blocked and safely unblock them later when needed.",
    items: ["Blocked accounts", "Search list", "Unblock users", "Safety control"],
    href: "/settings/blocked-users",
    active: true,
  },
  {
    eyebrow: "Personalization",
    title: "Personalization",
    description: "Customize Parapost Network with accent colors, theme appearance, and font style options.",
    items: ["Accent color", "Theme appearance", "Font style", "Saved preferences"],
    href: "/settings/personalization",
    active: true,
  },
  {
    eyebrow: "Notifications",
    title: "Notifications",
    description: "Manage alerts for friend requests, Parachat, comments, likes, Reels, badges, and support updates.",
    items: ["Friend requests", "Parachat", "Comments & likes", "Reels activity"],
    href: "/settings/notifications",
    active: true,
  },
  {
    eyebrow: "Feed",
    title: "Content & Feed",
    description: "Manage feed preferences, hidden posts, muted words, content filters, and Reels preferences.",
    items: ["Feed preferences", "Muted words", "Hidden posts", "Reels filters"],
    href: "/settings/content-feed",
    active: true,
  },
  {
    eyebrow: "Data",
    title: "Data & Account",
    description: "Request account data, correct information, ask for data deletion, or start account deletion support.",
    items: ["Request my data", "Correct data", "Data deletion", "Account deletion"],
    href: "/settings/data",
    active: true,
  },
  {
    eyebrow: "Support",
    title: "Help & Support",
    description: "Contact Parapost Network for account help, privacy, safety, bugs, data, and policy questions.",
    items: ["Contact support", "Report a problem", "Account help", "Safety help"],
    href: "/settings/help-support",
    active: true,
  },
  {
    eyebrow: "Legal",
    title: "Legal",
    description: "Review Parapost Network policies for trust, safety, app-store readiness, and user protection.",
    items: ["Terms of Service", "Privacy Policy", "Community Guidelines", "Data Deletion Policy"],
    href: "/settings/legal",
    active: true,
  },
  {
    eyebrow: "Coming Soon",
    title: "Payments",
    description:
      "A polished coming-soon area for promoted posts, sponsored content, billing history, and business tools.",
    items: ["Promotions", "Sponsored posts", "Billing history", "Not live yet"],
    href: "/settings/payments",
    active: true,
  },
];

function getInitial(profile: ProfilePreview | null) {
  const value = profile?.full_name || profile?.username || "P";
  return value.charAt(0).toUpperCase();
}

function getTopicLabel(topic: SupportTopic) {
  return SUPPORT_TOPICS.find((item) => item.value === topic)?.label || "Other";
}

function isAdminRole(role: string) {
  return ["owner", "admin", "support", "moderator"].includes(role);
}


function BackToPrevious({
  label = "← Back",
  fallbackHref = "/settings",
}: {
  label?: string;
  fallbackHref?: string;
}) {
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }

    if (typeof window !== "undefined") {
      window.location.href = fallbackHref;
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="text-sm font-bold no-underline transition hover:text-white"
      style={{ color: "var(--parapost-accent-text)" }}
    >
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const [supportTopic, setSupportTopic] = useState<SupportTopic>("account");
  const [supportMessage, setSupportMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");

  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [supportStatus, setSupportStatus] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
  const [supportError, setSupportError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const displayName = currentProfile?.full_name || currentProfile?.username || "Parapost Member";
  const canSeeAdminSupport = isAdminRole(adminRole);

  const selectedTopicHelper = useMemo(() => {
    return SUPPORT_TOPICS.find((item) => item.value === supportTopic)?.helper || "";
  }, [supportTopic]);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      setPageLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
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

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const submitSupportMessage = async ({
    topic,
    message,
    setStatus,
    setError,
    setSubmitting,
  }: {
    topic: SupportTopic;
    message: string;
    setStatus: (value: string) => void;
    setError: (value: string) => void;
    setSubmitting: (value: boolean) => void;
  }) => {
    const cleanMessage = message.trim();

    setStatus("");
    setError("");

    if (!currentUserId) {
      setError("Please sign in before sending a message to Parapost Network support.");
      return false;
    }

    if (cleanMessage.length < 5) {
      setError("Please add a little more detail before sending your message.");
      return false;
    }

    setSubmitting(true);

    const { error } = await supabase.from("support_messages").insert({
      user_id: currentUserId,
      user_email: userEmail || null,
      user_name: displayName,
      topic,
      message: cleanMessage,
      status: "open",
      priority: topic === "privacy_safety" || topic === "data_delete_account" ? "high" : "normal",
      source: "settings",
      page_url: typeof window !== "undefined" ? window.location.href : null,
      metadata: {
        topic_label: getTopicLabel(topic),
        submitted_from: "settings_page",
      },
    });

    setSubmitting(false);

    if (error) {
      setError(`Could not send message: ${error.message}`);
      return false;
    }

    setStatus("Message sent. Parapost Network support will review it.");
    return true;
  };

  const handleSupportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const sent = await submitSupportMessage({
      topic: supportTopic,
      message: supportMessage,
      setStatus: setSupportStatus,
      setError: setSupportError,
      setSubmitting: setSupportSubmitting,
    });

    if (sent) setSupportMessage("");
  };

  const handleDeleteRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fallbackMessage =
      "I would like help with deleting my Parapost Network account and understanding what happens to my profile, posts, Reels, Showcases, messages, comments, and account data.";

    const sent = await submitSupportMessage({
      topic: "data_delete_account",
      message: deleteMessage.trim() || fallbackMessage,
      setStatus: setDeleteStatus,
      setError: setDeleteError,
      setSubmitting: setDeleteSubmitting,
    });

    if (sent) setDeleteMessage("");
  };

  return (
    <main className="h-dvh min-h-dvh overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#05050b] px-4 py-6 pb-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed -right-28 -top-28 h-96 w-96 rounded-full bg-purple-600/25 blur-3xl" />
      <div className="pointer-events-none fixed left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-28 h-96 w-96 rounded-full bg-indigo-500/12 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <BackToPrevious label="← Back to Dashboard" fallbackHref="/dashboard" />

          <span className="rounded-full border border-purple-300/30 bg-purple-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-purple-100 shadow-lg shadow-purple-950/20">
            Settings Center
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[30px] border border-purple-200/15 bg-gradient-to-br from-purple-500/14 via-white/[0.065] to-slate-950/70 p-5 shadow-2xl shadow-purple-950/20 ring-1 ring-white/[0.035] sm:p-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
              Parapost Network Settings
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Control your account, privacy, safety, and support.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Manage your Parapost Network account, privacy, safety, support, personalization, notifications, data requests, legal policies, and coming-soon payment tools from one polished settings center.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#support"
                className="rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/40 transition hover:brightness-110"
              >
                Contact Support
              </a>
              <Link
                href="/settings/privacy-safety"
                className="rounded-full border border-purple-200/20 bg-purple-400/10 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/10 transition hover:bg-purple-400/15"
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

          <aside className="rounded-[30px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035]">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-slate-950 text-2xl font-black ring-1 ring-white/15">
                {currentProfile?.avatar_url ? (
                  <img src={currentProfile.avatar_url} alt="" className="h-full w-full object-cover object-center" />
                ) : (
                  getInitial(currentProfile)
                )}
              </div>

              <div className="min-w-0">
                <div className="truncate text-lg font-black">{pageLoading ? "Loading..." : displayName}</div>
                <div className="truncate text-sm text-slate-400">{userEmail || "Signed out"}</div>
              </div>
            </div>

            {!pageLoading && canSeeAdminSupport ? (
              <Link
                href="/admin/support"
                className="mt-5 block rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm font-bold leading-6 text-emerald-100 no-underline transition hover:bg-emerald-400/15"
              >
                Admin Support Inbox
                <span className="mt-1 block text-xs font-medium text-emerald-100/70">
                  You have {adminRole} access.
                </span>
              </Link>
            ) : null}

            {!pageLoading && !currentUserId ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Sign in is required to send support messages and manage account controls.
              </div>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section id="support" className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">Support</p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">Contact Parapost Network</h2>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                  Active
                </span>
              </div>

              <p className="mb-5 text-sm leading-7 text-slate-300">
                Users will not see a public support email address. Instead, they can send a message here,
                and it saves privately into the Parapost Network support system.
              </p>

              <form onSubmit={handleSupportSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-100">Topic</span>
                  <select
                    value={supportTopic}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setSupportTopic(event.target.value as SupportTopic)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-purple-300/50"
                  >
                    {SUPPORT_TOPICS.map((topic) => (
                      <option key={topic.value} value={topic.value}>
                        {topic.label}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-slate-300">
                  {selectedTopicHelper}
                </p>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-100">Message</span>
                  <textarea
                    value={supportMessage}
                    onChange={(event) => setSupportMessage(event.target.value)}
                    placeholder="Tell us what you need help with..."
                    rows={7}
                    maxLength={5000}
                    className="min-h-[170px] w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-purple-300/50"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-500">{supportMessage.trim().length}/5000</span>
                  <button
                    type="submit"
                    disabled={supportSubmitting}
                    className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {supportSubmitting ? "Sending..." : "Send Message"}
                  </button>
                </div>

                {supportStatus ? (
                  <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                    {supportStatus}
                  </div>
                ) : null}

                {supportError ? (
                  <div className="rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">
                    {supportError}
                  </div>
                ) : null}
              </form>
            </section>

            <section id="delete-account" className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                    Data & Account
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">Delete Account / Data Request</h2>
                </div>
                <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-100">
                  Important
                </span>
              </div>

              <p className="mb-5 text-sm leading-7 text-slate-300">
                This starts the account or data deletion request flow. The full Data & Account request area also lives at{" "}
                <Link href="/settings/data" className="font-black text-purple-200 no-underline hover:text-white">
                  /settings/data
                </Link>
                . This sends a private support request so Parapost Network can review the request safely and clearly.
              </p>

              <form onSubmit={handleDeleteRequestSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-100">Add details, optional</span>
                  <textarea
                    value={deleteMessage}
                    onChange={(event) => setDeleteMessage(event.target.value)}
                    placeholder="Example: I want to delete my account and understand what happens to my posts, Reels, Showcases, comments, and messages."
                    rows={5}
                    maxLength={5000}
                    className="min-h-[140px] w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-purple-300/50"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-500">{deleteMessage.trim().length}/5000</span>
                  <button
                    type="submit"
                    disabled={deleteSubmitting}
                    className="w-full rounded-2xl bg-red-100 px-5 py-3 text-sm font-black text-red-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {deleteSubmitting ? "Sending..." : "Send Delete/Data Request"}
                  </button>
                </div>

                {deleteStatus ? (
                  <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                    {deleteStatus}
                  </div>
                ) : null}

                {deleteError ? (
                  <div className="rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">
                    {deleteError}
                  </div>
                ) : null}
              </form>
            </section>

            <section className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                About Parapost Network
              </p>
              <h2 className="text-2xl font-black tracking-[-0.03em]">Paranormal-friendly, built for everyone.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Parapost Network is a paranormal-friendly social platform built for investigators, creators,
                teams, fans, and everyday users. While the platform has a strong paranormal community identity,
                anyone can use Parapost Network to share posts, photos, videos, Parapost Reels, Showcases,
                messages, events, and connect with others.
              </p>
            </section>
          </div>

          <aside className="space-y-4">
            {canSeeAdminSupport ? (
              <Link href="/admin/support" className="block text-white no-underline">
                <section className="rounded-[26px] border border-emerald-300/20 bg-emerald-400/10 p-5 shadow-xl transition hover:bg-emerald-400/15">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100">
                      Admin
                    </span>
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-100">
                      {adminRole}
                    </span>
                  </div>

                  <h3 className="text-lg font-black tracking-[-0.02em]">Support Inbox</h3>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                    Review support messages, data requests, bug reports, privacy/safety issues, and payment questions.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Open messages", "Admin notes", "Status updates", "Priority control"].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-emerald-300/20 bg-black/25 px-3 py-1.5 text-xs font-bold text-emerald-100"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              </Link>
            ) : null}

            {SETTINGS_CARDS.map((card) => {
              const content = (
                <section
                  className={`rounded-[26px] border border-white/10 bg-white/[0.045] p-5 shadow-xl ${
                    card.active ? "" : "opacity-65"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-200">
                      {card.eyebrow}
                    </span>
                    {!card.active ? (
                      <span className="rounded-full border border-purple-200/15 bg-purple-400/10 px-2.5 py-1 text-[11px] font-black text-slate-300">
                        Coming soon
                      </span>
                    ) : null}
                  </div>

                  <h3 className="text-lg font-black tracking-[-0.02em]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{card.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {card.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-purple-200/15 bg-black/30 px-3 py-1.5 text-xs font-bold text-slate-300"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              );

              if (card.href) {
                return (
                  <Link key={card.title} href={card.href} className="block text-white no-underline">
                    {content}
                  </Link>
                );
              }

              return <div key={card.title}>{content}</div>;
            })}
          </aside>
        </section>
      </div>
    </main>
  );
}
