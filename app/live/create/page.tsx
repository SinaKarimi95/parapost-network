"use client";

import { CSSProperties, FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type LiveProvider = "youtube" | "twitch" | "facebook" | "streamyard" | "other";

type DetectedLiveMeta = {
  provider: LiveProvider;
  externalUrl: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  helper: string;
};

const PROVIDERS: { value: LiveProvider; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "twitch", label: "Twitch" },
  { value: "facebook", label: "Facebook" },
  { value: "streamyard", label: "StreamYard destination" },
  { value: "other", label: "Other external link" },
];

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function safeUrl(value: string) {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function getYoutubeVideoId(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] || "";
  }

  if (!host.includes("youtube.com")) return "";

  const watchId = url.searchParams.get("v");
  if (watchId) return watchId;

  const parts = url.pathname.split("/").filter(Boolean);
  const embedIndex = parts.indexOf("embed");
  if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];

  const liveIndex = parts.indexOf("live");
  if (liveIndex >= 0 && parts[liveIndex + 1]) return parts[liveIndex + 1];

  const shortsIndex = parts.indexOf("shorts");
  if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1];

  return "";
}

function getTwitchChannel(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!host.includes("twitch.tv")) return "";

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "";

  const first = parts[0].toLowerCase();
  if (["videos", "directory", "downloads", "settings", "p"].includes(first)) return "";

  return first.replace(/[^a-z0-9_]/gi, "");
}

function detectLiveMetadata(provider: LiveProvider, externalUrlInput: string): DetectedLiveMeta {
  const url = safeUrl(externalUrlInput);

  if (!url) {
    return {
      provider,
      externalUrl: null,
      embedUrl: null,
      thumbnailUrl: null,
      helper: "No external link yet. A polished Parapost Live fallback cover will show until a supported link is added.",
    };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const youtubeId = getYoutubeVideoId(url);

  if (youtubeId) {
    return {
      provider: "youtube",
      externalUrl: url.toString(),
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
      helper: "YouTube video ID detected. Parapost will automatically show the YouTube thumbnail on Live cards.",
    };
  }

  const twitchChannel = getTwitchChannel(url);

  if (twitchChannel) {
    return {
      provider: "twitch",
      externalUrl: url.toString(),
      embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(twitchChannel)}`,
      thumbnailUrl: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(twitchChannel)}-640x360.jpg`,
      helper: "Twitch channel detected. Parapost will use Twitch’s live preview image when available.",
    };
  }

  if (host.includes("facebook.com") || host.includes("fb.watch")) {
    return {
      provider: "facebook",
      externalUrl: url.toString(),
      embedUrl: null,
      thumbnailUrl: null,
      helper: "Facebook link saved. Parapost will show a polished fallback Live cover unless a supported preview is available later.",
    };
  }

  return {
    provider,
    externalUrl: url.toString(),
    embedUrl: null,
    thumbnailUrl: null,
    helper: "External link saved. Parapost will show a polished fallback Live cover for unsupported providers.",
  };
}

export default function CreateLiveDraftPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<LiveProvider>("youtube");
  const [externalUrl, setExternalUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const detectedMeta = useMemo(
    () => detectLiveMetadata(provider, externalUrl),
    [provider, externalUrl]
  );

  const previewTitle = title.trim() || "Your Parapost Live Draft";
  const previewProvider = PROVIDERS.find((item) => item.value === detectedMeta.provider)?.label || "External";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Add a Live title first.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be signed in to create a hidden Live draft.");
      return;
    }

    setSaving(true);

    const scheduledValue = scheduledAt ? new Date(scheduledAt).toISOString() : null;

    const { error: insertError } = await supabase.from("live_streams").insert({
      user_id: user.id,
      title: cleanTitle,
      description: description.trim() || null,
      provider: detectedMeta.provider,
      external_url: detectedMeta.externalUrl,
      embed_url: detectedMeta.embedUrl,
      thumbnail_url: detectedMeta.thumbnailUrl,
      status: "draft",
      visibility: "private",
      is_hidden: true,
      is_featured: false,
      scheduled_at: scheduledValue,
      started_at: null,
      ended_at: null,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message || "Could not create hidden Live draft.");
      return;
    }

    setMessage("Hidden Parapost Live draft created. It is private, hidden, and not publicly launched.");
    setTitle("");
    setDescription("");
    setExternalUrl("");
    setScheduledAt("");
  };

  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <div style={heroStyle}>
          <div style={badgeStyle}>Private hidden test</div>
          <h1 style={titleStyle}>Create Live Draft</h1>
          <p style={subtitleStyle}>
            This creates a hidden draft only. Parapost will not provide RTMP, host video, encode video,
            store recordings, or deliver live-stream bandwidth. The future public version will only display
            safe external embeds from providers like YouTube or Twitch.
          </p>

          <div style={heroActionsStyle}>
            <Link href="/live" style={smallLinkStyle}>Back to Live</Link>
            <Link href="/dashboard" style={smallLinkStyle}>Dashboard</Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>
            Live title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Global Ghost Hunt Live"
              style={inputStyle}
              maxLength={120}
            />
          </label>

          <label style={labelStyle}>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a private draft description for this future live page."
              style={textareaStyle}
              maxLength={1200}
            />
          </label>

          <div style={twoColumnStyle}>
            <label style={labelStyle}>
              Provider
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as LiveProvider)}
                style={inputStyle}
              >
                {PROVIDERS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label style={labelStyle}>
              Scheduled time
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={labelStyle}>
            External live link
            <input
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              placeholder="Paste a future YouTube or Twitch live link. Leave blank for a draft."
              style={inputStyle}
            />
          </label>

          <p style={helperStyle}>
            StreamYard should send the actual live video to YouTube/Twitch/etc. Parapost only stores
            the link, safe embed metadata, and a thumbnail URL when one can be detected.
          </p>

          <div style={previewWrapStyle}>
            <div style={previewMediaStyle}>
              {detectedMeta.thumbnailUrl ? (
                <img
                  src={detectedMeta.thumbnailUrl}
                  alt="Live thumbnail preview"
                  style={previewImageStyle}
                />
              ) : (
                <div style={fallbackThumbStyle}>
                  <span style={fallbackBadgeStyle}>PARAPOST LIVE</span>
                  <strong style={fallbackTitleStyle}>{previewTitle}</strong>
                  <span style={fallbackProviderStyle}>{previewProvider}</span>
                </div>
              )}
            </div>

            <div style={previewTextStyle}>
              <strong style={{ color: "#fff" }}>Automatic thumbnail preview</strong>
              <span>{detectedMeta.helper}</span>
              <span>
                Saved thumbnail URL: {detectedMeta.thumbnailUrl ? "Yes" : "Fallback card until supported link is added"}
              </span>
            </div>
          </div>

          <div style={safetyBoxStyle}>
            <strong>Hidden safety settings</strong>
            <span>
              This draft saves as <b>status: draft</b>, <b>visibility: private</b>, and <b>is_hidden: true</b>.
              No public Live launch, no RTMP, no video hosting.
            </span>
          </div>

          {error ? <div style={errorStyle}>{error}</div> : null}
          {message ? <div style={successStyle}>{message}</div> : null}

          <div style={actionsStyle}>
            <Link href="/live" style={cancelButtonStyle}>Cancel</Link>
            <button type="submit" disabled={saving} style={saveButtonStyle}>
              {saving ? "Saving..." : "Save Hidden Draft"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 14% 0%, rgba(168,85,247,0.28), transparent 34%), radial-gradient(circle at 86% 18%, rgba(236,72,153,0.13), transparent 34%), linear-gradient(180deg, #05050b 0%, #07090d 52%, #05050b 100%)",
  color: "#fff",
  padding: "24px 14px 70px",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: 980,
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const heroStyle: CSSProperties = {
  borderRadius: 30,
  border: "1px solid rgba(216,180,254,0.20)",
  background: "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(255,255,255,0.055), rgba(10,13,24,0.94))",
  padding: 22,
  boxShadow: "0 20px 58px rgba(0,0,0,0.30)",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 30,
  borderRadius: 999,
  padding: "0 11px",
  color: "#f3e8ff",
  background: "rgba(168,85,247,0.18)",
  border: "1px solid rgba(216,180,254,0.22)",
  fontSize: 12,
  fontWeight: 950,
  marginBottom: 12,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(32px, 6vw, 56px)",
  letterSpacing: "-0.06em",
  lineHeight: 1,
  fontWeight: 1000,
};

const subtitleStyle: CSSProperties = {
  color: "#d1d5db",
  maxWidth: 780,
  lineHeight: 1.65,
  margin: "12px 0 0",
  fontSize: 15,
};

const heroActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 16,
  flexWrap: "wrap",
};

const smallLinkStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  padding: "0 12px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.07)",
  color: "#fff",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 900,
};

const formStyle: CSSProperties = {
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(10,13,24,0.84)",
  padding: 18,
  display: "grid",
  gap: 14,
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#fff",
  fontSize: 13,
  fontWeight: 900,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 15,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.36)",
  color: "#fff",
  padding: "0 13px",
  outline: "none",
  boxSizing: "border-box",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 112,
  padding: 13,
  resize: "vertical",
  fontFamily: "inherit",
};

const twoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const helperStyle: CSSProperties = {
  color: "#aeb6c4",
  fontSize: 13,
  lineHeight: 1.55,
  margin: 0,
};

const previewWrapStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(210px, 340px) 1fr",
  gap: 14,
  alignItems: "stretch",
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  padding: 12,
};

const previewMediaStyle: CSSProperties = {
  minHeight: 182,
  borderRadius: 18,
  overflow: "hidden",
  background: "#05070d",
};

const previewImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const fallbackThumbStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 182,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  gap: 8,
  padding: 16,
  boxSizing: "border-box",
  background:
    "radial-gradient(circle at 20% 15%, rgba(168,85,247,0.55), transparent 32%), radial-gradient(circle at 80% 25%, rgba(236,72,153,0.28), transparent 34%), linear-gradient(135deg, #111827, #07090d)",
};

const fallbackBadgeStyle: CSSProperties = {
  color: "#f3e8ff",
  fontSize: 11,
  fontWeight: 1000,
  letterSpacing: "0.08em",
};

const fallbackTitleStyle: CSSProperties = {
  color: "#fff",
  fontSize: 22,
  lineHeight: 1.05,
};

const fallbackProviderStyle: CSSProperties = {
  color: "#d1d5db",
  fontSize: 13,
  fontWeight: 800,
};

const previewTextStyle: CSSProperties = {
  color: "#aeb6c4",
  fontSize: 13,
  lineHeight: 1.55,
  display: "grid",
  alignContent: "center",
  gap: 7,
};

const safetyBoxStyle: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.22)",
  padding: 13,
  display: "grid",
  gap: 6,
  color: "#d1d5db",
  fontSize: 13,
  lineHeight: 1.55,
};

const actionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const cancelButtonStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 999,
  padding: "0 16px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.07)",
  color: "#fff",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 900,
};

const saveButtonStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 999,
  padding: "0 18px",
  border: "1px solid rgba(216,180,254,0.30)",
  background: "linear-gradient(135deg, #a855f7, #7c3aed)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(168,85,247,0.28)",
};

const errorStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(248,113,113,0.28)",
  background: "rgba(127,29,29,0.25)",
  color: "#fecaca",
  padding: 12,
  fontSize: 13,
  lineHeight: 1.55,
};

const successStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(74,222,128,0.28)",
  background: "rgba(20,83,45,0.25)",
  color: "#bbf7d0",
  padding: 12,
  fontSize: 13,
  lineHeight: 1.55,
};
