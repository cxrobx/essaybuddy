"use client";

import { useState } from "react";
import type { Book, WebSource, EvidenceItem, OutlineSection } from "@/lib/types";
import { deleteBook, updateBook } from "@/lib/api";
import EvidenceCard from "@/components/Evidence/EvidenceCard";
import WebSourceList from "@/components/WebSources/WebSourceList";
import { useResizablePanel } from "@/lib/useResizablePanel";

type Tab = "books" | "web-sources" | "evidence";
type FilterTab = "all" | "unassigned" | "assigned";

export default function SourcesPanel({
  open,
  onClose,
  books,
  onBooksChange,
  onUploadBook,
  onExtract,
  webSources,
  onWebSourcesChange,
  onAddWebSource,
  evidenceItems,
  sections,
  onAssign,
  onUnassign,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  books: Book[];
  onBooksChange: (books: Book[]) => void;
  onUploadBook: () => void;
  onExtract: () => void;
  webSources: WebSource[];
  onWebSourcesChange: (sources: WebSource[]) => void;
  onAddWebSource: () => void;
  evidenceItems: EvidenceItem[];
  sections: OutlineSection[];
  onAssign: (evidenceId: string, sectionId: string) => void;
  onUnassign: (evidenceId: string) => void;
  onDelete: (evidenceId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("books");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [error, setError] = useState("");
  const { width: panelWidth, handleMouseDown } = useResizablePanel(320, "right");

  if (!open) return null;

  const handleDeleteBook = async (id: string) => {
    try {
      await deleteBook(id);
      onBooksChange(books.filter((t) => t.id !== id));
    } catch {
      setError("Failed to delete book");
    }
  };

  const handleStartEdit = (book: Book) => {
    setEditingId(book.id);
    setEditTitle(book.title);
  };

  const handleSaveTitle = async (id: string) => {
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await updateBook(id, { title: editTitle.trim() });
      onBooksChange(
        books.map((t) => (t.id === id ? { ...t, title: updated.title } : t))
      );
    } catch {
      setError("Failed to update title");
    }
    setEditingId(null);
  };

  // Evidence filtering
  const filtered = evidenceItems.filter((item) => {
    if (filter === "unassigned") return !item.section_id;
    if (filter === "assigned") return !!item.section_id;
    return true;
  });

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: evidenceItems.length },
    { key: "unassigned", label: "Unassigned", count: evidenceItems.filter((i) => !i.section_id).length },
    { key: "assigned", label: "Assigned", count: evidenceItems.filter((i) => !!i.section_id).length },
  ];

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "books", label: "Books", count: books.length },
    { key: "web-sources", label: "Web Sources", count: webSources.length },
    { key: "evidence", label: "Evidence", count: evidenceItems.length },
  ];

  return (
    <div className="flex-shrink-0 bg-macos-surface border-l border-macos-border flex flex-col overflow-hidden relative" style={{ width: panelWidth }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-macos-border">
        <span className="text-xs font-semibold uppercase tracking-widest text-macos-accent">
          Sources
        </span>
        <button
          onClick={onClose}
          className="text-macos-text-secondary hover:text-macos-text text-sm"
        >
          &times;
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-macos-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors ${
              tab === t.key
                ? "text-macos-accent border-b-2 border-macos-accent"
                : "text-macos-text-secondary hover:text-macos-text"
            }`}
          >
            {t.label}{t.count > 0 ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {/* Books tab */}
      {tab === "books" && (
        <>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {books.length === 0 ? (
              <div className="text-xs text-macos-text-secondary py-4 text-center">
                No books uploaded yet. Upload PDFs to extract evidence quotes.
              </div>
            ) : (
              books.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded bg-macos-bg text-xs group"
                >
                  <div className="flex-1 min-w-0 mr-2">
                    {editingId === t.id ? (
                      <input
                        className="w-full bg-transparent text-xs text-macos-text outline-none border-b border-macos-accent"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleSaveTitle(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTitle(t.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <div>
                        <span
                          className="text-macos-text cursor-pointer hover:text-macos-accent"
                          onClick={() => handleStartEdit(t)}
                          title="Click to edit title"
                        >
                          {t.title}
                        </span>
                        <span className="text-macos-text-secondary ml-2">
                          {t.page_count} pages
                        </span>
                      </div>
                    )}
                    <div className="text-[10px] text-macos-text-secondary truncate">
                      {t.filename}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteBook(t.id)}
                    className="text-macos-text-secondary hover:text-macos-error text-xs flex-shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-macos-border space-y-1.5">
            <button
              onClick={onUploadBook}
              className="w-full py-1.5 rounded text-xs font-medium border border-dashed border-macos-border text-macos-text-secondary hover:border-macos-accent hover:text-macos-accent transition-colors"
            >
              + Upload Book
            </button>
            <button
              onClick={onExtract}
              disabled={books.length === 0}
              className="w-full py-1.5 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              Extract Quotes
            </button>
          </div>
        </>
      )}

      {/* Web Sources tab */}
      {tab === "web-sources" && (
        <div className="flex-1 overflow-y-auto p-2">
          <WebSourceList
            sources={webSources}
            onSourcesChange={onWebSourcesChange}
            onAdd={onAddWebSource}
          />
        </div>
      )}

      {/* Evidence tab */}
      {tab === "evidence" && (
        <>
          {/* Filter tabs */}
          <div className="flex border-b border-macos-border">
            {filterTabs.map((ft) => (
              <button
                key={ft.key}
                onClick={() => setFilter(ft.key)}
                className={`flex-1 px-2 py-1.5 text-[11px] transition-colors ${
                  filter === ft.key
                    ? "text-macos-accent border-b-2 border-macos-accent"
                    : "text-macos-text-secondary hover:text-macos-text"
                }`}
              >
                {ft.label} ({ft.count})
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filtered.length === 0 ? (
              <div className="text-xs text-macos-text-secondary py-4 text-center">
                {evidenceItems.length === 0
                  ? "No evidence extracted yet. Upload books and extract quotes."
                  : "No items match this filter."}
              </div>
            ) : (
              filtered.map((item) => (
                <EvidenceCard
                  key={item.id}
                  item={item}
                  sections={sections}
                  onAssign={onAssign}
                  onUnassign={onUnassign}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t border-macos-border text-[11px] text-macos-text-secondary">
            {evidenceItems.length} quote{evidenceItems.length !== 1 ? "s" : ""} total
          </div>
        </>
      )}

      {error && (
        <div className="mx-2 mb-2 p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
          {error}
        </div>
      )}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-macos-accent/20 transition-colors"
      />
    </div>
  );
}
