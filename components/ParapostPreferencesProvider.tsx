"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type AccentKey =
  | "parapost-purple"
  | "mystic-blue"
  | "creator-pink"
  | "night-green"
  | "ember-gold"
  | "ghost-white";

type FontKey =
  | "parapost-default"
  | "clean-modern"
  | "rounded"
  | "bold-creator"
  | "classic-serif"
  | "minimal";

type UserPreferenceRow = {
  user_id: string;
  accent_color: string | null;
  font_style: string | null;
};

const DEFAULT_ACCENT: AccentKey = "parapost-purple";
const DEFAULT_FONT: FontKey = "parapost-default";

const FONT_FAMILY_MAP: Record<FontKey, string> = {
  "parapost-default": "var(--font-geist-sans), Arial, Helvetica, sans-serif",
  "clean-modern": "Inter, Arial, Helvetica, sans-serif",
  rounded: '"Nunito", "Avenir Next", "Segoe UI Rounded", Arial, Helvetica, sans-serif',
  "bold-creator": '"Arial Black", var(--font-geist-sans), Arial, Helvetica, sans-serif',
  "classic-serif": 'Georgia, "Times New Roman", serif',
  minimal: '"Helvetica Neue", Arial, Helvetica, sans-serif',
};

const VALID_ACCENTS: AccentKey[] = [
  "parapost-purple",
  "mystic-blue",
  "creator-pink",
  "night-green",
  "ember-gold",
  "ghost-white",
];

const VALID_FONTS: FontKey[] = [
  "parapost-default",
  "clean-modern",
  "rounded",
  "bold-creator",
  "classic-serif",
  "minimal",
];

function normalizeAccent(value?: string | null): AccentKey {
  return VALID_ACCENTS.includes(value as AccentKey) ? (value as AccentKey) : DEFAULT_ACCENT;
}

function normalizeFont(value?: string | null): FontKey {
  return VALID_FONTS.includes(value as FontKey) ? (value as FontKey) : DEFAULT_FONT;
}

function applyPreferenceAttributes(accent: AccentKey, font: FontKey) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.parapostAccent = accent;
  root.dataset.parapostFont = font;
  root.style.setProperty("--parapost-user-font", FONT_FAMILY_MAP[font] || FONT_FAMILY_MAP[DEFAULT_FONT]);

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
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isSupabaseLockError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const lowered = message.toLowerCase();

  return (
    lowered.includes("lock") ||
    lowered.includes("aborterror") ||
    lowered.includes("lockmanager") ||
    lowered.includes("navigator.locks")
  );
}

async function getSessionUserIdSafely() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.warn("Parapost preferences session warning:", error.message);
        return null;
      }

      return data.session?.user?.id || null;
    } catch (error) {
      if (attempt < 2 && isSupabaseLockError(error)) {
        await delay(140 + attempt * 180);
        continue;
      }

      console.warn("Parapost preferences session lock skipped:", error);
      return null;
    }
  }

  return null;
}

export default function ParapostPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [accent, setAccent] = useState<AccentKey>(DEFAULT_ACCENT);
  const [font, setFont] = useState<FontKey>(DEFAULT_FONT);

  const latestRequestRef = useRef(0);
  const mountedRef = useRef(false);
  const loadTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const storageKey = useMemo(() => "parapost-active-preferences", []);

  useEffect(() => {
    mountedRef.current = true;

    function applyCachedPreferences() {
      if (typeof window === "undefined") return;

      try {
        const cached = window.localStorage.getItem(storageKey);

        if (!cached) {
          applyPreferenceAttributes(DEFAULT_ACCENT, DEFAULT_FONT);
          return;
        }

        const parsed = JSON.parse(cached) as {
          accent_color?: string;
          font_style?: string;
        };

        const cachedAccent = normalizeAccent(parsed.accent_color);
        const cachedFont = normalizeFont(parsed.font_style);

        setAccent(cachedAccent);
        setFont(cachedFont);
        applyPreferenceAttributes(cachedAccent, cachedFont);
      } catch {
        applyPreferenceAttributes(DEFAULT_ACCENT, DEFAULT_FONT);
      }
    }

    async function loadPreferences(preloadedUserId?: string | null) {
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;

      applyCachedPreferences();

      const userId = preloadedUserId === undefined ? await getSessionUserIdSafely() : preloadedUserId;

      if (!mountedRef.current || latestRequestRef.current !== requestId || !userId) {
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("user_id, accent_color, font_style")
          .eq("user_id", userId)
          .maybeSingle();

        if (!mountedRef.current || latestRequestRef.current !== requestId || error) {
          if (error) console.warn("Parapost preferences load warning:", error.message);
          return;
        }

        const preferences = data as UserPreferenceRow | null;
        const nextAccent = normalizeAccent(preferences?.accent_color);
        const nextFont = normalizeFont(preferences?.font_style);

        setAccent(nextAccent);
        setFont(nextFont);
        applyPreferenceAttributes(nextAccent, nextFont);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            storageKey,
            JSON.stringify({
              accent_color: nextAccent,
              font_style: nextFont,
            })
          );
        }
      } catch (error) {
        console.warn("Parapost preferences request skipped:", error);
      }
    }

    function schedulePreferenceLoad(userId?: string | null) {
      if (loadTimerRef.current) {
        window.clearTimeout(loadTimerRef.current);
      }

      loadTimerRef.current = window.setTimeout(() => {
        void loadPreferences(userId);
      }, 80);
    }

    applyCachedPreferences();
    schedulePreferenceLoad();

    const handlePreferenceUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        accent_color?: string;
        font_style?: string;
      }>;

      const nextAccent = normalizeAccent(customEvent.detail?.accent_color);
      const nextFont = normalizeFont(customEvent.detail?.font_style);

      setAccent(nextAccent);
      setFont(nextFont);
      applyPreferenceAttributes(nextAccent, nextFont);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            accent_color: nextAccent,
            font_style: nextFont,
          })
        );
      }
    };

    window.addEventListener("parapost-preferences-updated", handlePreferenceUpdate);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Do not call Supabase auth methods directly inside this callback.
      // Use the session Supabase already provides, then debounce the DB preference load.
      schedulePreferenceLoad(session?.user?.id || null);
    });

    return () => {
      mountedRef.current = false;

      if (loadTimerRef.current) {
        window.clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }

      window.removeEventListener("parapost-preferences-updated", handlePreferenceUpdate);
      subscription.unsubscribe();
    };
  }, [storageKey]);

  useEffect(() => {
    applyPreferenceAttributes(accent, font);
  }, [accent, font]);

  return <>{children}</>;
}
