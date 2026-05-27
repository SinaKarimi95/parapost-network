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
  const [viewportHeight, setViewportHeight] = useState(900);

  useEffect(() => {
    const setViewport = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };

    setViewport();
    window.addEventListener("resize", setViewport);
    window.addEventListener("orientationchange", setViewport);

    return () => {
      window.removeEventListener("resize", setViewport);
      window.removeEventListener("orientationchange", setViewport);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  const viewportType = getViewportType(viewportWidth);
  const isDesktop = viewportType === "desktop";
  const isMobile = viewportType === "mobile";
  const isShortMobile = isMobile && viewportHeight <= 700;

  const sheetStyle = useMemo<CSSProperties>(() => {
    if (isDesktop) {
      return {
        position: "fixed",
        left: "50%",
        right: "auto",
        bottom: 0,
        width: "min(560px, calc(100vw - 48px))",
        height: "min(72dvh, 720px)",
        maxHeight: "calc(100dvh - 104px)",
        transform: "translateX(-50%)",
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.985) 0%, rgba(7,9,13,0.99) 100%)",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        border: "1px solid rgba(255,255,255,0.12)",
        borderBottom: "none",
        zIndex: 151,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 -24px 70px rgba(0,0,0,0.56), 0 0 44px rgba(168,85,247,0.12)",
      };
    }

    if (viewportType === "tablet") {
      return {
        position: "fixed",
        left: "50%",
        right: "auto",
        bottom: 0,
        width: "min(760px, calc(100vw - 28px))",
        height: "min(74dvh, 760px)",
        maxHeight: "calc(100dvh - 86px)",
        transform: "translateX(-50%)",
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.99) 0%, rgba(7,9,13,0.99) 100%)",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        border: "1px solid rgba(255,255,255,0.12)",
        borderBottom: "none",
        zIndex: 151,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 -24px 60px rgba(0,0,0,0.52), 0 0 34px rgba(168,85,247,0.10)",
      };
    }

    return {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      height: isShortMobile ? "72dvh" : "68dvh",
      maxHeight: "calc(100dvh - 72px)",
      minHeight: "min(54dvh, 520px)",
      background:
        "linear-gradient(180deg, rgba(15,23,42,0.995) 0%, rgba(7,9,13,0.995) 100%)",
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      border: "1px solid rgba(255,255,255,0.12)",
      borderBottom: "none",
      zIndex: 151,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxShadow: "0 -24px 60px rgba(0,0,0,0.56), 0 -1px 28px rgba(168,85,247,0.10)",
    };
  }, [isDesktop, viewportType, isShortMobile]);

  if (!isOpen) return null;

  return (
    <>
      <div style={overlayStyle} onClick={onClose} />

      <aside
        className="parapost-reels-comments-sheet"
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={handleWrapStyle}>
          <div style={handleStyle} />
        </div>

        <div
          style={{
            ...headerStyle,
            padding: isDesktop ? "14px 18px 13px" : isMobile ? "10px 14px 11px" : "12px 18px 13px",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={eyebrowStyle}>Parapost Reels</div>
            <div style={titleRowStyle}>
              <h2
                style={{
                  ...titleStyle,
                  fontSize: isMobile ? 20 : titleStyle.fontSize,
                }}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                style={{
                  ...closeButtonStyle,
                  width: isMobile ? 36 : closeButtonStyle.width,
                  height: isMobile ? 36 : closeButtonStyle.height,
                }}
                aria-label="Close comments"
              >
                ×
              </button>
            </div>

            {subtitle ? (
              <div
                style={{
                  ...subtitleStyle,
                  WebkitLineClamp: isMobile ? 1 : 2,
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            ...contentStyle,
            padding: isMobile ? "10px 12px 12px" : contentStyle.padding,
          }}
        >
          {children}
        </div>

        {footer ? (
          <div
            style={{
              ...footerStyle,
              padding: isMobile
                ? "10px 12px calc(12px + env(safe-area-inset-bottom))"
                : footerStyle.padding,
            }}
          >
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background:
    "radial-gradient(circle at center, rgba(0,0,0,0.36), rgba(0,0,0,0.72))",
  backdropFilter: "blur(5px)",
  zIndex: 150,
};

const handleWrapStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  paddingTop: 8,
  flexShrink: 0,
};

const handleStyle: CSSProperties = {
  width: 44,
  height: 5,
  background: "rgba(255,255,255,0.30)",
  borderRadius: 999,
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
  WebkitTapHighlightColor: "transparent",
};

const contentStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "12px 16px 14px",
  overscrollBehavior: "contain",
  WebkitOverflowScrolling: "touch",
  touchAction: "pan-y",
};

const footerStyle: CSSProperties = {
  padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
  borderTop: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(7,9,13,0.97)",
  backdropFilter: "blur(14px)",
  flexShrink: 0,
};
