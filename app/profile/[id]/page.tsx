"use client";

import { ChangeEvent, CSSProperties, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "@/lib/friends";
import MutualFriendsPreviewCard from "@/components/profile/MutualFriendsPreviewCard";
import ProfileAboutSection from "@/components/profile/ProfileAboutSection";
import ProfilePhotosSection from "@/components/profile/ProfilePhotosSection";
import BottomNav from "@/components/BottomNav";

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  cover_position_x?: number | string | null;
  cover_position_y?: number | string | null;
  is_online?: boolean | null;
  verified?: boolean | null;
  location?: string | null;
  website?: string | null;
  occupation?: string | null;
  paranormal_focus?: string | null;
  experience_years?: string | null;
  equipment?: string | null;
  favorite_locations?: string | null;
  availability?: string | null;
};

type Post = {
  id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  user_id: string;
};

type Reel = {
  id: string;
  video_url: string | null;
  user_id: string;
  created_at?: string | null;
};

type SharedReel = {
  id: string;
  title?: string | null;
  caption?: string | null;
  video_url: string | null;
  poster_url?: string | null;
  user_id: string | null;
  creator_profile_id?: string | null;
  created_at?: string | null;
};

type ReelShareProfilePost = {
  id: string;
  reel_id: string;
  user_id: string;
  caption: string | null;
  created_at: string;
  reel: SharedReel | null;
  originalCreator: ProfileRow | null;
};

type ProfileFeedItem =
  | (Post & { feedKind: "post" })
  | (ReelShareProfilePost & { feedKind: "reel_share" });

type CountMap = Record<string, number>;
type ToggleMap = Record<string, boolean>;

type FollowRow = {
  follower_id: string;
  following_id: string;
};

type FriendRequestStatus =
  | "none"
  | "outgoing_request"
  | "incoming_request"
  | "friends";

type ShowcaseDuration = "24h" | "30d" | "permanent";
type ShowcaseCreatorMode = "media" | "text";
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

type ProfileShowcase = {
  id: string;
  title: string;
  coverText?: string | null;
  fontKey?: ShowcaseFontValue;
  duration: ShowcaseDuration;
  visibility?: ShowcaseVisibility;
  creatorMode?: ShowcaseCreatorMode;
  mediaType?: ShowcaseMediaType;
  mediaPreviewUrl?: string | null;
  mediaFileName?: string | null;
  textPosition?: { x: number; y: number };
  overlayFontSize?: number;
  createdAt: string;
  expiresAt: string | null;
};

type ProfileShowcaseRow = {
  id: string;
  user_id: string;
  title: string | null;
  cover_text: string | null;
  media_url: string | null;
  media_type: string | null;
  media_filename: string | null;
  font_key: string | null;
  text_position_x: number | string | null;
  text_position_y: number | string | null;
  overlay_font_size: number | null;
  duration: string | null;
  visibility: string | null;
  expires_at: string | null;
  created_at: string | null;
};

function mapProfileShowcaseRow(row: ProfileShowcaseRow): ProfileShowcase {
  const mediaType =
    row.media_type === "video" || row.media_type === "image" || row.media_type === "text"
      ? row.media_type
      : "text";

  const duration =
    row.duration === "24h" || row.duration === "30d" || row.duration === "permanent"
      ? row.duration
      : "permanent";

  const visibility =
    row.visibility === "public" || row.visibility === "friends" || row.visibility === "private"
      ? row.visibility
      : "public";

  return {
    id: row.id,
    title: row.title || "Showcase",
    coverText: row.cover_text || "",
    fontKey: getShowcaseFontOption(row.font_key).value,
    duration,
    visibility,
    creatorMode: row.media_url ? "media" : "text",
    mediaType,
    mediaPreviewUrl: row.media_url || null,
    mediaFileName: row.media_filename || null,
    textPosition: {
      x: Number(row.text_position_x ?? 50),
      y: Number(row.text_position_y ?? 50),
    },
    overlayFontSize: clampShowcaseOverlayFontSize(row.overlay_font_size),
    createdAt: row.created_at || new Date().toISOString(),
    expiresAt: row.expires_at,
  };
}

const SHOWCASE_FONT_OPTIONS: {
  value: ShowcaseFontValue;
  label: string;
  family: string;
}[] = [
  {
    value: "inter",
    label: "Parapost Default",
    family: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  {
    value: "roboto",
    label: "Clean Sans",
    family: "Arial, Helvetica, sans-serif",
  },
  {
    value: "openSans",
    label: "Soft Modern",
    family: "Verdana, Geneva, sans-serif",
  },
  {
    value: "montserrat",
    label: "Classic Serif",
    family: "Georgia, 'Times New Roman', serif",
  },
  {
    value: "poppins",
    label: "Rounded Casual",
    family: "'Trebuchet MS', Arial, sans-serif",
  },
  {
    value: "lato",
    label: "Simple Label",
    family: "Tahoma, Geneva, sans-serif",
  },
  {
    value: "nunito",
    label: "Typewriter",
    family: "'Courier New', Courier, monospace",
  },
  {
    value: "raleway",
    label: "Bold Impact",
    family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
  },
  {
    value: "playfair",
    label: "Editorial",
    family: "'Times New Roman', Times, serif",
  },
  {
    value: "merriweather",
    label: "Clean Creator",
    family: "'Segoe UI', Arial, sans-serif",
  },
];

function getShowcaseFontOption(fontKey?: string | null) {
  return (
    SHOWCASE_FONT_OPTIONS.find((option) => option.value === fontKey) ||
    SHOWCASE_FONT_OPTIONS[0]
  );
}

const SHOWCASE_OVERLAY_MIN_FONT_SIZE = 18;
const SHOWCASE_OVERLAY_MAX_FONT_SIZE = 48;
const SHOWCASE_OVERLAY_DEFAULT_FONT_SIZE = 28;

function clampShowcaseOverlayFontSize(size?: number | null) {
  if (!size || Number.isNaN(size)) return SHOWCASE_OVERLAY_DEFAULT_FONT_SIZE;
  return Math.max(
    SHOWCASE_OVERLAY_MIN_FONT_SIZE,
    Math.min(SHOWCASE_OVERLAY_MAX_FONT_SIZE, Math.round(size))
  );
}

function getShowcaseOverlayDisplayFontSize(text: string, size?: number | null) {
  const clamped = clampShowcaseOverlayFontSize(size);
  const length = text.trim().length;

  if (length > 180) return Math.max(14, Math.round(clamped * 0.42));
  if (length > 120) return Math.max(15, Math.round(clamped * 0.52));
  if (length > 80) return Math.max(16, Math.round(clamped * 0.62));
  if (length > 48) return Math.max(18, Math.round(clamped * 0.74));
  if (length > 28) return Math.max(20, Math.round(clamped * 0.86));

  return clamped;
}

function getShowcaseOverlayTextWidth(text: string) {
  const length = text.trim().length;

  if (length > 80) return "66%";
  if (length > 48) return "72%";
  if (length > 28) return "78%";

  return "82%";
}

function clampShowcaseTextPercent(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return 50;
  return Math.max(min, Math.min(max, value));
}

function getShowcaseSafeTextPosition(
  position: { x: number; y: number } | null | undefined,
  text: string,
  hasSizeRail = false
) {
  const length = text.trim().length;

  // Keep enough protection for long overlay text while letting shorter text move much closer
  // to the left, right, top, and bottom edges.
  const edgeMarginX =
    length > 120 ? 28 : length > 80 ? 24 : length > 48 ? 18 : length > 28 ? 12 : hasSizeRail ? 6 : 4;
  const finalMarginX = Math.max(hasSizeRail ? 6 : 4, edgeMarginX);
  const edgeMarginY = length > 120 ? 14 : length > 80 ? 12 : length > 48 ? 9 : 5;

  return {
    x: clampShowcaseTextPercent(Number(position?.x ?? 50), finalMarginX, 100 - finalMarginX),
    y: clampShowcaseTextPercent(Number(position?.y ?? 50), edgeMarginY, 100 - edgeMarginY),
  };
}

function getShowcaseTileFontSize(size?: number | null) {
  const clamped = clampShowcaseOverlayFontSize(size);
  return Math.max(10, Math.min(16, Math.round(clamped / 2.7)));
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(diffMs)) return "";

  const seconds = Math.floor(diffMs / 1000);
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
  event: React.MouseEvent<HTMLAnchorElement>,
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

  const confirmed = window.confirm(message);

  if (!confirmed) return;

  window.open(parsedUrl.toString(), "_blank", "noopener,noreferrer");
}

function renderLinkedText(text: string): ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (!part.match(urlRegex)) {
      return part;
    }

    const rawLabel = part;
    const cleanLabel = rawLabel.replace(/[),.;!?]+$/, "");
    const trailing = rawLabel.slice(cleanLabel.length);
    const href = cleanLabel.startsWith("http") ? cleanLabel : `https://${cleanLabel}`;

    if (isBlockedLinkProtocol(href)) {
      return (
        <span key={`${part}-${index}`} style={{ color: "#fca5a5", fontWeight: 800 }}>
          [unsafe link blocked]{trailing}
        </span>
      );
    }

    return (
      <span key={`${part}-${index}`}>
        <a
          href={href}
          onClick={(event) => handleSafeExternalLinkClick(event, href)}
          style={{
            color: "#93c5fd",
            fontWeight: 800,
            textDecoration: "none",
            wordBreak: "break-word",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.textDecoration = "underline";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.textDecoration = "none";
          }}
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
    if (url.pathname.startsWith("/watch")) {
      return url.searchParams.get("v") || "";
    }

    if (url.pathname.startsWith("/shorts/")) {
      return url.pathname.split("/shorts/")[1]?.split(/[?&#/]/)[0] || "";
    }

    if (url.pathname.startsWith("/embed/")) {
      return url.pathname.split("/embed/")[1]?.split(/[?&#/]/)[0] || "";
    }
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

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    preview.hostname
  )}&sz=64`;

  return (
    <a
      href={preview.href}
      onClick={(event) => handleSafeExternalLinkClick(event, preview.href)}
      style={linkPreviewCardStyle}
    >
      <div style={linkPreviewMediaStyle}>
        {preview.type === "youtube" && preview.youtubeVideoId ? (
          <>
            <img
              src={`https://img.youtube.com/vi/${preview.youtubeVideoId}/hqdefault.jpg`}
              alt="YouTube preview"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            <div style={linkPreviewPlayOverlayStyle}>▶</div>
          </>
        ) : (
          <div style={linkPreviewFaviconWrapStyle}>
            <img
              src={faviconUrl}
              alt=""
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
              }}
            />
          </div>
        )}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={linkPreviewEyebrowStyle}>
          {preview.type === "youtube" ? "YouTube" : "External Website"}
        </div>
        <div style={linkPreviewTitleStyle}>
          {preview.type === "youtube" ? "Watch video" : preview.label}
        </div>
        <div style={linkPreviewDomainStyle}>{preview.hostname}</div>
      </div>
    </a>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();

  const profileId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] || "" : "";
  }, [params]);

  const [viewerId, setViewerId] = useState("");
  const [viewerEmail, setViewerEmail] = useState("");
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profilePostContent, setProfilePostContent] = useState("");
  const [profilePostImage, setProfilePostImage] = useState<File | null>(null);
  const [profilePostImagePreviewUrl, setProfilePostImagePreviewUrl] = useState("");
  const [profilePostLoading, setProfilePostLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sharedReelPosts, setSharedReelPosts] = useState<ReelShareProfilePost[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [likeCounts, setLikeCounts] = useState<CountMap>({});
  const [userLikes, setUserLikes] = useState<ToggleMap>({});
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [followLoading, setFollowLoading] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendRequestStatus>("none");
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendStatusMessage, setFriendStatusMessage] = useState("");
  const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostContent, setEditingPostContent] = useState("");

  const [activeProfileTab, setActiveProfileTab] = useState("Posts");
  const [profileActionsOpen, setProfileActionsOpen] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [showcaseComposerOpen, setShowcaseComposerOpen] = useState(false);
  const [activeProfileShowcase, setActiveProfileShowcase] = useState<ProfileShowcase | null>(null);
  const [showcaseCreatorMode, setShowcaseCreatorMode] = useState<ShowcaseCreatorMode>("media");
  const [showcaseTitle, setShowcaseTitle] = useState("");
  const [showcaseCoverText, setShowcaseCoverText] = useState("");
  const [showcaseFontKey, setShowcaseFontKey] = useState<ShowcaseFontValue>("inter");
  const [showcaseOverlayFontSize, setShowcaseOverlayFontSize] = useState(28);
  const [showcaseDuration, setShowcaseDuration] = useState<ShowcaseDuration>("permanent");
  const [showcaseVisibility, setShowcaseVisibility] = useState<ShowcaseVisibility>("public");
  const [showcaseCustomizeOpen, setShowcaseCustomizeOpen] = useState(false);
  const [showcasePreviewExpanded, setShowcasePreviewExpanded] = useState(false);
  const [showcaseTextPosition, setShowcaseTextPosition] = useState({ x: 50, y: 50 });
  const [showcaseMediaPreviewUrl, setShowcaseMediaPreviewUrl] = useState("");
  const [showcaseMediaType, setShowcaseMediaType] = useState<ShowcaseMediaType>("text");
  const [showcaseMediaFileName, setShowcaseMediaFileName] = useState("");
  const [showcaseMediaDragActive, setShowcaseMediaDragActive] = useState(false);
  const [showcaseError, setShowcaseError] = useState("");
  const [profileShowcases, setProfileShowcases] = useState<ProfileShowcase[]>([]);
  const [showcasesLoaded, setShowcasesLoaded] = useState(false);

  const profilePostFileInputRef = useRef<HTMLInputElement | null>(null);
  const showcaseDragFrameRef = useRef<number | null>(null);
  const showcasePendingTextPositionRef = useRef<{ x: number; y: number } | null>(null);
  const showcaseCommittedDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const showcasePreviewTextRef = useRef<HTMLSpanElement | null>(null);
  const showcaseMediaInputRef = useRef<HTMLInputElement | null>(null);
  const profileActionSheetRef = useRef<HTMLDivElement | null>(null);
  const profileActionButtonRef = useRef<HTMLButtonElement | null>(null);
  const [profileActionMenuPosition, setProfileActionMenuPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 340,
  });

  const isOwnProfile = !!viewerId && viewerId === profileId;
  const canManageProfileShowcases = Boolean(viewerId && profileId && viewerId === profileId);
  const canCreateShowcase = canManageProfileShowcases;

  const showcaseStorageKey = useMemo(
    () => (profileId ? `parapost-profile-showcases-${profileId}` : ""),
    [profileId]
  );
  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      showcasePendingTextPositionRef.current = null;

      if (showcaseDragFrameRef.current !== null) {
        window.cancelAnimationFrame(showcaseDragFrameRef.current);
        showcaseDragFrameRef.current = null;
      }
    };
  }, []);


  const visibleProfileShowcases = useMemo(() => {
    const now = Date.now();

    return profileShowcases.filter((showcase) => {
      const isExpired = showcase.expiresAt
        ? new Date(showcase.expiresAt).getTime() <= now
        : false;

      if (isExpired) return false;
      if (canManageProfileShowcases) return true;

      const visibility = showcase.visibility || "public";

      if (visibility === "private") return false;
      if (visibility === "friends") return friendStatus === "friends";

      return true;
    });
  }, [profileShowcases, canManageProfileShowcases, friendStatus]);

  const showcaseSizeRailVisible = showcaseCustomizeOpen && Boolean(showcaseCoverText.trim());
  const safeShowcaseTextPosition = getShowcaseSafeTextPosition(
    showcaseTextPosition,
    showcaseCoverText.trim(),
    showcaseSizeRailVisible
  );
  const showcaseTextNearHorizontalCenter = Math.abs(safeShowcaseTextPosition.x - 50) <= 4;
  const showcaseTextNearVerticalCenter = Math.abs(safeShowcaseTextPosition.y - 50) <= 4;
  const showShowcaseCenterGuides =
    showcaseCustomizeOpen &&
    Boolean(showcaseCoverText.trim()) &&
    showcaseTextNearHorizontalCenter &&
    showcaseTextNearVerticalCenter;


  // ✅ 🔥 ADD THIS FUNCTION RIGHT HERE
  const handleSaveProfileAbout = async (payload: any) => {
    if (!viewerId || !isOwnProfile) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        about_intro: payload.about_intro,
        category: payload.category,
        location: payload.location,
        hometown: payload.hometown,
        relationship_status: payload.relationship_status,
        occupation: payload.occupation,
        company: payload.company,
        education: payload.education,
        website: payload.website,
        email: payload.email,
        phone: payload.phone,
        interests: payload.interests,
        profile_links: payload.profile_links,
      })
      .eq("id", viewerId);

    if (error) {
      console.error("SAVE ERROR:", error);
      alert("Save failed: " + error.message);
      return;
    }

    // 🔥 Prevent UI from disappearing after save
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            ...payload,
          }
        : prev
    );
  };
 
 const handleMessageUser = async () => {
  if (!profileId || !viewerId || profileId === viewerId) return;

  try {
    const { data, error } = await supabase.rpc(
      "get_or_create_direct_conversation",
      {
        other_user_id: profileId,
      }
    );

    if (error || !data) {
      console.error("Message error:", error);
      alert("Could not start conversation");
      return;
    }

    // ✅ Open Parachat hub with selected conversation
    router.push(`/messages?conversation=${data}`);

  } catch (err) {
    console.error("Unexpected message error:", err);
    alert("Something went wrong starting the chat");
  }
};

const handleProfileLogout = async () => {
  const confirmed = window.confirm("Log out of Parapost Network?");
  if (!confirmed) return;

  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(`Log out error: ${error.message}`);
    return;
  }

  setProfileActionsOpen(false);
  router.push("/");
};

const profileFeedItems = useMemo<ProfileFeedItem[]>(() => {
  return [
    ...posts.map((post) => ({ ...post, feedKind: "post" as const })),
    ...sharedReelPosts.map((share) => ({
      ...share,
      feedKind: "reel_share" as const,
    })),
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime()
  );
}, [posts, sharedReelPosts]);

const showFriendStatus = useCallback((message: string) => {
  setFriendStatusMessage(message);

  const timer = window.setTimeout(() => {
    setFriendStatusMessage("");
  }, 2500);

  return () => clearTimeout(timer);
}, []);

  const loadPage = useCallback(async () => {
    if (!profileId) {
      setErrorMessage("Profile not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const nextViewerId = user?.id || "";
    setViewerId(nextViewerId);
    setViewerEmail(user?.email || "");

    const [
      profileResult,
      postsResult,
      likesResult,
      reelsResult,
      reelSharesResult,
      followersResult,
      outgoingRequestResult,
      incomingRequestResult,
      acceptedRequestResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
       .select(`
  id,
  username,
  full_name,
  bio,
  avatar_url,
  cover_url,
  cover_position_x,
  cover_position_y,
  is_online,
  location,
  website,
  occupation,
  paranormal_focus,
  experience_years,
  equipment,
  favorite_locations,
  availability,

  about_intro,
  category,
  hometown,
  relationship_status,
  company,
  education,
  email,
  phone,
  interests,
  profile_links
`) 
        .eq("id", profileId)
        .maybeSingle(),
      supabase
        .from("posts")
        .select("id, content, image_url, created_at, user_id")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false }),
      supabase.from("likes").select("post_id, user_id"),
      supabase
        .from("reels")
        .select("id, video_url, user_id, created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false }),
      supabase
        .from("reel_shares")
        .select("id, reel_id, user_id, caption, created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false }),
      supabase.from("followers").select("follower_id, following_id"),
      nextViewerId && profileId && nextViewerId !== profileId
        ? supabase
            .from("friend_requests")
            .select("id")
            .eq("sender_id", nextViewerId)
            .eq("receiver_id", profileId)
            .eq("status", "pending")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      nextViewerId && profileId && nextViewerId !== profileId
        ? supabase
            .from("friend_requests")
            .select("id")
            .eq("sender_id", profileId)
            .eq("receiver_id", nextViewerId)
            .eq("status", "pending")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      nextViewerId && profileId && nextViewerId !== profileId
        ? supabase
            .from("friend_requests")
            .select("id")
            .eq("status", "accepted")
            .or(
              `and(sender_id.eq.${nextViewerId},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${nextViewerId})`
            )
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (profileResult.error) {
      setErrorMessage(profileResult.error.message || "Unable to load profile.");
      setProfile(null);
      setPosts([]);
      setSharedReelPosts([]);
      setReels([]);
      setLoading(false);
      return;
    }

    setProfile((profileResult.data as ProfileRow | null) || null);

    if (postsResult.error) {
      setErrorMessage(postsResult.error.message || "Unable to load posts.");
      setPosts([]);
    } else {
      setPosts((postsResult.data as Post[]) || []);
    }

    if (reelsResult.error) {
      setReels([]);
    } else {
      setReels((reelsResult.data as Reel[]) || []);
    }

    if (reelSharesResult.error) {
      setSharedReelPosts([]);
    } else {
      const shareRows = ((reelSharesResult.data as Omit<ReelShareProfilePost, "reel" | "originalCreator">[]) || []).filter(Boolean);
      const sharedReelIds = [...new Set(shareRows.map((share) => share.reel_id).filter(Boolean))];

      let sharedReels: SharedReel[] = [];
      let sharedCreators: ProfileRow[] = [];

      if (sharedReelIds.length > 0) {
        const { data: sharedReelsData, error: sharedReelsError } = await supabase
          .from("reels")
          .select("id, title, caption, video_url, poster_url, user_id, creator_profile_id, created_at")
          .in("id", sharedReelIds);

        if (!sharedReelsError) {
          sharedReels = (sharedReelsData as SharedReel[]) || [];
        }
      }

      const sharedCreatorIds = [
        ...new Set(
          sharedReels
            .map((reel) => reel.creator_profile_id || reel.user_id)
            .filter(Boolean)
        ),
      ] as string[];

      if (sharedCreatorIds.length > 0) {
        const { data: sharedCreatorData, error: sharedCreatorError } = await supabase
          .from("profiles")
          .select("id, username, full_name, bio, avatar_url, is_online")
          .in("id", sharedCreatorIds);

        if (!sharedCreatorError) {
          sharedCreators = (sharedCreatorData as ProfileRow[]) || [];
        }
      }

      const reelMap = new Map(sharedReels.map((reel) => [reel.id, reel]));
      const creatorMap = new Map(sharedCreators.map((creator) => [creator.id, creator]));

      setSharedReelPosts(
        shareRows.map((share) => {
          const reel = reelMap.get(share.reel_id) || null;
          const creatorId = reel?.creator_profile_id || reel?.user_id || "";

          return {
            ...share,
            reel,
            originalCreator: creatorMap.get(creatorId) || null,
          };
        })
      );
    }

    const nextLikeCounts: CountMap = {};
    const nextUserLikes: ToggleMap = {};
    for (const like of likesResult.data || []) {
      nextLikeCounts[like.post_id] = (nextLikeCounts[like.post_id] || 0) + 1;
      if (nextViewerId && like.user_id === nextViewerId) {
        nextUserLikes[like.post_id] = true;
      }
    }

    setLikeCounts(nextLikeCounts);
    setUserLikes(nextUserLikes);

    const followerRows = ((followersResult.data as FollowRow[]) || []).filter(Boolean);
    setFollowersCount(followerRows.filter((row) => row.following_id === profileId).length);
    setFollowingCount(followerRows.filter((row) => row.follower_id === profileId).length);
    setIsFollowing(
      !!nextViewerId &&
        followerRows.some((row) => row.follower_id === nextViewerId && row.following_id === profileId)
    );

    if (!nextViewerId || nextViewerId === profileId) {
      setFriendStatus("none");
    } else if (acceptedRequestResult.data) {
      setFriendStatus("friends");
    } else if (outgoingRequestResult.data) {
      setFriendStatus("outgoing_request");
    } else if (incomingRequestResult.data) {
      setFriendStatus("incoming_request");
    } else {
      setFriendStatus("none");
    }

    setLoading(false);
  }, [profileId]);

  useEffect(() => {
  loadPage();
}, [loadPage]);

useEffect(() => {
  if (!profileActionsOpen || typeof window === "undefined") return;

  const isMobileProfileWidth = window.matchMedia("(max-width: 720px)").matches;
  if (!isMobileProfileWidth) return;

  const scrollY = window.scrollY;
  const body = document.body;
  const html = document.documentElement;

  const previousBodyOverflow = body.style.overflow;
  const previousBodyPosition = body.style.position;
  const previousBodyTop = body.style.top;
  const previousBodyWidth = body.style.width;
  const previousHtmlOverflow = html.style.overflow;

  body.style.overflow = "hidden";
  html.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.width = "100%";

  return () => {
    body.style.overflow = previousBodyOverflow;
    body.style.position = previousBodyPosition;
    body.style.top = previousBodyTop;
    body.style.width = previousBodyWidth;
    html.style.overflow = previousHtmlOverflow;

    window.scrollTo(0, scrollY);
  };
}, [profileActionsOpen]);

useEffect(() => {
  const targetIsInsideProfileActions = (event: Event) => {
    const target = event.target as HTMLElement | null;

    return Boolean(
      target?.closest(
        ".profile-desktop-action-menu-fixed, .profile-desktop-action-menu-wrap, .profile-mobile-action-overlay"
      )
    );
  };

  const closePostMenusOnly = () => {
    setOpenPostMenuId(null);
  };

  const closeDesktopFloatingMenus = (event: Event) => {
    setOpenPostMenuId(null);

    if (targetIsInsideProfileActions(event)) return;

    if (typeof window !== "undefined" && window.matchMedia("(min-width: 721px)").matches) {
      setProfileActionsOpen(false);
    }
  };

  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpenPostMenuId(null);
      setProfileActionsOpen(false);
      setActiveProfileShowcase(null);
    }
  };

  window.addEventListener("click", closeDesktopFloatingMenus);
  window.addEventListener("touchmove", closePostMenusOnly, { passive: true });
  window.addEventListener("keydown", handleEscapeKey);

  return () => {
    window.removeEventListener("click", closeDesktopFloatingMenus);
    window.removeEventListener("touchmove", closePostMenusOnly);
    window.removeEventListener("keydown", handleEscapeKey);
  };
}, []);

  useEffect(() => {
    if (!profilePostImage) {
      setProfilePostImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(profilePostImage);
    setProfilePostImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [profilePostImage]);

  useEffect(() => {
    let cancelled = false;

    const loadProfileShowcases = async () => {
      if (!profileId) {
        setProfileShowcases([]);
        setShowcasesLoaded(true);
        return;
      }

      setShowcasesLoaded(false);

      const { data, error } = await supabase
        .from("profile_showcases")
        .select(
          "id,user_id,title,cover_text,media_url,media_type,media_filename,font_key,text_position_x,text_position_y,overlay_font_size,duration,visibility,expires_at,created_at"
        )
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Could not load profile Showcases:", error);
        setProfileShowcases([]);
        setShowcasesLoaded(true);
        return;
      }

      const now = Date.now();
      const mapped = ((data || []) as ProfileShowcaseRow[])
        .map(mapProfileShowcaseRow)
        .filter((showcase) => {
          if (!showcase.expiresAt) return true;
          return new Date(showcase.expiresAt).getTime() > now;
        });

      setProfileShowcases(mapped);
      setShowcasesLoaded(true);
    };

    loadProfileShowcases();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    if (!viewerId || !profileId || viewerId === profileId) return;

    const channel = supabase
      .channel(`profile-friends-${viewerId}-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        async () => {
          await loadPage();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "followers" },
        async () => {
          await loadPage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewerId, profileId, loadPage]);

  const handleRemoveSharedReel = async (shareId: string) => {
    if (!viewerId || !isOwnProfile) return;

    const confirmed = window.confirm("Remove this shared reel from your profile posts?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("reel_shares")
      .delete()
      .eq("id", shareId)
      .eq("user_id", viewerId);

    if (error) {
      alert(`Remove shared reel error: ${error.message}`);
      return;
    }

    setSharedReelPosts((prev) => prev.filter((share) => share.id !== shareId));
  };

  const handleProfilePostImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setProfilePostImage(file);
  };

  const handleRemoveProfilePostImage = () => {
    setProfilePostImage(null);
    setProfilePostImagePreviewUrl("");

    if (profilePostFileInputRef.current) {
      profilePostFileInputRef.current.value = "";
    }
  };

  const handleCreateProfilePost = async () => {
    if (!isOwnProfile || !viewerId) return;

    if (!profilePostContent.trim() && !profilePostImage) {
      alert("Please add text or choose an image.");
      return;
    }

    setProfilePostLoading(true);

    let imageUrl: string | null = null;

    if (profilePostImage) {
      const fileExt = profilePostImage.name.split(".").pop() || "jpg";
      const fileName = `${viewerId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, profilePostImage, {
          cacheControl: "604800",
          upsert: false,
        });

      if (uploadError) {
        alert(`Upload error: ${uploadError.message}`);
        setProfilePostLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("post-images")
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
    }

    const { error: insertError } = await supabase.from("posts").insert([
      {
        content: profilePostContent.trim(),
        user_id: viewerId,
        image_url: imageUrl,
      },
    ]);

    if (insertError) {
      alert(`Post error: ${insertError.message}`);
      setProfilePostLoading(false);
      return;
    }

    setProfilePostContent("");
    handleRemoveProfilePostImage();
    await loadPage();
    setProfilePostLoading(false);
  };


  const handleStartEditPost = (post: Post) => {
    if (post.user_id !== viewerId) return;
    setEditingPostId(post.id);
    setEditingPostContent(post.content || "");
    setOpenPostMenuId(null);
  };

  const handleCancelPostEdit = () => {
    setEditingPostId(null);
    setEditingPostContent("");
  };

  const handleSavePostEdit = async (postId: string) => {
    const trimmed = editingPostContent.trim();

    const { error } = await supabase
      .from("posts")
      .update({ content: trimmed })
      .eq("id", postId)
      .eq("user_id", viewerId);

    if (error) {
      alert(`Edit post error: ${error.message}`);
      return;
    }

    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, content: trimmed } : post))
    );

    setEditingPostId(null);
    setEditingPostContent("");
  };

  const handleDeletePost = async (postId: string) => {
    const confirmed = window.confirm("Delete this post from your profile and the homepage feed?");
    if (!confirmed) return;

    const { error: likesDeleteError } = await supabase
      .from("likes")
      .delete()
      .eq("post_id", postId);

    if (likesDeleteError) {
      console.warn("Profile post likes cleanup skipped:", likesDeleteError.message);
    }

    const { error: postDeleteError } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", viewerId);

    if (postDeleteError) {
      alert(`Delete post error: ${postDeleteError.message}`);
      return;
    }

    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setLikeCounts((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setUserLikes((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setOpenPostMenuId(null);
  };

  const handleLikeToggle = async (postId: string) => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      alert("You must be logged in to like a post.");
      return;
    }

    const alreadyLiked = !!userLikes[postId];

    if (alreadyLiked) {
      const { error: unlikeError } = await supabase
        .from("likes")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", postId);

      if (unlikeError) {
        alert(`Unlike error: ${unlikeError.message}`);
        return;
      }

      setUserLikes((prev) => ({ ...prev, [postId]: false }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: Math.max((prev[postId] || 1) - 1, 0),
      }));
      return;
    }

    const { error: likeError } = await supabase
      .from("likes")
      .insert([{ user_id: user.id, post_id: postId }]);

    if (likeError) {
      alert(`Like error: ${likeError.message}`);
      return;
    }

    setUserLikes((prev) => ({ ...prev, [postId]: true }));
    setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
  };

  const handleFollowToggle = async () => {
    if (!viewerId || !profileId || isOwnProfile) return;

    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await supabase
        .from("followers")
        .delete()
        .eq("follower_id", viewerId)
        .eq("following_id", profileId);

      if (error) {
        alert(`Unfollow error: ${error.message}`);
        setFollowLoading(false);
        return;
      }

      setIsFollowing(false);
      setFollowersCount((prev) => Math.max(prev - 1, 0));
      setFollowLoading(false);
      return;
    }

    const { error } = await supabase
      .from("followers")
      .insert([{ follower_id: viewerId, following_id: profileId }]);

    if (error) {
      alert(`Follow error: ${error.message}`);
      setFollowLoading(false);
      return;
    }

    setIsFollowing(true);
    setFollowersCount((prev) => prev + 1);
    setFollowLoading(false);
  };

  const handleSendFriendRequest = async () => {
    if (!viewerId || !profileId || isOwnProfile) return;

    setFriendLoading(true);

    try {
      const { data, error } = await supabase
        .from("friend_requests")
        .insert([
          {
            sender_id: viewerId,
            receiver_id: profileId,
            status: "pending",
          },
        ])
        .select("id")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const { error: notifyError } = await supabase
        .from("notifications")
        .insert([
          {
            user_id: profileId,
            actor_id: viewerId,
            type: "friend_request",
            post_id: null,
            comment_id: null,
            friend_request_id: data.id,
            message: "sent you a friend request.",
            is_read: false,
          },
        ]);

      if (notifyError) {
        console.error("Friend request notification error:", notifyError.message);
      }

      setFriendStatus("outgoing_request");
      showFriendStatus("Friend request sent.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send friend request.";
      alert(message);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleCancelFriendRequest = async () => {
    if (!viewerId || !profileId || isOwnProfile) return;

    setFriendLoading(true);
    try {
      await cancelFriendRequest(supabase, viewerId, profileId);
      setFriendStatus("none");
      showFriendStatus("Friend request cancelled.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to cancel friend request.";
      alert(message);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!viewerId || !profileId || isOwnProfile) return;

    setFriendLoading(true);
    try {
      await acceptFriendRequest(supabase, viewerId, profileId);

      const { data: acceptedRow } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", profileId)
        .eq("receiver_id", viewerId)
        .eq("status", "accepted")
        .maybeSingle();

      const { error: notifyError } = await supabase
        .from("notifications")
        .insert([
          {
            user_id: profileId,
            actor_id: viewerId,
            type: "friend_accept",
            post_id: null,
            comment_id: null,
            friend_request_id: acceptedRow?.id || null,
            message: "accepted your friend request.",
            is_read: false,
          },
        ]);

      if (notifyError) {
        console.error("Friend accept notification error:", notifyError.message);
      }

      setFriendStatus("friends");
      showFriendStatus("Friend request accepted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to accept friend request.";
      alert(message);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleDeclineFriendRequest = async () => {
    if (!viewerId || !profileId || isOwnProfile) return;

    setFriendLoading(true);
    try {
      await declineFriendRequest(supabase, viewerId, profileId);
      setFriendStatus("none");
      showFriendStatus("Friend request declined.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to decline friend request.";
      alert(message);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!viewerId || !profileId || isOwnProfile) return;

    const confirmed = window.confirm("Remove this friend?");
    if (!confirmed) return;

    setFriendLoading(true);
    try {
      await removeFriend(supabase, viewerId, profileId);
      setFriendStatus("none");
      showFriendStatus("Friend removed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to remove friend.";
      alert(message);
    } finally {
      setFriendLoading(false);
    }
  };

  const getInitial = (name?: string | null, username?: string | null) => {
    const value = name || username || "";
    return value ? value.charAt(0).toUpperCase() : "";
  };

  const getFriendStatusLabel = () => {
    if (isOwnProfile) return "";
    if (friendStatus === "friends") return "Friends";
    if (friendStatus === "incoming_request") return "Incoming Request";
    if (friendStatus === "outgoing_request") return "Request Sent";
    return "Not Friends Yet";
  };

  const handleMobileCreatePostClick = () => {
    if (!isOwnProfile) {
      router.push("/dashboard?createPost=1");
      return;
    }

    setActiveProfileTab("Posts");

    window.setTimeout(() => {
      const composer = document.getElementById("profile-composer");
      composer?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const getShowcaseDurationLabel = (duration: ShowcaseDuration) => {
    if (duration === "24h") return "24 hours";
    if (duration === "30d") return "30 days";
    return "Permanent";
  };

  const getShowcaseExpiryLabel = (showcase: ProfileShowcase) => {
    if (!showcase.expiresAt) return "Stays until removed";

    const expiryTime = new Date(showcase.expiresAt).getTime();
    const diffMs = expiryTime - Date.now();

    if (Number.isNaN(expiryTime) || diffMs <= 0) return "Expired";

    const hours = Math.ceil(diffMs / (1000 * 60 * 60));
    if (hours <= 24) return `${hours}h left`;

    const days = Math.ceil(hours / 24);
    return `${days}d left`;
  };

  const handleShowcaseMediaFile = (file: File | null) => {
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setShowcaseError("Please choose a photo or video file.");
      return;
    }

    const maxSizeMb = isVideo ? 25 : 8;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setShowcaseError(`Please choose a ${isVideo ? "video" : "photo"} under ${maxSizeMb}MB for this preview.`);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";

      if (!result) {
        setShowcaseError("Could not preview this file.");
        return;
      }

      setShowcaseCreatorMode("media");
      setShowcaseMediaPreviewUrl(result);
      setShowcaseMediaType(isVideo ? "video" : "image");
      setShowcaseMediaFileName(file.name);
      setShowcaseError("");
    };

    reader.onerror = () => {
      setShowcaseError("Could not read this file.");
    };

    reader.readAsDataURL(file);
  };

  const handleShowcaseMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleShowcaseMediaFile(event.target.files?.[0] || null);
  };

  const handleShowcaseMediaDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setShowcaseMediaDragActive(false);
    handleShowcaseMediaFile(event.dataTransfer.files?.[0] || null);
  };

  const handleShowcaseMediaDragOver = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setShowcaseMediaDragActive(true);
  };

  const handleShowcaseMediaDragLeave = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setShowcaseMediaDragActive(false);
  };

  const handleClearShowcaseMedia = () => {
    setShowcaseMediaPreviewUrl("");
    setShowcaseMediaFileName("");
    setShowcaseMediaDragActive(false);
    setShowcaseMediaType("text");

    if (showcaseMediaInputRef.current) {
      showcaseMediaInputRef.current.value = "";
    }
  };

  const applyShowcaseTextPositionToPreview = (nextPosition: { x: number; y: number }) => {
    const textElement = showcasePreviewTextRef.current;
    if (!textElement) return;

    textElement.style.left = `${nextPosition.x}%`;
    textElement.style.top = `${nextPosition.y}%`;
  };

  const scheduleShowcaseTextPositionUpdate = (nextPosition: { x: number; y: number }) => {
    showcasePendingTextPositionRef.current = nextPosition;

    if (showcaseDragFrameRef.current !== null) return;

    showcaseDragFrameRef.current = window.requestAnimationFrame(() => {
      const next = showcasePendingTextPositionRef.current;
      showcasePendingTextPositionRef.current = null;
      showcaseDragFrameRef.current = null;

      if (next) {
        showcaseCommittedDragPositionRef.current = next;
        applyShowcaseTextPositionToPreview(next);

        const nextIsNearCenter =
          Math.abs(next.x - 50) <= 4 && Math.abs(next.y - 50) <= 4;

        if (nextIsNearCenter || showShowcaseCenterGuides) {
          setShowcaseTextPosition(next);
        }
      }
    });
  };

  const updateShowcaseTextPositionFromPointer = (
    clientX: number,
    clientY: number,
    target: HTMLElement,
    immediate = false
  ) => {
    const rect = target.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const x = Math.max(3, Math.min(97, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(3, Math.min(97, ((clientY - rect.top) / rect.height) * 100));
    const nextPosition = getShowcaseSafeTextPosition(
      { x, y },
      showcaseCoverText.trim(),
      showcaseSizeRailVisible
    );

    if (immediate) {
      showcasePendingTextPositionRef.current = null;
      showcaseCommittedDragPositionRef.current = nextPosition;

      if (showcaseDragFrameRef.current !== null) {
        window.cancelAnimationFrame(showcaseDragFrameRef.current);
        showcaseDragFrameRef.current = null;
      }

      applyShowcaseTextPositionToPreview(nextPosition);
      setShowcaseTextPosition(nextPosition);
      return;
    }

    scheduleShowcaseTextPositionUpdate(nextPosition);
  };

  const handleShowcasePreviewPointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (event.buttons !== 1 && event.pointerType !== "touch") return;
    event.preventDefault();
    updateShowcaseTextPositionFromPointer(
      event.clientX,
      event.clientY,
      event.currentTarget
    );
  };

  const handleShowcasePreviewPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateShowcaseTextPositionFromPointer(
      event.clientX,
      event.clientY,
      event.currentTarget,
      true
    );
  };

  const handleShowcasePreviewPointerEnd = () => {
    const next = showcasePendingTextPositionRef.current || showcaseCommittedDragPositionRef.current;

    showcasePendingTextPositionRef.current = null;
    showcaseCommittedDragPositionRef.current = null;

    if (showcaseDragFrameRef.current !== null) {
      window.cancelAnimationFrame(showcaseDragFrameRef.current);
      showcaseDragFrameRef.current = null;
    }

    if (next) {
      applyShowcaseTextPositionToPreview(next);
      setShowcaseTextPosition(next);
    }
  };

  const handleOpenShowcaseComposer = () => {
    setShowcaseCreatorMode("media");
    setShowcaseTitle("");
    setShowcaseCoverText("");
    setShowcaseFontKey("inter");
    setShowcaseOverlayFontSize(SHOWCASE_OVERLAY_DEFAULT_FONT_SIZE);
    setShowcaseDuration("permanent");
    setShowcaseVisibility("public");
    setShowcaseCustomizeOpen(false);
    setShowcasePreviewExpanded(false);
    setShowcaseTextPosition({ x: 50, y: 50 });
    setShowcaseMediaPreviewUrl("");
    setShowcaseMediaType("text");
    setShowcaseMediaFileName("");
    setShowcaseMediaDragActive(false);
    setShowcaseError("");
    setShowcaseComposerOpen(true);
  };

  const handleCloseShowcaseComposer = () => {
    setShowcaseComposerOpen(false);
    setShowcaseCreatorMode("media");
    setShowcaseTitle("");
    setShowcaseCoverText("");
    setShowcaseFontKey("inter");
    setShowcaseOverlayFontSize(SHOWCASE_OVERLAY_DEFAULT_FONT_SIZE);
    setShowcaseDuration("permanent");
    setShowcaseVisibility("public");
    setShowcaseCustomizeOpen(false);
    setShowcasePreviewExpanded(false);
    setShowcaseTextPosition({ x: 50, y: 50 });
    setShowcaseMediaPreviewUrl("");
    setShowcaseMediaType("text");
    setShowcaseMediaFileName("");
    setShowcaseMediaDragActive(false);
    setShowcaseError("");

    if (showcaseMediaInputRef.current) {
      showcaseMediaInputRef.current.value = "";
    }
  };

  const handleCreateShowcase = async () => {
    const trimmedTitle = showcaseTitle.trim();

    if (!trimmedTitle) {
      setShowcaseError("Give your Showcase a name first.");
      return;
    }

    if (!canManageProfileShowcases || !viewerId || !profileId) {
      setShowcaseError("You can only create Showcases on your own profile.");
      return;
    }

    const now = Date.now();
    const expiresAt =
      showcaseDuration === "24h"
        ? new Date(now + 24 * 60 * 60 * 1000).toISOString()
        : showcaseDuration === "30d"
          ? new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;

    const insertPayload = {
      user_id: viewerId,
      title: trimmedTitle,
      cover_text: showcaseCoverText.trim(),
      media_url: showcaseMediaPreviewUrl || null,
      media_type: showcaseMediaPreviewUrl ? showcaseMediaType : "text",
      media_filename: showcaseMediaFileName || null,
      font_key: showcaseFontKey,
      text_position_x: safeShowcaseTextPosition.x,
      text_position_y: safeShowcaseTextPosition.y,
      overlay_font_size: clampShowcaseOverlayFontSize(showcaseOverlayFontSize),
      duration: showcaseDuration,
      visibility: showcaseVisibility,
      expires_at: expiresAt,
    };

    const { data, error } = await supabase
      .from("profile_showcases")
      .insert(insertPayload)
      .select(
        "id,user_id,title,cover_text,media_url,media_type,media_filename,font_key,text_position_x,text_position_y,overlay_font_size,duration,visibility,expires_at,created_at"
      )
      .single();

    if (error || !data) {
      console.error("Could not create Showcase:", error);
      setShowcaseError("Could not create Showcase. Please try again.");
      return;
    }

    const nextShowcase = mapProfileShowcaseRow(data as ProfileShowcaseRow);

    setProfileShowcases((prev) => [nextShowcase, ...prev]);
    handleCloseShowcaseComposer();
    showFriendStatus("Showcase created.");
  };

  const handleDeleteShowcase = async (showcaseId: string) => {
    if (!canManageProfileShowcases) return;

    const confirmed = window.confirm("Delete this Showcase from your profile?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("profile_showcases")
      .delete()
      .eq("id", showcaseId)
      .eq("user_id", viewerId);

    if (error) {
      console.error("Could not delete Showcase:", error);
      showFriendStatus("Could not delete Showcase.");
      return;
    }

    setProfileShowcases((prev) => prev.filter((showcase) => showcase.id !== showcaseId));
    setActiveProfileShowcase((current) =>
      current?.id === showcaseId ? null : current
    );
    showFriendStatus("Showcase deleted.");
  };

  const handleOpenShowcase = (showcase: ProfileShowcase) => {
    setActiveProfileShowcase(showcase);
    setProfileActionsOpen(false);
  };

  const handleCloseShowcaseViewer = () => {
    setActiveProfileShowcase(null);
  };

  const updateProfileActionMenuPosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const button = profileActionButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 280;
    const safePadding = 12;
    const gap = 10;
    const preferredTop = rect.bottom + gap;
    const availableBelow = window.innerHeight - preferredTop - safePadding;
    const availableAbove = rect.top - safePadding - gap;
    const openUpward = availableBelow < 260 && availableAbove > availableBelow;
    const maxHeight = Math.min(
      340,
      Math.max(180, openUpward ? availableAbove : availableBelow)
    );
    const top = openUpward
      ? Math.max(safePadding, rect.top - maxHeight - gap)
      : Math.min(preferredTop, window.innerHeight - maxHeight - safePadding);
    const left = Math.max(
      safePadding,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - safePadding)
    );

    setProfileActionMenuPosition({
      top,
      left,
      maxHeight,
    });
  }, []);

  const handleToggleProfileActions = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();

    const isDesktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 721px)").matches;

    if (isDesktop) {
      updateProfileActionMenuPosition();

      window.requestAnimationFrame(() => {
        updateProfileActionMenuPosition();
      });
    }

    setProfileActionsOpen((value) => !value);
  };

  useEffect(() => {
    if (!profileActionsOpen || typeof window === "undefined") return;

    const isDesktopProfileWidth = window.matchMedia("(min-width: 721px)").matches;
    if (!isDesktopProfileWidth) return;

    updateProfileActionMenuPosition();

    window.addEventListener("resize", updateProfileActionMenuPosition);
    return () => {
      window.removeEventListener("resize", updateProfileActionMenuPosition);
    };
  }, [profileActionsOpen, updateProfileActionMenuPosition]);

  const getProfileShareHref = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/profile/${profileId}`
      : `/profile/${profileId}`;

  const handleCopyProfileLink = async () => {
    const href = getProfileShareHref();

    try {
      await navigator.clipboard.writeText(href);
      showFriendStatus("Profile link copied.");
    } catch {
      window.prompt("Copy this profile link:", href);
    }

    setProfileActionsOpen(false);
  };

  const handleShareProfile = async () => {
    const href = getProfileShareHref();
    const shareTitle = `${profile?.full_name || profile?.username || "Parapost profile"} on Parapost Network`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: "View this profile on Parapost Network.",
          url: href,
        });
        setProfileActionsOpen(false);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(href);
      showFriendStatus("Profile link copied for sharing.");
    } catch {
      window.prompt("Copy this profile link:", href);
    }

    setProfileActionsOpen(false);
  };

  const savePendingLoggedOutProfileAction = (action: "report_profile" | "block_user") => {
    if (typeof window === "undefined") return;

    const href = `${window.location.origin}/profile/${profileId}`;

    window.localStorage.setItem(
      "parapost-pending-profile-action",
      JSON.stringify({
        action,
        profileId,
        href,
        createdAt: new Date().toISOString(),
      })
    );
  };

  const handleLoggedOutProfileAction = (actionLabel: string, action: "report_profile" | "block_user") => {
    savePendingLoggedOutProfileAction(action);
    setProfileActionsOpen(false);
    alert(`Please log in or create an account to ${actionLabel}.`);
  };

  const handleReportProfile = async () => {
    if (isOwnProfile || !profileId) return;

    if (!viewerId) {
      handleLoggedOutProfileAction("report this profile", "report_profile");
      return;
    }

    const profileName = profile?.full_name || profile?.username || "this profile";
    const confirmed = window.confirm(
      `Report ${profileName} to Parapost Network moderation?`
    );

    if (!confirmed) return;

    const reason = window.prompt(
      "Why are you reporting this profile? Example: spam, harassment, impersonation, unsafe content, or other.",
      ""
    );

    if (reason === null) return;

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      showFriendStatus("Please add a reason before reporting.");
      return;
    }

    const { error } = await supabase.from("profile_reports").insert({
      reporter_id: viewerId,
      reported_profile_id: profileId,
      reason: trimmedReason.slice(0, 160),
      details: trimmedReason.length > 160 ? trimmedReason : null,
      status: "open",
    });

    if (error) {
      console.error("Report profile error:", error.message);
      showFriendStatus("Could not submit report. Please try again.");
      return;
    }

    setProfileActionsOpen(false);
    showFriendStatus("Profile report sent to moderation.");
  };

  const handleBlockProfile = async () => {
    if (isOwnProfile || !profileId) return;

    if (!viewerId) {
      handleLoggedOutProfileAction("block this user", "block_user");
      return;
    }

    const confirmed = window.confirm(
      `Block ${profile?.full_name || profile?.username || "this user"}? This will save the block to your Parapost account.`
    );

    if (!confirmed) return;

    const { error } = await supabase.from("user_blocks").upsert(
      {
        blocker_id: viewerId,
        blocked_id: profileId,
      },
      {
        onConflict: "blocker_id,blocked_id",
        ignoreDuplicates: true,
      }
    );

    if (error) {
      console.error("Block user error:", error.message);
      showFriendStatus("Could not block user. Please try again.");
      return;
    }

    setProfileActionsOpen(false);
    showFriendStatus("User blocked.");
  };

  const handleOpenProfileSection = (tab: string) => {
    setActiveProfileTab(tab);
    setProfileActionsOpen(false);

    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
  };

  const profileMissingForOwner = isOwnProfile && !loading && !errorMessage && !profile;
  const profileFallbackName = viewerEmail
    ? viewerEmail
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    : "Parapost Member";
  const profileFallbackUsername = viewerEmail
    ? viewerEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24)
    : "";
  const profileIsReady = !!profile || profileMissingForOwner;
  const profileDisplayName = profile
    ? profile?.full_name || profile?.username || "Parapost Member"
    : profileMissingForOwner
      ? profileFallbackName
      : "";
  const profileDisplayUsername = profile
    ? profile?.username || ""
    : profileMissingForOwner
      ? profileFallbackUsername
      : "";
  const profileDisplayInitial = profile
    ? getInitial(profile?.full_name, profile?.username)
    : profileMissingForOwner
      ? getInitial(profileFallbackName, profileFallbackUsername)
      : "";
  const profileBioValue = (profile?.bio || "").trim();
  const profileHasUsefulBio =
    profileBioValue.length > 0 &&
    !profileBioValue.toLowerCase().startsWith("no bio added yet");
  const profileHasAvatar = Boolean(profile?.avatar_url);
  const profileHasEditedBasics = Boolean(
    profileHasAvatar ||
      profileHasUsefulBio ||
      profile?.location ||
      profile?.website ||
      profile?.occupation ||
      profile?.paranormal_focus ||
      profile?.experience_years ||
      profile?.equipment ||
      profile?.favorite_locations ||
      profile?.availability
  );
  const profileHasFirstPost = posts.length > 0;
  const shouldShowProfileStarter =
    isOwnProfile &&
    !loading &&
    !errorMessage &&
    (!profile || !profileHasEditedBasics || !profileHasFirstPost);
  const profileStarterCompletedCount = [profileHasEditedBasics, profileHasFirstPost].filter(Boolean).length;
  const profileStarterPercent = Math.round((profileStarterCompletedCount / 2) * 100);
  const profileSmoothLoadClass = profileIsReady
    ? "profile-data-ready"
    : "profile-data-waiting";
  const profilePhotoCount = posts.filter((post) => Boolean(post.image_url)).length;
  const profileTabItems = [
    {
      value: "Posts",
      label: "Posts",
      detail: `${profileFeedItems.length} update${profileFeedItems.length === 1 ? "" : "s"}`,
      summary: isOwnProfile
        ? "Create updates, share photos, and keep your profile timeline active."
        : "Browse this profile's posts, shared reels, and public updates.",
    },
    {
      value: "About",
      label: "About",
      detail: isOwnProfile ? "Profile details" : "Member info",
      summary: isOwnProfile
        ? "Keep your intro, links, location, and profile details polished."
        : "View this member's profile details, links, and public information.",
    },
    {
      value: "Reels",
      label: "Reels",
      detail: `${reels.length} reel${reels.length === 1 ? "" : "s"}`,
      summary: "Watch short videos connected to this profile.",
    },
    {
      value: "Photos",
      label: "Photos",
      detail: `${profilePhotoCount} photo${profilePhotoCount === 1 ? "" : "s"}`,
      summary: "View photos shared through profile posts and media updates.",
    },
    {
      value: "Events",
      label: "Events",
      detail: "Coming soon",
      summary: "Events are prepared for a future Parapost Network profile update.",
    },
  ];
  const activeProfileTabItem =
    profileTabItems.find((tab) => tab.value === activeProfileTab) || profileTabItems[0];
  const profileCoverPositionX = clampShowcaseTextPercent(Number(profile?.cover_position_x ?? 50), 0, 100);
  const profileCoverPositionY = clampShowcaseTextPercent(Number(profile?.cover_position_y ?? 50), 0, 100);
  const profileCoverDisplayStyle: CSSProperties = profile?.cover_url
    ? {
        ...profileCoverStyle,
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.18) 46%, rgba(5,7,11,0.78) 100%), url(${profile.cover_url})`,
        backgroundSize: "cover",
        backgroundPosition: `${profileCoverPositionX}% ${profileCoverPositionY}%`,
      }
    : profileCoverStyle;

return (
  <div
    className={`min-h-screen text-white profile-polish-surface profile-mobile-first-polish profile-batch2-flow-polish profile-tabs-polish-v21 profile-tabs-mobile-cutoff-v22 ${profileSmoothLoadClass}`}
   style={{
     ...profilePageBackgroundStyle,
     backgroundColor: "#07090d",
     minHeight: "100vh",
     height: "auto",
     overflowX: "hidden",
     overflowY: "auto",
     WebkitOverflowScrolling: "touch",
     overscrollBehaviorY: "auto",
     animation: "profileFadeIn 220ms ease-out",
   }}
  >
    <style>{`

      .profile-tabs-polish-v21 .profile-tabs-desktop button:hover {
        transform: translateY(-1px);
        background: rgba(255,255,255,0.045) !important;
        color: #ffffff !important;
      }

      .profile-tabs-polish-v21 .profile-tab-summary-card {
        animation: profileSectionSettle 180ms ease-out;
      }

      @media (max-width: 720px) {
        .profile-tabs-polish-v21 .profile-tabs-shell {
          padding: 0 10px 12px !important;
          gap: 8px !important;
          background: rgba(17,19,24,0.96) !important;
          border-top: 1px solid rgba(255,255,255,0.06) !important;
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
        }

        .profile-tabs-polish-v21 .profile-tabs-desktop {
          display: flex !important;
          gap: 8px !important;
          padding: 8px 2px !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          overflow-x: auto !important;
          scroll-snap-type: x proximity !important;
        }

        .profile-tabs-polish-v21 .profile-tabs-desktop button {
          min-width: 112px !important;
          min-height: 48px !important;
          flex: 0 0 auto !important;
          scroll-snap-align: start !important;
          padding: 9px 11px !important;
          border-radius: 14px !important;
        }

        .profile-tabs-polish-v21 .profile-tabs-desktop button small {
          font-size: 9px !important;
        }

        .profile-tabs-polish-v21 .profile-tab-summary-card {
          grid-template-columns: 36px minmax(0, 1fr) !important;
          padding: 10px !important;
          border-radius: 16px !important;
        }

        .profile-tabs-polish-v21 .profile-tab-summary-card p:last-child {
          font-size: 11px !important;
          line-height: 1.35 !important;
        }
      }

      @media (min-width: 721px) and (max-width: 1100px) {
        .profile-tabs-polish-v21 .profile-tabs-desktop {
          grid-template-columns: repeat(5, minmax(96px, 1fr)) !important;
        }

        .profile-tabs-polish-v21 .profile-tabs-desktop button {
          padding-left: 10px !important;
          padding-right: 10px !important;
        }
      }

      .profile-showcase-viewer-overlay {
        animation: profileShowcaseViewerFade 180ms ease-out;
      }

      .profile-showcase-viewer-shell {
        animation: profileShowcaseViewerRise 200ms ease-out;
      }

      @keyframes profileShowcaseViewerFade {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes profileShowcaseViewerRise {
        from {
          opacity: 0;
          transform: translateY(14px) scale(0.985);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @media (max-width: 720px) {
        .profile-showcase-viewer-overlay {
          padding: 0 !important;
          align-items: stretch !important;
        }

        .profile-showcase-viewer-shell {
          width: 100% !important;
          max-width: none !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          border-radius: 0 !important;
          padding: 12px 12px calc(14px + env(safe-area-inset-bottom)) !important;
        }

        .profile-showcase-viewer-header {
          padding-bottom: 10px !important;
        }

        .profile-showcase-viewer-stage {
          min-height: 0 !important;
          flex: 1 1 auto !important;
          border-radius: 24px !important;
        }

        .profile-showcase-viewer-footer {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        .profile-showcase-viewer-delete {
          width: 100% !important;
        }
      }


      @media (max-width: 720px) {
        .profile-starter-card {
          margin: 12px 10px 14px !important;
          padding: 14px !important;
          border-radius: 20px !important;
        }

        .profile-starter-card [style*="grid-template-columns: repeat(4"] {
          grid-template-columns: 1fr 1fr !important;
        }
      }

      @media (max-width: 480px) {
        .profile-starter-card [style*="grid-template-columns: repeat(4"] {
          grid-template-columns: 1fr !important;
        }
      }

      @media (max-width: 720px) {
        .profile-showcase-modal-overlay {
          z-index: 2147482500 !important;
          align-items: stretch !important;
          justify-content: stretch !important;
          padding: 0 !important;
          background: rgba(0,0,0,0.78) !important;
        }

        .profile-showcase-modal-overlay > div {
          position: fixed !important;
          inset: 0 !important;
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
          height: auto !important;
          border-radius: 0 !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 14px 14px 92px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax(0, 1fr) minmax(240px"] {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 126px"] {
          min-height: 104px !important;
          grid-template-columns: 44px minmax(0, 1fr) !important;
          padding: 14px !important;
          border-radius: 18px !important;
        }

        .profile-showcase-modal-overlay [style*="width: 52px"] {
          width: 44px !important;
          height: 44px !important;
          border-radius: 15px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
        }

        .profile-showcase-font-select {
          display: block !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }
      }

      @media (min-width: 721px) and (max-width: 1050px) {
        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax(0, 1fr) minmax(240px"] {
          grid-template-columns: minmax(0, 1fr) minmax(230px, 0.82fr) !important;
        }
      }


      @media (max-width: 720px) {
        .profile-showcase-modal-overlay {
          z-index: 2147482500 !important;
          align-items: stretch !important;
          justify-content: stretch !important;
          padding: 0 !important;
          background: rgba(0,0,0,0.82) !important;
        }

        .profile-showcase-modal-overlay > div {
          position: fixed !important;
          inset: 0 !important;
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
          height: auto !important;
          border-radius: 0 !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 14px 14px 96px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax(0, 1fr) minmax(280px"] {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 144px"] {
          min-height: 110px !important;
          grid-template-columns: 44px minmax(0, 1fr) !important;
          padding: 14px !important;
          border-radius: 19px !important;
        }

        .profile-showcase-modal-overlay [style*="width: 58px"] {
          width: 44px !important;
          height: 44px !important;
          border-radius: 15px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 340px"] {
          min-height: 220px !important;
        }

        .profile-showcase-font-select {
          display: block !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
        }

        .profile-showcase-modal-overlay [style*="position: sticky"] {
          justify-content: stretch !important;
        }

        .profile-showcase-modal-overlay [style*="position: sticky"] button {
          flex: 1 1 0 !important;
        }
      }

      @media (min-width: 721px) and (max-width: 1050px) {
        .profile-showcase-modal-overlay > div {
          width: min(860px, calc(100vw - 24px)) !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax(0, 1fr) minmax(280px"] {
          grid-template-columns: minmax(0, 1fr) minmax(260px, 0.82fr) !important;
          gap: 16px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 340px"] {
          min-height: 300px !important;
        }
      }


      .profile-showcase-duration-option span {
        word-break: keep-all !important;
      }

      @media (max-width: 720px) {
        .profile-showcase-duration-option {
          min-height: 64px !important;
          padding: 8px 8px !important;
        }

        .profile-showcase-duration-option span {
          font-size: 12px !important;
          line-height: 1.05 !important;
          min-height: 24px !important;
        }

        .profile-showcase-duration-option small {
          font-size: 9px !important;
          line-height: 1.1 !important;
        }
      }

      .profile-showcase-preview-phone {
        width: 100% !important;
        height: clamp(330px, 42vh, 440px) !important;
        min-height: 330px !important;
        max-height: 440px !important;
      }

      .profile-showcase-upload-card strong,
      .profile-showcase-upload-card small,
      .profile-showcase-duration-option span,
      .profile-showcase-duration-option small {
        display: block !important;
      }

      .profile-showcase-upload-card strong,
      .profile-showcase-preview-title {
        font-size: 13px !important;
        line-height: 1.12 !important;
        font-weight: 950 !important;
        letter-spacing: -0.01em !important;
      }

      .profile-showcase-upload-card small,
      .profile-showcase-preview-help {
        font-size: 10px !important;
        line-height: 1.15 !important;
        font-weight: 800 !important;
        color: rgba(226,232,240,0.72) !important;
        margin-top: 3px !important;
      }

      .profile-showcase-duration-option span {
        word-break: keep-all !important;
      }

      @media (max-width: 720px) {
        .profile-showcase-preview-column {
          border-left: 0 !important;
          padding-left: 0 !important;
          justify-items: stretch !important;
        }

        .profile-showcase-preview-header {
          align-items: flex-start !important;
          justify-content: flex-start !important;
          flex-direction: column !important;
          gap: 3px !important;
        }

        .profile-showcase-preview-phone {
          width: 100% !important;
          height: 220px !important;
          min-height: 220px !important;
          max-height: 220px !important;
          border-radius: 22px !important;
        }

        .profile-showcase-upload-card {
          min-height: 82px !important;
          grid-template-columns: 44px minmax(0, 1fr) !important;
          gap: 12px !important;
          padding: 13px !important;
          border-radius: 18px !important;
        }

        .profile-showcase-upload-card strong,
        .profile-showcase-preview-title {
          font-size: 12px !important;
          line-height: 1.12 !important;
        }

        .profile-showcase-upload-card small,
        .profile-showcase-preview-help {
          font-size: 9px !important;
          line-height: 1.12 !important;
        }

        .profile-showcase-duration-option {
          min-height: 64px !important;
          padding: 8px 8px !important;
        }

        .profile-showcase-duration-option span {
          font-size: 12px !important;
          line-height: 1.05 !important;
          min-height: 24px !important;
        }

        .profile-showcase-duration-option small {
          font-size: 9px !important;
          line-height: 1.1 !important;
        }
      }


      .profile-showcase-upload-card strong,
      .profile-showcase-upload-card small,
      .profile-showcase-duration-option span,
      .profile-showcase-duration-option small,
      .profile-showcase-preview-title,
      .profile-showcase-preview-help {
        display: block !important;
      }

      .profile-showcase-duration-option span {
        white-space: normal !important;
        overflow: visible !important;
        text-overflow: clip !important;
      }

      @media (max-width: 720px) {
        .profile-showcase-upload-card strong,
        .profile-showcase-preview-title {
          font-size: 12px !important;
          line-height: 1.12 !important;
        }

        .profile-showcase-upload-card small,
        .profile-showcase-preview-help {
          font-size: 9px !important;
          line-height: 1.15 !important;
          margin-top: 3px !important;
        }

        .profile-showcase-duration-option {
          min-height: 58px !important;
          padding: 9px 12px !important;
          gap: 3px !important;
          align-content: center !important;
        }

        .profile-showcase-duration-option span {
          font-size: 12px !important;
          line-height: 1.08 !important;
          min-height: auto !important;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
        }

        .profile-showcase-duration-option small {
          font-size: 9px !important;
          line-height: 1.12 !important;
        }
      }



      /* Final mobile-only duration row fix: keeps desktop unchanged */
      @media (max-width: 720px) {
        .profile-showcase-duration-option {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          min-height: 46px !important;
          padding: 10px 12px !important;
          text-align: left !important;
        }

        .profile-showcase-duration-option span {
          display: block !important;
          flex: 0 0 auto !important;
          min-width: 0 !important;
          max-width: none !important;
          font-size: 12px !important;
          line-height: 1.05 !important;
          font-weight: 950 !important;
          white-space: nowrap !important;
          overflow: visible !important;
          text-overflow: clip !important;
        }

        .profile-showcase-duration-option small {
          display: block !important;
          flex: 0 0 auto !important;
          min-width: 0 !important;
          max-width: none !important;
          font-size: 9px !important;
          line-height: 1.08 !important;
          font-weight: 800 !important;
          text-align: right !important;
          white-space: nowrap !important;
          overflow: visible !important;
          text-overflow: clip !important;
          opacity: 0.82 !important;
        }
      }

      .profile-showcase-modal-overlay button[style*="dashed"]:hover {
        border-color: rgba(216,180,254,0.72) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 22px 54px rgba(0,0,0,0.28), 0 0 24px rgba(168,85,247,0.12) !important;
      }


      .profile-showcases-row button[aria-label="Create a new Showcase"]:hover span:first-child,
      .profile-showcases-row button[aria-label="Create a new Showcase"]:focus-visible span:first-child {
        transform: translateY(0) scale(1);
        filter: brightness(1.08) saturate(1.08);
        box-shadow:
          0 18px 38px rgba(124,58,237,0.44),
          0 0 38px rgba(168,85,247,0.34),
          inset 0 1px 0 rgba(255,255,255,0.18) !important;
      }

      .profile-showcases-row button[aria-label="Create a new Showcase"] span:first-child {
        transform-origin: center center;
        transition: box-shadow 160ms ease, filter 160ms ease;
      }

      @media (max-width: 720px) {
        .profile-showcases-row {
          min-height: 88px !important;
          gap: 14px !important;
          padding-bottom: 7px !important;
          overflow-y: visible !important;
        }

        .profile-showcases-row button[aria-label="Create a new Showcase"] {
          min-width: 78px !important;
          width: 78px !important;
        }

        .profile-showcases-row button[aria-label="Create a new Showcase"] span:first-child {
          width: 68px !important;
          height: 68px !important;
          font-size: 46px !important;
          line-height: 0.84 !important;
          padding-bottom: 5px !important;
        }
      }


      .profile-showcase-font-select {
        display: block !important;
      }

      .profile-showcase-desktop-font-grid {
        display: none !important;
      }


      .profile-showcase-font-select {
        display: block !important;
      }

      .profile-showcase-desktop-font-grid {
        display: none !important;
      }

      @media (min-width: 1051px) {
        .profile-showcase-modal-overlay > div {
          width: min(1180px, calc(100vw - 36px)) !important;
          height: min(860px, calc(100vh - 36px)) !important;
          max-height: calc(100vh - 36px) !important;
          border-radius: 30px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax(320px"] {
          grid-template-columns: minmax(320px, 0.92fr) minmax(360px, 1.08fr) !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 460px"] {
          min-height: min(520px, calc(100vh - 260px)) !important;
        }
      }

      @media (min-width: 721px) and (max-width: 1050px) {
        .profile-showcase-modal-overlay {
          padding: 12px !important;
          align-items: stretch !important;
        }

        .profile-showcase-modal-overlay > div {
          width: calc(100vw - 24px) !important;
          height: calc(100vh - 24px) !important;
          max-height: calc(100vh - 24px) !important;
          border-radius: 24px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax(320px"] {
          grid-template-columns: minmax(0, 0.95fr) minmax(300px, 1.05fr) !important;
          gap: 18px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 460px"] {
          min-height: min(440px, calc(100vh - 265px)) !important;
        }
      }

      @media (max-width: 720px) {
        .profile-showcase-modal-overlay {
          z-index: 2147482500 !important;
          align-items: stretch !important;
          justify-content: stretch !important;
          padding: 0 !important;
          background: rgba(0,0,0,0.86) !important;
        }

        .profile-showcase-modal-overlay > div {
          position: fixed !important;
          inset: 0 !important;
          width: auto !important;
          height: auto !important;
          max-width: none !important;
          max-height: none !important;
          border-radius: 0 !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 14px 14px 96px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax(320px"] {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 144px"],
        .profile-showcase-modal-overlay [style*="min-height: 126px"] {
          min-height: 108px !important;
          grid-template-columns: 44px minmax(0, 1fr) !important;
          padding: 14px !important;
          border-radius: 19px !important;
        }

        .profile-showcase-modal-overlay [style*="width: 58px"],
        .profile-showcase-modal-overlay [style*="width: 52px"] {
          width: 44px !important;
          height: 44px !important;
          border-radius: 15px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 460px"] {
          min-height: 240px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
        }

        .profile-showcase-font-select {
          display: block !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }

        .profile-showcase-modal-overlay [style*="position: sticky"] {
          justify-content: stretch !important;
        }

        .profile-showcase-modal-overlay [style*="position: sticky"] button {
          flex: 1 1 0 !important;
        }
      }


      @media (max-width: 720px) {
        .profile-showcase-preview-column {
          order: -1 !important;
        }

        .profile-showcase-simple-controls {
          order: 1 !important;
        }

        .profile-showcase-preview-column [style*="min-height: 460px"],
        .profile-showcase-preview-column [style*="min-height: 340px"],
        .profile-showcase-preview-column [style*="min-height: 270px"] {
          min-height: 220px !important;
        }
      }


      .profile-showcase-font-select {
        display: block !important;
      }

      .profile-showcase-desktop-font-grid {
        display: none !important;
      }

      @media (max-width: 720px) {
        .profile-showcase-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483000 !important;
          display: block !important;
          padding: 0 !important;
          background:
            radial-gradient(circle at 50% 0%, rgba(168,85,247,0.20), transparent 40%),
            rgba(0,0,0,0.92) !important;
          overflow: hidden !important;
        }

        .profile-showcase-modal-overlay > div {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          max-width: none !important;
          max-height: none !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          border-top: 0 !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 14px 14px 96px !important;
          box-shadow: none !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax"] {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .profile-showcase-preview-column {
          order: -1 !important;
        }

        .profile-showcase-simple-controls {
          order: 1 !important;
        }

        .profile-showcase-preview-column [style*="min-height"] {
          min-height: 245px !important;
          border-radius: 20px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 144px"],
        .profile-showcase-modal-overlay [style*="min-height: 126px"],
        .profile-showcase-modal-overlay [style*="min-height: 110px"] {
          min-height: 96px !important;
          grid-template-columns: 42px minmax(0, 1fr) !important;
          padding: 13px !important;
          border-radius: 18px !important;
        }

        .profile-showcase-modal-overlay [style*="width: 58px"],
        .profile-showcase-modal-overlay [style*="width: 52px"],
        .profile-showcase-modal-overlay [style*="width: 44px"] {
          width: 42px !important;
          height: 42px !important;
          border-radius: 14px !important;
          font-size: 23px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
        }

        .profile-showcase-font-select {
          display: block !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }

        .profile-showcase-modal-actions {
          position: static !important;
          bottom: auto !important;
          display: grid !important;
          grid-template-columns: 1fr 1.35fr !important;
          gap: 8px !important;
          margin: 14px -2px 0 !important;
          padding: 12px 0 2px !important;
          background:
            linear-gradient(180deg, rgba(8,10,15,0), rgba(8,10,15,0.96) 24%, rgba(8,10,15,1)) !important;
          z-index: 30 !important;
        }

        .profile-showcase-modal-actions button {
          width: 100% !important;
          min-height: 42px !important;
          justify-content: center !important;
        }
      }

      @media (min-width: 721px) and (max-width: 1050px) {
        .profile-showcase-modal-overlay {
          padding: 12px !important;
        }

        .profile-showcase-modal-overlay > div {
          width: calc(100vw - 24px) !important;
          height: calc(100vh - 24px) !important;
          max-height: calc(100vh - 24px) !important;
          border-radius: 24px !important;
        }

        .profile-showcase-font-select {
          display: block !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }
      }

      @media (min-width: 1051px) {
        .profile-showcase-font-select {
          display: block !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }
      }


      .profile-showcase-font-select {
        display: block !important;
      }

      .profile-showcase-desktop-font-grid {
        display: none !important;
      }

      @media (min-width: 1051px) {
        .profile-showcase-modal-overlay > div {
          width: min(1180px, calc(100vw - 32px)) !important;
          height: min(840px, calc(100vh - 32px)) !important;
          max-height: calc(100vh - 32px) !important;
        }

        .profile-showcase-preview-column {
          border-left: 1px solid rgba(255,255,255,0.085) !important;
          padding-left: 22px !important;
        }

        .profile-showcase-preview-column [style*="min-height"] {
          min-height: min(500px, calc(100vh - 260px)) !important;
        }
      }

      @media (min-width: 721px) and (max-width: 1050px) {
        .profile-showcase-modal-overlay {
          padding: 12px !important;
        }

        .profile-showcase-modal-overlay > div {
          width: calc(100vw - 24px) !important;
          height: calc(100vh - 24px) !important;
          max-height: calc(100vh - 24px) !important;
          border-radius: 24px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax"] {
          grid-template-columns: minmax(0, 0.95fr) minmax(300px, 1.05fr) !important;
          gap: 18px !important;
        }

        .profile-showcase-preview-column {
          border-left: 1px solid rgba(255,255,255,0.08) !important;
          padding-left: 18px !important;
        }

        .profile-showcase-preview-column [style*="min-height"] {
          min-height: min(430px, calc(100vh - 265px)) !important;
        }
      }

      @media (max-width: 720px) {
        .profile-showcase-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483000 !important;
          display: block !important;
          padding: 0 !important;
          background:
            radial-gradient(circle at 50% 0%, rgba(168,85,247,0.24), transparent 42%),
            rgba(0,0,0,0.94) !important;
          overflow: hidden !important;
        }

        .profile-showcase-modal-overlay > div {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          max-width: none !important;
          max-height: none !important;
          border-radius: 0 !important;
          border: 0 !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 14px 14px 96px !important;
          box-shadow: none !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax"] {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .profile-showcase-preview-column {
          order: -1 !important;
          border-left: 0 !important;
          padding-left: 0 !important;
          gap: 8px !important;
        }

        .profile-showcase-simple-controls {
          order: 1 !important;
          gap: 10px !important;
        }

        .profile-showcase-preview-column [style*="min-height"] {
          min-height: min(250px, 34vh) !important;
          border-radius: 22px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 148px"],
        .profile-showcase-modal-overlay [style*="min-height: 144px"],
        .profile-showcase-modal-overlay [style*="min-height: 126px"] {
          min-height: 96px !important;
          grid-template-columns: 42px minmax(0, 1fr) !important;
          padding: 13px !important;
          border-radius: 18px !important;
        }

        .profile-showcase-modal-overlay [style*="width: 58px"],
        .profile-showcase-modal-overlay [style*="width: 52px"],
        .profile-showcase-modal-overlay [style*="width: 44px"] {
          width: 42px !important;
          height: 42px !important;
          border-radius: 14px !important;
          font-size: 23px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
        }

        .profile-showcase-font-select {
          display: block !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }

        .profile-showcase-modal-actions {
          position: static !important;
          bottom: auto !important;
          display: grid !important;
          grid-template-columns: 1fr 1.35fr !important;
          gap: 8px !important;
          margin: 14px -2px 0 !important;
          padding: 12px 0 2px !important;
          background:
            linear-gradient(180deg, rgba(8,10,15,0), rgba(8,10,15,0.96) 24%, rgba(8,10,15,1)) !important;
          z-index: 30 !important;
        }

        .profile-showcase-modal-actions button {
          width: 100% !important;
          min-height: 42px !important;
          justify-content: center !important;
        }
      }


      .profile-showcase-modal-flow-pills span,
      .profile-showcase-modal-header span[style] + span span {
        pointer-events: none;
      }

      .profile-showcase-modal-header div[style*="margin-top: 10px"] span {
        border: 1px solid rgba(216,180,254,0.18);
        background: rgba(168,85,247,0.08);
        color: #d8b4fe;
        border-radius: 999px;
        padding: 5px 8px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      @media (min-width: 1051px) {
        .profile-showcase-modal-shell {
          width: min(1220px, calc(100vw - 32px)) !important;
          height: min(860px, calc(100vh - 32px)) !important;
          max-height: calc(100vh - 32px) !important;
          padding: 24px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax"] {
          grid-template-columns: minmax(340px, 0.88fr) minmax(430px, 1.12fr) !important;
          gap: 28px !important;
        }

        .profile-showcase-preview-column {
          border-left: 1px solid rgba(255,255,255,0.085) !important;
          padding-left: 26px !important;
        }

        .profile-showcase-preview-column [style*="min-height"] {
          min-height: min(520px, calc(100vh - 270px)) !important;
        }
      }

      @media (min-width: 721px) and (max-width: 1050px) {
        .profile-showcase-modal-shell {
          width: calc(100vw - 24px) !important;
          height: calc(100vh - 24px) !important;
          max-height: calc(100vh - 24px) !important;
          border-radius: 26px !important;
          padding: 18px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax"] {
          grid-template-columns: minmax(0, 0.92fr) minmax(320px, 1.08fr) !important;
          gap: 20px !important;
        }

        .profile-showcase-preview-column {
          border-left: 1px solid rgba(255,255,255,0.08) !important;
          padding-left: 18px !important;
        }

        .profile-showcase-preview-column [style*="min-height"] {
          min-height: min(455px, calc(100vh - 270px)) !important;
        }

        .profile-showcase-upload-card {
          min-height: 132px !important;
        }
      }

      @media (max-width: 720px) {
        .profile-showcase-modal-shell {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          max-width: none !important;
          max-height: none !important;
          border-radius: 0 !important;
          border: 0 !important;
          overflow-y: auto !important;
          padding: 12px 14px 96px !important;
          box-shadow: none !important;
        }

        .profile-showcase-modal-header {
          position: relative !important;
          top: auto !important;
          margin: -2px -2px 12px !important;
          padding: 4px 2px 12px !important;
          background: transparent !important;
        }

        .profile-showcase-modal-header h3 {
          font-size: 20px !important;
          letter-spacing: -0.04em !important;
        }

        .profile-showcase-modal-header p {
          font-size: 12px !important;
        }

        .profile-showcase-modal-header div[style*="margin-top: 10px"] {
          gap: 5px !important;
          margin-top: 7px !important;
        }

        .profile-showcase-modal-header div[style*="margin-top: 10px"] span {
          font-size: 9px !important;
          padding: 4px 7px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax"] {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .profile-showcase-preview-column {
          order: -1 !important;
          border-left: 0 !important;
          padding-left: 0 !important;
          gap: 8px !important;
        }

        .profile-showcase-simple-controls {
          order: 1 !important;
          gap: 10px !important;
        }

        .profile-showcase-preview-column [style*="min-height"] {
          min-height: min(260px, 36vh) !important;
          border-radius: 22px !important;
        }

        .profile-showcase-upload-card {
          min-height: 96px !important;
          grid-template-columns: 42px minmax(0, 1fr) !important;
          padding: 13px !important;
          border-radius: 18px !important;
        }

        .profile-showcase-upload-card span:first-child {
          width: 42px !important;
          height: 42px !important;
          border-radius: 14px !important;
          font-size: 23px !important;
        }

        .profile-showcase-modal-overlay input,
        .profile-showcase-modal-overlay select,
        .profile-showcase-modal-overlay button {
          font-size: 13px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
        }

        .profile-showcase-modal-actions {
          position: static !important;
          bottom: auto !important;
          display: grid !important;
          grid-template-columns: 1fr 1.35fr !important;
          gap: 8px !important;
          margin: 14px -2px 0 !important;
          padding: 12px 0 2px !important;
          background:
            linear-gradient(180deg, rgba(8,10,15,0), rgba(8,10,15,0.96) 24%, rgba(8,10,15,1)) !important;
          z-index: 30 !important;
        }

        .profile-showcase-modal-actions button {
          width: 100% !important;
          min-height: 42px !important;
          justify-content: center !important;
        }
      }


      .profile-showcase-modal-overlay [aria-pressed] strong {
        color: #ffffff;
        font-size: 12px;
        font-weight: 950;
        line-height: 1.05;
      }

      .profile-showcase-modal-overlay [aria-pressed] small {
        color: rgba(229,231,235,0.68);
        font-size: 10px;
        font-weight: 800;
        line-height: 1.05;
      }

      @media (max-width: 720px) {
        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
        }

        .profile-showcase-modal-overlay [aria-pressed] {
          min-height: 52px !important;
        }
      }


      .profile-showcase-visibility-symbol {
        position: relative;
        width: 20px;
        height: 20px;
        display: block;
        color: #e9d5ff;
      }

      .profile-showcase-visibility-symbol-public {
        border: 1.8px solid currentColor;
        border-radius: 999px;
      }

      .profile-showcase-visibility-symbol-public::before {
        content: "";
        position: absolute;
        left: 3px;
        right: 3px;
        top: 50%;
        height: 1.6px;
        transform: translateY(-50%);
        background: currentColor;
        border-radius: 999px;
        opacity: 0.9;
      }

      .profile-showcase-visibility-symbol-public::after {
        content: "";
        position: absolute;
        top: 2px;
        bottom: 2px;
        left: 50%;
        width: 1.6px;
        transform: translateX(-50%);
        background: currentColor;
        border-radius: 999px;
        opacity: 0.9;
      }

      .profile-showcase-visibility-symbol-friends::before {
        content: "";
        position: absolute;
        width: 8px;
        height: 8px;
        border: 1.8px solid currentColor;
        border-radius: 999px;
        left: 2px;
        top: 2px;
        box-shadow: 8px 0 0 -1.8px #e9d5ff, 8px 0 0 0 currentColor;
      }

      .profile-showcase-visibility-symbol-friends::after {
        content: "";
        position: absolute;
        left: 1px;
        right: 1px;
        bottom: 2px;
        height: 8px;
        border: 1.8px solid currentColor;
        border-top-left-radius: 999px;
        border-top-right-radius: 999px;
        border-bottom: 0;
        opacity: 0.95;
      }

      .profile-showcase-visibility-symbol-private::before {
        content: "";
        position: absolute;
        left: 5px;
        right: 5px;
        top: 1px;
        height: 10px;
        border: 1.8px solid currentColor;
        border-bottom: 0;
        border-radius: 999px 999px 0 0;
      }

      .profile-showcase-visibility-symbol-private::after {
        content: "";
        position: absolute;
        left: 3px;
        right: 3px;
        bottom: 2px;
        height: 11px;
        border: 1.8px solid currentColor;
        border-radius: 5px;
        background:
          radial-gradient(circle at 50% 44%, currentColor 0 1.5px, transparent 1.6px),
          linear-gradient(currentColor, currentColor) 50% 62% / 1.6px 4px no-repeat;
      }

      .profile-showcase-modal-overlay [aria-pressed="true"] .profile-showcase-visibility-symbol {
        color: #ffffff;
        filter: drop-shadow(0 0 8px rgba(216,180,254,0.34));
      }


      .profile-showcase-modal-header {
        position: relative !important;
        top: auto !important;
        background: transparent !important;
      }

      .profile-mobile-first-polish {
        --pp-line: rgba(255,255,255,0.085);
        --pp-line-strong: rgba(255,255,255,0.14);
        --pp-surface: rgba(18,20,25,0.92);
        --pp-surface-soft: rgba(255,255,255,0.045);
        --pp-purple: #a855f7;
      }



      .profile-batch2-flow-polish .profile-stats-bar,
      .profile-batch2-flow-polish .profile-stories-row,
      .profile-batch2-flow-polish .profile-tabs-shell,
      .profile-batch2-flow-polish .profile-content-card {
        scroll-margin-top: 84px;
      }

      .profile-batch2-flow-polish .profile-stats-bar {
        background: linear-gradient(180deg, rgba(255,255,255,0.040), rgba(255,255,255,0.022)) !important;
        border-color: rgba(255,255,255,0.075) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.035) !important;
      }

      .profile-batch2-flow-polish .profile-stats-bar strong {
        letter-spacing: -0.035em;
      }

      .profile-batch2-flow-polish .profile-stories-row {
        scrollbar-width: none;
        scroll-snap-type: x proximity;
        -webkit-overflow-scrolling: touch;
      }

      .profile-batch2-flow-polish .profile-stories-row::-webkit-scrollbar {
        display: none;
      }

      .profile-batch2-flow-polish .profile-stories-row button {
        scroll-snap-align: start;
      }

      .profile-batch2-flow-polish .profile-stories-row button:hover .profile-story-circle {
        transform: translateY(-1px);
        border-color: rgba(216,180,254,0.72) !important;
        box-shadow: 0 0 24px rgba(168,85,247,0.22) !important;
      }

      .profile-batch2-flow-polish .profile-story-circle {
        transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
      }

      .profile-batch2-flow-polish .profile-tabs-shell {
        position: relative;
        z-index: 12;
      }

      .profile-batch2-flow-polish .profile-tabs-desktop {
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }

      .profile-batch2-flow-polish .profile-tabs-desktop::-webkit-scrollbar {
        display: none;
      }

      .profile-batch2-flow-polish .profile-tabs-desktop button {
        position: relative;
      }

      .profile-batch2-flow-polish .profile-tabs-desktop button[aria-pressed="true"]::after {
        content: "";
        position: absolute;
        left: 16px;
        right: 16px;
        bottom: 4px;
        height: 2px;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(168,85,247,0), rgba(168,85,247,0.95), rgba(34,211,238,0.70), rgba(168,85,247,0));
        pointer-events: none;
      }

      .profile-batch2-flow-polish .profile-content-card {
        animation: profileSectionSettle 180ms ease-out;
      }

      .profile-batch2-flow-polish .profile-feed-section-card {
        margin-top: 0;
      }

      .profile-batch2-flow-polish .profile-feed-card {
        transform-origin: center top;
      }

      @keyframes profileSectionSettle {
        from {
          opacity: 0.92;
          transform: translateY(3px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (min-width: 721px) {
        .profile-batch2-flow-polish .profile-tabs-shell {
          padding-top: 2px !important;
          padding-bottom: 16px !important;
        }

        .profile-batch2-flow-polish .profile-tabs-desktop {
          gap: 8px !important;
        }

        .profile-batch2-flow-polish .profile-content-card + .profile-content-card {
          margin-top: 2px;
        }
      }

      @media (max-width: 720px) {
        .profile-batch2-flow-polish .profile-stats-bar,
        .profile-batch2-flow-polish .profile-stories-row,
        .profile-batch2-flow-polish .profile-tabs-shell,
        .profile-batch2-flow-polish .profile-content-card {
          scroll-margin-top: 58px;
        }

        .profile-batch2-flow-polish .profile-stats-bar strong {
          font-size: 18px !important;
        }

        .profile-batch2-flow-polish .profile-stats-bar span {
          font-size: 10px !important;
          letter-spacing: 0.035em !important;
        }

        .profile-batch2-flow-polish .profile-stories-row {
          padding-top: 12px !important;
          padding-bottom: 14px !important;
        }

        .profile-batch2-flow-polish .profile-stories-row button {
          min-width: 70px !important;
        }

        .profile-batch2-flow-polish .profile-story-circle {
          width: 58px !important;
          height: 58px !important;
          border-radius: 18px !important;
          border-width: 1px !important;
        }

        .profile-batch2-flow-polish .profile-tabs-shell {
          box-shadow: 0 10px 26px rgba(0,0,0,0.18) !important;
        }

        .profile-batch2-flow-polish .profile-tabs-desktop {
          gap: 18px !important;
          scroll-snap-type: x proximity;
        }

        .profile-batch2-flow-polish .profile-tabs-desktop button {
          scroll-snap-align: center;
          min-height: 42px !important;
        }

        .profile-batch2-flow-polish .profile-tabs-desktop button[aria-pressed="true"]::after {
          left: 10px;
          right: 10px;
          bottom: 5px;
        }

        .profile-batch2-flow-polish .profile-content-card {
          padding-top: 15px !important;
          padding-bottom: 15px !important;
        }

        .profile-batch2-flow-polish .profile-feed-section-card > div:first-child {
          gap: 12px !important;
        }

        .profile-batch2-flow-polish .profile-feed-section-card > div:first-child > div:last-child {
          width: 100% !important;
          justify-content: flex-start !important;
        }
      }

      .profile-data-ready .profile-hero-content,
      .profile-data-ready .profile-mobile-header-real,
      .profile-data-ready .profile-stats-bar,
      .profile-data-ready .profile-stories-row,
      .profile-data-ready .profile-tabs-shell,
      .profile-data-ready .profile-content-card {
        opacity: 1;
        transform: translateY(0);
        transition: opacity 160ms ease, transform 160ms ease;
      }

      .profile-data-waiting .profile-hero-info,
      .profile-data-waiting .profile-mobile-identity-real,
      .profile-data-waiting .profile-mobile-actions-real,
      .profile-data-waiting .profile-mobile-bio-real,
      .profile-data-waiting .profile-mobile-meta-real,
      .profile-data-waiting .profile-stats-bar,
      .profile-data-waiting .profile-stories-row,
      .profile-data-waiting .profile-tabs-shell,
      .profile-data-waiting .profile-content-card {
        opacity: 0;
        transform: translateY(4px);
        pointer-events: none;
      }

      .profile-data-waiting .profile-avatar-wrap,
      .profile-data-waiting .profile-mobile-avatar-shell-real {
        opacity: 0.58;
        filter: saturate(0.88);
      }

      .profile-data-waiting .profile-avatar-wrap::before,
      .profile-data-waiting .profile-mobile-avatar-shell-real::before {
        content: "";
        position: absolute;
        inset: 10px;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(168,85,247,0.10));
        border: 1px solid rgba(255,255,255,0.08);
        z-index: 1;
      }

      .profile-mobile-inline-more {
        display: none !important;
      }

      .profile-mobile-meta-action-row {
        grid-template-columns: minmax(0, 1fr) !important;
      }

      .profile-polish-surface button {
        transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background 140ms ease;
      }

      .profile-polish-surface button:not(:disabled):hover {
        transform: translateY(-1px);
        filter: brightness(1.06);
      }

      .profile-polish-surface button:not(:disabled):active {
        transform: scale(0.985);
      }

      .profile-polish-surface a {
        transition: transform 140ms ease, filter 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
      }

      .profile-avatar-wrap,
      .profile-mobile-avatar-shell-real {
        isolation: isolate;
      }

      .profile-avatar-wrap img,
      .profile-avatar-wrap > div,
      .profile-mobile-avatar-image-real,
      .profile-mobile-avatar-fallback-real {
        position: relative;
        z-index: 1;
      }

      .profile-avatar-online-ring {
        background: linear-gradient(135deg, rgba(168,85,247,1), rgba(34,211,238,0.96), rgba(124,58,237,0.92)) !important;
        box-shadow:
          0 0 0 1px rgba(216,180,254,0.22),
          0 0 24px rgba(168,85,247,0.38),
          0 0 44px rgba(34,211,238,0.18) !important;
      }

      .profile-avatar-online-ring::after {
        content: "";
        position: absolute;
        inset: -7px;
        border-radius: 999px;
        border: 2px solid rgba(34,211,238,0.42);
        box-shadow:
          0 0 18px rgba(168,85,247,0.38),
          0 0 34px rgba(34,211,238,0.20);
        pointer-events: none;
        z-index: 0;
        animation: profileAvatarOnlineGlow 2.8s ease-in-out infinite;
      }

      .profile-avatar-offline-ring {
        background: linear-gradient(135deg, rgba(168,85,247,0.72), rgba(59,130,246,0.52), rgba(236,72,153,0.42)) !important;
        box-shadow:
          0 0 0 1px rgba(255,255,255,0.08),
          0 0 18px rgba(168,85,247,0.18) !important;
      }

      .profile-avatar-online-ring button,
      .profile-avatar-offline-ring button {
        position: absolute;
        z-index: 3;
      }

      .profile-avatar-edit-button {
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      @media (max-width: 720px) {
        .profile-mobile-first-polish .profile-avatar-edit-button {
          right: -12px !important;
          bottom: 4px !important;
          width: 34px !important;
          height: 34px !important;
          border-radius: 13px !important;
          font-size: 14px !important;
        }
      }

      @keyframes profileAvatarOnlineGlow {
        0%, 100% {
          opacity: 0.55;
          transform: scale(0.985);
        }
        50% {
          opacity: 1;
          transform: scale(1.025);
        }
      }

      @media (max-width: 720px) {
        .profile-showcases-panel {
          margin-left: 0 !important;
          margin-right: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          border-radius: 0 !important;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
        }

        .profile-showcases-row {
          min-height: 76px !important;
          gap: 12px !important;
          padding: 0 14px 4px !important;
          padding-bottom: 4px !important;
          overflow-y: visible !important;
          scroll-snap-type: x proximity;
        }

        .profile-showcases-row > button,
        .profile-showcases-row > div {
          scroll-snap-align: start;
        }

        .profile-showcase-modal-overlay {
          align-items: flex-end !important;
          padding: 0 0 92px !important;
          background: rgba(0,0,0,0.70) !important;
        }

        .profile-showcase-modal-overlay > div {
          width: 100% !important;
          max-width: none !important;
          border-radius: 22px 22px 0 0 !important;
          max-height: calc(100vh - 118px) !important;
          overflow-y: auto !important;
          padding: 12px 12px 18px !important;
          overscroll-behavior: contain !important;
        }

        .profile-showcase-modal-overlay [style*="margin-bottom: 14px"] {
          margin-bottom: 10px !important;
        }

        .profile-showcase-modal-overlay [style*="font-size: 22px"] {
          font-size: 18px !important;
          line-height: 1.08 !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax(0, 1.1fr)"] {
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(2"] {
          grid-template-columns: 1fr !important;
          gap: 7px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: 38px"] {
          grid-template-columns: 34px minmax(0, 1fr) !important;
          padding: 8px !important;
        }

        .profile-showcase-modal-overlay [style*="width: 36px"] {
          width: 32px !important;
          height: 32px !important;
          border-radius: 11px !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 270px"],
        .profile-showcase-modal-overlay [style*="min-height: 300px"] {
          min-height: 178px !important;
          border-radius: 18px !important;
        }

        .profile-showcase-modal-overlay [style*="font-size: 28px"] {
          font-size: 20px !important;
          line-height: 1.06 !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
          gap: 7px !important;
        }

        .profile-showcase-modal-overlay input {
          min-height: 40px !important;
          font-size: 14px !important;
        }

        .profile-showcase-modal-overlay button {
          min-height: 38px !important;
        }
      }

      @media (max-width: 720px) {
        .profile-showcase-modal-overlay {
          z-index: 2147482500 !important;
          align-items: stretch !important;
          justify-content: stretch !important;
          padding: 0 !important;
          background: rgba(0,0,0,0.74) !important;
        }

        .profile-showcase-modal-overlay > div {
          position: fixed !important;
          left: 8px !important;
          right: 8px !important;
          top: 8px !important;
          bottom: 86px !important;
          width: auto !important;
          max-width: none !important;
          max-height: none !important;
          height: auto !important;
          border-radius: 18px !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 10px 10px 12px !important;
        }

        .profile-showcase-modal-overlay input,
        .profile-showcase-modal-overlay button,
        .profile-showcase-modal-overlay select {
          font-size: 13px !important;
        }

        .profile-showcase-font-select {
          display: block !important;
          min-height: 38px !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }

        .profile-showcase-modal-overlay [style*="min-height: 270px"],
        .profile-showcase-modal-overlay [style*="min-height: 300px"] {
          min-height: 156px !important;
        }

        .profile-showcase-modal-overlay [style*="font-size: 28px"] {
          font-size: 20px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: 34px"] {
          grid-template-columns: 30px minmax(0, 1fr) !important;
          padding: 7px !important;
          gap: 7px !important;
        }

        .profile-showcase-modal-overlay [style*="width: 32px"] {
          width: 28px !important;
          height: 28px !important;
          border-radius: 10px !important;
        }

        .profile-showcase-modal-overlay [style*="margin-top: 12px"] {
          margin-top: 8px !important;
        }

        .profile-showcase-modal-overlay [style*="margin-top: 14px"] {
          margin-top: 9px !important;
        }

        .profile-showcase-modal-overlay [style*="gap: 10px"] {
          gap: 7px !important;
        }

        .profile-showcase-modal-overlay [style*="padding: 9px 10px"] {
          padding: 7px 9px !important;
        }

        .profile-showcase-modal-overlay [style*="padding: 12px 13px"] {
          padding: 9px 10px !important;
        }

        .profile-showcase-modal-overlay [style*="bottom: 0"] {
          bottom: -1px !important;
          padding-bottom: 2px !important;
        }
      }

      @media (min-width: 721px) {
        .profile-showcase-font-select {
          display: block !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }
      }

      .profile-mobile-first-polish small {
        display: block;
        color: #7c8597;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.35;
        margin-top: 2px;
      }

      .profile-mobile-first-polish strong {
        font-weight: 900;
      }

      .profile-desktop-action-menu-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      @media (min-width: 721px) {
        .profile-center-column,
        .profile-stream-stack,
        .profile-hero-shell,
        .profile-hero-content,
        .profile-hero-info,
        .profile-hero-topline,
        .profile-hero-actions {
          overflow: visible !important;
        }

        .profile-hero-shell {
          position: relative !important;
          z-index: 2147480000 !important;
        }

        .profile-stats-bar,
        .profile-showcases-panel,
        .profile-tabs-shell,
        .profile-content-card {
          position: relative;
          z-index: 0;
        }

        .profile-desktop-action-menu-wrap {
          position: relative !important;
          z-index: 2147482000 !important;
        }

        .profile-desktop-action-menu {
          top: calc(100% + 10px) !important;
          bottom: auto !important;
          max-height: min(300px, calc(100vh - 210px)) !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          z-index: 2147483000 !important;
        }
      }

      .profile-desktop-action-menu {
        position: absolute;
        right: 0;
        top: calc(100% + 10px) !important;
        bottom: auto !important;
        z-index: 2147483000 !important;
        width: min(280px, calc(100vw - 48px)) !important;
        max-height: min(300px, calc(100vh - 210px)) !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        scrollbar-width: thin;
        background: #11131a !important;
        background-color: #11131a !important;
        border: 1px solid rgba(255,255,255,0.16) !important;
        opacity: 1 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        isolation: isolate !important;
        mix-blend-mode: normal !important;
        box-shadow:
          0 30px 90px rgba(0,0,0,0.82),
          0 0 0 1px rgba(255,255,255,0.08),
          0 0 34px rgba(168,85,247,0.20) !important;
      }

      .profile-desktop-action-menu::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        background: #11131a;
        pointer-events: none;
      }

      .profile-desktop-action-menu > * {
        position: relative;
        z-index: 1;
      }

      .profile-desktop-action-menu::-webkit-scrollbar {
        width: 8px;
      }

      .profile-desktop-action-menu::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.035);
        border-radius: 999px;
      }

      .profile-desktop-action-menu::-webkit-scrollbar-thumb {
        background: rgba(168,85,247,0.45);
        border-radius: 999px;
      }

      .profile-desktop-action-menu-fixed {
        position: fixed !important;
        z-index: 2147483000 !important;
        display: block !important;
        background: #11131a !important;
        background-color: #11131a !important;
        opacity: 1 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        isolation: isolate !important;
        mix-blend-mode: normal !important;
        overflow-y: scroll !important;
        overscroll-behavior: contain !important;
        scrollbar-width: thin !important;
        scrollbar-gutter: stable !important;
        pointer-events: auto !important;
      }

      .profile-desktop-action-menu-fixed::-webkit-scrollbar {
        width: 8px;
      }

      .profile-desktop-action-menu-fixed::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.035);
        border-radius: 999px;
      }

      .profile-desktop-action-menu-fixed::-webkit-scrollbar-thumb {
        background: rgba(168,85,247,0.5);
        border-radius: 999px;
      }

      @media (max-width: 720px) {
        .profile-desktop-action-menu-fixed {
          display: none !important;
        }
      }

      .profile-desktop-action-menu button,
      .profile-desktop-action-menu a {
        background-color: #151821 !important;
      }

      .profile-desktop-action-menu button:disabled,
      .profile-desktop-action-menu [aria-disabled="true"] {
        background-color: #151821 !important;
        opacity: 0.55 !important;
      }

      @media (min-width: 721px) {
        .profile-desktop-action-menu button,
        .profile-desktop-action-menu a {
          min-height: 42px !important;
        }
      }

      .profile-mobile-action-overlay {
        touch-action: auto;
      }

      .profile-mobile-action-overlay > div {
        touch-action: pan-y;
      }

      @media (min-width: 721px) {
        .profile-mobile-action-overlay {
          display: none !important;
        }
      }

      @media (max-width: 720px) {
        .profile-desktop-action-menu-wrap {
          display: contents;
        }

        .profile-desktop-action-menu {
          display: none !important;
        }
      }


      .profile-composer-smooth {
        position: relative;
        overflow: hidden;
      }

      .profile-composer-smooth::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(circle at 18% 0%, rgba(168,85,247,0.10), transparent 34%),
          radial-gradient(circle at 100% 12%, rgba(34,211,238,0.055), transparent 30%);
      }

      .profile-composer-smooth > * {
        position: relative;
        z-index: 1;
      }

      .profile-composer-textarea {
        font-family: inherit;
      }

      .profile-composer-textarea::placeholder {
        color: #6b7280;
      }

      .profile-feed-stack {
        gap: 14px !important;
      }

      .profile-feed-card {
        overflow: hidden;
      }

      .profile-feed-card p {
        font-size: 15px;
        letter-spacing: -0.01em;
      }

      .profile-post-image {
        transition: transform 220ms ease, filter 220ms ease;
      }

      .profile-feed-card:hover .profile-post-image {
        filter: brightness(1.03);
      }

      .profile-shared-reel-card {
        transition: border-color 160ms ease, background 160ms ease;
      }

      @media (min-width: 721px) and (max-width: 1180px) {
        .profile-page-shell {
          padding-left: 16px !important;
          padding-right: 16px !important;
        }

        .profile-layout-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .profile-center-column {
          max-width: 920px !important;
          margin: 0 auto !important;
          width: 100% !important;
        }

        .profile-feed-stack {
          gap: 16px !important;
        }
      }

      @media (max-width: 980px) {
        .profile-hero-shell {
          border-radius: 20px !important;
        }

        .profile-hero-content {
          align-items: flex-start !important;
          justify-content: flex-start !important;
          text-align: left !important;
          gap: 14px !important;
          padding-left: 18px !important;
          padding-right: 18px !important;
        }

        .profile-hero-info {
          min-width: 0 !important;
          width: 100% !important;
          padding-bottom: auto !important;
        }

        .profile-hero-topline {
          justify-content: flex-start !important;
          gap: 14px !important;
        }

        .profile-hero-actions {
          width: 100% !important;
          justify-content: flex-start !important;
          gap: 10px !important;
        }

        .profile-hero-actions a,
        .profile-hero-actions button {
          min-height: 42px !important;
          border-radius: 13px !important;
        }
      }

      @media (max-width: 720px) {
        .profile-page-shell {
          max-width: none !important;
          padding-top: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          padding-bottom: 132px !important;
        }

        .profile-layout-grid {
          gap: 0 !important;
        }

        .profile-center-column,
        .profile-stream-stack {
          max-width: none !important;
          width: 100% !important;
        }

        .profile-stream-stack {
          gap: 0 !important;
        }

        .profile-polish-surface select[aria-label="Choose profile section"] {
          display: none !important;
        }

        .profile-polish-surface .profile-tabs-desktop {
          display: flex !important;
        }

        .profile-hero-shell {
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          background: linear-gradient(180deg, rgba(19,22,29,0.96), rgba(11,13,18,0.98)) !important;
          box-shadow: none !important;
        }

        .profile-cover-zone {
          height: 174px !important;
          overflow: hidden !important;
        }

        .profile-hero-content {
          display: block !important;
          margin-top: -54px !important;
          padding: 0 18px 18px !important;
          text-align: left !important;
        }

        .profile-avatar-wrap {
          width: 112px !important;
          height: 112px !important;
          padding: 4px !important;
          margin: 0 0 14px 0 !important;
          box-shadow: 0 0 22px rgba(168,85,247,0.28) !important;
        }

        .profile-avatar-wrap img,
        .profile-avatar-wrap > div {
          border-width: 3px !important;
        }

        .profile-hero-info {
          width: 100% !important;
          min-width: 0 !important;
          padding: 0 !important;
        }

        .profile-hero-topline {
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 12px !important;
          margin-bottom: auto !important;
        }

        .profile-hero-topline h1 {
          font-size: clamp(30px, 8.2vw, 42px) !important;
          line-height: 1.05 !important;
          letter-spacing: -0.045em !important;
          max-width: 100% !important;
        }

        .profile-hero-topline p {
          font-size: 14px !important;
          line-height: 1.35 !important;
        }

        .profile-hero-actions {
          width: 100% !important;
          max-width: none !important;
          margin-top: 4px !important;
          gap: 10px !important;
        }

        .profile-public-actions {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .profile-owner-actions {
          display: flex !important;
          justify-content: flex-start !important;
          align-items: center !important;
        }

        .profile-public-actions button,
        .profile-public-actions a {
          width: 100% !important;
          min-height: 44px !important;
          justify-content: center !important;
          box-shadow: none !important;
          border-radius: 12px !important;
        }

        .profile-owner-actions button[aria-label="More profile actions"] {
          width: 46px !important;
          min-width: 46px !important;
          height: 44px !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          border-radius: 12px !important;
          box-shadow: none !important;
        }

        .profile-hero-info > p {
          width: 100% !important;
          max-width: none !important;
          margin-top: 14px !important;
          font-size: 16px !important;
          line-height: 1.58 !important;
          color: #e6e8ee !important;
        }

        .profile-meta-row {
          margin-top: 14px !important;
          display: grid !important;
          gap: 10px !important;
          font-size: 14px !important;
          line-height: 1.35 !important;
        }

        .profile-meta-row a {
          overflow-wrap: anywhere !important;
        }


        .profile-feed-section-card {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        .profile-feed-section-card > div:first-child {
          padding-left: 14px !important;
          padding-right: 14px !important;
          margin-bottom: 12px !important;
        }

        .profile-composer-smooth {
          padding: 16px 14px !important;
        }

        .profile-composer-textarea {
          min-height: 108px !important;
          border-radius: 14px !important;
          background: #0f1116 !important;
          border-color: rgba(255,255,255,0.08) !important;
        }

        .profile-composer-media-box {
          border-radius: 16px !important;
          background: rgba(255,255,255,0.025) !important;
        }

        .profile-composer-smooth textarea {
          font-size: 16px !important;
        }

        .profile-feed-stack {
          gap: 8px !important;
        }

        .profile-feed-card {
          margin-left: 0 !important;
          margin-right: 0 !important;
          border-top: 1px solid rgba(255,255,255,0.07) !important;
          border-bottom: 1px solid rgba(255,255,255,0.045) !important;
        }

        .profile-post-image {
          border-radius: 0 !important;
          margin-left: -14px !important;
          margin-right: -14px !important;
          width: calc(100% + 28px) !important;
          max-width: none !important;
          max-height: none !important;
        }

        .profile-shared-reel-card {
          border-radius: 0 !important;
          margin-left: -14px !important;
          margin-right: -14px !important;
          border-left: 0 !important;
          border-right: 0 !important;
        }

        .profile-stats-bar {
          margin: 0 !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          background: #111318 !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 0 !important;
          padding: 14px 6px !important;
          box-shadow: none !important;
        }

        .profile-stats-bar > div:nth-child(even) {
          display: none !important;
        }

        .profile-stories-row {
          margin: 0 !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          background: #111318 !important;
          padding: 14px 14px 18px !important;
          gap: 14px !important;
          border-top: 1px solid rgba(255,255,255,0.07) !important;
          border-bottom: 1px solid rgba(255,255,255,0.07) !important;
        }

        .profile-story-circle {
          border-radius: 16px !important;
          box-shadow: none !important;
        }

        .profile-tabs-shell {
          position: static !important;
          top: 64px !important;
          z-index: 20 !important;
          background: rgba(15,17,22,0.98) !important;
          backdrop-filter: blur(14px) !important;
          -webkit-backdrop-filter: blur(14px) !important;
          border-top: 1px solid rgba(255,255,255,0.065) !important;
          border-bottom: 1px solid rgba(255,255,255,0.065) !important;
          padding: 0 !important;
        }

        .profile-tabs-desktop {
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          padding: 8px 14px !important;
          gap: 20px !important;
          overflow-x: auto !important;
          scrollbar-width: none !important;
        }

        .profile-tabs-desktop::-webkit-scrollbar {
          display: none !important;
        }

        .profile-tabs-desktop button {
          min-width: auto !important;
          border-radius: 10px !important;
          border-width: 0 0 2px 0 !important;
          border-style: solid !important;
          border-color: transparent !important;
          background: transparent !important;
          box-shadow: none !important;
          color: #9ca3af !important;
          padding: 11px 0 !important;
          font-size: 15px !important;
        }

        .profile-tabs-desktop button[aria-pressed="true"] {
          color: #ffffff !important;
          border-bottom-color: #a855f7 !important;
          background: rgba(168,85,247,0.08) !important;
          padding-left: 10px !important;
          padding-right: 10px !important;
        }

        .profile-content-card {
          margin: 0 !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          border-top: 1px solid rgba(255,255,255,0.075) !important;
          border-bottom: 1px solid rgba(255,255,255,0.045) !important;
          box-shadow: none !important;
          background: #111318 !important;
          padding: 16px 14px !important;
        }

        .profile-composer-card {
          background: #15171b !important;
        }

        .profile-feed-card {
          margin-left: -14px !important;
          margin-right: -14px !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          box-shadow: none !important;
          padding: 14px !important;
          background: #17191d !important;
        }

        .profile-feed-card img {
          border-radius: 0 !important;
          margin-left: -14px !important;
          width: calc(100% + 28px) !important;
          max-width: none !important;
        }
      }

      @media (max-width: 520px) {
        .profile-cover-zone {
          height: 162px !important;
        }

        .profile-hero-content {
          margin-top: -50px !important;
          padding-left: 16px !important;
          padding-right: 16px !important;
        }

        .profile-avatar-wrap {
          width: 104px !important;
          height: 104px !important;
        }

        .profile-public-actions {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .profile-hero-actions a,
        .profile-hero-actions button {
          min-height: 44px !important;
          font-size: 13px !important;
        }

        .profile-stats-bar {
          padding-top: 15px !important;
          padding-bottom: 15px !important;
        }

        .profile-story-circle,
        .profile-stories-row > div > div {
          width: 66px !important;
          height: 66px !important;
        }
      }

      @media (max-width: 720px) {
        .profile-mobile-first-polish .profile-hero-content {
          flex-wrap: nowrap !important;
        }

        .profile-mobile-first-polish .profile-hero-info {
          display: block !important;
        }

        .profile-mobile-first-polish .profile-desktop-action-menu-wrap {
          display: none !important;
          position: relative !important;
        }

        .profile-mobile-first-polish .profile-owner-actions .profile-desktop-action-menu-wrap {
          width: auto !important;
        }

        .profile-mobile-first-polish .profile-desktop-action-menu {
          display: none !important;
        }

        .profile-mobile-first-polish .profile-tabs-shell {
          margin-bottom: auto !important;
        }
      }


      .profile-mobile-header-real {
        display: none;
      }

      @media (max-width: 720px) {
        .profile-hero-shell {
          overflow: hidden !important;
        }

        .profile-cover-zone {
          height: 170px !important;
        }

        .profile-hero-content {
          display: none !important;
        }

        .profile-mobile-header-real {
          display: block !important;
          position: relative !important;
          margin-top: -54px !important;
          padding: 0 18px 22px !important;
          background: linear-gradient(180deg, rgba(7,9,14,0) 0%, rgba(12,14,20,0.92) 22%, rgba(12,14,20,0.98) 100%) !important;
          text-align: left !important;
        }

        .profile-mobile-avatar-shell-real {
          position: relative !important;
          width: 112px !important;
          height: 112px !important;
          border-radius: 50% !important;
          padding: 4px !important;
          background: linear-gradient(135deg, rgba(168,85,247,0.96), rgba(59,130,246,0.86)) !important;
          box-shadow: 0 0 20px rgba(168,85,247,0.22) !important;
          margin: 0 0 14px !important;
        }

        .profile-mobile-avatar-image-real,
        .profile-mobile-avatar-fallback-real {
          width: 100% !important;
          height: 100% !important;
          border-radius: 50% !important;
          object-fit: cover !important;
          border: 3px solid #07090d !important;
        }

        .profile-mobile-avatar-fallback-real {
          display: grid !important;
          place-items: center !important;
          background: #374151 !important;
          color: #ffffff !important;
          font-size: 34px !important;
          font-weight: 900 !important;
        }

        .profile-mobile-online-dot-real {
          display: none !important;
        }

        .profile-mobile-camera-real {
          position: absolute !important;
          right: -12px !important;
          bottom: 4px !important;
          width: 34px !important;
          height: 34px !important;
          display: grid !important;
          place-items: center !important;
          border-radius: 14px !important;
          border: 1px solid rgba(216,180,254,0.38) !important;
          background: linear-gradient(135deg, rgba(255,255,255,0.16), rgba(168,85,247,0.26)) !important;
          color: #ffffff !important;
          font-size: 16px !important;
          font-weight: 950 !important;
          box-shadow: 0 10px 24px rgba(0,0,0,0.32), 0 0 18px rgba(168,85,247,0.24) !important;
          backdrop-filter: blur(14px) !important;
          -webkit-backdrop-filter: blur(14px) !important;
        }

        .profile-mobile-identity-real {
          width: 100% !important;
        }

        .profile-mobile-identity-real h1 {
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          color: #ffffff !important;
          font-size: clamp(30px, 8.4vw, 40px) !important;
          line-height: 1.05 !important;
          letter-spacing: -0.045em !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .profile-mobile-identity-real h1 span {
          width: 28px !important;
          height: 28px !important;
          flex: 0 0 auto !important;
          display: grid !important;
          place-items: center !important;
          border-radius: 999px !important;
          background: linear-gradient(135deg, #7c3aed, #a855f7) !important;
          color: #ffffff !important;
          font-size: 17px !important;
          line-height: 1 !important;
        }

        .profile-mobile-identity-real p {
          margin: 9px 0 0 !important;
          color: #aeb3c2 !important;
          font-size: 15px !important;
          line-height: 1.35 !important;
          overflow-wrap: anywhere !important;
        }

        .profile-mobile-identity-real p span {
          margin: 0 9px !important;
          color: #6b7280 !important;
        }

        .profile-mobile-actions-real {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
          margin-top: 16px !important;
          width: 100% !important;
        }

        .profile-mobile-actions-real:has(.profile-mobile-owner-more-real) {
          display: flex !important;
          justify-content: flex-start !important;
        }

        .profile-mobile-primary-real,
        .profile-mobile-secondary-real,
        .profile-mobile-owner-more-real {
          min-height: 46px !important;
          border-radius: 13px !important;
          font-size: 15px !important;
          font-weight: 850 !important;
          cursor: pointer !important;
        }

        .profile-mobile-primary-real {
          border: 1px solid rgba(255,255,255,0.10) !important;
          background: linear-gradient(135deg, #9333ea, #7c3aed) !important;
          color: #ffffff !important;
        }

        .profile-mobile-secondary-real {
          border: 1px solid rgba(255,255,255,0.12) !important;
          background: rgba(255,255,255,0.055) !important;
          color: #ffffff !important;
        }

        .profile-mobile-owner-more-real {
          width: 48px !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          background: rgba(255,255,255,0.055) !important;
          color: #ffffff !important;
          letter-spacing: 0.12em !important;
        }

        .profile-mobile-status-real {
          margin-top: 12px !important;
          border: 1px solid rgba(168,85,247,0.22) !important;
          background: rgba(168,85,247,0.12) !important;
          color: #ede9fe !important;
          border-radius: 12px !important;
          padding: 10px 12px !important;
          font-size: 13px !important;
          font-weight: 800 !important;
        }

        .profile-mobile-bio-real {
          margin: 17px 0 0 !important;
          color: #e5e7eb !important;
          font-size: 16px !important;
          line-height: 1.58 !important;
          letter-spacing: -0.01em !important;
          width: 100% !important;
        }

        .profile-mobile-meta-real {
          display: grid !important;
          gap: 10px !important;
          margin-top: 16px !important;
          color: #aeb3c2 !important;
          font-size: 14px !important;
          line-height: 1.35 !important;
        }

        .profile-mobile-meta-real a {
          color: #c084fc !important;
          text-decoration: none !important;
          font-weight: 800 !important;
          overflow-wrap: anywhere !important;
        }

        .profile-stats-bar {
          margin-top: 0 !important;
        }

        .profile-stories-row {
          padding-bottom: 20px !important;
        }

        .profile-tabs-shell {
          top: 0 !important;
        }
      }

      @media (max-width: 420px) {
        .profile-mobile-header-real {
          padding-left: 16px !important;
          padding-right: 16px !important;
        }

        .profile-mobile-avatar-shell-real {
          width: 104px !important;
          height: 104px !important;
        }

        .profile-mobile-identity-real h1 {
          font-size: clamp(28px, 8vw, 36px) !important;
        }
      }


      @media (max-width: 720px) {
        .profile-mobile-header-real {
          display: none !important;
        }

        .profile-mobile-first-polish .profile-hero-shell {
          overflow: hidden !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
        }

        .profile-mobile-first-polish .profile-cover-zone {
          height: 136px !important;
        }

        .profile-mobile-first-polish .profile-hero-content {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 0 !important;
          margin-top: -50px !important;
          padding: 0 18px 18px !important;
          text-align: center !important;
          background: linear-gradient(180deg, rgba(7,9,14,0) 0%, rgba(12,14,20,0.92) 22%, rgba(12,14,20,0.98) 100%) !important;
        }

        .profile-mobile-first-polish .profile-avatar-wrap {
          width: 102px !important;
          height: 102px !important;
          min-width: 102px !important;
          padding: 4px !important;
          margin: 0 0 12px 0 !important;
          box-shadow: 0 0 16px rgba(168,85,247,0.18) !important;
        }

        .profile-mobile-first-polish .profile-avatar-wrap img,
        .profile-mobile-first-polish .profile-avatar-wrap > div {
          border-width: 3px !important;
        }

        .profile-mobile-first-polish .profile-hero-info {
          width: 100% !important;
          min-width: 0 !important;
          display: block !important;
          padding: 0 !important;
        }

        .profile-mobile-first-polish .profile-hero-topline {
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          margin: 0 !important;
          text-align: center !important;
        }

        .profile-mobile-first-polish .profile-hero-topline h1 {
          justify-content: center !important;
          text-align: center !important;
          font-size: clamp(28px, 8.2vw, 38px) !important;
          line-height: 1.06 !important;
          letter-spacing: -0.045em !important;
          max-width: 100% !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .profile-mobile-first-polish .profile-hero-topline p {
          justify-content: center !important;
          text-align: center !important;
          font-size: 14px !important;
          line-height: 1.35 !important;
          max-width: 100% !important;
          overflow-wrap: anywhere !important;
        }

        .profile-mobile-first-polish .profile-hero-actions {
          width: 100% !important;
          max-width: 460px !important;
          margin: 14px auto 0 !important;
          gap: 10px !important;
        }

        .profile-mobile-first-polish .profile-public-actions {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .profile-mobile-first-polish .profile-owner-actions {
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }

        .profile-mobile-first-polish .profile-public-actions button,
        .profile-mobile-first-polish .profile-public-actions a {
          width: 100% !important;
          min-height: 44px !important;
          justify-content: center !important;
          border-radius: 12px !important;
          box-shadow: none !important;
        }

        .profile-mobile-first-polish .profile-owner-actions button[aria-label="More profile actions"] {
          width: 48px !important;
          min-width: 48px !important;
          height: 44px !important;
          border-radius: 12px !important;
          padding: 0 !important;
          box-shadow: none !important;
        }

        .profile-mobile-first-polish .profile-hero-info > p {
          width: 100% !important;
          max-width: 560px !important;
          margin: 14px auto 0 !important;
          text-align: center !important;
          font-size: 15px !important;
          line-height: 1.52 !important;
          color: #e5e7eb !important;
        }

        .profile-mobile-first-polish .profile-meta-row {
          width: 100% !important;
          max-width: 560px !important;
          margin: 14px auto 0 !important;
          display: grid !important;
          justify-items: center !important;
          gap: 9px !important;
          text-align: center !important;
          font-size: 13px !important;
          line-height: 1.35 !important;
        }

        .profile-mobile-first-polish .profile-meta-row a {
          overflow-wrap: anywhere !important;
        }

        .profile-mobile-first-polish .profile-stats-bar {
          margin: 0 !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          background: #111318 !important;
          grid-template-columns: repeat(4, 1fr) !important;
          gap: 0 !important;
          padding: 13px 4px !important;
          box-shadow: none !important;
        }

        .profile-mobile-first-polish .profile-stories-row {
          margin: 0 !important;
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          background: #111318 !important;
          padding: 12px 14px 14px !important;
          gap: 12px !important;
          border-top: 1px solid rgba(255,255,255,0.07) !important;
          border-bottom: 1px solid rgba(255,255,255,0.07) !important;
        }

        .profile-mobile-first-polish .profile-story-circle,
        .profile-mobile-first-polish .profile-stories-row > div > div:first-child {
          width: 58px !important;
          height: 58px !important;
          border-radius: 15px !important;
          box-shadow: none !important;
        }

        .profile-mobile-first-polish .profile-stories-row span,
        .profile-mobile-first-polish .profile-stories-row p {
          font-size: 11px !important;
          line-height: 1.2 !important;
        }

        .profile-mobile-first-polish .profile-tabs-shell {
          top: 0 !important;
          margin-bottom: auto !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop {
          padding: 7px 14px !important;
          gap: 18px !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop button {
          font-size: 14px !important;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
        }

        .profile-page-shell {
          padding-bottom: 150px !important;
        }
      }

      @media (max-width: 420px) {
        .profile-mobile-first-polish .profile-cover-zone {
          height: 128px !important;
        }

        .profile-mobile-first-polish .profile-hero-content {
          margin-top: -46px !important;
          padding-left: 16px !important;
          padding-right: 16px !important;
        }

        .profile-mobile-first-polish .profile-avatar-wrap {
          width: 94px !important;
          height: 94px !important;
          min-width: 94px !important;
        }

        .profile-mobile-first-polish .profile-hero-topline h1 {
          font-size: clamp(27px, 8vw, 34px) !important;
        }

        .profile-mobile-first-polish .profile-public-actions {
          max-width: 100% !important;
        }

        .profile-mobile-first-polish .profile-story-circle,
        .profile-mobile-first-polish .profile-stories-row > div > div:first-child {
          width: 54px !important;
          height: 54px !important;
        }
      }


      @media (max-width: 720px) {
        .profile-mobile-first-polish .profile-hero-content {
          align-items: flex-start !important;
          text-align: left !important;
        }

        .profile-mobile-first-polish .profile-avatar-wrap {
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        .profile-mobile-first-polish .profile-hero-info {
          text-align: left !important;
        }

        .profile-mobile-first-polish .profile-hero-topline {
          align-items: flex-start !important;
          text-align: left !important;
        }

        .profile-mobile-first-polish .profile-hero-topline h1 {
          justify-content: flex-start !important;
          text-align: left !important;
        }

        .profile-mobile-first-polish .profile-hero-topline p {
          justify-content: flex-start !important;
          text-align: left !important;
        }

        .profile-mobile-first-polish .profile-owner-actions {
          display: none !important;
        }

        .profile-mobile-first-polish .profile-public-actions {
          max-width: 440px !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        .profile-mobile-first-polish .profile-hero-info > p {
          text-align: left !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          max-width: none !important;
        }

        .profile-mobile-meta-action-row {
          width: 100% !important;
          max-width: none !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 52px !important;
          align-items: end !important;
          gap: 14px !important;
          margin-top: 14px !important;
        }

        .profile-mobile-first-polish .profile-meta-row {
          margin: 0 !important;
          justify-items: start !important;
          text-align: left !important;
          max-width: none !important;
          width: 100% !important;
          gap: 9px !important;
        }

        .profile-mobile-first-polish .profile-meta-row span,
        .profile-mobile-first-polish .profile-meta-row a {
          text-align: left !important;
          width: auto !important;
        }

        .profile-mobile-inline-more {
          display: grid !important;
          place-items: center !important;
          width: 50px !important;
          height: 46px !important;
          border-radius: 13px !important;
          border: 1px solid rgba(216,180,254,0.24) !important;
          background: linear-gradient(135deg, rgba(255,255,255,0.075), rgba(168,85,247,0.16)) !important;
          color: #ffffff !important;
          font-size: 16px !important;
          font-weight: 900 !important;
          letter-spacing: 0.12em !important;
          cursor: pointer !important;
          align-self: end !important;
          box-shadow: 0 12px 26px rgba(0,0,0,0.26), 0 0 18px rgba(168,85,247,0.12) !important;
          backdrop-filter: blur(14px) !important;
          -webkit-backdrop-filter: blur(14px) !important;
        }

        .profile-mobile-first-polish .profile-mobile-meta-action-row + * {
          margin-top: 0 !important;
        }
      }

      @media (max-width: 420px) {
        .profile-mobile-meta-action-row {
          grid-template-columns: minmax(0, 1fr) 48px !important;
          gap: 10px !important;
        }

        .profile-mobile-inline-more {
          width: 48px !important;
          height: 44px !important;
        }
      }


      @media (max-width: 720px) {
        .profile-mobile-first-polish .profile-stream-stack {
          gap: 0 !important;
          background: #111318 !important;
        }

        .profile-mobile-first-polish .profile-stream-stack > :not([hidden]) ~ :not([hidden]) {
          --tw-space-y-reverse: 0 !important;
          margin-top: 0 !important;
          margin-bottom: auto !important;
        }

        .profile-mobile-first-polish .profile-tabs-shell {
          margin-bottom: auto !important;
          border-bottom: 1px solid rgba(255,255,255,0.07) !important;
        }

        .profile-mobile-first-polish .profile-content-card,
        .profile-mobile-first-polish .profile-composer-card,
        .profile-mobile-first-polish .profile-feed-section-card {
          margin-top: 0 !important;
        }

        .profile-mobile-first-polish .profile-composer-card,
        .profile-mobile-first-polish .profile-feed-section-card {
          border-top: 0 !important;
        }
      }


      @media (max-width: 720px) {
        .profile-mobile-first-polish .profile-tabs-shell {
          background: #111318 !important;
          box-shadow: none !important;
          border-top: 1px solid rgba(255,255,255,0.07) !important;
          border-bottom: 1px solid rgba(255,255,255,0.07) !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop {
          background: #111318 !important;
          box-shadow: none !important;
          padding-bottom: auto !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop button {
          background: transparent !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          border: 0 !important;
          border-bottom: 3px solid transparent !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          margin-bottom: auto !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop button[aria-selected="true"],
        .profile-mobile-first-polish .profile-tabs-desktop button[data-active="true"] {
          background: transparent !important;
          box-shadow: none !important;
          border-bottom-color: #a855f7 !important;
          color: #ffffff !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop button:hover {
          background: transparent !important;
          box-shadow: none !important;
        }

        .profile-mobile-first-polish .profile-tabs-shell::after,
        .profile-mobile-first-polish .profile-tabs-desktop::after,
        .profile-mobile-first-polish .profile-tabs-desktop button::after {
          display: none !important;
          content: none !important;
        }

        .profile-mobile-first-polish .profile-content-card,
        .profile-mobile-first-polish .profile-composer-card,
        .profile-mobile-first-polish .profile-feed-section-card {
          border-top-color: rgba(255,255,255,0.07) !important;
        }
      }


      @media (max-width: 720px) {
    .profile-mobile-action-overlay {
    position: fixed !important;
    inset: 0 0 calc(82px + env(safe-area-inset-bottom)) 0 !important;
    z-index: 2147482400 !important;
    display: flex !important;
    align-items: flex-end !important;
    justify-content: center !important;
    overflow: hidden !important;
    touch-action: auto !important;
  }

  .profile-mobile-action-sheet {
    width: 100% !important;
    max-height: calc(100dvh - 164px) !important;
    overflow: hidden !important;
    display: flex !important;
    flex-direction: column !important;
    overscroll-behavior: contain !important;
    -webkit-overflow-scrolling: touch !important;
    touch-action: pan-y !important;
    transform: translateZ(0) !important;
  }

  .profile-mobile-action-list {
    overflow-y: auto !important;
    overflow-x: hidden !important;
    max-height: min(68dvh, 520px) !important;
    overscroll-behavior: contain !important;
    -webkit-overflow-scrolling: touch !important;
    touch-action: pan-y !important;
    padding-bottom: calc(22px + env(safe-area-inset-bottom)) !important;
  }

  .profile-mobile-action-sheet button {
    min-height: 58px !important;
    touch-action: pan-y !important;
  }
}


      /* Profile feed/post premium polish overrides */
      .profile-feed-card {
        position: relative !important;
      }

      .profile-feed-card::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0) 38%);
        opacity: 0.55;
      }

      .profile-feed-card > * {
        position: relative;
        z-index: 1;
      }

      .profile-feed-card button:hover,
      .profile-shared-reel-card a:hover {
        filter: brightness(1.08);
      }

      @media (max-width: 720px) {
        .profile-mobile-first-polish .profile-feed-section-card {
          padding: 14px !important;
          background: #111318 !important;
        }

        .profile-mobile-first-polish .profile-feed-section-card > div:first-child {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        .profile-mobile-first-polish .profile-feed-card {
          margin-left: 0 !important;
          margin-right: 0 !important;
          border-radius: 18px !important;
          border-left: 1px solid rgba(255,255,255,0.085) !important;
          border-right: 1px solid rgba(255,255,255,0.085) !important;
          border-top: 1px solid rgba(255,255,255,0.095) !important;
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
          box-shadow: 0 10px 24px rgba(0,0,0,0.22) !important;
          background: linear-gradient(180deg, rgba(255,255,255,0.046), rgba(255,255,255,0.024)) !important;
          padding: 14px !important;
        }

        .profile-mobile-first-polish .profile-post-image,
        .profile-mobile-first-polish .profile-feed-card img.profile-post-image {
          border-radius: 15px !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        .profile-mobile-first-polish .profile-shared-reel-card {
          border-radius: 22px !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          border-left: 1px solid rgba(168,85,247,0.22) !important;
          border-right: 1px solid rgba(168,85,247,0.22) !important;
        }
      }




      @media (max-width: 720px) {
        .profile-mobile-first-polish .profile-cover-zone {
          height: 128px !important;
        }

        .profile-mobile-first-polish .profile-hero-content {
          margin-top: -46px !important;
          padding: 0 16px 16px !important;
        }

        .profile-mobile-first-polish .profile-avatar-wrap {
          width: 98px !important;
          height: 98px !important;
          min-width: 98px !important;
          margin: 0 0 10px 0 !important;
        }

        .profile-mobile-first-polish .profile-hero-topline {
          gap: 8px !important;
        }

        .profile-mobile-first-polish .profile-hero-topline h1 {
          line-height: 1.04 !important;
        }

        .profile-mobile-first-polish .profile-hero-info > p {
          margin-top: 10px !important;
          line-height: 1.45 !important;
        }

        .profile-mobile-first-polish .profile-meta-row {
          margin-top: 11px !important;
          gap: 7px !important;
        }

        .profile-mobile-first-polish .profile-hero-actions {
          margin-top: 11px !important;
        }

        .profile-mobile-first-polish .profile-stats-bar {
          padding-top: 12px !important;
          padding-bottom: 12px !important;
        }

        .profile-mobile-first-polish .profile-stories-row {
          padding-top: 10px !important;
          padding-bottom: 12px !important;
        }
      }

      @media (max-width: 420px) {
        .profile-mobile-first-polish .profile-avatar-edit-button,
        .profile-mobile-first-polish .profile-mobile-camera-real {
          right: -11px !important;
          bottom: 3px !important;
          width: 33px !important;
          height: 33px !important;
        }
      }




      /* Profile polish batch 1: premium header, avatar ring, cleaner cover/identity flow */
      .profile-polish-surface .profile-cover-zone {
        overflow: hidden !important;
      }

      .profile-polish-surface .profile-hero-content {
        align-items: flex-start !important;
      }

      .profile-polish-surface .profile-hero-info {
        padding-top: clamp(70px, 7.2vw, 96px) !important;
      }

      .profile-polish-surface .profile-identity-block {
        min-width: 0 !important;
        max-width: 100% !important;
      }

      .profile-polish-surface .profile-hero-topline h1 {
        text-shadow: 0 10px 28px rgba(0,0,0,0.26) !important;
      }

      .profile-polish-surface .profile-avatar-wrap,
      .profile-polish-surface .profile-mobile-avatar-shell-real {
        position: relative !important;
        isolation: isolate !important;
        overflow: visible !important;
      }

      .profile-polish-surface .profile-avatar-wrap img,
      .profile-polish-surface .profile-avatar-wrap > div,
      .profile-polish-surface .profile-mobile-avatar-image-real,
      .profile-polish-surface .profile-mobile-avatar-fallback-real {
        position: relative !important;
        z-index: 2 !important;
      }

      .profile-polish-surface .profile-avatar-online-ring {
        background: linear-gradient(135deg, rgba(168,85,247,0.95), rgba(34,211,238,0.82), rgba(124,58,237,0.90)) !important;
        box-shadow:
          0 0 0 1px rgba(216,180,254,0.20),
          0 0 18px rgba(168,85,247,0.30),
          0 0 32px rgba(34,211,238,0.14) !important;
      }

      .profile-polish-surface .profile-avatar-online-ring::after {
        content: "" !important;
        position: absolute !important;
        inset: -6px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(34,211,238,0.36) !important;
        box-shadow:
          0 0 18px rgba(168,85,247,0.30),
          0 0 30px rgba(34,211,238,0.14) !important;
        pointer-events: none !important;
        z-index: 0 !important;
      }

      .profile-polish-surface .profile-avatar-offline-ring {
        background: linear-gradient(135deg, rgba(168,85,247,0.62), rgba(59,130,246,0.42), rgba(15,23,42,0.72)) !important;
        box-shadow:
          0 0 0 1px rgba(255,255,255,0.08),
          0 0 16px rgba(168,85,247,0.14) !important;
      }

      .profile-polish-surface [class*="online-dot"],
      .profile-polish-surface [class*="OnlineDot"],
      .profile-polish-surface .profile-mobile-online-dot-real {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .profile-polish-surface .profile-avatar-edit-button,
      .profile-polish-surface .profile-mobile-camera-real {
        z-index: 5 !important;
      }

      @media (min-width: 721px) {
        .profile-polish-surface .profile-mobile-header-real {
          display: none !important;
        }

        .profile-polish-surface .profile-hero-content {
          min-height: 188px !important;
        }

        .profile-polish-surface .profile-hero-actions {
          padding-top: 4px !important;
        }
      }

      @media (max-width: 980px) and (min-width: 721px) {
        .profile-polish-surface .profile-hero-info {
          padding-top: clamp(74px, 8vw, 92px) !important;
        }
      }

      @media (max-width: 720px) {
        .profile-polish-surface .profile-mobile-header-real {
          display: none !important;
        }

        .profile-polish-surface .profile-cover-zone {
          height: 132px !important;
        }

        .profile-polish-surface .profile-hero-content {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          margin-top: -48px !important;
          padding: 0 16px 16px !important;
          gap: 0 !important;
          text-align: left !important;
          background: linear-gradient(180deg, rgba(7,9,14,0) 0%, rgba(12,14,20,0.92) 24%, rgba(12,14,20,0.98) 100%) !important;
        }

        .profile-polish-surface .profile-avatar-wrap {
          width: 100px !important;
          height: 100px !important;
          min-width: 100px !important;
          padding: 4px !important;
          margin: 0 0 12px 0 !important;
          box-shadow: 0 0 17px rgba(168,85,247,0.18) !important;
        }

        .profile-polish-surface .profile-avatar-online-ring::after {
          inset: -5px !important;
          border-width: 1px !important;
        }

        .profile-polish-surface .profile-hero-info {
          width: 100% !important;
          min-width: 0 !important;
          padding: 0 !important;
          text-align: left !important;
        }

        .profile-polish-surface .profile-hero-topline {
          width: 100% !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          text-align: left !important;
          gap: 9px !important;
          margin: 0 !important;
        }

        .profile-polish-surface .profile-hero-topline h1 {
          justify-content: flex-start !important;
          text-align: left !important;
          font-size: clamp(27px, 7.8vw, 36px) !important;
          line-height: 1.05 !important;
          letter-spacing: -0.045em !important;
          max-width: 100% !important;
        }

        .profile-polish-surface .profile-hero-topline p {
          justify-content: flex-start !important;
          text-align: left !important;
          font-size: 13px !important;
          line-height: 1.38 !important;
          margin-top: 5px !important;
        }

        .profile-polish-surface .profile-avatar-edit-button,
        .profile-polish-surface .profile-mobile-camera-real {
          right: -11px !important;
          bottom: 3px !important;
          width: 33px !important;
          height: 33px !important;
          border-radius: 13px !important;
          font-size: 14px !important;
        }

        .profile-polish-surface .profile-hero-info > p {
          margin-top: 10px !important;
          font-size: 15px !important;
          line-height: 1.48 !important;
          color: #e6e8ee !important;
        }

        .profile-polish-surface .profile-meta-row {
          gap: 8px !important;
        }
      }

      @media (max-width: 420px) {
        .profile-polish-surface .profile-cover-zone {
          height: 126px !important;
        }

        .profile-polish-surface .profile-hero-content {
          margin-top: -45px !important;
        }

        .profile-polish-surface .profile-avatar-wrap {
          width: 94px !important;
          height: 94px !important;
          min-width: 94px !important;
        }
      }

      /* Mobile profile tabs touch polish: cleaner, smoother, no big spacing change */
      @media (max-width: 720px) {
        .profile-mobile-first-polish .profile-tabs-shell {
          padding: 0 !important;
          background: rgba(17,19,24,0.98) !important;
          border-top: 1px solid rgba(255,255,255,0.07) !important;
          border-bottom: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: 0 8px 18px rgba(0,0,0,0.16) !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 7px 14px !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scroll-snap-type: x proximity !important;
          scrollbar-width: none !important;
          -webkit-overflow-scrolling: touch !important;
          touch-action: pan-x !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop::-webkit-scrollbar {
          display: none !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop button {
          flex: 0 0 auto !important;
          min-height: 40px !important;
          min-width: auto !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          scroll-snap-align: start !important;
          padding: 0 13px !important;
          border-radius: 12px !important;
          border: 1px solid transparent !important;
          background: rgba(255,255,255,0.025) !important;
          color: #aeb3c2 !important;
          font-size: 14px !important;
          font-weight: 900 !important;
          line-height: 1 !important;
          letter-spacing: -0.01em !important;
          box-shadow: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop button[aria-pressed="true"],
        .profile-mobile-first-polish .profile-tabs-desktop button[aria-selected="true"],
        .profile-mobile-first-polish .profile-tabs-desktop button[data-active="true"] {
          color: #ffffff !important;
          border-color: rgba(168,85,247,0.30) !important;
          background: linear-gradient(135deg, rgba(168,85,247,0.20), rgba(59,130,246,0.10)) !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.035), 0 8px 18px rgba(0,0,0,0.16) !important;
        }

        .profile-mobile-first-polish .profile-tabs-desktop button:active {
          transform: scale(0.98) !important;
        }
      }

    
      /* Step 22: proper mobile Showcase overlay and full flow. */
      @media (max-width: 720px) {
        html:has(.profile-showcase-mobile-open),
        body:has(.profile-showcase-mobile-open) {
          overflow: hidden !important;
          height: 100% !important;
        }

        .profile-showcase-modal-overlay,
        .profile-showcase-modal-overlay.profile-showcase-mobile-open {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483647 !important;
          display: block !important;
          width: 100vw !important;
          height: 100dvh !important;
          padding: 0 !important;
          margin: 0 !important;
          background:
            radial-gradient(circle at 50% -8%, rgba(168,85,247,0.28), transparent 44%),
            rgba(0,0,0,0.97) !important;
          overflow: hidden !important;
          isolation: isolate !important;
        }

        .profile-showcase-modal-shell {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483647 !important;
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          max-width: none !important;
          max-height: none !important;
          border: 0 !important;
          border-radius: 0 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
          padding: max(12px, env(safe-area-inset-top)) 14px max(34px, env(safe-area-inset-bottom)) !important;
          box-shadow: none !important;
          background:
            radial-gradient(circle at 0% 0%, rgba(168,85,247,0.18), transparent 34%),
            radial-gradient(circle at 100% 10%, rgba(34,211,238,0.10), transparent 30%),
            linear-gradient(180deg, rgba(14,16,23,0.99), rgba(4,6,10,1)) !important;
        }

        .profile-showcase-modal-header {
          position: relative !important;
          top: auto !important;
          margin: 0 0 12px !important;
          padding: 0 0 12px !important;
          background: transparent !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax"] {
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .profile-showcase-preview-column {
          order: -1 !important;
          border-left: 0 !important;
          padding-left: 0 !important;
          gap: 8px !important;
        }

        .profile-showcase-simple-controls {
          order: 1 !important;
          display: grid !important;
          gap: 10px !important;
        }

        .profile-showcase-preview-column [style*="min-height"] {
          min-height: min(270px, 37vh) !important;
          border-radius: 22px !important;
        }

        .profile-showcase-upload-card {
          min-height: 100px !important;
          grid-template-columns: 44px minmax(0, 1fr) !important;
          padding: 14px !important;
          border-radius: 19px !important;
        }

        .profile-showcase-upload-card span:first-child {
          width: 44px !important;
          height: 44px !important;
          border-radius: 15px !important;
          font-size: 24px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
        }

        .profile-showcase-modal-actions,
        .profile-showcase-modal-overlay .profile-showcase-modal-actions {
          position: relative !important;
          bottom: auto !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          transform: none !important;
          display: grid !important;
          grid-template-columns: 1fr 1.35fr !important;
          gap: 9px !important;
          margin: 18px 0 0 !important;
          padding: 14px 0 0 !important;
          border-top: 1px solid rgba(255,255,255,0.08) !important;
          background: transparent !important;
          z-index: 1 !important;
        }

        .profile-showcase-modal-actions button {
          width: 100% !important;
          min-height: 48px !important;
          justify-content: center !important;
          border-radius: 16px !important;
        }

        .profile-showcase-modal-overlay input,
        .profile-showcase-modal-overlay select,
        .profile-showcase-modal-overlay button {
          font-size: 13px !important;
        }
      }


      /* Step 23: mobile full cover + full scrollable Showcase flow. */
      @media (max-width: 720px) {
        html:has(.profile-showcase-mobile-open),
        body:has(.profile-showcase-mobile-open) {
          overflow: hidden !important;
          height: 100% !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open,
        .profile-showcase-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483647 !important;
          display: block !important;
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          padding: 0 !important;
          margin: 0 !important;
          background:
            radial-gradient(circle at 50% -6%, rgba(168,85,247,0.30), transparent 44%),
            #05060a !important;
          overflow: hidden !important;
          isolation: isolate !important;
        }

        .profile-showcase-modal-overlay::before {
          content: "";
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 0% 0%, rgba(168,85,247,0.16), transparent 36%),
            radial-gradient(circle at 100% 10%, rgba(34,211,238,0.10), transparent 32%),
            linear-gradient(180deg, #0e1017, #030408 72%);
          pointer-events: none;
        }

        .profile-showcase-modal-shell {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483647 !important;
          width: 100vw !important;
          min-width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          max-width: none !important;
          max-height: none !important;
          border: 0 !important;
          border-radius: 0 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
          padding: max(12px, env(safe-area-inset-top)) 14px max(38px, env(safe-area-inset-bottom)) !important;
          box-shadow: none !important;
          background:
            radial-gradient(circle at 0% 0%, rgba(168,85,247,0.18), transparent 34%),
            radial-gradient(circle at 100% 10%, rgba(34,211,238,0.10), transparent 30%),
            linear-gradient(180deg, rgba(14,16,23,0.99), rgba(4,6,10,1)) !important;
        }

        .profile-showcase-modal-header {
          position: relative !important;
          top: auto !important;
          margin: 0 0 12px !important;
          padding: 0 0 12px !important;
          background: transparent !important;
        }

        .profile-showcase-studio-layout,
        .profile-showcase-modal-overlay [style*="grid-template-columns: minmax"] {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 12px !important;
          align-items: stretch !important;
        }

        .profile-showcase-preview-column {
          order: -1 !important;
          border-left: 0 !important;
          padding-left: 0 !important;
          gap: 8px !important;
          min-width: 0 !important;
        }

        .profile-showcase-simple-controls {
          order: 1 !important;
          display: grid !important;
          gap: 10px !important;
          min-width: 0 !important;
          padding-bottom: 0 !important;
        }

        .profile-showcase-preview-column [style*="min-height"] {
          min-height: min(265px, 36vh) !important;
          border-radius: 22px !important;
        }

        .profile-showcase-upload-card {
          min-height: 100px !important;
          grid-template-columns: 44px minmax(0, 1fr) !important;
          padding: 14px !important;
          border-radius: 19px !important;
        }

        .profile-showcase-upload-card span:first-child {
          width: 44px !important;
          height: 44px !important;
          border-radius: 15px !important;
          font-size: 24px !important;
        }

        .profile-showcase-modal-overlay [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
        }

        .profile-showcase-font-select {
          display: block !important;
        }

        .profile-showcase-desktop-font-grid {
          display: none !important;
        }

        .profile-showcase-modal-actions,
        .profile-showcase-modal-overlay .profile-showcase-modal-actions {
          position: relative !important;
          bottom: auto !important;
          top: auto !important;
          left: auto !important;
          right: auto !important;
          transform: none !important;
          display: grid !important;
          grid-template-columns: 1fr 1.35fr !important;
          gap: 9px !important;
          margin: 18px 0 0 !important;
          padding: 14px 0 0 !important;
          border-top: 1px solid rgba(255,255,255,0.08) !important;
          background: transparent !important;
          z-index: 1 !important;
        }

        .profile-showcase-modal-actions button {
          width: 100% !important;
          min-height: 48px !important;
          justify-content: center !important;
          border-radius: 16px !important;
        }

        body:has(.profile-showcase-mobile-open) .profile-mobile-bottom-nav,
        body:has(.profile-showcase-mobile-open) .profile-bottom-nav,
        body:has(.profile-showcase-mobile-open) .bottom-nav,
        body:has(.profile-showcase-mobile-open) nav[aria-label="Bottom navigation"],
        body:has(.profile-showcase-mobile-open) [class*="BottomNav"],
        body:has(.profile-showcase-mobile-open) [class*="bottomNav"],
        body:has(.profile-showcase-mobile-open) [class*="bottom-nav"] {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          opacity: 0 !important;
        }
      }


      /* Step 24: Showcase creator is portaled above the full app. */
      .profile-showcase-modal-overlay.profile-showcase-mobile-open {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        isolation: isolate !important;
      }

      .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-shell {
        z-index: 2147483647 !important;
      }

      @media (max-width: 720px) {
        html:has(.profile-showcase-mobile-open),
        body:has(.profile-showcase-mobile-open) {
          overflow: hidden !important;
          height: 100% !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open {
          display: block !important;
          width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          padding: 0 !important;
          margin: 0 !important;
          background:
            radial-gradient(circle at 50% -6%, rgba(168,85,247,0.30), transparent 44%),
            #05060a !important;
          overflow: hidden !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-shell {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          min-width: 100vw !important;
          height: 100dvh !important;
          min-height: 100dvh !important;
          max-width: none !important;
          max-height: none !important;
          border: 0 !important;
          border-radius: 0 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important;
          -webkit-overflow-scrolling: touch !important;
          padding: max(12px, env(safe-area-inset-top)) 14px max(38px, env(safe-area-inset-bottom)) !important;
          box-shadow: none !important;
          background:
            radial-gradient(circle at 0% 0%, rgba(168,85,247,0.18), transparent 34%),
            radial-gradient(circle at 100% 10%, rgba(34,211,238,0.10), transparent 30%),
            linear-gradient(180deg, rgba(14,16,23,0.99), rgba(4,6,10,1)) !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-studio-layout,
        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="grid-template-columns: minmax"] {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 12px !important;
          align-items: stretch !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-preview-column {
          order: -1 !important;
          border-left: 0 !important;
          padding-left: 0 !important;
          gap: 8px !important;
          min-width: 0 !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-simple-controls {
          order: 1 !important;
          display: grid !important;
          gap: 10px !important;
          min-width: 0 !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-preview-column [style*="min-height"] {
          min-height: min(265px, 36vh) !important;
          border-radius: 22px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-actions {
          position: relative !important;
          bottom: auto !important;
          display: grid !important;
          grid-template-columns: 1fr 1.35fr !important;
          gap: 9px !important;
          margin: 18px 0 0 !important;
          padding: 14px 0 0 !important;
          border-top: 1px solid rgba(255,255,255,0.08) !important;
          background: transparent !important;
          z-index: 1 !important;
        }
      }


      /* Step 26: Showcase overlay text size controls. */
      .profile-showcase-modal-overlay input[type="range"] {
        min-height: 32px;
      }

      @media (max-width: 720px) {
        .profile-showcase-modal-overlay input[type="range"] {
          min-height: 36px !important;
        }
      }


      /* Step 27: premium preview-side text size slider. */
      .profile-showcase-vertical-size-slider {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        touch-action: none;
      }

      .profile-showcase-vertical-size-slider::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: 999px;
        background: rgba(255,255,255,0.45);
      }

      .profile-showcase-vertical-size-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 19px;
        height: 19px;
        border-radius: 999px;
        background: #ffffff;
        border: 2px solid rgba(168,85,247,0.55);
        margin-top: -7.5px;
        box-shadow: 0 0 0 5px rgba(255,255,255,0.12), 0 8px 18px rgba(0,0,0,0.30);
      }

      .profile-showcase-vertical-size-slider::-moz-range-track {
        height: 4px;
        border-radius: 999px;
        background: rgba(255,255,255,0.45);
      }

      .profile-showcase-vertical-size-slider::-moz-range-thumb {
        width: 19px;
        height: 19px;
        border-radius: 999px;
        background: #ffffff;
        border: 2px solid rgba(168,85,247,0.55);
        box-shadow: 0 0 0 5px rgba(255,255,255,0.12), 0 8px 18px rgba(0,0,0,0.30);
      }

      @media (max-width: 720px) {
        .profile-showcase-vertical-size-slider {
          width: 142px !important;
        }
      }


      /* Step 28: fix overlay text size target and slim slider. */
      .profile-showcase-vertical-size-slider::-webkit-slider-runnable-track {
        height: 3px !important;
        background: rgba(255,255,255,0.58) !important;
      }

      .profile-showcase-vertical-size-slider::-webkit-slider-thumb {
        width: 18px !important;
        height: 18px !important;
        margin-top: -7.5px !important;
      }

      .profile-showcase-vertical-size-slider::-moz-range-track {
        height: 3px !important;
        background: rgba(255,255,255,0.58) !important;
      }

      .profile-showcase-vertical-size-slider::-moz-range-thumb {
        width: 18px !important;
        height: 18px !important;
      }

      @media (max-width: 720px) {
        .profile-showcase-vertical-size-slider {
          width: 132px !important;
        }
      }


      /* Step 29: smoother preview text movement and clean size slider. */
      .profile-showcase-modal-overlay .profile-showcase-vertical-size-slider {
        -webkit-appearance: none !important;
        appearance: none !important;
        background: transparent !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        touch-action: none !important;
      }

      .profile-showcase-modal-overlay .profile-showcase-vertical-size-slider::-webkit-slider-runnable-track {
        height: 3px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,0.72) !important;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.20) !important;
      }

      .profile-showcase-modal-overlay .profile-showcase-vertical-size-slider::-webkit-slider-thumb {
        -webkit-appearance: none !important;
        appearance: none !important;
        width: 18px !important;
        height: 18px !important;
        border-radius: 999px !important;
        background: #ffffff !important;
        border: 2px solid rgba(168,85,247,0.62) !important;
        margin-top: -7.5px !important;
        box-shadow: 0 0 0 5px rgba(255,255,255,0.10), 0 8px 18px rgba(0,0,0,0.30) !important;
      }

      .profile-showcase-modal-overlay .profile-showcase-vertical-size-slider::-moz-range-track {
        height: 3px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,0.72) !important;
      }

      .profile-showcase-modal-overlay .profile-showcase-vertical-size-slider::-moz-range-thumb {
        width: 18px !important;
        height: 18px !important;
        border-radius: 999px !important;
        background: #ffffff !important;
        border: 2px solid rgba(168,85,247,0.62) !important;
      }

      .profile-showcase-modal-overlay * {
        -webkit-tap-highlight-color: transparent;
      }


      /* Step 30 fixed: Showcase ownership + circle size polish. */
      .profile-showcases-row button:not([aria-label="Create a new Showcase"]) {
        min-width: 74px !important;
        width: 74px !important;
      }

      .profile-showcases-row button:not([aria-label="Create a new Showcase"]) > span:first-child,
      .profile-showcases-row button:not([aria-label="Create a new Showcase"]) > div:first-child {
        width: 64px !important;
        height: 64px !important;
        min-width: 64px !important;
        min-height: 64px !important;
        border-radius: 999px !important;
      }

      @media (max-width: 720px) {
        .profile-showcases-row button:not([aria-label="Create a new Showcase"]) {
          min-width: 78px !important;
          width: 78px !important;
        }

        .profile-showcases-row button:not([aria-label="Create a new Showcase"]) > span:first-child,
        .profile-showcases-row button:not([aria-label="Create a new Showcase"]) > div:first-child {
          width: 68px !important;
          height: 68px !important;
          min-width: 68px !important;
          min-height: 68px !important;
          border-radius: 999px !important;
        }
      }


      /* Step 31: restore owner New Showcase visibility and row spacing. */
      .profile-showcases-row {
        min-height: 78px;
      }

      @media (max-width: 720px) {
        .profile-showcases-row {
          min-height: 88px !important;
        }
      }


      /* Step 32: mobile Showcase creator polish. Keeps desktop/tablet intact while making the phone creator feel intentional. */
      @media (max-width: 720px) {
        .profile-showcase-modal-overlay.profile-showcase-mobile-open {
          z-index: 2147482500 !important;
          align-items: stretch !important;
          justify-content: stretch !important;
          padding: 0 !important;
          background:
            radial-gradient(circle at 50% 0%, rgba(168,85,247,0.22), transparent 42%),
            rgba(0,0,0,0.88) !important;
          backdrop-filter: blur(14px) !important;
          -webkit-backdrop-filter: blur(14px) !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-shell {
          position: fixed !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100dvh !important;
          max-width: none !important;
          max-height: 100dvh !important;
          border-radius: 0 !important;
          padding: 12px 12px calc(12px + env(safe-area-inset-bottom)) !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          background:
            radial-gradient(circle at 15% 0%, rgba(168,85,247,0.28), transparent 34%),
            radial-gradient(circle at 94% 8%, rgba(34,211,238,0.12), transparent 28%),
            linear-gradient(180deg, rgba(18,20,29,0.99), rgba(6,8,13,0.995)) !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-header {
          position: static !important;
          top: auto !important;
          z-index: 1 !important;
          flex: 0 0 auto !important;
          align-items: center !important;
          gap: 10px !important;
          margin: 0 0 8px !important;
          padding: 2px 0 8px !important;
          border-bottom: 1px solid rgba(255,255,255,0.05) !important;
          background: transparent !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-header h3 {
          font-size: 18px !important;
          line-height: 1.04 !important;
        }


        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-header p {
          max-width: 240px !important;
          font-size: 12px !important;
          line-height: 1.22 !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-header button {
          width: 36px !important;
          height: 36px !important;
          border-radius: 13px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-header [style*="Simple first"] {
          display: none !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-studio-layout {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 12px !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 2px 2px 92px !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-preview-column {
          order: -1 !important;
          gap: 8px !important;
          padding: 0 !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-preview-column > div:first-child {
          padding: 0 2px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-preview-column [style*="Live preview"] small {
          display: none !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="min-height: 270px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="min-height: 300px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="min-height: 330px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="min-height: 340px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="min-height: 460px"] {
          width: 100% !important;
          min-height: 220px !important;
          height: 220px !important;
          margin: 0 !important;
          border-radius: 22px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open.profile-showcase-preview-expanded [style*="min-height: 270px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open.profile-showcase-preview-expanded [style*="min-height: 300px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open.profile-showcase-preview-expanded [style*="min-height: 330px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open.profile-showcase-preview-expanded [style*="min-height: 340px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open.profile-showcase-preview-expanded [style*="min-height: 460px"] {
          min-height: min(420px, 56dvh) !important;
          height: min(420px, 56dvh) !important;
          max-height: 56dvh !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-preview-phone {
          cursor: pointer !important;
          touch-action: manipulation !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-simple-controls {
          gap: 10px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-upload-card {
          min-height: 96px !important;
          border-radius: 20px !important;
          padding: 13px !important;
          grid-template-columns: 42px minmax(0, 1fr) !important;
          background:
            linear-gradient(135deg, rgba(168,85,247,0.18), rgba(59,130,246,0.08)),
            rgba(255,255,255,0.045) !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-upload-card strong {
          font-size: 14px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-upload-card small {
          font-size: 11px !important;
          line-height: 1.25 !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open input,
        .profile-showcase-modal-overlay.profile-showcase-mobile-open select,
        .profile-showcase-modal-overlay.profile-showcase-mobile-open button {
          min-height: 42px !important;
          touch-action: manipulation !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="grid-template-columns: repeat(3"] {
          grid-template-columns: 1fr !important;
          gap: 8px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open [aria-pressed] {
          min-height: 44px !important;
          grid-template-columns: 34px minmax(0, 1fr) !important;
          align-items: center !important;
          padding: 9px 10px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-actions {
          position: sticky !important;
          bottom: 0 !important;
          z-index: 35 !important;
          flex: 0 0 auto !important;
          margin: 0 -2px !important;
          padding: 10px 2px 0 !important;
          display: grid !important;
          grid-template-columns: 0.8fr 1.2fr !important;
          gap: 8px !important;
          border-top: 1px solid rgba(255,255,255,0.09) !important;
          background: linear-gradient(180deg, rgba(8,10,16,0.20), rgba(8,10,16,0.98) 34%) !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-actions button {
          width: 100% !important;
          min-height: 46px !important;
          border-radius: 15px !important;
          padding: 11px 12px !important;
          font-size: 13px !important;
        }
      }

      @media (max-width: 390px) {
        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-header [style*="width: 42px"] {
          width: 36px !important;
          height: 36px !important;
          border-radius: 13px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-header h3 {
          font-size: 18px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open .profile-showcase-modal-header p {
          font-size: 12px !important;
        }

        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="min-height: 270px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="min-height: 300px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="min-height: 340px"],
        .profile-showcase-modal-overlay.profile-showcase-mobile-open [style*="min-height: 460px"] {
          width: min(74vw, 252px) !important;
          min-height: min(43vh, 320px) !important;
          height: min(43vh, 320px) !important;
        }
      }



      /* v22: mobile profile tabs/content cutoff fix. Keeps desktop/tablet polish untouched. */
      @media (max-width: 720px) {
        .profile-tabs-mobile-cutoff-v22 .profile-page-shell {
          padding-bottom: calc(184px + env(safe-area-inset-bottom)) !important;
          overflow-x: hidden !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-stream-stack {
          width: 100% !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
          padding-bottom: calc(118px + env(safe-area-inset-bottom)) !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-tabs-shell {
          width: 100% !important;
          max-width: 100% !important;
          overflow: hidden !important;
          padding: 0 0 10px !important;
          margin: 0 !important;
          background: #111318 !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-tabs-desktop {
          width: 100% !important;
          max-width: 100% !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          padding: 8px 12px 9px !important;
          scroll-padding-left: 12px !important;
          scroll-snap-type: x proximity !important;
          -webkit-overflow-scrolling: touch !important;
          touch-action: pan-x !important;
          box-sizing: border-box !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-tabs-desktop button {
          flex: 0 0 auto !important;
          min-width: 78px !important;
          max-width: 118px !important;
          min-height: 42px !important;
          padding: 8px 10px !important;
          display: grid !important;
          align-content: center !important;
          justify-items: start !important;
          gap: 2px !important;
          border-radius: 13px !important;
          scroll-snap-align: start !important;
          box-sizing: border-box !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-tabs-desktop button span {
          max-width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          font-size: 13px !important;
          line-height: 1.05 !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-tabs-desktop button small {
          max-width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          font-size: 8.5px !important;
          line-height: 1.05 !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-tab-summary-card {
          margin: 0 10px 10px !important;
          width: auto !important;
          max-width: calc(100% - 20px) !important;
          box-sizing: border-box !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-content-card,
        .profile-tabs-mobile-cutoff-v22 .profile-composer-card,
        .profile-tabs-mobile-cutoff-v22 .profile-feed-section-card,
        .profile-tabs-mobile-cutoff-v22 .profile-empty-state-card {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
        }

        .profile-tabs-mobile-cutoff-v22 #profile-composer {
          padding-bottom: calc(118px + env(safe-area-inset-bottom)) !important;
          margin-bottom: calc(22px + env(safe-area-inset-bottom)) !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-composer-card textarea,
        .profile-tabs-mobile-cutoff-v22 .profile-composer-card input,
        .profile-tabs-mobile-cutoff-v22 .profile-content-card textarea,
        .profile-tabs-mobile-cutoff-v22 .profile-content-card input {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
      }

      @media (max-width: 390px) {
        .profile-tabs-mobile-cutoff-v22 .profile-tabs-desktop button {
          min-width: 72px !important;
          max-width: 104px !important;
          padding-left: 8px !important;
          padding-right: 8px !important;
        }

        .profile-tabs-mobile-cutoff-v22 .profile-tabs-desktop button small {
          display: none !important;
        }
      }





      /* Step 53: stabilize + New Showcase hover so it glows without lifting into the Showcases heading. */
      .profile-showcases-row button[aria-label="Create a new Showcase"]:hover,
      .profile-showcases-row button[aria-label="Create a new Showcase"]:focus-visible {
        transform: none !important;
      }

      .profile-showcases-row button[aria-label="Create a new Showcase"]:hover span:first-child,
      .profile-showcases-row button[aria-label="Create a new Showcase"]:focus-visible span:first-child {
        transform: none !important;
      }

      .profile-showcases-title-stable,
      .profile-showcases-panel h3 {
        position: relative !important;
        z-index: 8 !important;
      }

      /* Step 52: keep Showcase + New labels from tucking under the tabs/content below. */
      .profile-showcases-panel {
        padding-bottom: 18px !important;
        margin-bottom: 14px !important;
        overflow: visible !important;
        position: relative !important;
        z-index: 4 !important;
      }

      .profile-showcases-row {
        min-height: 92px !important;
        padding-bottom: 12px !important;
        overflow-y: visible !important;
        position: relative !important;
        z-index: 5 !important;
      }

      .profile-showcases-row > button,
      .profile-showcases-row > div {
        position: relative !important;
        z-index: 6 !important;
        padding-bottom: 4px !important;
      }

      .profile-showcases-row button[aria-label="Create a new Showcase"] span:last-child {
        position: relative !important;
        z-index: 7 !important;
        margin-top: 1px !important;
      }

      .profile-tabs-shell {
        position: relative !important;
        z-index: 2 !important;
      }

      @media (max-width: 720px) {
        .profile-showcases-panel {
          padding-bottom: 16px !important;
          margin-bottom: 14px !important;
        }

        .profile-showcases-row {
          min-height: 96px !important;
          padding-bottom: 14px !important;
        }
      }

`}</style>

    {/* Mobile Top Bar */}
    <div className="xl:hidden" style={mobileTopBarStyle}>
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        style={mobileCircleButtonStyle}
        aria-label="Back to dashboard"
      >
        ‹
      </button>

      <div style={{ textAlign: "center", minWidth: 0 }}>
        <div style={{ fontWeight: 950, letterSpacing: "0.04em" }}>
          PARAPOST
        </div>
        <div
          style={{
            color: "#a855f7",
            fontSize: "11px",
            letterSpacing: "0.32em",
            fontWeight: 900,
          }}
        >
          NETWORK
        </div>
      </div>


    </div>

      <div className="profile-page-shell mx-auto w-full px-3 py-4 sm:px-4 lg:px-6" style={{ maxWidth: "1680px", paddingBottom: "96px" }}>
        <div className="profile-layout-grid grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
          <aside className="hidden xl:block" style={sideCardStyle}>
            <h2 style={{ marginTop: 0, fontSize: "24px", letterSpacing: "-0.03em" }}>PARAPOST</h2>
            <p style={{ color: "#a855f7", fontSize: "13px", marginTop: 0, letterSpacing: "0.28em", fontWeight: 800 }}>NETWORK</p>

            <div
              style={{
                marginTop: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <Link href="/dashboard" style={navItemLinkStyle}>
                Home Feed
              </Link>
              {viewerId ? (
                <Link href={`/profile/${viewerId}`} style={navItemLinkStyle}>
                  My Profile
                </Link>
              ) : (
                <div style={navItemStyle}>My Profile</div>
              )}
              <Link href="/friends" style={navItemLinkStyle}>
                Friends
              </Link>
              <Link href="/notifications" style={navItemLinkStyle}>
                Notifications
             </Link>
           <Link href="/messages" style={navItemLinkStyle}>
            Parachat
           </Link>

           <div style={navItemStyle}>Settings</div>
           </div>
           </aside>   

          <section className="profile-center-column min-w-0">
            <div className="profile-stream-stack mx-auto w-full space-y-4 md:space-y-5" style={{ maxWidth: "980px" }}>
              <div className="profile-hero-shell" style={profileHeroShellStyle}>
                <div className="profile-cover-zone" style={profileCoverDisplayStyle}>
                  <div style={profileCoverOverlayStyle} />
                </div>

                <div className="profile-mobile-header-real">
                  <div className={`profile-mobile-avatar-shell-real ${profile?.is_online ? "profile-avatar-online-ring" : "profile-avatar-offline-ring"}`}>
                    {profile?.avatar_url ? (
                      <img
                        src={profile?.avatar_url || ""}
                        alt="Profile"
                        className="profile-mobile-avatar-image-real"
                      />
                    ) : (
                      <div className="profile-mobile-avatar-fallback-real">
                        {profileDisplayInitial}
                      </div>
                    )}

                    {canCreateShowcase ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/profile/${viewerId}/edit`)}
                        className="profile-mobile-camera-real"
                        aria-label="Edit profile"
                        title="Edit profile"
                      >
                        ✎
                      </button>
                    ) : null}
                  </div>

                  <div className="profile-mobile-identity-real">
                    <h1>
                      {profileDisplayName || "\u00A0"}
                      {profile?.verified ? <span>✓</span> : null}
                    </h1>

                    <p>
                      {profileIsReady && profileDisplayUsername ? `@${profileDisplayUsername}` : ""}
                      {profileIsReady ? <span>•</span> : null}
                      {profileIsReady ? (isOwnProfile ? "Your profile" : getFriendStatusLabel()) : null}
                    </p>
                  </div>

                  <div className="profile-mobile-actions-real">
                    {isOwnProfile ? (
                      <button
                        type="button"
                        onClick={() => setProfileActionsOpen(true)}
                        className="profile-mobile-owner-more-real"
                        aria-label="Profile options"
                      >
                        •••
                      </button>
                    ) : viewerId ? (
                      <>
                        {friendStatus === "none" ? (
                          <button
                            type="button"
                            onClick={handleSendFriendRequest}
                            disabled={friendLoading}
                            className="profile-mobile-secondary-real"
                          >
                            {friendLoading ? "Saving..." : "Add Friend"}
                          </button>
                        ) : friendStatus === "outgoing_request" ? (
                          <button
                            type="button"
                            onClick={handleCancelFriendRequest}
                            disabled={friendLoading}
                            className="profile-mobile-secondary-real"
                          >
                            {friendLoading ? "Saving..." : "Requested"}
                          </button>
                        ) : friendStatus === "incoming_request" ? (
                          <>
                            <button
                              type="button"
                              onClick={handleAcceptFriendRequest}
                              disabled={friendLoading}
                              className="profile-mobile-primary-real"
                            >
                              {friendLoading ? "Saving..." : "Accept"}
                            </button>

                            <button
                              type="button"
                              onClick={handleDeclineFriendRequest}
                              disabled={friendLoading}
                              className="profile-mobile-secondary-real"
                            >
                              {friendLoading ? "Saving..." : "Decline"}
                            </button>
                          </>
                        ) : friendStatus === "friends" ? (
                          <button
                            type="button"
                            onClick={handleRemoveFriend}
                            disabled={friendLoading}
                            className="profile-mobile-secondary-real"
                          >
                            {friendLoading ? "Saving..." : "Friends"}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={handleMessageUser}
                          className="profile-mobile-primary-real"
                        >
                          Parachat
                        </button>
                      </>
                    ) : null}
                  </div>

                  {friendStatusMessage ? (
                    <div className="profile-mobile-status-real">
                      {friendStatusMessage}
                    </div>
                  ) : null}

                  {(profile?.bio &&
                    !(profile?.bio || "")
                      .toLowerCase()
                      .startsWith("no bio added yet")) ||
                  isOwnProfile ? (
                    <p className="profile-mobile-bio-real">
                      {profile?.bio &&
                      !(profile?.bio || "")
                        .toLowerCase()
                        .startsWith("no bio added yet")
                        ? profile?.bio
                        : "No bio added yet. Add a short intro, your interests, and what you share on Parapost."}
                    </p>
                  ) : null}

                  <div className="profile-mobile-meta-real">
                    {profile?.location ? <span>📍 {profile?.location}</span> : null}

                    {profile?.website ? (
                      <a
                        href={
                          (profile?.website || "").startsWith("http")
                            ? profile?.website
                            : `https://${profile?.website || ""}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🔗{" "}
                        {(profile?.website || "")
                          .replace(/^https?:\/\//, "")
                          .replace(/^www\./, "")}
                      </a>
                    ) : null}

                    <span>📅 Joined Parapost</span>
                  </div>
                </div>

                <div className="profile-hero-content" style={profileHeroContentStyle}>
                  <div className={`profile-avatar-wrap ${profile?.is_online ? "profile-avatar-online-ring" : "profile-avatar-offline-ring"}`} style={profileAvatarWrapStyle}>
                    {profile?.avatar_url ? (
                      <img src={profile?.avatar_url || ""} alt="Profile" style={profileAvatarStyle} />
                    ) : (
                      <div style={profileAvatarFallbackStyle}>
                        {profileDisplayInitial}
                      </div>
                    )}

                    {isOwnProfile ? (
                      <button
                        onClick={() => router.push(`/profile/${viewerId}/edit`)}
                        className="profile-avatar-edit-button"
                        style={avatarCameraButtonStyle}
                        aria-label="Edit profile"
                        title="Edit profile"
                      >
                        ✎
                      </button>
                    ) : null}
                  </div>

                  <div className="profile-hero-info" style={profileHeroInfoStyle}>
                    <div className="profile-hero-topline" style={profileHeroTopLineStyle}>
                      <div className="profile-identity-block" style={{ minWidth: 0 }}>
                        <h1 style={profileHeroNameStyle}>
                          {profileDisplayName || "\u00A0"}
                          {profile?.verified ? <span style={verifiedBadgeStyle}>✓</span> : null}
                        </h1>
                        <p style={profileHandleStyle}>
                          {profileIsReady && profileDisplayUsername ? `@${profileDisplayUsername}` : ""}
                          {profileIsReady ? <span style={profileDotStyle}>•</span> : null}
                          {profileIsReady ? (isOwnProfile ? "Your profile" : getFriendStatusLabel()) : null}
                        </p>
                      </div>

                      <div className={`profile-hero-actions ${isOwnProfile ? "profile-owner-actions" : "profile-public-actions"}`} style={profileHeroActionsStyle}>
                        {!isOwnProfile && viewerId ? (
                          <>
                            {friendStatus === "none" ? (
                              <button
                                type="button"
                                onClick={handleSendFriendRequest}
                                disabled={friendLoading}
                                style={profilePrimaryButtonStyle}
                              >
                                {friendLoading ? "Saving..." : "Add Friend"}
                              </button>
                            ) : friendStatus === "outgoing_request" ? (
                              <button
                                type="button"
                                onClick={handleCancelFriendRequest}
                                disabled={friendLoading}
                                style={profileGlassButtonStyle}
                              >
                                {friendLoading ? "Saving..." : "Requested"}
                              </button>
                            ) : friendStatus === "incoming_request" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleAcceptFriendRequest}
                                  disabled={friendLoading}
                                  style={profilePrimaryButtonStyle}
                                >
                                  {friendLoading ? "Saving..." : "Accept"}
                                </button>

                                <button
                                  type="button"
                                  onClick={handleDeclineFriendRequest}
                                  disabled={friendLoading}
                                  style={profileGlassButtonStyle}
                                >
                                  {friendLoading ? "Saving..." : "Decline"}
                                </button>
                              </>
                            ) : friendStatus === "friends" ? (
                              <button
                                type="button"
                                onClick={handleRemoveFriend}
                                disabled={friendLoading}
                                style={profileGlassButtonStyle}
                              >
                                {friendLoading ? "Saving..." : "Friends"}
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={handleMessageUser}
                              style={profilePrimaryButtonStyle}
                            >
                              Parachat
                            </button>
                          </>
                        ) : null}
                        {profileIsReady ? (

<div
                          className="profile-desktop-action-menu-wrap"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            ref={profileActionButtonRef}
                            type="button"
                            onClick={handleToggleProfileActions}
                            style={profileIconButtonStyle}
                            aria-label="More profile actions"
                          >
                            •••
                          </button>

                          {false ? (
                            <div
                              className="profile-desktop-action-menu"
                              style={profileDesktopActionMenuStyle}
                            >
                              <div style={profileDesktopActionMenuHeaderStyle}>
                                <p style={profileActionEyebrowStyle}>
                                  Profile options
                                </p>
                                <strong>
                                  {profile?.full_name ||
                                    profile?.username ||
                                    "Profile"}
                                </strong>
                              </div>

                              {isOwnProfile ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProfileActionsOpen(false);
                                    router.push(`/profile/${viewerId}/edit`);
                                  }}
                                  style={profileDesktopActionItemStyle}
                                >
                                  <span style={profileActionIconStyle}>✎</span>
                                  <span>
                                    <strong>Edit profile</strong>
                                    <small>Edit avatar, bio, and profile details</small>
                                  </span>
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => handleOpenProfileSection("Posts")}
                                style={profileDesktopActionItemStyle}
                              >
                                <span style={profileActionIconStyle}>▤</span>
                                <span>
                                  <strong>View posts</strong>
                                  <small>Go to profile feed</small>
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenProfileSection("Photos")}
                                style={profileDesktopActionItemStyle}
                              >
                                <span style={profileActionIconStyle}>▧</span>
                                <span>
                                  <strong>View photos</strong>
                                  <small>Open photo grid</small>
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setProfileActionsOpen(false);
                                  router.push(`/profile/${profileId}/reels`);
                                }}
                                style={profileDesktopActionItemStyle}
                              >
                                <span style={profileActionIconStyle}>▣</span>
                                <span>
                                  <strong>Open reels</strong>
                                  <small>View short videos</small>
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={handleCopyProfileLink}
                                style={profileDesktopActionItemStyle}
                              >
                                <span style={profileActionIconStyle}>↗</span>
                                <span>
                                  <strong>Copy profile link</strong>
                                  <small>Share this profile</small>
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setProfileActionsOpen(false);
                                  router.push("/dashboard");
                                }}
                                style={profileDesktopActionItemStyle}
                              >
                                <span style={profileActionIconStyle}>⌂</span>
                                <span>
                                  <strong>Back to feed</strong>
                                  <small>Return to homepage feed</small>
                                </span>
                              </button>

                              {isOwnProfile ? (
                                <button
                                  type="button"
                                  onClick={handleProfileLogout}
                                  style={profileDesktopLogoutActionItemStyle}
                                >
                                  <span style={profileActionLogoutIconStyle}>↪</span>
                                  <span>
                                    <strong>Log out</strong>
                                    <small>Sign out of Parapost Network</small>
                                  </span>
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        ) : null}
                      </div>
                    </div>

                    {friendStatusMessage ? <div style={statusToastStyle}>{friendStatusMessage}</div> : null}

                    {(profile?.bio &&
                      !(profile?.bio || "")
                        .toLowerCase()
                        .startsWith("no bio added yet")) ||
                    isOwnProfile ? (
                      <p style={profileBioStyle}>
                        {profile?.bio &&
                        !(profile?.bio || "")
                          .toLowerCase()
                          .startsWith("no bio added yet")
                          ? profile?.bio
                          : "No bio added yet. Add a short intro, your interests, and what you share on Parapost."}
                      </p>
                    ) : null}

                    <div className="profile-mobile-meta-action-row">
                      <div className="profile-meta-row" style={profileMetaRowStyle}>
                        {profile?.location ? <span>📍 {profile?.location}</span> : null}

                        {profile?.website ? (
                          <a
                            href={
                              (profile?.website || "").startsWith("http")
                                ? profile?.website
                                : `https://${profile?.website || ""}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: "none", color: "#c084fc", fontWeight: 600 }}
                          >
                            🔗{" "}
                            {(profile?.website || "")
                              .replace(/^https?:\/\//, "")
                              .replace(/^www\./, "")}
                          </a>
                        ) : null}

                        <span>📅 Joined Parapost</span>
                      </div>

                      {profileIsReady ? (
                        <button
                          type="button"
                          onClick={() => setProfileActionsOpen(true)}
                          className="profile-mobile-inline-more"
                          aria-label="Profile options"
                          title="Profile options"
                        >
                          •••
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="profile-stats-bar" style={profileStatsBarStyle}>
                  <div style={profileStatItemStyle}>
                    <strong style={profileStatNumberStyle}>{followersCount}</strong>
                    <span style={profileStatLabelStyle}>Followers</span>
                  </div>
                  <div style={profileStatDividerStyle} />
                  <div style={profileStatItemStyle}>
                    <strong style={profileStatNumberStyle}>{followingCount}</strong>
                    <span style={profileStatLabelStyle}>Following</span>
                  </div>
                  <div style={profileStatDividerStyle} />
                  <div style={profileStatItemStyle}>
                    <strong style={profileStatNumberStyle}>{posts.length}</strong>
                    <span style={profileStatLabelStyle}>Posts</span>
                  </div>
                  <div style={profileStatDividerStyle} />
                  <div style={profileStatItemStyle}>
                    <strong style={profileStatNumberStyle}>{reels.length}</strong>
                    <span style={profileStatLabelStyle}>Reels</span>
                  </div>
                </div>

                {(canCreateShowcase || visibleProfileShowcases.length > 0) ? (
                  <section className="profile-showcases-panel profile-stories-row" style={profileShowcasesPanelStyle} data-profile-showcases="true">
                    <h3 style={profileShowcasesTitleStyle}>Showcases</h3>

                  <div className="profile-showcases-row" style={profileShowcasesRowStyle}>
                    <button
                      type="button"
                      style={canCreateShowcase ? profileShowcaseNewItemStyle : profileShowcaseHiddenCreateItemStyle}
                      onClick={() => {
                        if (canCreateShowcase) handleOpenShowcaseComposer();
                      }}
                      aria-label="Create a new Showcase"
                    >
                      <span style={profileShowcasePlusCircleStyle}>+</span>
                      <span style={profileShowcaseNewLabelStyle}>New</span>
                    </button>

                    {visibleProfileShowcases.map((showcase) => {
                      const fontOption = getShowcaseFontOption(showcase.fontKey);
                      const coverText = (showcase.coverText || showcase.title).trim();

                      return (
                        <button
                          key={showcase.id}
                          type="button"
                          style={profileShowcaseItemStyle}
                          onClick={() => handleOpenShowcase(showcase)}
                          aria-label={`Open ${showcase.title} Showcase`}
                        >
                          <span style={profileShowcaseCoverCircleStyle}>
                            {showcase.mediaPreviewUrl && showcase.mediaType === "image" ? (
                              <img
                                src={showcase.mediaPreviewUrl}
                                alt=""
                                style={profileShowcaseCoverMediaStyle}
                              />
                            ) : showcase.mediaPreviewUrl && showcase.mediaType === "video" ? (
                              <video
                                src={showcase.mediaPreviewUrl}
                                muted
                                playsInline
                                style={profileShowcaseCoverMediaStyle}
                              />
                            ) : null}

                            <span
                              style={{
                                ...profileShowcaseCoverShadeStyle,
                                opacity: showcase.mediaPreviewUrl ? 1 : 0,
                              }}
                            />

                            <span
                              style={{
                                ...profileShowcaseCoverTextStyle,
                                left: `${showcase.textPosition?.x || 50}%`,
                                top: `${showcase.textPosition?.y || 50}%`,
                                fontFamily: fontOption.family,
                                fontSize: `${getShowcaseTileFontSize(showcase.overlayFontSize)}px`,
                              }}
                            >
                              {coverText}
                            </span>
                          </span>

                          {canManageProfileShowcases ? (
                            <span
                              role="button"
                              tabIndex={0}
                              style={profileShowcaseDeleteStyle}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleDeleteShowcase(showcase.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleDeleteShowcase(showcase.id);
                                }
                              }}
                              aria-label={`Delete ${showcase.title} Showcase`}
                            >
                              ×
                            </span>
                          ) : null}

                          <span style={profileShowcaseNewLabelStyle}>{showcase.title}</span>
                        </button>
                      );
                    })}
                  </div>
                  </section>
                ) : null}

                {isClientMounted && showcaseComposerOpen
                  ? createPortal(
                      (
                  <div
                    className={`profile-showcase-modal-overlay profile-showcase-mobile-open ${showcasePreviewExpanded ? "profile-showcase-preview-expanded" : ""}`}
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
                              <span>Simple first</span>
                              <span>Customize optional</span>
                            </div>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCloseShowcaseComposer}
                          style={profileShowcaseModalCloseStyle}
                          aria-label="Close Showcase creator"
                        >
                          ×
                        </button>
                      </div>

                      <div className="profile-showcase-studio-layout" style={profileShowcaseSimpleStudioStyle}>
                        <div className="profile-showcase-simple-controls" style={profileShowcaseSimpleControlsStyle}>
                          <button
                            className="profile-showcase-upload-card"
                            type="button"
                            onClick={() => {
                              setShowcaseCreatorMode("media");
                              showcaseMediaInputRef.current?.click();
                            }}
                            onDrop={handleShowcaseMediaDrop}
                            onDragOver={handleShowcaseMediaDragOver}
                            onDragLeave={handleShowcaseMediaDragLeave}
                            style={
                              showcaseMediaPreviewUrl
                                ? profileShowcaseSimpleUploadCardSelectedStyle
                                : showcaseMediaDragActive
                                  ? profileShowcaseSimpleUploadCardActiveStyle
                                  : profileShowcaseSimpleUploadCardStyle
                            }
                          >
                            <span style={profileShowcaseSimpleUploadIconStyle}>
                              {showcaseMediaPreviewUrl ? "✓" : "⇧"}
                            </span>
                            <span className="profile-showcase-upload-copy">
                              <strong style={profileShowcaseUploadTitleTextStyle}>
                                {showcaseMediaPreviewUrl ? "Media selected" : "Upload Photo or Video"}
                              </strong>
                              <small style={profileShowcaseUploadHelpTextStyle}>
                                {showcaseMediaPreviewUrl
                                  ? "Tap to replace this Showcase media"
                                  : "Tap to choose from your device"}
                              </small>
                              <small style={profileShowcaseUploadHelpTextStyle}>
                                {showcaseMediaFileName || "JPG, PNG, MP4"}
                              </small>
                            </span>
                          </button>

                          <input
                            ref={showcaseMediaInputRef}
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleShowcaseMediaChange}
                            style={{ display: "none" }}
                          />

                          {showcaseMediaFileName ? (
                            <div style={profileShowcaseSelectedFileStyle}>
                              <span>{showcaseMediaType === "video" ? "Video" : "Photo"} ready: {showcaseMediaFileName}</span>
                              <button
                                type="button"
                                onClick={handleClearShowcaseMedia}
                                style={profileShowcaseTinyButtonStyle}
                              >
                                Remove
                              </button>
                            </div>
                          ) : null}

                          <label style={profileShowcaseFieldLabelStyle}>
                            Showcase name
                            <input
                              value={showcaseTitle}
                              onChange={(event) => {
                                setShowcaseTitle(event.target.value);
                                setShowcaseError("");
                              }}
                              placeholder="Give your Showcase a name"
                              style={profileShowcaseInputStyle}
                              maxLength={16}
                            />
                          </label>

                          <div style={profileShowcaseDurationGroupStyle}>
                            <div>
                              <strong style={profileShowcaseDurationTitleStyle}>Duration</strong>
                              <p style={profileShowcaseDurationHelpStyle}>
                                Choose how long this Showcase stays on your profile.
                              </p>
                            </div>

                            <div className="profile-showcase-duration-options" style={profileShowcaseDurationOptionsStyle}>
                              {[
                                { value: "24h" as const, label: "24 hours", help: "Quick update" },
                                { value: "30d" as const, label: "30 days", help: "Recent feature" },
                                { value: "permanent" as const, label: "Permanent", help: "Until removed" },
                              ].map((option) => {
                                const selected = showcaseDuration === option.value;
                                return (
                                  <button
                                    className="profile-showcase-duration-option"
                                    key={option.value}
                                    type="button"
                                    onClick={() => setShowcaseDuration(option.value)}
                                    style={
                                      selected
                                        ? profileShowcaseDurationOptionActiveStyle
                                        : profileShowcaseDurationOptionStyle
                                    }
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
                            onClick={() => setShowcaseCustomizeOpen((value) => !value)}
                            style={
                              showcaseCustomizeOpen
                                ? profileShowcaseCustomizeButtonActiveStyle
                                : profileShowcaseCustomizeButtonStyle
                            }
                            aria-expanded={showcaseCustomizeOpen}
                          >
                            ⚙ Customize
                          </button>

                          {showcaseCustomizeOpen ? (
                            <div style={profileShowcaseCustomizePanelStyle}>
                              <div style={profileShowcaseCustomizeIntroStyle}>
                                <strong>Customize Showcase</strong>
                                <small>
                                  Add cover text, choose a font, then resize and drag it directly in the preview.
                                </small>
                              </div>

                              <label style={profileShowcaseFieldLabelStyle}>
                                Cover text <span style={profileShowcaseOptionalTextStyle}>Optional</span>
                                <textarea
                                  value={showcaseCoverText}
                                  onChange={(event) => setShowcaseCoverText(event.target.value)}
                                  placeholder="Add text over your Showcase"
                                  style={profileShowcaseTextareaStyle}
                                  rows={3}
                                />
                              </label>

                              <div style={profileShowcaseFontGroupStyle}>
                                <strong style={profileShowcaseDurationTitleStyle}>Text overlay font</strong>
                                <p style={profileShowcaseDurationHelpStyle}>
                                  This changes the text shown over your photo, video, or text Showcase.
                                </p>

                                <select
                                  className="profile-showcase-font-select"
                                  value={showcaseFontKey}
                                  onChange={(event) =>
                                    setShowcaseFontKey(event.target.value as ShowcaseFontValue)
                                  }
                                  style={profileShowcaseFontSelectStyle}
                                  aria-label="Choose Showcase font"
                                >
                                  {SHOWCASE_FONT_OPTIONS.map((font) => (
                                    <option key={font.value} value={font.value}>
                                      {font.label}
                                    </option>
                                  ))}
                                </select>

                                <div
                                  style={{
                                    ...profileShowcaseFontPreviewStyle,
                                    fontFamily: getShowcaseFontOption(showcaseFontKey).family,
                                    }}
                                >
                                  {showcaseCoverText.trim() || "Preview optional overlay text"}
                                </div>
</div>

                              <div style={profileShowcaseDurationGroupStyle}>
                                <div>
                                  <strong style={profileShowcaseDurationTitleStyle}>Visibility</strong>
                                  <p style={profileShowcaseDurationHelpStyle}>
                                    Choose who can see this Showcase.
                                  </p>
                                </div>

                                <div style={profileShowcaseVisibilityOptionsStyle}>
                                  {[
                                    {
                                      value: "public" as const,
                                      label: "Public",
                                      icon: "public",
                                      help: "Everyone",
                                    },
                                    {
                                      value: "friends" as const,
                                      label: "Friends",
                                      icon: "friends",
                                      help: "Friends only",
                                    },
                                    {
                                      value: "private" as const,
                                      label: "Only me",
                                      icon: "private",
                                      help: "Private",
                                    },
                                  ].map((option) => {
                                    const selected = showcaseVisibility === option.value;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setShowcaseVisibility(option.value)}
                                        style={
                                          selected
                                            ? profileShowcaseVisibilityOptionActiveStyle
                                            : profileShowcaseVisibilityOptionStyle
                                        }
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
                            {showcaseCustomizeOpen ? <small className="profile-showcase-preview-help">Drag text in Customize mode</small> : null}
                          </div>

                          <div
                            className="profile-showcase-preview-phone"
                            style={profileShowcasePreviewPhoneStyle}
                            role="button"
                            tabIndex={0}
                            aria-label={showcasePreviewExpanded ? "Return Showcase preview to normal size" : "Stretch Showcase preview"}
                            onClick={() => {
                              if (!showcaseCustomizeOpen) {
                                setShowcasePreviewExpanded((value) => !value);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (!showcaseCustomizeOpen && (event.key === "Enter" || event.key === " ")) {
                                event.preventDefault();
                                setShowcasePreviewExpanded((value) => !value);
                              }
                            }}
                            onPointerDown={showcaseCustomizeOpen ? handleShowcasePreviewPointerDown : undefined}
                            onPointerMove={showcaseCustomizeOpen ? handleShowcasePreviewPointerMove : undefined}
                            onPointerUp={showcaseCustomizeOpen ? handleShowcasePreviewPointerEnd : undefined}
                            onPointerCancel={showcaseCustomizeOpen ? handleShowcasePreviewPointerEnd : undefined}
                            onPointerLeave={showcaseCustomizeOpen ? handleShowcasePreviewPointerEnd : undefined}
                          >
                            {showcaseMediaPreviewUrl && showcaseMediaType === "image" ? (
                              <img
                                src={showcaseMediaPreviewUrl}
                                alt=""
                                style={profileShowcasePreviewMediaStyle}
                              />
                            ) : showcaseMediaPreviewUrl && showcaseMediaType === "video" ? (
                              <video
                                src={showcaseMediaPreviewUrl}
                                muted
                                playsInline
                                controls
                                style={profileShowcasePreviewMediaStyle}
                              />
                            ) : (
                              <div style={profileShowcasePreviewCanvasStyle} />
                            )}

                            <div style={profileShowcasePreviewOverlayStyle}>
                              {showcaseCustomizeOpen && showcaseCoverText.trim() ? (
                                <div style={profileShowcaseVerticalSizeRailStyle}>
<input
                                    className="profile-showcase-vertical-size-slider"
                                    type="range"
                                    min={SHOWCASE_OVERLAY_MIN_FONT_SIZE}
                                    max={SHOWCASE_OVERLAY_MAX_FONT_SIZE}
                                    step={1}
                                    value={showcaseOverlayFontSize}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onPointerMove={(event) => event.stopPropagation()}
                                    onChange={(event) =>
                                      setShowcaseOverlayFontSize(
                                        clampShowcaseOverlayFontSize(Number(event.target.value))
                                      )
                                    }
                                    style={profileShowcaseVerticalSizeSliderStyle}
                                    aria-label="Showcase text size"
                                  />
</div>
                              ) : null}

                              {showShowcaseCenterGuides ? (
                                <>
                                  <span style={profileShowcaseCenterGuideVerticalStyle} />
                                  <span style={profileShowcaseCenterGuideHorizontalStyle} />
                                </>
                              ) : null}

                              {showcaseCoverText.trim() ? (
                                <span
                                  ref={showcasePreviewTextRef}
                                  style={{
                                    ...profileShowcasePreviewTextStyle,
                                    left: `${safeShowcaseTextPosition.x}%`,
                                    top: `${safeShowcaseTextPosition.y}%`,
                                    fontFamily: getShowcaseFontOption(showcaseFontKey).family,
                                    fontSize: `${getShowcaseOverlayDisplayFontSize(showcaseCoverText.trim(), showcaseOverlayFontSize)}px`,
                                    width: getShowcaseOverlayTextWidth(showcaseCoverText.trim()),
                                    maxWidth: getShowcaseOverlayTextWidth(showcaseCoverText.trim()),
                                  }}
                                >
                                  {showcaseCoverText.trim()}
                                </span>
                              ) : null}

                              {showcaseCustomizeOpen && showcaseCoverText.trim() ? (
                                <small style={profileShowcaseDragHintStyle}>
                                  {showShowcaseCenterGuides ? "Centered" : "Drag text to move"}
                                </small>
                              ) : null}

                            </div>
                          </div>

                          <div style={profileShowcasePreviewMetaStyle}>
                            <span>
                              {showcaseCustomizeOpen
                                ? "Move text, choose font, and set visibility."
                                : showcaseCoverText.trim()
                                  ? "This is how your Showcase will look."
                                  : "Overlay text is optional. Use Customize if you want to add writing."}
                            </span>
                          </div>
                        </div>
                      </div>

                      {showcaseError ? (
                        <p style={profileShowcaseErrorStyle}>{showcaseError}</p>
                      ) : null}

                      <div className="profile-showcase-modal-actions" style={profileShowcaseModalActionsStyle}>
                        <button
                          type="button"
                          onClick={handleCloseShowcaseComposer}
                          style={profileShowcaseCancelButtonStyle}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateShowcase}
                          style={profileShowcaseCreateButtonStyle}
                        >
                          ✨ Create Showcase
                        </button>
                      </div>
                    </div>
                  </div>
                      ),
                      document.body
                    )
                  : null}

                {isClientMounted && activeProfileShowcase
                  ? createPortal(
                      (
                        <div
                          className="profile-showcase-viewer-overlay"
                          style={profileShowcaseViewerOverlayStyle}
                          role="dialog"
                          aria-modal="true"
                          aria-label={`${activeProfileShowcase.title} Showcase viewer`}
                          onClick={handleCloseShowcaseViewer}
                        >
                          <div
                            className="profile-showcase-viewer-shell"
                            style={profileShowcaseViewerShellStyle}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="profile-showcase-viewer-header" style={profileShowcaseViewerHeaderStyle}>
                              <div style={profileShowcaseViewerBrandStyle}>
                                <span style={profileShowcaseViewerLogoStyle}>
                                  <img
                                    src="/parapost-icon-white.png"
                                    alt=""
                                    aria-hidden="true"
                                    style={profileShowcaseModalLogoImageStyle}
                                  />
                                </span>
                                <span style={{ minWidth: 0 }}>
                                  <p style={profileShowcaseViewerEyebrowStyle}>Parapost Showcase</p>
                                  <h3 style={profileShowcaseViewerTitleStyle}>
                                    {activeProfileShowcase.title}
                                  </h3>
                                  <p style={profileShowcaseViewerMetaTextStyle}>
                                    {getShowcaseExpiryLabel(activeProfileShowcase)} · {getShowcaseDurationLabel(activeProfileShowcase.duration)}
                                  </p>
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={handleCloseShowcaseViewer}
                                style={profileShowcaseViewerCloseStyle}
                                aria-label="Close Showcase viewer"
                              >
                                ×
                              </button>
                            </div>

                            <div className="profile-showcase-viewer-stage" style={profileShowcaseViewerStageStyle}>
                              {activeProfileShowcase.mediaPreviewUrl && activeProfileShowcase.mediaType === "image" ? (
                                <img
                                  src={activeProfileShowcase.mediaPreviewUrl}
                                  alt=""
                                  style={profileShowcaseViewerMediaStyle}
                                />
                              ) : activeProfileShowcase.mediaPreviewUrl && activeProfileShowcase.mediaType === "video" ? (
                                <video
                                  src={activeProfileShowcase.mediaPreviewUrl}
                                  controls
                                  playsInline
                                  style={profileShowcaseViewerMediaStyle}
                                />
                              ) : (
                                <div style={profileShowcaseViewerCanvasStyle} />
                              )}

                              <div style={profileShowcaseViewerShadeStyle} />

                              {(activeProfileShowcase.coverText || "").trim() ? (
                                <span
                                  style={{
                                    ...profileShowcaseViewerOverlayTextStyle,
                                    left: `${getShowcaseSafeTextPosition(activeProfileShowcase.textPosition, (activeProfileShowcase.coverText || "").trim()).x}%`,
                                    top: `${getShowcaseSafeTextPosition(activeProfileShowcase.textPosition, (activeProfileShowcase.coverText || "").trim()).y}%`,
                                    width: getShowcaseOverlayTextWidth((activeProfileShowcase.coverText || "").trim()),
                                    maxWidth: getShowcaseOverlayTextWidth((activeProfileShowcase.coverText || "").trim()),
                                    fontFamily: getShowcaseFontOption(activeProfileShowcase.fontKey).family,
                                    fontSize: `${Math.min(
                                      48,
                                      Math.max(
                                        16,
                                        getShowcaseOverlayDisplayFontSize(
                                          (activeProfileShowcase.coverText || "").trim(),
                                          activeProfileShowcase.overlayFontSize
                                        )
                                      )
                                    )}px`,
                                  }}
                                >
                                  {(activeProfileShowcase.coverText || "").trim()}
                                </span>
                              ) : null}
                            </div>

                            <div className="profile-showcase-viewer-footer" style={profileShowcaseViewerFooterStyle}>
                              <div style={{ minWidth: 0 }}>
                                <strong style={profileShowcaseViewerFooterTitleStyle}>
                                  {activeProfileShowcase.title}
                                </strong>
                                <p style={profileShowcaseViewerFooterMetaStyle}>
                                  Visibility: {activeProfileShowcase.visibility || "public"} · {getShowcaseExpiryLabel(activeProfileShowcase)}
                                </p>
                              </div>

                              {canManageProfileShowcases ? (
                                <button
                                  type="button"
                                  className="profile-showcase-viewer-delete"
                                  onClick={() => handleDeleteShowcase(activeProfileShowcase.id)}
                                  style={profileShowcaseViewerDeleteButtonStyle}
                                >
                                  Delete Showcase
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ),
                      document.body
                    )
                  : null}

                {shouldShowProfileStarter ? (
                  <section className="profile-starter-card" style={profileStarterCardStyle} aria-label="Complete your profile">
                    <div style={profileStarterHeaderStyle}>
                      <div style={profileStarterIconStyle}>✦</div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={profileStarterEyebrowStyle}>New profile setup</p>
                        <h3 style={profileStarterTitleStyle}>Welcome to Parapost Network</h3>
                        <p style={profileStarterSubtitleStyle}>
                          Your profile is ready. Edit your profile details, then create your first post so people know this page is active.
                        </p>
                      </div>

                      <div style={profileStarterScoreStyle}>
                        <strong>{profileStarterPercent}%</strong>
                        <span>Complete</span>
                      </div>
                    </div>

                    <div style={profileStarterProgressTrackStyle}>
                      <span
                        style={{
                          ...profileStarterProgressFillStyle,
                          width: `${profileStarterPercent}%`,
                        }}
                      />
                    </div>

                    <div style={profileStarterChecklistStyle}>
                      <div style={profileStarterChecklistItemStyle}>
                        <span style={profileHasEditedBasics ? profileStarterStepDoneStyle : profileStarterStepTodoStyle}>
                          {profileHasEditedBasics ? "✓" : "1"}
                        </span>
                        <span>Edit your profile</span>
                      </div>

                      <div style={profileStarterChecklistItemStyle}>
                        <span style={profileHasFirstPost ? profileStarterStepDoneStyle : profileStarterStepTodoStyle}>
                          {profileHasFirstPost ? "✓" : "2"}
                        </span>
                        <span>Create your first post</span>
                      </div>
                    </div>

                    <div style={profileStarterActionsStyle}>
                      <button
                        type="button"
                        onClick={() => router.push(`/profile/${viewerId}/edit`)}
                        style={profileStarterPrimaryButtonStyle}
                      >
                        Edit Profile
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveProfileTab("Posts");
                          window.setTimeout(() => {
                            const composer = document.getElementById("profile-composer");
                            composer?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }, 80);
                        }}
                        style={profileStarterSecondaryButtonStyle}
                      >
                        Create First Post
                      </button>

                    </div>
                  </section>
                ) : null}

                <div className="profile-tabs-shell" style={profileTabsShellStyle}>
                  <div className="profile-tabs-desktop" style={profileTabsStyle}>
                    {profileTabItems.map((tab) => {
                      const isActive = activeProfileTab === tab.value;

                      return (
                        <button
                          key={tab.value}
                          type="button"
                          onClick={() => setActiveProfileTab(tab.value)}
                          style={isActive ? profileActiveTabStyle : profileTabStyle}
                          aria-pressed={isActive}
                          data-active={isActive ? "true" : "false"}
                        >
                          <span style={profileTabLabelStyle}>{tab.label}</span>
                          <small style={isActive ? profileActiveTabDetailStyle : profileTabDetailStyle}>
                            {tab.detail}
                          </small>
                        </button>
                      );
                    })}
                  </div>

                  <select
                    value={activeProfileTab}
                    onChange={(event) => setActiveProfileTab(event.target.value)}
                    style={profileMobileTabSelectStyle}
                    aria-label="Choose profile section"
                  >
                    {profileTabItems.map((tab) => (
                      <option key={tab.value} value={tab.value}>
                        {tab.label}
                      </option>
                    ))}
                  </select>

                  <div className="profile-tab-summary-card" style={profileTabSummaryStyle}>
                    <div style={profileTabSummaryIconStyle}>
                      {activeProfileTab === "Posts"
                        ? "✦"
                        : activeProfileTab === "About"
                          ? "i"
                          : activeProfileTab === "Reels"
                            ? "▶"
                            : activeProfileTab === "Photos"
                              ? "▧"
                              : "◇"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={profileTabSummaryEyebrowStyle}>Profile section</p>
                      <h3 style={profileTabSummaryTitleStyle}>{activeProfileTabItem.label}</h3>
                      <p style={profileTabSummaryMetaStyle}>{activeProfileTabItem.summary}</p>
                    </div>
                  </div>
                </div>

                {!loading && !errorMessage && profile && !isOwnProfile ? (
                  <div style={{ padding: "0 14px 14px" }}>
                    <MutualFriendsPreviewCard currentUserId={viewerId} profileUserId={profileId} />
                  </div>
                ) : null}
              </div>


              {activeProfileTab === "About" && (
                <div className="profile-content-card" style={mainCardStyle}>
                  <ProfileAboutSection
                    profile={profile}
                    isOwnProfile={isOwnProfile}
                    onSave={handleSaveProfileAbout}
                  />
                </div>
              )}

              {activeProfileTab === "Reels" ? (
                <div className="profile-content-card" style={mainCardStyle}>
                  <div style={aboutHeaderStyle}>
                    <div>
                      <h3 style={aboutTitleStyle}>Profile Reels</h3>
                      <p style={aboutSubtitleStyle}>
                        Short videos shared by this profile.
                      </p>
                    </div>
                    <Link href={`/profile/${profileId}/reels`} style={{ ...primaryButtonStyle, textDecoration: "none" }}>
                      Open Reels
                    </Link>
                  </div>

                  {reels.length === 0 ? (
                    <div className="profile-empty-state-card" style={profilePolishedEmptyStateStyle}>
                      <div style={profileEmptyStateIconStyle}>▶</div>
                      <strong style={profileEmptyStateTitleStyle}>
                        {isOwnProfile ? "No reels shared yet" : "No reels yet"}
                      </strong>
                      <span style={profileEmptyStateCopyStyle}>
                        {isOwnProfile
                          ? "Share your first Parapost Reel when you are ready to bring motion to your profile."
                          : "When this member shares reels, they will appear here."}
                      </span>
                      <div style={profileEmptyStateActionRowStyle}>
                        <Link href={`/profile/${profileId}/reels`} style={{ ...primaryButtonStyle, textDecoration: "none" }}>
                          Open Reels
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div style={miniReelGridStyle}>
                      {reels.slice(0, 6).map((reel) => (
                        <Link key={reel.id} href={`/profile/${profileId}/reels/view?reelId=${reel.id}`} style={miniReelTileStyle}>
                          {reel.video_url ? (
                            <video src={reel.video_url} muted playsInline preload="metadata" style={miniReelVideoStyle} />
                          ) : (
                            <span>Reel unavailable</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {activeProfileTab === "Photos" ? (
                <div className="profile-content-card" style={mainCardStyle}>
                  <ProfilePhotosSection
                    profileId={profileId}
                    viewerId={viewerId}
                    profile={profile}
                    posts={posts}
                    isOwnProfile={isOwnProfile}
                  />
                </div>
              ) : null}

              {!["Posts", "About", "Reels", "Photos"].includes(activeProfileTab) ? (
                <div className="profile-content-card" style={mainCardStyle}>
                  <div className="profile-empty-state-card" style={profilePolishedEmptyStateStyle}>
                    <div style={profileEmptyStateIconStyle}>◇</div>
                    <strong style={profileEmptyStateTitleStyle}>{activeProfileTab}</strong>
                    <span style={profileEmptyStateCopyStyle}>
                      This profile section is ready for a future Parapost Network feature pass.
                    </span>
                    <div style={profileEmptyStateMiniGridStyle}>
                      <span>Events</span>
                      <span>Creator updates</span>
                      <span>Community moments</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeProfileTab === "Posts" && isOwnProfile ? (
                <div id="profile-composer" className="profile-content-card profile-composer-card profile-composer-smooth" style={mainCardStyle}>
                  <div style={profileComposerHeaderStyle}>
                    <div style={profileComposerIconStyle}>✦</div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ margin: 0, color: "#ffffff", fontSize: "20px", letterSpacing: "-0.04em" }}>
                        Create a Post
                      </h3>
                      <p style={{ margin: "6px 0 0", color: "#9ca3af", fontSize: "13px", lineHeight: 1.55 }}>
                        Post to your profile and the homepage feed in one clean update.
                      </p>
                    </div>

                    <span style={profileComposerBadgeStyle}>Profile + Feed</span>
                  </div>

                  <textarea
                    className="profile-composer-textarea"
                    value={profilePostContent}
                    onChange={(event) => setProfilePostContent(event.target.value)}
                    placeholder="Share an update, photo, link, thought, or moment..."
                    rows={4}
                    style={profilePostTextAreaStyle}
                  />

                  <div className="profile-composer-media-box" style={profilePostMediaBoxStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: profilePostImagePreviewUrl ? "14px" : "0px",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 950, color: "#f9fafb", marginBottom: "4px" }}>
                          Add image
                        </div>
                        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af", lineHeight: 1.45 }}>
                          Optional. Keep images light while we are watching storage egress.
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => profilePostFileInputRef.current?.click()}
                          style={secondaryButtonStyle}
                        >
                          {profilePostImage ? "Change image" : "Upload image"}
                        </button>

                        {profilePostImage ? (
                          <button
                            type="button"
                            onClick={handleRemoveProfilePostImage}
                            style={profilePostDangerButtonStyle}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <input
                      ref={profilePostFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePostImageChange}
                      style={{ display: "none" }}
                    />

                    {profilePostImagePreviewUrl ? (
                      <img
                        src={profilePostImagePreviewUrl}
                        alt="Selected preview"
                        style={{
                          width: "100%",
                          maxHeight: "360px",
                          objectFit: "cover",
                          borderRadius: "22px",
                          border: "1px solid rgba(255,255,255,0.12)",
                          display: "block",
                          boxShadow: "0 16px 36px rgba(0,0,0,0.30)",
                        }}
                      />
                    ) : null}
                  </div>

                  <div style={profileComposerFooterStyle}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, color: "#8b93a4", fontSize: "13px", lineHeight: 1.55, fontWeight: 700 }}>
                        Appears on your profile and the homepage feed.
                      </p>
                      <p style={{ margin: "4px 0 0", color: "#626b7c", fontSize: "12px", lineHeight: 1.4 }}>
                        {profilePostContent.length} characters
                      </p>
                    </div>

                    <button
                      onClick={handleCreateProfilePost}
                      disabled={profilePostLoading || (!profilePostContent.trim() && !profilePostImage)}
                      style={{
                        ...primaryButtonStyle,
                        background: "linear-gradient(135deg, #ffffff, #e9d5ff)",
                        boxShadow: "0 12px 28px rgba(168,85,247,0.24)",
                        opacity: profilePostLoading || (!profilePostContent.trim() && !profilePostImage) ? 0.62 : 1,
                        cursor: profilePostLoading || (!profilePostContent.trim() && !profilePostImage) ? "not-allowed" : "pointer",
                      }}
                    >
                      {profilePostLoading ? "Posting..." : "Publish post"}
                    </button>
                  </div>
                </div>
              ) : null}

              {activeProfileTab === "Posts" ? (
                <div className="profile-content-card profile-feed-section-card" style={mainCardStyle}>
                  <div style={feedHeaderStyle}>
                    <div style={feedTitleBlockStyle}>
                      <span style={feedEyebrowStyle}>Timeline</span>
                      <h3 style={{ margin: 0, color: "#ffffff", fontSize: "22px", letterSpacing: "-0.045em" }}>
                        Profile Feed
                      </h3>
                      <p style={{ margin: "5px 0 0", color: "#9ca3af", fontSize: "13px", lineHeight: 1.55 }}>
                        Posts, updates, and shared reels from this profile.
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={feedCountPillStyle}>{posts.length} Posts</span>
                      <span style={feedCountPillStyle}>{sharedReelPosts.length} Reel Shares</span>
                      <Link
                        href="/dashboard"
                        style={{ ...secondaryButtonStyle, textDecoration: "none" }}
                      >
                        Back to feed
                      </Link>
                    </div>
                  </div>

                  {errorMessage ? (
                    <div style={messageBoxStyle}>{errorMessage}</div>
                  ) : !profile && !profileMissingForOwner ? (
                    <div style={messageBoxStyle}>This profile could not be found.</div>
                  ) : profileFeedItems.length === 0 ? (
                    <div className="profile-empty-state-card" style={profilePolishedEmptyStateStyle}>
                      <div style={profileEmptyStateIconStyle}>✦</div>
                      <strong style={profileEmptyStateTitleStyle}>
                        {isOwnProfile ? "Your first post goes here" : "No posts shared yet"}
                      </strong>
                      <span style={profileEmptyStateCopyStyle}>
                        {isOwnProfile
                          ? "Create your first post so your profile feels active the moment people visit."
                          : "When this profile shares posts or reels, they will appear here."}
                      </span>
                      <div style={profileEmptyStateActionRowStyle}>
                        {isOwnProfile ? (
                          <button
                            type="button"
                            onClick={() => {
                              const composer = document.getElementById("profile-composer");
                              composer?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                            style={primaryButtonStyle}
                          >
                            Create First Post
                          </button>
                        ) : (
                          <Link href="/dashboard" style={{ ...secondaryButtonStyle, textDecoration: "none" }}>
                            Back to feed
                          </Link>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={feedStackStyle}>
                      {profileFeedItems.map((item) => {
                        if (item.feedKind === "reel_share") {
                          const creatorName =
                            item.originalCreator?.full_name ||
                            item.originalCreator?.username ||
                            "Original creator";
                          const creatorHandle = item.originalCreator?.username || "creator";

                          return (
                            <article
                              key={item.id}
                              style={{ ...postCardStyle, position: "relative" }}
                              onMouseEnter={(event) => {
                                event.currentTarget.style.transform = "translateY(-1px)";
                                event.currentTarget.style.borderColor = "rgba(168,85,247,0.30)";
                                event.currentTarget.style.boxShadow = "0 22px 52px rgba(0,0,0,0.34)";
                              }}
                              onMouseLeave={(event) => {
                                event.currentTarget.style.transform = "translateY(0)";
                                event.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                                event.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.26)";
                              }}
                            >
                              <header style={postHeaderStyle}>
                                <div style={{ ...postAuthorAvatarStyle, ...(profile?.is_online ? postAuthorAvatarOnlineStyle : postAuthorAvatarOfflineStyle) }}>
                                  {profile?.avatar_url ? (
                                    <img src={profile?.avatar_url || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  ) : (
                                    <span style={postAuthorFallbackStyle}>{profileDisplayInitial || "P"}</span>
                                  )}
                                </div>

                                <div style={postAuthorTextStyle}>
                                  <strong style={postAuthorNameStyle}>
                                    {profileDisplayName || "Parapost Member"}
                                  </strong>
                                  <span style={postMetaStyle}>
                                    @{profileDisplayUsername || "new-member"} shared a reel · {formatTimeAgo(item.created_at)}
                                  </span>
                                </div>

                                {isOwnProfile ? (
                                  <button
                                    onClick={() => handleRemoveSharedReel(item.id)}
                                    style={sharedReelRemoveButtonStyle}
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </header>

                              {item.caption ? (
                                <p style={postContentStyle}>{renderLinkedText(item.caption)}</p>
                              ) : null}

                              <div className="profile-shared-reel-card" style={sharedReelCardStyle}>
                                <Link
                                  href={`/reels?reel=${item.reel_id}`}
                                  style={sharedReelPreviewStyle}
                                  aria-label="View shared reel"
                                >
                                  {item.reel?.video_url ? (
                                    <video
                                      src={item.reel.video_url}
                                      poster={item.reel.poster_url || undefined}
                                      muted
                                      playsInline
                                      preload="metadata"
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                        background: "#000",
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        display: "grid",
                                        placeItems: "center",
                                        color: "#9ca3af",
                                        background: "#05070a",
                                        textAlign: "center",
                                        padding: "12px",
                                      }}
                                    >
                                      Reel unavailable
                                    </div>
                                  )}

                                  <div style={sharedReelPlayOverlayStyle}>
                                    <span style={sharedReelPlayButtonStyle}>▶</span>
                                  </div>
                                </Link>

                                <div style={{ flex: 1, minWidth: "210px" }}>
                                  <div style={sharedReelBadgeStyle}>Parapost Reel</div>

                                  <h4
                                    style={{
                                      margin: "12px 0 7px",
                                      color: "#f9fafb",
                                      fontSize: "20px",
                                      lineHeight: 1.22,
                                      letterSpacing: "-0.035em",
                                    }}
                                  >
                                    {item.reel?.title || "Parapost Reel"}
                                  </h4>

                                  <p style={sharedReelMetaStyle}>
                                    Original by {creatorName} @{creatorHandle}
                                  </p>

                                  {item.reel?.caption ? (
                                    <p style={{ ...sharedReelMetaStyle, marginTop: "8px" }}>
                                      {item.reel.caption}
                                    </p>
                                  ) : null}

                                  <Link href={`/reels?reel=${item.reel_id}`} style={sharedReelActionLinkStyle}>
                                    View Reel
                                  </Link>
                                </div>
                              </div>
                            </article>
                          );
                        }

                        const post = item;
                        const liked = !!userLikes[post.id];
                        const likeCount = likeCounts[post.id] || 0;
                        const isPostOwner = viewerId === post.user_id;
                        const isEditingPost = editingPostId === post.id;

                        return (
                          <article
                            key={post.id}
                            className="profile-feed-card profile-feed-post-card"
                            style={{ ...profileNormalPostCardStyle, position: "relative" }}
                            onMouseEnter={(event) => {
                              event.currentTarget.style.transform = "translateY(-1px)";
                              event.currentTarget.style.borderColor = "rgba(168,85,247,0.24)";
                              event.currentTarget.style.boxShadow = "0 16px 34px rgba(0,0,0,0.24)";
                            }}
                            onMouseLeave={(event) => {
                              event.currentTarget.style.transform = "translateY(0)";
                              event.currentTarget.style.borderColor = "rgba(255,255,255,0.095)";
                              event.currentTarget.style.boxShadow = "0 10px 24px rgba(0,0,0,0.20)";
                            }}
                          >
                            <header style={postHeaderStyle}>
                              <div style={{ ...postAuthorAvatarStyle, ...(profile?.is_online ? postAuthorAvatarOnlineStyle : postAuthorAvatarOfflineStyle) }}>
                                {profile?.avatar_url ? (
                                  <img src={profile?.avatar_url || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <span style={postAuthorFallbackStyle}>{profileDisplayInitial || "P"}</span>
                                )}
                              </div>

                              <div style={postAuthorTextStyle}>
                                <strong style={postAuthorNameStyle}>
                                  {profileDisplayName || "Parapost Member"}
                                </strong>
                                <span style={postMetaStyle}>
                                  @{profileDisplayUsername || "new-member"} · {formatTimeAgo(post.created_at)}
                                </span>
                              </div>

                              {isPostOwner ? (
                                <div style={{ position: "relative", flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      setOpenPostMenuId((prev) => (prev === post.id ? null : post.id));
                                    }}
                                    style={dotsButtonStyle}
                                    aria-label="Open post menu"
                                  >
                                    ⋯
                                  </button>

                                  {openPostMenuId === post.id ? (
                                    <div style={postMenuStyle} onClick={(event) => event.stopPropagation()}>
                                      <button style={menuItemStyle} onClick={() => handleStartEditPost(post)}>
                                        Edit post
                                      </button>
                                      <button
                                        style={{ ...menuItemStyle, color: "#fca5a5", borderBottomColor: "transparent" }}
                                        onClick={() => handleDeletePost(post.id)}
                                      >
                                        Delete post
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </header>

                            {isEditingPost ? (
                              <div style={{ display: "grid", gap: "12px", marginTop: "14px" }}>
                                <textarea
                                  value={editingPostContent}
                                  onChange={(event) => setEditingPostContent(event.target.value)}
                                  rows={4}
                                  style={profilePostTextAreaStyle}
                                />

                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
                                  <button type="button" onClick={handleCancelPostEdit} style={secondaryButtonStyle}>
                                    Cancel
                                  </button>
                                  <button type="button" onClick={() => handleSavePostEdit(post.id)} style={primaryButtonStyle}>
                                    Save changes
                                  </button>
                                </div>
                              </div>
                            ) : post.content ? (
                              <>
                                <p style={postContentStyle}>{renderLinkedText(post.content)}</p>
                                <LinkPreviewCard text={post.content} />
                              </>
                            ) : null}

                            {post.image_url ? (
                              <img src={post.image_url} alt="Post" className="profile-post-image" style={postImageStyle} />
                            ) : null}

                            <div style={postActionsRowStyle}>
                              <button
                                onClick={() => handleLikeToggle(post.id)}
                                style={liked ? postLikeButtonActiveStyle : actionButtonStyle}
                                aria-pressed={liked}
                              >
                                <span>{liked ? "♥" : "♡"}</span>
                                <span>{likeCount}</span>
                              </button>

                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="hidden xl:flex" style={rightRailStyle}>
            <div style={rightPanelCardStyle}>
              <div style={rightPanelHeaderStyle}>
                <h3 style={rightPanelTitleStyle}>Profile Strength</h3>
                <span style={miniPurpleLinkStyle}>Great Job</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={profileStrengthRingStyle}>
                  <span style={{ fontSize: "20px", fontWeight: 900 }}>85%</span>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#67e8f9", fontWeight: 900, marginBottom: "4px" }}>
                    Strong Profile
                  </div>
                  <p style={rightPanelTextStyle}>
                    Keep your bio, links, reels, and posts active to help people discover your profile.
                  </p>
                </div>
              </div>

              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => router.push(`/profile/${viewerId}/edit`)}
                  style={wideGlassButtonStyle}
                >
                  Improve Profile
                </button>
              ) : null}
            </div>

            <div style={rightPanelCardStyle}>
              <div style={rightPanelHeaderStyle}>
                <h3 style={rightPanelTitleStyle}>Achievements</h3>
                <span style={miniPurpleLinkStyle}>See all</span>
              </div>

              <div style={achievementGridStyle}>
                <div style={achievementItemStyle}>
                  <div style={{ ...achievementIconStyle, borderColor: "rgba(168,85,247,0.60)", color: "#c084fc" }}>👻</div>
                  <strong>Investigator</strong>
                  <span>Level 10</span>
                </div>

                <div style={achievementItemStyle}>
                  <div style={{ ...achievementIconStyle, borderColor: "rgba(34,211,238,0.60)", color: "#67e8f9" }}>📘</div>
                  <strong>Case Solver</strong>
                  <span>Level 7</span>
                </div>

                <div style={achievementItemStyle}>
                  <div style={{ ...achievementIconStyle, borderColor: "rgba(34,197,94,0.60)", color: "#86efac" }}>🛡</div>
                  <strong>Truth Seeker</strong>
                  <span>Level 6</span>
                </div>

                <div style={achievementItemStyle}>
                  <div style={{ ...achievementIconStyle, borderColor: "rgba(248,113,113,0.60)", color: "#fca5a5" }}>🎥</div>
                  <strong>Evidence Finder</strong>
                  <span>Level 5</span>
                </div>
              </div>
            </div>

            <div style={rightPanelCardStyle}>
              <div style={rightPanelHeaderStyle}>
                <h3 style={rightPanelTitleStyle}>My Badges</h3>
                <span style={miniPurpleLinkStyle}>12 total</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
                {["👻", "🧭", "🏆", "🔴", "🧿"].map((badge, index) => (
                  <div key={index} style={badgeBubbleStyle}>
                    {badge}
                  </div>
                ))}
                <div style={{ ...badgeBubbleStyle, color: "#d1d5db", background: "rgba(255,255,255,0.06)" }}>
                  +8
                </div>
              </div>
            </div>

            <div style={rightPanelCardStyle}>
              <div style={rightPanelHeaderStyle}>
                <h3 style={rightPanelTitleStyle}>Recent Visitors</h3>
                <span style={miniPurpleLinkStyle}>See all</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {[profile, profile, profile, null, null].map((visitor, index) => (
                  <div key={index} style={visitorAvatarStyle}>
                    {visitor?.avatar_url ? (
                      <img
                        src={visitor.avatar_url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                      />
                    ) : (
                      <span>{index === 4 ? "👻" : getInitial(profile?.full_name, profile?.username)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={rightPanelCardStyle}>
              <div style={rightPanelHeaderStyle}>
                <h3 style={rightPanelTitleStyle}>Profile Activity</h3>
                <span style={profile?.is_online ? onlineStatusPillStyle : offlineStatusPillStyle}>
                  {profile?.is_online ? "Online" : "Offline"}
                </span>
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                <div style={activityRowStyle}>
                  <span>Posts</span>
                  <strong>{posts.length}</strong>
                </div>
                <div style={activityRowStyle}>
                  <span>Reels</span>
                  <strong>{reels.length}</strong>
                </div>
                <div style={activityRowStyle}>
                  <span>Followers</span>
                  <strong>{followersCount}</strong>
                </div>
                {!isOwnProfile && viewerId ? (
                  <div style={activityRowStyle}>
                    <span>Friend Status</span>
                    <strong>{getFriendStatusLabel()}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>
      {profileActionsOpen ? (
        <div
          className="profile-desktop-action-menu-fixed"
          style={{
            ...profileDesktopActionMenuFixedStyle,
            top: profileActionMenuPosition.top,
            left: profileActionMenuPosition.left,
            maxHeight: profileActionMenuPosition.maxHeight,
            overflowY: "scroll",
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          onScroll={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          <div style={profileDesktopActionMenuHeaderStyle}>
            <p style={profileActionEyebrowStyle}>Profile options</p>
            <strong>
              {profile?.full_name || profile?.username || "Profile"}
            </strong>
          </div>

          {isOwnProfile ? (
            <button
              type="button"
              onClick={() => {
                setProfileActionsOpen(false);
                router.push(`/profile/${viewerId}/edit`);
              }}
              style={profileDesktopActionItemStyle}
            >
              <span style={profileActionIconStyle}>✎</span>
              <span>
                <strong>Edit profile</strong>
                <small>Edit avatar, bio, and profile details</small>
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => handleOpenProfileSection("Posts")}
            style={profileDesktopActionItemStyle}
          >
            <span style={profileActionIconStyle}>▤</span>
            <span>
              <strong>View posts</strong>
              <small>Go to profile feed</small>
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenProfileSection("Photos")}
            style={profileDesktopActionItemStyle}
          >
            <span style={profileActionIconStyle}>▧</span>
            <span>
              <strong>View photos</strong>
              <small>Open photo grid</small>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileActionsOpen(false);
              router.push(`/profile/${profileId}/reels`);
            }}
            style={profileDesktopActionItemStyle}
          >
            <span style={profileActionIconStyle}>▣</span>
            <span>
              <strong>Open reels</strong>
              <small>View short videos</small>
            </span>
          </button>

          <button
            type="button"
            onClick={handleCopyProfileLink}
            style={profileDesktopActionItemStyle}
          >
            <span style={profileActionIconStyle}>↗</span>
            <span>
              <strong>Copy profile link</strong>
              <small>Copy this profile URL</small>
            </span>
          </button>

          <button
            type="button"
            onClick={handleShareProfile}
            style={profileDesktopActionItemStyle}
          >
            <span style={profileActionIconStyle}>⇪</span>
            <span>
              <strong>Share profile</strong>
              <small>Open your device share options</small>
            </span>
          </button>

          {!isOwnProfile ? (
            <>
              <button
                type="button"
                onClick={handleReportProfile}
                style={profileDesktopActionItemStyle}
              >
                <span style={profileActionIconStyle}>⚑</span>
                <span>
                  <strong>Report profile</strong>
                  <small>Send this profile to moderation</small>
                </span>
              </button>

              <button
                type="button"
                onClick={handleBlockProfile}
                style={profileDesktopLogoutActionItemStyle}
              >
                <span style={profileActionLogoutIconStyle}>⊘</span>
                <span>
                  <strong>Block user</strong>
                  <small>Limit future interaction with this person</small>
                </span>
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setProfileActionsOpen(false);
              router.push("/dashboard");
            }}
            style={profileDesktopActionItemStyle}
          >
            <span style={profileActionIconStyle}>⌂</span>
            <span>
              <strong>Back to feed</strong>
              <small>Return to homepage feed</small>
            </span>
          </button>

          {viewerId && isOwnProfile ? (
            <button
              type="button"
              onClick={handleProfileLogout}
              style={profileDesktopLogoutActionItemStyle}
            >
              <span style={profileActionLogoutIconStyle}>↪</span>
              <span>
                <strong>Log out</strong>
                <small>Sign out of Parapost Network</small>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      {profileActionsOpen && profileIsReady ? (
        <div
          className="profile-mobile-action-overlay"
          style={profileActionOverlayStyle}
          onClick={() => setProfileActionsOpen(false)}
        >
          <div
            ref={profileActionSheetRef}
            className="profile-mobile-action-sheet"
            style={profileActionSheetStyle}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div style={profileActionGrabberStyle} />

            <div style={profileActionHeaderStyle}>
              <div>
                <p style={profileActionEyebrowStyle}>Profile options</p>
                <h3 style={profileActionTitleStyle}>
                  {profileDisplayName || "\u00A0"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setProfileActionsOpen(false)}
                style={profileActionCloseStyle}
                aria-label="Close profile options"
              >
                ×
              </button>
            </div>

            <div className="profile-mobile-action-list" style={profileActionGridStyle}>
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setProfileActionsOpen(false);
                    router.push(`/profile/${viewerId}/edit`);
                  }}
                  style={profileActionItemStyle}
                >
                  <span style={profileActionIconStyle}>✎</span>
                  <span>
                    <strong>Edit profile</strong>
                    <small>Update avatar, bio, and details</small>
                  </span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => handleOpenProfileSection("Posts")}
                style={profileActionItemStyle}
              >
                <span style={profileActionIconStyle}>▤</span>
                <span>
                  <strong>View posts</strong>
                  <small>Go back to the profile feed</small>
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenProfileSection("Photos")}
                style={profileActionItemStyle}
              >
                <span style={profileActionIconStyle}>▧</span>
                <span>
                  <strong>View photos</strong>
                  <small>Open this profile’s photo grid</small>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileActionsOpen(false);
                  router.push(`/profile/${profileId}/reels`);
                }}
                style={profileActionItemStyle}
              >
                <span style={profileActionIconStyle}>▣</span>
                <span>
                  <strong>Open reels</strong>
                  <small>View this profile’s short videos</small>
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopyProfileLink}
                style={profileActionItemStyle}
              >
                <span style={profileActionIconStyle}>↗</span>
                <span>
                  <strong>Copy profile link</strong>
                  <small>Copy this profile URL</small>
                </span>
              </button>

              <button
                type="button"
                onClick={handleShareProfile}
                style={profileActionItemStyle}
              >
                <span style={profileActionIconStyle}>⇪</span>
                <span>
                  <strong>Share profile</strong>
                  <small>Open your phone share options</small>
                </span>
              </button>

              {!isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={handleReportProfile}
                    style={profileActionItemStyle}
                  >
                    <span style={profileActionIconStyle}>⚑</span>
                    <span>
                      <strong>Report profile</strong>
                      <small>Send this profile to moderation</small>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBlockProfile}
                    style={profileMobileLogoutActionItemStyle}
                  >
                    <span style={profileActionLogoutIconStyle}>⊘</span>
                    <span>
                      <strong>Block user</strong>
                      <small>Limit future interaction with this person</small>
                    </span>
                  </button>
                </>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setProfileActionsOpen(false);
                  router.push("/dashboard");
                }}
                style={profileActionItemStyle}
              >
                <span style={profileActionIconStyle}>⌂</span>
                <span>
                  <strong>Back to feed</strong>
                  <small>Return to the main Parapost feed</small>
                </span>
              </button>

              {viewerId && isOwnProfile ? (
                <button
                  type="button"
                  onClick={handleProfileLogout}
                  style={profileMobileLogoutActionItemStyle}
                >
                  <span style={profileActionLogoutIconStyle}>↪</span>
                  <span>
                    <strong>Log out</strong>
                    <small>Sign out of Parapost Network</small>
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!showcaseComposerOpen ? (
        <BottomNav
        currentUserId={viewerId}
        activeItem="profile"
        onCreatePost={handleMobileCreatePostClick}
      />
    ) : null}
    </div>
  );
}   

const profileStarterCardStyle: CSSProperties = {
  margin: "14px 14px 16px",
  padding: "16px",
  borderRadius: "24px",
  border: "1px solid rgba(216,180,254,0.22)",
  background:
    "linear-gradient(135deg, rgba(88,28,135,0.34), rgba(17,24,39,0.86) 54%, rgba(6,8,14,0.92))",
  boxShadow: "0 22px 54px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)",
  position: "relative",
  overflow: "hidden",
};

const profileStarterHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  position: "relative",
  zIndex: 1,
};

const profileStarterIconStyle: CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "16px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 950,
  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
  boxShadow: "0 16px 36px rgba(168,85,247,0.34), inset 0 1px 0 rgba(255,255,255,0.22)",
};

const profileStarterEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#d8b4fe",
  fontSize: "11px",
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.18em",
};

const profileStarterTitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#ffffff",
  fontSize: "20px",
  lineHeight: 1.15,
  letterSpacing: "-0.045em",
  fontWeight: 950,
};

const profileStarterSubtitleStyle: CSSProperties = {
  margin: "7px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  lineHeight: 1.55,
  maxWidth: "720px",
};

const profileStarterScoreStyle: CSSProperties = {
  minWidth: "82px",
  padding: "9px 10px",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  textAlign: "center",
  flexShrink: 0,
};

const profileStarterProgressTrackStyle: CSSProperties = {
  height: "8px",
  marginTop: "14px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const profileStarterProgressFillStyle: CSSProperties = {
  display: "block",
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #7c3aed, #a855f7, #ec4899)",
  boxShadow: "0 0 22px rgba(168,85,247,0.45)",
  transition: "width 180ms ease",
};

const profileStarterChecklistStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px",
  marginTop: "14px",
};

const profileStarterChecklistItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "42px",
  padding: "9px 10px",
  borderRadius: "15px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.055)",
  color: "#e5e7eb",
  fontSize: "12px",
  fontWeight: 850,
  minWidth: 0,
};

const profileStarterStepTodoStyle: CSSProperties = {
  width: "23px",
  height: "23px",
  borderRadius: "999px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  color: "#d8b4fe",
  fontSize: "11px",
  fontWeight: 950,
  border: "1px solid rgba(216,180,254,0.30)",
  background: "rgba(88,28,135,0.30)",
};

const profileStarterStepDoneStyle: CSSProperties = {
  ...profileStarterStepTodoStyle,
  color: "#ffffff",
  border: "1px solid rgba(134,239,172,0.42)",
  background: "linear-gradient(135deg, rgba(34,197,94,0.88), rgba(20,184,166,0.72))",
};

const profileStarterActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
};

const profileStarterPrimaryButtonStyle: CSSProperties = {
  border: "0",
  minHeight: "40px",
  borderRadius: "14px",
  padding: "0 16px",
  cursor: "pointer",
  color: "#1f1235",
  fontSize: "13px",
  fontWeight: 950,
  background: "linear-gradient(135deg, #ffffff, #e9d5ff)",
  boxShadow: "0 14px 30px rgba(168,85,247,0.22)",
};

const profileStarterSecondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  minHeight: "40px",
  borderRadius: "14px",
  padding: "0 14px",
  cursor: "pointer",
  color: "#f8fafc",
  fontSize: "13px",
  fontWeight: 900,
  background: "rgba(255,255,255,0.07)",
};

function getFriendStatusPillStyle(friendStatus: FriendRequestStatus): CSSProperties {
  if (friendStatus === "friends") {
    return {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "34px",
      padding: "0 12px",
      borderRadius: "999px",
      color: "#86efac",
      background: "rgba(34,197,94,0.10)",
      border: "1px solid rgba(34,197,94,0.24)",
      fontWeight: 700,
      fontSize: "12px",
    };
  }

  if (friendStatus === "incoming_request") {
    return {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "34px",
      padding: "0 12px",
      borderRadius: "999px",
      color: "#fcd34d",
      background: "rgba(250,204,21,0.10)",
      border: "1px solid rgba(250,204,21,0.24)",
      fontWeight: 700,
      fontSize: "12px",
    };
  }

  if (friendStatus === "outgoing_request") {
    return {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "34px",
      padding: "0 12px",
      borderRadius: "999px",
      color: "#c4b5fd",
      background: "rgba(139,92,246,0.10)",
      border: "1px solid rgba(139,92,246,0.24)",
      fontWeight: 700,
      fontSize: "12px",
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "34px",
    padding: "0 12px",
    borderRadius: "999px",
    color: "#d1d5db",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontWeight: 700,
    fontSize: "12px",
  };
}

const mainCardStyle: CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.044) 0%, rgba(255,255,255,0.024) 100%)",
  borderRadius: "18px",
  padding: "20px",
  border: "1px solid rgba(255,255,255,0.09)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
  transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
};

const sideCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.028)",
  borderRadius: "18px",
  padding: "18px",
  border: "1px solid rgba(255,255,255,0.085)",
  boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
  height: "fit-content",
};

const postCardStyle: CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.064) 0%, rgba(255,255,255,0.034) 58%, rgba(168,85,247,0.035) 100%)",
  border: "1px solid rgba(255,255,255,0.115)",
  borderRadius: "24px",
  padding: "18px",
  boxShadow: "0 18px 46px rgba(0,0,0,0.28)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  transition: "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
};

const profileNormalPostCardStyle: CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.046) 0%, rgba(255,255,255,0.024) 100%)",
  border: "1px solid rgba(255,255,255,0.095)",
  borderRadius: "18px",
  padding: "16px",
  boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  transition: "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
};

const profileComposerHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
  marginBottom: "16px",
  paddingBottom: "14px",
  borderBottom: "1px solid rgba(255,255,255,0.075)",
};

const profileComposerIconStyle: CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "18px",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  background:
    "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.24), transparent 34%), linear-gradient(135deg, #a855f7, #7c3aed 58%, #2563eb)",
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: 950,
  boxShadow: "0 16px 36px rgba(168,85,247,0.30), inset 0 1px 0 rgba(255,255,255,0.16)",
};

const profileComposerBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "34px",
  borderRadius: "999px",
  border: "1px solid rgba(168,85,247,0.24)",
  background: "rgba(168,85,247,0.12)",
  color: "#e9d5ff",
  padding: "7px 12px",
  fontSize: "12px",
  fontWeight: 950,
  letterSpacing: "0.01em",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
};

const profileComposerFooterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "14px",
  paddingTop: "14px",
  borderTop: "1px solid rgba(255,255,255,0.065)",
};

const feedHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
  marginBottom: "16px",
  paddingBottom: "14px",
  borderBottom: "1px solid rgba(255,255,255,0.075)",
};

const feedTitleBlockStyle: CSSProperties = {
  minWidth: 0,
};

const feedEyebrowStyle: CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  marginBottom: "6px",
  color: "#c084fc",
  fontSize: "11px",
  fontWeight: 950,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const feedCountPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "36px",
  borderRadius: "999px",
  border: "1px solid rgba(168,85,247,0.22)",
  background: "rgba(168,85,247,0.10)",
  color: "#e9d5ff",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 900,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};

const feedStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "13px",
};

const feedEmptyStateStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  gap: "4px",
  minHeight: "220px",
  borderRadius: "26px",
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.035)",
  textAlign: "center",
  padding: "28px 18px",
};

const postHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "11px",
  marginBottom: "12px",
  paddingBottom: "10px",
  borderBottom: "1px solid rgba(255,255,255,0.055)",
};

const postAuthorAvatarStyle: CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "14px",
  overflow: "hidden",
  flexShrink: 0,
  border: "1px solid rgba(168,85,247,0.34)",
  background: "#05070a",
  boxShadow: "0 8px 18px rgba(0,0,0,0.22)",
};

const postAuthorAvatarOnlineStyle: CSSProperties = {
  border: "1px solid rgba(34,211,238,0.72)",
  boxShadow:
    "0 0 0 1px rgba(168,85,247,0.22), 0 0 16px rgba(34,211,238,0.14)",
};

const postAuthorAvatarOfflineStyle: CSSProperties = {
  border: "1px solid rgba(168,85,247,0.34)",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.055), 0 8px 18px rgba(0,0,0,0.22)",
};

const postAuthorFallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #7c3aed, #111827)",
  color: "#ffffff",
  fontWeight: 950,
};

const postAuthorTextStyle: CSSProperties = {
  minWidth: 0,
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const postAuthorNameStyle: CSSProperties = {
  color: "#f9fafb",
  fontWeight: 950,
  fontSize: "16px",
  lineHeight: 1.22,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const postMetaStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  fontWeight: 750,
  lineHeight: 1.45,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const postContentStyle: CSSProperties = {
  margin: "10px 0 2px",
  whiteSpace: "pre-wrap",
  lineHeight: 1.7,
  color: "#f3f4f6",
  fontSize: "15px",
  fontWeight: 500,
  letterSpacing: "-0.006em",
};

const postImageStyle: CSSProperties = {
  width: "100%",
  maxHeight: "720px",
  marginTop: "14px",
  borderRadius: "16px",
  objectFit: "cover",
  display: "block",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 12px 26px rgba(0,0,0,0.28)",
};

const postActionsRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "10px",
  marginTop: "14px",
  paddingTop: "12px",
  borderTop: "1px solid rgba(255,255,255,0.055)",
  flexWrap: "wrap",
};

const postLikeButtonActiveStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "7px",
  borderRadius: "12px",
  border: "1px solid rgba(236,72,153,0.32)",
  background: "linear-gradient(135deg, rgba(236,72,153,0.14), rgba(168,85,247,0.10))",
  color: "#fbcfe8",
  padding: "8px 12px",
  cursor: "pointer",
  minHeight: "36px",
  fontWeight: 850,
  boxShadow: "0 8px 18px rgba(236,72,153,0.10)",
  transition: "transform 160ms ease, filter 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
};

const postSubtleMetaPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "34px",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  color: "#9ca3af",
  padding: "7px 11px",
  fontSize: "12px",
  fontWeight: 850,
};

const navItemStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#f9fafb",
  fontWeight: 500,
};

const navItemLinkStyle: CSSProperties = {
  ...navItemStyle,
  textDecoration: "none",
  display: "block",
};

const primaryButtonStyle: CSSProperties = {
  background: "white",
  color: "black",
  border: "none",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: "42px",
  transition: "transform 160ms ease, filter 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const secondaryButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: 600,
  cursor: "pointer",
  minHeight: "42px",
  transition: "transform 160ms ease, filter 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const miniLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "34px",
  padding: "0 12px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.05)",
  color: "#f9fafb",
  border: "1px solid rgba(255,255,255,0.10)",
  textDecoration: "none",
  fontSize: "12px",
  fontWeight: 700,
};

const statusToastStyle: CSSProperties = {
  marginTop: "14px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#f9fafb",
  borderRadius: "18px",
  padding: "10px 12px",
  fontSize: "13px",
};

const actionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "7px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.040)",
  color: "#f9fafb",
  padding: "8px 12px",
  cursor: "pointer",
  minHeight: "36px",
  fontWeight: 850,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.028)",
  transition: "transform 160ms ease, filter 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
};

const statPillStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "20px",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const statNumberStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "20px",
  lineHeight: 1,
};

const statLabelStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const pillMutedStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "#d1d5db",
  padding: "8px 12px",
  fontSize: "12px",
};

const sharedReelCardStyle: CSSProperties = {
  marginTop: "16px",
  display: "flex",
  gap: "16px",
  alignItems: "center",
  flexWrap: "wrap",
  borderRadius: "28px",
  border: "1px solid rgba(168,85,247,0.24)",
  background:
    "linear-gradient(135deg, rgba(168,85,247,0.16), rgba(0,0,0,0.38) 48%, rgba(34,211,238,0.10))",
  padding: "15px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 16px 40px rgba(0,0,0,0.24)",
};

const sharedReelPreviewStyle: CSSProperties = {
  width: "clamp(150px, 34vw, 220px)",
  aspectRatio: "9 / 16",
  maxHeight: "370px",
  borderRadius: "23px",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#000",
  boxShadow: "0 18px 42px rgba(0,0,0,0.40)",
  flexShrink: 0,
  position: "relative",
  display: "block",
};

const profilePostTextAreaStyle: CSSProperties = {
  width: "100%",
  background:
    "linear-gradient(180deg, rgba(3,7,18,0.62), rgba(12,15,22,0.58))",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "22px",
  padding: "17px 18px",
  fontSize: "15px",
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
  lineHeight: 1.65,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 26px rgba(0,0,0,0.18)",
};

const profilePostMediaBoxStyle: CSSProperties = {
  marginTop: "12px",
  border: "1px solid rgba(168,85,247,0.16)",
  borderRadius: "24px",
  background:
    "radial-gradient(circle at 0% 0%, rgba(168,85,247,0.10), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.050), rgba(255,255,255,0.022))",
  padding: "15px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};

const profilePostDangerButtonStyle: CSSProperties = {
  background: "rgba(248,113,113,0.08)",
  color: "#fecaca",
  border: "1px solid rgba(248,113,113,0.22)",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: 850,
  cursor: "pointer",
  minHeight: "42px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};


const dotsButtonStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.07)",
  color: "#f9fafb",
  cursor: "pointer",
  fontSize: "20px",
  lineHeight: 1,
  display: "grid",
  placeItems: "center",
  transition: "transform 160ms ease, filter 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease",
};

const postMenuStyle: CSSProperties = {
  position: "absolute",
  top: "44px",
  right: 0,
  zIndex: 20,
  minWidth: "176px",
  background: "rgba(8,12,20,0.98)",
  border: "1px solid rgba(255,255,255,0.13)",
  borderRadius: "18px",
  overflow: "hidden",
  boxShadow: "0 20px 40px rgba(0,0,0,0.42)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
};

const menuItemStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  color: "#f9fafb",
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: "1px",
  borderLeftWidth: 0,
  borderStyle: "solid",
  borderTopColor: "transparent",
  borderRightColor: "transparent",
  borderBottomColor: "rgba(255,255,255,0.07)",
  borderLeftColor: "transparent",
  padding: "12px 14px",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 800,
};

const messageBoxStyle: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#f9fafb",
  borderRadius: "20px",
  padding: "14px",
};


const sharedReelBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  width: "fit-content",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.06)",
  color: "#d1d5db",
  padding: "7px 10px",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.01em",
};

const sharedReelPreviewFrameStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: "22px",
  border: "1px solid rgba(255,255,255,0.11)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)",
  boxShadow: "0 14px 34px rgba(0,0,0,0.34)",
};

const sharedReelPlayOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  pointerEvents: "none",
  background:
    "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.10) 45%, rgba(0,0,0,0.38) 100%)",
};

const sharedReelPlayButtonStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.92)",
  color: "#000",
  fontSize: "22px",
  fontWeight: 900,
  boxShadow: "0 10px 26px rgba(0,0,0,0.38)",
};

const sharedReelMetaStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: 1.5,
};

const sharedReelActionLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minHeight: "40px",
  borderRadius: "999px",
  background: "white",
  color: "black",
  border: "none",
  padding: "9px 14px",
  fontWeight: 900,
  fontSize: "13px",
  textDecoration: "none",
  boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
};

const sharedReelRemoveButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "40px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.05)",
  color: "#fecaca",
  border: "1px solid rgba(248,113,113,0.22)",
  padding: "9px 14px",
  fontWeight: 800,
  fontSize: "13px",
  cursor: "pointer",
};


const linkPreviewCardStyle: CSSProperties = {
  marginTop: "14px",
  display: "flex",
  gap: "13px",
  alignItems: "center",
  borderRadius: "24px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(0,0,0,0.28))",
  padding: "12px",
  textDecoration: "none",
  color: "white",
  boxShadow: "0 12px 30px rgba(0,0,0,0.20)",
};

const linkPreviewMediaStyle: CSSProperties = {
  width: "126px",
  height: "80px",
  borderRadius: "18px",
  overflow: "hidden",
  background: "rgba(255,255,255,0.055)",
  border: "1px solid rgba(255,255,255,0.10)",
  flexShrink: 0,
  position: "relative",
};

const linkPreviewPlayOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  color: "white",
  fontSize: "26px",
  textShadow: "0 6px 18px rgba(0,0,0,0.65)",
  background: "rgba(0,0,0,0.12)",
};

const linkPreviewFaviconWrapStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.025) 100%)",
};

const linkPreviewEyebrowStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "4px",
};

const linkPreviewTitleStyle: CSSProperties = {
  color: "#f9fafb",
  fontSize: "15px",
  fontWeight: 900,
  lineHeight: 1.25,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const linkPreviewDomainStyle: CSSProperties = {
  color: "#93c5fd",
  fontSize: "13px",
  marginTop: "4px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};



const profileDesktopActionMenuStyle: CSSProperties = {
  width: "340px",
  maxHeight: "340px",
  overflowY: "auto",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.16)",
  background: "#11131a",
  backgroundColor: "#11131a",
  boxShadow:
    "0 30px 90px rgba(0,0,0,0.82), 0 0 0 1px rgba(255,255,255,0.08), 0 0 34px rgba(168,85,247,0.20)",
  padding: "8px",
  paddingBottom: "12px",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  isolation: "isolate",
  opacity: 1,
};

const profileDesktopActionMenuFixedStyle: CSSProperties = {
  ...profileDesktopActionMenuStyle,
  position: "fixed",
  width: "280px",
  maxHeight: "340px",
  overflowY: "scroll",
  overscrollBehavior: "contain",
  scrollbarWidth: "thin",
  zIndex: 2147483000,
  background: "#11131a",
  backgroundColor: "#11131a",
  opacity: 1,
  pointerEvents: "auto",
};

const profileDesktopActionMenuHeaderStyle: CSSProperties = {
  padding: "10px 10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  marginBottom: "6px",
  background: "#11131a",
};

const profileDesktopActionItemStyle: CSSProperties = {
  width: "100%",
  border: "1px solid transparent",
  background: "#151821",
  backgroundColor: "#151821",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px",
  display: "grid",
  gridTemplateColumns: "38px minmax(0, 1fr)",
  alignItems: "center",
  gap: "10px",
  textAlign: "left",
  cursor: "pointer",
  opacity: 1,
};

const profileActionOverlayStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: "calc(82px + env(safe-area-inset-bottom))",
  left: 0,
  zIndex: 2147482400,
  background: "rgba(0,0,0,0.62)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: "14px",
  paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  touchAction: "auto",
};

const profileActionSheetStyle: CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  maxHeight: "calc(100dvh - 164px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(180deg, rgba(24,27,34,0.98), rgba(12,14,19,0.98))",
  boxShadow: "0 30px 90px rgba(0,0,0,0.62)",
  padding: "10px",
  paddingBottom: "18px",
  touchAction: "pan-y",
};

const profileActionGrabberStyle: CSSProperties = {
  width: "42px",
  height: "4px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.18)",
  margin: "4px auto 12px",
};

const profileActionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  padding: "6px 6px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const profileActionEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#a78bfa",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const profileActionTitleStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const profileActionCloseStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.06)",
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: 900,
  cursor: "pointer",
};

const profileActionGridStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  paddingTop: "10px",
  overflowY: "auto",
  overflowX: "hidden",
  maxHeight: "min(68dvh, 520px)",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
  touchAction: "pan-y",
  paddingBottom: "calc(22px + env(safe-area-inset-bottom))",
};

const profileActionItemStyle: CSSProperties = {
  width: "100%",
  border: "1px solid transparent",
  background: "transparent",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "12px",
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr)",
  alignItems: "center",
  gap: "12px",
  textAlign: "left",
  cursor: "pointer",
};

const profileActionIconStyle: CSSProperties = {
  width: "42px",
  height: "42px",
  borderRadius: "13px",
  display: "grid",
  placeItems: "center",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(168,85,247,0.14)",
  color: "#d8b4fe",
  fontSize: "18px",
  fontWeight: 950,
};

const profilePageBackgroundStyle: CSSProperties = {
  background:
    "radial-gradient(circle at 50% 0%, rgba(126,34,206,0.20) 0%, rgba(7,9,13,0.82) 34%, #05070b 72%), linear-gradient(180deg, #080a10 0%, #05070b 100%)",
};

const profileHeroShellStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: "22px",
  border: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.060) 0%, rgba(255,255,255,0.026) 100%)",
  boxShadow: "0 18px 48px rgba(0,0,0,0.34)",
  backdropFilter: "blur(14px)",
};

const profileCoverStyle: CSSProperties = {
  position: "relative",
  height: "clamp(190px, 24vw, 300px)",
  background:
    "radial-gradient(circle at 50% 30%, rgba(168,85,247,0.62) 0%, rgba(88,28,135,0.35) 28%, rgba(3,7,18,0.78) 58%), linear-gradient(135deg, #0f1020 0%, #16162a 44%, #05070b 100%)",
  overflow: "hidden",
};

const profileCoverOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.10) 46%, rgba(5,7,11,0.94) 100%)",
};

const editCoverButtonStyle: CSSProperties = {
  position: "absolute",
  top: "16px",
  right: "16px",
  zIndex: 2,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "linear-gradient(180deg, rgba(7,10,16,0.76), rgba(7,10,16,0.52))",
  color: "#f8fafc",
  borderRadius: "10px",
  padding: "7px 11px",
  cursor: "pointer",
  fontWeight: 850,
  fontSize: "12px",
  letterSpacing: "0.01em",
  boxShadow: "0 8px 18px rgba(0,0,0,0.20)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

const profileHeroContentStyle: CSSProperties = {
  position: "relative",
  marginTop: "-86px",
  padding: "0 22px 22px",
  display: "flex",
  gap: "22px",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const profileAvatarWrapStyle: CSSProperties = {
  position: "relative",
  width: "clamp(132px, 16vw, 184px)",
  height: "clamp(132px, 16vw, 184px)",
  borderRadius: "50%",
  padding: "5px",
  background:
    "linear-gradient(135deg, rgba(168,85,247,1) 0%, rgba(59,130,246,0.95) 50%, rgba(236,72,153,0.9) 100%)",
  boxShadow: "0 0 34px rgba(168,85,247,0.42)",
  flexShrink: 0,
};

const profileAvatarStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  border: "4px solid #07090d",
};

const profileAvatarFallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  background: "#374151",
  color: "#f9fafb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: "42px",
  border: "4px solid #07090d",
};


const avatarCameraButtonStyle: CSSProperties = {
  position: "absolute",
  right: "-10px",
  bottom: "5px",
  width: "36px",
  height: "36px",
  borderRadius: "13px",
  border: "1px solid rgba(216,180,254,0.42)",
  background: "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(168,85,247,0.30))",
  color: "white",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  fontSize: "15px",
  fontWeight: 950,
  lineHeight: 1,
  boxShadow: "0 10px 24px rgba(0,0,0,0.34), 0 0 18px rgba(168,85,247,0.26)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

const profileHeroInfoStyle: CSSProperties = {
  flex: 1,
  minWidth: "300px",
  paddingTop: "84px",
  paddingBottom: "12px",
};

const profileHeroTopLineStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "18px",
  flexWrap: "wrap",
  marginBottom: "10px",
  overflow: "visible",
};

const profileHeroNameStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(30px, 3.8vw, 46px)",
  lineHeight: 1.03,
  letterSpacing: "-0.052em",
  color: "#fff",
};

const verifiedBadgeStyle: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: "23px",
  height: "23px",
  marginLeft: "10px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #7c3aed, #a855f7)",
  color: "white",
  fontSize: "14px",
  verticalAlign: "middle",
};

const profileHandleStyle: CSSProperties = {
  margin: "8px 0 0",
  color: "#aeb3c2",
  fontSize: "14px",
  lineHeight: "22px",
  minHeight: "24px",
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  overflow: "visible",
  paddingTop: "2px",
  paddingBottom: "2px",
};

const profileDotStyle: CSSProperties = {
  margin: "0 8px",
  color: "#6b7280",
};

const profileHeroActionsStyle: CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  maxWidth: "520px",
};

const profilePrimaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg,#9333ea,#7c3aed)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "14px",
  padding: "11px 18px",
  fontWeight: 850,
  fontSize: "13px",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(124,58,237,0.26)",
  transition: "all 0.18s ease",
  whiteSpace: "nowrap",
};

const profileGlassButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.060)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#f9fafb",
  borderRadius: "14px",
  padding: "11px 16px",
  fontWeight: 800,
  fontSize: "13px",
  cursor: "pointer",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  whiteSpace: "nowrap",
};

const profileIconButtonStyle: CSSProperties = {
  width: "42px",
  height: "42px",
  minWidth: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.055)",
  color: "white",
  cursor: "pointer",
  lineHeight: 1,
  fontSize: "18px",
  fontWeight: 900,
  transition: "transform 160ms ease, filter 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const profileBioStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#e5e7eb",
  lineHeight: 1.6,
  maxWidth: "760px",
};

const profileMetaRowStyle: CSSProperties = {
  marginTop: "12px",
  display: "flex",
  gap: "14px",
  flexWrap: "wrap",
  color: "#aeb3c2",
  fontSize: "13px",
};

const profileStatsBarStyle: CSSProperties = {
  margin: "0 14px 14px",
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr",
  alignItems: "center",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.075)",
  background: "rgba(0,0,0,0.20)",
  padding: "15px 10px",
};

const profileStatItemStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "4px",
};

const profileStatNumberStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  lineHeight: 1,
};

const profileStatLabelStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const profileStatDividerStyle: CSSProperties = {
  width: "1px",
  height: "34px",
  background: "rgba(255,255,255,0.09)",
};

const profileStoriesRowStyle: CSSProperties = {
  margin: "0 14px 14px",
  display: "flex",
  gap: "16px",
  overflowX: "auto",
  padding: "14px",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.075)",
  background: "rgba(0,0,0,0.16)",
};

const profileStoryItemStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: "8px",
  minWidth: "86px",
  border: "0",
  background: "transparent",
  color: "inherit",
  padding: "0",
  cursor: "pointer",
  fontFamily: "inherit",
};

const profileStoryCircleStyle: CSSProperties = {
  width: "66px",
  height: "66px",
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  border: "2px solid rgba(168,85,247,0.75)",
  background: "rgba(255,255,255,0.04)",
  boxShadow: "0 0 22px rgba(168,85,247,0.18)",
  fontSize: "23px",
};

const profileStoryLabelStyle: CSSProperties = {
  color: "#d1d5db",
  fontSize: "12px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const profileShowcasesPanelStyle: CSSProperties = {
  margin: "0 14px 14px",
  padding: "10px 0 18px",
  borderRadius: "16px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  borderLeft: "1px solid rgba(255,255,255,0.06)",
  background: "linear-gradient(180deg, rgba(38,25,52,0.68), rgba(17,19,24,0.86))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const profileShowcasesTitleStyle: CSSProperties = {
  margin: "0 14px 8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const profileShowcasesRowStyle: CSSProperties = {
  position: "relative",
  zIndex: 3,
  display: "flex",
  alignItems: "flex-start",
  gap: "14px",
  minHeight: "92px",
  overflowX: "auto",
  overflowY: "visible",
  padding: "0 14px 12px",
};

const profileShowcaseNewItemStyle: CSSProperties = {
  position: "relative",
  zIndex: 5,
  display: "grid",
  justifyItems: "center",
  gap: "6px",
  minWidth: "74px",
  width: "74px",
  border: 0,
  background: "transparent",
  padding: "0 0 4px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const profileShowcaseHiddenCreateItemStyle: CSSProperties = {
  display: "none",
};

const profileShowcasePlusCircleStyle: CSSProperties = {
  width: "62px",
  height: "62px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  border: "1px solid rgba(255,255,255,0.18)",
  background:
    "radial-gradient(circle at 32% 24%, rgba(255,255,255,0.22), transparent 23%), linear-gradient(135deg, #a855f7, #7c3aed 58%, #4f46e5)",
  color: "#ffffff",
  fontSize: "40px",
  fontWeight: 950,
  lineHeight: 0.86,
  paddingBottom: "4px",
  boxShadow:
    "0 16px 34px rgba(124,58,237,0.38), 0 0 34px rgba(168,85,247,0.28), inset 0 1px 0 rgba(255,255,255,0.16)",
};

const profileShowcaseNewLabelStyle: CSSProperties = {
  position: "relative",
  zIndex: 6,
  display: "block",
  maxWidth: "78px",
  color: "#f3e8ff",
  fontSize: "11px",
  fontWeight: 900,
  lineHeight: 1.1,
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  letterSpacing: "0.01em",
};

const profileShowcaseItemStyle: CSSProperties = {
  position: "relative",
  zIndex: 4,
  display: "grid",
  justifyItems: "center",
  gap: "6px",
  minWidth: "74px",
  width: "74px",
  border: 0,
  background: "transparent",
  padding: "0 0 4px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const profileShowcaseCoverCircleStyle: CSSProperties = {
  position: "relative",
  width: "58px",
  height: "58px",
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  borderRadius: "999px",
  border: "1px solid rgba(216,180,254,0.30)",
  background:
    "radial-gradient(circle at 36% 18%, rgba(255,255,255,0.16), transparent 24%), linear-gradient(135deg, rgba(88,28,135,0.96), rgba(59,130,246,0.58))",
  boxShadow: "0 0 22px rgba(168,85,247,0.20), 0 12px 24px rgba(0,0,0,0.24)",
};

const profileShowcaseCoverMediaStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  zIndex: 0,
};

const profileShowcaseCoverShadeStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 1,
  background: "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.48))",
  pointerEvents: "none",
};

const profileShowcaseCoverTextStyle: CSSProperties = {
  position: "absolute",
  zIndex: 2,
  width: "78%",
  maxWidth: "78%",
  color: "#ffffff",
  fontSize: "10px",
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

const profileShowcaseDeleteStyle: CSSProperties = {
  position: "absolute",
  top: "-3px",
  right: "4px",
  zIndex: 3,
  width: "20px",
  height: "20px",
  display: "grid",
  placeItems: "center",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.58)",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 16px rgba(0,0,0,0.26)",
};

const profileShowcaseOptionalTextStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 750,
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
  border: "1px dashed rgba(216,180,254,0.52)",
  borderRadius: "24px",
  background:
    "radial-gradient(circle at 20% 0%, rgba(168,85,247,0.20), transparent 36%), linear-gradient(180deg, rgba(168,85,247,0.11), rgba(255,255,255,0.035))",
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
  background:
    "radial-gradient(circle at 22% 0%, rgba(34,211,238,0.18), transparent 36%), linear-gradient(180deg, rgba(168,85,247,0.14), rgba(34,211,238,0.055))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(34,211,238,0.18), 0 22px 52px rgba(0,0,0,0.26)",
};

const profileShowcaseSimpleUploadCardSelectedStyle: CSSProperties = {
  ...profileShowcaseSimpleUploadCardStyle,
  border: "1px solid rgba(74,222,128,0.32)",
  background:
    "radial-gradient(circle at 22% 0%, rgba(74,222,128,0.12), transparent 36%), linear-gradient(180deg, rgba(168,85,247,0.10), rgba(74,222,128,0.040))",
};

const profileShowcaseSimpleUploadIconStyle: CSSProperties = {
  width: "58px",
  height: "58px",
  borderRadius: "20px",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, rgba(168,85,247,0.95), rgba(124,58,237,0.90))",
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: 950,
  boxShadow: "0 14px 28px rgba(124,58,237,0.30)",
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
  border: "1px solid rgba(216,180,254,0.26)",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.035)",
  color: "#d8b4fe",
  fontSize: "14px",
  fontWeight: 950,
  cursor: "pointer",
  fontFamily: "inherit",
};

const profileShowcaseCustomizeButtonActiveStyle: CSSProperties = {
  ...profileShowcaseCustomizeButtonStyle,
  background: "linear-gradient(135deg, rgba(168,85,247,0.24), rgba(59,130,246,0.10))",
  border: "1px solid rgba(216,180,254,0.42)",
  color: "#ffffff",
};

const profileShowcaseCustomizePanelStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  marginTop: "12px",
  border: "1px solid rgba(216,180,254,0.13)",
  borderRadius: "20px",
  background:
    "radial-gradient(circle at 12% 0%, rgba(168,85,247,0.10), transparent 38%), rgba(0,0,0,0.18)",
  padding: "13px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const profileShowcaseCustomizeIntroStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  border: "1px solid rgba(216,180,254,0.15)",
  borderRadius: "15px",
  background:
    "linear-gradient(135deg, rgba(168,85,247,0.13), rgba(37,99,235,0.055))",
  padding: "11px",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 900,
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

const profileShowcaseStudioLayoutStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(220px, 0.9fr)",
  gap: "16px",
  alignItems: "start",
};

const profileShowcaseStudioControlsStyle: CSSProperties = {
  minWidth: 0,
};

const profileShowcaseStartOptionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
  marginBottom: "14px",
};

const profileShowcaseStartOptionStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "36px minmax(0, 1fr)",
  gap: "9px",
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.04)",
  color: "#ffffff",
  padding: "9px",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
};

const profileShowcaseStartOptionActiveStyle: CSSProperties = {
  ...profileShowcaseStartOptionStyle,
  border: "1px solid rgba(216,180,254,0.46)",
  background: "linear-gradient(135deg, rgba(168,85,247,0.24), rgba(59,130,246,0.10))",
  boxShadow: "0 0 24px rgba(168,85,247,0.16)",
};

const profileShowcaseStartIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "13px",
  display: "grid",
  placeItems: "center",
  background: "rgba(168,85,247,0.22)",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 950,
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
  background:
    "radial-gradient(circle at 20% 0%, rgba(34,211,238,0.30), transparent 34%), linear-gradient(135deg, rgba(20,184,166,0.78), rgba(124,58,237,0.90) 52%, rgba(168,85,247,0.84))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 34px 86px rgba(0,0,0,0.50)",
};

const profileShowcasePreviewCanvasStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(135deg, rgba(20,184,166,0.80), rgba(59,130,246,0.66) 45%, rgba(168,85,247,0.86))",
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
  background:
    "linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.10) 45%, rgba(0,0,0,0.42))",
  touchAction: "none",
  cursor: "grab",
  userSelect: "none",
  WebkitUserSelect: "none",
  contain: "layout paint",
};

const profileShowcaseCenterGuideVerticalStyle: CSSProperties = {
  position: "absolute",
  top: "8%",
  bottom: "8%",
  left: "50%",
  width: "1px",
  transform: "translateX(-50%)",
  background:
    "repeating-linear-gradient(to bottom, rgba(255,255,255,0.42) 0 5px, transparent 5px 10px)",
  boxShadow: "0 0 12px rgba(168,85,247,0.22)",
  pointerEvents: "none",
};

const profileShowcaseCenterGuideHorizontalStyle: CSSProperties = {
  position: "absolute",
  left: "8%",
  right: "8%",
  top: "50%",
  height: "1px",
  transform: "translateY(-50%)",
  background:
    "repeating-linear-gradient(to right, rgba(255,255,255,0.42) 0 5px, transparent 5px 10px)",
  boxShadow: "0 0 12px rgba(168,85,247,0.22)",
  pointerEvents: "none",
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
  padding: "0 8px",
  minWidth: "120px",
  boxSizing: "border-box",
  userSelect: "none",
  WebkitUserSelect: "none",
  willChange: "left, top, transform",
  transition: "none",
  contain: "layout paint",
  backfaceVisibility: "hidden",
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
  border: "1px solid rgba(216,180,254,0.58)",
  background:
    "linear-gradient(135deg, rgba(168,85,247,0.24), rgba(37,99,235,0.11))",
  boxShadow:
    "0 0 0 1px rgba(168,85,247,0.12), 0 14px 30px rgba(124,58,237,0.18)",
};

const profileShowcaseVisibilityIconStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "13px",
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.16), transparent 28%), rgba(168,85,247,0.16)",
  border: "1px solid rgba(216,180,254,0.20)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  position: "relative",
};

const profileShowcaseVisibilityTextStyle: CSSProperties = {
  display: "grid",
  gap: "2px",
  minWidth: 0,
};


const profileShowcaseFontGroupStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  marginTop: "12px",
};

const profileShowcaseFontGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "6px",
};

const profileShowcaseFontSelectStyle: CSSProperties = {
  width: "100%",
  minHeight: "44px",
  border: "1px solid rgba(216,180,254,0.30)",
  borderRadius: "14px",
  background: "#11131a",
  color: "#ffffff",
  padding: "0 13px",
  fontSize: "14px",
  fontWeight: 850,
  fontFamily: "inherit",
  outline: "none",
  display: "block",
  cursor: "pointer",
};

const profileShowcaseFontPreviewStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.085)",
  borderRadius: "14px",
  background:
    "radial-gradient(circle at 20% 0%, rgba(168,85,247,0.12), transparent 35%), rgba(255,255,255,0.035)",
  color: "#ffffff",
  padding: "12px",
  fontSize: "16px",
  fontWeight: 900,
  lineHeight: 1.2,
  textAlign: "center",
  textShadow: "0 2px 12px rgba(0,0,0,0.38)",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
  maxHeight: "96px",
  overflowY: "auto",
};

const profileShowcaseTextSizeControlStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  border: "1px solid rgba(255,255,255,0.075)",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.032)",
  padding: "11px",
};

const profileShowcaseTextSizeHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 900,
};

const profileShowcaseTextSizeRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "38px minmax(0, 1fr) 38px",
  gap: "9px",
  alignItems: "center",
};

const profileShowcaseTextSizeButtonStyle: CSSProperties = {
  width: "38px",
  height: "38px",
  border: "1px solid rgba(216,180,254,0.22)",
  borderRadius: "13px",
  background: "rgba(168,85,247,0.12)",
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: 950,
  cursor: "pointer",
  fontFamily: "inherit",
};

const profileShowcaseTextSizeSliderStyle: CSSProperties = {
  width: "100%",
  accentColor: "#a855f7",
  cursor: "pointer",
};

const profileShowcaseTextSizeHelpStyle: CSSProperties = {
  color: "rgba(229,231,235,0.68)",
  fontSize: "11px",
  fontWeight: 750,
  lineHeight: 1.3,
};

const profileShowcaseVerticalSizeRailStyle: CSSProperties = {
  position: "absolute",
  left: "14px",
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 8,
  width: "26px",
  height: "160px",
  display: "grid",
  placeItems: "center",
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const profileShowcaseVerticalSizeLabelStyle: CSSProperties = {
  display: "none",
};

const profileShowcaseVerticalSizeValueStyle: CSSProperties = {
  display: "none",
};

const profileShowcaseVerticalSizeSliderStyle: CSSProperties = {
  width: "138px",
  height: "24px",
  transform: "rotate(-90deg)",
  accentColor: "#ffffff",
  cursor: "pointer",
};




const profileShowcaseFontOptionStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: "12px",
  background: "rgba(255,255,255,0.04)",
  color: "#e5e7eb",
  padding: "8px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "12px",
  fontWeight: 850,
  textAlign: "left",
};

const profileShowcaseFontOptionActiveStyle: CSSProperties = {
  ...profileShowcaseFontOptionStyle,
  border: "1px solid rgba(216,180,254,0.42)",
  background: "linear-gradient(135deg, rgba(168,85,247,0.23), rgba(59,130,246,0.10))",
  boxShadow: "0 0 20px rgba(168,85,247,0.14)",
};


const profileShowcaseViewerOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "18px",
  background:
    "radial-gradient(circle at 50% 0%, rgba(168,85,247,0.22), transparent 42%), rgba(0,0,0,0.90)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

const profileShowcaseViewerShellStyle: CSSProperties = {
  width: "min(760px, calc(100vw - 32px))",
  height: "min(900px, calc(100vh - 32px))",
  maxHeight: "calc(100vh - 32px)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  borderRadius: "30px",
  border: "1px solid rgba(255,255,255,0.14)",
  background:
    "radial-gradient(circle at 16% 0%, rgba(168,85,247,0.24), transparent 34%), radial-gradient(circle at 96% 10%, rgba(34,211,238,0.11), transparent 30%), linear-gradient(180deg, rgba(17,19,28,0.996), rgba(5,7,12,0.998))",
  boxShadow: "0 42px 120px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.035)",
  padding: "16px",
  overflow: "hidden",
};

const profileShowcaseViewerHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flex: "0 0 auto",
  paddingBottom: "12px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const profileShowcaseViewerBrandStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr)",
  gap: "12px",
  alignItems: "center",
  minWidth: 0,
};

const profileShowcaseViewerLogoStyle: CSSProperties = {
  width: "42px",
  height: "42px",
  display: "grid",
  placeItems: "center",
  borderRadius: "15px",
  background: "linear-gradient(135deg, #a855f7, #7c3aed 60%, #2563eb)",
  boxShadow: "0 16px 34px rgba(124,58,237,0.34)",
  overflow: "hidden",
};

const profileShowcaseViewerEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#c084fc",
  fontSize: "11px",
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const profileShowcaseViewerTitleStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "#ffffff",
  fontSize: "20px",
  fontWeight: 950,
  letterSpacing: "-0.035em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const profileShowcaseViewerMetaTextStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 800,
};

const profileShowcaseViewerCloseStyle: CSSProperties = {
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
};

const profileShowcaseViewerStageStyle: CSSProperties = {
  position: "relative",
  flex: "1 1 auto",
  minHeight: "420px",
  borderRadius: "28px",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.14)",
  background:
    "radial-gradient(circle at 20% 0%, rgba(34,211,238,0.30), transparent 34%), linear-gradient(135deg, rgba(20,184,166,0.78), rgba(124,58,237,0.90) 52%, rgba(168,85,247,0.84))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 30px 80px rgba(0,0,0,0.46)",
};

const profileShowcaseViewerCanvasStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(circle at 22% 0%, rgba(34,211,238,0.30), transparent 34%), linear-gradient(135deg, rgba(20,184,166,0.82), rgba(59,130,246,0.66) 45%, rgba(168,85,247,0.88))",
};

const profileShowcaseViewerMediaStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
  objectPosition: "center center",
  display: "block",
  backgroundColor: "#05060a",
};

const profileShowcaseViewerShadeStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.08) 42%, rgba(0,0,0,0.48))",
  pointerEvents: "none",
};

const profileShowcaseViewerOverlayTextStyle: CSSProperties = {
  position: "absolute",
  zIndex: 3,
  transform: "translate(-50%, -50%)",
  width: "82%",
  maxWidth: "82%",
  maxHeight: "74%",
  color: "#ffffff",
  fontWeight: 950,
  lineHeight: 1.05,
  letterSpacing: "-0.035em",
  textAlign: "center",
  textShadow: "0 4px 24px rgba(0,0,0,0.55)",
  pointerEvents: "none",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  overflow: "hidden",
  boxSizing: "border-box",
};

const profileShowcaseViewerFooterStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "12px",
  flex: "0 0 auto",
  paddingTop: "2px",
};

const profileShowcaseViewerFooterTitleStyle: CSSProperties = {
  display: "block",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 950,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const profileShowcaseViewerFooterMetaStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#9ca3af",
  fontSize: "12px",
  fontWeight: 800,
};

const profileShowcaseViewerDeleteButtonStyle: CSSProperties = {
  border: "1px solid rgba(248,113,113,0.30)",
  borderRadius: "14px",
  background: "rgba(248,113,113,0.08)",
  color: "#fecaca",
  padding: "11px 13px",
  fontSize: "12px",
  fontWeight: 950,
  cursor: "pointer",
  fontFamily: "inherit",
};

const profileShowcaseModalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  padding: "18px",
  background:
    "radial-gradient(circle at 50% 0%, rgba(168,85,247,0.20), transparent 38%), rgba(0,0,0,0.88)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};

const profileShowcaseModalStyle: CSSProperties = {
  width: "min(1180px, calc(100vw - 32px))",
  height: "min(840px, calc(100vh - 32px))",
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  borderRadius: "32px",
  border: "1px solid rgba(255,255,255,0.14)",
  background:
    "radial-gradient(circle at 12% 0%, rgba(168,85,247,0.28), transparent 34%), radial-gradient(circle at 98% 10%, rgba(34,211,238,0.12), transparent 30%), linear-gradient(180deg, rgba(20,22,30,0.996), rgba(6,8,13,0.998))",
  boxShadow: "0 42px 120px rgba(0,0,0,0.72), 0 0 0 1px rgba(255,255,255,0.035)",
  padding: "22px",
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
  background: "linear-gradient(135deg, #a855f7, #7c3aed 60%, #2563eb)",
  color: "#ffffff",
  boxShadow: "0 16px 34px rgba(124,58,237,0.34)",
  overflow: "hidden",
};

const profileShowcaseModalLogoImageStyle: CSSProperties = {
  width: "27px",
  height: "27px",
  objectFit: "contain",
  display: "block",
  filter: "drop-shadow(0 0 8px rgba(255,255,255,0.16))",
};


const profileShowcaseModalFlowPillsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginTop: "10px",
};



const profileShowcaseModalEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#c084fc",
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

const profileShowcaseDurationOptionActiveStyle: CSSProperties = {
  ...profileShowcaseDurationOptionStyle,
  border: "1px solid rgba(216,180,254,0.42)",
  background: "linear-gradient(135deg, rgba(168,85,247,0.24), rgba(59,130,246,0.10))",
  boxShadow: "0 0 22px rgba(168,85,247,0.16)",
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
  background: "linear-gradient(135deg, #a855f7, #7c3aed 58%, #2563eb)",
  color: "#ffffff",
  borderRadius: "15px",
  padding: "12px 18px",
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 20px 38px rgba(124,58,237,0.34)",
};

const profileTabsShellStyle: CSSProperties = {
  padding: "0 14px 14px",
  display: "grid",
  gap: "10px",
};

const profileTabsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "7px",
  padding: "7px",
  borderRadius: "20px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.060), rgba(255,255,255,0.028))",
  border: "1px solid rgba(255,255,255,0.09)",
  overflowX: "auto",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.050), 0 14px 34px rgba(0,0,0,0.20)",
};

const profileTabStyle: CSSProperties = {
  display: "grid",
  gap: "4px",
  alignContent: "center",
  justifyItems: "start",
  minHeight: "54px",
  background: "transparent",
  color: "#aeb3c2",
  borderTopWidth: "1px",
  borderRightWidth: "1px",
  borderBottomWidth: "2px",
  borderLeftWidth: "1px",
  borderStyle: "solid",
  borderTopColor: "transparent",
  borderRightColor: "transparent",
  borderBottomColor: "transparent",
  borderLeftColor: "transparent",
  padding: "10px 13px",
  fontWeight: 850,
  cursor: "pointer",
  borderRadius: "15px",
  whiteSpace: "nowrap",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "background 150ms ease, border-color 150ms ease, transform 150ms ease, color 150ms ease",
};

const profileActiveTabStyle: CSSProperties = {
  ...profileTabStyle,
  background:
    "linear-gradient(135deg, rgba(168,85,247,0.22), rgba(59,130,246,0.10))",
  color: "#ffffff",
  borderTopWidth: "1px",
  borderRightWidth: "1px",
  borderBottomWidth: "2px",
  borderLeftWidth: "1px",
  borderStyle: "solid",
  borderTopColor: "rgba(216,180,254,0.24)",
  borderRightColor: "rgba(216,180,254,0.22)",
  borderBottomColor: "#a855f7",
  borderLeftColor: "rgba(216,180,254,0.22)",
  borderRadius: "15px",
  boxShadow: "0 12px 26px rgba(124,58,237,0.20), inset 0 1px 0 rgba(255,255,255,0.07)",
};

const profileTabLabelStyle: CSSProperties = {
  display: "block",
  fontSize: "14px",
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: "-0.02em",
};

const profileTabDetailStyle: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "#7f8797",
  fontSize: "10px",
  lineHeight: 1.1,
  fontWeight: 850,
};

const profileActiveTabDetailStyle: CSSProperties = {
  ...profileTabDetailStyle,
  color: "#d8b4fe",
};

const profileTabSummaryStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr)",
  gap: "12px",
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "18px",
  background:
    "radial-gradient(circle at 4% 0%, rgba(168,85,247,0.15), transparent 32%), rgba(255,255,255,0.030)",
  padding: "12px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const profileTabSummaryIconStyle: CSSProperties = {
  width: "42px",
  height: "42px",
  borderRadius: "15px",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, rgba(168,85,247,0.92), rgba(59,130,246,0.70))",
  color: "#ffffff",
  fontSize: "17px",
  fontWeight: 950,
  boxShadow: "0 12px 26px rgba(124,58,237,0.26)",
};

const profileTabSummaryEyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#c084fc",
  fontSize: "10px",
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.09em",
};

const profileTabSummaryTitleStyle: CSSProperties = {
  margin: "3px 0 0",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 950,
  letterSpacing: "-0.035em",
};

const profileTabSummaryMetaStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: 1.45,
  fontWeight: 750,
};

const profileMobileTabSelectStyle: CSSProperties = {
  display: "none",
  width: "100%",
  minHeight: "48px",
  marginTop: "0",
  borderRadius: "18px",
  border: "1px solid rgba(168,85,247,0.28)",
  background: "rgba(8,10,16,0.96)",
  color: "#f9fafb",
  padding: "0 14px",
  fontWeight: 900,
  outline: "none",
  boxShadow: "0 12px 26px rgba(0,0,0,0.24)",
};

const aboutHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const aboutTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "22px",
  letterSpacing: "-0.03em",
};

const aboutSubtitleStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: 1.6,
};

const aboutSectionTabsStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const aboutSectionTabStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.045)",
  color: "#d1d5db",
  borderRadius: "999px",
  padding: "9px 13px",
  fontWeight: 800,
  cursor: "pointer",
};

const aboutSectionTabActiveStyle: CSSProperties = {
  ...aboutSectionTabStyle,
  color: "#ffffff",
  border: "1px solid rgba(168,85,247,0.42)",
  background: "linear-gradient(135deg, rgba(168,85,247,0.28), rgba(34,211,238,0.10))",
};

const introGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const introCardStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  padding: "14px",
  borderRadius: "20px",
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.04)",
};

const introIconStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  background: "rgba(168,85,247,0.12)",
  border: "1px solid rgba(168,85,247,0.24)",
  flexShrink: 0,
};

const introLabelStyle: CSSProperties = {
  color: "#f9fafb",
  fontWeight: 900,
  marginBottom: "4px",
};

const introTextStyle: CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "13px",
  lineHeight: 1.7,
};

const tagRowStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const profileTagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "7px 10px",
  background: "rgba(255,255,255,0.055)",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#e5e7eb",
  fontSize: "12px",
  fontWeight: 800,
};

const aboutComingSoonStyle: CSSProperties = {
  minHeight: "150px",
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  gap: "8px",
  color: "#9ca3af",
  border: "1px dashed rgba(255,255,255,0.14)",
  borderRadius: "22px",
  background: "rgba(255,255,255,0.025)",
  padding: "18px",
};

const profilePolishedEmptyStateStyle: CSSProperties = {
  ...aboutComingSoonStyle,
  minHeight: "220px",
  gap: "10px",
  border: "1px dashed rgba(216,180,254,0.18)",
  background:
    "radial-gradient(circle at 50% 0%, rgba(168,85,247,0.14), transparent 36%), rgba(255,255,255,0.030)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const profileEmptyStateIconStyle: CSSProperties = {
  width: "54px",
  height: "54px",
  display: "grid",
  placeItems: "center",
  borderRadius: "18px",
  background: "linear-gradient(135deg, rgba(168,85,247,0.78), rgba(59,130,246,0.52))",
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: 950,
  boxShadow: "0 16px 34px rgba(124,58,237,0.24)",
};

const profileEmptyStateTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "18px",
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const profileEmptyStateCopyStyle: CSSProperties = {
  maxWidth: "520px",
  color: "#9ca3af",
  fontSize: "14px",
  lineHeight: 1.6,
  fontWeight: 750,
};

const profileEmptyStateActionRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "6px",
};

const profileEmptyStateMiniGridStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "6px",
  color: "#d8b4fe",
  fontSize: "12px",
  fontWeight: 900,
};

const miniReelGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
  gap: "12px",
};

const miniReelTileStyle: CSSProperties = {
  position: "relative",
  minHeight: "230px",
  overflow: "hidden",
  borderRadius: "20px",
  background: "#05070a",
  border: "1px solid rgba(255,255,255,0.10)",
  color: "#9ca3af",
  textDecoration: "none",
  display: "grid",
  placeItems: "center",
};

const miniReelVideoStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};



const rightRailStyle: CSSProperties = {
  flexDirection: "column",
  gap: "12px",
  position: "sticky",
  top: "16px",
  height: "fit-content",
};

const rightPanelCardStyle: CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.050) 0%, rgba(255,255,255,0.024) 100%)",
  borderRadius: "18px",
  padding: "15px",
  border: "1px solid rgba(255,255,255,0.085)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
  backdropFilter: "blur(14px)",
};

const rightPanelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "12px",
  paddingBottom: "10px",
  borderBottom: "1px solid rgba(255,255,255,0.055)",
};

const rightPanelTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 900,
  letterSpacing: "-0.015em",
  color: "#f8fafc",
};

const rightPanelTextStyle: CSSProperties = {
  margin: 0,
  color: "#aeb6c3",
  fontSize: "13px",
  lineHeight: 1.5,
};

const miniPurpleLinkStyle: CSSProperties = {
  color: "#d8b4fe",
  fontSize: "11px",
  fontWeight: 850,
  whiteSpace: "nowrap",
  letterSpacing: "0.015em",
};

const profileStrengthRingStyle: CSSProperties = {
  width: "70px",
  height: "70px",
  borderRadius: "18px",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: "#ffffff",
  background:
    "linear-gradient(145deg, rgba(124,58,237,0.20), rgba(8,10,16,0.96)), conic-gradient(from 0deg, #7c3aed 0deg, #a855f7 306deg, rgba(255,255,255,0.10) 306deg)",
  boxShadow: "0 10px 22px rgba(0,0,0,0.22), 0 0 20px rgba(168,85,247,0.18)",
  border: "1px solid rgba(255,255,255,0.105)",
};

const wideGlassButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: "12px",
  minHeight: "38px",
  borderRadius: "11px",
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.09)",
  color: "#f8fafc",
  fontWeight: 850,
  cursor: "pointer",
  transition: "transform 160ms ease, filter 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
};

const achievementGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "8px",
};

const achievementItemStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "5px",
  textAlign: "center",
  color: "#d1d5db",
  fontSize: "10px",
  lineHeight: 1.2,
};

const achievementIconStyle: CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "15px",
  display: "grid",
  placeItems: "center",
  fontSize: "20px",
  background: "linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.022))",
  border: "1px solid rgba(255,255,255,0.095)",
  boxShadow: "0 8px 16px rgba(0,0,0,0.18)",
};

const badgeBubbleStyle: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  fontSize: "17px",
  background: "linear-gradient(145deg, rgba(168,85,247,0.14), rgba(255,255,255,0.035))",
  border: "1px solid rgba(168,85,247,0.34)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.16)",
};

const visitorAvatarStyle: CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  color: "#f9fafb",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(168,85,247,0.42)",
  overflow: "hidden",
  fontWeight: 900,
};

const activityRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "9px 11px",
  borderRadius: "11px",
  background: "rgba(255,255,255,0.026)",
  border: "1px solid rgba(255,255,255,0.060)",
  color: "#cbd5e1",
  fontSize: "13px",
};

const onlineStatusPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "5px 9px",
  background: "rgba(34,197,94,0.12)",
  color: "#86efac",
  border: "1px solid rgba(34,197,94,0.25)",
  fontSize: "11px",
  fontWeight: 900,
};

const offlineStatusPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  padding: "5px 9px",
  background: "rgba(255,255,255,0.04)",
  color: "#cbd5e1",
  border: "1px solid rgba(255,255,255,0.10)",
  fontSize: "11px",
  fontWeight: 900,
};



const mobileTopBarStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 60,
  minHeight: "72px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  background:
    "linear-gradient(180deg, rgba(5,7,12,0.96) 0%, rgba(5,7,12,0.80) 100%)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(18px)",
};

const mobileCircleButtonStyle: CSSProperties = {
  width: "42px",
  height: "42px",
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.045)",
  color: "#f9fafb",
  display: "grid",
  placeItems: "center",
  fontSize: "25px",
  fontWeight: 900,
  cursor: "pointer",
};

const mobileBottomNavStyle: CSSProperties = {
  position: "fixed",
  left: "10px",
  right: "10px",
  bottom: "10px",
  zIndex: 80,
  minHeight: "76px",
  borderRadius: "28px",
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(12,14,24,0.96) 0%, rgba(5,7,12,0.98) 100%)",
  boxShadow: "0 -12px 34px rgba(0,0,0,0.40), 0 0 28px rgba(124,58,237,0.14)",
  backdropFilter: "blur(20px)",
  display: "grid",
  gridTemplateColumns: "1fr 1fr 74px 1fr 1fr",
  alignItems: "center",
  padding: "8px 10px calc(8px + env(safe-area-inset-bottom, 0px))",
};

const mobileBottomNavItemStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  color: "#d1d5db",
  textDecoration: "none",
  fontSize: "11px",
  fontWeight: 800,
};

const mobileBottomNavItemActiveStyle: CSSProperties = {
  ...mobileBottomNavItemStyle,
  color: "#c084fc",
  textShadow: "0 0 16px rgba(168,85,247,0.5)",
};

const mobileBottomNavIconStyle: CSSProperties = {
  fontSize: "22px",
  lineHeight: 1,
};

const mobileCreateButtonStyle: CSSProperties = {
  width: "62px",
  height: "62px",
  borderRadius: "50%",
  border: "3px solid rgba(255,255,255,0.88)",
  background:
    "linear-gradient(135deg, #ffffff 0%, #ffffff 42%, #a855f7 43%, #ec4899 100%)",
  color: "#05070a",
  fontSize: "38px",
  fontWeight: 900,
  display: "grid",
  placeItems: "center",
  boxShadow: "0 0 26px rgba(168,85,247,0.50)",
  cursor: "pointer",
};



const premiumSectionLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  borderRadius: "999px",
  background: "rgba(168,85,247,0.10)",
  border: "1px solid rgba(168,85,247,0.24)",
  color: "#d8b4fe",
  padding: "7px 11px",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.02em",
};

const softDividerStyle: CSSProperties = {
  height: "1px",
  width: "100%",
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.00) 100%)",
};

const profileGlowLineStyle: CSSProperties = {
  height: "3px",
  width: "100%",
  borderRadius: "999px",
  background:
    "linear-gradient(90deg, rgba(168,85,247,0.00) 0%, rgba(168,85,247,0.72) 45%, rgba(34,211,238,0.58) 72%, rgba(34,211,238,0.00) 100%)",
  boxShadow: "0 0 22px rgba(168,85,247,0.28)",
};


const profileDesktopLogoutActionItemStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(248,113,113,0.22)",
  background: "rgba(127,29,29,0.30)",
  backgroundColor: "rgba(127,29,29,0.30)",
  color: "#ffffff",
  borderRadius: "12px",
  padding: "10px",
  display: "grid",
  gridTemplateColumns: "38px minmax(0, 1fr)",
  alignItems: "center",
  gap: "10px",
  textAlign: "left",
  cursor: "pointer",
  opacity: 1,
  marginTop: "6px",
};

const profileMobileLogoutActionItemStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(248,113,113,0.22)",
  background: "rgba(127,29,29,0.30)",
  color: "#ffffff",
  borderRadius: "14px",
  padding: "12px",
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr)",
  alignItems: "center",
  gap: "12px",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
  marginTop: "6px",
};

const profileActionLogoutIconStyle: CSSProperties = {
  width: "38px",
  height: "38px",
  display: "grid",
  placeItems: "center",
  borderRadius: "12px",
  background: "rgba(248,113,113,0.14)",
  color: "#fecaca",
  fontSize: "18px",
  fontWeight: 950,
};

