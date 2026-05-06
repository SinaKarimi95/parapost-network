"use client";

import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_online?: boolean | null;
};

const BIO_MAX_LENGTH = 175;
const USERNAME_TAKEN_MESSAGE = "That username already exists. Please choose another one.";

type StatusKind = "success" | "error" | "info";

const pageShellStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#07090d",
  color: "white",
};

const containerStyle: CSSProperties = {
  maxWidth: "980px",
  margin: "0 auto",
  padding: "24px 16px 48px",
};

const cardStyle: CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.04) 100%)",
  borderRadius: "28px",
  padding: "20px",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(10px)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "18px",
  padding: "14px 16px",
  fontSize: "14px",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: "130px",
  resize: "vertical",
  fontFamily: "inherit",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "13px",
  fontWeight: 700,
  color: "#e5e7eb",
  letterSpacing: "0.02em",
};

const helperRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  marginTop: "6px",
  color: "#9ca3af",
  fontSize: "12px",
};

const primaryButtonStyle: CSSProperties = {
  background: "white",
  color: "#07090d",
  border: "none",
  borderRadius: "999px",
  padding: "11px 18px",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "999px",
  padding: "11px 18px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
};

function getInitial(name?: string | null, username?: string | null) {
  const value = name || username || "U";
  return value.charAt(0).toUpperCase();
}

function cleanText(value: string) {
  return value.trim().replace(/<[^>]*>/g, "");
}

function normalizeUsername(value: string) {
  return cleanText(value)
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .slice(0, 30);
}

function isDuplicateUsernameError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : typeof error === "string"
        ? error
        : "";

  const normalized = message.toLowerCase();

  return (
    normalized.includes("profiles_username_key") ||
    (normalized.includes("duplicate key") && normalized.includes("username"))
  );
}

function getStatusBoxStyle(kind: StatusKind): CSSProperties {
  if (kind === "error") {
    return {
      background: "rgba(248,113,113,0.10)",
      border: "1px solid rgba(248,113,113,0.30)",
      color: "#fecaca",
      borderRadius: "20px",
      padding: "12px 14px",
      fontWeight: 700,
    };
  }

  if (kind === "success") {
    return {
      background: "rgba(52,211,153,0.10)",
      border: "1px solid rgba(52,211,153,0.28)",
      color: "#bbf7d0",
      borderRadius: "20px",
      padding: "12px 14px",
      fontWeight: 700,
    };
  }

  return {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#f9fafb",
    borderRadius: "20px",
    padding: "12px 14px",
    fontWeight: 700,
  };
}

export default function EditProfilePage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("info");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLoading(false);
        setStatusKind("error");
        setStatusMessage("You need to be logged in to edit your profile.");
        return;
      }

      setCurrentUserId(user.id);
      setEmail(user.email || "");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, bio, avatar_url, is_online")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setLoading(false);
        setStatusKind("error");
        setStatusMessage(`Could not load profile: ${error.message}`);
        return;
      }

      const profile = data as ProfileRow | null;

      setUsername(profile?.username || "");
      setFullName(profile?.full_name || "");
      setBio((profile?.bio || "").slice(0, BIO_MAX_LENGTH));
      setAvatarUrl(profile?.avatar_url || "");
      setLoading(false);
    };

    loadProfile();
  }, []);

  const handleAvatarUpload = async (file: File | null) => {
    if (!file || !currentUserId) return;

    setUploadingAvatar(true);
    setStatusMessage("");
    setStatusKind("info");

    const extension = file.name.split(".").pop() || "jpg";
    const fileName = `${currentUserId}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setUploadingAvatar(false);
      setStatusKind("error");
      setStatusMessage(`Avatar upload error: ${uploadError.message}`);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const nextAvatarUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: nextAvatarUrl })
      .eq("id", currentUserId);

    if (updateError) {
      setUploadingAvatar(false);
      setStatusKind("error");
      setStatusMessage(`Avatar save error: ${updateError.message}`);
      return;
    }

    setAvatarUrl(nextAvatarUrl);
    setUploadingAvatar(false);
    setStatusKind("success");
    setStatusMessage("Avatar updated.");
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!currentUserId) {
      setStatusKind("error");
      setStatusMessage("You need to be logged in to save changes.");
      return;
    }

    setSaving(true);
    setStatusMessage("");
    setStatusKind("info");

    const cleanedUsername = normalizeUsername(username);
    const cleanedFullName = cleanText(fullName);
    const cleanedBio = cleanText(bio).slice(0, BIO_MAX_LENGTH);

    if (!cleanedUsername) {
      setSaving(false);
      setStatusKind("error");
      setStatusMessage("Please choose a username before saving your profile.");
      return;
    }

    const { data: existingUsernameOwner, error: usernameLookupError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", cleanedUsername)
      .neq("id", currentUserId)
      .maybeSingle();

    if (usernameLookupError) {
      setSaving(false);
      setStatusKind("error");
      setStatusMessage("We couldn’t check that username. Please try again.");
      return;
    }

    if (existingUsernameOwner) {
      setSaving(false);
      setStatusKind("error");
      setStatusMessage(USERNAME_TAKEN_MESSAGE);
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: currentUserId,
      username: cleanedUsername,
      full_name: cleanedFullName || "",
      bio: cleanedBio || "",
    });

    if (error) {
      setSaving(false);
      setStatusKind("error");
      setStatusMessage(
        isDuplicateUsernameError(error)
          ? USERNAME_TAKEN_MESSAGE
          : "We couldn’t save your profile changes. Please try again."
      );
      return;
    }

    setUsername(cleanedUsername);
    setBio(cleanedBio);
    setSaving(false);
    setStatusKind("success");
    setStatusMessage("Profile updated successfully.");
  };

  return (
    <div style={pageShellStyle}>
      <div style={containerStyle}>
        <div style={{ display: "grid", gap: "20px" }}>
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "14px",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <div>
                <p
                  style={{
                    margin: "0 0 8px",
                    color: "#9ca3af",
                    fontSize: "13px",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  Parapost Network
                </p>

                <h1
                  style={{
                    margin: "0 0 8px",
                    fontSize: "30px",
                    lineHeight: 1.1,
                  }}
                >
                  Edit Profile
                </h1>

                <p style={{ margin: 0, color: "#9ca3af", fontSize: "14px" }}>
                  Update your public profile details so your dashboard, profile,
                  and notifications stay consistent.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href="/dashboard"
                  style={{ ...secondaryButtonStyle, textDecoration: "none" }}
                >
                  Back to Dashboard
                </Link>

                <Link
                  href={currentUserId ? `/profile/${currentUserId}` : "/dashboard"}
                  style={{ ...secondaryButtonStyle, textDecoration: "none" }}
                >
                  View Profile
                </Link>
              </div>
            </div>

            {email ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "#d1d5db",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: "999px",
                  padding: "6px 10px",
                }}
              >
                Signed in as {email}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: "20px",
            }}
          >
            <div style={cardStyle}>
              {loading ? (
                <p style={{ margin: 0, color: "#9ca3af" }}>
                  Loading profile...
                </p>
              ) : (
                <form
                  onSubmit={handleSave}
                  style={{ display: "grid", gap: "18px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        width: "88px",
                        height: "88px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "28px",
                        color: "white",
                      }}
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Profile avatar"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span>{getInitial(fullName, username)}</span>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: "10px" }}>
                      <div style={{ color: "#d1d5db", fontWeight: 600 }}>
                        Profile photo
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          style={secondaryButtonStyle}
                          disabled={uploadingAvatar}
                        >
                          {uploadingAvatar ? "Uploading..." : "Upload Avatar"}
                        </button>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(event) =>
                          handleAvatarUpload(event.target.files?.[0] || null)
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="username" style={labelStyle}>
                      Username
                    </label>

                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        if (statusMessage === USERNAME_TAKEN_MESSAGE) {
                          setStatusMessage("");
                        }
                      }}
                      placeholder="Enter your username"
                      style={inputStyle}
                    />

                    <div style={helperRowStyle}>
                      <span>Letters, numbers, underscores, or a clean display name.</span>
                      <span>{normalizeUsername(username).length}/30</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="fullName" style={labelStyle}>
                      Full Name
                    </label>

                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Enter your full name"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label htmlFor="bio" style={labelStyle}>
                      Bio
                    </label>

                    <textarea
                      id="bio"
                      value={bio}
                      onChange={(event) => setBio(event.target.value)}
                      maxLength={BIO_MAX_LENGTH}
                      placeholder="Tell the Parapost community a little about yourself..."
                      style={textareaStyle}
                    />

                    <div style={helperRowStyle}>
                      <span>Keep it short and clear for your public profile.</span>
                      <span>{bio.length}/{BIO_MAX_LENGTH}</span>
                    </div>
                  </div>

                  {statusMessage ? (
                    <div style={getStatusBoxStyle(statusKind)}>
                      {statusMessage}
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        ...primaryButtonStyle,
                        opacity: saving ? 0.7 : 1,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>

                    <Link
                      href={currentUserId ? `/profile/${currentUserId}` : "/dashboard"}
                      style={{ ...secondaryButtonStyle, textDecoration: "none" }}
                    >
                      Cancel
                    </Link>
                  </div>
                </form>
              )}
            </div>

            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, marginBottom: "10px" }}>
                Profile Notes
              </h3>

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  color: "#9ca3af",
                  lineHeight: 1.7,
                }}
              >
                <p style={{ margin: 0 }}>
                  This page updates your basic public profile information directly
                  from the signed-in account.
                </p>

                <p style={{ margin: 0 }}>
                  Bio is limited to {BIO_MAX_LENGTH} characters to keep profile
                  headers clean and consistent across desktop, tablet, and mobile.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
