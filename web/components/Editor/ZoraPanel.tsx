"use client";

import { useState, useEffect, useRef } from "react";
import AIPanel from "./AIPanel";
import AIDetectorPanel from "./AIDetectorPanel";
import ChatPanel from "./ChatPanel";
import type { OutlineSection, EvidenceItem, AIDetectionResult, CustomAction } from "@/lib/types";
import { useResizablePanel } from "@/lib/useResizablePanel";

type ZoraTab = "tools" | "detector" | "chat";

const TABS: { key: ZoraTab; label: string }[] = [
  { key: "tools", label: "Writing Tools" },
  { key: "chat", label: "Chat" },
  { key: "detector", label: "AI Detection" },
];

export default function ZoraPanel({
  onClose,
  essayId,
  profileId,
  citationStyle,
  topic,
  thesis,
  wholeEssayText,
  getSelectedText,
  onTextGenerated,
  evidenceItems,
  outlineSections,
  instructions,
  targetWordCount,
  detectionResult,
  detectionLoading,
  detectionError,
  onRunDetection,
  onFixFlag,
  onApplyChatEdit,
  onFullEssayGenerated,
  initialChatMessage,
  onChatMessageConsumed,
  customActions = [],
  onAddCustomAction,
  onUpdateCustomAction,
  onDeleteCustomAction,
  onCustomActionGenerate,
  contentNoun,
}: {
  onClose: () => void;
  essayId: string | null;
  profileId: string | null;
  citationStyle?: string;
  topic: string;
  thesis: string;
  wholeEssayText: string;
  getSelectedText: () => string;
  onTextGenerated: (text: string) => void;
  evidenceItems: EvidenceItem[];
  outlineSections: OutlineSection[];
  instructions?: string;
  targetWordCount?: number | null;
  detectionResult: AIDetectionResult | null;
  detectionLoading: boolean;
  detectionError: string;
  onRunDetection: () => void;
  onFixFlag: (excerpt: string) => Promise<string>;
  onApplyChatEdit: (find: string, replace: string) => void;
  onFullEssayGenerated?: (text: string) => void;
  initialChatMessage?: string;
  onChatMessageConsumed?: () => void;
  customActions?: CustomAction[];
  onAddCustomAction?: (name: string, instructions: string) => void;
  onUpdateCustomAction?: (id: string, name: string, instructions: string) => void;
  onDeleteCustomAction?: (id: string) => void;
  onCustomActionGenerate?: (text: string, actionId: string) => Promise<string>;
  contentNoun?: string;
}) {
  const [tab, setTab] = useState<ZoraTab>("tools");
  const [detectionElapsed, setDetectionElapsed] = useState(0);
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (detectionLoading) {
      setDetectionElapsed(0);
      detectionTimerRef.current = setInterval(() => setDetectionElapsed((e) => e + 1), 1000);
    } else {
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }
    return () => {
      if (detectionTimerRef.current) clearInterval(detectionTimerRef.current);
    };
  }, [detectionLoading]);

  // Auto-switch to chat tab when a prefill message arrives
  useEffect(() => {
    if (initialChatMessage) {
      setTab("chat");
    }
  }, [initialChatMessage]);
  const { width: panelWidth, handleMouseDown } = useResizablePanel(320, "right");

  return (
    <div className="flex-shrink-0 flex flex-col border-l border-macos-border overflow-hidden relative" data-tour="zora-panel" style={{ width: panelWidth }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-macos-border bg-macos-surface">
        <span className="text-xs font-semibold uppercase tracking-widest text-macos-accent">
          Zora
        </span>
        <button
          onClick={onClose}
          className="text-macos-text-secondary hover:text-macos-text text-sm"
        >
          &times;
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-macos-border bg-macos-surface">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors ${
              tab === t.key
                ? "text-macos-accent border-b-2 border-macos-accent"
                : "text-macos-text-secondary hover:text-macos-text border-b-2 border-transparent"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "tools" && (
        <AIPanel
          essayId={essayId}
          profileId={profileId}
          citationStyle={citationStyle}
          topic={topic}
          thesis={thesis}
          wholeEssayText={wholeEssayText}
          getSelectedText={getSelectedText}
          onTextGenerated={onTextGenerated}
          onFullEssayGenerated={onFullEssayGenerated}
          evidenceItems={evidenceItems}
          outlineSections={outlineSections}
          instructions={instructions}
          targetWordCount={targetWordCount}
          customActions={customActions}
          onAddCustomAction={onAddCustomAction}
          onUpdateCustomAction={onUpdateCustomAction}
          onDeleteCustomAction={onDeleteCustomAction}
          onCustomActionGenerate={onCustomActionGenerate}
          contentNoun={contentNoun}
        />
      )}
      <div className={tab === "detector" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
        <AIDetectorPanel
          result={detectionResult}
          loading={detectionLoading}
          error={detectionError}
          elapsed={detectionElapsed}
          onRunCheck={onRunDetection}
          onFixFlag={onFixFlag}
          hasProfile={!!profileId}
        />
      </div>
      {tab === "chat" && (
        <ChatPanel
          essayId={essayId}
          profileId={profileId}
          topic={topic}
          thesis={thesis}
          outlineSections={outlineSections}
          essayContent={wholeEssayText}
          onApplyEdit={onApplyChatEdit}
          initialMessage={initialChatMessage}
          onMessageConsumed={onChatMessageConsumed}
        />
      )}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-macos-accent/20 transition-colors"
      />
    </div>
  );
}
