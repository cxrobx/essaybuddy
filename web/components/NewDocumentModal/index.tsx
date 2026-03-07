"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { createEssay } from "@/lib/api";
import {
  WRITING_TYPE_CATEGORIES,
  WRITING_TYPES,
  getWritingType,
} from "@/lib/writingTypes";
import type { WritingCategory, WritingTypeId } from "@/lib/writingTypes";
import type { Essay } from "@/lib/types";

export default function NewDocumentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (essay: Essay) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<WritingCategory>("academic");
  const [selectedType, setSelectedType] = useState<WritingTypeId>("essay");
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const essay = await createEssay(title || undefined, selectedType);
      onCreated(essay);
      // Reset state
      setTitle("");
      setSelectedType("essay");
      setActiveCategory("academic");
      onClose();
    } catch {
      setError("Failed to create document");
    } finally {
      setCreating(false);
    }
  };

  const activeTypes = WRITING_TYPE_CATEGORIES.find(
    (c) => c.id === activeCategory
  )?.types ?? [];

  return (
    <Modal open={open} onClose={onClose} title="New Document" wide>
      <div className="space-y-4">
        {/* Category tabs */}
        <div className="flex gap-1 border-b border-macos-border pb-2">
          {WRITING_TYPE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                // Auto-select first type in category
                const firstType = cat.types[0];
                if (firstType) setSelectedType(firstType);
              }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-macos-accent/10 text-macos-accent border border-macos-accent/30"
                  : "text-macos-text-secondary hover:text-macos-text border border-transparent hover:border-macos-border"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Type cards */}
        <div className="grid grid-cols-2 gap-2">
          {activeTypes.map((typeId) => {
            const config = WRITING_TYPES[typeId];
            const isSelected = selectedType === typeId;
            return (
              <button
                key={typeId}
                onClick={() => setSelectedType(typeId)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? "border-macos-accent bg-macos-accent/5"
                    : "border-macos-border hover:border-macos-text-secondary bg-macos-elevated"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded bg-macos-accent/15 text-macos-accent text-xs font-semibold flex items-center justify-center">
                    {config.icon}
                  </span>
                  <span className="text-xs font-medium text-macos-text">
                    {config.label}
                  </span>
                </div>
                <p className="text-[10px] text-macos-text-secondary leading-relaxed">
                  {config.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Title input */}
        <label className="block">
          <span className="text-xs text-macos-text-secondary">Title</span>
          <input
            type="text"
            className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent"
            placeholder={`Untitled ${getWritingType(selectedType).label}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creating) handleCreate();
            }}
          />
        </label>

        {error && (
          <p className="text-xs text-macos-error">{error}</p>
        )}

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-macos-accent text-white hover:bg-macos-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? "Creating..." : "Create"}
        </button>
      </div>
    </Modal>
  );
}
