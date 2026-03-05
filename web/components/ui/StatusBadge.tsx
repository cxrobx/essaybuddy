"use client";

import type { SaveStatus } from "@/lib/types";

const STATUS_CONFIG: Record<SaveStatus, { label: string; color: string; bg: string }> = {
  idle:   { label: "Ready",   color: "text-macos-text-secondary", bg: "bg-macos-border/30 border-macos-border/40" },
  saving: { label: "Saving...", color: "text-macos-warning", bg: "bg-macos-warning/10 border-macos-warning/20" },
  saved:  { label: "Saved",   color: "text-macos-success", bg: "bg-macos-success/10 border-macos-success/20" },
  error:  { label: "Error",   color: "text-macos-error", bg: "bg-macos-error/10 border-macos-error/20" },
};

const DOT_COLOR: Record<SaveStatus, string> = {
  idle:   "bg-macos-text-secondary",
  saving: "bg-macos-warning animate-pulse",
  saved:  "bg-macos-success",
  error:  "bg-macos-error",
};

export default function StatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const { label, color, bg } = STATUS_CONFIG[status];
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border ${bg}`}>
      <div className={`w-2 h-2 rounded-full ${DOT_COLOR[status]}`} />
      <span className={`text-xs font-medium ${color}`}>{label}</span>
    </div>
  );
}
