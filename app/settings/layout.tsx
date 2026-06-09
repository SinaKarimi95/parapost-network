"use client";

import SettingsNav from "@/components/SettingsNav";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh min-h-dvh overflow-hidden bg-[#05050b] text-white">
      {/* Decorative background orbs */}
      <div className="pointer-events-none fixed -right-28 -top-28 h-96 w-96 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-fuchsia-500/8 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-28 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Left sidebar nav — desktop only */}
      <SettingsNav />

      {/* Scrollable content area */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        {children}
      </div>
    </div>
  );
}
