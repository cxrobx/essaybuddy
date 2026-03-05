"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Markdown } from "tiptap-markdown";
import { PageBreaks } from "./extensions/PageBreaks";
import { useEffect, useCallback, useRef } from "react";

export default function RichTextEditor({
  content,
  onUpdate,
  onEditorReady,
  onScrollContainerReady,
}: {
  content: string;
  onUpdate: (markdown: string) => void;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
  onScrollContainerReady?: (el: HTMLDivElement) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing your essay...",
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Highlight,
      Markdown,
      PageBreaks,
    ],
    content,
    onUpdate: ({ editor }) => {
      onUpdate(editor.storage.markdown.getMarkdown());
    },
    editorProps: {
      attributes: {
        class: "tiptap",
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Sync external content changes (e.g., on essay load)
  useEffect(() => {
    if (editor && content && !editor.isDestroyed) {
      const currentMd = editor.storage.markdown.getMarkdown();
      if (currentMd !== content) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  const scrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && onScrollContainerReady) {
        onScrollContainerReady(node);
      }
    },
    [onScrollContainerReady]
  );

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="flex justify-center py-6 px-4">
        <div className="w-full max-w-4xl bg-white rounded-lg shadow-macos-lg">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
