"use client";

import type { WebSource } from "@/lib/types";

export default function WebSourceCard({
  source,
  onCite,
  onEdit,
  onDelete,
}: {
  source: WebSource;
  onCite?: (source: WebSource) => void;
  onEdit?: (source: WebSource) => void;
  onDelete?: (id: string) => void;
}) {
  const displayUrl = (() => {
    try {
      return new URL(source.url).hostname;
    } catch {
      return source.url;
    }
  })();

  return (
    <div className="rounded border border-macos-border bg-macos-elevated p-2 space-y-1 group">
      <div className="text-[11px] font-medium text-macos-text leading-tight">
        {source.title}
      </div>
      {source.author && (
        <div className="text-[10px] text-macos-text-secondary">{source.author}</div>
      )}
      <div className="flex items-center gap-2 text-[10px] text-macos-text-secondary">
        {source.site_name && <span>{source.site_name}</span>}
        {!source.site_name && <span>{displayUrl}</span>}
        {source.date_published && <span>{source.date_published}</span>}
      </div>
      {source.description && (
        <div className="text-[10px] text-macos-text-secondary line-clamp-2">
          {source.description}
        </div>
      )}
      <div className="flex items-center gap-1 pt-0.5">
        {onCite && (
          <button
            onClick={() => onCite(source)}
            className="text-[10px] text-macos-text-secondary hover:text-macos-accent px-1.5 py-0.5 rounded border border-macos-border"
          >
            Cite
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(source)}
            className="text-[10px] text-macos-text-secondary hover:text-macos-accent px-1.5 py-0.5 rounded border border-macos-border"
          >
            Edit
          </button>
        )}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-macos-text-secondary hover:text-macos-accent px-1.5 py-0.5"
        >
          Open
        </a>
        {onDelete && (
          <button
            onClick={() => onDelete(source.id)}
            className="text-[10px] text-macos-text-secondary hover:text-macos-error px-1.5 py-0.5 rounded border border-macos-border opacity-0 group-hover:opacity-100"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
