"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
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

export default function ParapostPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [accent, setAccent] = useState<AccentKey>(DEFAULT_ACCENT);
  const [font, setFont] = useState<FontKey>(DEFAULT_FONT);

  const storageKey = useMemo(() => "parapost-active-preferences", []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      if (typeof window !== "undefined") {
        try {
          const cached = window.localStorage.getItem(storageKey);
          if (cached) {
            const parsed = JSON.parse(cached) as {
              accent_color?: string;
              font_style?: string;
            };

            const cachedAccent = normalizeAccent(parsed.accent_color);
            const cachedFont = normalizeFont(parsed.font_style);

            setAccent(cachedAccent);
            setFont(cachedFont);
            applyPreferenceAttributes(cachedAccent, cachedFont);
          } else {
            applyPreferenceAttributes(DEFAULT_ACCENT, DEFAULT_FONT);
          }
        } catch {
          applyPreferenceAttributes(DEFAULT_ACCENT, DEFAULT_FONT);
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) {
        return;
      }

      const { data, error } = await supabase
        .from("user_preferences")
        .select("user_id, accent_color, font_style")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled || error) {
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
    }

    void loadPreferences();

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
    };

    window.addEventListener("parapost-preferences-updated", handlePreferenceUpdate);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadPreferences();
    });

    return () => {
      cancelled = true;
      window.removeEventListener("parapost-preferences-updated", handlePreferenceUpdate);
      subscription.unsubscribe();
    };
  }, [storageKey]);

  useEffect(() => {
    applyPreferenceAttributes(accent, font);
  }, [accent, font]);

  return <>{children}</>;
}
