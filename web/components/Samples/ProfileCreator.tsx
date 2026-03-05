"use client";

import { useState, useRef, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { uploadSample, createVoiceProfile } from "@/lib/api";
import type { Sample, Profile } from "@/lib/types";

type Step = "input" | "generating" | "done";

export default function ProfileCreator({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (profile: Profile) => void;
}) {
  const [step, setStep] = useState<Step>("input");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<{ sample: Sample; file: File }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [genStatus, setGenStatus] = useState("");
  const [createdProfile, setCreatedProfile] = useState<Profile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("input");
    setName("");
    setFiles([]);
    setUploading(false);
    setDragging(false);
    setError("");
    setGenStatus("");
    setCreatedProfile(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleAddFile = useCallback(async (file: File) => {
    setError("");
    setUploading(true);
    try {
      const sample = await uploadSample(file);
      setFiles((prev) => [...prev, { sample, file }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleAddFile(file);
    },
    [handleAddFile]
  );

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || files.length === 0) return;
    setStep("generating");
    setGenStatus("Running style analysis...");

    try {
      setGenStatus("Generating voice model...");
      const sampleIds = files.map((f) => f.sample.id);
      const profile = await createVoiceProfile(sampleIds, name.trim());
      setCreatedProfile(profile);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profile creation failed");
      setStep("input");
    }
  }, [name, files]);

  const handleUseProfile = useCallback(() => {
    if (createdProfile) {
      onCreated(createdProfile);
    }
    handleClose();
  }, [createdProfile, onCreated, handleClose]);

  const canCreate = name.trim().length > 0 && files.length > 0 && !uploading;

  return (
    <Modal
      open={open}
      onClose={step === "generating" ? () => {} : handleClose}
      title="Create Voice Profile"
    >
      {step === "input" && (
        <div className="space-y-4">
          {/* Profile Name */}
          <div>
            <label className="block text-xs font-semibold text-macos-text mb-1.5">
              Profile Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Academic Voice"
              className="w-full px-3 py-2 rounded text-xs bg-macos-bg border border-macos-border text-macos-text placeholder:text-macos-text-secondary/50 outline-none focus:border-macos-accent"
            />
          </div>

          {/* Upload Zone */}
          <div>
            <label className="block text-xs font-semibold text-macos-text mb-1.5">
              Writing Samples
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
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
              <div className="text-macos-text-secondary text-xs mb-1.5">
                {uploading
                  ? "Uploading..."
                  : "Drag & drop files here, or click to browse"}
              </div>
              <div className="text-[11px] text-macos-text-secondary/60 mb-3">
                .pdf, .docx, .txt
              </div>
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 rounded text-xs font-medium bg-macos-elevated hover:bg-macos-border text-macos-text transition-colors disabled:opacity-50"
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
                  if (file) handleAddFile(file);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              />
            </div>
          </div>

          {/* Uploaded Files */}
          {files.length > 0 && (
            <div className="space-y-1">
              {files.map((f, i) => (
                <div
                  key={f.sample.id}
                  className="flex items-center justify-between px-3 py-2 rounded bg-macos-bg text-xs"
                >
                  <div>
                    <span className="text-macos-text">{f.sample.filename}</span>
                    <span className="text-macos-text-secondary ml-2">
                      {(f.sample.char_count / 1000).toFixed(1)}k chars
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(i)}
                    className="text-macos-text-secondary hover:text-macos-error text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          <div className="px-3 py-2 rounded bg-macos-accent/5 border border-macos-accent/20 text-[11px] text-macos-text-secondary">
            Upload at least 3 essays for best results (minimum 1 required)
          </div>

          {/* Error */}
          {error && (
            <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error">
              {error}
            </div>
          )}

          {/* Create Button */}
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="w-full py-2 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Profile
          </button>
        </div>
      )}

      {step === "generating" && (
        <div className="py-8 text-center space-y-4">
          {/* Spinner */}
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-macos-border border-t-macos-accent rounded-full animate-spin" />
          </div>
          <div className="text-sm text-macos-text">
            Analyzing your writing style...
          </div>
          <div className="text-xs text-macos-text-secondary">{genStatus}</div>
          <div className="text-[11px] text-macos-text-secondary/50">
            This may take up to 2 minutes
          </div>
        </div>
      )}

      {step === "done" && createdProfile && (
        <div className="py-4 text-center space-y-4">
          <div className="text-2xl">&#10003;</div>
          <div className="text-sm font-medium text-macos-text">
            Profile created!
          </div>
          <div className="text-xs text-macos-text-secondary">
            <span className="font-medium text-macos-text">
              {createdProfile.name}
            </span>{" "}
            &mdash; voice profile with{" "}
            {(createdProfile as any).voice_model?.voice_examples?.length ?? 0}{" "}
            example passages
          </div>
          <button
            onClick={handleUseProfile}
            className="w-full py-2 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors"
          >
            Use This Profile
          </button>
        </div>
      )}
    </Modal>
  );
}
