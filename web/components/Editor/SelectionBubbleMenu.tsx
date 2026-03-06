"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { BubbleMenu } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import type { CustomAction } from "@/lib/types";

interface SelectionBubbleMenuProps {
  editor: Editor;
  profileId: string | null;
  onRephrase: (text: string) => Promise<string>;
  onHumanize: (text: string) => Promise<string>;
  onScore: (text: string) => Promise<{ score: number | null; feedback: string }>;
  onAskZora: (text: string) => void;
  customActions?: CustomAction[];
  onCustomAction?: (text: string, actionId: string) => Promise<string>;
}

type ActionState =
  | { type: "idle" }
  | { type: "loading"; action: string }
  | { type: "preview"; action: string; original: string; result: string; from: number; to: number }
  | { type: "score-result"; score: number | null; feedback: string }
  | { type: "error"; message: string };

export default function SelectionBubbleMenu({
  editor,
  profileId,
  onRephrase,
  onHumanize,
  onScore,
  onAskZora,
  customActions = [],
  onCustomAction,
}: SelectionBubbleMenuProps) {
  const [state, setState] = useState<ActionState>({ type: "idle" });
  const [overflowOpen, setOverflowOpen] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const errorTimer = useRef<ReturnType<typeof setTimeout>>();
  const overflowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const clearError = useCallback(() => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setState({ type: "idle" }), 2000);
  }, []);

  const getSelectedText = useCallback(() => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ");
  }, [editor]);

  const handleRephrase = useCallback(async () => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");
    setState({ type: "loading", action: "rephrase" });
    try {
      const result = await onRephrase(text);
      setState({ type: "preview", action: "rephrase", original: text, result, from, to });
    } catch (e) {
      setState({ type: "error", message: e instanceof Error ? e.message : "Rephrase failed" });
      clearError();
    }
  }, [editor, onRephrase, clearError]);

  const handleHumanize = useCallback(async () => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");
    setState({ type: "loading", action: "humanize" });
    try {
      const result = await onHumanize(text);
      setState({ type: "preview", action: "humanize", original: text, result, from, to });
    } catch (e) {
      setState({ type: "error", message: e instanceof Error ? e.message : "Humanize failed" });
      clearError();
    }
  }, [editor, onHumanize, clearError]);

  const handleCustomAction = useCallback(async (actionId: string) => {
    if (!onCustomAction) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");
    setState({ type: "loading", action: actionId });
    setOverflowOpen(false);
    try {
      const result = await onCustomAction(text, actionId);
      setState({ type: "preview", action: actionId, original: text, result, from, to });
    } catch (e) {
      setState({ type: "error", message: e instanceof Error ? e.message : "Action failed" });
      clearError();
    }
  }, [editor, onCustomAction, clearError]);

  const handleAccept = useCallback(() => {
    if (state.type !== "preview") return;
    const { from, to, result } = state;
    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, result).run();
    // Select the inserted text so the user can see exactly what changed
    const endPos = from + result.length;
    editor.commands.setTextSelection({ from, to: endPos });
    setState({ type: "idle" });
  }, [editor, state]);

  const handleReject = useCallback(() => {
    setState({ type: "idle" });
  }, []);

  const handleRefine = useCallback(async () => {
    if (state.type !== "preview") return;
    const { action, result, from, to } = state;
    setState({ type: "loading", action });
    try {
      let refined: string;
      if (action === "rephrase") {
        refined = await onRephrase(result);
      } else if (action === "humanize") {
        refined = await onHumanize(result);
      } else if (onCustomAction) {
        refined = await onCustomAction(result, action);
      } else {
        return;
      }
      setState({ type: "preview", action, original: result, result: refined, from, to });
    } catch (e) {
      setState({ type: "error", message: e instanceof Error ? e.message : "Refine failed" });
      clearError();
    }
  }, [state, onRephrase, onHumanize, onCustomAction, clearError]);

  const handleScore = useCallback(async () => {
    const text = getSelectedText();
    setState({ type: "loading", action: "score" });
    try {
      const result = await onScore(text);
      setState({ type: "score-result", score: result.score, feedback: result.feedback });
    } catch (e) {
      setState({ type: "error", message: e instanceof Error ? e.message : "Score failed" });
      clearError();
    }
  }, [getSelectedText, onScore, clearError]);

  const handleAskZora = useCallback(() => {
    const text = getSelectedText();
    onAskZora(text);
  }, [getSelectedText, onAskZora]);

  // Reset score/error state when the selection changes (but preserve preview/loading)
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (state.type === "score-result" || state.type === "error") {
        setState({ type: "idle" });
      }
    };
    editor.on("selectionUpdate", handler);
    return () => { editor.off("selectionUpdate", handler); };
  }, [editor, state.type]);

  // Close overflow on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [overflowOpen]);

  // Find the tippy popper element (positioned ancestor)
  const getTippyBox = useCallback(() => {
    return contentRef.current?.closest("[data-tippy-root]") as HTMLElement | null;
  }, []);

  // Reset drag offset when state returns to idle
  useEffect(() => {
    if (state.type === "idle") {
      dragOffsetRef.current = { x: 0, y: 0 };
      const box = getTippyBox();
      if (box) box.style.transform = "";
    }
  }, [state.type, getTippyBox]);

  // Drag-to-move handlers — moves the tippy root element directly
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const box = getTippyBox();
    if (!box) return;
    const { x: ox, y: oy } = dragOffsetRef.current;
    dragStartRef.current = { mx: e.clientX, my: e.clientY, ox, oy };

    const onMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mx;
      const dy = ev.clientY - dragStartRef.current.my;
      const nx = dragStartRef.current.ox + dx;
      const ny = dragStartRef.current.oy + dy;
      dragOffsetRef.current = { x: nx, y: ny };
      box.style.transform = `translate(${nx}px, ${ny}px)`;
    };
    const onUp = () => {
      dragStartRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [getTippyBox]);

  const isLoading = state.type === "loading";
  const isPreview = state.type === "preview";
  const noProfile = !profileId;

  // Split custom actions: first 2 inline, rest in overflow
  const inlineCustom = customActions.slice(0, 2);
  const overflowCustom = customActions.slice(2);

  const getPreviewLabel = () => {
    if (state.type !== "preview") return "";
    if (state.action === "rephrase") return "Rephrased";
    if (state.action === "humanize") return "Humanized";
    const found = customActions.find((a) => a.id === state.action);
    return found?.name || "Rewritten";
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        theme: "zora-bubble",
        interactive: true,
        placement: "bottom",
        maxWidth: 520,
        appendTo: () => document.body,
        popperOptions: {
          modifiers: [
            { name: "flip", options: { fallbackPlacements: ["top", "bottom"] } },
            { name: "preventOverflow", options: { boundary: "viewport", padding: 8 } },
          ],
        },
      }}
      shouldShow={({ editor: ed, state: edState }) => {
        // Keep menu visible during preview and loading states
        if (isPreview || isLoading) return true;
        const { from, to } = edState.selection;
        if (to - from < 10) return false;
        if (ed.isActive("codeBlock")) return false;
        return true;
      }}
    >
      <div ref={contentRef} className="flex flex-col">
        {/* Drag handle — visible during preview and score results */}
        {(isPreview || state.type === "score-result") && (
          <div
            onMouseDown={onDragStart}
            className="flex justify-center py-0.5 cursor-grab active:cursor-grabbing"
            title="Drag to move"
          >
            <div className="w-8 h-1 rounded-full bg-[rgb(var(--macos-text-secondary)/0.3)]" />
          </div>
        )}
        {/* Preview mode */}
        {isPreview ? (
          <div className="bubble-score-result">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--macos-text-secondary))] px-1 pt-0.5 pb-1">
              {getPreviewLabel()}
            </div>
            <div className="max-h-32 overflow-y-auto px-1 mb-1.5 rounded bg-[rgb(var(--macos-elevated))] border border-[rgb(var(--macos-border))]">
              <p className="text-[11px] leading-relaxed text-[rgb(var(--macos-text))] p-1.5 whitespace-pre-wrap break-words">
                {state.result}
              </p>
            </div>
            <div className="flex items-center gap-1 px-0.5 pb-0.5">
              <button
                onClick={handleAccept}
                className="flex-1 px-2 py-1 rounded-md text-[11px] font-medium bg-[rgb(var(--macos-accent))] hover:bg-[rgb(var(--macos-accent-hover))] text-white transition-colors"
              >
                Accept
              </button>
              <button
                onClick={handleRefine}
                className="flex-1 px-2 py-1 rounded-md text-[11px] font-medium text-[rgb(var(--macos-text))] bg-[rgb(var(--macos-elevated))] hover:bg-[rgb(var(--macos-border))] border border-[rgb(var(--macos-border))] transition-colors"
              >
                Refine
              </button>
              <button
                onClick={handleReject}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-[rgb(var(--macos-text-secondary))] hover:text-[rgb(var(--macos-text))] hover:bg-[rgb(var(--macos-elevated))] transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Action buttons */}
            <div className="flex items-center gap-0.5">
              <BubbleButton
                label="Rephrase"
                loading={isLoading && state.type === "loading" && state.action === "rephrase"}
                disabled={isLoading || noProfile}
                title={noProfile ? "Set up a voice profile first" : "Rephrase in your voice"}
                onClick={handleRephrase}
              />
              <BubbleButton
                label="Humanize"
                loading={isLoading && state.type === "loading" && state.action === "humanize"}
                disabled={isLoading || noProfile}
                title={noProfile ? "Set up a voice profile first" : "Make it sound more natural"}
                onClick={handleHumanize}
              />
              <BubbleButton
                label="Score"
                loading={isLoading && state.type === "loading" && state.action === "score"}
                disabled={isLoading || noProfile}
                title={noProfile ? "Set up a voice profile first" : "Score against your style profile"}
                onClick={handleScore}
              />

              {/* Inline custom actions (first 2) */}
              {inlineCustom.map((ca) => (
                <BubbleButton
                  key={ca.id}
                  label={ca.name.length > 12 ? ca.name.slice(0, 12) + "\u2026" : ca.name}
                  loading={isLoading && state.type === "loading" && state.action === ca.id}
                  disabled={isLoading || noProfile}
                  title={noProfile ? "Set up a voice profile first" : ca.name}
                  onClick={() => handleCustomAction(ca.id)}
                />
              ))}

              {/* Overflow dropdown for 3+ custom actions */}
              {overflowCustom.length > 0 && (
                <div className="relative" ref={overflowRef}>
                  <button
                    onClick={() => setOverflowOpen(!overflowOpen)}
                    disabled={isLoading || noProfile}
                    className="px-1.5 py-1.5 rounded-md text-[11px] font-medium text-[rgb(var(--macos-text))] hover:bg-[rgb(var(--macos-elevated))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="More actions"
                  >
                    &middot;&middot;&middot;
                  </button>
                  {overflowOpen && (
                    <div className="absolute top-full left-0 mt-1 py-1 rounded-md bg-[rgb(var(--macos-surface))] border border-[rgb(var(--macos-border))] shadow-lg z-50 min-w-[120px]">
                      {overflowCustom.map((ca) => (
                        <button
                          key={ca.id}
                          onClick={() => handleCustomAction(ca.id)}
                          className="w-full text-left px-3 py-1.5 text-[11px] text-[rgb(var(--macos-text))] hover:bg-[rgb(var(--macos-elevated))] transition-colors"
                        >
                          {ca.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="w-px h-4 bg-[rgb(var(--macos-border))] mx-0.5" />
              <button
                onClick={handleAskZora}
                disabled={isLoading}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-[rgb(var(--macos-accent))] hover:bg-[rgb(var(--macos-accent)/0.1)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                title="Ask Zora about this text"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
                  <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h7A1.5 1.5 0 0 1 13 2.5v9a1.5 1.5 0 0 1-1.5 1.5H8l-3.2 2.4a.5.5 0 0 1-.8-.4V13h-.5A1.5 1.5 0 0 1 2 11.5v-9h1Zm1.5-.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H5v2l2.4-1.8a.5.5 0 0 1 .3-.1h3.8a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-7Z"/>
                </svg>
                Ask Zora
              </button>
            </div>

            {/* Score result */}
            {state.type === "score-result" && (
              <div
                className="bubble-score-result border-t border-[rgb(var(--macos-border))] mt-1 pt-1.5 px-1 pb-1"
              >
                <div className="flex gap-2">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold text-white flex-shrink-0"
                    style={{
                      background:
                        state.score === null
                          ? "rgb(var(--macos-text-secondary))"
                          : state.score >= 80
                            ? "rgb(var(--macos-success))"
                            : state.score >= 50
                              ? "rgb(var(--macos-warning))"
                              : "rgb(var(--macos-error))",
                    }}
                  >
                    {state.score ?? "?"}
                  </span>
                  <div className="flex-1 max-h-[30vh] overflow-y-auto">
                    <span className="text-[11px] text-[rgb(var(--macos-text-secondary))] leading-relaxed">
                      {state.feedback || "No feedback available"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {state.type === "error" && (
              <div className="border-t border-[rgb(var(--macos-border))] mt-1 pt-1 px-1 pb-0.5">
                <span className="text-[10px] text-[rgb(var(--macos-error))]">{state.message}</span>
              </div>
            )}
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

function BubbleButton({
  label,
  loading,
  disabled,
  title,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-2 py-1.5 rounded-md text-[11px] font-medium text-[rgb(var(--macos-text))] hover:bg-[rgb(var(--macos-elevated))] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
    >
      {loading ? (
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        label
      )}
    </button>
  );
}
