"use client";

import { useState } from "react";
import {
  expandSection,
  rephraseText,
  humanizeText,
  getStyleScore,
  generateFullEssay,
} from "@/lib/api";
import type { OutlineSection, EvidenceItem } from "@/lib/types";

type AIAction = "expand" | "rephrase" | "humanize" | "score";

export default function AIPanel({
  essayId,
  profileId,
  citationStyle,
  topic,
  thesis,
  wholeEssayText,
  getSelectedText,
  onTextGenerated,
  onFullEssayGenerated,
  evidenceItems,
  outlineSections,
  instructions,
  targetWordCount,
}: {
  essayId: string | null;
  profileId: string | null;
  citationStyle?: string;
  topic: string;
  thesis: string;
  wholeEssayText: string;
  getSelectedText: () => string;
  onTextGenerated: (text: string) => void;
  onFullEssayGenerated?: (text: string) => void;
  evidenceItems?: EvidenceItem[];
  outlineSections?: OutlineSection[];
  instructions?: string;
  targetWordCount?: number | null;
}) {
  const [action, setAction] = useState<AIAction>("expand");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionNotes, setSectionNotes] = useState("");
  const [fullEssayLoading, setFullEssayLoading] = useState(false);
  const [fullEssayError, setFullEssayError] = useState("");
  const [fullEssayPartial, setFullEssayPartial] = useState("");

  const noProfile = !profileId;
  const buttonDisabled = loading || noProfile;
  const hasOutline = outlineSections && outlineSections.length > 0;

  const handleGenerateFullEssay = async () => {
    if (!essayId || !profileId || !hasOutline) return;
    if (wholeEssayText.trim()) {
      const confirmed = window.confirm(
        "This will replace your current essay content. Continue?"
      );
      if (!confirmed) return;
    }
    setFullEssayLoading(true);
    setFullEssayError("");
    setFullEssayPartial("");
    try {
      const res = await generateFullEssay(
        essayId, profileId, citationStyle, instructions, targetWordCount
      );
      if (res.partial) {
        setFullEssayPartial(
          `Generated ${res.sections_generated} of ${res.total_sections} sections. ${res.error || ""}`
        );
      }
      onFullEssayGenerated?.(res.text);
    } catch (e) {
      setFullEssayError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setFullEssayLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!profileId) {
      setError("Create a writing profile first");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    // Capture selection at click time, not render time
    const selectedText = getSelectedText();

    try {
      switch (action) {
        case "expand": {
          if (!essayId) {
            setError("Save the essay first");
            break;
          }
          const matchingSection = outlineSections?.find((s) => s.title === sectionTitle);
          const sectionEvidence = matchingSection
            ? evidenceItems?.filter((e) => e.section_id === matchingSection.id)
            : [];
          const res = await expandSection(essayId, sectionTitle, sectionNotes || undefined, profileId!, citationStyle, sectionEvidence, instructions, targetWordCount);
          onTextGenerated(res.text);
          setResult(res.text);
          break;
        }
        case "rephrase": {
          if (!selectedText) {
            setError("Select text in the editor first");
            break;
          }
          const res = await rephraseText(selectedText, profileId!, citationStyle);
          setResult(res.text);
          break;
        }
        case "humanize": {
          if (!selectedText) {
            setError("Select text in the editor first");
            break;
          }
          const hres = await humanizeText(selectedText, profileId!);
          setResult(hres.text);
          break;
        }
        case "score": {
          if (!selectedText) {
            setError("Select text in the editor first");
            break;
          }
          const res = await getStyleScore(selectedText, profileId!);
          setResult(
            res.score != null
              ? `Score: ${res.score}/100\n\n${res.feedback}`
              : res.feedback
          );
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const actions: { key: AIAction; label: string; desc: string }[] = [
    { key: "expand", label: "Expand Section", desc: "Write paragraphs for a section" },
    { key: "rephrase", label: "Rephrase", desc: "Rewrite selected text in your style" },
    { key: "humanize", label: "Humanize", desc: "Strip AI patterns from selected text" },
    { key: "score", label: "Style Score", desc: "Score text against your writing profile" },
  ];

  return (
    <div className="flex-1 bg-macos-surface flex flex-col overflow-hidden">
      {noProfile && (
        <div className="mx-3 mt-3 p-2 rounded bg-macos-warning/10 border border-macos-warning/30 text-xs text-macos-warning">
          Upload writing samples and create a profile first.
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Generate Full Essay */}
        <div className="rounded-lg border border-macos-accent/30 bg-macos-accent/5 p-3 space-y-2">
          <div className="text-xs font-semibold text-macos-accent">Generate Full Essay</div>
          <p className="text-[10px] text-macos-text-secondary leading-relaxed">
            Generate a complete essay from your writing plan, outline, evidence, and research — all in your voice.
          </p>
          <button
            onClick={handleGenerateFullEssay}
            disabled={fullEssayLoading || noProfile || !essayId || !hasOutline}
            className="w-full px-3 py-2 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {fullEssayLoading ? "Generating... (this may take 1-2 min)" : "Generate Full Essay"}
          </button>
          {!hasOutline && !noProfile && essayId && (
            <p className="text-[10px] text-macos-warning">Generate an outline first.</p>
          )}
          {fullEssayError && (
            <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-[10px] text-macos-error">
              {fullEssayError}
            </div>
          )}
          {fullEssayPartial && (
            <div className="p-2 rounded bg-macos-warning/10 border border-macos-warning/30 text-[10px] text-macos-warning">
              {fullEssayPartial}
            </div>
          )}
        </div>

        <div className="border-t border-macos-border" />

        {/* Action selector */}
        <div className="space-y-1">
          {actions.map((a) => (
            <button
              key={a.key}
              onClick={() => {
                setAction(a.key);
                setResult("");
                setError("");
              }}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                action === a.key
                  ? "bg-macos-accent/10 text-macos-accent border-l-[3px] border-macos-accent"
                  : "text-macos-text-secondary hover:bg-macos-elevated border-l-[3px] border-transparent"
              }`}
            >
              <div className="font-medium">{a.label}</div>
              <div className="text-[10px] opacity-70">{a.desc}</div>
            </button>
          ))}
        </div>

        {/* Action-specific inputs */}
        {action === "expand" && (
          <div className="space-y-2">
            <input
              className="w-full bg-macos-elevated text-xs text-macos-text rounded p-2 outline-none border border-transparent focus:border-macos-accent"
              placeholder="Section title..."
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
            />
            <textarea
              className="w-full bg-macos-elevated text-xs text-macos-text rounded p-2 resize-none outline-none border border-transparent focus:border-macos-accent"
              placeholder="Section notes (optional)..."
              rows={3}
              value={sectionNotes}
              onChange={(e) => setSectionNotes(e.target.value)}
            />
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={buttonDisabled}
          className="w-full px-3 py-2 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? "Running..." : "Generate"}
        </button>

        {/* Error */}
        {error && (
          <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded bg-macos-elevated text-xs text-macos-text max-h-64 overflow-y-auto">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-macos-text-secondary border-b border-macos-border">
              Result
            </div>
            <div className="p-2 whitespace-pre-wrap">{result}</div>
          </div>
        )}

      </div>
    </div>
  );
}
