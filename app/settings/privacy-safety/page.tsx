"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SafetyTopic = "privacy_safety" | "report_problem";

type ProfilePreview = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_private: boolean | null;
};

type AdminUserRow = {
  user_id: string;
  role: string;
};

const safetyTopics: Array<{ value: SafetyTopic; label: string; helper: string }> = [
  {
    value: "privacy_safety",
    label: "Privacy or Safety Concern",
    helper:
      "Use this for harassment, unwanted contact, privacy issues, blocked-user questions, or safety concerns.",
  },
  {
    value: "report_problem",
    label: "Report Content or User",
    helper:
      "Use this when something on Parapost Network should be reviewed by support or moderation.",
  },
];

const safetyCards = [
  {
    eyebrow: "Active",
    title: "Contact Safety Support",
    description:
      "Send privacy, safety, blocking, reporting, or moderation concerns directly to Parapost Network support.",
    items: ["Private support request", "Saved to admin inbox", "No public support email", "Reviewed internally"],
    active: true,
  },
  {
    eyebrow: "Active",
    title: "Private Profile Control",
    description:
      "Control whether non-friends can see your profile content while your basic profile shell remains visible.",
    items: ["Public profile", "Private profile", "Owner access", "Friend-only content"],
    href: "/settings/profile",
    active: true,
  },
  {
    eyebrow: "Coming soon",
    title: "Blocked Users",
    description:
      "A dedicated blocked-user management screen will let users review and manage blocked accounts.",
    items: ["Block user", "Unblock user", "Blocked list", "Reduced unwanted contact"],
    active: false,
  },
  {
    eyebrow: "Coming soon",
    title: "Report Center",
    description:
      "A dedicated reporting flow will support profile, post, comment, Reel, message, and Showcase reports.",
    items: ["Report profile", "Report post", "Report Reel", "Report message"],
    active: false,
  },
  {
    eyebrow: "Launch",
    title: "Community Guidelines",
    description:
      "Clear rules help protect the community and explain what content or behavior is not allowed.",
    items: ["Respectful behavior", "No harassment", "No spam", "Moderation review"],
    href: "/settings/legal",
    active: false,
  },
  {
    eyebrow: "Launch",
    title: "Data & Account Safety",
    description:
      "Users need clear ways to request data help, privacy support, account deletion, or account safety review.",
    items: ["Data request", "Delete account", "Privacy help", "Support record"],
    href: "/settings/data",
    active: false,
  },
];

function getInitial(profile: ProfilePreview | null) {
  const value = profile?.full_name || profile?.username || "P";
  return value.charAt(0).toUpperCase();
}

function getDisplayName(profile: ProfilePreview | null) {
  return profile?.full_name || profile?.username || "Parapost Member";
}

function isAdminRole(role: string) {
  return ["owner", "admin", "support", "moderator"].includes(role);
}

function getTopicLabel(topic: SafetyTopic) {
  return safetyTopics.find((item) => item.value === topic)?.label || "Privacy or Safety Concern";
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

export default function PrivacySafetySettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const [topic, setTopic] = useState<SafetyTopic>("privacy_safety");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canSeeAdminSupport = isAdminRole(adminRole);

  const selectedTopicHelper = useMemo(() => {
    return safetyTopics.find((item) => item.value === topic)?.helper || "";
  }, [topic]);

  useEffect(() => {
    let cancelled = false;

    async function loadPageUser() {
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
          .select("id, username, full_name, avatar_url, is_private")
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

  const handleSafetySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanMessage = message.trim();

    setSuccessMessage("");
    setErrorMessage("");

    if (!currentUserId) {
      setErrorMessage("Please sign in before sending a privacy or safety message.");
      return;
    }

    if (cleanMessage.length < 10) {
      setErrorMessage("Please add a little more detail so support can understand the issue.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("support_messages").insert({
      user_id: currentUserId,
      user_email: userEmail || null,
      user_name: getDisplayName(currentProfile),
      topic,
      message: cleanMessage,
      status: "open",
      priority: topic === "privacy_safety" ? "high" : "normal",
      source: "privacy_safety_settings",
      page_url: typeof window !== "undefined" ? window.location.href : null,
      metadata: {
        topic_label: getTopicLabel(topic),
        submitted_from: "settings_privacy_safety_page",
      },
    });

    setSubmitting(false);

    if (error) {
      setErrorMessage(`Could not send message: ${error.message}`);
      return;
    }

    setSuccessMessage("Message sent. Parapost Network support will review it.");
    setMessage("");
  };

  return (
    <main className="h-dvh min-h-dvh overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#05050b] px-4 py-6 pb-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed -right-28 -top-28 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-28 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <BackToPrevious label="← Back to Settings" fallbackHref="/settings" />

            <Link href="/dashboard" className="text-sm font-bold text-slate-300 no-underline hover:text-white">
              Dashboard
            </Link>
          </div>

          <span className="rounded-full border border-purple-400/30 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-purple-100">
            Settings Phase 2.2
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="rounded-[30px] border border-purple-200/15 bg-gradient-to-br from-white/[0.075] via-purple-900/20 to-slate-950/60 p-5 shadow-2xl sm:p-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
              Privacy & Safety
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Protect your profile, privacy, and community experience.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              This area gives Parapost Network users clear safety paths for privacy concerns, reports,
              private-profile controls, blocked-user management, community guidelines, and support review.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#safety-contact"
                className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/30"
              >
                Send Safety Message
              </a>

              <Link
                href="/settings/profile"
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white no-underline hover:bg-white/10"
              >
                Profile Privacy
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

          <aside className="rounded-[30px] border border-purple-200/15 bg-white/[0.055] p-5 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-slate-950 text-2xl font-black ring-1 ring-white/15">
                {currentProfile?.avatar_url ? (
                  <img src={currentProfile.avatar_url} alt="" className="h-full w-full object-cover object-center" />
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-purple-200">
                Profile Visibility
              </div>
              <div className="mt-2 text-2xl font-black">
                {pageLoading ? "Checking..." : currentProfile?.is_private ? "Private" : "Public"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Manage this from Profile Settings. Private profiles can hide timeline content from non-friends.
              </p>
            </div>

            {!pageLoading && !currentUserId ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Sign in is required to send support messages and manage privacy controls.
              </div>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section id="safety-contact" className="rounded-[28px] border border-purple-200/15 bg-white/[0.055] p-5 shadow-2xl sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                    Support & Reporting
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">Send a privacy or safety message</h2>
                </div>

                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                  Active
                </span>
              </div>

              <p className="mb-5 text-sm leading-7 text-slate-300">
                Use this form for privacy concerns, safety issues, harassment, unwanted contact, reporting content,
                reporting users, or anything that should be reviewed by Parapost Network support.
              </p>

              <form onSubmit={handleSafetySubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-100">Issue Type</span>
                  <select
                    value={topic}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setTopic(event.target.value as SafetyTopic)
                    }
                    className="w-full rounded-2xl border border-purple-200/15 bg-black/35 px-4 py-3 text-white outline-none focus:border-purple-300/50"
                  >
                    {safetyTopics.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="rounded-2xl border border-purple-200/15 bg-white/[0.035] px-4 py-3 text-sm text-slate-300">
                  {selectedTopicHelper}
                </p>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-100">Message</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe the privacy or safety issue..."
                    rows={7}
                    maxLength={5000}
                    className="min-h-[170px] w-full resize-y rounded-2xl border border-purple-200/15 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-purple-300/50"
                  />
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-500">{message.trim().length}/5000</span>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {submitting ? "Sending..." : "Send to Support"}
                  </button>
                </div>

                {successMessage ? (
                  <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                    {successMessage}
                  </div>
                ) : null}

                {errorMessage ? (
                  <div className="rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">
                    {errorMessage}
                  </div>
                ) : null}
              </form>
            </section>

            <section className="rounded-[28px] border border-purple-200/15 bg-white/[0.055] p-5 shadow-2xl sm:p-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                Safety Center
              </p>
              <h2 className="text-2xl font-black tracking-[-0.03em]">Built for user trust and app-store review.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Parapost Network should give users clear ways to control privacy, contact support, report issues,
                request account/data help, and understand community rules. These settings are being built in phases
                so the platform is safer before public launch.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  "Private profile controls",
                  "Support inbox records",
                  "Report and moderation path",
                  "Blocked users area",
                  "Data deletion support",
                  "Community guidelines",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-purple-200/15 bg-black/25 px-4 py-3 text-sm font-bold text-slate-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {safetyCards.map((card) => {
              const content = (
                <section
                  className={`rounded-[26px] border border-purple-200/15 bg-white/[0.045] p-5 shadow-xl ${
                    card.active ? "" : "opacity-70"
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
                        className="rounded-full border border-purple-200/15 bg-black/25 px-3 py-1.5 text-xs font-bold text-slate-300"
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
