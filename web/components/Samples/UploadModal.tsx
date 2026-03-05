"use client";

import { useState, useRef, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { uploadSample } from "@/lib/api";
import type { Sample } from "@/lib/types";

export default function UploadModal({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (sample: Sample) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setUploading(true);
      try {
        const sample = await uploadSample(file);
        onUploaded(sample);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onClose, onUploaded]
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
    <Modal open={open} onClose={onClose} title="Upload Writing Sample">
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
          {uploading
            ? "Uploading..."
            : "Drag & drop a file here, or click to browse"}
        </div>
        <div className="text-[11px] text-macos-text-secondary mb-4">
          Supported: .pdf, .docx, .txt (max 10MB)
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-1.5 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors disabled:opacity-50"
        >
          Choose File
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {error && (
        <div className="mt-3 p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
          {error}
        </div>
      )}
    </Modal>
  );
}
