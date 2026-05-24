"use client";

import { CSSProperties, ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type BottomNavItem = "home" | "reels" | "parachat" | "profile";

type BottomNavProps = {
  currentUserId?: string;
  onCreatePost?: () => void;
  activeItem?: BottomNavItem;
};

type ViewportState = {
  width: number;
  height: number;
};

export default function BottomNav({
  currentUserId = "",
  onCreatePost,
  activeItem,
}: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [resolvedUserId, setResolvedUserId] = useState(currentUserId);
  const [viewport, setViewport] = useState<ViewportState>({
    width: 390,
    height: 800,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewport = () => {
      setViewport({
        width: window.innerWidth || 390,
        height: window.innerHeight || 800,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (currentUserId) {
      setResolvedUserId(currentUserId);
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setResolvedUserId(data.user?.id || "");
    });

    return () => {
      mounted = false;
    };
  }, [currentUserId]);

  const detectedActiveItem = useMemo<BottomNavItem | undefined>(() => {
    if (activeItem) return activeItem;
    if (pathname?.startsWith("/reels")) return "reels";
    if (pathname?.startsWith("/messages")) return "parachat";
    if (pathname?.startsWith("/profile")) return "profile";
    if (pathname?.startsWith("/dashboard")) return "home";
    return undefined;
  }, [activeItem, pathname]);

  const shouldShow =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/reels") ||
    pathname?.startsWith("/messages") ||
    pathname?.startsWith("/profile") ||
    pathname?.startsWith("/friends") ||
    pathname?.startsWith("/notifications");

  const isTinyPhone = viewport.width <= 340;
  const isSmallPhone = viewport.width <= 390;
  const isShortScreen = viewport.height <= 430;
  const isTabletOrFoldable = viewport.width >= 600 && viewport.width < 1280;

  const navComputedStyle = useMemo<CSSProperties>(() => {
    return {
      ...navStyle,
      ...(isTabletOrFoldable ? tabletNavStyle : null),
      ...(isSmallPhone ? smallPhoneNavStyle : null),
      ...(isTinyPhone ? tinyPhoneNavStyle : null),
      ...(isShortScreen ? shortScreenNavStyle : null),
    };
  }, [isShortScreen, isSmallPhone, isTabletOrFoldable, isTinyPhone]);

  const itemComputedStyle = useMemo<CSSProperties>(() => {
    return {
      ...itemButtonStyle,
      ...(isSmallPhone ? smallPhoneItemStyle : null),
      ...(isTinyPhone ? tinyPhoneItemStyle : null),
      ...(isShortScreen ? shortScreenItemStyle : null),
    };
  }, [isShortScreen, isSmallPhone, isTinyPhone]);

  const activeItemComputedStyle = useMemo<CSSProperties>(() => {
    return {
      ...itemComputedStyle,
      color: "#ffffff",
      background: "rgba(168,85,247,0.18)",
      boxShadow: "inset 0 0 0 1px rgba(168,85,247,0.22)",
    };
  }, [itemComputedStyle]);

  const createButtonComputedStyle = useMemo<CSSProperties>(() => {
    return {
      ...createButtonStyle,
      ...(isSmallPhone ? smallPhoneCreateButtonStyle : null),
      ...(isTinyPhone ? tinyPhoneCreateButtonStyle : null),
      ...(isShortScreen ? shortScreenCreateButtonStyle : null),
    };
  }, [isShortScreen, isSmallPhone, isTinyPhone]);

  const iconComputedStyle = useMemo<CSSProperties>(() => {
    return {
      ...iconStyle,
      ...(isSmallPhone ? smallPhoneIconStyle : null),
      ...(isShortScreen ? shortScreenIconStyle : null),
    };
  }, [isShortScreen, isSmallPhone]);

  const labelComputedStyle = useMemo<CSSProperties>(() => {
    return {
      ...labelStyle,
      ...(isTinyPhone ? tinyPhoneLabelStyle : null),
      ...(isShortScreen ? shortScreenLabelStyle : null),
    };
  }, [isShortScreen, isTinyPhone]);

  const spacerComputedStyle = useMemo<CSSProperties>(() => {
    return {
      ...bottomNavSpacerStyle,
      ...(isSmallPhone ? smallPhoneSpacerStyle : null),
      ...(isTinyPhone ? tinyPhoneSpacerStyle : null),
      ...(isShortScreen ? shortScreenSpacerStyle : null),
    };
  }, [isShortScreen, isSmallPhone, isTinyPhone]);

  if (!shouldShow) return null;

  const profileHref = resolvedUserId ? `/profile/${resolvedUserId}` : "/dashboard";

  const goTo = (href: string) => {
    router.push(href);
  };

  const handleCreatePost = () => {
    if (onCreatePost) {
      onCreatePost();
      return;
    }

    goTo("/dashboard?createPost=1");
  };

  const parachatDisplayLabel = isSmallPhone ? "Chat" : "Parachat";
  const profileDisplayLabel = isSmallPhone ? "Me" : "Profile";

  return (
    <>
      <div className="xl:hidden" aria-hidden="true" style={spacerComputedStyle} />

      <nav className="xl:hidden" aria-label="Primary bottom navigation" style={navComputedStyle}>
        <NavButton
          label="Home"
          displayLabel="Home"
          icon="⌂"
          active={detectedActiveItem === "home"}
          onClick={() => goTo("/dashboard")}
          itemStyle={itemComputedStyle}
          activeItemStyle={activeItemComputedStyle}
          iconStyle={iconComputedStyle}
          labelStyle={labelComputedStyle}
        />

        <NavButton
          label="Reels"
          displayLabel="Reels"
          icon="▣"
          active={detectedActiveItem === "reels"}
          onClick={() => goTo("/reels")}
          itemStyle={itemComputedStyle}
          activeItemStyle={activeItemComputedStyle}
          iconStyle={iconComputedStyle}
          labelStyle={labelComputedStyle}
        />

        <button
          type="button"
          aria-label="Create a post"
          onClick={handleCreatePost}
          style={createButtonComputedStyle}
        >
          +
        </button>

        <NavButton
          label="Parachat"
          displayLabel={parachatDisplayLabel}
          icon="☏"
          active={detectedActiveItem === "parachat"}
          onClick={() => goTo("/messages")}
          itemStyle={itemComputedStyle}
          activeItemStyle={activeItemComputedStyle}
          iconStyle={iconComputedStyle}
          labelStyle={labelComputedStyle}
        />

        <NavButton
          label="Profile"
          displayLabel={profileDisplayLabel}
          customIcon={<span style={profileDotStyle} />}
          active={detectedActiveItem === "profile"}
          onClick={() => goTo(profileHref)}
          itemStyle={itemComputedStyle}
          activeItemStyle={activeItemComputedStyle}
          iconStyle={iconComputedStyle}
          labelStyle={labelComputedStyle}
        />
      </nav>
    </>
  );
}

function NavButton({
  label,
  displayLabel,
  icon,
  customIcon,
  active,
  onClick,
  itemStyle,
  activeItemStyle,
  iconStyle,
  labelStyle,
}: {
  label: string;
  displayLabel: string;
  icon?: string;
  customIcon?: ReactNode;
  active?: boolean;
  onClick: () => void;
  itemStyle: CSSProperties;
  activeItemStyle: CSSProperties;
  iconStyle: CSSProperties;
  labelStyle: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={active ? activeItemStyle : itemStyle}
      aria-label={label}
    >
      {customIcon ? customIcon : <span style={iconStyle}>{icon}</span>}
      <span style={labelStyle}>{displayLabel}</span>
    </button>
  );
}

const navStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  right: "auto",
  bottom: "max(10px, env(safe-area-inset-bottom, 0px))",
  zIndex: 2147483647,
  width: "min(560px, calc(100vw - 24px))",
  minHeight: "76px",
  borderRadius: "28px",
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(10,14,22,0.98), rgba(5,7,12,1))",
  boxShadow: "0 18px 50px rgba(0,0,0,0.65)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto minmax(0, 1fr) minmax(0, 1fr)",
  alignItems: "center",
  gap: "4px",
  padding: "8px",
  pointerEvents: "auto",
  transform: "translateX(-50%)",
  boxSizing: "border-box",
};

const tabletNavStyle: CSSProperties = {
  width: "min(540px, calc(100vw - 32px))",
  bottom: "max(14px, env(safe-area-inset-bottom, 0px))",
};

const smallPhoneNavStyle: CSSProperties = {
  width: "min(520px, calc(100vw - 14px))",
  minHeight: "70px",
  borderRadius: "24px",
  padding: "7px",
  gap: "2px",
};

const tinyPhoneNavStyle: CSSProperties = {
  width: "min(520px, calc(100vw - 10px))",
  minHeight: "62px",
  borderRadius: "22px",
  padding: "5px",
};

const shortScreenNavStyle: CSSProperties = {
  bottom: "6px",
  minHeight: "58px",
  borderRadius: "20px",
  padding: "5px",
};

const itemButtonStyle: CSSProperties = {
  minHeight: "58px",
  width: "100%",
  minWidth: 0,
  border: "none",
  background: "transparent",
  borderRadius: "22px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  color: "#9ca3af",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "-0.01em",
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  userSelect: "none",
  position: "relative",
  zIndex: 2,
  overflow: "hidden",
};

const smallPhoneItemStyle: CSSProperties = {
  minHeight: "52px",
  borderRadius: "19px",
  gap: "3px",
};

const tinyPhoneItemStyle: CSSProperties = {
  minHeight: "48px",
  borderRadius: "17px",
  gap: "2px",
};

const shortScreenItemStyle: CSSProperties = {
  minHeight: "44px",
  borderRadius: "16px",
  gap: 0,
};

const iconStyle: CSSProperties = {
  fontSize: "22px",
  lineHeight: 1,
};

const smallPhoneIconStyle: CSSProperties = {
  fontSize: "20px",
};

const shortScreenIconStyle: CSSProperties = {
  fontSize: "19px",
};

const labelStyle: CSSProperties = {
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "11px",
  lineHeight: 1.1,
};

const tinyPhoneLabelStyle: CSSProperties = {
  fontSize: "10px",
};

const shortScreenLabelStyle: CSSProperties = {
  display: "none",
};

const createButtonStyle: CSSProperties = {
  width: "62px",
  height: "62px",
  borderRadius: "50%",
  border: "3px solid rgba(255,255,255,0.88)",
  background:
    "linear-gradient(135deg, #ffffff 0%, #ffffff 42%, #a855f7 43%, #ec4899 100%)",
  color: "#05070a",
  fontSize: "38px",
  fontWeight: 900,
  lineHeight: 1,
  display: "grid",
  placeItems: "center",
  boxShadow: "0 0 26px rgba(168,85,247,0.50)",
  cursor: "pointer",
  transform: "translateY(-14px)",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  userSelect: "none",
  position: "relative",
  zIndex: 3,
};

const smallPhoneCreateButtonStyle: CSSProperties = {
  width: "56px",
  height: "56px",
  fontSize: "34px",
  transform: "translateY(-12px)",
};

const tinyPhoneCreateButtonStyle: CSSProperties = {
  width: "50px",
  height: "50px",
  fontSize: "30px",
  transform: "translateY(-10px)",
};

const shortScreenCreateButtonStyle: CSSProperties = {
  width: "48px",
  height: "48px",
  fontSize: "28px",
  transform: "translateY(-8px)",
};

const profileDotStyle: CSSProperties = {
  width: "18px",
  height: "18px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #a855f7, #7c3aed)",
  boxShadow: "0 0 18px rgba(168,85,247,0.45)",
};

const bottomNavSpacerStyle: CSSProperties = {
  height: "104px",
  flexShrink: 0,
};

const smallPhoneSpacerStyle: CSSProperties = {
  height: "96px",
};

const tinyPhoneSpacerStyle: CSSProperties = {
  height: "88px",
};

const shortScreenSpacerStyle: CSSProperties = {
  height: "72px",
};
