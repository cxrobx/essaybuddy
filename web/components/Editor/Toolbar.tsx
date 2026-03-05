"use client";

import type { Editor } from "@tiptap/react";

export default function Toolbar({
  editor,
  onAIClick,
}: {
  editor: Editor | null;
  onAIClick: () => void;
}) {
  if (!editor) return null;

  const btn = (
    label: string,
    action: () => void,
    isActive?: boolean
  ) => (
    <button
      onClick={action}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        isActive
          ? "bg-macos-accent text-white"
          : "text-macos-text-secondary hover:text-macos-text hover:bg-macos-elevated"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-macos-border bg-macos-surface flex-wrap">
      {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {btn("U", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"))}

      <div className="w-px h-4 bg-macos-border mx-1" />

      {btn("H1", () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
      {btn("H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
      {btn("H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}

      <div className="w-px h-4 bg-macos-border mx-1" />

      {btn("UL", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {btn("OL", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      {btn("Quote", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}

      <div className="flex-1" />

      <button
        onClick={onAIClick}
        className="px-3 py-1 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover text-white transition-colors flex items-center gap-1"
      >
        Zora <span className="text-[10px]">&#10024;</span>
      </button>
    </div>
  );
}
