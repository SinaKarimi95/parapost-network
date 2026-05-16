"use client";

import {
  ChangeEvent,
  CSSProperties,
  ReactNode,
  RefObject,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import DashboardReelsSection from "./DashboardReelsSection";
import { supabase } from "@/lib/supabase";

// Dashboard personalization phase 3.2: key dashboard accent colors now use global Parapost CSS variables.

type ProfilePreview = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  location?: string | null;
  is_online?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ShowcaseDuration = "24h" | "30d" | "permanent";
type ShowcaseVisibility = "public" | "friends" | "private";
type ShowcaseMediaType = "image" | "video" | "text";
type ShowcaseFontValue =
  | "inter"
  | "roboto"
  | "openSans"
  | "montserrat"
  | "poppins"
  | "lato"
  | "nunito"
  | "raleway"
  | "playfair"
  | "merriweather";

type DashboardShowcaseItem = {
  id: string;
  user_id: string;
  title: string | null;
  cover_text: string | null;
  media_url: string | null;
  media_type: ShowcaseMediaType | string | null;
  media_filename?: string | null;
  font_key?: string | null;
  text_position_x?: number | string | null;
  text_position_y?: number | string | null;
  overlay_font_size?: number | null;
  duration?: ShowcaseDuration | string | null;
  visibility: ShowcaseVisibility | string | null;
  expires_at: string | null;
  created_at: string | null;
  profile: ProfilePreview | null;
};


const SHOWCASE_OVERLAY_MIN_FONT_SIZE = 16;
const SHOWCASE_OVERLAY_MAX_FONT_SIZE = 64;
const SHOWCASE_OVERLAY_DEFAULT_FONT_SIZE = 30;

const SHOWCASE_FONT_OPTIONS: Array<{ value: ShowcaseFontValue; label: string; family: string }> = [
  { value: "inter", label: "Parapost Default", family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { value: "roboto", label: "Clean Sans", family: "Arial, Helvetica, sans-serif" },
  { value: "openSans", label: "Soft Modern", family: "Verdana, Geneva, sans-serif" },
  { value: "montserrat", label: "Classic Serif", family: "Georgia, 'Times New Roman', serif" },
  { value: "poppins", label: "Rounded Casual", family: "'Trebuchet MS', 'Arial Rounded MT Bold', Arial, sans-serif" },
  { value: "lato", label: "Simple Label", family: "Lato, Arial, Helvetica, sans-serif" },
  { value: "nunito", label: "Typewriter", family: "'Courier New', Courier, monospace" },
  { value: "raleway", label: "Bold Impact", family: "Impact, 'Arial Black', Arial, sans-serif" },
  { value: "playfair", label: "Editorial", family: "Georgia, 'Times New Roman', serif" },
  { value: "merriweather", label: "Clean Creator", family: "'Helvetica Neue', Arial, Helvetica, sans-serif" },
];

type PostImage = {
  id: string;
  post_id: string;
  user_id: string;
  image_url: string;
  storage_path: string | null;
  display_order: number;
  created_at?: string | null;
};

type Post = {
  id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  user_id: string;
  images?: PostImage[];
};

type SharedReelItem = {
  id: string;
  reel_id: string;
  user_id: string;
  caption: string | null;
  created_at: string;
  reel_title: string;
  reel_caption: string | null;
  reel_video_url: string;
  reel_poster_url: string | null;
  reel_user_id: string;
  creator_profile_id: string | null;
};

type SharedPostItem = {
  id: string;
  post_id: string;
  user_id: string;
  caption: string | null;
  created_at: string;
  original_post: Post;
};

type MixedFeedItem =
  | { type: "post"; id: string; created_at: string; post: Post }
  | { type: "shared_post"; id: string; created_at: string; sharedPost: SharedPostItem }
  | { type: "reel_share"; id: string; created_at: string; share: SharedReelItem };

type FeedMode = "for_you" | "friends" | "following";

type FeelingActivityOption = {
  id: string;
  label: string;
  category: "Feeling" | "Activity";
  helper: string;
};
type CountMap = Record<string, number>;
type ToggleMap = Record<string, boolean>;
type FollowMap = Record<string, boolean>;

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";
const POST_CHARACTER_LIMIT = 63206;
const MAX_POST_IMAGES = 10;
const FEED_INITIAL_BATCH_SIZE = 14;
const FEED_BATCH_INCREMENT = 10;

const FEELING_ACTIVITY_OPTIONS: FeelingActivityOption[] = [
  { id: "happy", label: "Feeling happy", category: "Feeling", helper: "Share a positive mood" },
  { id: "grateful", label: "Feeling grateful", category: "Feeling", helper: "Appreciation or good news" },
  { id: "excited", label: "Feeling excited", category: "Feeling", helper: "Something new is happening" },
  { id: "relaxed", label: "Feeling relaxed", category: "Feeling", helper: "A calm update" },
  { id: "focused", label: "Feeling focused", category: "Feeling", helper: "Working on something important" },
  { id: "creative", label: "Feeling creative", category: "Feeling", helper: "Ideas, art, projects, or content" },
  { id: "working", label: "Working", category: "Activity", helper: "Share what you are building" },
  { id: "watching", label: "Watching", category: "Activity", helper: "Shows, videos, events, or streams" },
  { id: "listening", label: "Listening", category: "Activity", helper: "Music, podcasts, or audio" },
  { id: "traveling", label: "Traveling", category: "Activity", helper: "Trips, places, and movement" },
  { id: "exploring", label: "Exploring", category: "Activity", helper: "Adventures, events, or locations" },
  { id: "celebrating", label: "Celebrating", category: "Activity", helper: "Milestones and special moments" },
];

function isLikelyShortenedLink(hostname: string) {
  const shortenerDomains = [
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "buff.ly",
    "cutt.ly",
    "is.gd",
    "s.id",
    "rebrand.ly",
    "lnkd.in",
    "shorturl.at",
    "tiny.cc",
    "trib.al",
    "amzn.to",
    "youtu.be",
  ];

  return shortenerDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

function isBlockedLinkProtocol(href: string) {
  const normalized = href.trim().toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("file:")
  );
}

function handleSafeExternalLinkClick(
  event: ReactMouseEvent<HTMLAnchorElement>,
  href: string
) {
  event.preventDefault();
  event.stopPropagation();

  if (isBlockedLinkProtocol(href)) {
    alert("This link was blocked because it may be unsafe.");
    return;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(href);
  } catch {
    alert("This link could not be opened because it does not look valid.");
    return;
  }

  const hostname = parsedUrl.hostname.replace(/^www\./, "");
  const isShortened = isLikelyShortenedLink(hostname);

  const message = isShortened
    ? `Safety notice: this appears to be a shortened link (${hostname}). The final destination may be hidden. Only continue if you trust this link.\n\nOpen it anyway?`
    : `You are leaving Parapost Network and opening:\n\n${hostname}\n\nOnly continue if you trust this site.`;

  if (!window.confirm(message)) return;
  window.open(parsedUrl.toString(), "_blank", "noopener,noreferrer");
}

function renderLinkedText(text: string): ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (!part.match(urlRegex)) return part;

    const rawLabel = part;
    const cleanLabel = rawLabel.replace(/[),.;!?]+$/, "");
    const trailing = rawLabel.slice(cleanLabel.length);
    const href = cleanLabel.startsWith("http") ? cleanLabel : `https://${cleanLabel}`;

    if (isBlockedLinkProtocol(href)) {
      return (
        <span key={`${part}-${index}`} style={{ color: "#fca5a5", fontWeight: 850 }}>
          [unsafe link blocked]{trailing}
        </span>
      );
    }

    return (
      <span key={`${part}-${index}`}>
        <a
          href={href}
          onClick={(event) => handleSafeExternalLinkClick(event, href)}
          style={{ color: "var(--parapost-accent-text)", fontWeight: 850, textDecoration: "none" }}
        >
          {cleanLabel}
        </a>
        {trailing}
      </span>
    );
  });
}


type LinkPreviewData = {
  href: string;
  hostname: string;
  label: string;
  type: "youtube" | "website";
  youtubeVideoId?: string;
};

function getYoutubeVideoId(url: URL) {
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    return url.pathname.replace("/", "").split(/[?&#]/)[0] || "";
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname.startsWith("/watch")) return url.searchParams.get("v") || "";
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/shorts/")[1]?.split(/[?&#/]/)[0] || "";
    if (url.pathname.startsWith("/embed/")) return url.pathname.split("/embed/")[1]?.split(/[?&#/]/)[0] || "";
  }

  return "";
}

function getFirstSafeLinkPreview(text: string): LinkPreviewData | null {
  const match = text.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/i);
  if (!match) return null;

  const cleanLabel = match[0].replace(/[),.;!?]+$/, "");
  const href = cleanLabel.startsWith("http") ? cleanLabel : `https://${cleanLabel}`;
  if (isBlockedLinkProtocol(href)) return null;

  try {
    const parsedUrl = new URL(href);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");
    const youtubeVideoId = getYoutubeVideoId(parsedUrl);

    if (youtubeVideoId) {
      return {
        href: parsedUrl.toString(),
        hostname,
        label: "YouTube video",
        type: "youtube",
        youtubeVideoId,
      };
    }

    return {
      href: parsedUrl.toString(),
      hostname,
      label: hostname,
      type: "website",
    };
  } catch {
    return null;
  }
}

function LinkPreviewCard({ text }: { text: string }) {
  const preview = getFirstSafeLinkPreview(text);
  if (!preview) return null;

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(preview.hostname)}&sz=64`;

  return (
    <a href={preview.href} onClick={(event) => handleSafeExternalLinkClick(event, preview.href)} style={linkPreviewCardStyle}>
      <div style={linkPreviewMediaStyle}>
        {preview.type === "youtube" && preview.youtubeVideoId ? (
          <>
            <img
              src={`https://img.youtube.com/vi/${preview.youtubeVideoId}/hqdefault.jpg`}
              alt="YouTube preview"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <div style={linkPreviewPlayOverlayStyle}>▶</div>
          </>
        ) : (
          <div style={linkPreviewFaviconWrapStyle}>
            <img src={faviconUrl} alt="" style={{ width: 42, height: 42, borderRadius: 12 }} />
          </div>
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={linkPreviewEyebrowStyle}>{preview.type === "youtube" ? "YouTube" : "External Website"}</div>
        <div style={linkPreviewTitleStyle}>{preview.type === "youtube" ? "Watch video" : preview.label}</div>
        <div style={linkPreviewDomainStyle}>{preview.hostname}</div>
      </div>
    </a>
  );
}

async function fetchPostImagesMap(postIds: string[]) {
  const uniquePostIds = [...new Set(postIds.filter(Boolean))];

  if (uniquePostIds.length === 0) {
    return {} as Record<string, PostImage[]>;
  }

  const { data, error } = await supabase
    .from("post_images")
    .select("id, post_id, user_id, image_url, storage_path, display_order, created_at")
    .in("post_id", uniquePostIds)
    .order("display_order", { ascending: true });

  if (error) {
    console.warn("Could not load post images:", error.message);
    return {} as Record<string, PostImage[]>;
  }

  return ((data || []) as PostImage[]).reduce<Record<string, PostImage[]>>((map, image) => {
    if (!image.post_id || !image.image_url) return map;
    if (!map[image.post_id]) map[image.post_id] = [];
    map[image.post_id].push(image);
    return map;
  }, {});
}

function attachImagesToPosts<T extends Post>(posts: T[], imageMap: Record<string, PostImage[]>) {
  return posts.map((post) => ({
    ...post,
    images: imageMap[post.id] || [],
  }));
}

function getPostImageUrls(post?: Pick<Post, "image_url" | "images"> | null) {
  if (!post) return [];

  const galleryUrls = (post.images || [])
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map((image) => image.image_url)
    .filter(Boolean);

  if (galleryUrls.length > 0) return galleryUrls;
  return post.image_url ? [post.image_url] : [];
}

function PostImageGrid({ imageUrls, alt }: { imageUrls: string[]; alt: string }) {
  const safeUrls = imageUrls.filter(Boolean).slice(0, MAX_POST_IMAGES);
  if (safeUrls.length === 0) return null;

  if (safeUrls.length === 1) {
    return <img src={safeUrls[0]} alt={alt} style={postImageStyle} />;
  }

  const visibleUrls = safeUrls.slice(0, 4);
  const extraCount = safeUrls.length - visibleUrls.length;

  return (
    <div style={postImageGridStyle}>
      {visibleUrls.map((url, index) => {
        const isFirstInThreeGrid = safeUrls.length === 3 && index === 0;
        const showOverlay = index === 3 && extraCount > 0;

        return (
          <div
            key={`${url}-${index}`}
            style={{
              ...postImageGridTileStyle,
              ...(isFirstInThreeGrid ? postImageGridLargeTileStyle : {}),
            }}
          >
            <img src={url} alt={`${alt} ${index + 1}`} style={postImageGridImageStyle} />
            {showOverlay ? <div style={postImageGridOverlayStyle}>+{extraCount}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

function getInitial(name?: string | null, username?: string | null) {
  const value = name || username || "P";
  return value.charAt(0).toUpperCase();
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "just now";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "just now";

  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function hasCompletedDiscoveryProfile(profile: ProfilePreview) {
  const hasName = Boolean((profile.full_name || profile.username || "").trim());
  const hasBio = Boolean((profile.bio || "").trim());
  return hasName && hasBio;
}

function getDiscoverySortTime(profile: ProfilePreview) {
  const value = profile.updated_at || profile.created_at || "";
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}


const TREND_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "before",
  "being",
  "could",
  "every",
  "from",
  "have",
  "here",
  "into",
  "just",
  "like",
  "more",
  "most",
  "only",
  "over",
  "post",
  "posts",
  "reel",
  "reels",
  "share",
  "shared",
  "showcase",
  "showcases",
  "some",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "with",
  "your",
  "parapost",
  "network",
]);

function formatTrendTitle(value: string) {
  return value
    .replace(/^#+/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function addTrendCandidate(
  map: Map<string, { title: string; count: number; latestTime: number; source: "hashtag" | "keyword" }>,
  rawValue: string,
  latestTime: number,
  source: "hashtag" | "keyword"
) {
  const cleaned = rawValue.replace(/^#+/, "").replace(/[^a-zA-Z0-9_ -]/g, "").trim();
  const key = cleaned.toLowerCase();

  if (!key || key.length < 4 || TREND_STOP_WORDS.has(key)) return;
  if (/^\d+$/.test(key)) return;

  const existing = map.get(key);
  const title = formatTrendTitle(cleaned);

  if (existing) {
    existing.count += source === "hashtag" ? 3 : 1;
    existing.latestTime = Math.max(existing.latestTime, latestTime);
    if (source === "hashtag") existing.source = "hashtag";
    return;
  }

  map.set(key, {
    title,
    count: source === "hashtag" ? 3 : 1,
    latestTime,
    source,
  });
}

function buildDashboardTrendingTopics(items: MixedFeedItem[]) {
  const trendMap = new Map<string, { title: string; count: number; latestTime: number; source: "hashtag" | "keyword" }>();

  items.forEach((item) => {
    const createdAt = item.created_at ? new Date(item.created_at).getTime() : 0;
    const latestTime = Number.isNaN(createdAt) ? 0 : createdAt;
    const text =
      item.type === "post"
        ? item.post.content || ""
        : item.type === "shared_post"
          ? [item.sharedPost.caption, item.sharedPost.original_post.content].filter(Boolean).join(" ")
          : [item.share.caption, item.share.reel_title, item.share.reel_caption].filter(Boolean).join(" ");

    const hashtags = text.match(/#[a-zA-Z0-9_]{3,}/g) || [];
    hashtags.forEach((tag) => addTrendCandidate(trendMap, tag, latestTime, "hashtag"));

    const words = text.match(/[a-zA-Z][a-zA-Z0-9'-]{3,}/g) || [];
    words.slice(0, 30).forEach((word) => addTrendCandidate(trendMap, word, latestTime, "keyword"));
  });

  const dynamicTopics = Array.from(trendMap.values())
    .sort((a, b) => b.count - a.count || b.latestTime - a.latestTime)
    .slice(0, 5)
    .map((topic) => ({
      title: topic.title,
      meta: topic.source === "hashtag" ? "Trending hashtag" : "Active topic",
    }));

  if (dynamicTopics.length >= 5) return dynamicTopics;

  const fallbackTopics = [
    { title: "New Posts", meta: "Fresh community updates" },
    { title: "Creator Moments", meta: "Photos, videos, and stories" },
    { title: "Parapost Reels", meta: "Short videos and clips" },
    { title: "Community Highlights", meta: "What members are sharing" },
    { title: "Shared Experiences", meta: "New conversations" },
  ];

  const existingTitles = new Set(dynamicTopics.map((topic) => topic.title.toLowerCase()));
  const filledTopics = [...dynamicTopics];

  for (const topic of fallbackTopics) {
    if (filledTopics.length >= 5) break;
    if (existingTitles.has(topic.title.toLowerCase())) continue;
    filledTopics.push(topic);
  }

  return filledTopics;
}

function getAvatarShellStyle(size: number, isOnline?: boolean | null): CSSProperties {
  return {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    borderRadius: "999px",
    padding: "3px",
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "visible",
    isolation: "isolate",
    textDecoration: "none",
    background: isOnline
      ? "linear-gradient(135deg, var(--parapost-accent-1), var(--parapost-accent-2), var(--parapost-accent-3))"
      : "linear-gradient(135deg, var(--parapost-accent-soft), rgba(15,23,42,0.98))",
    boxShadow: isOnline
      ? "0 0 0 1px rgba(255,255,255,0.10), 0 0 22px var(--parapost-accent-glow)"
      : "0 0 0 1px rgba(255,255,255,0.08), 0 12px 24px rgba(0,0,0,0.28)",
  };
}

function Avatar({
  profile,
  size = 44,
  href,
}: {
  profile?: ProfilePreview | null;
  size?: number;
  href?: string;
}) {
  const innerSize = Math.max(1, size - 6);

  const cropStyle: CSSProperties = {
    width: `${innerSize}px`,
    height: `${innerSize}px`,
    borderRadius: "999px",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
    position: "relative",
    zIndex: 1,
    border: "2px solid #07090d",
    background: "rgba(7,9,13,0.96)",
    flexShrink: 0,
  };

  const avatar = (
    <div style={getAvatarShellStyle(size, profile?.is_online)}>
      <div style={cropStyle}>
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.full_name || profile.username || "Profile"}
            style={{
              width: "100%",
              height: "100%",
              minWidth: "100%",
              minHeight: "100%",
              borderRadius: "999px",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "999px",
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, var(--parapost-accent-1), #111827)",
              color: "white",
              fontWeight: 950,
              fontSize: `${Math.max(12, Math.round(size * 0.34))}px`,
            }}
          >
            {getInitial(profile?.full_name, profile?.username)}
          </div>
        )}
      </div>
      {profile?.is_online ? <span style={onlineDotStyle} /> : null}
    </div>
  );

  if (!href) return avatar;
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        overflow: "visible",
        flexShrink: 0,
      }}
    >
      {avatar}
    </Link>
  );
}

function ParaGhostLogoIcon({ size = 34 }: { size?: number }) {
  return (
    <img
      src="/parapost-icon-white.png"
      alt=""
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: "block",
        objectFit: "contain",
        filter: "drop-shadow(0 0 10px color-mix(in srgb, var(--parapost-accent-2) 42%, transparent))",
      }}
    />
  );
}

function NewShowcaseIcon() {
  return (
    <div style={newShowcaseIconStyle}>
      <span style={newShowcasePlusInnerStyle}>+</span>
    </div>
  );
}

function getShowcaseFontOption(fontKey?: string | null) {
  return SHOWCASE_FONT_OPTIONS.find((font) => font.value === fontKey) || SHOWCASE_FONT_OPTIONS[0];
}

function getDashboardShowcaseFontFamily(fontKey?: string | null) {
  return getShowcaseFontOption(fontKey).family;
}

function clampShowcaseOverlayFontSize(value: number) {
  if (!Number.isFinite(value)) return SHOWCASE_OVERLAY_DEFAULT_FONT_SIZE;
  return Math.max(SHOWCASE_OVERLAY_MIN_FONT_SIZE, Math.min(SHOWCASE_OVERLAY_MAX_FONT_SIZE, Math.round(value)));
}

function getShowcaseOverlayDisplayFontSize(text: string, requestedSize: number) {
  const clean = text.trim();
  const base = clampShowcaseOverlayFontSize(requestedSize);
  if (clean.length > 70) return Math.max(16, Math.round(base * 0.64));
  if (clean.length > 42) return Math.max(17, Math.round(base * 0.76));
  if (clean.length > 24) return Math.max(19, Math.round(base * 0.88));
  return base;
}

function getShowcaseOverlayTextWidth(text: string) {
  const clean = text.trim();
  if (clean.length > 75) return "86%";
  if (clean.length > 42) return "78%";
  if (clean.length > 18) return "68%";
  return "58%";
}

function clampDashboardShowcaseFontSize(value?: number | null) {
  if (!value || Number.isNaN(Number(value))) return 10;
  return Math.max(8, Math.min(14, Math.round(Number(value) * 0.45)));
}

function getDashboardShowcaseLabel(showcase: DashboardShowcaseItem) {
  return (
    showcase.title ||
    showcase.cover_text ||
    showcase.profile?.full_name?.split(" ")[0] ||
    showcase.profile?.username ||
    "Showcase"
  );
}

function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.8 18.1C14.8317 18.1 18.1 14.8317 18.1 10.8C18.1 6.76832 14.8317 3.5 10.8 3.5C6.76832 3.5 3.5 6.76832 3.5 10.8C3.5 14.8317 6.76832 18.1 10.8 18.1Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M16.2 16.2L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18H9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M18 16V11C18 7.686 15.314 5 12 5S6 7.686 6 11V16L4 18H20L18 16Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17L4 20V6C4 4.895 4.895 4 6 4H18C19.105 4 20 4.895 20 6V15C20 16.105 19.105 17 18 17H7Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M8 9H16M8 13H13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18" cy="12" r="1.8" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path
        d="M12 20.5C12 20.5 4 15.2 4 9.5C4 6.462 6.462 4 9.5 4C11.243 4 12.798 4.811 13.8 6.076C14.802 4.811 16.357 4 18.1 4C21.138 4 23.6 6.462 23.6 9.5C23.6 15.2 15.6 20.5 15.6 20.5H12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17L4 20V6C4 4.895 4.895 4 6 4H18C19.105 4 20 4.895 20 6V15C20 16.105 19.105 17 18 17H7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 5L20 5L20 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14L20 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M20 14V18C20 19.105 19.105 20 18 20H6C4.895 20 4 19.105 4 18V6C4 4.895 4.895 4 6 4H10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3.4L3.5 10.6V20.2H9V14H15V20.2H20.5V10.6L12 3.4Z" />
    </svg>
  );
}

function ReelsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 5L10 10M14 5L16 10M4 10H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function buildPostContentWithFeelingActivity(content: string, feelingActivity: FeelingActivityOption | null) {
  const cleanContent = content.trim();
  const activityLine = feelingActivity ? feelingActivity.label : "";
  const combined = [activityLine, cleanContent].filter(Boolean).join("\n\n");
  return combined.slice(0, POST_CHARACTER_LIMIT);
}

function getPostFeelingActivityHeaderText(label: string) {
  const cleanLabel = label.trim();
  if (!cleanLabel) return "";

  const matchedOption = FEELING_ACTIVITY_OPTIONS.find(
    (option) => option.label.toLowerCase() === cleanLabel.toLowerCase()
  );

  if (!matchedOption) return "";

  if (matchedOption.category === "Feeling") {
    return `is ${matchedOption.label.toLowerCase()}`;
  }

  return `is ${matchedOption.label.toLowerCase()}`;
}

function splitPostFeelingActivityContent(content: string) {
  const lines = content.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentIndex === -1) {
    return { headerActivityText: "", bodyContent: "" };
  }

  const firstContentLine = lines[firstContentIndex].trim();
  const headerActivityText = getPostFeelingActivityHeaderText(firstContentLine);

  if (!headerActivityText) {
    return { headerActivityText: "", bodyContent: content };
  }

  const bodyLines = lines.slice(firstContentIndex + 1);

  while (bodyLines.length > 0 && bodyLines[0].trim().length === 0) {
    bodyLines.shift();
  }

  return {
    headerActivityText,
    bodyContent: bodyLines.join("\n").trimStart(),
  };
}


export default function DashboardPage() {
  const [content, setContent] = useState("");
  const [postImages, setPostImages] = useState<File[]>([]);
  const [postImagePreviewUrls, setPostImagePreviewUrls] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sharedPostItems, setSharedPostItems] = useState<SharedPostItem[]>([]);
  const [sharedReelItems, setSharedReelItems] = useState<SharedReelItem[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfilePreview>>({});
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const [feedMode, setFeedMode] = useState<FeedMode>("for_you");
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);
  const [acceptedFriendUserIds, setAcceptedFriendUserIds] = useState<string[]>([]);
  const [followingMap, setFollowingMap] = useState<FollowMap>({});
  const [likeCounts, setLikeCounts] = useState<CountMap>({});
  const [commentCounts, setCommentCounts] = useState<CountMap>({});
  const [shareCounts, setShareCounts] = useState<CountMap>({});
  const [userLikes, setUserLikes] = useState<ToggleMap>({});
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState("");
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [pendingFriendRequestCount, setPendingFriendRequestCount] = useState(0);
  const [recentlyViewed, setRecentlyViewed] = useState<ProfilePreview[]>([]);
  const [discoverProfiles, setDiscoverProfiles] = useState<ProfilePreview[]>([]);
  const [friendShowcases, setFriendShowcases] = useState<DashboardShowcaseItem[]>([]);
  const [showcaseComposerOpen, setShowcaseComposerOpen] = useState(false);
  const [dashboardShowcaseTitle, setDashboardShowcaseTitle] = useState("");
  const [dashboardShowcaseCoverText, setDashboardShowcaseCoverText] = useState("");
  const [dashboardShowcaseDuration, setDashboardShowcaseDuration] = useState<ShowcaseDuration>("24h");
  const [dashboardShowcaseVisibility, setDashboardShowcaseVisibility] = useState<ShowcaseVisibility>("friends");
  const [dashboardShowcaseMediaFile, setDashboardShowcaseMediaFile] = useState<File | null>(null);
  const [dashboardShowcaseMediaPreviewUrl, setDashboardShowcaseMediaPreviewUrl] = useState("");
  const [dashboardShowcaseMediaType, setDashboardShowcaseMediaType] = useState<ShowcaseMediaType>("text");
  const [dashboardShowcaseMediaFileName, setDashboardShowcaseMediaFileName] = useState("");
  const [dashboardShowcaseFontKey, setDashboardShowcaseFontKey] = useState<ShowcaseFontValue>("inter");
  const [dashboardShowcaseOverlayFontSize, setDashboardShowcaseOverlayFontSize] = useState(SHOWCASE_OVERLAY_DEFAULT_FONT_SIZE);
  const [dashboardShowcaseTextPosition, setDashboardShowcaseTextPosition] = useState({ x: 50, y: 50 });
  const [dashboardShowcaseCustomizeOpen, setDashboardShowcaseCustomizeOpen] = useState(false);
  const [dashboardShowcasePreviewExpanded, setDashboardShowcasePreviewExpanded] = useState(false);
  const [dashboardShowcaseMediaDragActive, setDashboardShowcaseMediaDragActive] = useState(false);
  const [dashboardShowcaseError, setDashboardShowcaseError] = useState("");
  const [dashboardShowcaseSaving, setDashboardShowcaseSaving] = useState(false);
  const [feelingActivityOpen, setFeelingActivityOpen] = useState(false);
  const [selectedFeelingActivity, setSelectedFeelingActivity] = useState<FeelingActivityOption | null>(null);
  const [visibleFeedLimit, setVisibleFeedLimit] = useState(FEED_INITIAL_BATCH_SIZE);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfilePreview[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dashboardShowcaseInputRef = useRef<HTMLInputElement | null>(null);
  const mainComposerRef = useRef<HTMLElement | null>(null);
  const feedLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedDashboardOnceRef = useRef(false);
  const dashboardRefreshInFlightRef = useRef(false);

  const currentName = currentProfile?.full_name || currentProfile?.username || "there";
  const firstName = currentName.split(" ")[0] || "there";

  const mixedFeedItems = useMemo<MixedFeedItem[]>(() => {
    const postItems = posts.map((post) => ({
      type: "post" as const,
      id: post.id,
      created_at: post.created_at,
      post,
    }));

    const sharedPostFeedItems = sharedPostItems.map((sharedPost) => ({
      type: "shared_post" as const,
      id: sharedPost.id,
      created_at: sharedPost.created_at,
      sharedPost,
    }));

    const reelShareItems = sharedReelItems.map((share) => ({
      type: "reel_share" as const,
      id: share.id,
      created_at: share.created_at,
      share,
    }));

    return [...postItems, ...sharedPostFeedItems, ...reelShareItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [posts, sharedPostItems, sharedReelItems]);

  const filteredFeedItems = useMemo(() => {
    if (feedMode === "friends" && currentUserId) {
      return mixedFeedItems.filter((item) => {
        const authorId = item.type === "post" ? item.post.user_id : item.type === "shared_post" ? item.sharedPost.user_id : item.share.user_id;
        return acceptedFriendUserIds.includes(authorId);
      });
    }

    if (feedMode === "following" && currentUserId) {
      return mixedFeedItems.filter((item) => {
        const authorId = item.type === "post" ? item.post.user_id : item.type === "shared_post" ? item.sharedPost.user_id : item.share.user_id;
        return followedUserIds.includes(authorId);
      });
    }

    return mixedFeedItems;
  }, [acceptedFriendUserIds, currentUserId, feedMode, followedUserIds, mixedFeedItems]);

  const visibleFeedItems = useMemo(() => {
    return filteredFeedItems.slice(0, visibleFeedLimit);
  }, [filteredFeedItems, visibleFeedLimit]);

  const hasMoreFeedItems = visibleFeedLimit < filteredFeedItems.length;

  const totalLikes = useMemo(() => {
    return Object.values(likeCounts).reduce((sum, count) => sum + count, 0);
  }, [likeCounts]);

  const totalComments = useMemo(() => {
    return Object.values(commentCounts).reduce((sum, count) => sum + count, 0);
  }, [commentCounts]);

  const totalShares = useMemo(() => {
    return Object.values(shareCounts).reduce((sum, count) => sum + count, 0);
  }, [shareCounts]);

  const peopleToDiscover = useMemo(() => {
    return discoverProfiles.slice(0, 4);
  }, [discoverProfiles]);

  const trendingTopics = useMemo(() => {
    return buildDashboardTrendingTopics(mixedFeedItems);
  }, [mixedFeedItems]);

  const fetchPeopleToDiscover = useCallback(async (userId?: string) => {
    if (!userId) {
      setDiscoverProfiles([]);
      return;
    }

    const [{ data: friendshipRows }, { data: followingRows }] = await Promise.all([
      supabase
        .from("friend_requests")
        .select("sender_id, receiver_id, status")
        .eq("status", "accepted")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", userId),
    ]);

    const friendIds = new Set(
      (friendshipRows || [])
        .map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id))
        .filter(Boolean) as string[]
    );

    const followingIds = new Set(
      (followingRows || []).map((row) => row.following_id).filter(Boolean) as string[]
    );

    const hiddenIds = new Set<string>([userId, ...Array.from(friendIds), ...Array.from(followingIds)]);

    const selectWithDates =
      "id, username, full_name, avatar_url, bio, location, is_online, created_at, updated_at";

    let profilesData: ProfilePreview[] = [];

    const { data, error } = await supabase
      .from("profiles")
      .select(selectWithDates)
      .limit(160);

    if (error) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, location, is_online")
        .limit(80);

      if (fallbackError) {
        console.error("Error fetching People to Discover:", fallbackError.message);
        setDiscoverProfiles([]);
        return;
      }

      profilesData = (fallbackData || []) as ProfilePreview[];
    } else {
      profilesData = (data || []) as ProfilePreview[];
    }

    const nextProfiles = profilesData
      .filter((profile) => profile.id && !hiddenIds.has(profile.id))
      .filter(hasCompletedDiscoveryProfile)
      .sort((a, b) => getDiscoverySortTime(b) - getDiscoverySortTime(a))
      .slice(0, 12);

    setDiscoverProfiles(nextProfiles);
  }, []);

  const fetchProfileMap = useCallback(async (userIds: string[]) => {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      setProfilesMap({});
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, bio, location, is_online")
      .in("id", uniqueIds);

    if (error) {
      console.error("Error fetching profiles:", error.message);
      return;
    }

    const nextMap: Record<string, ProfilePreview> = {};
    for (const profile of data || []) {
      nextMap[profile.id] = profile as ProfilePreview;
    }

    setProfilesMap(nextMap);
  }, []);

  const fetchCounts = useCallback(async (userId: string | undefined, visiblePostIds: string[]) => {
    const safePostIds = visiblePostIds.length ? visiblePostIds : [EMPTY_UUID];

    const [{ data: likesData }, { data: commentsData }, { data: sharesData }] = await Promise.all([
      supabase.from("likes").select("post_id, user_id").in("post_id", safePostIds),
      supabase.from("comments").select("post_id, is_hidden").in("post_id", safePostIds),
      supabase.from("shares").select("post_id").in("post_id", safePostIds),
    ]);

    const nextLikes: CountMap = {};
    const nextUserLikes: ToggleMap = {};
    for (const like of likesData || []) {
      if (!like.post_id) continue;
      nextLikes[like.post_id] = (nextLikes[like.post_id] || 0) + 1;
      if (userId && like.user_id === userId) nextUserLikes[like.post_id] = true;
    }

    const nextComments: CountMap = {};
    for (const comment of commentsData || []) {
      if (!comment.post_id || comment.is_hidden) continue;
      nextComments[comment.post_id] = (nextComments[comment.post_id] || 0) + 1;
    }

    const nextShares: CountMap = {};
    for (const share of sharesData || []) {
      if (!share.post_id) continue;
      nextShares[share.post_id] = (nextShares[share.post_id] || 0) + 1;
    }

    setLikeCounts(nextLikes);
    setUserLikes(nextUserLikes);
    setCommentCounts(nextComments);
    setShareCounts(nextShares);
  }, []);

  const fetchFollowData = useCallback(async (userId?: string) => {
    if (!userId) {
      setFollowedUserIds([]);
      setFollowingMap({});
      return [] as string[];
    }

    const { data, error } = await supabase
      .from("followers")
      .select("following_id")
      .eq("follower_id", userId);

    if (error) {
      console.error("Error fetching following list:", error.message);
      setFollowedUserIds([]);
      setFollowingMap({});
      return [] as string[];
    }

    const ids = (data || []).map((row) => row.following_id).filter(Boolean) as string[];
    const nextMap: FollowMap = {};
    ids.forEach((id) => {
      nextMap[id] = true;
    });

    setFollowedUserIds(ids);
    setFollowingMap(nextMap);
    return ids;
  }, []);

  const fetchNotifications = useCallback(async (userId?: string) => {
    if (!userId) {
      setNotificationsCount(0);
      setPendingFriendRequestCount(0);
      return;
    }

    const [{ count: unreadCount }, { count: requestCount }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false),
      supabase
        .from("friend_requests")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", userId)
        .eq("status", "pending"),
    ]);

    setNotificationsCount(unreadCount || 0);
    setPendingFriendRequestCount(requestCount || 0);
  }, []);

  const fetchFriendShowcases = useCallback(async (userId?: string) => {
    if (!userId) {
      setAcceptedFriendUserIds([]);
      setFriendShowcases([]);
      return [] as DashboardShowcaseItem[];
    }

    const { data: friendshipRows, error: friendshipError } = await supabase
      .from("friend_requests")
      .select("sender_id, receiver_id, status")
      .eq("status", "accepted")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (friendshipError) {
      console.error("Error fetching dashboard friend showcase relationships:", friendshipError.message);
      setAcceptedFriendUserIds([]);
      setFriendShowcases([]);
      return [] as DashboardShowcaseItem[];
    }

    const friendIds = [
      ...new Set(
        (friendshipRows || [])
          .map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id))
          .filter(Boolean)
      ),
    ] as string[];

    setAcceptedFriendUserIds(friendIds);

    // Dashboard Showcases are the user's own Showcases plus Showcases from accepted friends only.
    // This keeps the homepage automatic: users create their own Showcase from Dashboard/profile,
    // and friends' Showcases appear here without showing a separate “friend showcase” tile.
    const showcaseUserIds = [...new Set([userId, ...friendIds].filter(Boolean))] as string[];

    if (showcaseUserIds.length === 0) {
      setFriendShowcases([]);
      return [] as DashboardShowcaseItem[];
    }

    const [{ data: profilesData, error: profilesError }, { data: showcaseData, error: showcaseError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, location, is_online")
          .in("id", showcaseUserIds)
          .limit(36),
        supabase
          .from("profile_showcases")
          .select("id, user_id, title, cover_text, media_url, media_type, media_filename, font_key, text_position_x, text_position_y, overlay_font_size, duration, visibility, expires_at, created_at")
          .in("user_id", showcaseUserIds)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

    if (profilesError) {
      console.error("Error fetching dashboard friend profiles:", profilesError.message);
    }

    if (showcaseError) {
      console.error("Error fetching dashboard friend showcases:", showcaseError.message);
      setFriendShowcases([]);
      return [] as DashboardShowcaseItem[];
    }

    const profileMap = new Map<string, ProfilePreview>();
    for (const profile of (profilesData || []) as ProfilePreview[]) {
      profileMap.set(profile.id, profile);
    }

    const now = Date.now();
    const nextItems = ((showcaseData || []) as Array<{
      id: string;
      user_id: string;
      title: string | null;
      cover_text: string | null;
      media_url: string | null;
      media_type: string | null;
      media_filename?: string | null;
      font_key?: string | null;
      text_position_x?: number | string | null;
      text_position_y?: number | string | null;
      overlay_font_size?: number | null;
      duration?: string | null;
      visibility: string | null;
      expires_at: string | null;
      created_at: string | null;
    }>)
      .filter((item) => item.user_id && showcaseUserIds.includes(item.user_id))
      .filter((item) => item.user_id === userId || item.visibility !== "private")
      .filter((item) => !item.expires_at || new Date(item.expires_at).getTime() > now)
      .map((item) => ({
        ...item,
        profile: profileMap.get(item.user_id) || null,
      }));

    setFriendShowcases(nextItems);
    return nextItems;
  }, []);

  const fetchRecentlyViewed = useCallback(async (userId?: string) => {
    if (!userId) {
      setRecentlyViewed([]);
      return;
    }

    const { data, error } = await supabase
      .from("recently_viewed_profiles")
      .select("profile_id, viewed_at, profiles:profile_id(id, username, full_name, avatar_url, bio, location, is_online)")
      .eq("viewer_id", userId)
      .order("viewed_at", { ascending: false })
      .limit(6);

    if (error) {
      console.error("Error fetching recently viewed:", error.message);
      setRecentlyViewed([]);
      return;
    }

    const rows = (data || []) as Array<{ profiles?: ProfilePreview | ProfilePreview[] | null }>;
    const profiles = rows
      .map((row) => (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles))
      .filter(Boolean) as ProfilePreview[];

    setRecentlyViewed(profiles);
  }, []);

  const fetchSharedPosts = useCallback(async (blockedIds: string[] = []) => {
    const { data: shareRows, error: shareError } = await supabase
      .from("shares")
      .select("id, post_id, user_id, caption, created_at, share_destination, deleted_at")
      .eq("share_destination", "feed")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(120);

    if (shareError) {
      console.error("Error fetching shared posts:", shareError.message);
      setSharedPostItems([]);
      return [] as SharedPostItem[];
    }

    const visibleShareRows = ((shareRows || []) as Array<{
      id: string;
      post_id: string | null;
      user_id: string | null;
      caption: string | null;
      created_at: string | null;
    }>)
      .filter((share) => Boolean(share.post_id && share.user_id && share.created_at))
      .filter((share) => !blockedIds.includes(String(share.user_id)));

    const postIds = [...new Set(visibleShareRows.map((share) => String(share.post_id)).filter(Boolean))];

    if (postIds.length === 0) {
      setSharedPostItems([]);
      return [] as SharedPostItem[];
    }

    const { data: postRows, error: postsError } = await supabase
      .from("posts")
      .select("id, content, image_url, created_at, user_id")
      .in("id", postIds);

    if (postsError) {
      console.error("Error fetching shared post originals:", postsError.message);
      setSharedPostItems([]);
      return [] as SharedPostItem[];
    }

    const sharedPostImagesMap = await fetchPostImagesMap(((postRows || []) as Post[]).map((post) => post.id));
    const postMap = new Map<string, Post>();
    for (const post of (postRows || []) as Post[]) {
      if (!post?.id || blockedIds.includes(post.user_id)) continue;
      postMap.set(post.id, {
        ...post,
        images: sharedPostImagesMap[post.id] || [],
      });
    }

    const nextSharedPosts = visibleShareRows
      .map((share) => {
        const originalPost = postMap.get(String(share.post_id));
        if (!originalPost) return null;

        return {
          id: share.id,
          post_id: String(share.post_id),
          user_id: String(share.user_id),
          caption: share.caption || null,
          created_at: String(share.created_at),
          original_post: originalPost,
        } satisfies SharedPostItem;
      })
      .filter(Boolean) as SharedPostItem[];

    setSharedPostItems(nextSharedPosts);
    return nextSharedPosts;
  }, []);

  const fetchSharedReels = useCallback(async (blockedIds: string[] = []) => {
    const { data: shareRows, error: shareError } = await supabase
      .from("reel_shares")
      .select("id, reel_id, user_id, caption, created_at")
      .order("created_at", { ascending: false })
      .limit(60);

    if (shareError) {
      console.error("Error fetching reel shares:", shareError.message);
      setSharedReelItems([]);
      return [] as SharedReelItem[];
    }

    const visibleShareRows = (shareRows || []).filter((share) => !blockedIds.includes(share.user_id));
    const reelIds = [...new Set(visibleShareRows.map((share) => share.reel_id).filter(Boolean))];

    if (reelIds.length === 0) {
      setSharedReelItems([]);
      return [] as SharedReelItem[];
    }

    const { data: reelRows, error: reelsError } = await supabase
      .from("reels")
      .select("id, user_id, creator_profile_id, title, caption, video_url, poster_url")
      .in("id", reelIds);

    if (reelsError) {
      console.error("Error fetching shared reels:", reelsError.message);
      setSharedReelItems([]);
      return [] as SharedReelItem[];
    }

    const reelMap = new Map<string, any>();
    for (const reel of reelRows || []) reelMap.set(reel.id, reel);

    const nextShared = visibleShareRows
      .map((share) => {
        const reel = reelMap.get(share.reel_id);
        if (!reel || !reel.video_url || !reel.user_id) return null;
        if (blockedIds.includes(reel.user_id)) return null;

        return {
          id: share.id,
          reel_id: share.reel_id,
          user_id: share.user_id,
          caption: share.caption || null,
          created_at: share.created_at,
          reel_title: reel.title || "Untitled Reel",
          reel_caption: reel.caption || null,
          reel_video_url: reel.video_url,
          reel_poster_url: reel.poster_url || null,
          reel_user_id: reel.user_id,
          creator_profile_id: reel.creator_profile_id || null,
        } satisfies SharedReelItem;
      })
      .filter(Boolean) as SharedReelItem[];

    setSharedReelItems(nextShared);
    return nextShared;
  }, []);

  const fetchDashboardData = useCallback(async (showFeedLoading = false) => {
    if (dashboardRefreshInFlightRef.current) return;

    dashboardRefreshInFlightRef.current = true;

    const shouldShowFeedLoading = showFeedLoading || !hasLoadedDashboardOnceRef.current;
    if (shouldShowFeedLoading) setFetchingPosts(true);

    try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    let userId = "";
    let blockedIds: string[] = [];

    if (!userError && user) {
      userId = user.id;
      setCurrentUserId(user.id);
      setUserEmail(user.email || "");

      await supabase.from("profiles").update({ is_online: true }).eq("id", user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, location, is_online")
        .eq("id", user.id)
        .maybeSingle();

      setCurrentProfile((profileData as ProfilePreview | null) || null);

      const { data: blocksData } = await supabase
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

      blockedIds =
        blocksData?.map((row) => (row.blocker_id === user.id ? row.blocked_id : row.blocker_id)) || [];

      await Promise.all([
        fetchFollowData(user.id),
        fetchNotifications(user.id),
        fetchRecentlyViewed(user.id),
        fetchFriendShowcases(user.id),
        fetchPeopleToDiscover(user.id),
      ]);
    } else {
      setCurrentUserId("");
      setUserEmail("");
      setCurrentProfile(null);
      await Promise.all([fetchFollowData(), fetchNotifications(), fetchRecentlyViewed(), fetchFriendShowcases(), fetchPeopleToDiscover()]);
    }

    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select("id, content, image_url, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(80);

    if (postsError) {
      console.error("Error fetching posts:", postsError.message);
      if (!hasLoadedDashboardOnceRef.current) setPosts([]);
      return;
    }

    const visiblePostsBase = ((postsData || []) as Post[]).filter((post) => !blockedIds.includes(post.user_id));
    const postImagesMap = await fetchPostImagesMap(visiblePostsBase.map((post) => post.id));
    const visiblePosts = attachImagesToPosts(visiblePostsBase, postImagesMap);
    const visibleSharedPosts = await fetchSharedPosts(blockedIds);
    const visibleShared = await fetchSharedReels(blockedIds);

    setPosts(visiblePosts);

    const profileIds = [
      userId,
      ...visiblePosts.map((post) => post.user_id),
      ...visibleSharedPosts.map((share) => share.user_id),
      ...visibleSharedPosts.map((share) => share.original_post.user_id),
      ...visibleShared.map((share) => share.user_id),
      ...visibleShared.map((share) => share.reel_user_id),
      ...visibleShared.map((share) => share.creator_profile_id || ""),
    ];

    const countPostIds = [
      ...new Set([
        ...visiblePosts.map((post) => post.id),
        ...visibleSharedPosts.map((share) => share.post_id),
      ]),
    ];

    await Promise.all([fetchProfileMap(profileIds), fetchCounts(userId || undefined, countPostIds)]);
    } catch (error) {
      // Important: Supabase/network hiccups can throw TypeError: Failed to fetch.
      // Keep the current timeline on screen instead of letting the dashboard crash or blink.
      console.warn("Dashboard refresh skipped because the network request failed.", error);
    } finally {
      hasLoadedDashboardOnceRef.current = true;
      dashboardRefreshInFlightRef.current = false;
      setFetchingPosts(false);
    }
  }, [fetchCounts, fetchFollowData, fetchFriendShowcases, fetchNotifications, fetchPeopleToDiscover, fetchProfileMap, fetchRecentlyViewed, fetchSharedPosts, fetchSharedReels]);

  useEffect(() => {
    void fetchDashboardData(true);
  }, [fetchDashboardData]);


  useEffect(() => {
    setVisibleFeedLimit(FEED_INITIAL_BATCH_SIZE);
  }, [feedMode]);

  useEffect(() => {
    if (!hasMoreFeedItems) return;

    const target = feedLoadMoreSentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (!firstEntry?.isIntersecting) return;

        setVisibleFeedLimit((currentLimit) =>
          Math.min(currentLimit + FEED_BATCH_INCREMENT, filteredFeedItems.length)
        );
      },
      {
        root: null,
        rootMargin: "900px 0px 900px 0px",
        threshold: 0,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [filteredFeedItems.length, hasMoreFeedItems]);

  useEffect(() => {
    if (!currentUserId) return;

   let refreshTimer: number | null = null; 

    const schedulePulseRefresh = () => {
  if (refreshTimer) {
    window.clearTimeout(refreshTimer);
  }

  refreshTimer = window.setTimeout(() => {
    void fetchDashboardData(false);
  }, 350);
};

    const channel = supabase
      .channel(`dashboard-network-pulse-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "shares" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "shares" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "followers" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "reel_shares" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_showcases" }, schedulePulseRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "recently_viewed_profiles" }, schedulePulseRefresh)
      .subscribe();

    const intervalId = window.setInterval(() => {
      void fetchDashboardData(false);
    }, 30000);

    const handleFocusRefresh = () => {
      void fetchDashboardData(false);
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void fetchDashboardData(false);
      }
    };

    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchDashboardData]);

  useEffect(() => {
    if (postImages.length === 0) {
      setPostImagePreviewUrls([]);
      return;
    }

    const objectUrls = postImages.map((file) => URL.createObjectURL(file));
    setPostImagePreviewUrls(objectUrls);

    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [postImages]);

  useEffect(() => {
    if (!dashboardShowcaseMediaFile) {
      setDashboardShowcaseMediaPreviewUrl("");
      setDashboardShowcaseMediaFileName("");
      setDashboardShowcaseMediaType("text");
      return;
    }

    let cancelled = false;
    const reader = new FileReader();

    reader.onload = () => {
      if (cancelled) return;
      const result = typeof reader.result === "string" ? reader.result : "";
      setDashboardShowcaseMediaPreviewUrl(result);
      setDashboardShowcaseMediaFileName(dashboardShowcaseMediaFile.name);
      setDashboardShowcaseMediaType(
        dashboardShowcaseMediaFile.type.startsWith("video/") ? "video" : "image"
      );
    };

    reader.onerror = () => {
      if (cancelled) return;
      setDashboardShowcaseError("Could not preview this Showcase media. Try another file.");
    };

    reader.readAsDataURL(dashboardShowcaseMediaFile);

    return () => {
      cancelled = true;
    };
  }, [dashboardShowcaseMediaFile]);

  useEffect(() => {
    const handleGlobalClick = () => setOpenPostMenuId(null);
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("scroll", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("scroll", handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSearchOpen(false);
      setFeelingActivityOpen(false);
      setOpenPostMenuId(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);
      const safeQuery = query.replace(/[,%]/g, "").slice(0, 40);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, location, is_online")
        .or(`username.ilike.%${safeQuery}%,full_name.ilike.%${safeQuery}%`)
        .limit(8);

      if (error) {
        console.error("Search error:", error.message);
        setSearchResults([]);
      } else {
        setSearchResults((data || []) as ProfilePreview[]);
      }

      setSearchLoading(false);
    }, 240);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const handleOpenDashboardShowcaseComposer = () => {
    if (!currentUserId) {
      alert("Please sign in to create a Showcase.");
      return;
    }

    setShowcaseComposerOpen(true);
    setDashboardShowcaseError("");
  };

  const handleCloseDashboardShowcaseComposer = () => {
    if (dashboardShowcaseSaving) return;

    setShowcaseComposerOpen(false);
    setDashboardShowcaseTitle("");
    setDashboardShowcaseCoverText("");
    setDashboardShowcaseDuration("24h");
    setDashboardShowcaseVisibility("friends");
    setDashboardShowcaseMediaFile(null);
    setDashboardShowcaseMediaPreviewUrl("");
    setDashboardShowcaseMediaType("text");
    setDashboardShowcaseMediaFileName("");
    setDashboardShowcaseFontKey("inter");
    setDashboardShowcaseOverlayFontSize(SHOWCASE_OVERLAY_DEFAULT_FONT_SIZE);
    setDashboardShowcaseTextPosition({ x: 50, y: 50 });
    setDashboardShowcaseCustomizeOpen(false);
    setDashboardShowcasePreviewExpanded(false);
    setDashboardShowcaseMediaDragActive(false);
    setDashboardShowcaseError("");

    if (dashboardShowcaseInputRef.current) {
      dashboardShowcaseInputRef.current.value = "";
    }
  };

  const setDashboardShowcaseMediaFromFile = (file: File | null) => {
    setDashboardShowcaseError("");
    setDashboardShowcaseMediaDragActive(false);
    setDashboardShowcaseMediaFile(file);
  };

  const handleDashboardShowcaseMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setDashboardShowcaseMediaFromFile(file);
  };

  const handleDashboardShowcaseMediaDrop = (event: ReactDragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0] || null;
    setDashboardShowcaseMediaFromFile(file);
  };

  const handleDashboardShowcaseMediaDragOver = (event: ReactDragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDashboardShowcaseMediaDragActive(true);
  };

  const handleDashboardShowcaseMediaDragLeave = (event: ReactDragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDashboardShowcaseMediaDragActive(false);
  };

  const handleClearDashboardShowcaseMedia = () => {
    setDashboardShowcaseMediaFile(null);
    setDashboardShowcaseMediaPreviewUrl("");
    setDashboardShowcaseMediaType("text");
    setDashboardShowcaseMediaFileName("");
    setDashboardShowcaseMediaDragActive(false);
    if (dashboardShowcaseInputRef.current) {
      dashboardShowcaseInputRef.current.value = "";
    }
  };

  const handleCreateDashboardShowcase = async () => {
    if (!currentUserId) {
      setDashboardShowcaseError("Please sign in to create a Showcase.");
      return;
    }

    const cleanTitle = dashboardShowcaseTitle.trim();
    const cleanCoverText = dashboardShowcaseCoverText.trim();

    if (!cleanTitle && !cleanCoverText && !dashboardShowcaseMediaPreviewUrl) {
      setDashboardShowcaseError("Add a title, text, photo, or video first.");
      return;
    }

    setDashboardShowcaseSaving(true);
    setDashboardShowcaseError("");

    const now = Date.now();
    const expiresAt =
      dashboardShowcaseDuration === "24h"
        ? new Date(now + 24 * 60 * 60 * 1000).toISOString()
        : dashboardShowcaseDuration === "30d"
          ? new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;

    const insertPayload = {
      user_id: currentUserId,
      title: cleanTitle || cleanCoverText || "Showcase",
      cover_text: cleanCoverText,
      media_url: dashboardShowcaseMediaPreviewUrl || null,
      media_type: dashboardShowcaseMediaPreviewUrl ? dashboardShowcaseMediaType : "text",
      media_filename: dashboardShowcaseMediaFileName || null,
      font_key: dashboardShowcaseFontKey,
      text_position_x: dashboardShowcaseTextPosition.x,
      text_position_y: dashboardShowcaseTextPosition.y,
      overlay_font_size: clampShowcaseOverlayFontSize(dashboardShowcaseOverlayFontSize),
      duration: dashboardShowcaseDuration,
      visibility: dashboardShowcaseVisibility,
      expires_at: expiresAt,
    };

    const { error } = await supabase.from("profile_showcases").insert(insertPayload);

    if (error) {
      console.error("Could not create dashboard Showcase:", error);
      setDashboardShowcaseError(`Could not create Showcase: ${error.message}`);
      setDashboardShowcaseSaving(false);
      return;
    }

    await fetchFriendShowcases(currentUserId);
    setDashboardShowcaseSaving(false);
    handleCloseDashboardShowcaseComposer();
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/")
    );

    if (selectedFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPostImages((prev) => {
      const remainingSlots = Math.max(MAX_POST_IMAGES - prev.length, 0);
      const acceptedFiles = selectedFiles.slice(0, remainingSlots);

      if (selectedFiles.length > remainingSlots) {
        alert(`You can add up to ${MAX_POST_IMAGES} photos in one post.`);
      }

      return [...prev, ...acceptedFiles];
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (index?: number) => {
    if (typeof index === "number") {
      setPostImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index));
    } else {
      setPostImages([]);
      setPostImagePreviewUrls([]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePost = async () => {
    if (!content.trim() && postImages.length === 0 && !selectedFeelingActivity) {
      alert("Please add text, choose photos, or select a Feeling / Activity.");
      return;
    }

    if (postImages.length > MAX_POST_IMAGES) {
      alert(`You can add up to ${MAX_POST_IMAGES} photos in one post.`);
      return;
    }

    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("You must be logged in to post.");
      setLoading(false);
      return;
    }

    const uploadedImages: Array<{ image_url: string; storage_path: string; display_order: number }> = [];

    for (const [index, imageFile] of postImages.entries()) {
      const fileExt = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = fileExt.replace(/[^a-z0-9]/g, "") || "jpg";
      const fileName = `${user.id}/${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${safeExt}`;

      const { error: uploadError } = await supabase.storage.from("post-images").upload(fileName, imageFile, {
        cacheControl: "604800",
        upsert: false,
      });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        alert(`Upload error: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("post-images").getPublicUrl(fileName);
      uploadedImages.push({
        image_url: publicUrlData.publicUrl,
        storage_path: fileName,
        display_order: index,
      });
    }

    const finalContent = buildPostContentWithFeelingActivity(content, selectedFeelingActivity);
    const primaryImageUrl = uploadedImages[0]?.image_url || null;

    const { data: insertedPost, error: insertError } = await supabase
      .from("posts")
      .insert([
        {
          content: finalContent,
          user_id: user.id,
          image_url: primaryImageUrl,
        },
      ])
      .select("id, content, image_url, created_at, user_id")
      .single();

    if (insertError || !insertedPost) {
      alert(`Post error: ${insertError?.message || "Post could not be created."}`);
      setLoading(false);
      return;
    }

    if (uploadedImages.length > 0) {
      const { error: imageRowsError } = await supabase.from("post_images").insert(
        uploadedImages.map((uploadedImage) => ({
          post_id: insertedPost.id,
          user_id: user.id,
          image_url: uploadedImage.image_url,
          storage_path: uploadedImage.storage_path,
          display_order: uploadedImage.display_order,
        }))
      );

      if (imageRowsError) {
        alert(`Post image save error: ${imageRowsError.message}`);
        setLoading(false);
        return;
      }
    }

    setContent("");
    setSelectedFeelingActivity(null);
    setFeelingActivityOpen(false);
    handleRemoveImage();
    await fetchDashboardData(false);
    setLoading(false);
  };

  const handleLikeToggle = async (postId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in to like a post.");
      return;
    }

    const alreadyLiked = !!userLikes[postId];

    if (alreadyLiked) {
      const { error } = await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
      if (error) {
        alert(`Unlike error: ${error.message}`);
        return;
      }
      setUserLikes((prev) => ({ ...prev, [postId]: false }));
      setLikeCounts((prev) => ({ ...prev, [postId]: Math.max((prev[postId] || 1) - 1, 0) }));
    } else {
      const { error } = await supabase.from("likes").insert([{ user_id: user.id, post_id: postId }]);
      if (error) {
        alert(`Like error: ${error.message}`);
        return;
      }
      setUserLikes((prev) => ({ ...prev, [postId]: true }));
      setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    }
  };

  const handleShare = async (postId: string) => {
    const shareUrl = `${window.location.origin}/dashboard#post-${postId}`;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please log in to share posts.");
      return;
    }

    const confirmed = window.confirm(
      "Share this post to your Parapost feed? It will appear on the dashboard timeline and on your profile."
    );

    if (!confirmed) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Post link copied.");
      } catch {
        window.prompt("Copy this post link:", shareUrl);
      }
      return;
    }

    const caption = window.prompt("Add a caption for your share, or leave blank:", "") || "";
    const trimmedCaption = caption.trim();

    const { error } = await supabase.from("shares").insert([
      {
        post_id: postId,
        user_id: user.id,
        caption: trimmedCaption || null,
        share_destination: "feed",
      },
    ]);

    if (error) {
      alert(`Share error: ${error.message}`);
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      console.error("Clipboard error:", error);
    }

    setShareCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    await fetchDashboardData(false);
    alert("Shared to your feed and profile. Post link copied too.");
  };

  const handleStartEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setEditingPostContent(post.content || "");
    setOpenPostMenuId(null);
  };

  const handleSavePostEdit = async (postId: string) => {
    const trimmed = editingPostContent.trim();

    const { error } = await supabase
      .from("posts")
      .update({ content: trimmed })
      .eq("id", postId)
      .eq("user_id", currentUserId);

    if (error) {
      alert(`Edit post error: ${error.message}`);
      return;
    }

    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, content: trimmed } : post)));
    setSharedPostItems((prev) =>
      prev.map((item) =>
        item.original_post.id === postId
          ? { ...item, original_post: { ...item.original_post, content: trimmed } }
          : item
      )
    );
    setEditingPostId(null);
    setEditingPostContent("");
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Delete this post?")) return;

    const { data: commentRows } = await supabase
      .from("comments")
      .select("id")
      .eq("post_id", postId);

    const commentIds = (commentRows || []).map((comment) => comment.id).filter(Boolean);

    if (commentIds.length > 0) {
      await supabase.from("comment_likes").delete().in("comment_id", commentIds);
      await supabase.from("comment_reports").delete().in("comment_id", commentIds);
    }

    await supabase.from("likes").delete().eq("post_id", postId);
    await supabase.from("shares").delete().eq("post_id", postId);
    await supabase.from("reposts").delete().eq("post_id", postId);
    await supabase.from("comments").delete().eq("post_id", postId);

    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", currentUserId);
    if (error) {
      alert(`Delete post error: ${error.message}`);
      return;
    }

    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setSharedPostItems((prev) =>
      prev.filter((item) => item.post_id !== postId && item.original_post.id !== postId)
    );
    setOpenPostMenuId(null);
  };

  const handleDeleteSharedPostShare = async (shareId: string, postId: string) => {
    if (!currentUserId) return;
    if (!window.confirm("Remove this shared post from your feed?")) return;

    const deletedAt = new Date().toISOString();

    const { error: softDeleteError } = await supabase
      .from("shares")
      .update({ deleted_at: deletedAt })
      .eq("id", shareId)
      .eq("user_id", currentUserId);

    if (softDeleteError) {
      const { error: hardDeleteError } = await supabase
        .from("shares")
        .delete()
        .eq("id", shareId)
        .eq("user_id", currentUserId);

      if (hardDeleteError) {
        alert(`Remove shared post error: ${hardDeleteError.message}`);
        return;
      }
    }

    setSharedPostItems((prev) => prev.filter((item) => item.id !== shareId));
    setShareCounts((prev) => ({
      ...prev,
      [postId]: Math.max((prev[postId] || 1) - 1, 0),
    }));
    setOpenPostMenuId(null);
  };

  const handleDeleteReelShare = async (shareId: string) => {
    if (!currentUserId) return;
    if (!window.confirm("Remove this shared reel from your feed?")) return;

    const { error } = await supabase
      .from("reel_shares")
      .delete()
      .eq("id", shareId)
      .eq("user_id", currentUserId);

    if (error) {
      alert(`Remove shared reel error: ${error.message}`);
      return;
    }

    setSharedReelItems((prev) => prev.filter((item) => item.id !== shareId));
  };

  const handleFollowToggle = async (targetUserId: string) => {
    if (!currentUserId || !targetUserId || targetUserId === currentUserId) return;

    const alreadyFollowing = !!followingMap[targetUserId];

    if (alreadyFollowing) {
      const { error } = await supabase
        .from("followers")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", targetUserId);

      if (error) {
        alert(`Unfollow error: ${error.message}`);
        return;
      }

      setFollowingMap((prev) => ({ ...prev, [targetUserId]: false }));
      setFollowedUserIds((prev) => prev.filter((id) => id !== targetUserId));
    } else {
      const { error } = await supabase
        .from("followers")
        .insert([{ follower_id: currentUserId, following_id: targetUserId }]);

      if (error) {
        alert(`Follow error: ${error.message}`);
        return;
      }

      setFollowingMap((prev) => ({ ...prev, [targetUserId]: true }));
      setFollowedUserIds((prev) => [...new Set([...prev, targetUserId])]);
    }
  };

  const scrollToComposer = useCallback(() => {
    const composer = mainComposerRef.current || document.getElementById("dashboard-create-post");
    if (!composer) return;

    composer.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      const composerInput = document.getElementById("dashboard-create-post-input") as HTMLTextAreaElement | null;
      composerInput?.focus();
    }, 380);
  }, []);

  const openSearch = () => {
    setSearchOpen(true);
    window.setTimeout(() => {
      const input = document.getElementById("dashboard-search-modal-input") as HTMLInputElement | null;
      input?.focus();
    }, 50);
  };

  const searchBox = (
    <div className="dashboard-search-parapost" style={searchWrapStyle}>
      <SearchIcon size={18} />
      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onFocus={() => setSearchOpen(true)}
        placeholder="Search Parapost"
        style={searchInputStyle}
      />
      {searchOpen && searchQuery.trim().length >= 2 ? (
        <div style={searchDropdownStyle}>
          <SearchResults
            searchLoading={searchLoading}
            searchResults={searchResults}
            onClose={() => setSearchOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div style={dashboardRootStyle}>
      <div style={backgroundGlowStyle} />
      <div className="dashboard-shell-pad" style={dashboardShellStyle}>
        <MobileDashboardHeader
          currentProfile={currentProfile}
          notificationsCount={notificationsCount}
          onOpenSearch={openSearch}
        />

        <div className="dashboard-grid-desktop-safe" style={dashboardGridStyle}>
          <aside className="dashboard-desktop-left" style={leftSidebarStyle}>
            <SidebarLogo />
            <nav style={sidebarNavStyle}>
              <SidebarLink href="/dashboard" active icon={<HomeIcon />} label="Home" />
              <SidebarLink href="/reels" icon={<SidebarParapostReelIcon />} label="Parapost Reels" />
              <SidebarButton label="Live" badge="Soon" muted />
              <SidebarLink href="/friends" label="Friends" badge={pendingFriendRequestCount || undefined} />
              <SidebarButton label="Groups" muted />
              <SidebarLink href="/messages" label="Parachat" badge={notificationsCount || undefined} />
              <SidebarLink href="/notifications" label="Notifications" badge={notificationsCount || undefined} />
              <SidebarButton label="Bookmarks" muted />
              <SidebarButton label="Explore" muted />
              <SidebarButton label="Events" muted />
              <SidebarLink href="/settings" label="Settings" />
            </nav>

            <div style={sidebarDividerStyle} />
            <div style={sidebarSectionHeaderRowStyle}>
              <div style={{ ...sidebarSectionLabelStyle, marginBottom: 0 }}>Parapost Hub</div>
              <span style={sidebarSectionSoonBadgeStyle}>Soon</span>
            </div>
            <div style={paranormalHubIntroStyle}>
              Investigation tools, evidence collections, case files, and field reports are coming soon.
            </div>
            <nav style={sidebarNavStyle}>
              <SidebarButton label="Investigations" badge="Soon" muted />
              <SidebarButton label="Evidence Vault" badge="Soon" muted />
              <SidebarButton label="Podcasts" badge="Soon" muted />
              <SidebarButton label="Events" badge="Soon" muted />
            </nav>

            <div style={goLiveCardStyle} aria-disabled="true" title="Live streaming is coming soon.">
              <span style={goLiveIconStyle}>+</span>
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: "block", color: "#fff" }}>Go Live</strong>
                <span style={{ color: "var(--parapost-accent-readable-text)", fontSize: 12 }}>Coming soon</span>
              </span>
              <span style={goLiveSoonBadgeStyle}>Soon</span>
            </div>

            <Link href={currentUserId ? `/profile/${currentUserId}` : "/dashboard"} style={sidebarProfileStyle}>
              <Avatar profile={currentProfile} size={38} />
              <span style={{ minWidth: 0 }}>
                <strong style={{ display: "block", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {currentProfile?.full_name || currentProfile?.username || "My Profile"}
                </strong>
                <span style={{ color: "#9ca3af", fontSize: 12 }}>View Profile</span>
              </span>
            </Link>
          </aside>

          <main className="dashboard-main-column" style={mainColumnStyle}>
            <div className="dashboard-desktop-topbar" style={desktopTopBarStyle}>
              {searchBox}
              <div style={topActionRowStyle}>
                <Link href="/notifications" style={topIconButtonStyle} aria-label="Notifications">
                  <BellIcon />
                  {notificationsCount > 0 ? <span style={topBadgeStyle}>{notificationsCount > 99 ? "99+" : notificationsCount}</span> : null}
                </Link>
                <Link href="/messages" style={topIconButtonStyle} aria-label="Parachat">
                  <ChatIcon />
                </Link>
                <Link
                  href={currentUserId ? `/profile/${currentUserId}` : "/dashboard"}
                  style={topProfileButtonStyle}
                  aria-label="My profile"
                >
                  <Avatar profile={currentProfile} size={36} />
                </Link>
              </div>
            </div>

            <ShowcaseQuickActions currentProfile={currentProfile} currentUserId={currentUserId} friendShowcases={friendShowcases} onCreateShowcase={handleOpenDashboardShowcaseComposer} />

            <ComposerCard
              composerRef={mainComposerRef}
              currentProfile={currentProfile}
              firstName={firstName}
              content={content}
              setContent={setContent}
              images={postImages}
              imagePreviewUrls={postImagePreviewUrls}
              loading={loading}
              selectedFeelingActivity={selectedFeelingActivity}
              fileInputRef={fileInputRef}
              onImageChange={handleImageChange}
              onRemoveImage={handleRemoveImage}
              onOpenFeelingActivity={() => setFeelingActivityOpen(true)}
              onClearFeelingActivity={() => setSelectedFeelingActivity(null)}
              onPost={handlePost}
            />

            <DashboardReelsSection />

            <FeedTabs feedMode={feedMode} setFeedMode={setFeedMode} />

            <FeedPulseStrip
              itemCount={filteredFeedItems.length}
              totalLikes={totalLikes}
              totalComments={totalComments}
              totalShares={totalShares}
            />

            <MobileDashboardUtilityRail
              currentProfile={currentProfile}
              currentUserId={currentUserId}
              recentlyViewed={recentlyViewed}
              peopleToDiscover={peopleToDiscover}
              followedCount={followedUserIds.length}
              feedItems={mixedFeedItems.length}
              totalLikes={totalLikes}
              totalComments={totalComments}
              totalShares={totalShares}
              onCreatePost={scrollToComposer}
            />

            <section style={feedStackStyle}>
              {fetchingPosts ? (
                <DashboardEmptyState title="Loading your feed" text="Parapost Network is pulling in posts, shared reels, and profile activity." />
              ) : filteredFeedItems.length === 0 ? (
                <DashboardEmptyState
                  title={
                    feedMode === "friends"
                      ? "No friend posts yet"
                      : feedMode === "following"
                        ? "No followed posts yet"
                        : "No posts yet"
                  }
                  text={
                    feedMode === "friends"
                      ? "Posts from accepted friends will appear here automatically."
                      : feedMode === "following"
                        ? "Follow more members to build your personal feed."
                        : "Be the first to share an update, photo, video, thought, or Parapost Reel."
                  }
                />
              ) : (
                <>
                  {visibleFeedItems.map((item) =>
                    item.type === "post" ? (
                      <PostCard
                        key={`post-${item.post.id}`}
                        post={item.post}
                        profile={profilesMap[item.post.user_id]}
                        currentUserId={currentUserId}
                        isLiked={!!userLikes[item.post.id]}
                        likeCount={likeCounts[item.post.id] || 0}
                        commentCount={commentCounts[item.post.id] || 0}
                        shareCount={shareCounts[item.post.id] || 0}
                        isFollowing={!!followingMap[item.post.user_id]}
                        isFriend={acceptedFriendUserIds.includes(item.post.user_id)}
                        openPostMenuId={openPostMenuId}
                        editingPostId={editingPostId}
                        editingPostContent={editingPostContent}
                        setEditingPostContent={setEditingPostContent}
                        setOpenPostMenuId={setOpenPostMenuId}
                        onLike={() => handleLikeToggle(item.post.id)}
                        onShare={() => handleShare(item.post.id)}
                        onStartEdit={() => handleStartEditPost(item.post)}
                        onSaveEdit={() => handleSavePostEdit(item.post.id)}
                        onCancelEdit={() => {
                          setEditingPostId(null);
                          setEditingPostContent("");
                        }}
                        onDelete={() => handleDeletePost(item.post.id)}
                      />
                    ) : item.type === "shared_post" ? (
                      <SharedPostCard
                        key={`shared-post-${item.sharedPost.id}`}
                        sharedPost={item.sharedPost}
                        sharerProfile={profilesMap[item.sharedPost.user_id]}
                        originalProfile={profilesMap[item.sharedPost.original_post.user_id]}
                        currentUserId={currentUserId}
                        openPostMenuId={openPostMenuId}
                        editingPostId={editingPostId}
                        editingPostContent={editingPostContent}
                        setEditingPostContent={setEditingPostContent}
                        setOpenPostMenuId={setOpenPostMenuId}
                        onStartEditOriginal={() => handleStartEditPost(item.sharedPost.original_post)}
                        onSaveEditOriginal={() => handleSavePostEdit(item.sharedPost.original_post.id)}
                        onCancelEditOriginal={() => {
                          setEditingPostId(null);
                          setEditingPostContent("");
                        }}
                        onDeleteOriginal={() => handleDeletePost(item.sharedPost.original_post.id)}
                        onRemoveShare={() => handleDeleteSharedPostShare(item.sharedPost.id, item.sharedPost.post_id)}
                      />
                    ) : (
                      <SharedReelCard
                        key={`shared-${item.share.id}`}
                        shared={item.share}
                        sharerProfile={profilesMap[item.share.user_id]}
                        creatorProfile={profilesMap[item.share.creator_profile_id || ""] || profilesMap[item.share.reel_user_id]}
                        currentUserId={currentUserId}
                        onDelete={() => handleDeleteReelShare(item.share.id)}
                      />
                    )
                  )}

                  {hasMoreFeedItems ? <div ref={feedLoadMoreSentinelRef} style={feedLoadMoreSentinelStyle} /> : null}
                </>
              )}
            </section>
          </main>

          <aside className="dashboard-right-rail" style={rightRailStyle}>
            {currentUserId ? (
              <RightRailCard title="Network Pulse" action="Active">
                <RailHeroProfile
                  profile={currentProfile}
                  currentUserId={currentUserId}
                  userEmail={userEmail}
                />

                <div style={railStatGridStyle}>
                  <RailStatTile label="Following" value={followedUserIds.length.toString()} />
                  <RailStatTile label="Feed Items" value={mixedFeedItems.length.toString()} />
                  <RailStatTile label="Likes" value={totalLikes.toString()} />
                  <RailStatTile label="Comments" value={totalComments.toString()} />
                </div>
              </RightRailCard>
            ) : null}

            <RightRailCard title="People to Discover" action="Fresh">
              {peopleToDiscover.length === 0 ? (
                <p style={mutedTextStyle}>New members with completed bios will appear here automatically.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {peopleToDiscover.map((profile) => (
                    <Link key={profile.id} href={`/profile/${profile.id}`} style={discoverProfileRowStyle}>
                      <Avatar profile={profile} size={38} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <strong style={railNameStyle}>{profile.full_name || profile.username || "Parapost user"}</strong>
                        <span style={railMetaStyle}>@{profile.username || "member"}</span>
                      </span>
                      <span style={miniArrowStyle}>›</span>
                    </Link>
                  ))}
                </div>
              )}
            </RightRailCard>

            <RightRailCard title="Recently Viewed" action="Private">
              <div style={privacyNoticeStyle}>Only you can see the profiles you recently viewed.</div>
              {recentlyViewed.length === 0 ? (
                <p style={mutedTextStyle}>Profiles you view will appear here privately.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {recentlyViewed.slice(0, 5).map((profile) => (
                    <Link key={profile.id} href={`/profile/${profile.id}`} style={recentProfileRowStyle}>
                      <Avatar profile={profile} size={34} />
                      <span style={{ minWidth: 0 }}>
                        <strong style={railNameStyle}>{profile.full_name || profile.username || "Parapost user"}</strong>
                        <span style={railMetaStyle}>@{profile.username || "member"}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </RightRailCard>

            <RightRailCard title="Parapost Reels" action="Explore">
              <div style={reelsRailFeatureStyle}>
                <div style={reelsRailIconStyle}>▶</div>
                <div style={{ minWidth: 0 }}>
                  <strong style={railNameStyle}>Discover new Parapost Reels</strong>
                  <span style={railMetaStyle}>Short videos, investigations, creator moments, and shared reels.</span>
                </div>
              </div>
              <Link href="/reels" style={railPrimaryLinkStyle}>Open Explore Reels</Link>
            </RightRailCard>

            <RightRailCard title="Trending in Parapost" action="Updated">
              {trendingTopics.map((topic, index) => (
                <TrendingItem
                  key={`${topic.title}-${index}`}
                  rank={(index + 1).toString()}
                  title={topic.title}
                  meta={topic.meta}
                />
              ))}
            </RightRailCard>

            <RightRailCard title="Sponsor / Advertising" action="Coming soon">
              <div style={sponsorCardStyle}>
                <div style={sponsorIconStyle}>★</div>
                <div>
                  <strong style={railNameStyle}>Advertise with Parapost Network</strong>
                  <span style={railMetaStyle}>Promote your brand, event, product, or creator campaign to the Parapost community. Sponsorship and advertising tools are coming soon.</span>
                </div>
              </div>
            </RightRailCard>
          </aside>
        </div>
      </div>

      {showcaseComposerOpen ? (
        <DashboardShowcaseComposerModal
          currentProfile={currentProfile}
          title={dashboardShowcaseTitle}
          coverText={dashboardShowcaseCoverText}
          duration={dashboardShowcaseDuration}
          visibility={dashboardShowcaseVisibility}
          mediaPreviewUrl={dashboardShowcaseMediaPreviewUrl}
          mediaType={dashboardShowcaseMediaType}
          mediaFileName={dashboardShowcaseMediaFileName}
          fontKey={dashboardShowcaseFontKey}
          overlayFontSize={dashboardShowcaseOverlayFontSize}
          textPosition={dashboardShowcaseTextPosition}
          customizeOpen={dashboardShowcaseCustomizeOpen}
          previewExpanded={dashboardShowcasePreviewExpanded}
          mediaDragActive={dashboardShowcaseMediaDragActive}
          error={dashboardShowcaseError}
          saving={dashboardShowcaseSaving}
          mediaInputRef={dashboardShowcaseInputRef}
          setTitle={setDashboardShowcaseTitle}
          setCoverText={setDashboardShowcaseCoverText}
          setDuration={setDashboardShowcaseDuration}
          setVisibility={setDashboardShowcaseVisibility}
          setFontKey={setDashboardShowcaseFontKey}
          setOverlayFontSize={setDashboardShowcaseOverlayFontSize}
          setTextPosition={setDashboardShowcaseTextPosition}
          setCustomizeOpen={setDashboardShowcaseCustomizeOpen}
          setPreviewExpanded={setDashboardShowcasePreviewExpanded}
          onMediaChange={handleDashboardShowcaseMediaChange}
          onMediaDrop={handleDashboardShowcaseMediaDrop}
          onMediaDragOver={handleDashboardShowcaseMediaDragOver}
          onMediaDragLeave={handleDashboardShowcaseMediaDragLeave}
          onClearMedia={handleClearDashboardShowcaseMedia}
          onClose={handleCloseDashboardShowcaseComposer}
          onCreate={handleCreateDashboardShowcase}
        />
      ) : null}

      <MobileBottomNav currentUserId={currentUserId} notificationsCount={notificationsCount} onCreatePost={scrollToComposer} />

      {feelingActivityOpen ? (
        <FeelingActivityModal
          selectedFeelingActivity={selectedFeelingActivity}
          onSelect={(option) => {
            setSelectedFeelingActivity(option);
            setFeelingActivityOpen(false);
          }}
          onClear={() => {
            setSelectedFeelingActivity(null);
            setFeelingActivityOpen(false);
          }}
          onClose={() => setFeelingActivityOpen(false)}
        />
      ) : null}

      {searchOpen ? (
        <SearchModal
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchLoading={searchLoading}
          searchResults={searchResults}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}

      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }

        .profile-showcase-modal-header,
        .profile-showcase-studio-layout,
        .profile-showcase-modal-actions {
          direction: ltr;
        }

        /* Dashboard Showcase modal scrollbar: visible right-side scroll, matching profile behavior. */
        .profile-showcase-modal-shell {
          direction: ltr !important;
          scrollbar-width: auto !important;
          scrollbar-color: rgba(255,255,255,0.82) rgba(255,255,255,0.12) !important;
          -ms-overflow-style: auto !important;
        }

        .profile-showcase-modal-shell::-webkit-scrollbar {
          display: block !important;
          width: 12px !important;
          height: 12px !important;
        }

        .profile-showcase-modal-shell::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.10) !important;
          border-radius: 999px !important;
          margin: 16px 0 !important;
        }

        .profile-showcase-modal-shell::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.78) !important;
          border-radius: 999px !important;
          border: 2px solid rgba(8,10,16,0.95) !important;
        }

        .profile-showcase-modal-shell::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.92) !important;
        }

        .profile-showcase-font-select {
          color-scheme: dark !important;
          background: rgba(7,10,16,0.98) !important;
          color: #ffffff !important;
          border: 1px solid rgba(255,255,255,0.16) !important;
          border-radius: 12px !important;
          outline: none !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04) !important;
        }

        .profile-showcase-font-select:focus {
          border-color: color-mix(in srgb, var(--parapost-accent-2) 62%, rgba(255,255,255,0.16)) !important;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--parapost-accent-2) 22%, transparent),
            0 0 20px color-mix(in srgb, var(--parapost-accent-2) 16%, transparent) !important;
        }

        .profile-showcase-font-select option {
          background: #080b12 !important;
          color: #ffffff !important;
        }

        .profile-showcase-modal-shell {
          direction: ltr;
          scrollbar-width: auto;
          -ms-overflow-style: auto;
        }

        .profile-showcase-modal-shell::-webkit-scrollbar {
          width: auto;
          height: auto;
        }

        .profile-showcase-modal-shell::-webkit-scrollbar-track {
          background: initial;
          border-radius: initial;
          margin: initial;
        }

        .profile-showcase-modal-shell::-webkit-scrollbar-thumb {
          background: initial;
          border-radius: initial;
          border: initial;
        }



        .profile-showcase-visibility-symbol {
          position: relative;
          width: 19px;
          height: 19px;
          display: block;
        }

        .profile-showcase-visibility-symbol-public::before {
          content: "";
          position: absolute;
          inset: 2px;
          border: 2px solid rgba(255,255,255,0.90);
          border-radius: 999px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);
        }

        .profile-showcase-visibility-symbol-public::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 2px;
          bottom: 2px;
          width: 2px;
          transform: translateX(-50%);
          background: rgba(255,255,255,0.86);
          box-shadow: -5px 0 0 -1px rgba(255,255,255,0.72), 5px 0 0 -1px rgba(255,255,255,0.72);
          border-radius: 999px;
        }

        .profile-showcase-visibility-symbol-friends::before,
        .profile-showcase-visibility-symbol-friends::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          background: rgba(255,255,255,0.92);
        }

        .profile-showcase-visibility-symbol-friends::before {
          width: 8px;
          height: 8px;
          left: 2px;
          top: 3px;
          box-shadow: 7px 0 0 rgba(255,255,255,0.78);
        }

        .profile-showcase-visibility-symbol-friends::after {
          left: 0;
          right: 0;
          bottom: 2px;
          height: 8px;
          border-radius: 9px 9px 6px 6px;
        }

        .profile-showcase-visibility-symbol-private::before {
          content: "";
          position: absolute;
          left: 3px;
          right: 3px;
          bottom: 2px;
          height: 10px;
          border-radius: 4px;
          background: rgba(255,255,255,0.92);
        }

        .profile-showcase-visibility-symbol-private::after {
          content: "";
          position: absolute;
          left: 5px;
          top: 1px;
          width: 9px;
          height: 9px;
          border: 2px solid rgba(255,255,255,0.92);
          border-bottom: 0;
          border-radius: 9px 9px 0 0;
        }


        @media (max-width: 1180px) {
          .dashboard-desktop-left,
          .dashboard-right-rail {
            display: none !important;
          }

          .dashboard-mobile-insights {
            display: grid !important;
          }
        }

        @media (min-width: 1181px) {
          .dashboard-mobile-insights {
            display: none !important;
          }
        }

        @media (min-width: 761px) and (max-width: 1180px) {
          .dashboard-shell-pad {
            padding: 24px 18px 48px !important;
          }

          .dashboard-main-column {
            width: min(920px, 100%) !important;
            max-width: 920px !important;
            margin: 0 auto !important;
          }

          .dashboard-desktop-topbar {
            position: sticky !important;
            top: 12px !important;
            z-index: 50 !important;
            padding: 10px !important;
            border-radius: 26px !important;
            background: rgba(5, 7, 13, 0.82) !important;
            backdrop-filter: blur(18px) !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
          }

          .dashboard-composer-card,
          .dashboard-feed-card {
            border-radius: 28px !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-desktop-topbar {
            display: none !important;
          }

          .dashboard-composer-card {
            padding: 14px !important;
          }

          .dashboard-composer-top-row {
            grid-template-columns: auto minmax(0, 1fr) !important;
          }

          .dashboard-composer-top-row > button {
            display: none !important;
          }

          .dashboard-composer-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .dashboard-composer-footer {
            align-items: stretch !important;
          }

          .dashboard-composer-footer > button {
            width: 100% !important;
            margin-left: 0 !important;
          }

          .dashboard-shell-pad {
            padding: 0 0 96px !important;
          }

          .dashboard-main-column {
            max-width: 100% !important;
            padding: 0 14px 0 !important;
          }

          .dashboard-card {
            border-radius: 24px !important;
          }

          .dashboard-feed-pulse {
            grid-template-columns: 1fr !important;
          }

          .dashboard-feed-pulse-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .dashboard-post-header {
            align-items: flex-start !important;
          }

          .dashboard-post-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .dashboard-shared-reel-frame {
            grid-template-columns: 1fr !important;
          }

          .dashboard-mobile-header {
            display: flex !important;
          }

          .dashboard-bottom-nav {
            display: grid !important;
          }
        }

        /* === Phase 6 dashboard responsive safety polish === */
        body {
          overflow-x: hidden;
          background: #07090d;
        }

        .dashboard-main-column,
        .dashboard-feed-card,
        .dashboard-card {
          min-width: 0;
        }

        .dashboard-card {
          overflow-wrap: anywhere;
        }

        .dashboard-card img,
        .dashboard-card video {
          max-width: 100%;
        }

        @media (max-width: 1180px) {
          .dashboard-desktop-topbar {
            max-width: 920px;
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }

        @media (max-width: 920px) {
          .dashboard-composer-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-mobile-header {
            padding-top: max(14px, env(safe-area-inset-top)) !important;
          }

          .dashboard-bottom-nav {
            bottom: max(10px, env(safe-area-inset-bottom)) !important;
          }

          .dashboard-card {
            box-shadow: 0 12px 34px rgba(0,0,0,0.26) !important;
          }

          .dashboard-feed-card {
            padding: 14px !important;
          }

          .dashboard-post-actions button {
            min-height: 38px !important;
            font-size: 12px !important;
          }
        }

        /* === Phase 7 dashboard search + header polish === */
        .dashboard-search-parapost {
          transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease, transform 180ms ease;
        }

        .dashboard-search-parapost:focus-within {
          border-color: color-mix(in srgb, var(--parapost-accent-text) 62%, transparent) !important;
          background: rgba(255,255,255,0.075) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 4px color-mix(in srgb, var(--parapost-accent-2) 11%, transparent), 0 18px 42px rgba(0,0,0,0.26) !important;
        }

        .dashboard-search-parapost input::placeholder {
          color: rgba(209,213,219,0.78);
        }

        .dashboard-desktop-topbar {
          min-width: 0;
        }

        .dashboard-desktop-topbar > div:first-child {
          min-width: 0;
        }

        @media (min-width: 1181px) {
          .dashboard-desktop-topbar {
            position: sticky !important;
            top: 16px !important;
            z-index: 45 !important;
            padding: 10px !important;
            margin: -10px -10px 18px !important;
            border-radius: 28px !important;
            background: linear-gradient(180deg, rgba(5,7,13,0.76), rgba(5,7,13,0.48)) !important;
            backdrop-filter: blur(18px) !important;
            border: 1px solid rgba(255,255,255,0.07) !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-search-modal-bar {
            height: 48px !important;
            border-radius: 18px !important;
          }

          .dashboard-mobile-header {
            box-shadow: 0 14px 32px rgba(0,0,0,0.22) !important;
          }

          .dashboard-mobile-header a:first-child {
            min-width: 0 !important;
          }

          .dashboard-mobile-header a:first-child > div:last-child {
            min-width: 0 !important;
          }
        }

        @media (max-width: 430px) {
          .dashboard-mobile-header {
            gap: 8px !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          .dashboard-mobile-header a:first-child > div:first-child {
            width: 46px !important;
            height: 46px !important;
          }

          .dashboard-mobile-header a:first-child > div:last-child > div:first-child {
            font-size: 21px !important;
          }

          .dashboard-mobile-header a:first-child > div:last-child > div:last-child {
            font-size: 10px !important;
            letter-spacing: 0.32em !important;
          }

          .dashboard-mobile-header button,
          .dashboard-mobile-header a[aria-label="Notifications"],
          .dashboard-mobile-header a[aria-label="Parachat"] {
            width: 38px !important;
            height: 38px !important;
            border-radius: 13px !important;
          }
        }


        /* === Phase 8 dashboard showcase + quick actions polish === */
        .dashboard-showcase-quick-card {
          overflow: hidden;
        }

        .dashboard-showcase-scroll {
          scrollbar-width: thin;
          scrollbar-color: color-mix(in srgb, var(--parapost-accent-2) 45%, transparent) rgba(255,255,255,0.04);
        }

        .dashboard-showcase-scroll::-webkit-scrollbar {
          height: 6px;
        }

        .dashboard-showcase-scroll::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--parapost-accent-2) 44%, transparent);
          border-radius: 999px;
        }

        @media (max-width: 920px) {
          .dashboard-showcase-quick-grid {
            grid-template-columns: 1fr !important;
          }

          .dashboard-quick-actions-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 520px) {
          .dashboard-showcase-quick-card {
            padding: 13px !important;
          }

          .dashboard-quick-actions-grid {
            grid-template-columns: 1fr !important;
          }
        }



        /* === Phase 10 dashboard mobile/tablet template alignment === */
        /* Keeps Phase 10 mobile/tablet safety polish, but leaves the Showcase/Quick Actions section at the Phase 9 layout. */
        .dashboard-shell-pad,
        .dashboard-main-column,
        .dashboard-card,
        .dashboard-feed-card,
        .dashboard-mobile-insights,
        .dashboard-right-card {
          box-sizing: border-box;
        }

        .dashboard-main-column {
          isolation: isolate;
        }

        .dashboard-card,
        .dashboard-feed-card,
        .dashboard-right-card {
          transform: translateZ(0);
        }

        @media (min-width: 1181px) {
          .dashboard-grid-desktop-safe {
            align-items: start;
          }

          .dashboard-main-column {
            gap: 18px !important;
          }
        }

        @media (min-width: 761px) and (max-width: 1180px) {
          .dashboard-shell-pad {
            padding: 18px 18px 74px !important;
          }

          .dashboard-main-column {
            width: min(940px, 100%) !important;
            max-width: 940px !important;
            margin: 0 auto !important;
            gap: 18px !important;
          }

          .dashboard-desktop-topbar {
            display: flex !important;
            min-height: 68px !important;
          }

          .dashboard-search-parapost {
            max-width: min(560px, 58vw) !important;
          }

          .dashboard-composer-card,
          .dashboard-feed-card,
          .dashboard-mobile-insights {
            border-radius: 30px !important;
          }

          .dashboard-mobile-insights {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            align-items: start !important;
          }

          .dashboard-mobile-insights > div:first-child,
          .dashboard-mobile-insights > div:nth-child(2),
          .dashboard-mobile-insights > div:nth-child(3),
          .dashboard-mobile-insights > div:nth-child(4) {
            grid-column: 1 / -1;
          }

          .dashboard-mobile-insights > div:nth-child(5),
          .dashboard-mobile-insights > div:nth-child(6) {
            min-height: 128px;
          }

          .dashboard-composer-actions {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }

          .dashboard-post-actions {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-shell-pad {
            padding: 0 0 calc(112px + env(safe-area-inset-bottom)) !important;
          }

          .dashboard-mobile-header {
            min-height: 70px !important;
            padding: max(12px, env(safe-area-inset-top)) 12px 10px !important;
          }

          .dashboard-mobile-header a:first-child {
            flex: 1 1 auto !important;
            min-width: 0 !important;
            gap: 9px !important;
          }

          .dashboard-mobile-header a:first-child > div:first-child {
            width: 46px !important;
            height: 46px !important;
            min-width: 46px !important;
          }

          .dashboard-mobile-header a:first-child > div:last-child {
            min-width: 0 !important;
            overflow: hidden !important;
          }

          .dashboard-mobile-header a:first-child > div:last-child > div:first-child {
            font-size: clamp(19px, 6vw, 24px) !important;
            line-height: 0.96 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .dashboard-mobile-header a:first-child > div:last-child > div:last-child {
            font-size: clamp(9px, 2.8vw, 12px) !important;
            letter-spacing: clamp(0.22em, 4vw, 0.38em) !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .dashboard-mobile-header button,
          .dashboard-mobile-header a[aria-label="Notifications"],
          .dashboard-mobile-header a[aria-label="Parachat"] {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            border-radius: 14px !important;
          }

          .dashboard-main-column {
            padding: 0 12px !important;
            gap: 14px !important;
          }

          .dashboard-composer-card {
            padding: 13px !important;
            border-radius: 24px !important;
          }

          .dashboard-composer-top-row {
            gap: 10px !important;
          }

          .dashboard-composer-top-row textarea {
            min-height: 78px !important;
            border-radius: 20px !important;
          }

          .dashboard-composer-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .dashboard-composer-actions a,
          .dashboard-composer-actions button {
            min-height: 42px !important;
            padding: 8px 10px !important;
            font-size: 12px !important;
          }

          .dashboard-composer-footer {
            gap: 10px !important;
          }

          .dashboard-feed-pulse {
            border-radius: 22px !important;
            padding: 13px !important;
          }

          .dashboard-feed-card {
            border-radius: 23px !important;
            padding: 14px !important;
          }

          .dashboard-post-header {
            gap: 10px !important;
          }

          .dashboard-post-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 7px !important;
          }

          .dashboard-post-actions button {
            min-height: 39px !important;
            border-radius: 13px !important;
          }

          .dashboard-shared-reel-frame {
            grid-template-columns: 1fr !important;
            padding: 11px !important;
          }

          .dashboard-shared-reel-frame a:first-child {
            width: min(210px, 68vw) !important;
            margin: 0 auto !important;
          }

          .dashboard-mobile-insights {
            margin-top: 0 !important;
            padding: 13px !important;
            border-radius: 24px !important;
            gap: 12px !important;
          }

          .dashboard-mobile-insights > div {
            min-width: 0 !important;
          }

          .dashboard-bottom-nav {
            left: 10px !important;
            right: 10px !important;
            bottom: max(9px, env(safe-area-inset-bottom)) !important;
            min-height: 72px !important;
            padding: 7px 8px !important;
            border-radius: 25px !important;
          }

          .dashboard-bottom-nav a span:last-child {
            font-size: 10.5px !important;
          }
        }

        @media (max-width: 420px) {
          .dashboard-main-column {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .dashboard-composer-actions {
            grid-template-columns: 1fr 1fr !important;
          }

          .dashboard-post-actions {
            grid-template-columns: 1fr 1fr !important;
          }

          .dashboard-bottom-nav {
            left: 8px !important;
            right: 8px !important;
          }
        }

        @media (max-width: 360px) {
          .dashboard-mobile-header a:first-child > div:last-child > div:first-child {
            font-size: 18px !important;
          }

          .dashboard-mobile-header button,
          .dashboard-mobile-header a[aria-label="Notifications"],
          .dashboard-mobile-header a[aria-label="Parachat"] {
            width: 36px !important;
            height: 36px !important;
            min-width: 36px !important;
          }

          .dashboard-bottom-nav a span:last-child {
            display: none !important;
          }
        }


        /* === Dashboard mobile template hard fix: stop horizontal overflow and match uploaded mobile mockup === */
        html,
        body {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow-x: hidden !important;
          background: #05070d !important;
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box;
        }

        @media (max-width: 1180px) {
          .dashboard-grid-desktop-safe {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            grid-template-columns: 1fr !important;
            gap: 0 !important;
            overflow-x: hidden !important;
            overflow-y: visible !important;
            height: auto !important;
            min-height: auto !important;
          }

          .dashboard-main-column {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            margin-left: auto !important;
            margin-right: auto !important;
            overflow-x: hidden !important;
            overflow-y: visible !important;
            height: auto !important;
            min-height: auto !important;
          }

          .dashboard-card,
          .dashboard-feed-card,
          .dashboard-composer-card,
          .dashboard-mobile-insights {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-shell-pad {
            width: 100% !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
            overflow-y: visible !important;
            height: auto !important;
            min-height: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }

          .dashboard-main-column {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }

          .dashboard-showcase-row {
            padding: 12px !important;
            margin-bottom: 14px !important;
            border-radius: 24px !important;
            overflow: hidden !important;
          }

          .dashboard-showcase-scroller {
            display: flex !important;
            gap: 14px !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            max-width: 100% !important;
            padding: 0 0 8px !important;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }

          .dashboard-showcase-scroller::-webkit-scrollbar {
            display: none;
          }

          .dashboard-showcase-scroller > a,
          .dashboard-showcase-scroller > div {
            flex: 0 0 auto !important;
          }

          .dashboard-composer-card {
            overflow: hidden !important;
          }

          .dashboard-composer-card textarea,
          .dashboard-composer-card input,
          .dashboard-composer-card button,
          .dashboard-composer-card a {
            max-width: 100% !important;
          }

          .dashboard-composer-top-row {
            grid-template-columns: 42px minmax(0, 1fr) !important;
            align-items: start !important;
          }

          .dashboard-composer-top-row textarea {
            min-width: 0 !important;
            width: 100% !important;
          }

          .dashboard-composer-actions > * {
            min-width: 0 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          .dashboard-feed-card {
            overflow: hidden !important;
          }

          .dashboard-post-header,
          .dashboard-post-header > div:first-child {
            min-width: 0 !important;
          }

          .dashboard-post-header button {
            white-space: nowrap !important;
            min-width: fit-content !important;
            flex-shrink: 0 !important;
          }

          .dashboard-post-actions > button {
            min-width: 0 !important;
            white-space: nowrap !important;
          }

          .dashboard-feed-pulse-stats,
          .dashboard-mobile-insights,
          .dashboard-mobile-insights * {
            min-width: 0 !important;
          }
        }

        /* === Dashboard mobile vertical scroll fix === */
        html,
        body {
          min-height: 100% !important;
          height: auto !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: auto !important;
        }

        body {
          position: static !important;
          touch-action: pan-y manipulation !important;
        }

        @media (max-width: 1180px) {
          #__next,
          [data-nextjs-scroll-focus-boundary],
          .dashboard-shell-pad,
          .dashboard-grid-desktop-safe,
          .dashboard-main-column {
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow-y: visible !important;
            overscroll-behavior-y: auto !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-shell-pad {
            padding-bottom: calc(142px + env(safe-area-inset-bottom)) !important;
          }

          .dashboard-main-column {
            padding-bottom: 36px !important;
          }

          .dashboard-bottom-nav {
            pointer-events: auto !important;
          }
        }


        .dashboard-showcase-row {
          overflow: hidden !important;
        }

        .dashboard-showcase-scroller {
          -webkit-overflow-scrolling: touch !important;
          scrollbar-width: none !important;
        }

        .dashboard-showcase-scroller::-webkit-scrollbar {
          display: none !important;
        }

        @media (max-width: 760px) {
          .dashboard-showcase-row {
            padding: 11px !important;
            border-radius: 22px !important;
          }
        }


        .dashboard-showcase-scroller::-webkit-scrollbar {
          height: 6px;
        }

        .dashboard-showcase-scroller::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--parapost-accent-2) 42%, transparent);
          border-radius: 999px;
        }

        @media (max-width: 760px) {
          .dashboard-showcase-row {
            border-radius: 22px !important;
            padding-top: 9px !important;
            padding-bottom: 14px !important;
          }
        }

        @media (max-width: 720px) {
          [aria-label="Create Showcase"] > div {
            grid-template-columns: 1fr !important;
          }
        }


        @media (max-width: 920px) {
          .profile-showcase-studio-layout {
            grid-template-columns: 1fr !important;
          }

          .profile-showcase-preview-column {
            border-left: 0 !important;
            padding-left: 0 !important;
          }
        }

        @media (max-width: 760px) {
          .profile-showcase-modal-overlay {
            padding: 10px !important;
            align-items: stretch !important;
          }

          .profile-showcase-modal-shell {
            width: 100% !important;
            height: calc(100vh - 20px) !important;
            max-height: calc(100vh - 20px) !important;
            border-radius: 24px !important;
            padding: 14px !important;
          }

          .profile-showcase-modal-header {
            gap: 10px !important;
            margin-bottom: 12px !important;
          }

          .profile-showcase-upload-card {
            grid-template-columns: 48px minmax(0, 1fr) !important;
            min-height: 118px !important;
            padding: 16px !important;
            border-radius: 20px !important;
          }

          .profile-showcase-duration-options {
            grid-template-columns: 1fr !important;
          }

          .profile-showcase-preview-phone {
            min-height: 320px !important;
            height: 340px !important;
          }
        }



        /* === Phase 11 dashboard mobile/tablet layout polish === */
        /* Controlled responsive pass only: tighter spacing, safer scrolling, cleaner tablet/mobile card flow. */
        .dashboard-card,
        .dashboard-feed-card,
        .dashboard-mobile-insights,
        .dashboard-feed-pulse {
          box-sizing: border-box;
        }

        .dashboard-main-column > * {
          max-width: 100%;
        }

        .dashboard-showcase-scroller,
        .dashboard-mobile-insights,
        .dashboard-mobile-insights * {
          -webkit-tap-highlight-color: transparent;
        }

        @media (min-width: 761px) and (max-width: 1180px) {
          .dashboard-shell-pad {
            padding: 20px clamp(18px, 3vw, 28px) 86px !important;
          }

          .dashboard-grid-desktop-safe {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          .dashboard-main-column {
            width: min(940px, 100%) !important;
            max-width: 940px !important;
            margin: 0 auto !important;
            display: grid !important;
            gap: 18px !important;
            overflow: visible !important;
          }

          .dashboard-desktop-topbar {
            top: 12px !important;
            min-height: 66px !important;
            margin: 0 0 2px !important;
          }

          .dashboard-search-parapost {
            height: 52px !important;
            max-width: min(610px, 62vw) !important;
          }

          .dashboard-showcase-row {
            margin: 0 !important;
            padding: 14px 0 12px !important;
            border-radius: 28px !important;
          }

          .dashboard-showcase-scroller {
            gap: 15px !important;
            padding: 0 16px 9px !important;
            scroll-padding-left: 16px !important;
          }

          .dashboard-composer-card,
          .dashboard-feed-card,
          .dashboard-feed-pulse,
          .dashboard-mobile-insights,
          .dashboard-card:not(.dashboard-showcase-row) {
            border-radius: 28px !important;
          }

          .dashboard-composer-card {
            margin-bottom: 0 !important;
          }

          .dashboard-composer-actions {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }

          .dashboard-composer-actions a,
          .dashboard-composer-actions button {
            min-width: 0 !important;
          }

          .dashboard-feed-pulse {
            grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr) !important;
            margin: 0 !important;
          }

          .dashboard-feed-pulse-stats {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }

          .dashboard-mobile-insights {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            align-items: stretch !important;
            gap: 14px !important;
            padding: 16px !important;
            margin: 0 !important;
          }

          .dashboard-mobile-insights > div {
            min-width: 0 !important;
          }

          .dashboard-mobile-insights > div:first-child,
          .dashboard-mobile-insights > div:nth-child(2),
          .dashboard-mobile-insights > div:nth-child(7) {
            grid-column: 1 / -1 !important;
          }

          .dashboard-mobile-insights > div:nth-child(3),
          .dashboard-mobile-insights > div:nth-child(4),
          .dashboard-mobile-insights > div:nth-child(5),
          .dashboard-mobile-insights > div:nth-child(6) {
            grid-column: auto !important;
          }

          .dashboard-mobile-insights > div:nth-child(3),
          .dashboard-mobile-insights > div:nth-child(4) {
            min-height: 136px !important;
          }

          .dashboard-post-actions {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }

          .dashboard-shared-reel-frame {
            grid-template-columns: minmax(160px, 210px) minmax(0, 1fr) !important;
          }
        }

        @media (max-width: 760px) {
          .dashboard-shell-pad {
            padding: 0 0 calc(152px + env(safe-area-inset-bottom)) !important;
          }

          .dashboard-grid-desktop-safe {
            padding: 0 !important;
          }

          .dashboard-main-column {
            display: grid !important;
            gap: 13px !important;
            padding: 0 clamp(10px, 3.6vw, 15px) 34px !important;
            width: 100% !important;
          }

          .dashboard-mobile-header {
            position: sticky !important;
            top: 0 !important;
            z-index: 130 !important;
            min-height: 68px !important;
            padding: max(10px, env(safe-area-inset-top)) clamp(10px, 3.3vw, 14px) 10px !important;
            gap: 8px !important;
            background: linear-gradient(180deg, rgba(5,7,13,0.99), rgba(5,7,13,0.90)) !important;
            border-bottom: 1px solid rgba(255,255,255,0.06) !important;
          }

          .dashboard-mobile-header a:first-child {
            gap: 8px !important;
            min-width: 0 !important;
          }

          .dashboard-mobile-header a:first-child > div:first-child {
            width: clamp(42px, 11.5vw, 48px) !important;
            height: clamp(42px, 11.5vw, 48px) !important;
            min-width: clamp(42px, 11.5vw, 48px) !important;
          }

          .dashboard-mobile-header a:first-child > div:last-child > div:first-child {
            font-size: clamp(18px, 6vw, 23px) !important;
            letter-spacing: -0.02em !important;
          }

          .dashboard-mobile-header a:first-child > div:last-child > div:last-child {
            font-size: clamp(9px, 2.7vw, 11px) !important;
            letter-spacing: clamp(0.20em, 3.7vw, 0.34em) !important;
          }

          .dashboard-mobile-header button,
          .dashboard-mobile-header a[aria-label="Notifications"],
          .dashboard-mobile-header a[aria-label="Parachat"] {
            width: clamp(36px, 10.5vw, 40px) !important;
            height: clamp(36px, 10.5vw, 40px) !important;
            min-width: clamp(36px, 10.5vw, 40px) !important;
            border-radius: 13px !important;
          }

          .dashboard-showcase-row {
            margin: 10px 0 0 !important;
            padding: 10px 0 12px !important;
            border-radius: 23px !important;
          }

          .dashboard-showcase-row h3 {
            font-size: 15px !important;
          }

          .dashboard-showcase-scroller {
            gap: 12px !important;
            min-height: 84px !important;
            padding: 0 12px 8px !important;
            scroll-padding-left: 12px !important;
          }

          .dashboard-showcase-scroller > button,
          .dashboard-showcase-scroller > a {
            width: 70px !important;
            min-width: 70px !important;
          }

          .dashboard-showcase-scroller > button > span:first-child,
          .dashboard-showcase-scroller > a > span:first-child {
            width: 56px !important;
            height: 56px !important;
          }

          .dashboard-composer-card {
            margin: 0 !important;
            padding: 13px !important;
            border-radius: 23px !important;
          }

          .dashboard-composer-top-row {
            grid-template-columns: 42px minmax(0, 1fr) !important;
            gap: 10px !important;
          }

          .dashboard-composer-top-row textarea {
            min-height: 76px !important;
            padding: 13px 14px !important;
            font-size: 16px !important;
            line-height: 1.42 !important;
            border-radius: 19px !important;
          }

          .dashboard-composer-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-top: 11px !important;
          }

          .dashboard-composer-actions a,
          .dashboard-composer-actions button {
            min-height: 41px !important;
            padding: 8px 9px !important;
            border-radius: 14px !important;
            font-size: 12px !important;
            justify-content: center !important;
          }

          .dashboard-composer-footer {
            margin-top: 11px !important;
          }

          .dashboard-composer-footer > button {
            min-height: 42px !important;
            border-radius: 15px !important;
          }

          .dashboard-card:not(.dashboard-showcase-row),
          .dashboard-feed-card,
          .dashboard-feed-pulse,
          .dashboard-mobile-insights {
            border-radius: 23px !important;
          }

          .dashboard-feed-pulse {
            margin: 0 !important;
            padding: 13px !important;
            gap: 12px !important;
          }

          .dashboard-feed-pulse-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .dashboard-mobile-insights {
            margin: 0 !important;
            padding: 13px !important;
            gap: 11px !important;
          }

          .dashboard-mobile-insights > div:first-child {
            align-items: flex-start !important;
          }

          .dashboard-mobile-insights > div:nth-child(3),
          .dashboard-mobile-insights > div:nth-child(4) {
            grid-column: 1 / -1 !important;
          }

          .dashboard-mobile-insights a,
          .dashboard-mobile-insights button {
            min-height: 40px !important;
          }

          .dashboard-mobile-insights [style*="overflow-x: auto"] {
            scrollbar-width: none !important;
          }

          .dashboard-mobile-insights [style*="overflow-x: auto"]::-webkit-scrollbar {
            display: none !important;
          }

          .dashboard-post-header {
            gap: 10px !important;
            margin-bottom: 12px !important;
          }

          .dashboard-post-header > div:first-child {
            align-items: flex-start !important;
          }

          .dashboard-feed-card {
            padding: 14px !important;
          }

          .dashboard-feed-card p {
            font-size: 15px !important;
          }

          .dashboard-post-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 7px !important;
          }

          .dashboard-post-actions button {
            min-height: 39px !important;
            padding: 0 8px !important;
            border-radius: 13px !important;
            font-size: 12px !important;
          }

          .dashboard-shared-reel-frame {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            padding: 11px !important;
            border-radius: 20px !important;
          }

          .dashboard-shared-reel-frame a:first-child {
            width: min(188px, 62vw) !important;
            max-height: 334px !important;
            margin: 0 auto !important;
          }

          .dashboard-bottom-nav {
            left: clamp(8px, 2.8vw, 12px) !important;
            right: clamp(8px, 2.8vw, 12px) !important;
            bottom: max(9px, env(safe-area-inset-bottom)) !important;
            min-height: 72px !important;
            padding: 7px 8px !important;
            border-radius: 24px !important;
            z-index: 150 !important;
          }
        }

        @media (max-width: 420px) {
          .dashboard-main-column {
            gap: 12px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .dashboard-composer-actions a,
          .dashboard-composer-actions button {
            font-size: 11.5px !important;
            gap: 6px !important;
          }

          .dashboard-feed-pulse-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 370px) {
          .dashboard-mobile-header {
            gap: 6px !important;
          }

          .dashboard-mobile-header a:first-child > div:last-child > div:last-child {
            display: none !important;
          }

          .dashboard-composer-actions a,
          .dashboard-composer-actions button {
            grid-template-columns: 1fr !important;
          }

          .dashboard-bottom-nav a span:last-child {
            display: none !important;
          }
        }

        @media (min-width: 761px) {
          .dashboard-mobile-header,
          .dashboard-bottom-nav {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function SidebarLogo() {
  return (
    <Link href="/dashboard" style={sidebarLogoStyle}>
      <div style={logoGhostCircleStyle}><ParaGhostLogoIcon size={42} /></div>
      <div>
        <div style={logoWordStyle}>PARAPOST</div>
        <div style={logoNetworkStyle}>NETWORK</div>
      </div>
    </Link>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  badge?: number | string;
}) {
  return (
    <Link href={href} style={active ? activeSidebarItemStyle : sidebarItemStyle}>
      <span style={sidebarIconWrapStyle}>{icon || <span style={dotIconStyle} />}</span>
      <span>{label}</span>
      {badge ? <span style={sidebarBadgeStyle}>{badge}</span> : null}
    </Link>
  );
}

function SidebarParapostReelIcon() {
  return (
    <span style={sidebarComposerReelIconStyle} aria-hidden="true">
      <span style={{ transform: "translateX(1px)", lineHeight: 1 }}>▶</span>
    </span>
  );
}

function SidebarButton({
  label,
  badge,
  icon,
  muted = false,
}: {
  label: string;
  badge?: number | string;
  icon?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      style={muted ? mutedSidebarItemStyle : sidebarItemStyle}
      aria-disabled={muted ? "true" : undefined}
      title={muted ? `${label} is planned for a future Parapost Network upgrade.` : undefined}
    >
      <span style={sidebarIconWrapStyle}>{icon || <span style={muted ? mutedDotIconStyle : dotIconStyle} />}</span>
      <span>{label}</span>
      {badge ? <span style={muted ? mutedSidebarBadgeStyle : sidebarBadgeStyle}>{badge}</span> : null}
    </div>
  );
}

function MobileDashboardHeader({
  currentProfile,
  notificationsCount,
  onOpenSearch,
}: {
  currentProfile: ProfilePreview | null;
  notificationsCount: number;
  onOpenSearch: () => void;
}) {
  return (
    <header className="dashboard-mobile-header" style={mobileHeaderStyle}>
      <Link href="/dashboard" style={mobileLogoStyle}>
        <div style={mobileLogoCircleStyle}><ParaGhostLogoIcon size={32} /></div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1 }}>PARAPOST</div>
          <div style={{ color: "var(--parapost-accent-text)", letterSpacing: "0.42em", fontSize: 13, fontWeight: 900 }}>NETWORK</div>
        </div>
      </Link>

      <div style={mobileHeaderActionsStyle}>
        <button onClick={onOpenSearch} style={mobileTopIconButtonStyle} aria-label="Search Parapost">
          <SearchIcon size={24} />
        </button>
        <Link href="/notifications" style={mobileTopIconButtonStyle} aria-label="Notifications">
          <BellIcon />
          {notificationsCount > 0 ? <span style={topBadgeStyle}>{notificationsCount > 99 ? "99+" : notificationsCount}</span> : null}
        </Link>
        <Link href="/messages" style={mobileTopIconButtonStyle} aria-label="Parachat">
          <ChatIcon />
        </Link>
        <Link href={currentProfile?.id ? `/profile/${currentProfile.id}` : "/dashboard"} style={{ display: "none" }} aria-label="Profile" />
      </div>
    </header>
  );
}

function ShowcaseQuickActions({
  currentUserId,
  friendShowcases,
  onCreateShowcase,
}: {
  currentProfile: ProfilePreview | null;
  currentUserId: string;
  friendShowcases: DashboardShowcaseItem[];
  onCreateShowcase: () => void;
}) {
  const visibleFriendShowcases = friendShowcases.slice(0, 18);

  return (
    <section className="dashboard-card dashboard-showcase-row" style={dashboardProfileShowcasesPanelStyle}>
      <div style={dashboardShowcasesHeaderStyle}>
        <h3 style={dashboardShowcasesTitleStyle}>Showcases</h3>
      </div>

      <div className="dashboard-showcase-scroller" style={dashboardProfileShowcasesRowStyle}>
        <button
          type="button"
          style={dashboardProfileShowcaseNewItemStyle}
          onClick={onCreateShowcase}
          aria-label="Create a new Showcase"
        >
          <span style={dashboardProfileShowcasePlusCircleStyle}>+</span>
          <span style={dashboardProfileShowcaseLabelStyle}>New</span>
        </button>

        {visibleFriendShowcases.map((showcase) => {
            const coverText = (showcase.cover_text || showcase.title || showcase.profile?.full_name || "Showcase").trim();
            const x = Number(showcase.text_position_x ?? 50);
            const y = Number(showcase.text_position_y ?? 50);
            const mediaType = showcase.media_type === "image" || showcase.media_type === "video" ? showcase.media_type : "text";

            return (
              <Link
                key={showcase.id}
                href={`/profile/${showcase.user_id}`}
                style={dashboardProfileShowcaseItemStyle}
                aria-label={`Open ${getDashboardShowcaseLabel(showcase)} Showcase`}
              >
                <span style={dashboardProfileShowcaseCoverCircleStyle}>
                  {showcase.media_url && mediaType === "image" ? (
                    <img src={showcase.media_url} alt="" style={dashboardProfileShowcaseCoverMediaStyle} />
                  ) : showcase.media_url && mediaType === "video" ? (
                    <video src={showcase.media_url} muted playsInline style={dashboardProfileShowcaseCoverMediaStyle} />
                  ) : null}

                  <span style={{ ...dashboardProfileShowcaseCoverShadeStyle, opacity: showcase.media_url ? 1 : 0 }} />
                  <span
                    style={{
                      ...dashboardProfileShowcaseCoverTextStyle,
                      left: `${Number.isFinite(x) ? x : 50}%`,
                      top: `${Number.isFinite(y) ? y : 50}%`,
                      fontFamily: getDashboardShowcaseFontFamily(showcase.font_key),
                      fontSize: `${clampDashboardShowcaseFontSize(showcase.overlay_font_size)}px`,
                    }}
                  >
                    {coverText}
                  </span>
                </span>
                <span style={dashboardProfileShowcaseLabelStyle}>{getDashboardShowcaseLabel(showcase)}</span>
              </Link>
            );
          })}
      </div>
    </section>
  );
}

function ComposerCard({
  composerRef,
  currentProfile,
  firstName,
  content,
  setContent,
  images,
  imagePreviewUrls,
  loading,
  selectedFeelingActivity,
  fileInputRef,
  onImageChange,
  onRemoveImage,
  onOpenFeelingActivity,
  onClearFeelingActivity,
  onPost,
}: {
  composerRef: RefObject<HTMLElement | null>;
  currentProfile: ProfilePreview | null;
  firstName: string;
  content: string;
  setContent: (value: string) => void;
  images: File[];
  imagePreviewUrls: string[];
  loading: boolean;
  selectedFeelingActivity: FeelingActivityOption | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index?: number) => void;
  onOpenFeelingActivity: () => void;
  onClearFeelingActivity: () => void;
  onPost: () => void;
}) {
  const canPublish = content.trim().length > 0 || images.length > 0 || !!selectedFeelingActivity;

  return (
    <section id="dashboard-create-post" ref={composerRef} className="dashboard-card dashboard-composer-card" style={composerCardStyle}>
      <div className="dashboard-composer-top-row" style={composerTopRowStyle}>
        <Avatar profile={currentProfile} size={48} />
        <textarea
          id="dashboard-create-post-input"
          value={content}
          onChange={(event) => setContent(event.target.value.slice(0, POST_CHARACTER_LIMIT))}
          placeholder={`What's on your mind, ${firstName}?`}
          rows={2}
          maxLength={POST_CHARACTER_LIMIT}
          style={composerInputStyle}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} style={composerImageButtonStyle} aria-label="Upload image">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 17L8.5 12.5L11 15L15.5 10.5L20 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="5" width="18" height="15" rx="3" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onImageChange} style={{ display: "none" }} />

      {imagePreviewUrls.length > 0 ? (
        <div style={imagePreviewWrapStyle}>
          <div
            style={{
              ...composerPreviewGridStyle,
              ...(imagePreviewUrls.length === 1 ? composerPreviewSingleGridStyle : null),
            }}
          >
            {imagePreviewUrls.slice(0, 4).map((previewUrl, index) => {
              const extraCount = imagePreviewUrls.length - 4;
              const showOverlay = index === 3 && extraCount > 0;

              return (
                <button
                  key={`${previewUrl}-${index}`}
                  type="button"
                  onClick={() => onRemoveImage(index)}
                  style={{
                    ...composerPreviewTileStyle,
                    ...(imagePreviewUrls.length === 1 ? composerPreviewSingleTileStyle : null),
                  }}
                  aria-label={`Remove selected image ${index + 1}`}
                >
                  <img src={previewUrl} alt={`Selected preview ${index + 1}`} style={composerPreviewImageStyle} />
                  {showOverlay ? <span style={composerPreviewOverlayStyle}>+{extraCount}</span> : null}
                </button>
              );
            })}
          </div>
          <div style={imagePreviewMetaRowStyle}>
            <span style={selectedImageNameStyle}>
              {images.length} photo{images.length === 1 ? "" : "s"} selected · up to {MAX_POST_IMAGES}
            </span>
            <button type="button" onClick={() => onRemoveImage()} style={removeImageButtonStyle}>Remove photos</button>
          </div>
        </div>
      ) : null}

      {selectedFeelingActivity ? (
        <div style={selectedFeelingActivityStyle}>
          <span style={selectedFeelingCategoryStyle}>{selectedFeelingActivity.category}</span>
          <strong style={selectedFeelingLabelStyle}>{selectedFeelingActivity.label}</strong>
          <button type="button" onClick={onClearFeelingActivity} style={selectedFeelingRemoveStyle}>Remove</button>
        </div>
      ) : null}

      <div className="dashboard-composer-actions" style={composerActionGridStyle}>
        <ComposerActionPill label="Photo / Video" icon="▣" tone="green" onClick={() => fileInputRef.current?.click()} />
        <ComposerActionPill label="Parapost Reel" icon="▶" tone="pink" href="/reels" />
        <ComposerActionPill label="Live Stream" icon="◎" tone="red" disabled note="Coming soon" />
        <ComposerActionPill label="Feeling / Activity" icon="●" tone="gold" active={!!selectedFeelingActivity} onClick={onOpenFeelingActivity} />
      </div>

      <div className="dashboard-composer-footer" style={composerFooterStyle}>
        <span aria-hidden="true" style={{ display: "none" }} />
        <button
          type="button"
          disabled={!canPublish || loading}
          onClick={onPost}
          style={{
            ...publishButtonStyle,
            opacity: !canPublish || loading ? 0.58 : 1,
            cursor: !canPublish || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Publishing..." : "Publish post"}
        </button>
      </div>
    </section>
  );
}

function ComposerActionPill({
  label,
  icon,
  tone,
  href,
  onClick,
  disabled = false,
  active = false,
  note,
}: {
  label: string;
  icon: string;
  tone: "green" | "pink" | "red" | "gold";
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  note?: string;
}) {
  const toneStyle = composerActionToneStyles[tone];
  const content = (
    <>
      <span style={{ ...composerActionIconStyle, ...toneStyle }}>{icon}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {note ? <span style={composerActionNoteStyle}>{note}</span> : null}
      </span>
    </>
  );

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title="Live Stream is coming soon."
        style={{ ...composerActionPillStyle, ...composerActionDisabledStyle }}
      >
        {content}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} style={active ? { ...composerActionPillStyle, ...composerActionPillActiveStyle } : composerActionPillStyle}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} style={active ? { ...composerActionPillStyle, ...composerActionPillActiveStyle } : composerActionPillStyle}>
      {content}
    </button>
  );
}

function FeedTabs({ feedMode, setFeedMode }: { feedMode: FeedMode; setFeedMode: (mode: FeedMode) => void }) {
  return (
    <div className="dashboard-card" style={feedTabsStyle}>
      <FeedTab label="For You" active={feedMode === "for_you"} onClick={() => setFeedMode("for_you")} />
      <FeedTab label="Friends" active={feedMode === "friends"} onClick={() => setFeedMode("friends")} />
      <FeedTab label="Following" active={feedMode === "following"} onClick={() => setFeedMode("following")} />
      <FeedTab label="Live" disabled />
    </div>
  );
}

function FeedTab({
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={disabled ? disabledFeedTabStyle : active ? activeFeedTabStyle : feedTabStyle}
    >
      {label}
    </button>
  );
}

function DashboardEmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="dashboard-card" style={emptyStateStyle}>
      <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>{title}</h3>
      <p style={{ margin: 0, color: "#9ca3af", lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

function FeedPulseStrip({ itemCount, totalLikes, totalComments, totalShares }: { itemCount: number; totalLikes: number; totalComments: number; totalShares: number }) {
  return (
    <section className="dashboard-card dashboard-feed-pulse" style={feedPulseStyle}>
      <div>
        <div style={feedPulseEyebrowStyle}>Live dashboard feed</div>
        <h2 style={feedPulseTitleStyle}>What’s happening on Parapost Network</h2>
      </div>
      <div className="dashboard-feed-pulse-stats" style={feedPulseStatsStyle}>
        <MiniFeedStat label="Feed items" value={itemCount} />
        <MiniFeedStat label="Likes" value={totalLikes} />
        <MiniFeedStat label="Comments" value={totalComments} />
        <MiniFeedStat label="Shares" value={totalShares} />
      </div>
    </section>
  );
}

function MiniFeedStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={miniFeedStatStyle}>
      <strong style={miniFeedStatValueStyle}>{value}</strong>
      <span style={miniFeedStatLabelStyle}>{label}</span>
    </div>
  );
}

function PostCard({
  post,
  profile,
  currentUserId,
  isLiked,
  likeCount,
  commentCount,
  shareCount,
  isFollowing,
  isFriend,
  openPostMenuId,
  editingPostId,
  editingPostContent,
  setEditingPostContent,
  setOpenPostMenuId,
  onLike,
  onShare,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  post: Post;
  profile?: ProfilePreview | null;
  currentUserId: string;
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isFollowing: boolean;
  isFriend: boolean;
  openPostMenuId: string | null;
  editingPostId: string | null;
  editingPostContent: string;
  setEditingPostContent: (value: string) => void;
  setOpenPostMenuId: (value: string | null | ((prev: string | null) => string | null)) => void;
  onLike: () => void;
  onShare: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const isPostOwner = currentUserId === post.user_id;
  const isEditing = editingPostId === post.id;
  const displayName = profile?.full_name || profile?.username || "Parapost user";
  const profileHref = `/profile/${post.user_id}`;
  const relationshipLabel = isPostOwner ? "Profile" : isFriend ? "Friends" : isFollowing ? "Following" : "Profile";
  const { headerActivityText, bodyContent } = splitPostFeelingActivityContent(post.content || "");

  return (
    <article id={`post-${post.id}`} className="dashboard-card dashboard-feed-card" style={postCardStyle} onClick={(event) => event.stopPropagation()}>
      <div className="dashboard-post-header" style={postHeaderStyle}>
        <div style={postAuthorStyle}>
          <Avatar profile={profile} size={54} href={profileHref} />
          <div style={{ minWidth: 0 }}>
            <div style={postAuthorNameLineStyle}>
              <Link href={profileHref} style={{ ...postAuthorNameStyle, display: "inline" }}>{displayName}</Link>
              {headerActivityText ? <span style={postAuthorActivityTextStyle}>{headerActivityText}</span> : null}
            </div>
            <div style={postMetaStyle}>
              @{profile?.username || "member"} · {formatRelativeTime(post.created_at)} · {" "}
              <Link href={profileHref} style={postStatusLinkStyle}>{relationshipLabel}</Link>
            </div>
          </div>
        </div>

        {isPostOwner ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenPostMenuId((prev) => (prev === post.id ? null : post.id));
              }}
              style={dotsButtonStyle}
              aria-label="Post options"
            >
              <DotsIcon />
            </button>
            {openPostMenuId === post.id ? (
              <div style={postMenuStyle} onClick={(event) => event.stopPropagation()}>
                <button type="button" style={menuItemStyle} onClick={onStartEdit}>Edit post</button>
                <button type="button" style={{ ...menuItemStyle, color: "#fca5a5" }} onClick={onDelete}>Delete post</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <div style={{ marginTop: 14 }}>
          <textarea value={editingPostContent} onChange={(event) => setEditingPostContent(event.target.value)} rows={4} style={editTextareaStyle} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" onClick={onSaveEdit} style={publishButtonStyle}>Save</button>
            <button type="button" onClick={onCancelEdit} style={softButtonStyle}>Cancel</button>
          </div>
        </div>
      ) : bodyContent ? (
        <>
          <p style={postContentStyle}>{renderLinkedText(bodyContent)}</p>
          <LinkPreviewCard text={bodyContent} />
        </>
      ) : null}

      <PostImageGrid imageUrls={getPostImageUrls(post)} alt="Post image" />

      {commentCount > 0 || shareCount > 0 ? (
        <div style={postStatsSummaryStyle}>
          <span>{commentCount} Comments</span>
          <span>·</span>
          <span>{shareCount} Shares</span>
        </div>
      ) : null}

      <div className="dashboard-post-actions" style={postActionsStyle}>
        <ActionButton onClick={onLike} active={isLiked}><HeartIcon filled={isLiked} /> Like</ActionButton>
        <ActionButton onClick={() => document.getElementById(`post-${post.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}><CommentIcon /> Comment</ActionButton>
        <ActionButton onClick={onShare}><ShareIcon /> Share</ActionButton>
        <ActionButton onClick={() => alert("Save/bookmarks will be connected in a later pass.")}>Save</ActionButton>
      </div>
    </article>
  );
}

function SharedPostCard({
  sharedPost,
  sharerProfile,
  originalProfile,
  currentUserId,
  openPostMenuId,
  editingPostId,
  editingPostContent,
  setEditingPostContent,
  setOpenPostMenuId,
  onStartEditOriginal,
  onSaveEditOriginal,
  onCancelEditOriginal,
  onDeleteOriginal,
  onRemoveShare,
}: {
  sharedPost: SharedPostItem;
  sharerProfile?: ProfilePreview | null;
  originalProfile?: ProfilePreview | null;
  currentUserId: string;
  openPostMenuId: string | null;
  editingPostId: string | null;
  editingPostContent: string;
  setEditingPostContent: (value: string) => void;
  setOpenPostMenuId: (value: string | null | ((prev: string | null) => string | null)) => void;
  onStartEditOriginal: () => void;
  onSaveEditOriginal: () => void;
  onCancelEditOriginal: () => void;
  onDeleteOriginal: () => void;
  onRemoveShare: () => void;
}) {
  const originalPost = sharedPost.original_post;
  const sharerName = sharerProfile?.full_name || sharerProfile?.username || "Parapost user";
  const originalName = originalProfile?.full_name || originalProfile?.username || "Parapost member";
  const originalHref = `/profile/${originalPost.user_id}`;
  const sharerHref = `/profile/${sharedPost.user_id}`;
  const menuId = `shared-post-menu-${sharedPost.id}`;
  const isShareOwner = !!currentUserId && sharedPost.user_id === currentUserId;
  const isOriginalPostOwner = !!currentUserId && originalPost.user_id === currentUserId;
  const showOwnerMenu = isShareOwner || isOriginalPostOwner;
  const isEditingOriginalPost = editingPostId === originalPost.id;

  return (
    <article
      id={`share-${sharedPost.id}`}
      className="dashboard-card dashboard-feed-card"
      style={postCardStyle}
      onClick={(event) => event.stopPropagation()}
    >
      <div style={postHeaderStyle}>
        <div style={postAuthorStyle}>
          <Avatar profile={sharerProfile} size={54} href={sharerHref} />
          <div style={{ minWidth: 0 }}>
            <Link href={sharerHref} style={postAuthorNameStyle}>
              {sharerName}
            </Link>
            <div style={postMetaStyle}>
              shared {originalName}&apos;s post · {formatRelativeTime(sharedPost.created_at)}
            </div>
          </div>
        </div>

        {showOwnerMenu ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpenPostMenuId((prev) => (prev === menuId ? null : menuId));
              }}
              style={dotsButtonStyle}
              aria-label="Shared post options"
            >
              <DotsIcon />
            </button>

            {openPostMenuId === menuId ? (
              <div style={postMenuStyle} onClick={(event) => event.stopPropagation()}>
                {isOriginalPostOwner ? (
                  <>
                    <button type="button" style={menuItemStyle} onClick={onStartEditOriginal}>
                      Edit original post
                    </button>
                    <button
                      type="button"
                      style={{ ...menuItemStyle, color: "#fca5a5" }}
                      onClick={onDeleteOriginal}
                    >
                      Delete original post
                    </button>
                  </>
                ) : null}

                {isShareOwner ? (
                  <button
                    type="button"
                    style={{
                      ...menuItemStyle,
                      color: isOriginalPostOwner ? "#d8b4fe" : "#fca5a5",
                      borderBottomColor: "transparent",
                    }}
                    onClick={onRemoveShare}
                  >
                    Remove shared post
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {sharedPost.caption ? <p style={postContentStyle}>{renderLinkedText(sharedPost.caption)}</p> : null}

      <div style={sharedPostFrameStyle}>
        <div style={sharedPostOriginalHeaderStyle}>
          <Avatar profile={originalProfile} size={42} href={originalHref} />
          <div style={{ minWidth: 0 }}>
            <Link href={originalHref} style={postAuthorNameStyle}>
              {originalName}
            </Link>
            <div style={postMetaStyle}>
              @{originalProfile?.username || "member"} · {formatRelativeTime(originalPost.created_at)}
            </div>
          </div>
        </div>

        {isEditingOriginalPost ? (
          <div style={{ marginTop: 14 }}>
            <textarea
              value={editingPostContent}
              onChange={(event) => setEditingPostContent(event.target.value)}
              rows={4}
              style={editTextareaStyle}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <button type="button" onClick={onSaveEditOriginal} style={publishButtonStyle}>
                Save
              </button>
              <button type="button" onClick={onCancelEditOriginal} style={softButtonStyle}>
                Cancel
              </button>
            </div>
          </div>
        ) : originalPost.content ? (
          <>
            <p style={sharedPostOriginalContentStyle}>{renderLinkedText(originalPost.content)}</p>
            <LinkPreviewCard text={originalPost.content} />
          </>
        ) : null}

        <PostImageGrid imageUrls={getPostImageUrls(originalPost)} alt="Shared post image" />

      </div>
    </article>
  );
}


function SharedReelCard({
  shared,
  sharerProfile,
  creatorProfile,
  currentUserId,
  onDelete,
}: {
  shared: SharedReelItem;
  sharerProfile?: ProfilePreview | null;
  creatorProfile?: ProfilePreview | null;
  currentUserId: string;
  onDelete: () => void;
}) {
  return (
    <article className="dashboard-card dashboard-feed-card" style={postCardStyle}>
      <div style={postHeaderStyle}>
        <div style={postAuthorStyle}>
          <Avatar profile={sharerProfile} size={54} href={`/profile/${shared.user_id}`} />
          <div style={{ minWidth: 0 }}>
            <Link href={`/profile/${shared.user_id}`} style={postAuthorNameStyle}>
              {sharerProfile?.full_name || sharerProfile?.username || "Parapost user"}
            </Link>
            <div style={postMetaStyle}>shared a Parapost Reel · {formatRelativeTime(shared.created_at)}</div>
          </div>
        </div>
        {shared.user_id === currentUserId ? <button type="button" onClick={onDelete} style={softDangerButtonStyle}>Remove</button> : null}
      </div>

      {shared.caption ? <p style={postContentStyle}>{shared.caption}</p> : null}

      <div className="dashboard-shared-reel-frame" style={sharedReelFrameStyle}>
        <Link href={`/reels?reel=${shared.reel_id}`} style={sharedReelVideoStyle}>
          <video src={shared.reel_video_url} poster={shared.reel_poster_url || undefined} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <div style={sharedReelOverlayStyle}>▶</div>
        </Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={sharedReelBadgeStyle}>Parapost Reel</div>
          <h3 style={{ margin: "10px 0 6px", fontSize: 19 }}>{shared.reel_title}</h3>
          <p style={mutedTextStyle}>Original by {creatorProfile?.full_name || creatorProfile?.username || "Parapost creator"}</p>
          {shared.reel_caption ? <p style={sharedCaptionStyle}>{shared.reel_caption}</p> : null}
          <Link href={`/reels?reel=${shared.reel_id}`} style={watchReelButtonStyle}>View Reel</Link>
        </div>
      </div>
    </article>
  );
}


function MobileDashboardUtilityRail({
  currentProfile,
  currentUserId,
  recentlyViewed,
  peopleToDiscover,
  followedCount,
  feedItems,
  totalLikes,
  totalComments,
  totalShares,
  onCreatePost,
}: {
  currentProfile: ProfilePreview | null;
  currentUserId: string;
  recentlyViewed: ProfilePreview[];
  peopleToDiscover: ProfilePreview[];
  followedCount: number;
  feedItems: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  onCreatePost: () => void;
}) {
  return (
    <section className="dashboard-mobile-insights" style={mobileInsightsShellStyle}>
      <div style={mobileInsightsHeaderStyle}>
        <div>
          <div style={miniEyebrowStyle}>Network Pulse</div>
          <h3 style={{ margin: "3px 0 0", fontSize: 16 }}>Your Parapost hub</h3>
        </div>
        <span style={privatePillStyle}>Mobile tools</span>
      </div>

      <div style={mobileProfileSummaryStyle}>
        <Avatar profile={currentProfile} size={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: "block", color: "#fff", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentProfile?.full_name || currentProfile?.username || "Your profile"}
          </strong>
          <span style={railMetaStyle}>Dashboard activity and quick tools</span>
        </div>
        <Link href={currentUserId ? `/profile/${currentUserId}` : "/dashboard"} style={mobileMiniProfileButtonStyle}>
          Profile
        </Link>
      </div>

      <div style={mobileInsightsStatsGridStyle}>
        <StatRow label="Following" value={followedCount.toString()} />
        <StatRow label="Feed items" value={feedItems.toString()} />
        <StatRow label="Likes" value={totalLikes.toString()} />
        <StatRow label="Comments" value={totalComments.toString()} />
        <StatRow label="Shares" value={totalShares.toString()} />
      </div>

      <div style={mobileQuickToolsGridStyle}>
        <button type="button" onClick={onCreatePost} style={mobileQuickToolButtonStyle}>Create Post</button>
        <Link href="/reels" style={mobileQuickToolLinkStyle}>Parapost Reels</Link>
        <Link href="/messages" style={mobileQuickToolLinkStyle}>Parachat</Link>
        <Link href="/notifications" style={mobileQuickToolLinkStyle}>Notifications</Link>
      </div>

      <div style={mobileRecentlyViewedBoxStyle}>
        <div style={mobileSubHeaderStyle}>
          <strong>Recently Viewed</strong>
          <span style={privateMiniTextStyle}>Only you can see this</span>
        </div>

        {recentlyViewed.length === 0 ? (
          <p style={{ ...mutedTextStyle, margin: 0 }}>Profiles you view will appear here privately.</p>
        ) : (
          <div style={mobileProfileRailStyle}>
            {recentlyViewed.slice(0, 5).map((profile) => (
              <Link key={profile.id} href={`/profile/${profile.id}`} style={mobileProfileBubbleStyle}>
                <Avatar profile={profile} size={42} />
                <span>{profile.full_name?.split(" ")[0] || profile.username || "User"}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={mobileRecentlyViewedBoxStyle}>
        <div style={mobileSubHeaderStyle}>
          <strong>People to Discover</strong>
          <span style={privateMiniTextStyle}>Fresh</span>
        </div>

        {peopleToDiscover.length === 0 ? (
          <p style={{ ...mutedTextStyle, margin: 0 }}>New members with completed bios will appear here automatically.</p>
        ) : (
          <div style={mobileProfileRailStyle}>
            {peopleToDiscover.slice(0, 5).map((profile) => (
              <Link key={profile.id} href={`/profile/${profile.id}`} style={mobileProfileBubbleStyle}>
                <Avatar profile={profile} size={42} />
                <span>{profile.full_name?.split(" ")[0] || profile.username || "User"}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={mobileSponsorPreviewStyle}>
        <div style={sponsorIconStyle}>★</div>
        <div style={{ minWidth: 0 }}>
          <strong style={railNameStyle}>Sponsor / Advertising</strong>
          <span style={railMetaStyle}>Reach the Parapost community with future sponsor spots, creator campaigns, and advertising options.</span>
        </div>
      </div>
    </section>
  );
}

function ActionButton({ children, onClick, active }: { children: ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} style={active ? activeActionButtonStyle : actionButtonStyle}>
      {children}
    </button>
  );
}

function RightRailCard({ title, action, children }: { title: string; action?: string; children: ReactNode }) {
  return (
    <section className="dashboard-right-card" style={railCardStyle}>
      <div style={railCardHeaderStyle}>
        <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
        {action ? <span style={railActionStyle}>{action}</span> : null}
      </div>
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </section>
  );
}

function RailHeroProfile({
  profile,
  currentUserId,
  userEmail,
}: {
  profile: ProfilePreview | null;
  currentUserId: string;
  userEmail: string;
}) {
  return (
    <div style={railHeroProfileStyle}>
      <Avatar profile={profile} size={48} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <strong style={{ display: "block", color: "#fff", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {profile?.full_name || profile?.username || "Your profile"}
        </strong>
        <span style={railMetaStyle}>@{profile?.username || "parapost"}</span>
        {userEmail ? <span style={{ ...railMetaStyle, wordBreak: "break-word" }}>{userEmail}</span> : null}
      </div>
      <Link href={currentUserId ? `/profile/${currentUserId}` : "/dashboard"} style={railProfileButtonStyle}>
        View
      </Link>
    </div>
  );
}

function RailStatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={railStatTileStyle}>
      <strong style={railStatValueStyle}>{value}</strong>
      <span style={railStatLabelStyle}>{label}</span>
    </div>
  );
}

function LiveNowItem({ title, host, viewers }: { title: string; host: string; viewers: string }) {
  return (
    <div style={liveRowStyle}>
      <div style={liveThumbStyle}><span style={liveBadgeStyle}>LIVE</span></div>
      <div style={{ minWidth: 0 }}>
        <strong style={railNameStyle}>{title}</strong>
        <span style={railMetaStyle}>{host}</span>
        <span style={railMetaStyle}>{viewers}</span>
      </div>
    </div>
  );
}

function TrendingItem({ rank, title, meta }: { rank: string; title: string; meta: string }) {
  return (
    <div style={trendingRowStyle}>
      <span style={trendingRankStyle}>{rank}</span>
      <div style={{ minWidth: 0 }}>
        <strong style={railNameStyle}>{title}</strong>
        <span style={railMetaStyle}>{meta}</span>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={statRowStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SearchResults({
  searchLoading,
  searchResults,
  onClose,
}: {
  searchLoading: boolean;
  searchResults: ProfilePreview[];
  onClose: () => void;
}) {
  if (searchLoading) return <p style={mutedTextStyle}>Searching Parapost Network...</p>;
  if (searchResults.length === 0) return <p style={mutedTextStyle}>No profiles found yet.</p>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {searchResults.map((profile) => (
        <Link key={profile.id} href={`/profile/${profile.id}`} onClick={onClose} style={searchResultRowStyle}>
          <Avatar profile={profile} size={40} />
          <span style={{ minWidth: 0 }}>
            <strong style={{ display: "block", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {profile.full_name || profile.username || "Parapost user"}
            </strong>
            <span style={{ color: "#9ca3af", fontSize: 12 }}>@{profile.username || "member"}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function FeelingActivityModal({
  selectedFeelingActivity,
  onSelect,
  onClear,
  onClose,
}: {
  selectedFeelingActivity: FeelingActivityOption | null;
  onSelect: (option: FeelingActivityOption) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const feelingOptions = FEELING_ACTIVITY_OPTIONS.filter((option) => option.category === "Feeling");
  const activityOptions = FEELING_ACTIVITY_OPTIONS.filter((option) => option.category === "Activity");

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={feelingActivityModalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalEyebrowStyle}>Create a post</div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Feeling / Activity</h2>
            <p style={feelingActivityIntroStyle}>Choose one to add context to your post. It will publish with your post and show on your profile timeline.</p>
          </div>
          <button type="button" onClick={onClose} style={modalCloseButtonStyle}>×</button>
        </div>

        {selectedFeelingActivity ? (
          <div style={feelingActivitySelectedPreviewStyle}>
            <span style={selectedFeelingCategoryStyle}>{selectedFeelingActivity.category}</span>
            <strong style={selectedFeelingLabelStyle}>{selectedFeelingActivity.label}</strong>
            <button type="button" onClick={onClear} style={selectedFeelingRemoveStyle}>Clear</button>
          </div>
        ) : null}

        <div style={feelingActivitySectionStyle}>
          <h3 style={feelingActivitySectionTitleStyle}>Feelings</h3>
          <div style={feelingActivityGridStyle}>
            {feelingOptions.map((option) => (
              <FeelingActivityOptionButton
                key={option.id}
                option={option}
                active={selectedFeelingActivity?.id === option.id}
                onSelect={() => onSelect(option)}
              />
            ))}
          </div>
        </div>

        <div style={feelingActivitySectionStyle}>
          <h3 style={feelingActivitySectionTitleStyle}>Activities</h3>
          <div style={feelingActivityGridStyle}>
            {activityOptions.map((option) => (
              <FeelingActivityOptionButton
                key={option.id}
                option={option}
                active={selectedFeelingActivity?.id === option.id}
                onSelect={() => onSelect(option)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeelingActivityOptionButton({
  option,
  active,
  onSelect,
}: {
  option: FeelingActivityOption;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={active ? { ...feelingActivityOptionStyle, ...feelingActivityOptionActiveStyle } : feelingActivityOptionStyle}
    >
      <span style={feelingActivityOptionDotStyle} />
      <span style={{ minWidth: 0 }}>
        <strong style={feelingActivityOptionLabelStyle}>{option.label}</strong>
        <span style={feelingActivityOptionHelperStyle}>{option.helper}</span>
      </span>
    </button>
  );
}

function SearchModal({
  searchQuery,
  setSearchQuery,
  searchLoading,
  searchResults,
  onClose,
}: {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchLoading: boolean;
  searchResults: ProfilePreview[];
  onClose: () => void;
}) {
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={searchModalStyle} onClick={(event) => event.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalEyebrowStyle}>Parapost Network</div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Search Parapost</h2>
          </div>
          <button type="button" onClick={onClose} style={modalCloseButtonStyle}>×</button>
        </div>
        <div className="dashboard-search-parapost dashboard-search-modal-bar" style={{ ...searchWrapStyle, maxWidth: "none", width: "100%" }}>
          <SearchIcon />
          <input
            id="dashboard-search-modal-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search Parapost"
            style={searchInputStyle}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <SearchResults searchLoading={searchLoading} searchResults={searchResults} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

function DashboardShowcaseComposerModal({
  title,
  coverText,
  duration,
  visibility,
  mediaPreviewUrl,
  mediaType,
  mediaFileName,
  fontKey,
  overlayFontSize,
  textPosition,
  customizeOpen,
  previewExpanded,
  mediaDragActive,
  error,
  saving,
  mediaInputRef,
  setTitle,
  setCoverText,
  setDuration,
  setVisibility,
  setFontKey,
  setOverlayFontSize,
  setTextPosition,
  setCustomizeOpen,
  setPreviewExpanded,
  onMediaChange,
  onMediaDrop,
  onMediaDragOver,
  onMediaDragLeave,
  onClearMedia,
  onClose,
  onCreate,
}: {
  currentProfile: ProfilePreview | null;
  title: string;
  coverText: string;
  duration: ShowcaseDuration;
  visibility: ShowcaseVisibility;
  mediaPreviewUrl: string;
  mediaType: ShowcaseMediaType;
  mediaFileName: string;
  fontKey: ShowcaseFontValue;
  overlayFontSize: number;
  textPosition: { x: number; y: number };
  customizeOpen: boolean;
  previewExpanded: boolean;
  mediaDragActive: boolean;
  error: string;
  saving: boolean;
  mediaInputRef: RefObject<HTMLInputElement | null>;
  setTitle: (value: string) => void;
  setCoverText: (value: string) => void;
  setDuration: (value: ShowcaseDuration) => void;
  setVisibility: (value: ShowcaseVisibility) => void;
  setFontKey: (value: ShowcaseFontValue) => void;
  setOverlayFontSize: (value: number) => void;
  setTextPosition: (value: { x: number; y: number }) => void;
  setCustomizeOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setPreviewExpanded: (value: boolean | ((current: boolean) => boolean)) => void;
  onMediaChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onMediaDrop: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onMediaDragOver: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onMediaDragLeave: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onClearMedia: () => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  const cleanCoverText = coverText.trim();
  const previewCopy = cleanCoverText;
  const hasOverlayText = previewCopy.length > 0;
  const fontOption = getShowcaseFontOption(fontKey);
  const displayFontSize = getShowcaseOverlayDisplayFontSize(previewCopy || "Preview", overlayFontSize);
  const overlayWidth = getShowcaseOverlayTextWidth(previewCopy || "Preview");
  const previewDragRef = useRef<HTMLDivElement | null>(null);
  const [overlayDragging, setOverlayDragging] = useState(false);
  const isHorizontallyCentered = Math.abs(textPosition.x - 50) <= 1.35;
  const isVerticallyCentered = Math.abs(textPosition.y - 50) <= 1.35;

  const updateOverlayPositionFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const previewElement = previewDragRef.current;
      if (!previewElement) return;

      const rect = previewElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const nextX = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
      const nextY = Math.max(8, Math.min(92, ((clientY - rect.top) / rect.height) * 100));

      setTextPosition({
        x: Number(nextX.toFixed(1)),
        y: Number(nextY.toFixed(1)),
      });
    },
    [setTextPosition]
  );

  const handleOverlayPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!customizeOpen || !hasOverlayText) return;

    const target = event.target as HTMLElement;
    if (target.closest("input, button, select, textarea")) return;

    event.preventDefault();
    event.stopPropagation();
    setOverlayDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateOverlayPositionFromPointer(event.clientX, event.clientY);
  };

  const handleOverlayPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!overlayDragging || !customizeOpen || !hasOverlayText) return;

    event.preventDefault();
    updateOverlayPositionFromPointer(event.clientX, event.clientY);
  };

  const handleOverlayPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!overlayDragging) return;

    event.preventDefault();
    event.stopPropagation();
    setOverlayDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      className={`profile-showcase-modal-overlay profile-showcase-mobile-open ${previewExpanded ? "profile-showcase-preview-expanded" : ""}`}
      style={profileShowcaseModalOverlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Create Showcase"
    >
      <div className="profile-showcase-modal-shell" style={profileShowcaseModalStyle}>
        <div className="profile-showcase-modal-header" style={profileShowcaseModalHeaderStyle}>
          <div style={profileShowcaseModalBrandRowStyle}>
            <span style={profileShowcaseModalLogoStyle}>
              <img
                src="/parapost-icon-white.png"
                alt=""
                aria-hidden="true"
                style={profileShowcaseModalLogoImageStyle}
              />
            </span>
            <span>
              <p style={profileShowcaseModalEyebrowStyle}>Parapost Showcases</p>
              <h3 style={profileShowcaseModalTitleStyle}>Create Showcase</h3>
              <p style={profileShowcaseModalSubtitleStyle}>
                Add a photo or video, name it, choose a duration, and create.
              </p>
              <div style={profileShowcaseModalFlowPillsStyle}>
                <span style={profileShowcaseModalFlowPillStyle}>Simple first</span>
                <span style={profileShowcaseModalFlowPillStyle}>Customize optional</span>
              </div>
            </span>
          </div>
          <button type="button" onClick={onClose} style={profileShowcaseModalCloseStyle} aria-label="Close Showcase creator">
            ×
          </button>
        </div>

        <div className="profile-showcase-studio-layout" style={profileShowcaseSimpleStudioStyle}>
          <div className="profile-showcase-simple-controls" style={profileShowcaseSimpleControlsStyle}>
            <button
              className="profile-showcase-upload-card"
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              onDrop={onMediaDrop}
              onDragOver={onMediaDragOver}
              onDragLeave={onMediaDragLeave}
              style={
                mediaPreviewUrl
                  ? profileShowcaseSimpleUploadCardSelectedStyle
                  : mediaDragActive
                    ? profileShowcaseSimpleUploadCardActiveStyle
                    : profileShowcaseSimpleUploadCardStyle
              }
            >
              <span style={profileShowcaseSimpleUploadIconStyle}>{mediaPreviewUrl ? "✓" : "⇧"}</span>
              <span className="profile-showcase-upload-copy">
                <strong style={profileShowcaseUploadTitleTextStyle}>
                  {mediaPreviewUrl ? "Media selected" : "Upload Photo or Video"}
                </strong>
                <small style={profileShowcaseUploadHelpTextStyle}>
                  {mediaPreviewUrl ? "Tap to replace this Showcase media" : "Tap to choose from your device"}
                </small>
                <small style={profileShowcaseUploadHelpTextStyle}>{mediaFileName || "JPG, PNG, MP4"}</small>
              </span>
            </button>

            <input ref={mediaInputRef} type="file" accept="image/*,video/*" onChange={onMediaChange} style={{ display: "none" }} />

            {mediaFileName ? (
              <div style={profileShowcaseSelectedFileStyle}>
                <span>{mediaType === "video" ? "Video" : "Photo"} ready: {mediaFileName}</span>
                <button type="button" onClick={onClearMedia} style={profileShowcaseTinyButtonStyle}>
                  Remove
                </button>
              </div>
            ) : null}

            <label style={profileShowcaseFieldLabelStyle}>
              Showcase name
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Give your Showcase a name"
                style={profileShowcaseInputStyle}
                maxLength={16}
              />
            </label>

            <div style={profileShowcaseDurationGroupStyle}>
              <div>
                <strong style={profileShowcaseDurationTitleStyle}>Duration</strong>
                <p style={profileShowcaseDurationHelpStyle}>Choose how long this Showcase stays on your profile.</p>
              </div>

              <div className="profile-showcase-duration-options" style={profileShowcaseDurationOptionsStyle}>
                {[
                  { value: "24h" as const, label: "24 hours", help: "Quick update" },
                  { value: "30d" as const, label: "30 days", help: "Recent feature" },
                  { value: "permanent" as const, label: "Permanent", help: "Until removed" },
                ].map((option) => {
                  const selected = duration === option.value;
                  return (
                    <button
                      className="profile-showcase-duration-option"
                      key={option.value}
                      type="button"
                      onClick={() => setDuration(option.value)}
                      style={selected ? profileShowcaseDurationOptionActiveStyle : profileShowcaseDurationOptionStyle}
                      aria-pressed={selected}
                    >
                      <span style={profileShowcaseDurationOptionLabelTextStyle}>{option.label}</span>
                      <small style={profileShowcaseDurationOptionHelpTextStyle}>{option.help}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={profileShowcaseAdvancedDividerStyle}>
              <span />
              <small>Advanced options</small>
              <span />
            </div>

            <button
              type="button"
              onClick={() => setCustomizeOpen((value) => !value)}
              style={customizeOpen ? profileShowcaseCustomizeButtonActiveStyle : profileShowcaseCustomizeButtonStyle}
              aria-expanded={customizeOpen}
            >
              ⚙ Customize
            </button>

            {customizeOpen ? (
              <div style={profileShowcaseCustomizePanelStyle}>
                <div style={profileShowcaseCustomizeIntroStyle}>
                  <strong>Customize Showcase</strong>
                  <small>Add cover text, choose a font, then adjust the preview.</small>
                </div>

                <label style={profileShowcaseFieldLabelStyle}>
                  Cover text <span style={profileShowcaseOptionalTextStyle}>Optional</span>
                  <textarea
                    value={coverText}
                    onChange={(event) => setCoverText(event.target.value)}
                    placeholder="Add text over your Showcase"
                    style={profileShowcaseTextareaStyle}
                    rows={3}
                  />
                </label>

                <div style={profileShowcaseFontGroupStyle}>
                  <strong style={profileShowcaseDurationTitleStyle}>Text overlay font</strong>
                  <p style={profileShowcaseDurationHelpStyle}>This changes the text shown over your photo, video, or text Showcase.</p>
                  <select
                    className="profile-showcase-font-select"
                    value={fontKey}
                    onChange={(event) => setFontKey(event.target.value as ShowcaseFontValue)}
                    style={profileShowcaseFontSelectStyle}
                    aria-label="Choose Showcase font"
                  >
                    {SHOWCASE_FONT_OPTIONS.map((font) => (
                      <option
                        key={font.value}
                        value={font.value}
                        style={{ background: "#080b12", color: "#ffffff" }}
                      >
                        {font.label}
                      </option>
                    ))}
                  </select>
                  <div style={{ ...profileShowcaseFontPreviewStyle, fontFamily: fontOption.family }}>
                    {cleanCoverText || "Preview optional overlay text"}
                  </div>
                </div>

                <div style={profileShowcaseDurationGroupStyle}>
                  <div>
                    <strong style={profileShowcaseDurationTitleStyle}>Visibility</strong>
                    <p style={profileShowcaseDurationHelpStyle}>Choose who can see this Showcase.</p>
                  </div>
                  <div style={profileShowcaseVisibilityOptionsStyle}>
                    {[
                      { value: "public" as const, label: "Public", icon: "public", help: "Everyone" },
                      { value: "friends" as const, label: "Friends", icon: "friends", help: "Friends only" },
                      { value: "private" as const, label: "Only me", icon: "private", help: "Private" },
                    ].map((option) => {
                      const selected = visibility === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setVisibility(option.value)}
                          style={selected ? profileShowcaseVisibilityOptionActiveStyle : profileShowcaseVisibilityOptionStyle}
                          aria-pressed={selected}
                        >
                          <span style={profileShowcaseVisibilityIconStyle}>
                            <span
                              className={`profile-showcase-visibility-symbol profile-showcase-visibility-symbol-${option.icon}`}
                              aria-hidden="true"
                            />
                          </span>
                          <span style={profileShowcaseVisibilityTextStyle}>
                            <strong>{option.label}</strong>
                            <small>{option.help}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="profile-showcase-preview-column" style={profileShowcasePreviewColumnStyle}>
            <div className="profile-showcase-preview-header" style={profileShowcasePreviewHeaderStyle}>
              <strong className="profile-showcase-preview-title" style={profileShowcaseDurationTitleStyle}>Live preview</strong>
              {customizeOpen ? <small className="profile-showcase-preview-help">Preview your overlay</small> : null}
            </div>

            <div
              ref={previewDragRef}
              className="profile-showcase-preview-phone"
              style={{
                ...profileShowcasePreviewPhoneStyle,
                cursor: customizeOpen && hasOverlayText ? (overlayDragging ? "grabbing" : "grab") : profileShowcasePreviewPhoneStyle.cursor,
                touchAction: customizeOpen && hasOverlayText ? "none" : profileShowcasePreviewPhoneStyle.touchAction,
                userSelect: customizeOpen && hasOverlayText ? "none" : profileShowcasePreviewPhoneStyle.userSelect,
              }}
              role="button"
              tabIndex={0}
              aria-label={
                customizeOpen && hasOverlayText
                  ? "Drag Showcase text around the preview"
                  : previewExpanded
                    ? "Return Showcase preview to normal size"
                    : "Stretch Showcase preview"
              }
              onPointerDown={handleOverlayPointerDown}
              onPointerMove={handleOverlayPointerMove}
              onPointerUp={handleOverlayPointerEnd}
              onPointerCancel={handleOverlayPointerEnd}
              onClick={() => {
                if (!customizeOpen) setPreviewExpanded((value) => !value);
              }}
              onKeyDown={(event) => {
                if (!customizeOpen && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setPreviewExpanded((value) => !value);
                }
              }}
            >
              {mediaPreviewUrl && mediaType === "image" ? (
                <img src={mediaPreviewUrl} alt="" style={profileShowcasePreviewMediaStyle} />
              ) : mediaPreviewUrl && mediaType === "video" ? (
                <video src={mediaPreviewUrl} muted playsInline controls style={profileShowcasePreviewMediaStyle} />
              ) : (
                <div style={profileShowcasePreviewCanvasStyle} />
              )}

              <div style={profileShowcasePreviewOverlayStyle}>
                {customizeOpen && cleanCoverText ? (
                  <div style={profileShowcaseVerticalSizeRailStyle}>
                    <input
                      className="profile-showcase-vertical-size-slider"
                      type="range"
                      min={SHOWCASE_OVERLAY_MIN_FONT_SIZE}
                      max={SHOWCASE_OVERLAY_MAX_FONT_SIZE}
                      step={1}
                      value={overlayFontSize}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setOverlayFontSize(clampShowcaseOverlayFontSize(Number(event.target.value)))}
                      style={profileShowcaseVerticalSizeSliderStyle}
                      aria-label="Showcase text size"
                    />
                  </div>
                ) : null}

                {customizeOpen && cleanCoverText && isHorizontallyCentered ? (
                  <span style={profileShowcaseCenterGuideVerticalStyle} />
                ) : null}

                {customizeOpen && cleanCoverText && isVerticallyCentered ? (
                  <span style={profileShowcaseCenterGuideHorizontalStyle} />
                ) : null}

                {hasOverlayText ? (
                  <span
                    style={{
                      ...profileShowcasePreviewTextStyle,
                      left: `${textPosition.x}%`,
                      top: `${textPosition.y}%`,
                      fontFamily: fontOption.family,
                      fontSize: `${displayFontSize}px`,
                      width: overlayWidth,
                      maxWidth: overlayWidth,
                      cursor: overlayDragging ? "grabbing" : "grab",
                      userSelect: "none",
                      touchAction: "none",
                    }}
                  >
                    {previewCopy}
                  </span>
                ) : null}

                {customizeOpen && cleanCoverText ? (
                  <small style={profileShowcaseDragHintStyle}>{overlayDragging ? "Move text" : "Drag text"}</small>
                ) : null}
              </div>
            </div>

            <div style={profileShowcasePreviewMetaStyle}>
              <span>
                {customizeOpen
                  ? "Move text, choose font, and set visibility."
                  : cleanCoverText
                    ? "This is how your Showcase will look."
                    : "Overlay text is optional. Use Customize if you want to add writing."}
              </span>
            </div>
          </div>
        </div>

        {error ? <p style={profileShowcaseErrorStyle}>{error}</p> : null}

        <div className="profile-showcase-modal-actions" style={profileShowcaseModalActionsStyle}>
          <button type="button" onClick={onClose} style={profileShowcaseCancelButtonStyle}>Cancel</button>
          <button type="button" onClick={onCreate} disabled={saving} style={{ ...profileShowcaseCreateButtonStyle, opacity: saving ? 0.66 : 1 }}>
            {saving ? "Creating..." : "✨ Create Showcase"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileBottomNav({
  currentUserId,
  notificationsCount,
  onCreatePost,
}: {
  currentUserId: string;
  notificationsCount: number;
  onCreatePost: () => void;
}) {
  return (
    <nav className="dashboard-bottom-nav" style={mobileBottomNavStyle}>
      <Link href="/dashboard" style={mobileNavItemActiveStyle}><HomeIcon /> <span>Home</span></Link>
      <Link href="/reels" style={mobileNavItemStyle}><ReelsIcon /> <span>Reels</span></Link>
      <button type="button" onClick={onCreatePost} style={mobileCenterPlusStyle} aria-label="Create post"><PlusIcon /></button>
      <Link href="/messages" style={mobileNavItemStyle}>
        <span style={{ position: "relative", display: "inline-flex" }}>
          <ChatIcon />
          {notificationsCount > 0 ? <span style={mobileNavBadgeStyle}>{notificationsCount > 9 ? "9+" : notificationsCount}</span> : null}
        </span>
        <span>Parachat</span>
      </Link>
      <Link href={currentUserId ? `/profile/${currentUserId}` : "/dashboard"} style={mobileNavItemStyle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M4.5 21C5.5 16.8 8.4 14.5 12 14.5C15.6 14.5 18.5 16.8 19.5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>Profile</span>
      </Link>
    </nav>
  );
}


const selectedFeelingActivityStyle: CSSProperties = {
  marginTop: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  maxWidth: "100%",
  borderRadius: 14,
  border: "1px solid var(--parapost-accent-border)",
  background: "linear-gradient(135deg, var(--parapost-accent-soft), color-mix(in srgb, var(--parapost-accent-2) 8%, transparent))",
  color: "#fff",
  padding: "8px 10px",
};

const selectedFeelingCategoryStyle: CSSProperties = {
  color: "var(--parapost-accent-readable-text)",
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const selectedFeelingLabelStyle: CSSProperties = {
  color: "#fff",
  fontSize: 13,
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const selectedFeelingRemoveStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 999,
  background: "rgba(255,255,255,0.055)",
  color: "#e5e7eb",
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  marginLeft: "auto",
};

const feelingActivityModalStyle: CSSProperties = {
  width: "min(720px, 100%)",
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(8,10,18,0.98))",
  boxShadow: "0 28px 80px rgba(0,0,0,0.58)",
  padding: 18,
};

const feelingActivityIntroStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#9ca3af",
  fontSize: 13,
  lineHeight: 1.45,
};

const feelingActivitySelectedPreviewStyle: CSSProperties = {
  ...selectedFeelingActivityStyle,
  display: "flex",
  marginTop: 0,
  marginBottom: 14,
};

const feelingActivitySectionStyle: CSSProperties = {
  marginTop: 14,
};

const feelingActivitySectionTitleStyle: CSSProperties = {
  margin: "0 0 10px",
  color: "#f9fafb",
  fontSize: 14,
  fontWeight: 950,
};

const feelingActivityGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const feelingActivityOptionStyle: CSSProperties = {
  minHeight: 58,
  display: "flex",
  alignItems: "center",
  gap: 10,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.045)",
  color: "#fff",
  padding: "10px 12px",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

const feelingActivityOptionActiveStyle: CSSProperties = {
  border: "1px solid var(--parapost-accent-active-border)",
  background: "linear-gradient(135deg, var(--parapost-accent-soft), var(--parapost-accent-muted-bg))",
  boxShadow: "0 0 22px color-mix(in srgb, var(--parapost-accent-2) 18%, transparent)",
};

const feelingActivityOptionDotStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 12,
  flexShrink: 0,
  background: "linear-gradient(135deg, var(--parapost-accent-1), color-mix(in srgb, var(--parapost-accent-2) 72%, transparent))",
  boxShadow: "0 0 18px var(--parapost-accent-glow)",
};

const feelingActivityOptionLabelStyle: CSSProperties = {
  display: "block",
  color: "#fff",
  fontSize: 13,
  fontWeight: 950,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const feelingActivityOptionHelperStyle: CSSProperties = {
  display: "block",
  color: "#9ca3af",
  fontSize: 11,
  marginTop: 2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const mobileInsightsShellStyle: CSSProperties = {
  display: "none",
  gap: 14,
  borderRadius: 24,
  border: "1px solid var(--parapost-accent-border)",
  background: "radial-gradient(circle at 14% 0%, var(--parapost-accent-soft), transparent 40%), linear-gradient(180deg, rgba(18,24,38,0.94), rgba(8,10,18,0.92))",
  boxShadow: "0 18px 48px rgba(0,0,0,0.30), 0 0 28px var(--parapost-accent-glow)",
  padding: 16,
};

const mobileInsightsHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const miniEyebrowStyle: CSSProperties = {
  color: "var(--parapost-accent-text)",
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const privatePillStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--parapost-accent-text) 24%, transparent)",
  background: "color-mix(in srgb, var(--parapost-accent-2) 12%, transparent)",
  color: "var(--parapost-accent-readable-text)",
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const mobileInsightsStatsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const mobileRecentlyViewedBoxStyle: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.035)",
  padding: 12,
};

const mobileSubHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
};

const privateMiniTextStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: 11,
  fontWeight: 800,
};

const mobileProfileRailStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  overflowX: "auto",
  paddingBottom: 2,
};

const mobileProfileBubbleStyle: CSSProperties = {
  minWidth: 64,
  display: "grid",
  justifyItems: "center",
  gap: 6,
  color: "#e5e7eb",
  textDecoration: "none",
  fontSize: 11,
  fontWeight: 850,
  textAlign: "center",
};

const mobileProfileSummaryStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  padding: 12,
};

const mobileMiniProfileButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  textDecoration: "none",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 900,
  flexShrink: 0,
};

const mobileQuickToolsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const mobileQuickToolButtonStyle: CSSProperties = {
  minHeight: 42,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const mobileQuickToolLinkStyle: CSSProperties = {
  ...mobileQuickToolButtonStyle,
  display: "grid",
  placeItems: "center",
  textDecoration: "none",
};

const mobileSponsorPreviewStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 20,
  border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 20%, transparent)",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 12%, transparent), rgba(6,182,212,0.05))",
  padding: 12,
};

const railHeroProfileStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 12%, transparent), rgba(255,255,255,0.035))",
  padding: 12,
};

const railProfileButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  textDecoration: "none",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 900,
  flexShrink: 0,
};

const railStatGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const railStatTileStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.04)",
  padding: "10px 11px",
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const railStatValueStyle: CSSProperties = {
  color: "#fff",
  fontSize: 18,
  fontWeight: 950,
  lineHeight: 1,
  flexShrink: 0,
};

const railStatLabelStyle: CSSProperties = {
  color: "#d1d5db",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const discoverProfileRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#fff",
  textDecoration: "none",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  padding: 10,
};

const miniArrowStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--parapost-accent-readable-text)",
  background: "color-mix(in srgb, var(--parapost-accent-2) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 18%, transparent)",
  fontSize: 18,
  lineHeight: 1,
  fontWeight: 900,
  flexShrink: 0,
};

const privacyNoticeStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--parapost-accent-text) 18%, transparent)",
  background: "color-mix(in srgb, var(--parapost-accent-2) 8%, transparent)",
  color: "var(--parapost-accent-readable-text)",
  padding: "9px 10px",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.45,
};

const reelsRailFeatureStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-3) 12%, transparent), color-mix(in srgb, var(--parapost-accent-2) 10%, transparent))",
  padding: 12,
};

const reelsRailIconStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.92)",
  color: "#111827",
  fontWeight: 950,
  flexShrink: 0,
};

const railPrimaryLinkStyle: CSSProperties = {
  minHeight: 40,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "#fff",
  color: "#000",
  textDecoration: "none",
  fontWeight: 950,
  padding: "0 14px",
};

const sponsorCardStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 12%, transparent), var(--parapost-accent-muted-bg))",
  padding: 12,
};

const sponsorIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  color: "#fff",
  fontWeight: 950,
  background: "linear-gradient(135deg, var(--parapost-accent-1), var(--parapost-accent-3))",
  boxShadow: "0 0 22px color-mix(in srgb, var(--parapost-accent-2) 24%, transparent)",
  flexShrink: 0,
};

// Phase 3.2B: dashboard now uses the global Parapost accent layer while keeping text readable.
const dashboardRootStyle: CSSProperties = {
  minHeight: "100vh",
  height: "auto",
  width: "100%",
  maxWidth: "100vw",
  position: "relative",
  overflowX: "hidden",
  overflowY: "visible",
  background:
    "radial-gradient(circle at 55% 0%, var(--parapost-accent-muted-bg), transparent 34%), radial-gradient(circle at 10% 10%, var(--parapost-accent-active-bg), transparent 30%), #05070d",
  color: "#f9fafb",
};

const backgroundGlowStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(90deg, rgba(0,0,0,0.7), rgba(0,0,0,0.1), rgba(0,0,0,0.64)), radial-gradient(circle at 75% 30%, color-mix(in srgb, var(--parapost-accent-2) 12%, transparent), transparent 28%)",
  zIndex: 0,
};

const dashboardShellStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: "1860px",
  margin: "0 auto",
  padding: "24px 18px 110px",
};

const dashboardGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "300px minmax(0, 1fr) 360px",
  gap: "28px",
  alignItems: "start",
};

const leftSidebarStyle: CSSProperties = {
  position: "sticky",
  top: "18px",
  alignSelf: "start",
  height: "auto",
  maxHeight: "none",
  overflow: "visible",
  borderRight: "1px solid rgba(255,255,255,0.09)",
  padding: "0 24px 18px 4px",
};

const mainColumnStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: "1040px",
  margin: "0 auto",
  width: "100%",
};

const rightRailStyle: CSSProperties = {
  position: "sticky",
  top: "18px",
  alignSelf: "start",
  maxHeight: "none",
  overflow: "visible",
  display: "grid",
  gap: "18px",
  paddingBottom: "18px",
};

const feedLoadMoreSentinelStyle: CSSProperties = {
  width: "100%",
  height: "72px",
  display: "block",
  pointerEvents: "none",
};

const sidebarLogoStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  color: "#fff",
  textDecoration: "none",
  marginBottom: "28px",
};

const logoGhostCircleStyle: CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 18%, transparent), rgba(255,255,255,0.04))",
  border: "2px solid color-mix(in srgb, var(--parapost-accent-3) 72%, transparent)",
  boxShadow: "0 0 28px color-mix(in srgb, var(--parapost-accent-2) 55%, transparent)",
  color: "#fff",
  fontWeight: 950,
  fontSize: 24,
};

const logoWordStyle: CSSProperties = { fontSize: 32, fontWeight: 950, lineHeight: 0.95, letterSpacing: "0.02em" };
const logoNetworkStyle: CSSProperties = { color: "var(--parapost-accent-text)", letterSpacing: "0.42em", fontWeight: 900, fontSize: 14, marginTop: 5 };

const sidebarNavStyle: CSSProperties = { display: "grid", gap: 8 };

const sidebarItemStyle: CSSProperties = {
  minHeight: 52,
  borderRadius: 16,
  color: "#d1d5db",
  textDecoration: "none",
  display: "grid",
  gridTemplateColumns: "28px 1fr auto",
  alignItems: "center",
  gap: 10,
  padding: "0 16px",
  border: "1px solid transparent",
};

const activeSidebarItemStyle: CSSProperties = {
  ...sidebarItemStyle,
  color: "#fff",
  background: "linear-gradient(90deg, var(--parapost-accent-active-bg), color-mix(in srgb, var(--parapost-accent-1) 22%, transparent))",
  border: "1px solid var(--parapost-accent-active-border)",
  boxShadow: "0 0 24px var(--parapost-accent-glow)",
};

const mutedSidebarItemStyle: CSSProperties = {
  ...sidebarItemStyle,
  color: "rgba(209,213,219,0.44)",
  opacity: 0.58,
  cursor: "default",
  pointerEvents: "none",
  background: "rgba(255,255,255,0.015)",
};

const sidebarComposerReelIconStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "color-mix(in srgb, var(--parapost-accent-3) 18%, transparent)",
  color: "var(--parapost-accent-readable-text)",
  fontSize: 12,
  fontWeight: 950,
  lineHeight: 1,
};

const sidebarIconWrapStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center" };
const dotIconStyle: CSSProperties = { width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.55)" };
const mutedDotIconStyle: CSSProperties = { width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.26)" };
const sidebarBadgeStyle: CSSProperties = { minWidth: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", background: "var(--parapost-accent-1)", color: "#fff", fontSize: 12, fontWeight: 900, padding: "0 7px" };
const mutedSidebarBadgeStyle: CSSProperties = { ...sidebarBadgeStyle, background: "color-mix(in srgb, var(--parapost-accent-2) 22%, transparent)", color: "rgba(255,255,255,0.68)", border: "1px solid rgba(255,255,255,0.08)" };
const sidebarDividerStyle: CSSProperties = { height: 1, background: "rgba(255,255,255,0.12)", margin: "20px 0" };
const sidebarSectionLabelStyle: CSSProperties = { color: "var(--parapost-accent-text)", fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 };
const sidebarSectionHeaderRowStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 };
const sidebarSectionSoonBadgeStyle: CSSProperties = { borderRadius: 999, background: "color-mix(in srgb, var(--parapost-accent-2) 18%, transparent)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.76)", padding: "4px 8px", fontSize: 10, fontWeight: 950, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" };
const paranormalHubIntroStyle: CSSProperties = { margin: "0 0 10px", borderRadius: 14, border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 16%, transparent)", background: "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.025))", color: "color-mix(in srgb, var(--parapost-accent-readable-text) 76%, transparent)", fontSize: 12, lineHeight: 1.45, padding: "10px 12px" };

const goLiveCardStyle: CSSProperties = {
  marginTop: 22,
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 18,
  padding: 16,
  textDecoration: "none",
  background: "var(--parapost-accent-muted-bg)",
  border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 24%, transparent)",
  boxShadow: "0 0 20px var(--parapost-accent-muted-bg)",
  opacity: 0.66,
  cursor: "default",
};

const goLiveIconStyle: CSSProperties = { width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 26 };
const goLiveSoonBadgeStyle: CSSProperties = { marginLeft: "auto", borderRadius: 999, background: "color-mix(in srgb, var(--parapost-accent-2) 22%, transparent)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.78)", padding: "5px 8px", fontSize: 11, fontWeight: 950, whiteSpace: "nowrap" };
const sidebarProfileStyle: CSSProperties = { marginTop: 22, display: "flex", alignItems: "center", gap: 10, textDecoration: "none", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, padding: 10, background: "rgba(255,255,255,0.04)" };

const desktopTopBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  marginBottom: 22,
};

const searchWrapStyle: CSSProperties = {
  position: "relative",
  height: 54,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.055)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 36px rgba(0,0,0,0.18)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 18px",
  color: "#d1d5db",
  flex: 1,
  maxWidth: 620,
};

const searchInputStyle: CSSProperties = { flex: 1, minWidth: 0, height: "100%", background: "transparent", color: "#fff", border: 0, outline: 0, fontSize: 15, fontWeight: 750 };
const searchFilterButtonStyle: CSSProperties = { width: 36, height: 36, borderRadius: 14, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.045)", color: "#d1d5db", cursor: "pointer", display: "grid", placeItems: "center", gap: 4 };
const searchDropdownStyle: CSSProperties = { position: "absolute", left: 0, right: 0, top: "calc(100% + 10px)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(8,10,18,0.96)", backdropFilter: "blur(18px)", padding: 12, zIndex: 80, boxShadow: "0 22px 60px rgba(0,0,0,0.5)" };

const topActionRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 14 };
const squarePurpleButtonStyle: CSSProperties = { width: 54, height: 54, borderRadius: 16, display: "grid", placeItems: "center", border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 55%, transparent)", background: "linear-gradient(135deg, var(--parapost-accent-1), var(--parapost-accent-3))", color: "#fff", boxShadow: "0 0 26px var(--parapost-accent-strong-glow)", cursor: "pointer" };
const topIconButtonStyle: CSSProperties = { position: "relative", width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", color: "#fff", textDecoration: "none", border: "1px solid var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)" };
const topProfileButtonStyle: CSSProperties = { width: 46, height: 46, borderRadius: 16, display: "grid", placeItems: "center", textDecoration: "none", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.045)", overflow: "visible" };
const topBadgeStyle: CSSProperties = { position: "absolute", top: -8, right: -8, minWidth: 22, height: 22, borderRadius: 999, background: "var(--parapost-accent-1)", color: "#fff", fontSize: 12, fontWeight: 950, display: "grid", placeItems: "center", padding: "0 6px" };

const showcaseCardStyle: CSSProperties = { borderRadius: 24, border: "1px solid rgba(255,255,255,0.11)", background: "rgba(255,255,255,0.045)", padding: 14, marginBottom: 18, overflow: "hidden" };
const showcaseQuickGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.34fr) minmax(260px, 0.66fr)", gap: 16, alignItems: "stretch" };
const showcaseColumnStyle: CSSProperties = { minWidth: 0, display: "flex", flexDirection: "column", gap: 12 };
const showcaseSectionHeaderStyle: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const showcaseSectionTitleStyle: CSSProperties = { margin: 0, color: "#fff", fontSize: 18, fontWeight: 950, letterSpacing: "-0.02em" };
const showcaseSectionSubtitleStyle: CSSProperties = { margin: "4px 0 0", color: "#9ca3af", fontSize: 12.5, lineHeight: 1.35 };
const showcaseSmallLinkStyle: CSSProperties = { minHeight: 32, borderRadius: 999, border: "1px solid var(--parapost-accent-border)", background: "var(--parapost-accent-muted-bg)", color: "var(--parapost-accent-readable-text)", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 11px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" };
const showcaseScrollerStyle: CSSProperties = { display: "flex", gap: 16, alignItems: "stretch", overflowX: "auto", overflowY: "hidden", padding: "2px 2px 4px", scrollSnapType: "x proximity" };
const createShowcaseTileStyle: CSSProperties = { position: "relative", width: 104, minWidth: 104, height: 116, display: "grid", justifyItems: "center", alignContent: "center", gap: 6, borderRadius: 18, border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 22%, transparent)", color: "#fff", textDecoration: "none", background: "linear-gradient(180deg, color-mix(in srgb, var(--parapost-accent-2) 14%, transparent), rgba(0,0,0,0.18))", padding: 10, scrollSnapAlign: "start" };
const showcasePlusStyle: CSSProperties = { position: "absolute", right: 20, top: 62, width: 27, height: 27, borderRadius: 999, background: "var(--parapost-accent-1)", color: "#fff", display: "grid", placeItems: "center", border: "2px solid #0a0d14", fontWeight: 950 };
const createShowcaseHintStyle: CSSProperties = { color: "var(--parapost-accent-readable-text)", fontSize: 11, fontWeight: 850, textAlign: "center", lineHeight: 1.15 };
const showcaseTileStyle: CSSProperties = { width: 104, minWidth: 104, height: 116, display: "grid", justifyItems: "center", alignContent: "center", gap: 8, color: "#fff", textDecoration: "none", scrollSnapAlign: "start" };
const demoAvatarStyle: CSSProperties = { width: 78, height: 78, borderRadius: 999, border: "3px solid var(--parapost-accent-1)", display: "grid", placeItems: "center", background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 28%, transparent), rgba(0,0,0,0.8))", fontWeight: 950, fontSize: 26, boxShadow: "0 0 22px var(--parapost-accent-active-bg)" };
const showcaseNameStyle: CSSProperties = { width: "100%", fontSize: 12.5, textAlign: "center", color: "#e5e7eb", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const showcaseNameStrongStyle: CSSProperties = { color: "#fff", fontSize: 13, fontWeight: 950, textAlign: "center", lineHeight: 1.05 };
const newShowcaseIconStyle: CSSProperties = { width: 70, height: 70, borderRadius: 999, display: "grid", placeItems: "center", background: "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.24), color-mix(in srgb, var(--parapost-accent-2) 18%, transparent) 42%, rgba(7,9,13,0.98) 76%)", border: "3px solid color-mix(in srgb, var(--parapost-accent-2) 86%, transparent)", boxShadow: "0 0 22px color-mix(in srgb, var(--parapost-accent-2) 36%, transparent), inset 0 1px 0 rgba(255,255,255,0.13)" };
const newShowcasePlusInnerStyle: CSSProperties = { width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--parapost-accent-2), var(--parapost-accent-1))", color: "#fff", fontSize: 24, fontWeight: 950, boxShadow: "0 10px 22px var(--parapost-accent-strong-glow)" };
const friendShowcaseBubbleStyle: CSSProperties = { width: 76, height: 76, borderRadius: 999, display: "grid", placeItems: "center", overflow: "hidden", padding: 3, background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 90%, transparent), var(--parapost-accent-3))", boxShadow: "0 0 22px color-mix(in srgb, var(--parapost-accent-2) 32%, transparent)", border: "1px solid rgba(255,255,255,0.12)" };
const friendShowcaseMediaStyle: CSSProperties = { width: "100%", height: "100%", borderRadius: 999, objectFit: "cover", display: "block", border: "2px solid #07090d" };
const emptyFriendShowcaseTileStyle: CSSProperties = { width: 146, minWidth: 146, height: 116, display: "grid", justifyItems: "center", alignContent: "center", gap: 8, borderRadius: 18, border: "1px dashed rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.025)", color: "#d1d5db", scrollSnapAlign: "start" };
const emptyFriendShowcaseIconStyle: CSSProperties = { width: 54, height: 54, borderRadius: 999, display: "grid", placeItems: "center", border: "2px solid color-mix(in srgb, var(--parapost-accent-2) 42%, transparent)", color: "var(--parapost-accent-text)", background: "color-mix(in srgb, var(--parapost-accent-2) 10%, transparent)", fontWeight: 950 };
const showcaseArrowStyle: CSSProperties = { alignSelf: "center", minWidth: 38, width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 30, cursor: "pointer" };
const quickActionsColumnStyle: CSSProperties = { borderRadius: 22, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.18)", padding: 12, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
const quickActionsHeaderStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const quickActionsEyebrowStyle: CSSProperties = { color: "var(--parapost-accent-text)", fontSize: 11, fontWeight: 950, letterSpacing: "0.08em", textTransform: "uppercase" };
const quickActionsTitleStyle: CSSProperties = { color: "#fff", fontSize: 15, fontWeight: 950 };
const quickActionsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr", gap: 9 };
const quickActionTileStyle: CSSProperties = { minHeight: 54, borderRadius: 18, border: "1px solid rgba(255,255,255,0.095)", background: "rgba(255,255,255,0.045)", color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", cursor: "pointer", textAlign: "left", width: "100%" };
const quickActionIconStyle: CSSProperties = { width: 32, height: 32, borderRadius: 12, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--parapost-accent-2) 18%, transparent)", color: "var(--parapost-accent-readable-text)", fontWeight: 950, flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" };
const quickActionLabelStyle: CSSProperties = { display: "block", color: "#fff", fontSize: 13, fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const quickActionTextStyle: CSSProperties = { display: "block", color: "#9ca3af", fontSize: 11.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

const dashboardProfileShowcasesPanelStyle: CSSProperties = {
  marginBottom: 18,
  padding: "12px 0 16px",
  borderRadius: 18,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  borderLeft: "1px solid rgba(255,255,255,0.06)",
  background: "linear-gradient(180deg, rgba(38,25,52,0.68), rgba(17,19,24,0.86))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035), 0 16px 38px rgba(0,0,0,0.24)",
  overflow: "hidden",
};

const dashboardShowcasesHeaderStyle: CSSProperties = {
  margin: "0 14px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 10,
  flexWrap: "wrap",
};

const dashboardShowcasesTitleStyle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const dashboardShowcasesSubtitleStyle: CSSProperties = {
  margin: 0,
  color: "#9ca3af",
  fontSize: 12,
  lineHeight: 1.35,
};

const dashboardProfileShowcasesRowStyle: CSSProperties = {
  position: "relative",
  zIndex: 3,
  display: "flex",
  alignItems: "flex-start",
  gap: 16,
  minHeight: 92,
  overflowX: "auto",
  overflowY: "visible",
  padding: "0 14px 12px",
  scrollbarWidth: "thin",
  scrollbarColor: "color-mix(in srgb, var(--parapost-accent-2) 42%, transparent) rgba(255,255,255,0.04)",
};

const dashboardProfileShowcaseNewItemStyle: CSSProperties = {
  position: "relative",
  zIndex: 5,
  display: "grid",
  justifyItems: "center",
  gap: 6,
  minWidth: 78,
  width: 78,
  border: 0,
  background: "transparent",
  padding: "0 0 4px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const dashboardProfileShowcasePlusCircleStyle: CSSProperties = {
  width: 62,
  height: 62,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  border: "1px solid rgba(255,255,255,0.18)",
  background:
    "radial-gradient(circle at 32% 24%, rgba(255,255,255,0.22), transparent 23%), linear-gradient(135deg, var(--parapost-accent-2), var(--parapost-accent-1) 58%, #4f46e5)",
  color: "#ffffff",
  fontSize: 40,
  fontWeight: 950,
  lineHeight: 0.86,
  paddingBottom: 4,
  boxShadow:
    "0 16px 34px color-mix(in srgb, var(--parapost-accent-1) 38%, transparent), 0 0 34px color-mix(in srgb, var(--parapost-accent-2) 28%, transparent), inset 0 1px 0 rgba(255,255,255,0.16)",
};

const dashboardProfileShowcaseLabelStyle: CSSProperties = {
  position: "relative",
  zIndex: 6,
  display: "block",
  maxWidth: 86,
  color: "#f3e8ff",
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.1,
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  letterSpacing: "0.01em",
};

const dashboardProfileShowcaseItemStyle: CSSProperties = {
  position: "relative",
  zIndex: 4,
  display: "grid",
  justifyItems: "center",
  gap: 6,
  minWidth: 78,
  width: 78,
  border: 0,
  background: "transparent",
  padding: "0 0 4px",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
};

const dashboardProfileShowcaseCoverCircleStyle: CSSProperties = {
  position: "relative",
  width: 58,
  height: 58,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  borderRadius: 999,
  border: "1px solid var(--parapost-accent-border)",
  background:
    "radial-gradient(circle at 36% 18%, rgba(255,255,255,0.16), transparent 24%), linear-gradient(135deg, rgba(88,28,135,0.96), color-mix(in srgb, var(--parapost-accent-3) 58%, transparent))",
  boxShadow: "0 0 22px color-mix(in srgb, var(--parapost-accent-2) 20%, transparent), 0 12px 24px rgba(0,0,0,0.24)",
};

const dashboardProfileShowcaseCoverMediaStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  zIndex: 0,
};

const dashboardProfileShowcaseCoverShadeStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 1,
  background: "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.48))",
  pointerEvents: "none",
};

const dashboardProfileShowcaseCoverTextStyle: CSSProperties = {
  position: "absolute",
  zIndex: 2,
  width: "78%",
  maxWidth: "78%",
  color: "#ffffff",
  fontWeight: 950,
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  textAlign: "center",
  textShadow: "0 2px 10px rgba(0,0,0,0.52)",
  transform: "translate(-50%, -50%)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const dashboardShowcaseEmptyFriendStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 6,
  minWidth: 110,
  color: "#d1d5db",
  opacity: 0.88,
};

const dashboardShowcaseEmptyIconStyle: CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  border: "1px dashed var(--parapost-accent-border)",
  background: "color-mix(in srgb, var(--parapost-accent-2) 8%, transparent)",
  color: "var(--parapost-accent-text)",
  fontWeight: 950,
};

const profileShowcaseOptionalTextStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 750,
};

const profileShowcaseModalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  padding: "18px",
  background: "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--parapost-accent-2) 20%, transparent), transparent 38%), rgba(0,0,0,0.88)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

const profileShowcaseModalStyle: CSSProperties = {
  width: "min(1180px, calc(100vw - 32px))",
  height: "min(840px, calc(100vh - 32px))",
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  scrollbarWidth: "auto",
  scrollbarColor: "rgba(255,255,255,0.82) rgba(255,255,255,0.12)",
  borderRadius: "32px",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--parapost-accent-2) 28%, transparent), transparent 34%), radial-gradient(circle at 98% 10%, rgba(34,211,238,0.12), transparent 30%), linear-gradient(180deg, rgba(20,22,30,0.996), rgba(6,8,13,0.998))",
  boxShadow: "0 42px 120px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.035)",
  padding: "22px",
  direction: "ltr",
};

const profileShowcaseModalHeaderStyle: CSSProperties = {
  position: "relative",
  zIndex: 20,
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
  alignItems: "flex-start",
  marginBottom: "18px",
  paddingBottom: "14px",
  background: "transparent",
};

const profileShowcaseModalBrandRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr)",
  gap: "12px",
  alignItems: "center",
};

const profileShowcaseModalLogoStyle: CSSProperties = {
  width: "42px",
  height: "42px",
  display: "grid",
  placeItems: "center",
  borderRadius: "15px",
  background: "linear-gradient(135deg, var(--parapost-accent-2), var(--parapost-accent-1) 60%, #2563eb)",
  color: "#ffffff",
  boxShadow: "0 16px 34px color-mix(in srgb, var(--parapost-accent-1) 34%, transparent)",
  overflow: "hidden",
};

const profileShowcaseModalLogoImageStyle: CSSProperties = {
  width: "27px",
  height: "27px",
  objectFit: "contain",
  display: "block",
  filter: "drop-shadow(0 0 8px rgba(255,255,255,0.16))",
};

const profileShowcaseModalEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "var(--parapost-accent-text)",
  fontSize: "11px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const profileShowcaseModalTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 950,
  letterSpacing: "-0.04em",
};

const profileShowcaseModalSubtitleStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: 1.35,
  fontWeight: 750,
};

const profileShowcaseModalFlowPillsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginTop: "10px",
};

const profileShowcaseModalFlowPillStyle: CSSProperties = {
  border: "1px solid var(--parapost-accent-border)",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--parapost-accent-2) 10%, transparent)",
  color: "var(--parapost-accent-readable-text)",
  padding: "5px 8px",
  fontSize: "10px",
  fontWeight: 900,
};

const profileShowcaseModalCloseStyle: CSSProperties = {
  width: "38px",
  height: "38px",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.07)",
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: 900,
  cursor: "pointer",
  flex: "0 0 auto",
  boxShadow: "0 12px 24px rgba(0,0,0,0.24)",
};

const profileShowcaseSimpleStudioStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(330px, 0.88fr) minmax(410px, 1.12fr)",
  gap: "26px",
  alignItems: "start",
};

const profileShowcaseSimpleControlsStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: "12px",
};

const profileShowcaseSimpleUploadCardStyle: CSSProperties = {
  width: "100%",
  minHeight: "144px",
  border: "1px dashed var(--parapost-accent-active-border)",
  borderRadius: "24px",
  background: "radial-gradient(circle at 20% 0%, color-mix(in srgb, var(--parapost-accent-2) 20%, transparent), transparent 36%), linear-gradient(180deg, color-mix(in srgb, var(--parapost-accent-2) 11%, transparent), rgba(255,255,255,0.035))",
  color: "#ffffff",
  display: "grid",
  gridTemplateColumns: "58px minmax(0, 1fr)",
  alignItems: "center",
  gap: "16px",
  padding: "20px",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 50px rgba(0,0,0,0.24)",
};

const profileShowcaseSimpleUploadCardActiveStyle: CSSProperties = {
  ...profileShowcaseSimpleUploadCardStyle,
  border: "1px dashed rgba(34,211,238,0.70)",
  background: "radial-gradient(circle at 22% 0%, rgba(34,211,238,0.18), transparent 36%), linear-gradient(180deg, color-mix(in srgb, var(--parapost-accent-2) 14%, transparent), rgba(34,211,238,0.055))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(34,211,238,0.18), 0 22px 52px rgba(0,0,0,0.26)",
};

const profileShowcaseSimpleUploadCardSelectedStyle: CSSProperties = {
  ...profileShowcaseSimpleUploadCardStyle,
  border: "1px solid rgba(74,222,128,0.32)",
  background: "radial-gradient(circle at 22% 0%, rgba(74,222,128,0.12), transparent 36%), linear-gradient(180deg, color-mix(in srgb, var(--parapost-accent-2) 10%, transparent), rgba(74,222,128,0.040))",
};

const profileShowcaseSimpleUploadIconStyle: CSSProperties = {
  width: "58px",
  height: "58px",
  borderRadius: "20px",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 95%, transparent), color-mix(in srgb, var(--parapost-accent-1) 90%, transparent))",
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: 950,
  boxShadow: "0 14px 28px color-mix(in srgb, var(--parapost-accent-1) 30%, transparent)",
};

const profileShowcaseUploadTitleTextStyle: CSSProperties = {
  display: "block",
  color: "#ffffff",
  fontSize: "13px",
  lineHeight: 1.14,
  fontWeight: 950,
  letterSpacing: "-0.01em",
  margin: 0,
};

const profileShowcaseUploadHelpTextStyle: CSSProperties = {
  display: "block",
  color: "rgba(226,232,240,0.74)",
  fontSize: "10px",
  lineHeight: 1.18,
  fontWeight: 800,
  marginTop: "4px",
};

const profileShowcaseSelectedFileStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  margin: "9px 0 12px",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "13px",
  background: "rgba(255,255,255,0.045)",
  color: "#d1d5db",
  padding: "8px 10px",
  fontSize: "12px",
  fontWeight: 800,
};

const profileShowcaseTinyButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.11)",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.06)",
  color: "#ffffff",
  padding: "7px 10px",
  fontSize: "12px",
  fontWeight: 900,
  cursor: "pointer",
};

const profileShowcaseFieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  color: "#e5e7eb",
  fontSize: "12px",
  fontWeight: 900,
};

const profileShowcaseInputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "13px",
  background: "rgba(0,0,0,0.24)",
  color: "#ffffff",
  padding: "10px 12px",
  outline: "none",
  fontSize: "14px",
  fontFamily: "inherit",
};

const profileShowcaseTextareaStyle: CSSProperties = {
  ...profileShowcaseInputStyle,
  minHeight: "86px",
  lineHeight: 1.35,
  resize: "vertical",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
};

const profileShowcaseDurationGroupStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  marginTop: "10px",
};

const profileShowcaseDurationTitleStyle: CSSProperties = {
  display: "block",
  color: "#ffffff",
  fontSize: "13px",
};

const profileShowcaseDurationHelpStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: 1.35,
};

const profileShowcaseDurationOptionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
};

const profileShowcaseDurationOptionStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  minHeight: "74px",
  alignContent: "start",
  textAlign: "left",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "13px",
  background: "rgba(255,255,255,0.04)",
  color: "#e5e7eb",
  padding: "9px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 850,
};

const profileShowcaseDurationOptionActiveStyle: CSSProperties = {
  ...profileShowcaseDurationOptionStyle,
  border: "1px solid var(--parapost-accent-active-border)",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 24%, transparent), color-mix(in srgb, var(--parapost-accent-3) 10%, transparent))",
  boxShadow: "0 0 22px color-mix(in srgb, var(--parapost-accent-2) 16%, transparent)",
};

const profileShowcaseDurationOptionLabelTextStyle: CSSProperties = {
  display: "block",
  fontSize: "13px",
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: "-0.01em",
  whiteSpace: "normal",
};

const profileShowcaseDurationOptionHelpTextStyle: CSSProperties = {
  display: "block",
  fontSize: "10px",
  lineHeight: 1.12,
  color: "#9ca3af",
  fontWeight: 800,
};

const profileShowcaseAdvancedDividerStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: "10px",
  margin: "14px 0 10px",
  color: "#8b93a4",
  fontSize: "11px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const profileShowcaseCustomizeButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: "42px",
  border: "1px solid var(--parapost-accent-border)",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.035)",
  color: "var(--parapost-accent-readable-text)",
  fontSize: "14px",
  fontWeight: 950,
  cursor: "pointer",
  fontFamily: "inherit",
};

const profileShowcaseCustomizeButtonActiveStyle: CSSProperties = {
  ...profileShowcaseCustomizeButtonStyle,
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 24%, transparent), color-mix(in srgb, var(--parapost-accent-3) 10%, transparent))",
  border: "1px solid var(--parapost-accent-active-border)",
  color: "#ffffff",
};

const profileShowcaseCustomizePanelStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  marginTop: "12px",
  border: "1px solid var(--parapost-accent-border)",
  borderRadius: "20px",
  background: "radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--parapost-accent-2) 10%, transparent), transparent 38%), rgba(0,0,0,0.18)",
  padding: "13px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const profileShowcaseCustomizeIntroStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  border: "1px solid var(--parapost-accent-border)",
  borderRadius: "15px",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 13%, transparent), rgba(37,99,235,0.055))",
  padding: "11px",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 900,
};

const profileShowcaseFontGroupStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
};

const profileShowcaseFontSelectStyle: CSSProperties = {
  ...profileShowcaseInputStyle,
  minHeight: "42px",
  background: "rgba(7,10,16,0.98)",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: "12px",
  colorScheme: "dark",
};

const profileShowcaseFontPreviewStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "13px",
  background: "rgba(255,255,255,0.035)",
  color: "#ffffff",
  padding: "10px 12px",
  fontSize: "16px",
  fontWeight: 900,
};

const profileShowcaseVisibilityOptionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
};

const profileShowcaseVisibilityOptionStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.035)",
  color: "#ffffff",
  padding: "10px",
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  alignItems: "center",
  gap: "9px",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
  minHeight: "58px",
};

const profileShowcaseVisibilityOptionActiveStyle: CSSProperties = {
  ...profileShowcaseVisibilityOptionStyle,
  border: "1px solid var(--parapost-accent-active-border)",
  background: "linear-gradient(135deg, color-mix(in srgb, var(--parapost-accent-2) 24%, transparent), rgba(37,99,235,0.11))",
  boxShadow: "0 0 0 1px color-mix(in srgb, var(--parapost-accent-2) 12%, transparent), 0 14px 30px color-mix(in srgb, var(--parapost-accent-1) 18%, transparent)",
};

const profileShowcaseVisibilityIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "13px",
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.16), transparent 28%), color-mix(in srgb, var(--parapost-accent-2) 16%, transparent)",
  border: "1px solid var(--parapost-accent-border)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  position: "relative",
};

const profileShowcaseVisibilityTextStyle: CSSProperties = {
  display: "grid",
  gap: "2px",
  minWidth: 0,
};

const profileShowcasePreviewColumnStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  minWidth: 0,
  borderLeft: "1px solid rgba(255,255,255,0.085)",
  paddingLeft: "24px",
  alignContent: "start",
  justifyItems: "stretch",
};

const profileShowcasePreviewHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 850,
};

const profileShowcasePreviewPhoneStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "clamp(330px, 42vh, 440px)",
  minHeight: "330px",
  maxHeight: "440px",
  justifySelf: "stretch",
  alignSelf: "start",
  borderRadius: "32px",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "radial-gradient(circle at 20% 0%, rgba(34,211,238,0.30), transparent 34%), linear-gradient(135deg, rgba(20,184,166,0.78), color-mix(in srgb, var(--parapost-accent-1) 90%, transparent) 52%, color-mix(in srgb, var(--parapost-accent-2) 84%, transparent))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 34px 86px rgba(0,0,0,0.50)",
};

const profileShowcasePreviewCanvasStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(135deg, rgba(20,184,166,0.80), color-mix(in srgb, var(--parapost-accent-3) 66%, transparent) 45%, color-mix(in srgb, var(--parapost-accent-2) 86%, transparent))",
};

const profileShowcasePreviewMediaStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
  objectPosition: "center center",
  display: "block",
  backgroundColor: "#05060a",
};

const profileShowcasePreviewOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "block",
  padding: "18px",
  background: "linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.10) 45%, rgba(0,0,0,0.42))",
  touchAction: "none",
  cursor: "grab",
  userSelect: "none",
  WebkitUserSelect: "none",
  contain: "layout paint",
};

const profileShowcasePreviewTextStyle: CSSProperties = {
  position: "absolute",
  transform: "translate3d(-50%, -50%, 0)",
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: 950,
  textAlign: "center",
  lineHeight: 1.08,
  textShadow: "0 4px 16px rgba(0,0,0,0.42)",
  pointerEvents: "none",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  maxHeight: "72%",
  overflow: "hidden",
  padding: "0 4px",
  minWidth: "80px",
  boxSizing: "border-box",
  userSelect: "none",
  WebkitUserSelect: "none",
  willChange: "left, top, transform",
  transition: "none",
  contain: "layout paint",
  backfaceVisibility: "hidden",
};

const profileShowcaseVerticalSizeRailStyle: CSSProperties = {
  position: "absolute",
  left: "10px",
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 4,
  height: "180px",
  display: "grid",
  placeItems: "center",
};

const profileShowcaseVerticalSizeSliderStyle: CSSProperties = {
  width: "180px",
  transform: "rotate(-90deg)",
  accentColor: "var(--parapost-accent-2)",
};

const profileShowcaseCenterGuideVerticalStyle: CSSProperties = {
  position: "absolute",
  top: "8%",
  bottom: "8%",
  left: "50%",
  width: "1px",
  transform: "translateX(-50%)",
  background: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.42) 0 5px, transparent 5px 10px)",
  boxShadow: "0 0 12px color-mix(in srgb, var(--parapost-accent-2) 22%, transparent)",
  pointerEvents: "none",
};

const profileShowcaseCenterGuideHorizontalStyle: CSSProperties = {
  position: "absolute",
  left: "8%",
  right: "8%",
  top: "50%",
  height: "1px",
  transform: "translateY(-50%)",
  background: "repeating-linear-gradient(to right, rgba(255,255,255,0.42) 0 5px, transparent 5px 10px)",
  boxShadow: "0 0 12px color-mix(in srgb, var(--parapost-accent-2) 22%, transparent)",
  pointerEvents: "none",
};

const profileShowcaseDragHintStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: "10px",
  transform: "translateX(-50%)",
  borderRadius: "999px",
  background: "rgba(0,0,0,0.48)",
  color: "rgba(255,255,255,0.88)",
  padding: "6px 10px",
  fontSize: "10px",
  fontWeight: 900,
  pointerEvents: "none",
  boxShadow: "0 8px 20px rgba(0,0,0,0.26)",
};

const profileShowcasePositionControlsStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "14px",
  padding: "10px",
  color: "#d1d5db",
  fontSize: "12px",
  fontWeight: 850,
};

const profileShowcasePreviewMetaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  width: "100%",
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 800,
};

const profileShowcaseErrorStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#fecaca",
  fontSize: "13px",
  fontWeight: 850,
};

const profileShowcaseModalActionsStyle: CSSProperties = {
  position: "static",
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "16px",
  paddingTop: "12px",
  borderTop: "1px solid rgba(255,255,255,0.07)",
  background: "transparent",
  zIndex: 1,
};

const profileShowcaseCancelButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "11px 13px",
  fontWeight: 900,
  cursor: "pointer",
};

const profileShowcaseCreateButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.13)",
  background: "linear-gradient(135deg, var(--parapost-accent-2), var(--parapost-accent-1) 58%, #2563eb)",
  color: "#ffffff",
  borderRadius: "15px",
  padding: "12px 18px",
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 20px 38px color-mix(in srgb, var(--parapost-accent-1) 34%, transparent)",
};

const composerCardStyle: CSSProperties = { borderRadius: 24, border: "1px solid var(--parapost-accent-border)", background: "radial-gradient(circle at 12% 0%, var(--parapost-accent-soft), transparent 36%), linear-gradient(180deg, rgba(20,26,43,0.90), rgba(9,12,21,0.92))", padding: 16, marginBottom: 16, boxShadow: "0 18px 46px rgba(0,0,0,0.30), 0 0 28px var(--parapost-accent-glow), inset 0 1px 0 rgba(255,255,255,0.045)", overflow: "hidden", scrollMarginTop: 96 };
const composerHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 };
const composerIdentityStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 0 };
const composerTitleStyle: CSSProperties = { margin: 0, color: "#fff", fontSize: 17, fontWeight: 950, letterSpacing: "-0.02em" };
const composerSubtitleStyle: CSSProperties = { margin: "3px 0 0", color: "#9ca3af", fontSize: 12.5, lineHeight: 1.35 };
const composerDestinationBadgeStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 30, borderRadius: 999, padding: "0 11px", color: "var(--parapost-accent-readable-text)", fontSize: 11, fontWeight: 950, whiteSpace: "nowrap", background: "var(--parapost-accent-active-bg)", border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 35%, transparent)", boxShadow: "0 10px 24px var(--parapost-accent-active-bg)" };
const composerTopRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 12, alignItems: "center" };
const composerInputStyle: CSSProperties = { width: "100%", minHeight: 58, maxHeight: 190, resize: "none", overflowY: "auto", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 18, background: "rgba(255,255,255,0.04)", color: "#fff", outline: 0, padding: "16px 18px", fontSize: 15.5, lineHeight: 1.45, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" };
const composerImageButtonStyle: CSSProperties = { width: 46, height: 46, borderRadius: 15, border: "1px solid rgba(255,255,255,0.11)", background: "rgba(255,255,255,0.045)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 };
const composerActionGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 9, alignItems: "center", marginTop: 13 };
const composerActionPillStyle: CSSProperties = { minHeight: 39, borderRadius: 14, border: "1px solid rgba(255,255,255,0.085)", background: "rgba(255,255,255,0.038)", color: "#fff", padding: "0 12px", fontWeight: 850, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", whiteSpace: "nowrap", fontSize: 12.5, transition: "border-color 160ms ease, background 160ms ease, transform 160ms ease" };
const composerActionPillActiveStyle: CSSProperties = { border: "1px solid var(--parapost-accent-active-border)", background: "linear-gradient(135deg, var(--parapost-accent-soft), color-mix(in srgb, var(--parapost-accent-2) 12%, transparent))", boxShadow: "0 0 18px var(--parapost-accent-glow)" };
const composerActionDisabledStyle: CSSProperties = { opacity: 0.46, background: "rgba(255,255,255,0.018)", border: "1px dashed rgba(255,255,255,0.11)", cursor: "not-allowed", color: "#9ca3af" };
const composerActionNoteStyle: CSSProperties = { borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.045)", color: "#a1a1aa", padding: "2px 6px", fontSize: 10, fontWeight: 900, lineHeight: 1, textTransform: "uppercase", letterSpacing: "0.03em", flexShrink: 0 };
const composerActionIconStyle: CSSProperties = { width: 24, height: 24, borderRadius: 8, display: "grid", placeItems: "center", color: "#fff", fontSize: 13, fontWeight: 950, lineHeight: 1 };
const composerActionToneStyles: Record<"green" | "pink" | "red" | "gold", CSSProperties> = {
  green: { background: "var(--parapost-accent-muted-bg)", color: "var(--parapost-accent-readable-text)" },
  pink: { background: "color-mix(in srgb, var(--parapost-accent-3) 18%, transparent)", color: "var(--parapost-accent-readable-text)" },
  red: { background: "rgba(239,68,68,0.18)", color: "#fca5a5" },
  gold: { background: "var(--parapost-accent-muted-bg)", color: "var(--parapost-accent-readable-text)" },
};
const composerFooterStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 13, flexWrap: "wrap" };
const composerHelperTextStyle: CSSProperties = { color: "#6b7280", fontSize: 11.5, lineHeight: 1.35 };
const publishButtonStyle: CSSProperties = { marginLeft: "auto", minHeight: 35, borderRadius: 14, border: 0, background: "linear-gradient(135deg, #ffffff, var(--parapost-accent-readable-text))", color: "#111827", fontWeight: 900, padding: "0 15px", cursor: "pointer", boxShadow: "0 10px 20px color-mix(in srgb, var(--parapost-accent-2) 18%, transparent)", whiteSpace: "nowrap", fontSize: 12.5 };

const imagePreviewWrapStyle: CSSProperties = {
  width: "min(100%, 430px)",
  margin: "12px auto 0",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  overflow: "hidden",
  background: "rgba(0,0,0,0.22)",
  position: "relative",
};
const imagePreviewStyle: CSSProperties = { width: "100%", maxHeight: 360, objectFit: "cover", display: "block" };
const composerPreviewGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 6,
  padding: 8,
  maxHeight: 292,
  overflow: "hidden",
};
const composerPreviewSingleGridStyle: CSSProperties = {
  gridTemplateColumns: "1fr",
  maxHeight: 260,
};
const composerPreviewTileStyle: CSSProperties = {
  position: "relative",
  minHeight: 132,
  height: 132,
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  overflow: "hidden",
  padding: 0,
  background: "rgba(255,255,255,0.04)",
  cursor: "pointer",
};
const composerPreviewSingleTileStyle: CSSProperties = {
  minHeight: 246,
  height: 246,
};
const composerPreviewImageStyle: CSSProperties = { width: "100%", height: "100%", minHeight: "100%", objectFit: "cover", display: "block" };
const composerPreviewOverlayStyle: CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.55)", color: "#ffffff", fontWeight: 950, fontSize: 30 };
const imagePreviewMetaRowStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12, flexWrap: "wrap" };
const removeImageButtonStyle: CSSProperties = { border: "1px solid rgba(248,113,113,0.3)", background: "rgba(127,29,29,0.82)", color: "#fff", borderRadius: 999, padding: "8px 12px", fontWeight: 900, cursor: "pointer" };
const selectedImageNameStyle: CSSProperties = { maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRadius: 999, padding: "7px 10px", background: "rgba(0,0,0,0.62)", color: "#e5e7eb", fontSize: 12 };

const feedTabsStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, borderRadius: 24, border: "1px solid rgba(255,255,255,0.11)", background: "rgba(255,255,255,0.045)", padding: 8, margin: "16px 0", overflowX: "auto" };
const feedTabStyle: CSSProperties = { border: 0, background: "transparent", color: "#d1d5db", padding: "12px 18px", borderRadius: 18, cursor: "pointer", fontSize: 16, whiteSpace: "nowrap" };
const activeFeedTabStyle: CSSProperties = { ...feedTabStyle, color: "var(--parapost-accent-text)", background: "var(--parapost-accent-active-bg)", boxShadow: "inset 0 -3px 0 var(--parapost-accent-2)", fontWeight: 900 };
const disabledFeedTabStyle: CSSProperties = { ...feedTabStyle, color: "rgba(229,231,235,0.42)", background: "transparent", border: "1px solid transparent", cursor: "default", opacity: 0.55 };

const feedStackStyle: CSSProperties = { display: "grid", gap: 16 };
const emptyStateStyle: CSSProperties = { borderRadius: 24, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.045)", padding: 22 };
const feedPulseStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 16,
  alignItems: "center",
  borderRadius: 22,
  border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 18%, transparent)",
  background: "linear-gradient(135deg, var(--parapost-accent-active-bg), rgba(15,23,42,0.72))",
  padding: 16,
  boxShadow: "0 18px 42px rgba(0,0,0,0.22)",
};
const feedPulseEyebrowStyle: CSSProperties = { color: "var(--parapost-accent-text)", fontSize: 11, fontWeight: 950, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 };
const feedPulseTitleStyle: CSSProperties = { margin: 0, color: "#fff", fontSize: 18, lineHeight: 1.25 };
const feedPulseStatsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(72px, 1fr))", gap: 8 };
const miniFeedStatStyle: CSSProperties = { borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.045)", padding: "10px 12px", textAlign: "center" };
const miniFeedStatValueStyle: CSSProperties = { display: "block", color: "#fff", fontSize: 18, lineHeight: 1.1 };
const miniFeedStatLabelStyle: CSSProperties = { display: "block", color: "#9ca3af", fontSize: 11, marginTop: 4 };

const linkPreviewCardStyle: CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 12,
  alignItems: "center",
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.24)",
  padding: 10,
  textDecoration: "none",
  color: "#fff",
  boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
};
const linkPreviewMediaStyle: CSSProperties = { width: 112, height: 72, borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, position: "relative" };
const linkPreviewPlayOverlayStyle: CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", fontSize: 24, textShadow: "0 6px 18px rgba(0,0,0,0.65)", background: "rgba(0,0,0,0.10)" };
const linkPreviewFaviconWrapStyle: CSSProperties = { width: "100%", height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))" };
const linkPreviewEyebrowStyle: CSSProperties = { color: "#9ca3af", fontSize: 11, fontWeight: 950, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 };
const linkPreviewTitleStyle: CSSProperties = { color: "#fff", fontSize: 15, fontWeight: 950, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const linkPreviewDomainStyle: CSSProperties = { color: "#93c5fd", fontSize: 13, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

const postCardStyle: CSSProperties = { borderRadius: 24, border: "1px solid rgba(255,255,255,0.12)", background: "linear-gradient(180deg, rgba(255,255,255,0.062), rgba(255,255,255,0.035))", padding: 18, boxShadow: "0 18px 44px rgba(0,0,0,0.24)" };
const postHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 };
const postAuthorStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 0 };
const postAuthorNameLineStyle: CSSProperties = { display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap", minWidth: 0 };
const postAuthorNameStyle: CSSProperties = { display: "block", color: "#fff", textDecoration: "none", fontWeight: 950, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const postAuthorActivityTextStyle: CSSProperties = { color: "var(--parapost-accent-readable-text)", fontWeight: 900, fontSize: 16, lineHeight: 1.25 };
const postMetaStyle: CSSProperties = { color: "#a1a1aa", fontSize: 13, marginTop: 3 };
const postContentStyle: CSSProperties = { color: "#f9fafb", lineHeight: 1.58, fontSize: 16, whiteSpace: "pre-wrap", margin: "10px 0 0" };
const postImageStyle: CSSProperties = { width: "100%", maxHeight: 680, objectFit: "cover", display: "block", borderRadius: 20, border: "1px solid rgba(255,255,255,0.10)", marginTop: 14, boxShadow: "0 18px 38px rgba(0,0,0,0.32)" };
const postImageGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 14, borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 18px 38px rgba(0,0,0,0.32)" };
const postImageGridTileStyle: CSSProperties = { position: "relative", minHeight: 230, overflow: "hidden", background: "rgba(255,255,255,0.04)" };
const postImageGridLargeTileStyle: CSSProperties = { gridRow: "span 2", minHeight: 468 };
const postImageGridImageStyle: CSSProperties = { width: "100%", height: "100%", minHeight: "inherit", objectFit: "cover", display: "block" };
const postImageGridOverlayStyle: CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.58)", color: "#ffffff", fontSize: 42, fontWeight: 950, letterSpacing: "-0.04em" };
const dotsButtonStyle: CSSProperties = { width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" };
const postMenuStyle: CSSProperties = { position: "absolute", right: 0, top: 45, minWidth: 170, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(8,10,18,0.96)", zIndex: 30, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" };
const menuItemStyle: CSSProperties = { width: "100%", textAlign: "left", border: 0, background: "transparent", color: "#fff", padding: "12px 14px", cursor: "pointer", fontWeight: 850 };
const followButtonStyle: CSSProperties = { border: 0, borderRadius: 999, background: "linear-gradient(135deg, var(--parapost-accent-1), var(--parapost-accent-3))", color: "#fff", minHeight: 36, padding: "0 14px", fontWeight: 950, cursor: "pointer" };
const followingButtonStyle: CSSProperties = { ...followButtonStyle, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e5e7eb" };
const editTextareaStyle: CSSProperties = { width: "100%", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, background: "rgba(255,255,255,0.04)", color: "#fff", outline: 0, padding: 14, resize: "vertical" };
const softButtonStyle: CSSProperties = { border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, background: "rgba(255,255,255,0.06)", color: "#fff", minHeight: 38, padding: "0 16px", fontWeight: 850, cursor: "pointer" };
const softDangerButtonStyle: CSSProperties = { ...softButtonStyle, color: "#fecaca", border: "1px solid rgba(248,113,113,0.24)" };
const postStatsSummaryStyle: CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 9, alignItems: "center", color: "#d1d5db", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.10)", paddingBottom: 12, marginTop: 14 };
const postStatusLinkStyle: CSSProperties = { color: "var(--parapost-accent-readable-text)", fontWeight: 900, textDecoration: "none" };
const postActionsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 10 };
const actionButtonStyle: CSSProperties = { minHeight: 42, borderRadius: 14, border: "1px solid transparent", background: "transparent", color: "#e5e7eb", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 850, cursor: "pointer" };
const activeActionButtonStyle: CSSProperties = { ...actionButtonStyle, color: "var(--parapost-accent-text)", background: "var(--parapost-accent-muted-bg)", border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 22%, transparent)" };


const sharedPostFrameStyle: CSSProperties = {
  marginTop: "14px",
  border: "1px solid var(--parapost-accent-border)",
  borderRadius: "24px",
  padding: "14px",
  background:
    "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.045), rgba(15,23,42,0.50))",
};

const sharedPostOriginalHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "12px",
};

const sharedPostOriginalContentStyle: CSSProperties = {
  ...postContentStyle,
  marginTop: "10px",
};

const sharedReelFrameStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(150px, 220px) 1fr", gap: 14, alignItems: "center", marginTop: 14, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 22, padding: 12, background: "rgba(0,0,0,0.24)" };
const sharedReelVideoStyle: CSSProperties = { position: "relative", display: "block", aspectRatio: "9 / 16", maxHeight: 360, borderRadius: 18, overflow: "hidden", background: "#000", textDecoration: "none" };
const sharedReelOverlayStyle: CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", fontSize: 34, background: "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.38))" };
const sharedReelBadgeStyle: CSSProperties = { display: "inline-flex", borderRadius: 999, border: "1px solid color-mix(in srgb, var(--parapost-accent-2) 26%, transparent)", background: "var(--parapost-accent-muted-bg)", color: "var(--parapost-accent-readable-text)", padding: "7px 10px", fontSize: 12, fontWeight: 950 };
const sharedCaptionStyle: CSSProperties = { color: "#d1d5db", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" };
const watchReelButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, minHeight: 38, padding: "0 14px", background: "#fff", color: "#0b1020", textDecoration: "none", fontWeight: 950 };

const railCardStyle: CSSProperties = { borderRadius: 22, border: "1px solid var(--parapost-accent-border)", background: "radial-gradient(circle at 18% 0%, var(--parapost-accent-muted-bg), transparent 40%), rgba(255,255,255,0.045)", padding: 18, boxShadow: "0 18px 42px rgba(0,0,0,0.22), 0 0 20px var(--parapost-accent-glow)" };
const railCardHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 };
const railActionStyle: CSSProperties = { color: "var(--parapost-accent-text)", fontSize: 13, fontWeight: 900 };
const liveRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "center" };
const liveThumbStyle: CSSProperties = { position: "relative", height: 70, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(248,113,113,0.45)", background: "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(0,0,0,0.82)), radial-gradient(circle at 70% 30%, rgba(255,255,255,0.16), transparent 28%)" };
const liveBadgeStyle: CSSProperties = { position: "absolute", left: 8, top: 8, borderRadius: 7, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 950, padding: "4px 6px" };
const railNameStyle: CSSProperties = { display: "block", color: "#fff", fontSize: 14, lineHeight: 1.35 };
const railMetaStyle: CSSProperties = { display: "block", color: "#9ca3af", fontSize: 12, marginTop: 2 };
const trendingRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "26px 1fr", gap: 10, alignItems: "start" };
const trendingRankStyle: CSSProperties = { color: "var(--parapost-accent-text)", fontSize: 18, fontWeight: 950 };
const mutedTextStyle: CSSProperties = { color: "#9ca3af", lineHeight: 1.55, margin: 0, fontSize: 13 };
const recentProfileRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "center", textDecoration: "none", borderRadius: 14, padding: 8, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" };
const statRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, color: "#d1d5db", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 };
const searchResultRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "center", textDecoration: "none", borderRadius: 14, padding: 10, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" };
const onlineDotStyle: CSSProperties = {
  position: "absolute",
  right: -1,
  bottom: -1,
  width: 12,
  height: 12,
  borderRadius: 999,
  background: "#22c55e",
  border: "2px solid #07090d",
  boxShadow: "0 0 10px rgba(34,197,94,0.65)",
  zIndex: 5,
  pointerEvents: "none",
};

const modalOverlayStyle: CSSProperties = { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(12px)", display: "grid", placeItems: "start center", padding: "82px 18px 24px" };
const searchModalStyle: CSSProperties = { width: "min(620px, 100%)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.12)", background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(8,10,18,0.98))", boxShadow: "0 28px 80px rgba(0,0,0,0.58)", padding: 18 };
const modalHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 14 };
const modalEyebrowStyle: CSSProperties = { color: "var(--parapost-accent-text)", textTransform: "uppercase", letterSpacing: "0.14em", fontSize: 11, fontWeight: 950, marginBottom: 4 };
const modalCloseButtonStyle: CSSProperties = { width: 40, height: 40, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 26, cursor: "pointer" };

const mobileHeaderStyle: CSSProperties = { display: "none", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "18px 16px 12px", position: "sticky", top: 0, zIndex: 60, background: "linear-gradient(180deg, rgba(5,7,13,0.985), rgba(5,7,13,0.86))", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.055)" };
const mobileLogoStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, color: "#fff", textDecoration: "none", minWidth: 0, flex: "1 1 auto" };
const mobileLogoCircleStyle: CSSProperties = { width: 54, height: 54, borderRadius: 999, display: "grid", placeItems: "center", border: "2px solid color-mix(in srgb, var(--parapost-accent-3) 72%, transparent)", background: "var(--parapost-accent-active-bg)", boxShadow: "0 0 22px var(--parapost-accent-strong-glow)", fontWeight: 950 };
const mobileHeaderActionsStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 };
const mobileTopIconButtonStyle: CSSProperties = { position: "relative", width: 42, height: 42, borderRadius: 14, color: "#fff", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.10)", display: "grid", placeItems: "center", textDecoration: "none", cursor: "pointer" };

const mobileBottomNavStyle: CSSProperties = { position: "fixed", left: 12, right: 12, bottom: 10, zIndex: 120, gridTemplateColumns: "repeat(5, 1fr)", alignItems: "center", gap: 4, minHeight: 76, padding: "8px 10px", borderRadius: 26, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(8,10,18,0.94)", backdropFilter: "blur(18px)", boxShadow: "0 22px 60px rgba(0,0,0,0.56)" };
const mobileNavItemStyle: CSSProperties = { color: "#e5e7eb", textDecoration: "none", display: "grid", placeItems: "center", gap: 4, fontSize: 11, fontWeight: 800 };
const mobileNavItemActiveStyle: CSSProperties = { ...mobileNavItemStyle, color: "var(--parapost-accent-text)", textShadow: "0 0 16px color-mix(in srgb, var(--parapost-accent-2) 52%, transparent)" };
const mobileCenterPlusStyle: CSSProperties = { width: 58, height: 58, margin: "-24px auto 0", borderRadius: 999, display: "grid", placeItems: "center", color: "#0b1020", background: "#fff", border: "4px solid var(--parapost-accent-1)", boxShadow: "0 0 0 4px color-mix(in srgb, var(--parapost-accent-3) 32%, transparent), 0 16px 38px var(--parapost-accent-strong-glow)", cursor: "pointer", textDecoration: "none", padding: 0, font: "inherit" };
const mobileNavBadgeStyle: CSSProperties = { position: "absolute", right: -10, top: -9, minWidth: 21, height: 21, borderRadius: 999, display: "grid", placeItems: "center", background: "var(--parapost-accent-1)", color: "#fff", fontSize: 11, fontWeight: 950, padding: "0 5px" };
