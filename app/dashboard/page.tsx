"use client";

import {
  ChangeEvent,
  CSSProperties,
  ReactNode,
  RefObject,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import DashboardReelsSection from "./DashboardReelsSection";
import { supabase } from "@/lib/supabase";

type ProfilePreview = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  location?: string | null;
  is_online?: boolean | null;
};

type DashboardShowcaseItem = {
  id: string;
  user_id: string;
  title: string | null;
  cover_text: string | null;
  media_url: string | null;
  media_type: string | null;
  visibility: string | null;
  expires_at: string | null;
  created_at: string | null;
  profile: ProfilePreview | null;
};

type Post = {
  id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
  user_id: string;
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

type MixedFeedItem =
  | { type: "post"; id: string; created_at: string; post: Post }
  | { type: "reel_share"; id: string; created_at: string; share: SharedReelItem };

type FeedMode = "for_you" | "following" | "live" | "ghost_hunts";
type CountMap = Record<string, number>;
type ToggleMap = Record<string, boolean>;
type FollowMap = Record<string, boolean>;

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

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
          style={{ color: "#a78bfa", fontWeight: 850, textDecoration: "none" }}
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
    textDecoration: "none",
    background: isOnline
      ? "linear-gradient(135deg, rgba(168,85,247,0.98), rgba(59,130,246,0.9), rgba(236,72,153,0.75))"
      : "linear-gradient(135deg, rgba(168,85,247,0.55), rgba(15,23,42,0.98))",
    boxShadow: isOnline
      ? "0 0 0 1px rgba(255,255,255,0.10), 0 0 22px rgba(168,85,247,0.45)"
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
  const avatar = (
    <div style={getAvatarShellStyle(size, profile?.is_online)}>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.full_name || profile.username || "Profile"}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "999px",
            objectFit: "cover",
            display: "block",
            border: "2px solid #07090d",
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
            border: "2px solid #07090d",
            background: "linear-gradient(135deg, #4c1d95, #111827)",
            color: "white",
            fontWeight: 950,
            fontSize: `${Math.max(12, Math.round(size * 0.34))}px`,
          }}
        >
          {getInitial(profile?.full_name, profile?.username)}
        </div>
      )}
      {profile?.is_online ? <span style={onlineDotStyle} /> : null}
    </div>
  );

  if (!href) return avatar;
  return (
    <Link href={href} style={{ textDecoration: "none", display: "inline-flex" }}>
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
        filter: "drop-shadow(0 0 10px rgba(168,85,247,0.42))",
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

export default function DashboardPage() {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [sharedReelItems, setSharedReelItems] = useState<SharedReelItem[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfilePreview>>({});
  const [currentProfile, setCurrentProfile] = useState<ProfilePreview | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const [feedMode, setFeedMode] = useState<FeedMode>("for_you");
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);
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
  const [friendShowcases, setFriendShowcases] = useState<DashboardShowcaseItem[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfilePreview[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mainComposerRef = useRef<HTMLElement | null>(null);

  const currentName = currentProfile?.full_name || currentProfile?.username || "there";
  const firstName = currentName.split(" ")[0] || "there";

  const mixedFeedItems = useMemo<MixedFeedItem[]>(() => {
    const postItems = posts.map((post) => ({
      type: "post" as const,
      id: post.id,
      created_at: post.created_at,
      post,
    }));

    const reelShareItems = sharedReelItems.map((share) => ({
      type: "reel_share" as const,
      id: share.id,
      created_at: share.created_at,
      share,
    }));

    return [...postItems, ...reelShareItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [posts, sharedReelItems]);

  const filteredFeedItems = useMemo(() => {
    if (feedMode === "following" && currentUserId) {
      return mixedFeedItems.filter((item) => {
        const authorId = item.type === "post" ? item.post.user_id : item.share.user_id;
        return followedUserIds.includes(authorId);
      });
    }

    if (feedMode === "live") {
      return mixedFeedItems.filter((item) => {
        const text = item.type === "post" ? item.post.content : item.share.caption || item.share.reel_caption || "";
        return /live|stream|watching|event/i.test(text);
      });
    }

    if (feedMode === "ghost_hunts") {
      return mixedFeedItems.filter((item) => {
        const text = item.type === "post" ? item.post.content : item.share.caption || item.share.reel_caption || "";
        return /ghost|haunt|paranormal|evp|investigation/i.test(text);
      });
    }

    return mixedFeedItems;
  }, [currentUserId, feedMode, followedUserIds, mixedFeedItems]);

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
    return Object.values(profilesMap)
      .filter((profile) => profile.id !== currentUserId)
      .slice(0, 5);
  }, [currentUserId, profilesMap]);

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

    if (friendIds.length === 0) {
      setFriendShowcases([]);
      return [] as DashboardShowcaseItem[];
    }

    const [{ data: profilesData, error: profilesError }, { data: showcaseData, error: showcaseError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, location, is_online")
          .in("id", friendIds)
          .limit(32),
        supabase
          .from("profile_showcases")
          .select("id, user_id, title, cover_text, media_url, media_type, visibility, expires_at, created_at")
          .in("user_id", friendIds)
          .order("created_at", { ascending: false })
          .limit(24),
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
      visibility: string | null;
      expires_at: string | null;
      created_at: string | null;
    }>)
      .filter((item) => item.user_id && friendIds.includes(item.user_id))
      .filter((item) => item.visibility !== "private")
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

  const fetchSharedReels = useCallback(async (blockedIds: string[] = []) => {
    const { data: shareRows, error: shareError } = await supabase
      .from("reel_shares")
      .select("id, reel_id, user_id, caption, created_at")
      .order("created_at", { ascending: false })
      .limit(25);

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

  const fetchDashboardData = useCallback(async () => {
    setFetchingPosts(true);

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

      await Promise.all([fetchFollowData(user.id), fetchNotifications(user.id), fetchRecentlyViewed(user.id), fetchFriendShowcases(user.id)]);
    } else {
      setCurrentUserId("");
      setUserEmail("");
      setCurrentProfile(null);
      await Promise.all([fetchFollowData(), fetchNotifications(), fetchRecentlyViewed(), fetchFriendShowcases()]);
    }

    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select("id, content, image_url, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(80);

    if (postsError) {
      console.error("Error fetching posts:", postsError.message);
      setPosts([]);
      setFetchingPosts(false);
      return;
    }

    const visiblePosts = ((postsData || []) as Post[]).filter((post) => !blockedIds.includes(post.user_id));
    const visibleShared = await fetchSharedReels(blockedIds);

    setPosts(visiblePosts);

    const profileIds = [
      userId,
      ...visiblePosts.map((post) => post.user_id),
      ...visibleShared.map((share) => share.user_id),
      ...visibleShared.map((share) => share.reel_user_id),
      ...visibleShared.map((share) => share.creator_profile_id || ""),
    ];

    await Promise.all([fetchProfileMap(profileIds), fetchCounts(userId || undefined, visiblePosts.map((post) => post.id))]);

    setFetchingPosts(false);
  }, [fetchCounts, fetchFollowData, fetchFriendShowcases, fetchNotifications, fetchProfileMap, fetchRecentlyViewed, fetchSharedReels]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!image) {
      setImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(image);
    setImagePreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

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

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setImage(file);
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePost = async () => {
    if (!content.trim() && !image) {
      alert("Please add text or choose an image.");
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

    let imageUrl: string | null = null;

    if (image) {
      const fileExt = image.name.split(".").pop() || "jpg";
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("post-images").upload(fileName, image, {
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
      imageUrl = publicUrlData.publicUrl;
    }

    const { error: insertError } = await supabase.from("posts").insert([
      {
        content: content.trim(),
        user_id: user.id,
        image_url: imageUrl,
      },
    ]);

    if (insertError) {
      alert(`Post error: ${insertError.message}`);
      setLoading(false);
      return;
    }

    setContent("");
    handleRemoveImage();
    await fetchDashboardData();
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

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      console.error("Clipboard error:", error);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("shares").insert([{ post_id: postId, user_id: user?.id || null }]);
    if (error) {
      alert(`Share error: ${error.message}`);
      return;
    }

    setShareCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    alert("Post link copied.");
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
      <button type="button" onClick={openSearch} style={searchFilterButtonStyle} aria-label="Open Search Parapost">
        <span style={{ display: "block", width: 14, height: 2, background: "currentColor", borderRadius: 99 }} />
        <span style={{ display: "block", width: 10, height: 2, background: "currentColor", borderRadius: 99 }} />
      </button>

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
              <SidebarLink href="/reels" icon={<ReelsIcon />} label="Parapost Reels" />
              <SidebarButton label="Live" badge="Soon" />
              <SidebarLink href="/friends" label="Friends" badge={pendingFriendRequestCount || undefined} />
              <SidebarButton label="Groups" />
              <SidebarLink href="/messages" label="Parachat" badge={notificationsCount || undefined} />
              <SidebarLink href="/notifications" label="Notifications" badge={notificationsCount || undefined} />
              <SidebarButton label="Bookmarks" />
              <SidebarButton label="Explore" />
              <SidebarButton label="Events" />
              <SidebarLink href="/settings/profile" label="Settings" />
            </nav>

            <div style={sidebarDividerStyle} />
            <div style={sidebarSectionLabelStyle}>Paranormal Hub</div>
            <nav style={sidebarNavStyle}>
              <SidebarButton label="Investigations" />
              <SidebarButton label="Evidence Vault" />
              <SidebarButton label="Case Files" />
              <SidebarButton label="Reports" />
            </nav>

            <Link href="/reels" style={goLiveCardStyle}>
              <span style={goLiveIconStyle}>+</span>
              <span>
                <strong style={{ display: "block", color: "#fff" }}>Go Live</strong>
                <span style={{ color: "#c4b5fd", fontSize: 12 }}>Share your experience</span>
              </span>
            </Link>

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
                <button type="button" onClick={scrollToComposer} style={squarePurpleButtonStyle} aria-label="Create post">
                  <PlusIcon />
                </button>
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

            <ShowcaseQuickActions currentProfile={currentProfile} currentUserId={currentUserId} friendShowcases={friendShowcases} onCreatePost={scrollToComposer} />

            <ComposerCard
              composerRef={mainComposerRef}
              currentProfile={currentProfile}
              firstName={firstName}
              content={content}
              setContent={setContent}
              image={image}
              imagePreviewUrl={imagePreviewUrl}
              loading={loading}
              fileInputRef={fileInputRef}
              onImageChange={handleImageChange}
              onRemoveImage={handleRemoveImage}
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
                  title={feedMode === "following" ? "No followed posts yet" : "No posts yet"}
                  text={
                    feedMode === "following"
                      ? "Follow more members to build your personal feed."
                      : "Be the first to share an update, photo, investigation, or Parapost Reel."
                  }
                />
              ) : (
                filteredFeedItems.map((item) =>
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
                      openPostMenuId={openPostMenuId}
                      editingPostId={editingPostId}
                      editingPostContent={editingPostContent}
                      setEditingPostContent={setEditingPostContent}
                      setOpenPostMenuId={setOpenPostMenuId}
                      onLike={() => handleLikeToggle(item.post.id)}
                      onShare={() => handleShare(item.post.id)}
                      onFollow={() => handleFollowToggle(item.post.user_id)}
                      onStartEdit={() => handleStartEditPost(item.post)}
                      onSaveEdit={() => handleSavePostEdit(item.post.id)}
                      onCancelEdit={() => {
                        setEditingPostId(null);
                        setEditingPostContent("");
                      }}
                      onDelete={() => handleDeletePost(item.post.id)}
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
                )
              )}
            </section>
          </main>

          <aside className="dashboard-right-rail" style={rightRailStyle}>
            <RightRailCard title="Dashboard Pulse" action="Live">
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

            <RightRailCard title="People to Discover" action="Explore">
              {peopleToDiscover.length === 0 ? (
                <p style={mutedTextStyle}>More members will appear here as your feed grows.</p>
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

            <RightRailCard title="Trending in Parapost">
              <TrendingItem rank="1" title="Shadow Figures" meta="Community conversations" />
              <TrendingItem rank="2" title="EVP Voices" meta="Evidence and clips" />
              <TrendingItem rank="3" title="Haunted Hospitals" meta="Investigations" />
              <TrendingItem rank="4" title="UFO Sightings" meta="Reports and sightings" />
              <TrendingItem rank="5" title="Abandoned Locations" meta="Creators exploring" />
            </RightRailCard>

            <RightRailCard title="Sponsor Space" action="Stripe later">
              <div style={sponsorCardStyle}>
                <div style={sponsorIconStyle}>★</div>
                <div>
                  <strong style={railNameStyle}>Future sponsored placement</strong>
                  <span style={railMetaStyle}>Reserved for Stripe-powered sponsors, boosted posts, and partner campaigns later.</span>
                </div>
              </div>
            </RightRailCard>
          </aside>
        </div>
      </div>

      <MobileBottomNav currentUserId={currentUserId} notificationsCount={notificationsCount} onCreatePost={scrollToComposer} />

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
          border-color: rgba(192, 132, 252, 0.62) !important;
          background: rgba(255,255,255,0.075) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 4px rgba(168,85,247,0.11), 0 18px 42px rgba(0,0,0,0.26) !important;
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
          scrollbar-color: rgba(168,85,247,0.45) rgba(255,255,255,0.04);
        }

        .dashboard-showcase-scroll::-webkit-scrollbar {
          height: 6px;
        }

        .dashboard-showcase-scroll::-webkit-scrollbar-thumb {
          background: rgba(168,85,247,0.44);
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

function SidebarButton({ label, badge }: { label: string; badge?: number | string }) {
  return (
    <div style={sidebarItemStyle}>
      <span style={sidebarIconWrapStyle}><span style={dotIconStyle} /></span>
      <span>{label}</span>
      {badge ? <span style={sidebarBadgeStyle}>{badge}</span> : null}
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
          <div style={{ color: "#c084fc", letterSpacing: "0.42em", fontSize: 13, fontWeight: 900 }}>NETWORK</div>
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
}: {
  currentProfile: ProfilePreview | null;
  currentUserId: string;
  friendShowcases: DashboardShowcaseItem[];
  onCreatePost: () => void;
}) {
  const visibleFriendShowcases = friendShowcases.slice(0, 12);

  return (
    <section className="dashboard-card dashboard-showcase-row" style={showcaseCardStyle}>
      <div className="dashboard-showcase-scroller" style={showcaseScrollerStyle}>
        <Link href={currentUserId ? `/profile/${currentUserId}` : "/dashboard"} style={createShowcaseTileStyle}>
          <NewShowcaseIcon />
          <strong style={showcaseNameStrongStyle}>New</strong>
          <span style={createShowcaseHintStyle}>Create Showcase</span>
        </Link>

        {visibleFriendShowcases.length > 0 ? (
          visibleFriendShowcases.map((showcase) => {
            const profile = showcase.profile;
            const label = showcase.title || showcase.cover_text || profile?.full_name?.split(" ")[0] || profile?.username || "Showcase";

            return (
              <Link key={showcase.id} href={`/profile/${showcase.user_id}`} style={showcaseTileStyle}>
                <div style={friendShowcaseBubbleStyle}>
                  {showcase.media_url && showcase.media_type !== "text" ? (
                    <img src={showcase.media_url} alt="Friend Showcase" style={friendShowcaseMediaStyle} />
                  ) : (
                    <Avatar profile={profile} size={70} />
                  )}
                </div>
                <span style={showcaseNameStyle}>{label}</span>
              </Link>
            );
          })
        ) : (
          <div style={emptyFriendShowcaseTileStyle}>
            <div style={emptyFriendShowcaseIconStyle}>✦</div>
            <span style={showcaseNameStyle}>Friend Showcases</span>
          </div>
        )}

        <button type="button" style={showcaseArrowStyle} aria-label="More friend showcases">
          ›
        </button>
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
  image,
  imagePreviewUrl,
  loading,
  fileInputRef,
  onImageChange,
  onRemoveImage,
  onPost,
}: {
  composerRef: RefObject<HTMLElement | null>;
  currentProfile: ProfilePreview | null;
  firstName: string;
  content: string;
  setContent: (value: string) => void;
  image: File | null;
  imagePreviewUrl: string;
  loading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onPost: () => void;
}) {
  const canPublish = content.trim().length > 0 || !!image;

  return (
    <section id="dashboard-create-post" ref={composerRef} className="dashboard-card dashboard-composer-card" style={composerCardStyle}>
      <div style={composerHeaderStyle}>
        <div style={composerIdentityStyle}>
          <Avatar profile={currentProfile} size={42} />
          <div style={{ minWidth: 0 }}>
            <h2 style={composerTitleStyle}>Create a Post</h2>
            <p style={composerSubtitleStyle}>Share updates, evidence, photos, links, or a quick thought with Parapost Network.</p>
          </div>
        </div>
        <span style={composerDestinationBadgeStyle}>Profile + Feed</span>
      </div>

      <div className="dashboard-composer-top-row" style={composerTopRowStyle}>
        <Avatar profile={currentProfile} size={48} />
        <textarea
          id="dashboard-create-post-input"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={`What's on your mind, ${firstName}?`}
          rows={2}
          style={composerInputStyle}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} style={composerImageButtonStyle} aria-label="Upload image">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 17L8.5 12.5L11 15L15.5 10.5L20 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3" y="5" width="18" height="15" rx="3" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageChange} style={{ display: "none" }} />

      {imagePreviewUrl ? (
        <div style={imagePreviewWrapStyle}>
          <img src={imagePreviewUrl} alt="Selected preview" style={imagePreviewStyle} />
          <div style={imagePreviewMetaRowStyle}>
            {image ? <span style={selectedImageNameStyle}>{image.name}</span> : null}
            <button type="button" onClick={onRemoveImage} style={removeImageButtonStyle}>Remove image</button>
          </div>
        </div>
      ) : null}

      <div className="dashboard-composer-actions" style={composerActionGridStyle}>
        <ComposerActionPill label="Photo / Video" icon="▣" tone="green" onClick={() => fileInputRef.current?.click()} />
        <ComposerActionPill label="Parapost Reel" icon="▶" tone="pink" href="/reels" />
        <ComposerActionPill label="Live Stream" icon="◎" tone="red" onClick={() => alert("Live Stream will be connected in a later dashboard pass.")} />
        <ComposerActionPill label="Feeling / Activity" icon="●" tone="gold" onClick={() => alert("Feeling and activity options will be connected in a later dashboard pass.")} />
      </div>

      <div className="dashboard-composer-footer" style={composerFooterStyle}>
        <span style={composerHelperTextStyle}>
          {content.length} characters · Add text, an image, or both before publishing.
        </span>
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
}: {
  label: string;
  icon: string;
  tone: "green" | "pink" | "red" | "gold";
  href?: string;
  onClick?: () => void;
}) {
  const toneStyle = composerActionToneStyles[tone];
  const content = (
    <>
      <span style={{ ...composerActionIconStyle, ...toneStyle }}>{icon}</span>
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} style={composerActionPillStyle}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} style={composerActionPillStyle}>
      {content}
    </button>
  );
}

function FeedTabs({ feedMode, setFeedMode }: { feedMode: FeedMode; setFeedMode: (mode: FeedMode) => void }) {
  return (
    <div className="dashboard-card" style={feedTabsStyle}>
      <FeedTab label="For You" active={feedMode === "for_you"} onClick={() => setFeedMode("for_you")} />
      <FeedTab label="Following" active={feedMode === "following"} onClick={() => setFeedMode("following")} />
      <FeedTab label="Live" active={feedMode === "live"} onClick={() => setFeedMode("live")} />
      <FeedTab label="Ghost Hunts" active={feedMode === "ghost_hunts"} onClick={() => setFeedMode("ghost_hunts")} />
      <button type="button" style={feedFilterButtonStyle} aria-label="Feed filters">
        <span style={{ display: "block", width: 18, height: 2, borderRadius: 99, background: "currentColor" }} />
        <span style={{ display: "block", width: 12, height: 2, borderRadius: 99, background: "currentColor" }} />
      </button>
    </div>
  );
}

function FeedTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={active ? activeFeedTabStyle : feedTabStyle}>
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
  openPostMenuId,
  editingPostId,
  editingPostContent,
  setEditingPostContent,
  setOpenPostMenuId,
  onLike,
  onShare,
  onFollow,
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
  openPostMenuId: string | null;
  editingPostId: string | null;
  editingPostContent: string;
  setEditingPostContent: (value: string) => void;
  setOpenPostMenuId: (value: string | null | ((prev: string | null) => string | null)) => void;
  onLike: () => void;
  onShare: () => void;
  onFollow: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const isPostOwner = currentUserId === post.user_id;
  const isEditing = editingPostId === post.id;
  const displayName = profile?.full_name || profile?.username || "Parapost user";

  return (
    <article id={`post-${post.id}`} className="dashboard-card dashboard-feed-card" style={postCardStyle} onClick={(event) => event.stopPropagation()}>
      <div className="dashboard-post-header" style={postHeaderStyle}>
        <div style={postAuthorStyle}>
          <Avatar profile={profile} size={54} href={`/profile/${post.user_id}`} />
          <div style={{ minWidth: 0 }}>
            <Link href={`/profile/${post.user_id}`} style={postAuthorNameStyle}>{displayName}</Link>
            <div style={postMetaStyle}>
              @{profile?.username || "member"} · {formatRelativeTime(post.created_at)} · <span style={postPrivacyBadgeStyle}>Public</span>
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
        ) : (
          <button type="button" onClick={onFollow} style={isFollowing ? followingButtonStyle : followButtonStyle}>
            {isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </div>

      {isEditing ? (
        <div style={{ marginTop: 14 }}>
          <textarea value={editingPostContent} onChange={(event) => setEditingPostContent(event.target.value)} rows={4} style={editTextareaStyle} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" onClick={onSaveEdit} style={publishButtonStyle}>Save</button>
            <button type="button" onClick={onCancelEdit} style={softButtonStyle}>Cancel</button>
          </div>
        </div>
      ) : post.content ? (
        <>
          <p style={postContentStyle}>{renderLinkedText(post.content)}</p>
          <LinkPreviewCard text={post.content} />
        </>
      ) : null}

      {post.image_url ? <img src={post.image_url} alt="Post" style={postImageStyle} /> : null}

      <div style={reactionSummaryStyle}>
        <span style={reactionBubblesStyle}>Reactions</span>
        <span style={reactionCountStyle}>{likeCount}</span>
        <span style={{ marginLeft: "auto" }}>{commentCount} Comments</span>
        <span>·</span>
        <span>{shareCount} Shares</span>
      </div>

      <div className="dashboard-post-actions" style={postActionsStyle}>
        <ActionButton onClick={onLike} active={isLiked}><HeartIcon filled={isLiked} /> Like</ActionButton>
        <ActionButton onClick={() => alert("Comments polish comes in the next dashboard pass.")}><CommentIcon /> Comment</ActionButton>
        <ActionButton onClick={onShare}><ShareIcon /> Share</ActionButton>
        <ActionButton onClick={() => alert("Save/bookmarks will be connected in a later pass.")}>Save</ActionButton>
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
          <div style={miniEyebrowStyle}>Dashboard pulse</div>
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
          <span style={privateMiniTextStyle}>Explore</span>
        </div>

        {peopleToDiscover.length === 0 ? (
          <p style={{ ...mutedTextStyle, margin: 0 }}>More member suggestions will appear as the feed grows.</p>
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
          <strong style={railNameStyle}>Sponsor Space</strong>
          <span style={railMetaStyle}>Reserved for future Stripe-powered sponsors and boosted posts.</span>
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
      <strong>{value}</strong>
      <span>{label}</span>
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


const mobileInsightsShellStyle: CSSProperties = {
  display: "none",
  gap: 14,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.11)",
  background: "linear-gradient(180deg, rgba(18,24,38,0.94), rgba(8,10,18,0.92))",
  boxShadow: "0 18px 48px rgba(0,0,0,0.30)",
  padding: 16,
};

const mobileInsightsHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const miniEyebrowStyle: CSSProperties = {
  color: "#c084fc",
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const privatePillStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(192,132,252,0.24)",
  background: "rgba(168,85,247,0.12)",
  color: "#e9d5ff",
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
  border: "1px solid rgba(168,85,247,0.20)",
  background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(6,182,212,0.05))",
  padding: 12,
};

const railHeroProfileStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(255,255,255,0.035))",
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
  display: "grid",
  placeItems: "center",
  color: "#c4b5fd",
  background: "rgba(168,85,247,0.10)",
  border: "1px solid rgba(168,85,247,0.18)",
  fontSize: 20,
  flexShrink: 0,
};

const privacyNoticeStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(192,132,252,0.18)",
  background: "rgba(168,85,247,0.08)",
  color: "#e9d5ff",
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
  background: "linear-gradient(135deg, rgba(236,72,153,0.12), rgba(168,85,247,0.10))",
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
  background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(6,182,212,0.06))",
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
  background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
  boxShadow: "0 0 22px rgba(168,85,247,0.24)",
  flexShrink: 0,
};

const dashboardRootStyle: CSSProperties = {
  minHeight: "100vh",
  height: "auto",
  width: "100%",
  maxWidth: "100vw",
  position: "relative",
  overflowX: "hidden",
  overflowY: "visible",
  background:
    "radial-gradient(circle at 55% 0%, rgba(56,189,248,0.11), transparent 34%), radial-gradient(circle at 10% 10%, rgba(147,51,234,0.18), transparent 30%), #05070d",
  color: "#f9fafb",
};

const backgroundGlowStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(90deg, rgba(0,0,0,0.7), rgba(0,0,0,0.1), rgba(0,0,0,0.64)), radial-gradient(circle at 75% 30%, rgba(168,85,247,0.12), transparent 28%)",
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
  minHeight: "calc(100vh - 36px)",
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
  display: "grid",
  gap: "18px",
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
  background: "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(255,255,255,0.04))",
  border: "2px solid rgba(236,72,153,0.72)",
  boxShadow: "0 0 28px rgba(168,85,247,0.55)",
  color: "#fff",
  fontWeight: 950,
  fontSize: 24,
};

const logoWordStyle: CSSProperties = { fontSize: 32, fontWeight: 950, lineHeight: 0.95, letterSpacing: "0.02em" };
const logoNetworkStyle: CSSProperties = { color: "#c084fc", letterSpacing: "0.42em", fontWeight: 900, fontSize: 14, marginTop: 5 };

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
  background: "linear-gradient(90deg, rgba(126,34,206,0.92), rgba(76,29,149,0.28))",
  border: "1px solid rgba(168,85,247,0.45)",
  boxShadow: "0 0 24px rgba(126,34,206,0.24)",
};

const sidebarIconWrapStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center" };
const dotIconStyle: CSSProperties = { width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.55)" };
const sidebarBadgeStyle: CSSProperties = { minWidth: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 900, padding: "0 7px" };
const sidebarDividerStyle: CSSProperties = { height: 1, background: "rgba(255,255,255,0.12)", margin: "20px 0" };
const sidebarSectionLabelStyle: CSSProperties = { color: "#c084fc", fontSize: 12, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 };

const goLiveCardStyle: CSSProperties = {
  marginTop: 22,
  display: "flex",
  alignItems: "center",
  gap: 12,
  borderRadius: 18,
  padding: 16,
  textDecoration: "none",
  background: "linear-gradient(135deg, rgba(126,34,206,0.72), rgba(76,29,149,0.46))",
  border: "1px solid rgba(168,85,247,0.65)",
  boxShadow: "0 0 26px rgba(126,34,206,0.28)",
};

const goLiveIconStyle: CSSProperties = { width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 26 };
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
  padding: "0 14px 0 18px",
  color: "#d1d5db",
  flex: 1,
  maxWidth: 620,
};

const searchInputStyle: CSSProperties = { flex: 1, minWidth: 0, height: "100%", background: "transparent", color: "#fff", border: 0, outline: 0, fontSize: 15, fontWeight: 750 };
const searchFilterButtonStyle: CSSProperties = { width: 36, height: 36, borderRadius: 14, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.045)", color: "#d1d5db", cursor: "pointer", display: "grid", placeItems: "center", gap: 4 };
const searchDropdownStyle: CSSProperties = { position: "absolute", left: 0, right: 0, top: "calc(100% + 10px)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(8,10,18,0.96)", backdropFilter: "blur(18px)", padding: 12, zIndex: 80, boxShadow: "0 22px 60px rgba(0,0,0,0.5)" };

const topActionRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 14 };
const squarePurpleButtonStyle: CSSProperties = { width: 54, height: 54, borderRadius: 16, display: "grid", placeItems: "center", border: "1px solid rgba(168,85,247,0.55)", background: "linear-gradient(135deg, #7c3aed, #3b0764)", color: "#fff", boxShadow: "0 0 26px rgba(126,34,206,0.35)", cursor: "pointer" };
const topIconButtonStyle: CSSProperties = { position: "relative", width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", color: "#fff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" };
const topProfileButtonStyle: CSSProperties = { width: 46, height: 46, borderRadius: 16, display: "grid", placeItems: "center", textDecoration: "none", border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.045)", overflow: "visible" };
const topBadgeStyle: CSSProperties = { position: "absolute", top: -8, right: -8, minWidth: 22, height: 22, borderRadius: 999, background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 950, display: "grid", placeItems: "center", padding: "0 6px" };

const showcaseCardStyle: CSSProperties = { borderRadius: 24, border: "1px solid rgba(255,255,255,0.11)", background: "rgba(255,255,255,0.045)", padding: 14, marginBottom: 18, overflow: "hidden" };
const showcaseQuickGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.34fr) minmax(260px, 0.66fr)", gap: 16, alignItems: "stretch" };
const showcaseColumnStyle: CSSProperties = { minWidth: 0, display: "flex", flexDirection: "column", gap: 12 };
const showcaseSectionHeaderStyle: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" };
const showcaseSectionTitleStyle: CSSProperties = { margin: 0, color: "#fff", fontSize: 18, fontWeight: 950, letterSpacing: "-0.02em" };
const showcaseSectionSubtitleStyle: CSSProperties = { margin: "4px 0 0", color: "#9ca3af", fontSize: 12.5, lineHeight: 1.35 };
const showcaseSmallLinkStyle: CSSProperties = { minHeight: 32, borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.055)", color: "#e9d5ff", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 11px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" };
const showcaseScrollerStyle: CSSProperties = { display: "flex", gap: 16, alignItems: "stretch", overflowX: "auto", overflowY: "hidden", padding: "2px 2px 4px", scrollSnapType: "x proximity" };
const createShowcaseTileStyle: CSSProperties = { position: "relative", width: 104, minWidth: 104, height: 116, display: "grid", justifyItems: "center", alignContent: "center", gap: 6, borderRadius: 18, border: "1px solid rgba(168,85,247,0.22)", color: "#fff", textDecoration: "none", background: "linear-gradient(180deg, rgba(168,85,247,0.14), rgba(0,0,0,0.18))", padding: 10, scrollSnapAlign: "start" };
const showcasePlusStyle: CSSProperties = { position: "absolute", right: 20, top: 62, width: 27, height: 27, borderRadius: 999, background: "#7c3aed", color: "#fff", display: "grid", placeItems: "center", border: "2px solid #0a0d14", fontWeight: 950 };
const createShowcaseHintStyle: CSSProperties = { color: "#c4b5fd", fontSize: 11, fontWeight: 850, textAlign: "center", lineHeight: 1.15 };
const showcaseTileStyle: CSSProperties = { width: 104, minWidth: 104, height: 116, display: "grid", justifyItems: "center", alignContent: "center", gap: 8, color: "#fff", textDecoration: "none", scrollSnapAlign: "start" };
const demoAvatarStyle: CSSProperties = { width: 78, height: 78, borderRadius: 999, border: "3px solid #7c3aed", display: "grid", placeItems: "center", background: "linear-gradient(135deg, rgba(168,85,247,0.28), rgba(0,0,0,0.8))", fontWeight: 950, fontSize: 26, boxShadow: "0 0 22px rgba(126,34,206,0.32)" };
const showcaseNameStyle: CSSProperties = { width: "100%", fontSize: 12.5, textAlign: "center", color: "#e5e7eb", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const showcaseNameStrongStyle: CSSProperties = { color: "#fff", fontSize: 13, fontWeight: 950, textAlign: "center", lineHeight: 1.05 };
const newShowcaseIconStyle: CSSProperties = { width: 70, height: 70, borderRadius: 999, display: "grid", placeItems: "center", background: "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.24), rgba(168,85,247,0.18) 42%, rgba(7,9,13,0.98) 76%)", border: "3px solid rgba(168,85,247,0.86)", boxShadow: "0 0 22px rgba(168,85,247,0.36), inset 0 1px 0 rgba(255,255,255,0.13)" };
const newShowcasePlusInnerStyle: CSSProperties = { width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", fontSize: 24, fontWeight: 950, boxShadow: "0 10px 22px rgba(126,34,206,0.34)" };
const friendShowcaseBubbleStyle: CSSProperties = { width: 76, height: 76, borderRadius: 999, display: "grid", placeItems: "center", overflow: "hidden", padding: 3, background: "linear-gradient(135deg, rgba(168,85,247,0.9), rgba(6,182,212,0.72))", boxShadow: "0 0 22px rgba(168,85,247,0.32)", border: "1px solid rgba(255,255,255,0.12)" };
const friendShowcaseMediaStyle: CSSProperties = { width: "100%", height: "100%", borderRadius: 999, objectFit: "cover", display: "block", border: "2px solid #07090d" };
const emptyFriendShowcaseTileStyle: CSSProperties = { width: 146, minWidth: 146, height: 116, display: "grid", justifyItems: "center", alignContent: "center", gap: 8, borderRadius: 18, border: "1px dashed rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.025)", color: "#d1d5db", scrollSnapAlign: "start" };
const emptyFriendShowcaseIconStyle: CSSProperties = { width: 54, height: 54, borderRadius: 999, display: "grid", placeItems: "center", border: "2px solid rgba(168,85,247,0.42)", color: "#c084fc", background: "rgba(168,85,247,0.10)", fontWeight: 950 };
const showcaseArrowStyle: CSSProperties = { alignSelf: "center", minWidth: 38, width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 30, cursor: "pointer" };
const quickActionsColumnStyle: CSSProperties = { borderRadius: 22, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.18)", padding: 12, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
const quickActionsHeaderStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const quickActionsEyebrowStyle: CSSProperties = { color: "#c084fc", fontSize: 11, fontWeight: 950, letterSpacing: "0.08em", textTransform: "uppercase" };
const quickActionsTitleStyle: CSSProperties = { color: "#fff", fontSize: 15, fontWeight: 950 };
const quickActionsGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr", gap: 9 };
const quickActionTileStyle: CSSProperties = { minHeight: 54, borderRadius: 18, border: "1px solid rgba(255,255,255,0.095)", background: "rgba(255,255,255,0.045)", color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", cursor: "pointer", textAlign: "left", width: "100%" };
const quickActionIconStyle: CSSProperties = { width: 32, height: 32, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(168,85,247,0.18)", color: "#e9d5ff", fontWeight: 950, flexShrink: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" };
const quickActionLabelStyle: CSSProperties = { display: "block", color: "#fff", fontSize: 13, fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const quickActionTextStyle: CSSProperties = { display: "block", color: "#9ca3af", fontSize: 11.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

const composerCardStyle: CSSProperties = { borderRadius: 28, border: "1px solid rgba(255,255,255,0.13)", background: "linear-gradient(180deg, rgba(20,26,43,0.92), rgba(9,12,21,0.92))", padding: 18, marginBottom: 16, boxShadow: "0 20px 54px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.055)", overflow: "hidden", scrollMarginTop: 96 };
const composerHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 };
const composerIdentityStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, minWidth: 0 };
const composerTitleStyle: CSSProperties = { margin: 0, color: "#fff", fontSize: 17, fontWeight: 950, letterSpacing: "-0.02em" };
const composerSubtitleStyle: CSSProperties = { margin: "3px 0 0", color: "#9ca3af", fontSize: 12.5, lineHeight: 1.35 };
const composerDestinationBadgeStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: 30, borderRadius: 999, padding: "0 11px", color: "#f5f3ff", fontSize: 11, fontWeight: 950, whiteSpace: "nowrap", background: "rgba(126,34,206,0.32)", border: "1px solid rgba(168,85,247,0.35)", boxShadow: "0 10px 24px rgba(126,34,206,0.18)" };
const composerTopRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 12, alignItems: "center" };
const composerInputStyle: CSSProperties = { width: "100%", minHeight: 58, maxHeight: 140, resize: "vertical", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, background: "rgba(255,255,255,0.045)", color: "#fff", outline: 0, padding: "18px 20px", fontSize: 16, lineHeight: 1.35, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)" };
const composerImageButtonStyle: CSSProperties = { width: 50, height: 50, borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 };
const composerActionGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, alignItems: "center", marginTop: 14 };
const composerActionPillStyle: CSSProperties = { minHeight: 42, borderRadius: 999, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.045)", color: "#fff", padding: "0 14px", fontWeight: 850, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", whiteSpace: "nowrap", fontSize: 13 };
const composerActionIconStyle: CSSProperties = { width: 24, height: 24, borderRadius: 8, display: "grid", placeItems: "center", color: "#fff", fontSize: 13, fontWeight: 950, lineHeight: 1 };
const composerActionToneStyles: Record<"green" | "pink" | "red" | "gold", CSSProperties> = {
  green: { background: "rgba(34,197,94,0.18)", color: "#86efac" },
  pink: { background: "rgba(236,72,153,0.18)", color: "#f9a8d4" },
  red: { background: "rgba(239,68,68,0.18)", color: "#fca5a5" },
  gold: { background: "rgba(245,158,11,0.18)", color: "#fde68a" },
};
const composerFooterStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14, flexWrap: "wrap" };
const composerHelperTextStyle: CSSProperties = { color: "#6b7280", fontSize: 12.5, lineHeight: 1.35 };
const publishButtonStyle: CSSProperties = { marginLeft: "auto", minHeight: 40, borderRadius: 999, border: 0, background: "linear-gradient(135deg, #ffffff, #c4b5fd)", color: "#111827", fontWeight: 950, padding: "0 18px", cursor: "pointer", boxShadow: "0 12px 24px rgba(168,85,247,0.24)", whiteSpace: "nowrap" };

const imagePreviewWrapStyle: CSSProperties = { marginTop: 14, borderRadius: 20, border: "1px solid rgba(255,255,255,0.10)", overflow: "hidden", background: "rgba(0,0,0,0.22)", position: "relative" };
const imagePreviewStyle: CSSProperties = { width: "100%", maxHeight: 360, objectFit: "cover", display: "block" };
const imagePreviewMetaRowStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12, flexWrap: "wrap" };
const removeImageButtonStyle: CSSProperties = { border: "1px solid rgba(248,113,113,0.3)", background: "rgba(127,29,29,0.82)", color: "#fff", borderRadius: 999, padding: "8px 12px", fontWeight: 900, cursor: "pointer" };
const selectedImageNameStyle: CSSProperties = { maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRadius: 999, padding: "7px 10px", background: "rgba(0,0,0,0.62)", color: "#e5e7eb", fontSize: 12 };

const feedTabsStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, borderRadius: 24, border: "1px solid rgba(255,255,255,0.11)", background: "rgba(255,255,255,0.045)", padding: 8, margin: "16px 0", overflowX: "auto" };
const feedTabStyle: CSSProperties = { border: 0, background: "transparent", color: "#d1d5db", padding: "12px 18px", borderRadius: 18, cursor: "pointer", fontSize: 16, whiteSpace: "nowrap" };
const activeFeedTabStyle: CSSProperties = { ...feedTabStyle, color: "#c084fc", background: "rgba(126,34,206,0.18)", boxShadow: "inset 0 -3px 0 #a855f7", fontWeight: 900 };
const feedFilterButtonStyle: CSSProperties = { marginLeft: "auto", minWidth: 44, height: 44, borderRadius: 15, border: "1px solid rgba(255,255,255,0.11)", background: "rgba(255,255,255,0.04)", color: "#e5e7eb", display: "grid", placeItems: "center", gap: 4, cursor: "pointer" };

const feedStackStyle: CSSProperties = { display: "grid", gap: 16 };
const emptyStateStyle: CSSProperties = { borderRadius: 24, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.045)", padding: 22 };
const feedPulseStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 16,
  alignItems: "center",
  borderRadius: 22,
  border: "1px solid rgba(168,85,247,0.18)",
  background: "linear-gradient(135deg, rgba(126,34,206,0.18), rgba(15,23,42,0.72))",
  padding: 16,
  boxShadow: "0 18px 42px rgba(0,0,0,0.22)",
};
const feedPulseEyebrowStyle: CSSProperties = { color: "#c084fc", fontSize: 11, fontWeight: 950, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 };
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
const postAuthorNameStyle: CSSProperties = { display: "block", color: "#fff", textDecoration: "none", fontWeight: 950, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const postMetaStyle: CSSProperties = { color: "#a1a1aa", fontSize: 13, marginTop: 3 };
const postContentStyle: CSSProperties = { color: "#f9fafb", lineHeight: 1.58, fontSize: 16, whiteSpace: "pre-wrap", margin: "10px 0 0" };
const postImageStyle: CSSProperties = { width: "100%", maxHeight: 680, objectFit: "cover", display: "block", borderRadius: 20, border: "1px solid rgba(255,255,255,0.10)", marginTop: 14, boxShadow: "0 18px 38px rgba(0,0,0,0.32)" };
const dotsButtonStyle: CSSProperties = { width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" };
const postMenuStyle: CSSProperties = { position: "absolute", right: 0, top: 45, minWidth: 170, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(8,10,18,0.96)", zIndex: 30, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" };
const menuItemStyle: CSSProperties = { width: "100%", textAlign: "left", border: 0, background: "transparent", color: "#fff", padding: "12px 14px", cursor: "pointer", fontWeight: 850 };
const followButtonStyle: CSSProperties = { border: 0, borderRadius: 999, background: "linear-gradient(135deg, #7c3aed, #ec4899)", color: "#fff", minHeight: 36, padding: "0 14px", fontWeight: 950, cursor: "pointer" };
const followingButtonStyle: CSSProperties = { ...followButtonStyle, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e5e7eb" };
const editTextareaStyle: CSSProperties = { width: "100%", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 18, background: "rgba(255,255,255,0.04)", color: "#fff", outline: 0, padding: 14, resize: "vertical" };
const softButtonStyle: CSSProperties = { border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, background: "rgba(255,255,255,0.06)", color: "#fff", minHeight: 38, padding: "0 16px", fontWeight: 850, cursor: "pointer" };
const softDangerButtonStyle: CSSProperties = { ...softButtonStyle, color: "#fecaca", border: "1px solid rgba(248,113,113,0.24)" };
const reactionSummaryStyle: CSSProperties = { display: "flex", gap: 9, alignItems: "center", color: "#d1d5db", fontSize: 14, borderBottom: "1px solid rgba(255,255,255,0.10)", paddingBottom: 12, marginTop: 14 };
const reactionBubblesStyle: CSSProperties = { borderRadius: 999, background: "linear-gradient(135deg, #3b82f6, #ec4899)", padding: "3px 7px", color: "#fff", fontSize: 12, fontWeight: 900 };
const reactionCountStyle: CSSProperties = { color: "#f9fafb", fontWeight: 850 };
const postPrivacyBadgeStyle: CSSProperties = { color: "#c4b5fd", fontWeight: 850 };
const postActionsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 10 };
const actionButtonStyle: CSSProperties = { minHeight: 42, borderRadius: 14, border: "1px solid transparent", background: "transparent", color: "#e5e7eb", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontWeight: 850, cursor: "pointer" };
const activeActionButtonStyle: CSSProperties = { ...actionButtonStyle, color: "#c084fc", background: "rgba(126,34,206,0.12)", border: "1px solid rgba(168,85,247,0.22)" };

const sharedReelFrameStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(150px, 220px) 1fr", gap: 14, alignItems: "center", marginTop: 14, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 22, padding: 12, background: "rgba(0,0,0,0.24)" };
const sharedReelVideoStyle: CSSProperties = { position: "relative", display: "block", aspectRatio: "9 / 16", maxHeight: 360, borderRadius: 18, overflow: "hidden", background: "#000", textDecoration: "none" };
const sharedReelOverlayStyle: CSSProperties = { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", fontSize: 34, background: "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.38))" };
const sharedReelBadgeStyle: CSSProperties = { display: "inline-flex", borderRadius: 999, border: "1px solid rgba(168,85,247,0.26)", background: "rgba(126,34,206,0.16)", color: "#d8b4fe", padding: "7px 10px", fontSize: 12, fontWeight: 950 };
const sharedCaptionStyle: CSSProperties = { color: "#d1d5db", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" };
const watchReelButtonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, minHeight: 38, padding: "0 14px", background: "#fff", color: "#0b1020", textDecoration: "none", fontWeight: 950 };

const railCardStyle: CSSProperties = { borderRadius: 22, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.045)", padding: 18, boxShadow: "0 18px 42px rgba(0,0,0,0.22)" };
const railCardHeaderStyle: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 };
const railActionStyle: CSSProperties = { color: "#c084fc", fontSize: 13, fontWeight: 900 };
const liveRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "center" };
const liveThumbStyle: CSSProperties = { position: "relative", height: 70, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(248,113,113,0.45)", background: "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(0,0,0,0.82)), radial-gradient(circle at 70% 30%, rgba(255,255,255,0.16), transparent 28%)" };
const liveBadgeStyle: CSSProperties = { position: "absolute", left: 8, top: 8, borderRadius: 7, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 950, padding: "4px 6px" };
const railNameStyle: CSSProperties = { display: "block", color: "#fff", fontSize: 14, lineHeight: 1.35 };
const railMetaStyle: CSSProperties = { display: "block", color: "#9ca3af", fontSize: 12, marginTop: 2 };
const trendingRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "26px 1fr", gap: 10, alignItems: "start" };
const trendingRankStyle: CSSProperties = { color: "#c084fc", fontSize: 18, fontWeight: 950 };
const mutedTextStyle: CSSProperties = { color: "#9ca3af", lineHeight: 1.55, margin: 0, fontSize: 13 };
const recentProfileRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "center", textDecoration: "none", borderRadius: 14, padding: 8, background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" };
const statRowStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, color: "#d1d5db", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 };
const searchResultRowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "center", textDecoration: "none", borderRadius: 14, padding: 10, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" };
const onlineDotStyle: CSSProperties = { position: "absolute", right: 3, bottom: 3, width: 12, height: 12, borderRadius: 999, background: "#22c55e", border: "2px solid #07090d", boxShadow: "0 0 10px rgba(34,197,94,0.65)" };

const modalOverlayStyle: CSSProperties = { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(12px)", display: "grid", placeItems: "start center", padding: "82px 18px 24px" };
const searchModalStyle: CSSProperties = { width: "min(620px, 100%)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.12)", background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(8,10,18,0.98))", boxShadow: "0 28px 80px rgba(0,0,0,0.58)", padding: 18 };
const modalHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 14 };
const modalEyebrowStyle: CSSProperties = { color: "#c084fc", textTransform: "uppercase", letterSpacing: "0.14em", fontSize: 11, fontWeight: 950, marginBottom: 4 };
const modalCloseButtonStyle: CSSProperties = { width: 40, height: 40, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 26, cursor: "pointer" };

const mobileHeaderStyle: CSSProperties = { display: "none", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "18px 16px 12px", position: "sticky", top: 0, zIndex: 60, background: "linear-gradient(180deg, rgba(5,7,13,0.985), rgba(5,7,13,0.86))", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.055)" };
const mobileLogoStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, color: "#fff", textDecoration: "none", minWidth: 0, flex: "1 1 auto" };
const mobileLogoCircleStyle: CSSProperties = { width: 54, height: 54, borderRadius: 999, display: "grid", placeItems: "center", border: "2px solid rgba(236,72,153,0.72)", background: "rgba(126,34,206,0.18)", boxShadow: "0 0 22px rgba(126,34,206,0.42)", fontWeight: 950 };
const mobileHeaderActionsStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 };
const mobileTopIconButtonStyle: CSSProperties = { position: "relative", width: 42, height: 42, borderRadius: 14, color: "#fff", background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.10)", display: "grid", placeItems: "center", textDecoration: "none", cursor: "pointer" };

const mobileBottomNavStyle: CSSProperties = { position: "fixed", left: 12, right: 12, bottom: 10, zIndex: 120, gridTemplateColumns: "repeat(5, 1fr)", alignItems: "center", gap: 4, minHeight: 76, padding: "8px 10px", borderRadius: 26, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(8,10,18,0.94)", backdropFilter: "blur(18px)", boxShadow: "0 22px 60px rgba(0,0,0,0.56)" };
const mobileNavItemStyle: CSSProperties = { color: "#e5e7eb", textDecoration: "none", display: "grid", placeItems: "center", gap: 4, fontSize: 11, fontWeight: 800 };
const mobileNavItemActiveStyle: CSSProperties = { ...mobileNavItemStyle, color: "#c084fc", textShadow: "0 0 16px rgba(168,85,247,0.52)" };
const mobileCenterPlusStyle: CSSProperties = { width: 58, height: 58, margin: "-24px auto 0", borderRadius: 999, display: "grid", placeItems: "center", color: "#0b1020", background: "#fff", border: "4px solid #7c3aed", boxShadow: "0 0 0 4px rgba(236,72,153,0.32), 0 16px 38px rgba(126,34,206,0.38)", cursor: "pointer", textDecoration: "none", padding: 0, font: "inherit" };
const mobileNavBadgeStyle: CSSProperties = { position: "absolute", right: -10, top: -9, minWidth: 21, height: 21, borderRadius: 999, display: "grid", placeItems: "center", background: "#7c3aed", color: "#fff", fontSize: 11, fontWeight: 950, padding: "0 5px" };
