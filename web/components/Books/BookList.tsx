"use client";

import { useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { listBooks, deleteBook, updateBook } from "@/lib/api";
import type { Book } from "@/lib/types";

export default function BookList({
  open,
  onClose,
  onUpload,
  books,
  onBooksChange,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
  books: Book[];
  onBooksChange: (books: Book[]) => void;
}) {
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await listBooks();
      onBooksChange(result);
    } catch {
      // ignore
    }
  }, [onBooksChange]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleDelete = async (id: string) => {
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

  return (
    <Modal open={open} onClose={onClose} title="Books">
      <div className="space-y-4">
        <div className="text-xs text-macos-text-secondary mb-2">
          Upload book PDFs to extract evidence quotes for your essay.
        </div>

        {books.length === 0 ? (
          <div className="text-xs text-macos-text-secondary py-2">
            No books uploaded yet.
          </div>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {books.map((t) => (
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
                  onClick={() => handleDelete(t.id)}
                  className="text-macos-text-secondary hover:text-macos-error text-xs flex-shrink-0 opacity-0 group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            onClose();
            onUpload();
          }}
          className="w-full py-2 rounded text-xs font-medium border border-dashed border-macos-border text-macos-text-secondary hover:border-macos-accent hover:text-macos-accent transition-colors"
        >
          + Upload Book
        </button>

        {error && (
          <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
