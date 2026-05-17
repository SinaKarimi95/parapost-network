"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProfileSettingsRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_private: boolean | null;
};

type ProfileSettingsForm = {
  full_name: string;
  bio: string;
  avatar_url: string;
  is_private: boolean;
};

const emptyForm: ProfileSettingsForm = {
  full_name: "",
  bio: "",
  avatar_url: "",
  is_private: false,
};


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

export default function ProfileSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [form, setForm] = useState<ProfileSettingsForm>(emptyForm);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setStatusMessage("");
      setErrorMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userError || !user) {
          router.push("/");
          return;
        }

        setUserId(user.id);

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, username, bio, avatar_url, is_private")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        const profile = data as ProfileSettingsRow;

        if (cancelled) return;

        setUsername(profile.username || "");
        setForm({
          full_name: profile.full_name || "",
          bio: profile.bio || "",
          avatar_url: profile.avatar_url || "",
          is_private: Boolean(profile.is_private),
        });
      } catch (error) {
        console.error("Error loading profile settings:", error);
        if (!cancelled) {
          setErrorMessage("Could not load your profile settings. Please refresh and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleSave = async () => {
    if (!userId || saving) return;

    setSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const cleanFullName = form.full_name.trim();
      const cleanBio = form.bio.trim();
      const cleanAvatarUrl = form.avatar_url.trim();

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: cleanFullName || null,
          bio: cleanBio || null,
          avatar_url: cleanAvatarUrl || null,
          is_private: form.is_private,
        })
        .eq("id", userId);

      if (error) throw error;

      setStatusMessage("Profile settings saved successfully.");

      window.setTimeout(() => {
        router.push(`/profile/${userId}`);
      }, 700);
    } catch (error) {
      console.error("Error saving profile settings:", error);
      setErrorMessage("Failed to update profile settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="h-dvh min-h-dvh overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#05050b] px-4 py-8 pb-28 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="animate-pulse rounded-[32px] border border-white/10 bg-white/[0.055] p-6 shadow-2xl">
            <div className="mb-5 h-8 w-48 rounded bg-white/10" />
            <div className="mb-3 h-12 rounded-2xl bg-white/10" />
            <div className="mb-3 h-28 rounded-2xl bg-white/10" />
            <div className="mb-3 h-12 rounded-2xl bg-white/10" />
            <div className="h-12 w-32 rounded-2xl bg-white/10" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-dvh min-h-dvh overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#05050b] px-4 py-8 pb-28 text-white sm:px-6">
      <div className="pointer-events-none fixed -right-32 -top-32 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-32 -left-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <section className="relative z-10 mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <BackToPrevious label="← Back to Settings" fallbackHref="/settings" />

          {userId ? (
            <Link
              href={`/profile/${userId}`}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 no-underline hover:bg-white/10"
            >
              View Profile
            </Link>
          ) : null}
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/[0.055] p-5 shadow-2xl sm:p-7">
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200">
                Account
              </p>
              <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
                Profile Settings
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Update your profile details and control whether your profile content is public or private.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-300">
              @{username || "no-username"}
            </div>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-white/85">Full Name</span>
              <input
                type="text"
                value={form.full_name}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    full_name: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-purple-300/50"
                placeholder="Enter your full name"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-white/85">Bio</span>
              <textarea
                value={form.bio}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    bio: event.target.value,
                  }))
                }
                rows={5}
                maxLength={280}
                className="min-h-[140px] w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-purple-300/50"
                placeholder="Write something about yourself"
              />
              <div className="mt-2 text-right text-xs font-bold text-slate-500">
                {form.bio.trim().length}/280
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-white/85">Avatar URL</span>
              <input
                type="text"
                value={form.avatar_url}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    avatar_url: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-purple-300/50"
                placeholder="Paste image URL"
              />
            </label>

            <div className="rounded-[24px] border border-white/10 bg-black/25 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-black text-white">Private Profile</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    When private profile controls are fully connected, people can still see your profile shell,
                    but your timeline content will be hidden behind a private profile message.
                  </p>
                </div>

                <button
                  type="button"
                  aria-pressed={form.is_private}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      is_private: !prev.is_private,
                    }))
                  }
                  className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border transition ${
                    form.is_private
                      ? "border-purple-300/40 bg-purple-400"
                      : "border-white/10 bg-white/15"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition ${
                      form.is_private ? "translate-x-8" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
                Current setting:{" "}
                <span className="font-black text-white">
                  {form.is_private ? "Private" : "Public"}
                </span>
              </div>
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

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
