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

type UserPreferenceRow = {
  user_id: string;
  accent_color: string | null;
  font_style: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AccentOption = {
  id: string;
  name: string;
  description: string;
  gradient: string;
  ring: string;
};

type FontOption = {
  id: string;
  name: string;
  description: string;
  sampleClass: string;
};

const DEFAULT_ACCENT = "parapost-purple";
const DEFAULT_FONT = "parapost-default";

const accentOptions: AccentOption[] = [
  {
    id: "parapost-purple",
    name: "Parapost Purple",
    description: "Default Parapost Network purple and black identity.",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    ring: "border-purple-300/35",
  },
  {
    id: "mystic-blue",
    name: "Mystic Blue",
    description: "Cool blue highlights for a clean social look.",
    gradient: "from-blue-500 via-indigo-500 to-cyan-400",
    ring: "border-blue-300/35",
  },
  {
    id: "creator-pink",
    name: "Creator Pink",
    description: "Bright creator-style highlights for profile accents.",
    gradient: "from-pink-500 via-fuchsia-500 to-purple-500",
    ring: "border-pink-300/35",
  },
  {
    id: "night-green",
    name: "Night Green",
    description: "Soft green highlights for active states and badges.",
    gradient: "from-emerald-500 via-teal-500 to-lime-400",
    ring: "border-emerald-300/35",
  },
  {
    id: "ember-gold",
    name: "Ember Gold",
    description: "Warm gold highlights for a premium creator feel.",
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    ring: "border-amber-300/35",
  },
  {
    id: "ghost-white",
    name: "Ghost White",
    description: "Minimal light-glow accents over the dark Parapost base.",
    gradient: "from-slate-100 via-white to-purple-200",
    ring: "border-white/35",
  },
];

const fontOptions: FontOption[] = [
  {
    id: "parapost-default",
    name: "Parapost Default",
    description: "Clean default UI font for the platform.",
    sampleClass: "font-sans",
  },
  {
    id: "clean-modern",
    name: "Clean Modern",
    description: "Modern, simple, and easy to read.",
    sampleClass: "font-sans tracking-tight",
  },
  {
    id: "rounded",
    name: "Rounded",
    description: "Friendly rounded social feel.",
    sampleClass: "font-sans",
  },
  {
    id: "bold-creator",
    name: "Bold Creator",
    description: "Stronger profile and creator emphasis.",
    sampleClass: "font-sans font-black tracking-[-0.04em]",
  },
  {
    id: "classic-serif",
    name: "Classic Serif",
    description: "A more editorial profile style.",
    sampleClass: "font-serif",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Simple, quiet, and less decorative.",
    sampleClass: "font-sans tracking-wide",
  },
];

const previewCards = [
  "Profile buttons",
  "Active tabs",
  "Badges",
  "Avatar rings",
  "Showcase accents",
  "Creator highlights",
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

function findAccent(id: string) {
  return accentOptions.find((option) => option.id === id) || accentOptions[0];
}

function findFont(id: string) {
  return fontOptions.find((option) => option.id === id) || fontOptions[0];
}

function isKnownAccent(value?: string | null) {
  return Boolean(value && accentOptions.some((option) => option.id === value));
}

function isKnownFont(value?: string | null) {
  return Boolean(value && fontOptions.some((option) => option.id === value));
}

function applyPersonalizationToDocument(accent: string, font: string) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.parapostAccent = accent;
  root.dataset.parapostFont = font;

  root.classList.remove(
    "parapost-font-default",
    "parapost-font-clean-modern",
    "parapost-font-rounded",
    "parapost-font-bold-creator",
    "parapost-font-classic-serif",
    "parapost-font-minimal"
  );

  if (font === "clean-modern") root.classList.add("parapost-font-clean-modern");
  else if (font === "rounded") root.classList.add("parapost-font-rounded");
  else if (font === "bold-creator") root.classList.add("parapost-font-bold-creator");
  else if (font === "classic-serif") root.classList.add("parapost-font-classic-serif");
  else if (font === "minimal") root.classList.add("parapost-font-minimal");
  else root.classList.add("parapost-font-default");

  try {
    window.localStorage.setItem(
      "parapost-active-preferences",
      JSON.stringify({ accent_color: accent, font_style: font })
    );
    window.dispatchEvent(new CustomEvent("parapost-preferences-updated", {
      detail: { accent_color: accent, font_style: font },
    }));
  } catch {
    // Browser storage can fail in private modes; the Supabase save still remains the source of truth.
  }
}

export default function PersonalizationSettingsPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [pageLoading, setPageLoading] = useState(true);

  const [accentId, setAccentId] = useState(DEFAULT_ACCENT);
  const [fontId, setFontId] = useState(DEFAULT_FONT);
  const [savedAccentId, setSavedAccentId] = useState(DEFAULT_ACCENT);
  const [savedFontId, setSavedFontId] = useState(DEFAULT_FONT);
  const [preferencesUpdatedAt, setPreferencesUpdatedAt] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedAccent = useMemo(() => findAccent(accentId), [accentId]);
  const selectedFont = useMemo(() => findFont(fontId), [fontId]);
  const savedAccent = useMemo(() => findAccent(savedAccentId), [savedAccentId]);
  const savedFont = useMemo(() => findFont(savedFontId), [savedFontId]);
  const canSeeAdminSupport = isAdminRole(adminRole);

  const hasUnsavedChanges = accentId !== savedAccentId || fontId !== savedFontId;

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
        setCurrentProfile(null);
        setUserEmail("");
        setAdminRole("");
        setAccentId(DEFAULT_ACCENT);
        setFontId(DEFAULT_FONT);
        setSavedAccentId(DEFAULT_ACCENT);
        setSavedFontId(DEFAULT_FONT);
        setPageLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      setUserEmail(user.email || "");

      const [{ data: profileData }, { data: adminData }, { data: preferenceData, error: preferenceError }] =
        await Promise.all([
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
          supabase
            .from("user_preferences")
            .select("user_id, accent_color, font_style, created_at, updated_at")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      if (cancelled) return;

      setCurrentProfile((profileData as ProfilePreview | null) || null);

      const adminRow = adminData as AdminUserRow | null;
      setAdminRole(adminRow?.role && isAdminRole(adminRow.role) ? adminRow.role : "");

      if (preferenceError) {
        setErrorMessage(`Could not load personalization preferences: ${preferenceError.message}`);
      }

      const preference = preferenceData as UserPreferenceRow | null;
      const nextAccent = isKnownAccent(preference?.accent_color)
        ? String(preference?.accent_color)
        : DEFAULT_ACCENT;
      const nextFont = isKnownFont(preference?.font_style)
        ? String(preference?.font_style)
        : DEFAULT_FONT;

      setAccentId(nextAccent);
      setFontId(nextFont);
      setSavedAccentId(nextAccent);
      setSavedFontId(nextFont);
      setPreferencesUpdatedAt(preference?.updated_at || null);
      applyPersonalizationToDocument(nextAccent, nextFont);

      setPageLoading(false);
    }

    void loadPageUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSavePreferences = async () => {
    setStatusMessage("");
    setErrorMessage("");

    if (!currentUserId) {
      setErrorMessage("Please sign in before saving personalization settings.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: currentUserId,
          accent_color: accentId,
          font_style: fontId,
        },
        {
          onConflict: "user_id",
        }
      )
      .select("user_id, accent_color, font_style, created_at, updated_at")
      .single();

    setSaving(false);

    if (error) {
      setErrorMessage(`Could not save personalization settings: ${error.message}`);
      return;
    }

    const preference = data as UserPreferenceRow;
    const nextAccent = isKnownAccent(preference.accent_color) ? String(preference.accent_color) : accentId;
    const nextFont = isKnownFont(preference.font_style) ? String(preference.font_style) : fontId;

    setAccentId(nextAccent);
    setFontId(nextFont);
    setSavedAccentId(nextAccent);
    setSavedFontId(nextFont);
    setPreferencesUpdatedAt(preference.updated_at || null);
    applyPersonalizationToDocument(nextAccent, nextFont);
    setStatusMessage("Personalization settings saved and applied across Parapost Network.");
  };

  const handleResetToDefaults = async () => {
    setStatusMessage("");
    setErrorMessage("");

    if (!currentUserId) {
      setAccentId(DEFAULT_ACCENT);
      setFontId(DEFAULT_FONT);
      setErrorMessage("Please sign in before saving default personalization settings.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: currentUserId,
          accent_color: DEFAULT_ACCENT,
          font_style: DEFAULT_FONT,
        },
        {
          onConflict: "user_id",
        }
      )
      .select("user_id, accent_color, font_style, created_at, updated_at")
      .single();

    setSaving(false);

    if (error) {
      setErrorMessage(`Could not reset personalization settings: ${error.message}`);
      return;
    }

    const preference = data as UserPreferenceRow;
    setAccentId(DEFAULT_ACCENT);
    setFontId(DEFAULT_FONT);
    setSavedAccentId(DEFAULT_ACCENT);
    setSavedFontId(DEFAULT_FONT);
    setPreferencesUpdatedAt(preference.updated_at || null);
    applyPersonalizationToDocument(DEFAULT_ACCENT, DEFAULT_FONT);
    setStatusMessage("Personalization reset and applied to Parapost Network defaults.");
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
            Settings Phase 3
          </span>
        </div>

        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="rounded-[30px] border border-purple-200/15 bg-gradient-to-br from-purple-500/14 via-white/[0.065] to-slate-950/70 p-5 shadow-2xl shadow-purple-950/20 ring-1 ring-white/[0.035] sm:p-7">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
              Personalization
            </p>

            <h1 className="max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
              Save your Parapost Network look.
            </h1>

            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
              Choose account-based accent colors and font styles while keeping the main Parapost Network identity
              purple, black, glassy, and premium by default.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#accent-colors"
                className={`rounded-full bg-gradient-to-r ${selectedAccent.gradient} px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/40 transition hover:brightness-110`}
              >
                Accent Colors
              </a>

              <a
                href="#font-style"
                className="rounded-full border border-purple-200/20 bg-purple-400/10 px-5 py-3 text-sm font-black text-white no-underline shadow-lg shadow-purple-950/10 transition hover:bg-purple-400/15"
              >
                Font Style
              </a>

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
              <div className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br ${selectedAccent.gradient} text-2xl font-black ring-1 ring-white/15`}>
                {currentProfile?.avatar_url ? (
                  <img src={currentProfile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  getInitial(currentProfile)
                )}
              </div>

              <div className="min-w-0">
                <div className={`truncate text-lg font-black ${selectedFont.sampleClass}`}>
                  {pageLoading ? "Loading..." : getDisplayName(currentProfile)}
                </div>
                <div className="truncate text-sm text-slate-400">{userEmail || "Signed out"}</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-purple-200/15 bg-black/30 p-4 shadow-inner shadow-purple-950/10">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-purple-200">
                Saved Account Style
              </div>
              <div className={`mt-2 text-2xl font-black ${savedFont.sampleClass}`}>
                {savedAccent.name}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {savedFont.name}
                {preferencesUpdatedAt ? ` · Updated ${new Date(preferencesUpdatedAt).toLocaleDateString()}` : ""}
              </p>
            </div>

            {!pageLoading && !currentUserId ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                Sign in is required to save personalization settings to your account.
              </div>
            ) : null}
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <section
              id="accent-colors"
              className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                    Accent Colors
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">
                    Pick your account highlight color.
                  </h2>
                </div>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                    hasUnsavedChanges
                      ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
                      : "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                  }`}
                >
                  {hasUnsavedChanges ? "Unsaved" : "Saved"}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {accentOptions.map((option) => {
                  const selected = option.id === accentId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setAccentId(option.id);
                        setStatusMessage("");
                        setErrorMessage("");
                      }}
                      className={`rounded-[24px] border p-4 text-left transition ${
                        selected
                          ? `${option.ring} bg-white/[0.075] shadow-lg shadow-purple-950/20`
                          : "border-purple-200/15 bg-black/25 hover:bg-white/[0.055]"
                      }`}
                    >
                      <div className={`mb-4 h-12 rounded-2xl bg-gradient-to-r ${option.gradient}`} />
                      <div className="text-base font-black text-white">{option.name}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section
              id="font-style"
              className="rounded-[28px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.055] to-slate-950/55 p-5 shadow-2xl shadow-purple-950/15 ring-1 ring-white/[0.035] sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                    Font Style
                  </p>
                  <h2 className="text-2xl font-black tracking-[-0.03em]">
                    Choose a profile-style font direction.
                  </h2>
                </div>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                    currentUserId
                      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                      : "border-amber-300/25 bg-amber-400/10 text-amber-100"
                  }`}
                >
                  {currentUserId ? "Account-backed" : "Sign in required"}
                </span>
              </div>

              <div className="grid gap-3">
                {fontOptions.map((option) => {
                  const selected = option.id === fontId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setFontId(option.id);
                        setStatusMessage("");
                        setErrorMessage("");
                      }}
                      className={`rounded-[24px] border p-4 text-left transition ${
                        selected
                          ? "border-purple-300/35 bg-white/[0.075] shadow-lg shadow-purple-950/20"
                          : "border-purple-200/15 bg-black/25 hover:bg-white/[0.055]"
                      }`}
                    >
                      <div className={`text-2xl text-white ${option.sampleClass}`}>{option.name}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{option.description}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500">
                  These settings save to your Parapost Network account.
                </span>

                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    onClick={handleResetToDefaults}
                    disabled={saving || pageLoading}
                    className="rounded-2xl border border-purple-200/15 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset Defaults
                  </button>

                  <button
                    type="button"
                    onClick={handleSavePreferences}
                    disabled={saving || pageLoading || !currentUserId}
                    className={`rounded-2xl bg-gradient-to-r ${selectedAccent.gradient} px-5 py-3 text-sm font-black shadow-lg shadow-purple-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60`}
                    style={{ color: "var(--parapost-accent-button-text)" }}
                  >
                    {saving ? "Saving..." : hasUnsavedChanges ? "Save Changes" : "Saved"}
                  </button>
                </div>
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
                Live Preview
              </p>
              <h2 className={`text-2xl font-black tracking-[-0.03em] ${selectedFont.sampleClass}`}>
                Your Parapost style
              </h2>

              <div className="mt-5 rounded-[26px] border border-purple-200/15 bg-black/30 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`h-14 w-14 rounded-full bg-gradient-to-br ${selectedAccent.gradient}`} />
                  <div>
                    <div className={`text-lg font-black ${selectedFont.sampleClass}`}>
                      {getDisplayName(currentProfile)}
                    </div>
                    <div className="text-sm text-slate-400">@{currentProfile?.username || "username"}</div>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-300">
                  Accent colors can later affect buttons, active tabs, avatar rings, badges, Showcase accents,
                  and creator highlights while keeping the core Parapost Network identity consistent.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {previewCards.map((item) => (
                    <span
                      key={item}
                      className={`rounded-full border border-white/10 bg-gradient-to-r ${selectedAccent.gradient} px-3 py-1.5 text-xs font-black text-white`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {[
              {
                title: "Account-backed settings",
                description:
                  "Accent color and font style now save in Supabase through the user_preferences table.",
              },
              {
                title: "Default stays Parapost",
                description:
                  "Purple and black remain the main Parapost Network brand. Personalization is optional and controlled.",
              },
              {
                title: "Next app-wide step",
                description:
                  "Later, we can load these preferences globally and apply them to buttons, active tabs, avatar rings, and badges.",
              },
              {
                title: "Creator-friendly",
                description:
                  "Accent color and font choices can later support creator profiles, Showcases, badges, and personal branding.",
              },
            ].map((card) => (
              <section
                key={card.title}
                className="rounded-[26px] border border-purple-200/15 bg-gradient-to-br from-purple-500/10 via-white/[0.045] to-slate-950/55 p-5 shadow-xl shadow-purple-950/10"
              >
                <span className="text-[11px] font-black uppercase tracking-[0.16em] text-purple-200">
                  Personalization
                </span>
                <h3 className="mt-3 text-lg font-black tracking-[-0.02em]">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{card.description}</p>
              </section>
            ))}
          </aside>
        </section>
      </div>
    </main>
  );
}
