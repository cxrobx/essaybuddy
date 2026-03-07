"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Essay, CitationStyle, Book } from "@/lib/types";
import { CITATION_STYLES } from "@/lib/types";
import type { WritingTypeConfig } from "@/lib/writingTypes";
import { WRITING_TYPES, WRITING_TYPE_CATEGORIES, getWritingType } from "@/lib/writingTypes";

export default function WritingPlanModal({
  open,
  onClose,
  essay,
  onFieldChange,
  profileName,
  books,
  sampleCount,
  writingType,
}: {
  open: boolean;
  onClose: () => void;
  essay: Essay;
  onFieldChange: (field: string, value: unknown) => void;
  profileName: string | null;
  books: Book[];
  sampleCount: number;
  writingType?: WritingTypeConfig;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const currentType = writingType || getWritingType(essay.writing_type);

  return (
    <Modal open={open} onClose={onClose} title={currentType ? `${currentType.label} Details` : "Writing Plan"} wide>
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        {/* Document Type */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Document Type
          </h3>
          <select
            className="w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent cursor-pointer"
            value={essay.writing_type || "essay"}
            onChange={(e) => onFieldChange("writing_type", e.target.value)}
          >
            {WRITING_TYPE_CATEGORIES.map((cat) => (
              <optgroup key={cat.id} label={cat.label}>
                {cat.types.map((typeId) => {
                  const t = WRITING_TYPES[typeId];
                  return (
                    <option key={typeId} value={typeId}>
                      {t.label}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          <p className="text-[11px] text-macos-text-secondary italic">
            Changing type adjusts the editor layout and AI prompts.
          </p>
        </section>

        {/* Essay Details */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            {currentType ? `${currentType.label} Details` : "Essay Details"}
          </h3>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-macos-text-secondary">Topic</span>
              <input
                type="text"
                className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent"
                placeholder="What is this essay about?"
                value={essay.topic || ""}
                onChange={(e) => onFieldChange("topic", e.target.value)}
              />
            </label>
            {(!writingType || writingType.showThesis) && (
              <label className="block">
                <span className="text-xs text-macos-text-secondary">Thesis</span>
                <textarea
                  className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent resize-none"
                  placeholder="Your central argument or claim..."
                  rows={3}
                  value={essay.thesis || ""}
                  onChange={(e) => onFieldChange("thesis", e.target.value)}
                />
              </label>
            )}
            {writingType?.extraFields?.map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs text-macos-text-secondary">{field.label}</span>
                {field.type === "textarea" ? (
                  <textarea
                    className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent resize-none"
                    placeholder={field.placeholder || ""}
                    rows={3}
                    value={essay.extra_fields?.[field.key] || ""}
                    onChange={(e) =>
                      onFieldChange("extra_fields", {
                        ...essay.extra_fields,
                        [field.key]: e.target.value,
                      })
                    }
                  />
                ) : (
                  <input
                    type="text"
                    className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent"
                    placeholder={field.placeholder || ""}
                    value={essay.extra_fields?.[field.key] || ""}
                    onChange={(e) =>
                      onFieldChange("extra_fields", {
                        ...essay.extra_fields,
                        [field.key]: e.target.value,
                      })
                    }
                  />
                )}
              </label>
            ))}
          </div>
        </section>

        {/* Parameters */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Parameters
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {(!writingType || writingType.showCitationStyle) && (
              <label className="block">
                <span className="text-xs text-macos-text-secondary">Citation Style</span>
                <select
                  className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent cursor-pointer"
                  value={essay.citation_style || ""}
                  onChange={(e) =>
                    onFieldChange(
                      "citation_style",
                      (e.target.value || null) as CitationStyle | null
                    )
                  }
                >
                  <option value="">No citation style</option>
                  {CITATION_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-xs text-macos-text-secondary">Target Word Count</span>
              <input
                type="number"
                className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent"
                placeholder="e.g. 2500"
                value={essay.target_word_count ?? ""}
                onChange={(e) =>
                  onFieldChange(
                    "target_word_count",
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
              />
            </label>
          </div>
        </section>

        {/* Sources & References */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Sources & References
          </h3>
          <div className="bg-macos-elevated rounded px-3 py-2 text-xs text-macos-text-secondary">
            {books.length > 0 ? (
              <>
                <span className="text-macos-text font-medium">
                  {books.length} book{books.length !== 1 ? "s" : ""} uploaded
                </span>
                <ul className="mt-1 space-y-0.5 pl-3 list-disc">
                  {books.map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
                </ul>
              </>
            ) : (
              <span>No books uploaded yet.</span>
            )}
            <p className="mt-2 text-[11px] italic">
              Manage books from the editor toolbar.
            </p>
          </div>
        </section>

        {/* Voice Profile */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Voice Profile
          </h3>
          <div className="bg-macos-elevated rounded px-3 py-2 text-xs">
            {profileName ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="text-macos-text font-medium">{profileName}</span>
                <span className="text-macos-text-secondary">
                  ({sampleCount} sample{sampleCount !== 1 ? "s" : ""})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-macos-warning">
                <span className="w-2 h-2 rounded-full bg-macos-warning inline-block" />
                <span>No voice profile active</span>
              </div>
            )}
            <p className="mt-2 text-[11px] italic text-macos-text-secondary">
              Manage voice profiles from the Voice button.
            </p>
          </div>
        </section>

        {/* Instructions for AI */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-macos-text-secondary font-semibold">
            Instructions for AI
          </h3>
          {currentType.presets && currentType.presets.length > 0 && (
            <label className="block">
              <span className="text-xs text-macos-text-secondary">Style Preset</span>
              <select
                className="mt-1 w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent cursor-pointer"
                value={selectedPreset}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedPreset(value);
                  if (value !== "custom") {
                    const preset = currentType.presets?.find((p) => p.label === value);
                    if (preset) {
                      onFieldChange("instructions", preset.instructions);
                    }
                  }
                }}
              >
                <option value="custom">Custom</option>
                {currentType.presets.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <textarea
            className="w-full bg-macos-elevated text-sm text-macos-text rounded px-3 py-2 outline-none border border-macos-border focus:border-macos-accent resize-none"
            placeholder="Custom guidelines for AI — e.g., 'Use formal academic tone, focus on environmental policy, avoid first person...'"
            rows={6}
            value={essay.instructions || ""}
            onChange={(e) => {
              onFieldChange("instructions", e.target.value);
              // If user edits instructions manually, switch preset to custom
              if (currentType.presets) {
                const matchesPreset = currentType.presets.some((p) => p.instructions === e.target.value);
                if (!matchesPreset) {
                  setSelectedPreset("custom");
                }
              }
            }}
          />
          <p className="text-[11px] text-macos-text-secondary italic">
            Included in every AI prompt for this {currentType.contentNoun || "essay"}.
          </p>
        </section>
      </div>
    </Modal>
  );
}
