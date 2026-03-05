"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  createEssay, getEssay, listEssays, listSamples, listProfiles, getProfile, updateEssay,
  listTextbooks, getEvidence, assignEvidence as apiAssignEvidence,
  unassignEvidence as apiUnassignEvidence, deleteEvidence as apiDeleteEvidence,
  generateOutline, detectAIPatterns, getAIDetectionHistory,
  rephraseText, humanizeText,
} from "@/lib/api";
import { useAutoSave } from "@/lib/useAutoSave";
import type { Essay, OutlineSection, SaveStatus, StyleMetrics, Textbook, EvidenceItem, AIDetectionResult } from "@/lib/types";
import Link from "next/link";
import OutlinePanel from "./OutlinePanel";
import SectionNav from "./SectionNav";
import Toolbar from "./Toolbar";
import ZoraPanel from "./ZoraPanel";
import { useTheme } from "@/lib/useTheme";
import StatusBadge from "@/components/ui/StatusBadge";
import SampleList from "@/components/Samples/SampleList";
import ProfileCreator from "@/components/Samples/ProfileCreator";
import TextbookUploadModal from "@/components/Textbooks/TextbookUploadModal";
import ExtractionModal from "@/components/Evidence/ExtractionModal";
import SourcesPanel from "./SourcesPanel";
import ResearchPanel from "./ResearchPanel";
import StartersPanel from "./StartersPanel";
import WritingPlanModal from "./WritingPlanModal";

const RichTextEditor = dynamic(() => import("./RichTextEditor"), { ssr: false });

export default function Editor({ essayId }: { essayId?: string | null }) {
  const [essay, setEssay] = useState<Essay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [profileCreatorOpen, setProfileCreatorOpen] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [profileMetrics, setProfileMetrics] = useState<StyleMetrics | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [textbookUploadOpen, setTextbookUploadOpen] = useState(false);
  const [extractionOpen, setExtractionOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [startersOpen, setStartersOpen] = useState(false);
  const [writingPlanOpen, setWritingPlanOpen] = useState(false);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [outlineError, setOutlineError] = useState("");
  const [detectionResult, setDetectionResult] = useState<AIDetectionResult | null>(null);
  const [detectionLoading, setDetectionLoading] = useState(false);
  const [detectionError, setDetectionError] = useState("");

  const { theme, toggleTheme } = useTheme();
  const { status, scheduleSave, saveNow } = useAutoSave(essay?.id ?? null);

  // Load or create essay on mount
  useEffect(() => {
    (async () => {
      try {
        let current: Essay;
        if (essayId) {
          current = await getEssay(essayId);
        } else {
          // Fallback: most recent or create new
          const essays = await listEssays();
          if (essays.length > 0) {
            current = await getEssay(essays[0].id);
          } else {
            current = await createEssay("My Essay");
          }
        }
        setEssay(current);

        // Auto-open Writing Plan for new essays with no topic
        if (!current.topic && !current.content) {
          setWritingPlanOpen(true);
        }

        // Load sample count
        const samples = await listSamples();
        setSampleCount(samples.length);

        // Load textbooks
        try {
          const books = await listTextbooks();
          setTextbooks(books);
        } catch {}

        // Load evidence
        try {
          const store = await getEvidence(current.id);
          setEvidenceItems(store.items);
        } catch {}

        // Load most recent detection result
        try {
          const history = await getAIDetectionHistory(current.id);
          if (history.checks.length > 0) {
            setDetectionResult(history.checks[0]);
          }
        } catch {}

        // Load profile — auto-assign bundled profile if none set
        if (current.profile_id) {
          try {
            const profile = await getProfile(current.profile_id);
            setProfileMetrics(profile.metrics);
            setProfileName(profile.name);
          } catch {}
        } else {
          // Check for available profiles and auto-assign the first one
          try {
            const profiles = await listProfiles();
            if (profiles.length > 0) {
              const profileId = profiles[0].id;
              current.profile_id = profileId;
              setEssay((prev) => prev ? { ...prev, profile_id: profileId } : prev);
              await updateEssay(current.id, { profile_id: profileId });
              setProfileName(profiles[0].name);
              try {
                const profile = await getProfile(profileId);
                setProfileMetrics(profile.metrics);
              } catch {}
            }
          } catch {}
        }
      } catch (e) {
        if (essayId) {
          setError("Essay not found. It may have been deleted.");
        } else {
          setError("Could not reach API. Is it running on :8002?");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [essayId]);

  const handleContentUpdate = useCallback(
    (markdown: string) => {
      if (!essay) return;
      setEssay((prev) => (prev ? { ...prev, content: markdown } : prev));
      scheduleSave({ content: markdown });
      if (editorInstance) {
        const text = editorInstance.state.doc.textContent || "";
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        setWordCount(words);
      }
    },
    [essay, scheduleSave, editorInstance]
  );

  const handleOutlineUpdate = useCallback(
    (sections: OutlineSection[]) => {
      if (!essay) return;
      setEssay((prev) => (prev ? { ...prev, outline: sections } : prev));
      scheduleSave({ outline: sections });
    },
    [essay, scheduleSave]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!essay) return;
      setEssay((prev) => (prev ? { ...prev, title } : prev));
      scheduleSave({ title });
    },
    [essay, scheduleSave]
  );

  const handleWritingPlanFieldChange = useCallback(
    (field: string, value: unknown) => {
      if (!essay) return;
      setEssay((prev) => (prev ? { ...prev, [field]: value } : prev));
      scheduleSave({ [field]: value });
    },
    [essay, scheduleSave]
  );

  const handleSectionClick = useCallback(
    (section: OutlineSection) => {
      // Scroll editor to the heading matching this section title
      if (!editorInstance) return;
      const { doc } = editorInstance.state;
      let targetPos: number | null = null;
      doc.descendants((node: any, pos: number) => {
        if (
          targetPos === null &&
          node.type.name === "heading" &&
          node.textContent === section.title
        ) {
          targetPos = pos;
        }
      });
      if (targetPos !== null) {
        editorInstance.commands.setTextSelection(targetPos);
        editorInstance.commands.scrollIntoView();
      }
    },
    [editorInstance]
  );

  const handleProfileCreated = useCallback(
    async (profileId: string) => {
      if (!essay) return;
      setEssay((prev) => (prev ? { ...prev, profile_id: profileId } : prev));
      await updateEssay(essay.id, { profile_id: profileId });
      try {
        const profile = await getProfile(profileId);
        setProfileMetrics(profile.metrics);
        setProfileName(profile.name);
      } catch {}
    },
    [essay]
  );

  const handleSampleUploaded = useCallback(() => {
    setSampleCount((c) => c + 1);
  }, []);

  const handleOutlineGenerated = useCallback(
    (sections: OutlineSection[]) => {
      handleOutlineUpdate(sections);
    },
    [handleOutlineUpdate]
  );

  const handleGenerateOutline = useCallback(async (additionalText?: string, existingOutline?: OutlineSection[]) => {
    if (!essay?.profile_id) return;
    setGeneratingOutline(true);
    setOutlineError("");
    try {
      let instructions = essay.instructions || "";
      if (existingOutline && existingOutline.length > 0) {
        const outlineSummary = existingOutline
          .map((s, i) => {
            let line = `${i + 1}. ${s.title}`;
            if (s.notes) line += ` — ${s.notes}`;
            return line;
          })
          .join("\n");
        const refineBlock = `EXISTING OUTLINE (refine and improve this):\n${outlineSummary}`;
        instructions = instructions
          ? `${instructions}\n\n${refineBlock}`
          : refineBlock;
      }
      if (additionalText) {
        instructions = instructions
          ? `${instructions}\n\n${additionalText}`
          : additionalText;
      }
      const res = await generateOutline(
        essay.topic || "",
        essay.thesis || undefined,
        essay.profile_id,
        essay.citation_style,
        instructions || undefined,
        essay.target_word_count,
      );
      if (res.outline.length > 0) {
        handleOutlineGenerated(
          res.outline.map((s, i) => ({
            id: Math.random().toString(36).slice(2, 8),
            title: s.title || `Section ${i + 1}`,
            notes: s.notes || "",
            evidence: s.evidence || "",
          }))
        );
      } else {
        setOutlineError("AI returned an empty or unparseable outline. Check that the AI provider is working.");
      }
    } catch (e) {
      setOutlineError(e instanceof Error ? e.message : "Outline generation failed");
    } finally {
      setGeneratingOutline(false);
    }
  }, [essay, handleOutlineGenerated]);

  const handleTextGenerated = useCallback(
    (text: string) => {
      if (!editorInstance) return;
      editorInstance.commands.insertContent(text);
    },
    [editorInstance]
  );

  const handleFullEssayGenerated = useCallback(
    (text: string) => {
      if (!essay || !editorInstance) return;
      setEssay((prev) => (prev ? { ...prev, content: text } : prev));
      scheduleSave({ content: text });
      editorInstance.commands.setContent(text);
    },
    [essay, editorInstance, scheduleSave]
  );

  const handleTextbookUploaded = useCallback(
    (textbook: Textbook) => {
      setTextbooks((prev) => [...prev, textbook]);
    },
    []
  );

  const handleEvidenceExtracted = useCallback(
    (items: EvidenceItem[]) => {
      setEvidenceItems((prev) => [...prev, ...items]);
    },
    []
  );

  const handleAssignEvidence = useCallback(
    async (evidenceId: string, sectionId: string) => {
      if (!essay) return;
      try {
        await apiAssignEvidence(essay.id, evidenceId, sectionId);
        setEvidenceItems((prev) =>
          prev.map((e) => (e.id === evidenceId ? { ...e, section_id: sectionId } : e))
        );
      } catch {}
    },
    [essay]
  );

  const handleUnassignEvidence = useCallback(
    async (evidenceId: string) => {
      if (!essay) return;
      try {
        await apiUnassignEvidence(essay.id, evidenceId);
        setEvidenceItems((prev) =>
          prev.map((e) => (e.id === evidenceId ? { ...e, section_id: null } : e))
        );
      } catch {}
    },
    [essay]
  );

  const handleDeleteEvidence = useCallback(
    async (evidenceId: string) => {
      if (!essay) return;
      try {
        await apiDeleteEvidence(essay.id, evidenceId);
        setEvidenceItems((prev) => prev.filter((e) => e.id !== evidenceId));
      } catch {}
    },
    [essay]
  );

  const getSelectedText = useCallback(() => {
    if (!editorInstance) return "";
    const { from, to } = editorInstance.state.selection;
    return editorInstance.state.doc.textBetween(from, to, " ");
  }, [editorInstance]);

  const handleRunDetection = useCallback(async () => {
    if (!essay?.content?.trim()) {
      setDetectionError("Essay content is empty");
      return;
    }
    setDetectionLoading(true);
    setDetectionError("");
    try {
      const result = await detectAIPatterns({
        essay_id: essay.id,
        text: essay.content,
        scope: "essay",
        profile_id: essay.profile_id || undefined,
      });
      setDetectionResult(result);
    } catch (e) {
      setDetectionError(e instanceof Error ? e.message : "Detection failed");
    } finally {
      setDetectionLoading(false);
    }
  }, [essay]);

  const handleFixFlag = useCallback(
    async (excerpt: string): Promise<string> => {
      if (!essay?.profile_id || !excerpt.trim()) {
        throw new Error("Profile required to fix flags");
      }
      const rephrased = await rephraseText(excerpt, essay.profile_id, essay.citation_style);
      const humanized = await humanizeText(rephrased.text, essay.profile_id);
      // Find and replace the excerpt in the editor
      if (editorInstance) {
        const { doc } = editorInstance.state;
        const fullText = doc.textContent;
        const idx = fullText.indexOf(excerpt);
        if (idx !== -1) {
          // TipTap positions include node offsets; for a single-doc, offset by 1 for the doc node
          const from = idx + 1;
          const to = from + excerpt.length;
          editorInstance.chain().focus().deleteRange({ from, to }).insertContentAt(from, humanized.text).run();
        }
      }
      return humanized.text;
    },
    [essay, editorInstance]
  );

  const handleApplyChatEdit = useCallback(
    (find: string, replace: string) => {
      if (!essay || !editorInstance) return;
      // Replace at the markdown level (matches what the AI sees)
      const newContent = essay.content.replace(find, replace);
      if (newContent !== essay.content) {
        setEssay((prev) => (prev ? { ...prev, content: newContent } : prev));
        scheduleSave({ content: newContent });
        editorInstance.commands.setContent(newContent);
      }
    },
    [essay, editorInstance, scheduleSave]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-macos-bg text-macos-text-secondary text-sm">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-macos-bg gap-4">
        <div className="bg-macos-error/10 border border-macos-error/30 rounded-lg px-6 py-4 text-sm text-macos-error">
          {error}
        </div>
        <Link href="/" className="text-sm text-macos-accent hover:underline">
          Back to Essays
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-macos-bg text-macos-text overflow-hidden">
      {/* Top bar */}
      <header className="grid grid-cols-[auto_1fr_auto] items-center px-4 py-2 bg-macos-surface border-b border-macos-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-macos-text-secondary hover:text-macos-text transition-colors text-sm"
            title="All Essays"
          >
            &larr;
          </Link>
          <span className="font-serif font-semibold text-sm tracking-tight text-macos-text">
            &#9998; Zora
          </span>
          <button
            onClick={() => setSamplesOpen(true)}
            className="px-3 py-1 rounded-full text-xs font-medium border border-macos-border hover:border-macos-accent text-macos-text-secondary hover:text-macos-text transition-colors"
          >
            Voice
          </button>
          <input
            className="bg-transparent text-xs text-macos-text-secondary outline-none border-b border-transparent focus:border-macos-accent px-1"
            value={essay?.title || ""}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => setWritingPlanOpen(true)}
            className="px-3 py-1 rounded-full text-xs font-semibold border border-macos-accent/50 bg-macos-accent/10 text-macos-accent hover:bg-macos-accent/20 transition-colors"
          >
            Writing Plan
          </button>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              sourcesOpen
                ? "border-macos-accent text-macos-accent"
                : "border-macos-border hover:border-macos-accent text-macos-text-secondary hover:text-macos-text"
            }`}
          >
            Sources{evidenceItems.length > 0 ? ` (${evidenceItems.length})` : ""}
          </button>
          <button
            onClick={() => setResearchOpen(!researchOpen)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              researchOpen
                ? "border-macos-accent text-macos-accent"
                : "border-macos-border hover:border-macos-accent text-macos-text-secondary hover:text-macos-text"
            }`}
          >
            Research
          </button>
          <button
            onClick={toggleTheme}
            className="px-3 py-1 rounded-full text-xs font-medium border border-macos-border hover:border-macos-accent text-macos-text-secondary hover:text-macos-text transition-colors"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? "\u263D" : "\u2600"}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Outline panel */}
        <OutlinePanel
          sections={essay?.outline || []}
          onUpdate={handleOutlineUpdate}
          onSectionClick={handleSectionClick}
          sampleCount={sampleCount}
          profileId={essay?.profile_id || null}
          profileName={profileName}
          evidenceItems={evidenceItems}
          onAssignEvidence={handleAssignEvidence}
          onUnassignEvidence={handleUnassignEvidence}
          onGenerateOutline={handleGenerateOutline}
          generating={generatingOutline}
          outlineError={outlineError}
          startersOpen={startersOpen}
          onStartersToggle={() => setStartersOpen(!startersOpen)}
        />

        {/* Starters panel */}
        <StartersPanel
          open={startersOpen}
          onClose={() => setStartersOpen(false)}
          essayId={essay?.id || null}
          profileId={essay?.profile_id || null}
          topic={essay?.topic || ""}
          thesis={essay?.thesis || ""}
          citationStyle={essay?.citation_style}
          instructions={essay?.instructions}
          outlineSections={essay?.outline || []}
          evidenceItems={evidenceItems}
          onInsertText={handleTextGenerated}
        />

        {/* Section nav */}
        <SectionNav editor={editorInstance} scrollContainer={scrollContainer} />

        {/* Editor area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Toolbar
            editor={editorInstance}
            onAIClick={() => setAiOpen(!aiOpen)}
          />
          <div className="flex-1 overflow-hidden bg-macos-bg">
            {essay && (
              <RichTextEditor
                content={essay.content}
                onUpdate={handleContentUpdate}
                onEditorReady={setEditorInstance}
                onScrollContainerReady={setScrollContainer}
              />
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-1 border-t border-macos-border bg-macos-surface text-[11px] text-macos-text-secondary">
            <span>Draft</span>
            <span>
              {wordCount.toLocaleString()} words
              {wordCount > 0 && ` · ~${Math.ceil(wordCount / 250)} ${Math.ceil(wordCount / 250) === 1 ? "page" : "pages"}`}
            </span>
          </div>
        </div>

        {/* Zora Panel (Writing Tools + AI Detection + Chat) */}
        {aiOpen && (
          <ZoraPanel
            onClose={() => setAiOpen(false)}
            essayId={essay?.id || null}
            profileId={essay?.profile_id || null}
            citationStyle={essay?.citation_style}
            topic={essay?.topic || ""}
            thesis={essay?.thesis || ""}
            wholeEssayText={essay?.content || ""}
            getSelectedText={getSelectedText}
            onTextGenerated={handleTextGenerated}
            evidenceItems={evidenceItems}
            outlineSections={essay?.outline || []}
            instructions={essay?.instructions}
            targetWordCount={essay?.target_word_count}
            detectionResult={detectionResult}
            detectionLoading={detectionLoading}
            detectionError={detectionError}
            onRunDetection={handleRunDetection}
            onFixFlag={handleFixFlag}
            onApplyChatEdit={handleApplyChatEdit}
            onFullEssayGenerated={handleFullEssayGenerated}
          />
        )}

        {/* Sources Panel */}
        <SourcesPanel
          open={sourcesOpen}
          onClose={() => setSourcesOpen(false)}
          textbooks={textbooks}
          onTextbooksChange={setTextbooks}
          onUploadTextbook={() => setTextbookUploadOpen(true)}
          onExtract={() => setExtractionOpen(true)}
          evidenceItems={evidenceItems}
          sections={essay?.outline || []}
          onAssign={handleAssignEvidence}
          onUnassign={handleUnassignEvidence}
          onDelete={handleDeleteEvidence}
        />

        {/* Research Panel */}
        <ResearchPanel
          open={researchOpen}
          onClose={() => setResearchOpen(false)}
          essayId={essay?.id || null}
          citationStyle={essay?.citation_style}
          onInsertCitation={handleTextGenerated}
        />
      </div>

      {/* Modals */}
      {essay && (
        <WritingPlanModal
          open={writingPlanOpen}
          onClose={() => setWritingPlanOpen(false)}
          essay={essay}
          onFieldChange={handleWritingPlanFieldChange}
          profileName={profileName}
          textbooks={textbooks}
          sampleCount={sampleCount}
        />
      )}
      <SampleList
        open={samplesOpen}
        onClose={() => setSamplesOpen(false)}
        activeProfileId={essay?.profile_id || null}
        onProfileChange={handleProfileCreated}
        onNewProfile={() => setProfileCreatorOpen(true)}
        onSampleUploaded={handleSampleUploaded}
      />
      <ProfileCreator
        open={profileCreatorOpen}
        onClose={() => setProfileCreatorOpen(false)}
        onCreated={(profile) => handleProfileCreated(profile.id)}
      />
      <TextbookUploadModal
        open={textbookUploadOpen}
        onClose={() => setTextbookUploadOpen(false)}
        onUploaded={handleTextbookUploaded}
      />
      {essay && (
        <ExtractionModal
          open={extractionOpen}
          onClose={() => setExtractionOpen(false)}
          essayId={essay.id}
          textbooks={textbooks}
          topic={essay.topic}
          thesis={essay.thesis}
          profileId={essay.profile_id}
          citationStyle={essay.citation_style}
          onExtracted={handleEvidenceExtracted}
        />
      )}
    </div>
  );
}
