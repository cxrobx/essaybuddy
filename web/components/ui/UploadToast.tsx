"use client";

import { useEffect, useState } from "react";

export type UploadStatus = "uploading" | "success" | "error";

export interface UploadToastItem {
  id: string;
  filename: string;
  status: UploadStatus;
  error?: string;
}

export default function UploadToast({ items, onDismiss }: {
  items: UploadToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {items.map((item) => (
        <ToastItem key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ item, onDismiss }: { item: UploadToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (item.status === "success") {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss(item.id), 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [item.status, item.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg shadow-lg border text-xs transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${
        item.status === "error"
          ? "bg-macos-error/10 border-macos-error/30"
          : "bg-macos-elevated border-macos-border"
      }`}
    >
      {item.status === "uploading" && (
        <div className="w-3.5 h-3.5 border-2 border-macos-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
      {item.status === "success" && (
        <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {item.status === "error" && (
        <svg className="w-3.5 h-3.5 text-macos-error flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-macos-text truncate">{item.filename}</div>
        <div className="text-[10px] text-macos-text-secondary">
          {item.status === "uploading" && "Uploading..."}
          {item.status === "success" && "Upload complete"}
          {item.status === "error" && (item.error || "Upload failed")}
        </div>
      </div>
      {item.status !== "uploading" && (
        <button
          onClick={() => onDismiss(item.id)}
          className="text-macos-text-secondary hover:text-macos-text flex-shrink-0"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
