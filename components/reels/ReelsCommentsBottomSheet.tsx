"use client";

import React, { CSSProperties, useEffect, useMemo, useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

type ViewportType = "mobile" | "tablet" | "desktop";

function getViewportType(width: number): ViewportType {
  if (width <= 767) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

export default function ReelsCommentsBottomSheet({
  isOpen,
  onClose,
  title = "Comments",
  subtitle,
  children,
  footer,
}: Props) {
  const [viewportWidth, setViewportWidth] = useState(1440);

  useEffect(() => {
    const setWidth = () => setViewportWidth(window.innerWidth);
    setWidth();
    window.addEventListener("resize", setWidth);
    return () => window.removeEventListener("resize", setWidth);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  const viewportType = getViewportType(viewportWidth);
  const isDesktop = viewportType === "desktop";

  const sheetStyle = useMemo<CSSProperties>(() => {
    if (isDesktop) {
      return {
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(470px, calc(100vw - 32px))",
        height: "100dvh",
        background:
          "linear-gradient(180deg, rgba(11,16,32,0.98) 0%, rgba(7,9,13,0.98) 100%)",
        borderLeft: "1px solid rgba(255,255,255,0.12)",
        zIndex: 151,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "-24px 0 60px rgba(0,0,0,0.52)",
      };
    }

    return {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      height: viewportType === "tablet" ? "64dvh" : "56dvh",
      maxHeight: viewportType === "tablet" ? "calc(100dvh - 150px)" : "calc(100dvh - 230px)",
      background:
        "linear-gradient(180deg, rgba(15,23,42,0.99) 0%, rgba(7,9,13,0.99) 100%)",
      borderTopLeftRadius: viewportType === "tablet" ? 28 : 24,
      borderTopRightRadius: viewportType === "tablet" ? 28 : 24,
      border: "1px solid rgba(255,255,255,0.12)",
      borderBottom: "none",
      zIndex: 151,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxShadow: "0 -24px 60px rgba(0,0,0,0.52)",
    };
  }, [isDesktop, viewportType]);

  if (!isOpen) return null;

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />

      <aside
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {!isDesktop ? <div style={handleStyle} /> : null}

        <div
          style={{
            ...headerStyle,
            padding: isDesktop ? "20px 20px 16px" : "10px 16px 12px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={eyebrowStyle}>Parapost Reels</div>
            <div style={titleRowStyle}>
              <h2 style={titleStyle}>{title}</h2>
              <button
                type="button"
                onClick={onClose}
                style={closeButtonStyle}
                aria-label="Close comments"
              >
                ×
              </button>
            </div>

            {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
          </div>
        </div>

        <div style={contentStyle}>{children}</div>

        {footer ? <div style={footerStyle}>{footer}</div> : null}
      </aside>
    </>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background:
    "radial-gradient(circle at center, rgba(0,0,0,0.42), rgba(0,0,0,0.72))",
  backdropFilter: "blur(5px)",
  zIndex: 150,
};

const handleStyle: CSSProperties = {
  width: 44,
  height: 5,
  background: "rgba(255,255,255,0.30)",
  borderRadius: 999,
  margin: "8px auto 0",
  flexShrink: 0,
};

const headerStyle: CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  flexShrink: 0,
};

const eyebrowStyle: CSSProperties = {
  color: "#a78bfa",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 7,
};

const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#fff",
  fontSize: 22,
  fontWeight: 950,
  letterSpacing: "-0.03em",
  lineHeight: 1.08,
};

const subtitleStyle: CSSProperties = {
  color: "#9ca3af",
  fontSize: 13,
  lineHeight: 1.45,
  marginTop: 6,
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
};

const closeButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "999px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.07)",
  color: "#ffffff",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  fontSize: 24,
  lineHeight: 1,
  fontWeight: 500,
  flexShrink: 0,
};

const contentStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "12px 16px 14px",
  overscrollBehavior: "contain",
};

const footerStyle: CSSProperties = {
  padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
  borderTop: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(7,9,13,0.96)",
  backdropFilter: "blur(14px)",
  flexShrink: 0,
};
