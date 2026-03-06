"use client";

import { useState, useRef, useCallback } from "react";
import Modal from "@/components/ui/Modal";

export default function TextbookUploadModal({
  open,
  onClose,
  onFileSelected,
}: {
  open: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      onFileSelected(file);
      onClose();
    },
    [onClose, onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <Modal open={open} onClose={onClose} title="Upload Textbook">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragging
            ? "border-macos-accent bg-macos-accent/10"
            : "border-macos-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="text-macos-text-secondary text-sm mb-2">
          Drag & drop a PDF here, or click to browse
        </div>
        <div className="text-[11px] text-macos-text-secondary mb-4">
          Supported: .pdf (max 50MB) — upload runs in the background
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="px-4 py-1.5 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors"
        >
          Choose File
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            if (e.target) e.target.value = "";
          }}
        />
      </div>
    </Modal>
  );
}
