"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listEssays, deleteEssay } from "@/lib/api";
import type { EssayListItem, Essay } from "@/lib/types";
import { getWritingType, WRITING_TYPE_CATEGORIES, getCategoryForType } from "@/lib/writingTypes";
import type { WritingCategory } from "@/lib/writingTypes";
import EssayCard from "./EssayCard";
import NewDocumentModal from "@/components/NewDocumentModal";

export default function EssayManager() {
  const router = useRouter();
  const [essays, setEssays] = useState<EssayListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | WritingCategory>("all");

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

  const handleDocumentCreated = useCallback(
    (essay: Essay) => {
      router.push(`/editor?id=${essay.id}`);
    },
    [router]
  );

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteEssay(id);
      setEssays((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError("Failed to delete essay");
    }
  }, []);

  const filteredEssays =
    filter === "all"
      ? essays
      : essays.filter((e) => getCategoryForType(e.writing_type) === filter);

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
            onClick={() => setNewDocOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-macos-accent text-white hover:bg-macos-accent/90 transition-colors"
          >
            New
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-macos-error/10 border border-macos-error/30 rounded-lg px-4 py-3 text-sm text-macos-error">
            {error}
          </div>
        )}

        {/* Filter tabs */}
        {essays.length > 0 && (
          <div className="flex gap-1 mb-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                filter === "all"
                  ? "bg-macos-accent/10 text-macos-accent"
                  : "text-macos-text-secondary hover:text-macos-text"
              }`}
            >
              All
            </button>
            {WRITING_TYPE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  filter === cat.id
                    ? "bg-macos-accent/10 text-macos-accent"
                    : "text-macos-text-secondary hover:text-macos-text"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Essay grid */}
        {filteredEssays.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEssays.map((essay) => (
              <EssayCard key={essay.id} essay={essay} onDelete={handleDelete} />
            ))}
          </div>
        ) : essays.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-macos-text-secondary text-sm">
              No documents in this category.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-macos-text-secondary text-sm mb-6">
              No documents yet. Start writing your first one.
            </p>
            <button
              onClick={() => setNewDocOpen(true)}
              className="px-6 py-3 rounded-lg text-sm font-medium bg-macos-accent text-white hover:bg-macos-accent/90 transition-colors"
            >
              Create Your First Document
            </button>
          </div>
        )}
      </div>

      <NewDocumentModal
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        onCreated={handleDocumentCreated}
      />
    </div>
  );
}
