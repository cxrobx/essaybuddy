"use client";

import { useState } from "react";
import { deleteWebSource } from "@/lib/api";
import type { WebSource } from "@/lib/types";
import WebSourceCard from "./WebSourceCard";

export default function WebSourceList({
  sources,
  onSourcesChange,
  onAdd,
  onCite,
}: {
  sources: WebSource[];
  onSourcesChange: (sources: WebSource[]) => void;
  onAdd: () => void;
  onCite?: (source: WebSource) => void;
}) {
  const [error, setError] = useState("");

  const handleDelete = async (id: string) => {
    try {
      await deleteWebSource(id);
      onSourcesChange(sources.filter((s) => s.id !== id));
    } catch {
      setError("Failed to delete web source");
    }
  };

  return (
    <div className="space-y-2">
      {sources.length === 0 ? (
        <div className="text-xs text-macos-text-secondary py-2">
          No web sources added yet.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {sources.map((s) => (
            <WebSourceCard
              key={s.id}
              source={s}
              onCite={onCite}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <button
        onClick={onAdd}
        className="w-full py-2 rounded text-xs font-medium border border-dashed border-macos-border text-macos-text-secondary hover:border-macos-accent hover:text-macos-accent transition-colors"
      >
        + Add Web Source
      </button>

      {error && (
        <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
          {error}
        </div>
      )}
    </div>
  );
}
