"use client";

import Link from "next/link";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Reel = {
  id: string;
  user_id: string;
  title?: string | null;
  video_url: string | null;
  poster_url?: string | null;
  caption: string | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_private: boolean | null;
};

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getProfileName(profile: ProfileRow | null) {
  return profile?.full_name || profile?.username || "Profile";
}

function getProfileInitial(profile: ProfileRow | null) {
  return getProfileName(profile).charAt(0).toUpperCase();
}

export default function ProfileReelsGridPage() {
  const params = useParams();

  const profileId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] || "" : "";
  }, [params]);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [canViewProfileContent, setCanViewProfileContent] = useState(false);

  const isOwnProfile = Boolean(currentUserId && profileId && currentUserId === profileId);
  const isPrivateProfile = Boolean(profile?.is_private);
  const isPrivateLocked = Boolean(profile && isPrivateProfile && !canViewProfileContent);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      if (!profileId || !isValidUuid(profileId)) {
        if (!isMounted) return;
        setErrorMessage("Profile not found.");
        setProfile(null);
        setReels([]);
        setCanViewProfileContent(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");
      setProfile(null);
      setReels([]);
      setCanViewProfileContent(false);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      const viewerId = user?.id || "";
      setCurrentUserId(viewerId);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, is_private")
        .eq("id", profileId)
        .maybeSingle();

      if (!isMounted) return;

      if (profileError) {
        setErrorMessage(profileError.message || "Unable to load profile.");
        setProfile(null);
        setReels([]);
        setCanViewProfileContent(false);
        setLoading(false);
        return;
      }

      const nextProfile = (profileData as ProfileRow | null) || null;
      setProfile(nextProfile);

      if (!nextProfile) {
        setErrorMessage("Profile not found.");
        setReels([]);
        setCanViewProfileContent(false);
        setLoading(false);
        return;
      }

      const profileIsPrivate = Boolean(nextProfile.is_private);
      const viewerIsOwner = Boolean(viewerId && viewerId === profileId);
      let viewerIsFriend = false;

      if (profileIsPrivate && viewerId && !viewerIsOwner) {
        const { data: friendshipData, error: friendshipError } = await supabase
          .from("friend_requests")
          .select("id")
          .eq("status", "accepted")
          .or(
            `and(sender_id.eq.${viewerId},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${viewerId})`
          )
          .limit(1);

        if (!isMounted) return;

        if (!friendshipError) {
          viewerIsFriend = Boolean(friendshipData && friendshipData.length > 0);
        }
      }

      const canView = !profileIsPrivate || viewerIsOwner || viewerIsFriend;
      setCanViewProfileContent(canView);

      if (!canView) {
        setReels([]);
        setLoading(false);
        return;
      }

      const { data: reelsData, error: reelsError } = await supabase
        .from("reels")
        .select("id, user_id, title, video_url, poster_url, caption, created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (reelsError) {
        setErrorMessage(reelsError.message || "Unable to load reels.");
        setReels([]);
        setLoading(false);
        return;
      }

      setReels((reelsData as Reel[]) || []);
      setLoading(false);
    }

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, [profileId]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07090d",
        color: "#ffffff",
        padding: "22px 14px 56px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "980px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.04) 100%)",
            borderRadius: "28px",
            padding: "18px",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "14px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={avatarStyle}>
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  getProfileInitial(profile)
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.8rem",
                    lineHeight: 1.1,
                  }}
                >
                  {getProfileName(profile)} Reels
                </h1>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#9ca3af",
                    fontSize: "0.95rem",
                  }}
                >
                  {isPrivateLocked
                    ? "This profile keeps Reels private unless you are connected."
                    : "Browse this profile’s reels in grid view. Portrait and landscape videos are supported."}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <Link href={`/profile/${profileId}`} style={secondaryLinkStyle}>
                Back to Profile
              </Link>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={cardStyle}>Loading reels...</div>
        ) : errorMessage ? (
          <div style={{ ...cardStyle, color: "#ffb4b4" }}>{errorMessage}</div>
        ) : isPrivateLocked ? (
          <div style={privateCardStyle}>
            <div style={privateIconStyle}>🔒</div>
            <h2 style={privateTitleStyle}>This user’s profile is private.</h2>
            <p style={privateTextStyle}>
              You can still view this profile’s basic information, but their Reels are hidden unless you are connected.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginTop: "18px" }}>
              <Link href={`/profile/${profileId}`} style={primaryLinkStyle}>
                View Profile
              </Link>
              <Link href="/dashboard" style={secondaryLinkStyle}>
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : reels.length === 0 ? (
          <div style={cardStyle}>No reels shared yet.</div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                marginBottom: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ color: "#d1d5db", fontSize: "0.95rem" }}>
                {reels.length} {reels.length === 1 ? "reel" : "reels"}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                gap: "12px",
              }}
            >
              {reels.map((reel) => (
                <Link
                  key={reel.id}
                  href={`/profile/${profileId}/reels/view?reelId=${reel.id}`}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      aspectRatio: "9 / 16",
                      borderRadius: "22px",
                      overflow: "hidden",
                      background: "#000",
                      border: "1px solid rgba(255,255,255,0.10)",
                      boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
                    }}
                  >
                    {reel.video_url ? (
                      <>
                        <video
                          src={reel.video_url}
                          poster={reel.poster_url || undefined}
                          muted
                          playsInline
                          preload="metadata"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block",
                            background: "#000",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background:
                              "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.00) 45%, rgba(0,0,0,0.60) 100%)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: "10px",
                            right: "10px",
                            bottom: "10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          {reel.title ? (
                            <div
                              style={{
                                color: "#fff",
                                fontSize: "13px",
                                fontWeight: 850,
                                lineHeight: 1.25,
                                textShadow: "0 2px 10px rgba(0,0,0,0.55)",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {reel.title}
                            </div>
                          ) : null}
                          <div
                            style={{
                              display: "inline-flex",
                              width: "fit-content",
                              alignItems: "center",
                              borderRadius: "999px",
                              background: "rgba(0,0,0,0.56)",
                              color: "#fff",
                              padding: "6px 10px",
                              fontSize: "12px",
                              fontWeight: 700,
                              border: "1px solid rgba(255,255,255,0.14)",
                            }}
                          >
                            Open Reel
                          </div>
                          {reel.created_at ? (
                            <div
                              style={{
                                color: "rgba(255,255,255,0.86)",
                                fontSize: "12px",
                              }}
                            >
                              {formatDate(reel.created_at)}
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
                          padding: "16px",
                          textAlign: "center",
                        }}
                      >
                        No video
                      </div>
                    )}
                  </div>

                  {reel.caption ? (
                    <div
                      style={{
                        marginTop: "8px",
                        color: "#d1d5db",
                        fontSize: "13px",
                        lineHeight: 1.4,
                        padding: "0 4px",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {reel.caption}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  borderRadius: "24px",
  padding: "18px",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
};

const avatarStyle: CSSProperties = {
  width: "54px",
  height: "54px",
  flex: "0 0 auto",
  borderRadius: "999px",
  overflow: "hidden",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, rgba(139,92,246,0.95), rgba(15,23,42,0.95))",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "#fff",
  fontSize: "22px",
  fontWeight: 800,
};

const privateCardStyle: CSSProperties = {
  ...cardStyle,
  minHeight: "360px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "34px 18px",
};

const privateIconStyle: CSSProperties = {
  width: "58px",
  height: "58px",
  borderRadius: "999px",
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  fontSize: "24px",
  marginBottom: "16px",
};

const privateTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.55rem",
  lineHeight: 1.15,
};

const privateTextStyle: CSSProperties = {
  margin: "12px auto 0",
  maxWidth: "520px",
  color: "#aeb7c6",
  lineHeight: 1.6,
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  background: "#ffffff",
  color: "#05050b",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: 800,
  minHeight: "42px",
};

const secondaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: 600,
  minHeight: "42px",
};
