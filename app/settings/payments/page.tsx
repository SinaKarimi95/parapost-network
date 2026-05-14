"use client";

import { useEffect, useState } from "react";
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

const paymentAreas = [
  {
    title: "Promoted Posts",
    status: "Coming soon",
    description:
      "Future tools for boosting selected posts so creators, teams, and businesses can reach more people on Parapost Network.",
    items: ["Boosted reach", "Campaign controls", "Post review", "Performance tracking"],
  },
  {
    title: "Sponsored Posts",
    status: "Coming soon",
    description:
      "Future sponsored placements that can appear naturally inside the dashboard timeline and other approved areas.",
    items: ["Timeline placement", "Sponsor labels", "Approval flow", "Audience controls"],
  },
  {
    title: "Business & Creator Tools",
    status: "Planned",
    description:
      "Future business-ready tools for creators, paranormal teams, brands, sponsors, and event organizers.",
    items: ["Creator packages", "Sponsor options", "Event promotion", "Business profiles"],
  },
  {
    title: "Billing History",
    status: "Coming soon",
    description:
      "A future area where users can review invoices, receipts, payments, and promotion history.",
    items: ["Receipts", "Invoices", "Payment status", "Refund support"],
  },
];

const safetyNotes = [
  "No payments are being collected from this page yet.",
  "Future payment tools should be tested carefully before launch.",
  "Promoted content should always be clearly labeled.",
  "Billing, refunds, and sponsor support should connect to Parapost support.",
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

export default function PaymentsSettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const canSeeAdminSupport = isAdminRole(adminRole);

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
            Settings Phase 5
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
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
              Payments
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Payments, promotions, and sponsor tools.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              This page prepares the future payment area for Parapost Network. Payments are not live yet,
              but this gives users a clear place for promoted posts, sponsored content, billing history,
              business tools, and support once payments are ready.
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
                Coming Soon
              </span>

              <Link
                href="/settings"
                className="rounded-full border px-5 py-3 text-sm font-black text-white no-underline shadow-lg transition hover:bg-white/10"
                style={{ borderColor: "var(--parapost-accent-border)", background: "rgba(255,255,255,0.055)" }}
              >
                Back to Settings
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
                Payment Status
              </div>
              <div className="mt-2 text-2xl font-black">Not live yet</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Users cannot be charged from this page. Future payment tools should be tested before public release.
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
                    Future Payment Areas
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">Prepared, but not charging users.</h2>
                </div>

                <span
                  className="rounded-full border px-3 py-1.5 text-xs font-black"
                  style={{
                    borderColor: "var(--parapost-accent-border)",
                    background: "var(--parapost-accent-muted-bg)",
                    color: "var(--parapost-accent-readable-text)",
                  }}
                >
                  Safe placeholder
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {paymentAreas.map((area) => (
                  <article key={area.title} className="rounded-[24px] border border-white/10 bg-black/25 p-4">
                    <span
                      className="rounded-full border px-2.5 py-1 text-[11px] font-black"
                      style={{
                        borderColor: "var(--parapost-accent-border)",
                        background: "var(--parapost-accent-muted-bg)",
                        color: "var(--parapost-accent-readable-text)",
                      }}
                    >
                      {area.status}
                    </span>

                    <h3 className="mt-4 text-lg font-black tracking-[-0.02em]">{area.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{area.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {area.items.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-bold text-slate-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-300/20 bg-amber-400/10 p-5 shadow-2xl shadow-amber-950/10 sm:p-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-100">
                Payment Safety
              </p>
              <h2 className="text-2xl font-black tracking-[-0.03em] text-white">
                Payments should stay controlled before launch.
              </h2>

              <div className="mt-5 grid gap-3">
                {safetyNotes.map((note) => (
                  <div key={note} className="rounded-2xl border border-amber-200/20 bg-black/20 p-4 text-sm font-bold leading-6 text-amber-50/85">
                    {note}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <Link href="/settings/account" className="block text-white no-underline">
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
                    Connected
                  </span>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-black text-slate-300"
                    style={{ borderColor: "var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)" }}
                  >
                    Open
                  </span>
                </div>

                <h3 className="text-lg font-black tracking-[-0.02em]">Account & Security</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Review account status, reset password, sign out, and open deletion/data request controls.
                </p>
              </section>
            </Link>

            <Link href="/settings/data" className="block text-white no-underline">
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

                <h3 className="text-lg font-black tracking-[-0.02em]">Data & Account</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Request data help, account deletion, data deletion, correction, or access support.
                </p>
              </section>
            </Link>

            <Link href="/settings" className="block text-white no-underline">
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
                    Settings
                  </span>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-black text-slate-300"
                    style={{ borderColor: "var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)" }}
                  >
                    Back
                  </span>
                </div>

                <h3 className="text-lg font-black tracking-[-0.02em]">Settings Center</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Return to the full Parapost Network Settings area.
                </p>
              </section>
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
