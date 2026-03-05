"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listEssays, createEssay, deleteEssay } from "@/lib/api";
import type { EssayListItem } from "@/lib/types";
import EssayCard from "./EssayCard";

export default function EssayManager() {
  const router = useRouter();
  const [essays, setEssays] = useState<EssayListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await listEssays();
        setEssays(list);
      } catch {
        setError("Could not reach API. Is it running on :8002?");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleNewEssay = useCallback(async () => {
    try {
      const essay = await createEssay("Untitled Essay");
      router.push(`/editor?id=${essay.id}`);
    } catch {
      setError("Failed to create essay");
    }
  }, [router]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteEssay(id);
      setEssays((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError("Failed to delete essay");
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-macos-bg text-macos-text-secondary text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-macos-bg text-macos-text">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <span className="font-serif font-semibold text-lg tracking-tight text-macos-text">
            &#9998; Zora
          </span>
          <button
            onClick={handleNewEssay}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-macos-accent text-white hover:bg-macos-accent/90 transition-colors"
          >
            New Essay
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-macos-error/10 border border-macos-error/30 rounded-lg px-4 py-3 text-sm text-macos-error">
            {error}
          </div>
        )}

        {/* Essay grid */}
        {essays.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {essays.map((essay) => (
              <EssayCard key={essay.id} essay={essay} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-macos-text-secondary text-sm mb-6">
              No essays yet. Start writing your first one.
            </p>
            <button
              onClick={handleNewEssay}
              className="px-6 py-3 rounded-lg text-sm font-medium bg-macos-accent text-white hover:bg-macos-accent/90 transition-colors"
            >
              Create Your First Essay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
