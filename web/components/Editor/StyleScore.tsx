"use client";

import type { StyleMetrics } from "@/lib/types";

export default function StyleScore({ metrics }: { metrics: StyleMetrics | null }) {
  if (!metrics) return null;

  return (
    <div className="space-y-2 text-[11px] text-macos-text-secondary">
      <div className="font-semibold text-macos-text text-xs">Style Profile</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span>Words:</span>
        <span className="text-macos-text">{metrics.word_count}</span>
        <span>Sentences:</span>
        <span className="text-macos-text">{metrics.sentence_count}</span>
        <span>Avg sent. length:</span>
        <span className="text-macos-text">{metrics.avg_sentence_length}</span>
        <span>Vocabulary (TTR):</span>
        <span className="text-macos-text">{metrics.type_token_ratio}</span>
        <span>Reading ease:</span>
        <span className="text-macos-text">{metrics.flesch_reading_ease}</span>
        <span>Active voice:</span>
        <span className="text-macos-text">{Math.round(metrics.active_voice_ratio * 100)}%</span>
      </div>
    </div>
  );
}
