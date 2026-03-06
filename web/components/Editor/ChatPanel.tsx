"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { chatWithZora } from "@/lib/api";
import type { ChatMessage, ChatEdit, OutlineSection } from "@/lib/types";

function parseEdits(text: string): { cleanText: string; edits: ChatEdit[] } {
  const edits: ChatEdit[] = [];
  const editRegex = /<edit>\s*<find>([\s\S]*?)<\/find>\s*<replace>([\s\S]*?)<\/replace>\s*<\/edit>/g;
  let match;
  while ((match = editRegex.exec(text)) !== null) {
    edits.push({
      id: Math.random().toString(36).slice(2, 8),
      find: match[1].trim(),
      replace: match[2].trim(),
      applied: false,
    });
  }
  const cleanText = text.replace(editRegex, "").replace(/\n{3,}/g, "\n\n").trim();
  return { cleanText, edits };
}

function DiffCard({
  edit,
  onApply,
}: {
  edit: ChatEdit;
  onApply: (find: string, replace: string) => void;
}) {
  return (
    <div className="rounded border border-macos-border bg-macos-elevated text-[11px] my-2 overflow-hidden">
      <div className="px-2 py-1 bg-red-900/20 text-red-400 font-mono whitespace-pre-wrap break-words border-b border-macos-border">
        <span className="text-[9px] font-bold uppercase tracking-wider text-red-500 mr-1">-</span>
        {edit.find}
      </div>
      <div className="px-2 py-1 bg-green-900/20 text-green-400 font-mono whitespace-pre-wrap break-words">
        <span className="text-[9px] font-bold uppercase tracking-wider text-green-500 mr-1">+</span>
        {edit.replace}
      </div>
      <div className="px-2 py-1 border-t border-macos-border flex justify-end">
        {edit.applied ? (
          <span className="text-[9px] font-medium text-green-600">Applied</span>
        ) : (
          <button
            onClick={() => onApply(edit.find, edit.replace)}
            className="px-2 py-0.5 rounded text-[9px] font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

const PROMPT_SUGGESTIONS = [
  "Strengthen my thesis statement",
  "Improve the flow between paragraphs",
  "Make my introduction more engaging",
  "Check for repetitive phrasing",
  "Suggest a stronger conclusion",
  "Simplify this paragraph",
];

export default function ChatPanel({
  essayId,
  profileId,
  topic,
  thesis,
  outlineSections,
  essayContent,
  onApplyEdit,
  initialMessage,
  onMessageConsumed,
}: {
  essayId: string | null;
  profileId: string | null;
  topic: string;
  thesis: string;
  outlineSections: OutlineSection[];
  essayContent: string;
  onApplyEdit: (find: string, replace: string) => void;
  initialMessage?: string;
  onMessageConsumed?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [inputHeight, setInputHeight] = useState(56);
  const [attachments, setAttachments] = useState<{ id: string; file: File; preview?: string; text?: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isResizingInput = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Pre-fill input when triggered from bubble menu "Ask Zora"
  useEffect(() => {
    if (initialMessage) {
      setInput(`Regarding this text:\n\n"${initialMessage}"\n\n`);
      onMessageConsumed?.();
    }
  }, [initialMessage, onMessageConsumed]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";

    files.forEach((file) => {
      const id = Math.random().toString(36).slice(2, 8);
      const entry: { id: string; file: File; preview?: string; text?: string } = { id, file };

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, preview: reader.result as string } : a));
        };
        reader.readAsDataURL(file);
      }

      // Read text content for supported formats
      if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, text: reader.result as string } : a));
        };
        reader.readAsText(file);
      }

      setAttachments((prev) => [...prev, entry]);
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if ((!text && attachments.length === 0) || loading) return;

    // Build message with attachment context
    let fullMessage = text;
    const fileContexts = attachments
      .filter((a) => a.text)
      .map((a) => `[File: ${a.file.name}]\n${a.text}`);
    const fileRefs = attachments
      .filter((a) => !a.text)
      .map((a) => `[Attached: ${a.file.name} (${a.file.type || "unknown type"})]`);
    if (fileContexts.length > 0 || fileRefs.length > 0) {
      const attachmentBlock = [...fileContexts, ...fileRefs].join("\n\n");
      fullMessage = fullMessage
        ? `${attachmentBlock}\n\n${fullMessage}`
        : attachmentBlock;
    }
    setAttachments([]);

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2, 8),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const outlineSummary = outlineSections.length > 0
        ? outlineSections.map((s, i) => `${i + 1}. ${s.title}${s.notes ? ` - ${s.notes}` : ""}`).join("\n")
        : undefined;

      // First message sends full context; subsequent messages just send the text + session_id
      const res = await chatWithZora({
        message: fullMessage,
        session_id: sessionId,
        ...(!sessionId && {
          essay_id: essayId || undefined,
          essay_content: essayContent || undefined,
          profile_id: profileId || undefined,
          topic: topic || undefined,
          thesis: thesis || undefined,
          outline_summary: outlineSummary,
        }),
      });

      // Capture session ID from first response
      if (res.session_id) {
        setSessionId(res.session_id);
      }

      const { cleanText, edits } = parseEdits(res.reply);
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2, 8),
        role: "assistant",
        content: cleanText,
        edits: edits.length > 0 ? edits : undefined,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2, 8),
        role: "assistant",
        content: `Error: ${e instanceof Error ? e.message : "Chat failed"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [loading, sessionId, essayId, profileId, topic, thesis, outlineSections, essayContent, attachments]);

  const handleSend = useCallback(() => {
    sendMessage(input.trim());
  }, [input, sendMessage]);

  const handleApplyEdit = useCallback(
    (msgId: string, editId: string, find: string, replace: string) => {
      onApplyEdit(find, replace);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId || !m.edits) return m;
          return {
            ...m,
            edits: m.edits.map((e) =>
              e.id === editId ? { ...e, applied: true } : e
            ),
          };
        })
      );
    },
    [onApplyEdit]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
    setSessionId(undefined);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 bg-macos-surface flex flex-col overflow-hidden">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-[11px] text-macos-text-secondary px-3">
            <p className="font-medium text-macos-text text-xs mb-1">Chat with Zora</p>
            <p className="opacity-70 mb-4">Ask for help editing your essay.</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {PROMPT_SUGGESTIONS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="bg-macos-elevated border border-macos-border rounded-full px-2.5 py-1 text-[10px] text-macos-text-secondary hover:border-macos-accent hover:text-macos-text cursor-pointer transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-[12px] ${
                msg.role === "user"
                  ? "bg-macos-accent text-white"
                  : "bg-macos-elevated text-macos-text border border-macos-border"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.edits?.map((edit) => (
                <DiffCard
                  key={edit.id}
                  edit={edit}
                  onApply={(find, replace) =>
                    handleApplyEdit(msg.id, edit.id, find, replace)
                  }
                />
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-macos-elevated text-macos-text-secondary border border-macos-border rounded-lg px-3 py-2 text-[12px]">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        className="border-t border-macos-border cursor-row-resize hover:bg-macos-accent/20 transition-colors flex items-center justify-center"
        style={{ height: 6 }}
        onMouseDown={(e) => {
          e.preventDefault();
          isResizingInput.current = true;
          const startY = e.clientY;
          const startHeight = inputHeight;
          const onMove = (ev: MouseEvent) => {
            if (!isResizingInput.current) return;
            setInputHeight(Math.min(Math.max(startHeight - (ev.clientY - startY), 40), 400));
          };
          const onUp = () => {
            isResizingInput.current = false;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
          };
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      >
        <div className="w-8 h-0.5 rounded-full bg-macos-border" />
      </div>
      <div className="p-2 space-y-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.docx,.doc,.txt,.md,.csv"
          multiple
          className="sr-only"
          onChange={handleFileSelect}
        />
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 bg-macos-elevated border border-macos-border rounded-md px-2 py-1 text-[10px] text-macos-text group"
              >
                {a.preview ? (
                  <img src={a.preview} alt="" className="w-5 h-5 rounded object-cover" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-macos-text-secondary flex-shrink-0">
                    <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
                    <path d="M9 1v4h4" />
                  </svg>
                )}
                <span className="truncate max-w-[100px]">{a.file.name}</span>
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="text-macos-text-secondary hover:text-macos-error text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="bg-macos-elevated rounded-lg border border-macos-border focus-within:border-macos-accent transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Zora to edit your essay..."
            className="w-full bg-transparent text-xs text-macos-text rounded-lg px-3 py-2 resize-none outline-none overflow-y-auto"
            style={{ height: inputHeight }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-macos-text-secondary hover:text-macos-accent transition-colors"
              title="Attach files"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="7" />
                <line x1="8" y1="5" x2="8" y2="11" />
                <line x1="5" y1="8" x2="11" y2="8" />
              </svg>
            </button>
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="text-[10px] text-macos-text-secondary hover:text-macos-text transition-colors"
              >
                Clear chat
              </button>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={(!input.trim() && attachments.length === 0) || loading}
            className="px-3 py-1 rounded-md text-[11px] font-medium bg-macos-accent hover:bg-macos-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
