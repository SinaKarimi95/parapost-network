"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string | null;
  post_id: string | null;
  comment_id: string | null;
  friend_request_id: string | null;
  message: string | null;
  is_read: boolean | null;
  created_at: string | null;
};

type ProfilePreview = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_online?: boolean | null;
};

type NotificationCard = NotificationRow & {
  actor: ProfilePreview | null;
};

function getDisplayName(profile: ProfilePreview | null) {
  return profile?.full_name || profile?.username || "Parapost Member";
}

function getInitial(profile: ProfilePreview | null) {
  return getDisplayName(profile).charAt(0).toUpperCase();
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

function getNotificationTitle(notification: NotificationCard) {
  const actorName = getDisplayName(notification.actor);
  const type = notification.type || "";

  if (notification.message?.trim()) return notification.message.trim();

  if (type === "friend_request") return `${actorName} sent you a friend request.`;
  if (type === "friend_accept") return `${actorName} accepted your friend request.`;
  if (type === "post_like") return `${actorName} liked your post.`;
  if (type === "comment_like") return `${actorName} liked your comment.`;
  if (type === "comment_reply") return `${actorName} replied to your comment.`;
  if (type === "post_comment") return `${actorName} commented on your post.`;
  if (type === "reel_like") return `${actorName} liked your Reel.`;
  if (type === "reel_comment") return `${actorName} commented on your Reel.`;
  if (type === "badge_award") return "You earned a new badge.";
  if (type === "share") return `${actorName} shared your post.`;

  return "You have a new notification.";
}

function getNotificationMeta(notification: NotificationCard) {
  const type = notification.type || "";

  if (type.includes("friend")) return "Friends";
  if (type.includes("comment")) return "Comments";
  if (type.includes("like")) return "Likes";
  if (type.includes("reel")) return "Parapost Reels";
  if (type.includes("badge")) return "Badges";
  if (type.includes("share")) return "Shares";

  return "Notification";
}

function getNotificationHref(notification: NotificationCard) {
  const type = notification.type || "";

  if (type === "friend_request" || type === "friend_accept") {
    return "/friends/requests";
  }

  if (notification.post_id) {
    return `/dashboard#post-${notification.post_id}`;
  }

  if (notification.actor_id) {
    return `/profile/${notification.actor_id}`;
  }

  return "/dashboard";
}

export default function NotificationsPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [notifications, setNotifications] = useState<NotificationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "friends" | "activity">("all");
  const [statusMessage, setStatusMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => !notification.is_read).length;
  }, [notifications]);

  const friendsCount = useMemo(() => {
    return notifications.filter((notification) => (notification.type || "").includes("friend")).length;
  }, [notifications]);

  const activityCount = useMemo(() => {
    return notifications.filter((notification) => !(notification.type || "").includes("friend")).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "unread") return notifications.filter((notification) => !notification.is_read);
    if (activeFilter === "friends") return notifications.filter((notification) => (notification.type || "").includes("friend"));
    if (activeFilter === "activity") return notifications.filter((notification) => !(notification.type || "").includes("friend"));
    return notifications;
  }, [activeFilter, notifications]);

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(""), 2600);
  }, []);

  const loadNotifications = useCallback(async (userId: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, actor_id, type, post_id, comment_id, friend_request_id, message, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Notifications load error:", error.message);
      setNotifications([]);
      setLoading(false);
      return;
    }

    const rows = (data || []) as NotificationRow[];
    const actorIds = [
      ...new Set(rows.map((notification) => notification.actor_id).filter(Boolean) as string[]),
    ];

    let profilesMap: Record<string, ProfilePreview> = {};

    if (actorIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, is_online")
        .in("id", actorIds);

      if (profilesError) {
        console.error("Notification profile load error:", profilesError.message);
      } else {
        profilesMap = Object.fromEntries(
          ((profilesData || []) as ProfilePreview[]).map((profile) => [profile.id, profile])
        );
      }
    }

    setNotifications(
      rows.map((notification) => ({
        ...notification,
        actor: notification.actor_id ? profilesMap[notification.actor_id] || null : null,
      }))
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !user) {
        setCurrentUserId("");
        setNotifications([]);
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      await loadNotifications(user.id);
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`notifications-page-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        async () => {
          await loadNotifications(currentUserId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadNotifications]);

  const handleMarkAllRead = async () => {
    if (!currentUserId || unreadCount === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", currentUserId)
      .eq("is_read", false);

    if (error) {
      alert(`Could not mark notifications read: ${error.message}`);
      return;
    }

    setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
    showStatus("All notifications marked as read.");
  };

  const handleOpenNotification = async (notification: NotificationCard) => {
    const href = getNotificationHref(notification);

    if (!notification.is_read) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
      );

      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);
    }

    router.push(href);
  };

  const handleDeleteNotification = async (notification: NotificationCard) => {
    const confirmed = window.confirm("Delete this notification?");
    if (!confirmed) return;

    setProcessingId(notification.id);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notification.id);

    if (error) {
      alert(`Could not delete notification: ${error.message}`);
      setProcessingId(null);
      return;
    }

    setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
    setProcessingId(null);
    showStatus("Notification deleted.");
  };

  const filterButtons: Array<{
    key: "all" | "unread" | "friends" | "activity";
    label: string;
    count: number;
  }> = [
    { key: "all", label: "All", count: notifications.length },
    { key: "unread", label: "Unread", count: unreadCount },
    { key: "friends", label: "Friends", count: friendsCount },
    { key: "activity", label: "Activity", count: activityCount },
  ];

  return (
    <main style={pageStyle}>
      <div style={glowOneStyle} />
      <div style={glowTwoStyle} />
      <div style={glowThreeStyle} />

      <div style={pageInnerStyle}>
        <section style={heroStyle}>
          <div style={heroTopStyle}>
            <div>
              <div style={eyebrowStyle}>Parapost Network</div>
              <h1 style={titleStyle}>Notifications</h1>
              <p style={subtitleStyle}>
                Friend requests, comments, likes, shares, Parapost Reels activity, and important updates appear here.
              </p>
            </div>

            <div style={heroActionsStyle}>
              <Link href="/dashboard" style={secondaryButtonStyle}>
                Back to Dashboard
              </Link>

              <span style={countPillStyle}>{notifications.length} total</span>
              <span style={unreadPillStyle}>{unreadCount} unread</span>

              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                style={{
                  ...secondaryButtonStyle,
                  opacity: unreadCount === 0 ? 0.55 : 1,
                  cursor: unreadCount === 0 ? "not-allowed" : "pointer",
                }}
              >
                Mark all read
              </button>
            </div>
          </div>

          <div style={filterRowStyle}>
            {filterButtons.map((filter) => {
              const isActive = activeFilter === filter.key;

              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  style={{
                    ...filterButtonStyle,
                    ...(isActive ? activeFilterButtonStyle : {}),
                  }}
                >
                  {filter.label}
                  <span style={filterCountStyle}>{filter.count}</span>
                </button>
              );
            })}
          </div>
        </section>

        {statusMessage ? (
          <div style={statusMessageStyle}>
            <span style={statusDotStyle} />
            {statusMessage}
          </div>
        ) : null}

        <section style={contentShellStyle}>
          {loading ? (
            <div style={emptyStateStyle}>
              <div style={emptyIconStyle}>N</div>
              <h2 style={emptyTitleStyle}>Loading notifications...</h2>
              <p style={emptyTextStyle}>Getting your latest Parapost Network activity.</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={emptyIconStyle}>N</div>
              <h2 style={emptyTitleStyle}>
                {notifications.length === 0 ? "No notifications yet" : "No notifications in this filter"}
              </h2>
              <p style={emptyTextStyle}>
                {notifications.length === 0
                  ? "When someone sends a friend request, accepts one, comments, likes, shares, or interacts with your posts or Reels, it will show up here."
                  : "Try switching to another notification filter."}
              </p>
            </div>
          ) : (
            <div style={notificationListStyle}>
              {filteredNotifications.map((notification) => {
                const isUnread = !notification.is_read;
                const title = getNotificationTitle(notification);
                const meta = getNotificationMeta(notification);
                const actorName = getDisplayName(notification.actor);
                const isBusy = processingId === notification.id;

                return (
                  <article
                    key={notification.id}
                    style={{
                      ...notificationCardStyle,
                      ...(isUnread ? unreadCardStyle : {}),
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(notification)}
                      style={notificationMainButtonStyle}
                    >
                      <div style={avatarShellStyle}>
                        {notification.actor?.avatar_url ? (
                          <img src={notification.actor.avatar_url} alt="" style={avatarImageStyle} />
                        ) : (
                          <span style={avatarFallbackStyle}>{getInitial(notification.actor)}</span>
                        )}

                        {notification.actor?.is_online ? <span style={onlineDotStyle} /> : null}
                      </div>

                      <div style={notificationTextStyle}>
                        <div style={notificationTitleRowStyle}>
                          <h2 style={notificationTitleStyle}>{title}</h2>
                          {isUnread ? <span style={unreadDotStyle} /> : null}
                        </div>

                        <div style={notificationMetaStyle}>
                          <span>{meta}</span>
                          <span>·</span>
                          <span>{actorName}</span>
                          <span>·</span>
                          <span>{formatRelativeTime(notification.created_at)}</span>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteNotification(notification)}
                      disabled={isBusy}
                      style={{
                        ...deleteButtonStyle,
                        opacity: isBusy ? 0.6 : 1,
                        cursor: isBusy ? "not-allowed" : "pointer",
                      }}
                      aria-label="Delete notification"
                    >
                      {isBusy ? "..." : "Delete"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 12% 0%, var(--parapost-accent-soft), transparent 34%), radial-gradient(circle at 88% 16%, var(--parapost-accent-muted-bg), transparent 32%), linear-gradient(180deg, #05050b 0%, #07090d 48%, #05050b 100%)",
  color: "#ffffff",
};

const glowOneStyle: CSSProperties = {
  position: "fixed",
  right: "-180px",
  top: "-180px",
  width: "460px",
  height: "460px",
  borderRadius: "999px",
  background: "var(--parapost-accent-soft)",
  filter: "blur(78px)",
  pointerEvents: "none",
};

const glowTwoStyle: CSSProperties = {
  position: "fixed",
  left: "-160px",
  bottom: "-200px",
  width: "520px",
  height: "520px",
  borderRadius: "999px",
  background: "var(--parapost-accent-muted-bg)",
  filter: "blur(90px)",
  pointerEvents: "none",
};

const glowThreeStyle: CSSProperties = {
  position: "fixed",
  left: "45%",
  top: "18%",
  width: "320px",
  height: "320px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.035)",
  filter: "blur(70px)",
  pointerEvents: "none",
};

const pageInnerStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: "1120px",
  margin: "0 auto",
  padding: "28px 16px 44px",
};

const heroStyle: CSSProperties = {
  border: "1px solid var(--parapost-accent-border)",
  borderRadius: "32px",
  padding: "22px",
  background:
    "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.055), rgba(15,23,42,0.60))",
  boxShadow: "0 26px 70px rgba(0,0,0,0.38), 0 0 38px var(--parapost-accent-glow)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  marginBottom: "16px",
};

const heroTopStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "18px",
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  color: "var(--parapost-accent-text)",
  fontSize: "11px",
  fontWeight: 950,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(34px, 5vw, 62px)",
  lineHeight: 0.95,
  letterSpacing: "-0.06em",
  fontWeight: 950,
  color: "#ffffff",
};

const subtitleStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "#cbd5e1",
  fontSize: "15px",
  lineHeight: 1.6,
  maxWidth: "680px",
};

const heroActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: "10px",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  border: "1px solid var(--parapost-accent-border)",
  background: "rgba(255,255,255,0.06)",
  color: "#f9fafb",
  padding: "0 15px",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: "13px",
};

const countPillStyle: CSSProperties = {
  minHeight: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  border: "1px solid var(--parapost-accent-border)",
  background: "var(--parapost-accent-muted-bg)",
  color: "var(--parapost-accent-readable-text)",
  padding: "0 15px",
  fontWeight: 950,
  fontSize: "13px",
};

const unreadPillStyle: CSSProperties = {
  ...countPillStyle,
  background: "var(--parapost-accent-active-bg)",
  border: "1px solid var(--parapost-accent-active-border)",
  boxShadow: "0 0 20px var(--parapost-accent-glow)",
};

const filterRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "18px",
};

const filterButtonStyle: CSSProperties = {
  minHeight: "40px",
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.045)",
  color: "#cbd5e1",
  padding: "0 13px",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: 900,
  cursor: "pointer",
};

const activeFilterButtonStyle: CSSProperties = {
  background: "var(--parapost-accent-active-bg)",
  border: "1px solid var(--parapost-accent-active-border)",
  color: "var(--parapost-accent-readable-text)",
  boxShadow: "0 0 18px var(--parapost-accent-glow)",
};

const filterCountStyle: CSSProperties = {
  minWidth: "22px",
  height: "22px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "rgba(0,0,0,0.25)",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 950,
};

const statusMessageStyle: CSSProperties = {
  marginBottom: "16px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "var(--parapost-accent-muted-bg)",
  border: "1px solid var(--parapost-accent-border)",
  color: "#f9fafb",
  borderRadius: "18px",
  padding: "12px 14px",
  fontWeight: 850,
};

const statusDotStyle: CSSProperties = {
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  background: "var(--parapost-accent-2)",
  boxShadow: "0 0 16px var(--parapost-accent-glow)",
  flexShrink: 0,
};

const contentShellStyle: CSSProperties = {
  border: "1px solid var(--parapost-accent-border)",
  borderRadius: "32px",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.045), var(--parapost-accent-muted-bg), rgba(15,23,42,0.52))",
  boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
  padding: "16px",
};

const emptyStateStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "26px",
  padding: "34px 18px",
  textAlign: "center",
  background: "rgba(0,0,0,0.22)",
};

const emptyIconStyle: CSSProperties = {
  width: "60px",
  height: "60px",
  margin: "0 auto 14px",
  borderRadius: "22px",
  display: "grid",
  placeItems: "center",
  background: "var(--parapost-accent-active-bg)",
  border: "1px solid var(--parapost-accent-active-border)",
  color: "var(--parapost-accent-readable-text)",
  boxShadow: "0 0 24px var(--parapost-accent-glow)",
  fontWeight: 950,
};

const emptyTitleStyle: CSSProperties = {
  margin: "0 0 8px",
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const emptyTextStyle: CSSProperties = {
  margin: 0,
  color: "#9ca3af",
  lineHeight: 1.6,
  maxWidth: "680px",
  marginLeft: "auto",
  marginRight: "auto",
};

const notificationListStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const notificationCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "24px",
  padding: "12px",
  background: "rgba(0,0,0,0.24)",
};

const unreadCardStyle: CSSProperties = {
  border: "1px solid var(--parapost-accent-active-border)",
  background:
    "linear-gradient(135deg, var(--parapost-accent-muted-bg), rgba(255,255,255,0.055), rgba(0,0,0,0.26))",
  boxShadow: "0 0 22px var(--parapost-accent-glow)",
};

const notificationMainButtonStyle: CSSProperties = {
  appearance: "none",
  border: 0,
  background: "transparent",
  color: "inherit",
  padding: 0,
  display: "flex",
  alignItems: "center",
  gap: "12px",
  textAlign: "left",
  cursor: "pointer",
  minWidth: 0,
  flex: 1,
};

const avatarShellStyle: CSSProperties = {
  width: "54px",
  height: "54px",
  minWidth: "54px",
  borderRadius: "999px",
  padding: "3px",
  position: "relative",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, var(--parapost-accent-1), var(--parapost-accent-2), var(--parapost-accent-3))",
  boxShadow: "0 0 18px var(--parapost-accent-glow)",
};

const avatarImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "cover",
  objectPosition: "center",
  borderRadius: "999px",
  border: "2px solid #07090d",
};

const avatarFallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "999px",
  border: "2px solid #07090d",
  display: "grid",
  placeItems: "center",
  color: "var(--parapost-accent-button-text)",
  fontWeight: 950,
};

const onlineDotStyle: CSSProperties = {
  position: "absolute",
  right: "2px",
  bottom: "3px",
  width: "12px",
  height: "12px",
  borderRadius: "999px",
  background: "#22c55e",
  border: "2px solid #07090d",
  boxShadow: "0 0 10px rgba(34,197,94,0.8)",
};

const notificationTextStyle: CSSProperties = {
  minWidth: 0,
  flex: 1,
};

const notificationTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const notificationTitleStyle: CSSProperties = {
  margin: 0,
  color: "#f9fafb",
  fontSize: "15px",
  fontWeight: 950,
  lineHeight: 1.35,
};

const unreadDotStyle: CSSProperties = {
  width: "9px",
  height: "9px",
  borderRadius: "999px",
  background: "var(--parapost-accent-2)",
  boxShadow: "0 0 12px var(--parapost-accent-glow)",
  flexShrink: 0,
};

const notificationMetaStyle: CSSProperties = {
  marginTop: "5px",
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: 750,
};

const deleteButtonStyle: CSSProperties = {
  minHeight: "36px",
  borderRadius: "999px",
  border: "1px solid rgba(248,113,113,0.25)",
  background: "rgba(248,113,113,0.10)",
  color: "#fecaca",
  padding: "0 12px",
  fontWeight: 850,
  fontSize: "12px",
};
