"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

const visibilityCards = [
  {
    eyebrow: "Visibility",
    title: "Public Profile",
    description:
      "People can visit your profile and view your available profile content based on your privacy settings.",
    items: ["Profile shell visible", "Timeline visible", "Reels visible", "Friends page available"],
  },
  {
    eyebrow: "Privacy",
    title: "Private Profile",
    description:
      "Your profile identity stays visible, but your timeline, Reels, Friends page, and protected content stay limited to you and approved connections.",
    items: ["Timeline hidden", "Reels protected", "Friends protected", "Private message shown"],
  },
  {
    eyebrow: "Access",
    title: "Protected Content",
    description:
      "Private profile protection helps keep direct profile sections from being viewed by people who should not have access.",
    items: ["Profile content", "Reels grid", "Direct Reel viewer", "Friends page"],
  },
  {
    eyebrow: "Control",
    title: "More Privacy Controls",
    description:
      "Parapost Network can expand this area with post-level, Reel-level, Showcase, message, and friend-list privacy controls as the platform grows.",
    items: ["Post privacy", "Reel privacy", "Showcase privacy", "Message privacy"],
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

export default function ProfileVisibilitySettingsPage() {
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canSeeAdminSupport = isAdminRole(adminRole);

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
        setCurrentUserId("");
        setUserEmail("");
        setCurrentProfile(null);
        setAdminRole("");
        setIsPrivate(false);
        setPageLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      setUserEmail(user.email || "");

      const [{ data: profileData, error: profileError }, { data: adminData }] = await Promise.all([
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

      if (profileError) {
        setErrorMessage(`Could not load profile visibility: ${profileError.message}`);
        setPageLoading(false);
        return;
      }

      const profile = (profileData as ProfilePreview | null) || null;
      setCurrentProfile(profile);
      setIsPrivate(Boolean(profile?.is_private));

      const adminRow = adminData as AdminUserRow | null;
      setAdminRole(adminRow?.role && isAdminRole(adminRow.role) ? adminRow.role : "");

      setPageLoading(false);
    }

    void loadPageUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveVisibility = async () => {
    setStatusMessage("");
    setErrorMessage("");

    if (!currentUserId) {
      setErrorMessage("Please sign in before changing profile visibility.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        is_private: isPrivate,
      })
      .eq("id", currentUserId);

    setSaving(false);

    if (error) {
      setErrorMessage(`Could not update profile visibility: ${error.message}`);
      return;
    }

    setCurrentProfile((prev) => (prev ? { ...prev, is_private: isPrivate } : prev));
    setStatusMessage(isPrivate ? "Your profile is now private." : "Your profile is now public.");
  };

  return (
    <main className="h-dvh min-h-dvh overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#05050b] px-4 py-6 pb-28 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed -right-28 -top-28 h-96 w-96 rounded-full bg-purple-600/25 blur-3xl" />
      <div className="pointer-events-none fixed left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-28 h-96 w-96 rounded-full bg-indigo-500/12 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <BackToPrevious label="← Back to Settings" fallbackHref="/settings" />

            <Link href="/dashboard" className="text-sm font-bold text-slate-300 no-underline hover:text-white">
              Dashboard
            </Link>
          </div>

          <span className="rounded-full border border-purple-300/30 bg-purple-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-purple-100 shadow-lg shadow-purple-950/20">
            Privacy Control
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="rounded-[30px] border border-purple-200/15 bg-gradient-to-br from-purple-500/14 via-white/[0.065] to-slate-950/70 p-5 shadow-2xl shadow-purple-950/20 ring-1 ring-white/[0.035] sm:p-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
              Profile Visibility
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Choose who can see your profile content.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Public profiles show available profile content normally. Private profiles keep your basic profile shell visible,
              while protecting timeline content, Reels, Friends, and other private sections from non-friends.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#visibility-control"
                className="rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/40 transition hover:brightness-110"
              >
                Change Visibility
              </a>

              {currentProfile?.id ? (
                <Link
                  href={`/profile/${currentProfile.id}`}
                  className="rounded-full border border-purple-200/20 bg-purple-400/10 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/10 transition hover:bg-purple-400/15"
                >
                  View Profile
                </Link>
              ) : null}

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
                <div className="truncate text-lg font-black">
                  {pageLoading ? "Loading..." : getDisplayName(currentProfile)}
                </div>
                <div className="truncate text-sm text-slate-400">{userEmail || "Signed out"}</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-purple-200/15 bg-black/30 p-4 shadow-inner shadow-purple-950/10">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-purple-200">
                Current Visibility
              </div>
              <div className="mt-2 text-2xl font-black">
                {pageLoading ? "Checking..." : isPrivate ? "Private" : "Public"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                This setting updates your profile visibility after saving.
              </p>
            </div>

            {!pageLoading && !currentUserId ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Sign in is required to manage profile visibility.
              </div>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section
              id="visibility-control"
              className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                    Public / Private
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">
                    Profile visibility control
                  </h2>
                </div>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                    isPrivate
                      ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
                      : "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                  }`}
                >
                  {isPrivate ? "Private" : "Public"}
                </span>
              </div>

              <div className="rounded-[24px] border border-purple-200/15 bg-black/25 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-base font-black text-white">Private Profile</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      When this is on, non-friends can still see your basic profile shell, but your protected
                      content stays limited to you and approved connections.
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-pressed={isPrivate}
                    onClick={() => {
                      setIsPrivate((prev) => !prev);
                      setStatusMessage("");
                      setErrorMessage("");
                    }}
                    className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border transition ${
                      isPrivate
                        ? "border-purple-300/40 bg-gradient-to-r from-violet-500 to-fuchsia-500"
                        : "border-white/10 bg-white/15"
                    }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition ${
                        isPrivate ? "translate-x-8" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-purple-200/15 bg-purple-400/[0.045] p-4 text-sm leading-6 text-slate-300">
                  Selected setting:{" "}
                  <span className="font-black text-white">{isPrivate ? "Private" : "Public"}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500">
                  Save after changing the toggle.
                </span>

                <button
                  type="button"
                  onClick={handleSaveVisibility}
                  disabled={saving || pageLoading}
                  className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {saving ? "Saving..." : "Save Visibility"}
                </button>
              </div>

              {statusMessage ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
                  {statusMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="mt-4 rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">
                  {errorMessage}
                </div>
              ) : null}
            </section>

            <section className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                What private protects
              </p>
              <h2 className="text-2xl font-black tracking-[-0.03em]">
                Private profiles still show a basic profile shell.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                This keeps Parapost Network social and discoverable while protecting personal content. Non-friends
                see the profile identity area and a private message instead of timeline, Reels, Friends, and other
                protected sections.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  "Profile shell remains visible",
                  "Timeline content hidden",
                  "Reels routes protected",
                  "Friends route protected",
                  "Owner still sees everything",
                  "Accepted friends can view content",
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
            {visibilityCards.map((card) => (
              <section
                key={card.title}
                className="rounded-[26px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.045] to-slate-950/55 p-5 shadow-xl shadow-purple-950/10"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-200">
                    {card.eyebrow}
                  </span>
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
            ))}
          </aside>
        </section>
      </div>
    </main>
  );
}
