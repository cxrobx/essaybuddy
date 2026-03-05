"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "@/components/ui/Modal";
import { listSamples, deleteSample, listProfiles, uploadSample } from "@/lib/api";
import type { Sample, ProfileListItem } from "@/lib/types";

export default function SampleList({
  open,
  onClose,
  activeProfileId,
  onProfileChange,
  onNewProfile,
  onSampleUploaded,
}: {
  open: boolean;
  onClose: () => void;
  activeProfileId: string | null;
  onProfileChange: (profileId: string) => void;
  onNewProfile: () => void;
  onSampleUploaded?: () => void;
}) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([listSamples(), listProfiles()]);
      setSamples(s);
      setProfiles(p);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleDelete = async (id: string) => {
    try {
      await deleteSample(id);
      setSamples((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("Failed to delete sample");
    }
  };

  const handleUploadFile = useCallback(async (file: File) => {
    setError("");
    setUploading(true);
    try {
      const sample = await uploadSample(file);
      setSamples((prev) => [...prev, sample]);
      onSampleUploaded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [onSampleUploaded]);

  return (
    <Modal open={open} onClose={onClose} title="Samples & Voice Profile">
      <div className="space-y-5">
        {/* Voice Profile Selector */}
        <div>
          <div className="text-xs font-semibold text-macos-text mb-2">Voice Profile</div>
          <div className="text-xs text-macos-text-secondary mb-2">
            Select the writing voice the AI will mimic when generating or rephrasing text.
          </div>
          {profiles.length === 0 ? (
            <div className="text-xs text-macos-text-secondary py-2">
              No voice profiles available.
            </div>
          ) : (
            <div className="space-y-1">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onProfileChange(p.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs text-left transition-colors ${
                    activeProfileId === p.id
                      ? "bg-macos-accent/20 border border-macos-accent/40 text-macos-text"
                      : "bg-macos-bg border border-macos-border text-macos-text-secondary hover:bg-macos-elevated"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      activeProfileId === p.id ? "bg-macos-accent" : "bg-macos-border"
                    }`}
                  />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.bundled && (
                    <span className="text-[10px] text-macos-text-secondary px-1.5 py-0.5 rounded bg-macos-elevated">
                      bundled
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              onClose();
              onNewProfile();
            }}
            className="w-full mt-2 py-2 rounded text-xs font-medium border border-dashed border-macos-border text-macos-text-secondary hover:border-macos-accent hover:text-macos-accent transition-colors"
          >
            + New Profile
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-macos-border" />

        {/* Writing Samples */}
        <div>
          <div className="text-xs font-semibold text-macos-text mb-2">Writing Samples</div>
          <div className="text-xs text-macos-text-secondary mb-2">
            Uploaded samples are used as reference material when the AI generates or rephrases text.
          </div>

          {samples.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
              {samples.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded bg-macos-bg text-xs"
                >
                  <div>
                    <span className="text-macos-text">{s.filename}</span>
                    <span className="text-macos-text-secondary ml-2">
                      {(s.char_count / 1000).toFixed(1)}k chars
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="text-macos-text-secondary hover:text-macos-error text-xs"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
              dragging
                ? "border-macos-accent bg-macos-accent/10"
                : "border-macos-border"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleUploadFile(file);
            }}
          >
            <div className="text-macos-text-secondary text-xs mb-1">
              {uploading ? "Uploading..." : "Drag & drop a file here, or click to browse"}
            </div>
            <div className="text-[10px] text-macos-text-secondary mb-2">
              Supported: .pdf, .docx, .txt (max 10MB)
            </div>
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1 rounded text-[11px] font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors disabled:opacity-50"
            >
              Choose File
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {error && (
          <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
