"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { createWebSource } from "@/lib/api";
import type { WebSource } from "@/lib/types";

export default function AddWebSourceModal({
  open,
  onClose,
  essayId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  essayId?: string;
  onAdded: (source: WebSource) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const source = await createWebSource({
        url: url.trim(),
        title: title.trim() || undefined,
        essay_id: essayId,
      });
      onAdded(source);
      setUrl("");
      setTitle("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add web source");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Web Source">
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] text-macos-text-secondary mb-1">URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full bg-macos-bg border border-macos-border rounded px-2 py-1.5 text-xs text-macos-text outline-none focus:border-macos-accent"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-[11px] text-macos-text-secondary mb-1">
            Title <span className="text-macos-text-secondary">(optional, auto-fetched from URL)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leave blank to auto-detect"
            className="w-full bg-macos-bg border border-macos-border rounded px-2 py-1.5 text-xs text-macos-text outline-none focus:border-macos-accent"
          />
        </div>

        {error && (
          <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-macos-text-secondary hover:text-macos-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!url.trim() || loading}
            className="px-4 py-1.5 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors disabled:opacity-40"
          >
            {loading ? "Adding..." : "Add Source"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
