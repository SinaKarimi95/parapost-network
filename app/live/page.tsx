"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type LiveStatus = "draft" | "upcoming" | "live" | "ended" | "cancelled";
type LiveVisibility = "private" | "friends" | "public";

type LiveStreamRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  provider: string | null;
  external_url: string | null;
  embed_url: string | null;
  thumbnail_url: string | null;
  status: LiveStatus;
  visibility: LiveVisibility;
  is_hidden: boolean;
  is_featured: boolean;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

function formatLiveDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusLabel(status: LiveStatus) {
  if (status === "draft") return "Draft";
  if (status === "upcoming") return "Upcoming";
  if (status === "live") return "Live";
  if (status === "ended") return "Ended";
  return "Cancelled";
}

function getProviderLabel(provider?: string | null) {
  if (!provider) return "No provider yet";
  if (provider === "youtube") return "YouTube";
  if (provider === "twitch") return "Twitch";
  if (provider === "facebook") return "Facebook";
  if (provider === "streamyard") return "StreamYard destination";
  return "Other";
}

export default function ParapostLiveHiddenPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [liveStreams, setLiveStreams] = useState<LiveStreamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  const draftCount = useMemo(
    () => liveStreams.filter((stream) => stream.status === "draft").length,
    [liveStreams]
  );

  const liveCount = useMemo(
    () => liveStreams.filter((stream) => stream.status === "live").length,
    [liveStreams]
  );

  const endedCount = useMemo(
    () => liveStreams.filter((stream) => stream.status === "ended").length,
    [liveStreams]
  );

  const cancelledCount = useMemo(
    () => liveStreams.filter((stream) => stream.status === "cancelled").length,
    [liveStreams]
  );

  const loadHiddenLivePreview = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setCurrentUserId("");
      setLiveStreams([]);
      setMessage("Sign in to preview your hidden Parapost Live setup.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("live_streams")
      .select(
        "id, user_id, title, description, provider, external_url, embed_url, thumbnail_url, status, visibility, is_hidden, is_featured, scheduled_at, started_at, ended_at, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      setLiveStreams([]);
      setMessage(error.message || "Parapost Live is not ready yet.");
      setLoading(false);
      return;
    }

    setLiveStreams((data || []) as LiveStreamRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadHiddenLivePreview();
  }, [loadHiddenLivePreview]);

  const updateStatus = async (stream: LiveStreamRow, nextStatus: LiveStatus) => {
    if (!currentUserId) return;

    const label = nextStatus === "live" ? "mark this test Live" : nextStatus === "ended" ? "end this Live on Parapost" : "cancel this show";
    const ok = window.confirm(`Are you sure you want to ${label}?`);
    if (!ok) return;

    setBusyId(stream.id);
    setMessage("");

    const updatePayload: Partial<LiveStreamRow> = {
      status: nextStatus,
    };

    if (nextStatus === "live") {
      updatePayload.started_at = new Date().toISOString();
      updatePayload.ended_at = null;
    }

    if (nextStatus === "ended" || nextStatus === "cancelled") {
      updatePayload.ended_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("live_streams")
      .update(updatePayload)
      .eq("id", stream.id)
      .eq("user_id", currentUserId);

    setBusyId("");

    if (error) {
      setMessage(error.message || "Could not update Live record.");
      return;
    }

    if (nextStatus === "ended") {
      setMessage("Live ended on Parapost. Remember: the external stream must also be stopped on StreamYard/YouTube/Twitch.");
    } else if (nextStatus === "cancelled") {
      setMessage("Live show marked as cancelled on Parapost.");
    } else {
      setMessage("Hidden test Live marked as active on Parapost.");
    }

    await loadHiddenLivePreview();
  };

  const deleteStream = async (stream: LiveStreamRow) => {
    if (!currentUserId) return;

    const ok = window.confirm("Delete this hidden Live record from Parapost? This is best for test drafts or mistakes.");
    if (!ok) return;

    setBusyId(stream.id);
    setMessage("");

    const { error } = await supabase
      .from("live_streams")
      .delete()
      .eq("id", stream.id)
      .eq("user_id", currentUserId);

    setBusyId("");

    if (error) {
      setMessage(error.message || "Could not delete Live record.");
      return;
    }

    setMessage("Hidden Live record deleted from Parapost.");
    await loadHiddenLivePreview();
  };

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <section style={heroCardStyle}>
          <div style={topRowStyle}>
            <div style={badgeStyle}>Hidden foundation</div>

            <Link href="/dashboard" style={backLinkStyle}>
              Back to Dashboard
            </Link>
          </div>

          <div style={logoOrbStyle}>LIVE</div>

          <h1 style={titleStyle}>Parapost Live</h1>

          <p style={subtitleStyle}>
            Quiet internal setup for external live embeds. This is not publicly launched yet.
          </p>

          <div style={ruleGridStyle}>
            <div style={ruleCardStyle}>
              <strong style={ruleTitleStyle}>No Parapost RTMP</strong>
              <span style={ruleTextStyle}>
                Parapost will not provide stream keys or ingest live video.
              </span>
            </div>

            <div style={ruleCardStyle}>
              <strong style={ruleTitleStyle}>No video hosting</strong>
              <span style={ruleTextStyle}>
                Live video stays on YouTube, Twitch, StreamYard destinations, or another provider.
              </span>
            </div>

            <div style={ruleCardStyle}>
              <strong style={ruleTitleStyle}>No streaming load</strong>
              <span style={ruleTextStyle}>
                Parapost only stores metadata, thumbnails, and later displays safe external embeds.
              </span>
            </div>
          </div>

          <div style={statusStripStyle}>
            <div>
              <span style={statusNumberStyle}>{liveStreams.length}</span>
              <span style={statusLabelStyle}>Hidden records</span>
            </div>

            <div>
              <span style={statusNumberStyle}>{draftCount}</span>
              <span style={statusLabelStyle}>Drafts</span>
            </div>

            <div>
              <span style={statusNumberStyle}>{liveCount}</span>
              <span style={statusLabelStyle}>Test Live</span>
            </div>

            <div>
              <span style={statusNumberStyle}>{endedCount}</span>
              <span style={statusLabelStyle}>Ended</span>
            </div>

            <div>
              <span style={statusNumberStyle}>{cancelledCount}</span>
              <span style={statusLabelStyle}>Cancelled</span>
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Private preview</div>
              <h2 style={sectionTitleStyle}>Your hidden Live records</h2>
            </div>

            <Link href="/live/create" style={createLinkStyle}>
              Create Live Draft
            </Link>
          </div>

          {loading ? (
            <div style={emptyStateStyle}>Loading hidden Parapost Live setup...</div>
          ) : !currentUserId ? (
            <div style={emptyStateStyle}>{message}</div>
          ) : liveStreams.length === 0 ? (
            <div style={emptyStateStyle}>
              <strong style={{ color: "#fff" }}>No hidden Live records yet.</strong>
              <span>
                Create a private test draft where you can paste a YouTube or Twitch live link. Parapost will auto-fill a thumbnail when possible.
              </span>
            </div>
          ) : (
            <div style={listStyle}>
              {liveStreams.map((stream) => {
                const isBusy = busyId === stream.id;
                const providerLabel = getProviderLabel(stream.provider);

                return (
                  <article key={stream.id} style={liveCardStyle}>
                    <div style={thumbnailWrapStyle}>
                      {stream.thumbnail_url ? (
                        <img src={stream.thumbnail_url} alt="" style={thumbnailImageStyle} />
                      ) : (
                        <div style={fallbackThumbStyle}>
                          <span style={fallbackBadgeStyle}>PARAPOST LIVE</span>
                          <strong style={fallbackTitleStyle}>{stream.title}</strong>
                          <span style={fallbackProviderStyle}>{providerLabel}</span>
                        </div>
                      )}
                    </div>

                    <div style={liveContentStyle}>
                      <div style={liveCardHeaderStyle}>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={liveTitleStyle}>{stream.title}</h3>
                          <p style={liveDescriptionStyle}>
                            {stream.description || "No description yet."}
                          </p>
                        </div>

                        <span style={statusPillStyle}>{getStatusLabel(stream.status)}</span>
                      </div>

                      <div style={metaGridStyle}>
                        <div>
                          <span style={metaLabelStyle}>Provider</span>
                          <strong style={metaValueStyle}>{providerLabel}</strong>
                        </div>

                        <div>
                          <span style={metaLabelStyle}>Visibility</span>
                          <strong style={metaValueStyle}>{stream.visibility}</strong>
                        </div>

                        <div>
                          <span style={metaLabelStyle}>Hidden</span>
                          <strong style={metaValueStyle}>{stream.is_hidden ? "Yes" : "No"}</strong>
                        </div>

                        <div>
                          <span style={metaLabelStyle}>Scheduled</span>
                          <strong style={metaValueStyle}>{formatLiveDate(stream.scheduled_at)}</strong>
                        </div>

                        <div>
                          <span style={metaLabelStyle}>Started</span>
                          <strong style={metaValueStyle}>{formatLiveDate(stream.started_at)}</strong>
                        </div>

                        <div>
                          <span style={metaLabelStyle}>Ended</span>
                          <strong style={metaValueStyle}>{formatLiveDate(stream.ended_at)}</strong>
                        </div>
                      </div>

                      <div style={actionRowStyle}>
                        {stream.status !== "live" && stream.status !== "ended" && stream.status !== "cancelled" ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => updateStatus(stream, "live")}
                            style={primaryActionStyle}
                          >
                            Mark Test Live
                          </button>
                        ) : null}

                        {stream.status === "live" ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => updateStatus(stream, "ended")}
                            style={primaryActionStyle}
                          >
                            End Live
                          </button>
                        ) : null}

                        {stream.status !== "cancelled" && stream.status !== "ended" && stream.status !== "live" ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => updateStatus(stream, "cancelled")}
                            style={secondaryActionStyle}
                          >
                            Cancel Show
                          </button>
                        ) : null}

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => deleteStream(stream)}
                          style={dangerActionStyle}
                        >
                          Delete Draft
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {message ? <div style={noteStyle}>{message}</div> : null}
        </section>

        <section style={footerNoteStyle}>
          <strong>Build rule:</strong> Parapost Live is an external-embed live hub only. Ending a Live on Parapost changes Parapost status, but the creator must still stop the outside stream on StreamYard, YouTube, Twitch, or the provider they are using.
        </section>
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 14% 0%, rgba(168,85,247,0.28), transparent 34%), radial-gradient(circle at 88% 14%, rgba(236,72,153,0.14), transparent 34%), linear-gradient(180deg, #05050b 0%, #07090d 52%, #05050b 100%)",
  color: "#fff",
  padding: "22px 14px 56px",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1080,
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const heroCardStyle: CSSProperties = {
  borderRadius: 32,
  border: "1px solid rgba(216,180,254,0.20)",
  background:
    "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(255,255,255,0.055) 36%, rgba(10,13,24,0.94) 100%)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.34), 0 0 40px rgba(168,85,247,0.15)",
  padding: 24,
  overflow: "hidden",
};

const topRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 28,
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  borderRadius: 999,
  padding: "0 13px",
  color: "#f3e8ff",
  background: "rgba(168,85,247,0.18)",
  border: "1px solid rgba(216,180,254,0.22)",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const backLinkStyle: CSSProperties = {
  minHeight: 36,
  borderRadius: 999,
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  textDecoration: "none",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  fontSize: 13,
  fontWeight: 850,
};

const logoOrbStyle: CSSProperties = {
  width: 84,
  height: 84,
  borderRadius: 28,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #a855f7, #7c3aed 52%, #ec4899)",
  color: "#fff",
  fontSize: 17,
  fontWeight: 1000,
  letterSpacing: "0.06em",
  boxShadow: "0 18px 42px rgba(168,85,247,0.34)",
  marginBottom: 18,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(38px, 8vw, 72px)",
  lineHeight: 0.95,
  letterSpacing: "-0.07em",
  fontWeight: 1000,
};

const subtitleStyle: CSSProperties = {
  margin: "16px 0 0",
  maxWidth: 680,
  color: "#d1d5db",
  fontSize: 16,
  lineHeight: 1.65,
};

const ruleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
  marginTop: 24,
};

const ruleCardStyle: CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.055)",
  padding: 15,
  display: "grid",
  gap: 8,
};

const ruleTitleStyle: CSSProperties = {
  color: "#fff",
  fontSize: 14,
  fontWeight: 950,
};

const ruleTextStyle: CSSProperties = {
  color: "#aeb6c4",
  fontSize: 13,
  lineHeight: 1.5,
};

const statusStripStyle: CSSProperties = {
  marginTop: 24,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.20)",
  padding: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 10,
};

const statusNumberStyle: CSSProperties = {
  display: "block",
  color: "#fff",
  fontSize: 28,
  fontWeight: 1000,
  lineHeight: 1,
};

const statusLabelStyle: CSSProperties = {
  display: "block",
  color: "#9ca3af",
  fontSize: 12,
  marginTop: 6,
  fontWeight: 800,
};

const panelStyle: CSSProperties = {
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(10,13,24,0.82)",
  boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
  padding: 18,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
};

const eyebrowStyle: CSSProperties = {
  color: "#a78bfa",
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 6,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: "#fff",
  fontSize: 23,
  fontWeight: 1000,
  letterSpacing: "-0.04em",
};

const createLinkStyle: CSSProperties = {
  minHeight: 38,
  borderRadius: 999,
  padding: "0 14px",
  border: "1px solid rgba(216,180,254,0.28)",
  background: "linear-gradient(135deg, rgba(168,85,247,0.95), rgba(124,58,237,0.95))",
  color: "#fff",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 900,
  boxShadow: "0 12px 28px rgba(168,85,247,0.24)",
};

const emptyStateStyle: CSSProperties = {
  minHeight: 150,
  borderRadius: 22,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.035)",
  color: "#9ca3af",
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  padding: 22,
  gap: 8,
  lineHeight: 1.5,
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const liveCardStyle: CSSProperties = {
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))",
  padding: 12,
  display: "grid",
  gridTemplateColumns: "minmax(210px, 300px) 1fr",
  gap: 14,
};

const thumbnailWrapStyle: CSSProperties = {
  borderRadius: 18,
  overflow: "hidden",
  minHeight: 168,
  background: "#05070d",
};

const thumbnailImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 168,
  objectFit: "cover",
  display: "block",
};

const fallbackThumbStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  minHeight: 168,
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
  fontSize: 21,
  lineHeight: 1.05,
};

const fallbackProviderStyle: CSSProperties = {
  color: "#d1d5db",
  fontSize: 13,
  fontWeight: 800,
};

const liveContentStyle: CSSProperties = {
  minWidth: 0,
  display: "grid",
  alignContent: "space-between",
  gap: 12,
};

const liveCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const liveTitleStyle: CSSProperties = {
  margin: 0,
  color: "#fff",
  fontSize: 17,
  fontWeight: 950,
};

const liveDescriptionStyle: CSSProperties = {
  margin: "6px 0 0",
  color: "#aeb6c4",
  fontSize: 13,
  lineHeight: 1.5,
};

const statusPillStyle: CSSProperties = {
  flexShrink: 0,
  minHeight: 30,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 11px",
  color: "#f3e8ff",
  background: "rgba(168,85,247,0.18)",
  border: "1px solid rgba(216,180,254,0.18)",
  fontSize: 12,
  fontWeight: 900,
};

const metaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 10,
};

const metaLabelStyle: CSSProperties = {
  display: "block",
  color: "#7d8593",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

const metaValueStyle: CSSProperties = {
  color: "#e5e7eb",
  fontSize: 13,
  lineHeight: 1.35,
  textTransform: "capitalize",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const primaryActionStyle: CSSProperties = {
  minHeight: 34,
  borderRadius: 999,
  padding: "0 12px",
  border: "1px solid rgba(216,180,254,0.28)",
  background: "rgba(168,85,247,0.22)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryActionStyle: CSSProperties = {
  ...primaryActionStyle,
  background: "rgba(255,255,255,0.06)",
};

const dangerActionStyle: CSSProperties = {
  ...primaryActionStyle,
  border: "1px solid rgba(248,113,113,0.28)",
  background: "rgba(127,29,29,0.24)",
};

const noteStyle: CSSProperties = {
  marginTop: 12,
  color: "#fca5a5",
  fontSize: 13,
  lineHeight: 1.5,
};

const footerNoteStyle: CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  color: "#aeb6c4",
  padding: 16,
  fontSize: 13,
  lineHeight: 1.55,
};
