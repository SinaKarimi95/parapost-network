"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ReelRow = {
  id: string;
  user_id: string | null;
  creator_profile_id?: string | null;
  title: string | null;
  caption: string | null;
  video_url: string | null;
  poster_url: string | null;
  created_at: string | null;
};

type ProfilePreview = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_online?: boolean | null;
};

type FriendRequestRow = {
  sender_id: string | null;
  receiver_id: string | null;
  status: string | null;
};

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

function getInitial(name?: string | null, username?: string | null) {
  const value = name || username || "P";
  return value.charAt(0).toUpperCase();
}

function formatCompactTime(value?: string | null) {
  if (!value) return "new";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "new";

  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  const years = Math.floor(days / 365);
  return `${years}y`;
}

export default function DashboardReelsSection() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfilePreview>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const rowRef = useRef<HTMLDivElement | null>(null);

  const visibleUserIds = useMemo(() => {
    return [...new Set([currentUserId, ...friendIds].filter(Boolean))];
  }, [currentUserId, friendIds]);

  const fetchFriendIds = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("friend_requests")
      .select("sender_id, receiver_id, status")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq("status", "accepted");

    if (error) {
      console.error("Dashboard friend Reels friend fetch error:", error.message);
      return [] as string[];
    }

    const ids = ((data || []) as FriendRequestRow[])
      .map((row) => (row.sender_id === userId ? row.receiver_id : row.sender_id))
      .filter(Boolean) as string[];

    return [...new Set(ids)];
  }, []);

  const fetchProfiles = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];

    if (uniqueIds.length === 0) {
      setProfilesMap({});
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, is_online")
      .in("id", uniqueIds);

    if (error) {
      console.error("Dashboard friend Reels profile fetch error:", error.message);
      return;
    }

    const nextMap: Record<string, ProfilePreview> = {};
    for (const profile of data || []) {
      nextMap[profile.id] = profile as ProfilePreview;
    }

    setProfilesMap(nextMap);
  }, []);

  const fetchDashboardReels = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setCurrentUserId("");
      setFriendIds([]);
      setReels([]);
      setProfilesMap({});
      setMessage("Sign in to see Reels from your friend circle.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const acceptedFriendIds = await fetchFriendIds(user.id);
    setFriendIds(acceptedFriendIds);

    const allowedIds = [...new Set([user.id, ...acceptedFriendIds].filter(Boolean))];

    if (allowedIds.length === 0) {
      setReels([]);
      setProfilesMap({});
      setLoading(false);
      return;
    }

    const safeIds = allowedIds.length ? allowedIds : [EMPTY_UUID];

    const { data, error } = await supabase
      .from("reels")
      .select("id, user_id, creator_profile_id, title, caption, video_url, poster_url, created_at")
      .in("user_id", safeIds)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      console.error("Dashboard friend Reels fetch error:", error.message);
      setReels([]);
      setMessage("Reels are still loading. Please refresh if they do not appear.");
      setLoading(false);
      return;
    }

    const nextReels = ((data || []) as ReelRow[]).filter((reel) => !!reel.video_url);
    const profileIds = nextReels.map((reel) => reel.creator_profile_id || reel.user_id || "");

    await fetchProfiles([...allowedIds, ...profileIds]);
    setReels(nextReels);
    setLoading(false);
  }, [fetchFriendIds, fetchProfiles]);

  useEffect(() => {
    fetchDashboardReels();
  }, [fetchDashboardReels]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`dashboard-friend-reels-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reels" }, () => {
        fetchDashboardReels();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => {
        fetchDashboardReels();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchDashboardReels]);

  const scrollReels = (direction: "left" | "right") => {
    const row = rowRef.current;
    if (!row) return;

    row.scrollBy({
      left: direction === "right" ? 320 : -320,
      behavior: "smooth",
    });
  };

  return (
    <section style={reelsSectionStyle} className="dashboard-card dashboard-reels-row-card">
      <div style={reelsHeaderStyle}>
        <div style={{ minWidth: 0 }}>
          <h2 style={reelsTitleStyle}>Parapost Reels</h2>
          <p style={reelsSubtitleStyle}>
            Watch short videos, updates, creator moments, and everyday clips from your friend circle.
          </p>
        </div>

        <div style={reelsHeaderActionsStyle}>
          {reels.length > 3 ? (
            <div style={scrollButtonGroupStyle} aria-label="Scroll friend Reels">
              <button type="button" onClick={() => scrollReels("left")} style={smallScrollButtonStyle} aria-label="Scroll left">
                ‹
              </button>
              <button type="button" onClick={() => scrollReels("right")} style={smallScrollButtonStyle} aria-label="Scroll right">
                ›
              </button>
            </div>
          ) : null}

          <Link href="/reels" style={watchReelsButtonStyle}>
            Watch Reels
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={reelsEmptyStyle}>Loading friend Reels...</div>
      ) : reels.length === 0 ? (
        <div style={reelsEmptyStyle}>
          {message || "No friend Reels yet. When you or your friends upload Reels, they will appear here automatically."}
        </div>
      ) : (
        <div ref={rowRef} style={reelsScrollerStyle} className="dashboard-friend-reels-scroller">
          {reels.map((reel) => {
            const ownerId = reel.creator_profile_id || reel.user_id || "";
            const profile = profilesMap[ownerId] || profilesMap[reel.user_id || ""];
            const title = reel.title || reel.caption || "Parapost Reel";
            const handle = profile?.username || "parapost";

            return (
              <Link key={reel.id} href={`/reels?reel=${reel.id}`} style={reelCardStyle}>
                <video
                  src={reel.video_url || undefined}
                  poster={reel.poster_url || undefined}
                  muted
                  playsInline
                  preload="metadata"
                  style={reelVideoStyle}
                />

                <div style={reelGradientStyle} />

                <div style={reelFooterStyle}>
                  <div style={reelAuthorRowStyle}>
                    <div style={reelAvatarStyle}>
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" style={reelAvatarImageStyle} />
                      ) : (
                        <span>{getInitial(profile?.full_name, profile?.username)}</span>
                      )}
                    </div>
                    <span style={reelTimeStyle}>{formatCompactTime(reel.created_at)}</span>
                  </div>

                  <strong style={reelTitleTextStyle}>{title}</strong>
                  <span style={reelHandleStyle}>@{handle}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        .dashboard-friend-reels-scroller {
          scrollbar-width: thin;
          scrollbar-color: rgba(168, 85, 247, 0.42) rgba(255, 255, 255, 0.04);
        }

        .dashboard-friend-reels-scroller::-webkit-scrollbar {
          height: 7px;
        }

        .dashboard-friend-reels-scroller::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.42);
          border-radius: 999px;
        }

        @media (max-width: 760px) {
          .dashboard-reels-row-card {
            padding: 13px !important;
            border-radius: 23px !important;
          }

          .dashboard-friend-reels-scroller {
            margin-left: -2px;
            margin-right: -2px;
            padding-left: 2px;
            padding-right: 2px;
          }
        }
      `}</style>
    </section>
  );
}

const reelsSectionStyle: CSSProperties = {
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.11)",
  background: "linear-gradient(180deg, rgba(22,28,44,0.92), rgba(12,15,26,0.92))",
  padding: 16,
  marginBottom: 16,
  boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
  overflow: "hidden",
};

const reelsHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};

const reelsTitleStyle: CSSProperties = {
  margin: 0,
  color: "#fff",
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: "-0.02em",
};

const reelsSubtitleStyle: CSSProperties = {
  margin: "5px 0 0",
  color: "#9ca3af",
  fontSize: 12.5,
  lineHeight: 1.45,
};

const reelsHeaderActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
};

const watchReelsButtonStyle: CSSProperties = {
  minHeight: 32,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.075)",
  color: "#f9fafb",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 11px",
  fontSize: 12,
  fontWeight: 850,
  whiteSpace: "nowrap",
};

const scrollButtonGroupStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const smallScrollButtonStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 11,
  border: "1px solid rgba(255,255,255,0.11)",
  background: "rgba(255,255,255,0.055)",
  color: "#e5e7eb",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  fontSize: 22,
  lineHeight: 1,
  fontWeight: 900,
};

const reelsScrollerStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  overflowX: "auto",
  overflowY: "hidden",
  scrollSnapType: "x proximity",
  paddingBottom: 4,
};

const reelCardStyle: CSSProperties = {
  position: "relative",
  minWidth: 142,
  width: 142,
  height: 250,
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#05070d",
  color: "#fff",
  textDecoration: "none",
  boxShadow: "0 14px 30px rgba(0,0,0,0.28)",
  scrollSnapAlign: "start",
  flexShrink: 0,
};

const reelVideoStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const reelGradientStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(180deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.18) 42%, rgba(0,0,0,0.78) 100%)",
  pointerEvents: "none",
};

const reelFooterStyle: CSSProperties = {
  position: "absolute",
  left: 10,
  right: 10,
  bottom: 10,
  display: "grid",
  gap: 4,
};

const reelAuthorRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const reelAvatarStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  overflow: "hidden",
  background: "linear-gradient(135deg, rgba(168,85,247,0.85), rgba(6,182,212,0.78))",
  border: "1px solid rgba(255,255,255,0.24)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 950,
};

const reelAvatarImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const reelTimeStyle: CSSProperties = {
  color: "rgba(255,255,255,0.72)",
  fontSize: 10,
  fontWeight: 850,
};

const reelTitleTextStyle: CSSProperties = {
  color: "#fff",
  fontSize: 12.5,
  lineHeight: 1.18,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const reelHandleStyle: CSSProperties = {
  color: "rgba(255,255,255,0.75)",
  fontSize: 10.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const reelsEmptyStyle: CSSProperties = {
  minHeight: 92,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  color: "#9ca3af",
  display: "grid",
  placeItems: "center",
  padding: 16,
  textAlign: "center",
  fontSize: 13,
  lineHeight: 1.5,
};
