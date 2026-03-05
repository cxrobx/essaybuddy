"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EssayListItem } from "@/lib/types";

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function EssayCard({
  essay,
  onDelete,
}: {
  essay: EssayListItem;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className="group relative bg-macos-surface border border-macos-border rounded-lg shadow-macos hover:border-macos-accent cursor-pointer transition-colors p-4 flex flex-col gap-2"
      onClick={() => router.push(`/editor?id=${essay.id}`)}
    >
      <h3 className="text-sm font-semibold text-macos-text line-clamp-2 pr-6">
        {essay.title || "Untitled"}
      </h3>
      <p className="text-xs text-macos-text-secondary line-clamp-1">
        {essay.topic ? essay.topic : <span className="italic">No topic</span>}
      </p>
      <div className="flex items-center justify-between mt-auto pt-2 text-[11px] text-macos-text-secondary">
        <span>{essay.word_count.toLocaleString()} words</span>
        <span>{timeAgo(essay.updated_at)}</span>
      </div>

      {/* Delete button */}
      {!confirming ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-macos-text-secondary hover:text-macos-error text-xs p-1"
          title="Delete essay"
        >
          &times;
        </button>
      ) : (
        <div
          className="absolute top-2 right-2 flex items-center gap-1 bg-macos-surface border border-macos-border rounded-md px-2 py-1 shadow-macos"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[11px] text-macos-text-secondary mr-1">Delete?</span>
          <button
            onClick={() => onDelete(essay.id)}
            className="text-[11px] text-macos-error hover:underline font-medium"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-[11px] text-macos-text-secondary hover:underline"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
