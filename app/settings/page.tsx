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
    eyebrow: "Phase 1",
    title: "Account",
    description: "Profile access, sign-in details, account status, and deletion requests.",
    items: ["Edit profile", "Email & password", "Account status", "Delete account request"],
    href: "/settings/profile",
    active: true,
  },
  {
    eyebrow: "Phase 1",
    title: "Privacy & Safety",
    description: "Safety tools for blocking, reporting, moderation, and community protection.",
    items: ["Blocked users", "Report content", "Report a user", "Safety center"],
    active: true,
  },
  {
    eyebrow: "Phase 1",
    title: "Data & Privacy",
    description: "Data deletion requests, privacy choices, and account data controls.",
    items: ["Request data deletion", "Privacy choices", "Data policy", "Account deletion"],
    active: true,
  },
  {
    eyebrow: "Phase 1",
    title: "Notifications",
    description: "Prepared controls for friend requests, Parachat, comments, likes, Reels, and badges.",
    items: ["Friend requests", "Parachat", "Comments & likes", "Reels activity"],
    active: true,
  },
  {
    eyebrow: "Phase 2",
    title: "Profile Visibility",
    description: "Public/private profile controls will hide timeline content while keeping the profile shell visible.",
    items: ["Public profile", "Private profile", "Message privacy", "Showcase privacy"],
    active: false,
  },
  {
    eyebrow: "Phase 3",
    title: "Personalization",
    description: "Accent colors, visual preferences, and future profile customization.",
    items: ["Accent color", "Theme preference", "Font choices", "Reduce motion"],
    active: false,
  },
  {
    eyebrow: "Phase 4",
    title: "Payments",
    description: "Future payment area for promoted posts, sponsored content, billing, and business tools.",
    items: ["Payment methods", "Promote a post", "Sponsored posts", "Billing history"],
    active: false,
  },
  {
    eyebrow: "Launch",
    title: "Legal",
    description: "Parapost Network policies for app-store readiness and user trust.",
    items: ["Terms of Service", "Privacy Policy", "Community Guidelines", "Data Deletion Policy"],
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

export default function SettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
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
        setPageLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      setUserEmail(user.email || "");

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      setCurrentProfile((profileData as ProfilePreview | null) || null);
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
    <main className="min-h-screen overflow-hidden bg-[#05050b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed -right-28 -top-28 h-80 w-80 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-28 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard" className="text-sm font-bold text-purple-200 no-underline hover:text-white">
            ← Back to Dashboard
          </Link>

          <span className="rounded-full border border-purple-400/30 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-purple-100">
            Settings Phase 1
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.075] to-purple-900/20 p-5 shadow-2xl sm:p-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
              Parapost Network Settings
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Control your account, privacy, safety, and support.
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Settings is being built as a serious launch-ready area for Parapost Network, with account
              controls, safety tools, data requests, legal policies, support, and future payments prepared
              carefully for mobile apps and web.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#support"
                className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/30"
              >
                Contact Support
              </a>
              <a
                href="#privacy-safety"
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white no-underline hover:bg-white/10"
              >
                Privacy & Safety
              </a>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-white/[0.055] p-5 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-slate-950 text-2xl font-black ring-1 ring-white/15">
                {currentProfile?.avatar_url ? (
                  <img src={currentProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitial(currentProfile)
                )}
              </div>

              <div className="min-w-0">
                <div className="truncate text-lg font-black">{pageLoading ? "Loading..." : displayName}</div>
                <div className="truncate text-sm text-slate-400">{userEmail || "Signed out"}</div>
              </div>
            </div>

            {!pageLoading && !currentUserId ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Sign in is required to send support messages and manage account controls.
              </div>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section id="support" className="rounded-[28px] border border-white/10 bg-white/[0.055] p-5 shadow-2xl sm:p-6">
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
                    className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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

            <section id="delete-account" className="rounded-[28px] border border-white/10 bg-white/[0.055] p-5 shadow-2xl sm:p-6">
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
                This starts the account or data deletion request flow. Later, this can become a fully
                automated deletion process, but for Phase 1 it creates a private support request.
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

            <section className="rounded-[28px] border border-white/10 bg-white/[0.055] p-5 shadow-2xl sm:p-6">
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
            {SETTINGS_CARDS.map((card) => {
              const content = (
                <section
                  id={card.title === "Privacy & Safety" ? "privacy-safety" : undefined}
                  className={`rounded-[26px] border border-white/10 bg-white/[0.045] p-5 shadow-xl ${
                    card.active ? "" : "opacity-65"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-200">
                      {card.eyebrow}
                    </span>
                    {!card.active ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-black text-slate-300">
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
                        className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-bold text-slate-300"
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
