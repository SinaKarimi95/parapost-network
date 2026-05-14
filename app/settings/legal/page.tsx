"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

const legalSections = [
  {
    eyebrow: "Launch Draft",
    title: "Terms of Service",
    description:
      "The Terms of Service should explain account rules, acceptable use, user content, platform rights, restrictions, suspensions, and account termination.",
    items: [
      "Account eligibility",
      "User content",
      "Acceptable use",
      "Platform rules",
      "Account termination",
      "Service changes",
    ],
  },
  {
    eyebrow: "Launch Draft",
    title: "Privacy Policy",
    description:
      "The Privacy Policy should explain what data Parapost Network collects, how it is used, how users can contact support, and how privacy/data requests are handled.",
    items: [
      "Account data",
      "Profile data",
      "Posts and media",
      "Support messages",
      "Analytics and safety",
      "Data requests",
    ],
  },
  {
    eyebrow: "Launch Draft",
    title: "Community Guidelines",
    description:
      "Community Guidelines should help users understand what behavior and content is not allowed, how reporting works, and how moderation decisions may happen.",
    items: [
      "Respectful community",
      "No harassment",
      "No spam/scams",
      "No harmful abuse",
      "Reporting",
      "Moderation review",
    ],
  },
  {
    eyebrow: "Launch Draft",
    title: "Data Deletion Policy",
    description:
      "The Data Deletion Policy should explain how users can request deletion, what may be deleted, what may be retained for legal/safety reasons, and how support follows up.",
    items: [
      "Delete account request",
      "Delete data request",
      "Review period",
      "Support follow-up",
      "Safety records",
      "Confirmation process",
    ],
  },
];

const trustCards = [
  {
    title: "No public support email shown",
    description:
      "Users contact Parapost Network through in-app support forms, and messages are saved privately to the admin support inbox.",
    href: "/settings",
  },
  {
    title: "Privacy & Safety support",
    description:
      "Privacy concerns, reports, safety issues, and moderation concerns can be submitted through the Privacy & Safety page.",
    href: "/settings/privacy-safety",
  },
  {
    title: "Data and account requests",
    description:
      "Users can submit data access, correction, deletion, account deletion, and privacy questions through Data & Account.",
    href: "/settings/data",
  },
  {
    title: "Private profile controls",
    description:
      "Users can control whether their profile content is public or private through Profile Settings.",
    href: "/settings/profile",
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

export default function LegalSettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(
    null
  );
  const [userEmail, setUserEmail] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const canSeeAdminSupport = isAdminRole(adminRole);

  useEffect(() => {
    let cancelled = false;

    async function loadPageUser() {
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
      setAdminRole(
        adminRow?.role && isAdminRole(adminRow.role) ? adminRow.role : ""
      );

      setPageLoading(false);
    }

    void loadPageUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#05050b] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed -right-28 -top-28 h-96 w-96 rounded-full bg-purple-600/25 blur-3xl" />
      <div className="pointer-events-none fixed left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-28 h-96 w-96 rounded-full bg-indigo-500/12 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/settings"
              className="text-sm font-bold text-purple-200 no-underline hover:text-white"
            >
              ← Back to Settings
            </Link>

            <Link
              href="/dashboard"
              className="text-sm font-bold text-slate-300 no-underline hover:text-white"
            >
              Dashboard
            </Link>
          </div>

          <span className="rounded-full border border-purple-300/30 bg-purple-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-purple-100 shadow-lg shadow-purple-950/20">
            Settings Phase 2.4
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="rounded-[30px] border border-purple-200/15 bg-gradient-to-br from-purple-500/14 via-white/[0.065] to-slate-950/70 p-5 shadow-2xl shadow-purple-950/20 ring-1 ring-white/[0.035] sm:p-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
              Legal & Policies
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Prepare Parapost Network for trust, safety, and app launch.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              This page organizes the legal and policy areas Parapost Network
              needs before public launch: Terms of Service, Privacy Policy,
              Community Guidelines, and Data Deletion Policy. These are
              launch-prep sections and should be reviewed before final public
              release.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#policy-drafts"
                className="rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/40 transition hover:brightness-110"
              >
                View Policy Areas
              </a>

              <Link
                href="/settings/data"
                className="rounded-full border border-purple-200/20 bg-purple-400/10 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/10 transition hover:bg-purple-400/15"
              >
                Data Requests
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
                  <img
                    src={currentProfile.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitial(currentProfile)
                )}
              </div>

              <div className="min-w-0">
                <div className="truncate text-lg font-black">
                  {pageLoading ? "Loading..." : getDisplayName(currentProfile)}
                </div>
                <div className="truncate text-sm text-slate-400">
                  {userEmail || "Signed out"}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-purple-200/15 bg-black/30 p-4 shadow-inner shadow-purple-950/10">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-purple-200">
                Launch Note
              </div>
              <div className="mt-2 text-2xl font-black">Draft Area</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                These are structured launch-policy sections, not final legal
                approval. Final public wording should be reviewed before
                release.
              </p>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section
              id="policy-drafts"
              className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                    Policy Areas
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">
                    Launch policy checklist
                  </h2>
                </div>

                <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-100">
                  Draft
                </span>
              </div>

              <div className="grid gap-4">
                {legalSections.map((section) => (
                  <article
                    key={section.title}
                    className="rounded-[26px] border border-purple-200/15 bg-black/25 p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-200">
                        {section.eyebrow}
                      </span>
                      <span className="rounded-full border border-purple-200/15 bg-purple-400/10 px-2.5 py-1 text-[11px] font-black text-slate-300">
                        Needs final review
                      </span>
                    </div>

                    <h3 className="text-xl font-black tracking-[-0.02em]">
                      {section.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">
                      {section.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {section.items.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-purple-200/15 bg-black/30 px-3 py-1.5 text-xs font-bold text-slate-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                App Store Readiness
              </p>
              <h2 className="text-2xl font-black tracking-[-0.03em]">
                Clear user controls matter.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                For Google Play and the iOS App Store, Parapost Network should
                clearly show where users can contact support, report concerns,
                manage privacy, request account/data deletion, and review
                platform rules. This page keeps those areas organized while the
                final policy wording is prepared.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  "Support contact flow",
                  "Privacy and safety reporting",
                  "Account deletion request",
                  "Data deletion request",
                  "Community rules",
                  "Policy review before launch",
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
            {trustCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="block text-white no-underline"
              >
                <section className="rounded-[26px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.045] to-slate-950/55 p-5 shadow-xl shadow-purple-950/10 transition hover:bg-purple-400/10">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-200">
                      Connected
                    </span>
                    <span className="rounded-full border border-purple-200/15 bg-purple-400/10 px-2.5 py-1 text-[11px] font-black text-slate-300">
                      Open
                    </span>
                  </div>

                  <h3 className="text-lg font-black tracking-[-0.02em]">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {card.description}
                  </p>
                </section>
              </Link>
            ))}
          </aside>
        </section>
      </div>
    </main>
  );
}