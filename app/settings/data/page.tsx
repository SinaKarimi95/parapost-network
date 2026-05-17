"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type RequestType =
  | "data_access"
  | "data_correction"
  | "data_delete"
  | "account_delete"
  | "privacy_question";

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

const requestTypes: Array<{
  value: RequestType;
  label: string;
  helper: string;
  priority: "normal" | "high";
}> = [
  {
    value: "data_access",
    label: "Request My Data",
    helper:
      "Ask Parapost Network for help accessing or understanding the account data connected to your profile.",
    priority: "normal",
  },
  {
    value: "data_correction",
    label: "Correct My Data",
    helper:
      "Ask for help correcting profile, account, or platform data that may be inaccurate.",
    priority: "normal",
  },
  {
    value: "data_delete",
    label: "Delete Some of My Data",
    helper:
      "Ask for help deleting specific account data such as posts, comments, Reels, Showcases, or related profile data.",
    priority: "high",
  },
  {
    value: "account_delete",
    label: "Delete My Account",
    helper:
      "Start a delete-account support request and ask what happens to your profile, posts, Reels, Showcases, comments, messages, and account data.",
    priority: "high",
  },
  {
    value: "privacy_question",
    label: "Privacy Question",
    helper:
      "Ask a privacy-related question about your account, profile visibility, data, or Parapost Network policies.",
    priority: "normal",
  },
];

const accountDataCards = [
  {
    eyebrow: "Active",
    title: "Data / Account Request",
    description:
      "Send data access, correction, deletion, privacy, or account deletion requests directly to Parapost Network support.",
    items: ["Private support record", "Admin review", "No public email shown", "Clear request path"],
    active: true,
  },
  {
    eyebrow: "Privacy",
    title: "Profile Visibility",
    description:
      "Control whether your profile content is public or private while keeping your basic profile shell visible.",
    items: ["Public profile", "Private profile", "Friend-only access", "Profile shell visible"],
    href: "/settings/profile-visibility",
    active: true,
  },
  {
    eyebrow: "Account",
    title: "Account Deletion",
    description:
      "Start a careful account deletion request so support can review the request, confirm details, and explain what happens next.",
    items: ["Confirm request", "Review account data", "Support follow-up", "Final confirmation"],
    active: true,
  },
  {
    eyebrow: "Data",
    title: "Data Access & Correction",
    description:
      "Request help accessing, understanding, correcting, or deleting account-related data connected to your profile.",
    items: ["Profile data", "Posts", "Reels", "Comments"],
    active: true,
  },
  {
    eyebrow: "Policy",
    title: "Data Deletion Policy",
    description:
      "Review how deletion requests, retained records, safety exceptions, and support follow-up should be handled.",
    items: ["Deletion timing", "Retained records", "Policy review", "User confirmation"],
    href: "/settings/legal",
    active: true,
  },
  {
    eyebrow: "Safety",
    title: "Privacy & Safety",
    description:
      "Privacy controls, report tools, blocked-user management, and community safety settings support user trust.",
    items: ["Safety support", "Report concern", "Blocked users", "Community protection"],
    href: "/settings/privacy-safety",
    active: true,
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

function getRequestLabel(value: RequestType) {
  return requestTypes.find((item) => item.value === value)?.label || "Data / Account Request";
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

export default function DataAccountSettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const [requestType, setRequestType] = useState<RequestType>("data_access");
  const [message, setMessage] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canSeeAdminSupport = isAdminRole(adminRole);

  const selectedRequest = useMemo(() => {
    return requestTypes.find((item) => item.value === requestType) || requestTypes[0];
  }, [requestType]);

  const isHighImpactRequest = requestType === "account_delete" || requestType === "data_delete";

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

  const handleSubmitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanMessage = message.trim();

    setSuccessMessage("");
    setErrorMessage("");

    if (!currentUserId) {
      setErrorMessage("Please sign in before sending a data or account request.");
      return;
    }

    if (cleanMessage.length < 10) {
      setErrorMessage("Please add a little more detail before sending this request.");
      return;
    }

    if (isHighImpactRequest && !acknowledged) {
      setErrorMessage("Please confirm that you understand this request may require support review and follow-up.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("support_messages").insert({
      user_id: currentUserId,
      user_email: userEmail || null,
      user_name: getDisplayName(currentProfile),
      topic: "data_delete_account",
      message: cleanMessage,
      status: "open",
      priority: selectedRequest.priority,
      source: "data_account_settings",
      page_url: typeof window !== "undefined" ? window.location.href : null,
      metadata: {
        request_type: requestType,
        request_label: getRequestLabel(requestType),
        high_impact_request: isHighImpactRequest,
        user_acknowledged_review: acknowledged,
        submitted_from: "settings_data_account_page",
      },
    });

    setSubmitting(false);

    if (error) {
      setErrorMessage(`Could not send request: ${error.message}`);
      return;
    }

    setSuccessMessage("Request sent. Parapost Network support will review it.");
    setMessage("");
    setAcknowledged(false);
  };

  return (
    <main className="h-dvh min-h-dvh overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#05050b] px-4 py-6 pb-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed -right-28 -top-28 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-28 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <BackToPrevious label="← Back to Settings" fallbackHref="/settings" />

            <Link href="/dashboard" className="text-sm font-bold text-slate-300 no-underline hover:text-white">
              Dashboard
            </Link>
          </div>

          <span className="rounded-full border border-purple-400/30 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-purple-100">
            Data & Account
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="rounded-[30px] border border-purple-200/15 bg-gradient-to-br from-white/[0.075] via-purple-900/20 to-slate-950/60 p-5 shadow-2xl sm:p-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
              Data & Account
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Manage data requests, privacy support, and account deletion.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Parapost Network gives users clear, trustworthy paths for account help, data access, data correction,
              data deletion, privacy questions, and account deletion requests.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#data-request"
                className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/30"
              >
                Start Request
              </a>

              <Link
                href="/settings/privacy-safety"
                className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white no-underline hover:bg-white/10"
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
                Account Status
              </div>
              <div className="mt-2 text-2xl font-black">
                {pageLoading ? "Checking..." : currentUserId ? "Signed In" : "Signed Out"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Data and deletion requests should be sent from the signed-in account whenever possible.
              </p>
            </div>

            {!pageLoading && !currentUserId ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Sign in is required to send account-specific data or deletion requests.
              </div>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section id="data-request" className="rounded-[28px] border border-purple-200/15 bg-white/[0.055] p-5 shadow-2xl sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                    Request Form
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">
                    Send a data or account request
                  </h2>
                </div>

                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                  Active
                </span>
              </div>

              <p className="mb-5 text-sm leading-7 text-slate-300">
                Use this form for data access, data correction, data deletion, account deletion, or privacy-related
                account questions. The request is saved privately to the Parapost Network admin support inbox.
              </p>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-100">Request Type</span>
                  <select
                    value={requestType}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setRequestType(event.target.value as RequestType)
                    }
                    className="w-full rounded-2xl border border-purple-200/15 bg-black/35 px-4 py-3 text-white outline-none focus:border-purple-300/50"
                  >
                    {requestTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="rounded-2xl border border-purple-200/15 bg-white/[0.035] px-4 py-3 text-sm text-slate-300">
                  {selectedRequest.helper}
                </p>

                {isHighImpactRequest ? (
                  <label className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(event) => setAcknowledged(event.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      I understand this request may require support review, confirmation, and follow-up before
                      account data or account access is changed.
                    </span>
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-100">Request Details</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe what you need help with..."
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
                    {submitting ? "Sending..." : "Send Request"}
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
                What happens next
              </p>
              <h2 className="text-2xl font-black tracking-[-0.03em]">Requests are reviewed before action.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Data and account requests create private support records so Parapost Network can review important requests carefully.
                Account deletion and data deletion should include confirmation, clear policy wording, and careful handling before action is taken.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  "Request is saved privately",
                  "Support/admin can review it",
                  "High-impact requests are flagged",
                  "User can provide extra details",
                  "No public support email shown",
                  "Clear review process",
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
            {accountDataCards.map((card) => {
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
