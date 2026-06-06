"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = {
  label: string;
  href: string;
  comingSoon?: boolean;
};

type NavGroup = {
  label: string;
  links: NavLink[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Your Account",
    links: [
      { label: "Account & Security", href: "/settings/account" },
      { label: "Profile Settings", href: "/settings/profile" },
      { label: "Profile Visibility", href: "/settings/profile-visibility" },
    ],
  },
  {
    label: "Privacy & Safety",
    links: [
      { label: "Privacy & Safety", href: "/settings/privacy-safety" },
      { label: "Blocked Users", href: "/settings/blocked-users" },
    ],
  },
  {
    label: "Preferences",
    links: [
      { label: "Personalization", href: "/settings/personalization" },
      { label: "Notifications", href: "/settings/notifications" },
      { label: "Content & Feed", href: "/settings/content-feed" },
    ],
  },
  {
    label: "Data & Support",
    links: [
      { label: "Data & Account Files", href: "/settings/data" },
      { label: "Help & Support", href: "/settings/help-support" },
      { label: "Legal & Policies", href: "/settings/legal" },
    ],
  },
  {
    label: "Monetization",
    links: [
      { label: "Payments", href: "/settings/payments", comingSoon: true },
    ],
  },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex flex-col w-60 shrink-0 h-full border-r border-white/[0.06] bg-[#05050b] overflow-y-auto"
      style={{ scrollbarWidth: "none" }}
    >
      {/* Top — back to dashboard + settings label */}
      <div className="px-4 pt-5 pb-3 border-b border-white/[0.06]">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 no-underline transition hover:text-white mb-4"
        >
          ← Dashboard
        </Link>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-purple-300/60">
          Settings
        </p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 pt-4 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-purple-300/50 first:pt-2">
              {group.label}
            </p>

            {group.links.map((link) => {
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold no-underline transition-all"
                  style={
                    isActive
                      ? {
                          background: "var(--parapost-accent-active-bg)",
                          color: "var(--parapost-accent-readable-text)",
                          boxShadow: "inset 0 0 0 1px var(--parapost-accent-active-border)",
                        }
                      : { color: "#94a3b8" }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = "#ffffff";
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }
                  }}
                >
                  <span>{link.label}</span>
                  {link.comingSoon && (
                    <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-200">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom — settings hub link */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 no-underline transition hover:text-white hover:bg-white/[0.04]"
        >
          ⚙ Settings Overview
        </Link>
      </div>
    </aside>
  );
}
