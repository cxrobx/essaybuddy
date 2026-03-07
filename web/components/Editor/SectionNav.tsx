"use client";

import { useEffect, useState, useCallback, useRef } from "react";

const WORDS_PER_PAGE = 250;

interface NavItem {
  id: string;
  text: string;
  level: number;
  pos: number;
  domSelector: string;
  type: "section" | "page";
}

// Detect paragraphs that look like section labels
function looksLikeSectionLabel(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > 80 || trimmed.length < 2) return false;
  if (/^(part|section|chapter)\s+\d/i.test(trimmed)) return true;
  if (/^(introduction|conclusion|abstract|references|works cited|bibliography|appendix)/i.test(trimmed)) return true;
  if (trimmed.length <= 40 && trimmed.endsWith(":")) return true;
  return false;
}

export default function SectionNav({
  editor,
  scrollContainer,
  sectionNoun = "Sections",
}: {
  editor: any;
  scrollContainer: HTMLElement | null;
  sectionNoun?: string;
}) {
  const [items, setItems] = useState<NavItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  // Extract navigable items (sections + page markers) from editor document
  const extractItems = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const sectionItems: NavItem[] = [];
    let headingCount = 0;

    // First pass: count headings
    editor.state.doc.descendants((node: any) => {
      if (node.type.name === "heading" && node.textContent.trim()) {
        headingCount++;
      }
    });

    // Second pass: collect sections and compute page breaks
    const blocks: { pos: number; words: number }[] = [];
    let totalWords = 0;

    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.isTextblock) {
        const text = node.textContent.trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        blocks.push({ pos, words });
        totalWords += words;
      }

      if (node.type.name === "heading") {
        const text = node.textContent;
        if (text.trim()) {
          sectionItems.push({
            id: `nav-${pos}`,
            text: text.length > 28 ? text.slice(0, 28) + "\u2026" : text,
            level: node.attrs.level,
            pos,
            domSelector: `h${node.attrs.level}`,
            type: "section",
          });
        }
      } else if (node.type.name === "paragraph" && headingCount === 0) {
        const text = node.textContent;
        if (looksLikeSectionLabel(text)) {
          sectionItems.push({
            id: `nav-${pos}`,
            text: text.length > 28 ? text.slice(0, 28) + "\u2026" : text,
            level: 2,
            pos,
            domSelector: "p",
            type: "section",
          });
        }
      }
    });

    // Compute page breaks using same greedy algorithm as PageBreaks extension
    // Section headings/labels are never preceded by a page break
    const sectionPositions = new Set(sectionItems.map((s) => s.pos));
    const pageItems: NavItem[] = [];
    if (totalWords > WORDS_PER_PAGE) {
      let wordsSinceBreak = 0;
      let pageNum = 1;

      for (const block of blocks) {
        const isSection = sectionPositions.has(block.pos);
        if (wordsSinceBreak > 0 && wordsSinceBreak + block.words > WORDS_PER_PAGE && !isSection) {
          pageNum++;
          pageItems.push({
            id: `page-${pageNum}`,
            text: `Page ${pageNum}`,
            level: 0,
            pos: block.pos,
            domSelector: ".page-break-indicator",
            type: "page",
          });
          wordsSinceBreak = 0;
        }
        wordsSinceBreak += block.words;
      }
    }

    // Merge and sort by document position
    const allItems = [...sectionItems, ...pageItems].sort((a, b) => a.pos - b.pos);
    setItems(allItems);
  }, [editor]);

  // Re-extract on editor changes
  useEffect(() => {
    if (!editor) return;
    extractItems();
    editor.on("update", extractItems);
    return () => {
      editor.off("update", extractItems);
    };
  }, [editor, extractItems]);

  // Track which item is in view
  useEffect(() => {
    if (!scrollContainer || items.length === 0) return;

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const containerRect = scrollContainer.getBoundingClientRect();
        const viewTop = containerRect.top + 80;

        const editorEl = scrollContainer.querySelector(".tiptap");
        if (!editorEl) return;

        let closest: string | null = null;
        let closestDist = Infinity;

        for (const item of items) {
          if (item.type === "page") {
            // Match page break indicators by data-page attribute
            const el = editorEl.querySelector(`.page-break-indicator[data-page="${item.text.replace("Page ", "")}"]`);
            if (el) {
              const rect = el.getBoundingClientRect();
              const dist = Math.abs(rect.top - viewTop);
              if (rect.top <= viewTop + 200 && dist < closestDist) {
                closestDist = dist;
                closest = item.id;
              }
            }
          } else {
            const candidates = editorEl.querySelectorAll(item.domSelector);
            for (const el of candidates) {
              if (el.textContent?.trim().startsWith(item.text.replace("\u2026", "").trim())) {
                const rect = el.getBoundingClientRect();
                const dist = Math.abs(rect.top - viewTop);
                if (rect.top <= viewTop + 200 && dist < closestDist) {
                  closestDist = dist;
                  closest = item.id;
                }
                break;
              }
            }
          }
        }

        if (closest) setActiveId(closest);
      });
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      scrollContainer.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [scrollContainer, items]);

  const scrollToItem = useCallback(
    (item: NavItem) => {
      if (!editor || !scrollContainer) return;
      const editorEl = scrollContainer.querySelector(".tiptap");
      if (!editorEl) return;

      if (item.type === "page") {
        const pageNum = item.text.replace("Page ", "");
        const el = editorEl.querySelector(`.page-break-indicator[data-page="${pageNum}"]`);
        if (el) {
          const elRect = el.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          const offset = elRect.top - containerRect.top + scrollContainer.scrollTop;
          scrollContainer.scrollTo({ top: offset - 20, behavior: "smooth" });
        }
        return;
      }

      const candidates = editorEl.querySelectorAll(item.domSelector);
      const prefix = item.text.replace("\u2026", "").trim();
      for (const el of candidates) {
        if (el.textContent?.trim().startsWith(prefix)) {
          const elRect = el.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          const offset = elRect.top - containerRect.top + scrollContainer.scrollTop;
          scrollContainer.scrollTo({ top: offset - 20, behavior: "smooth" });
          return;
        }
      }
    },
    [editor, scrollContainer]
  );

  if (items.length === 0) return null;

  return (
    <nav className="w-40 flex-shrink-0 border-r border-macos-border bg-macos-surface flex flex-col overflow-hidden">
      <div className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-widest text-macos-text-secondary border-b border-macos-border">
        {sectionNoun}
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {items.map((item) =>
          item.type === "page" ? (
            <button
              key={item.id}
              onClick={() => scrollToItem(item)}
              className={`w-full flex items-center gap-1.5 px-2.5 py-1 text-[10px] transition-colors ${
                activeId === item.id
                  ? "text-macos-accent"
                  : "text-macos-text-secondary/60 hover:text-macos-text-secondary"
              }`}
            >
              <span className="flex-1 border-t border-macos-border/60" />
              <span className="uppercase tracking-wider whitespace-nowrap">{item.text}</span>
              <span className="flex-1 border-t border-macos-border/60" />
            </button>
          ) : (
            <button
              key={item.id}
              onClick={() => scrollToItem(item)}
              className={`w-full text-left px-2.5 py-1.5 text-[11px] leading-tight transition-colors truncate block ${
                activeId === item.id
                  ? "text-macos-accent font-medium bg-macos-accent/10 border-r-2 border-macos-accent"
                  : "text-macos-text-secondary hover:text-macos-text hover:bg-macos-elevated"
              }`}
              style={{ paddingLeft: `${(item.level - 1) * 12 + 10}px` }}
              title={item.text}
            >
              {item.text}
            </button>
          )
        )}
      </div>
    </nav>
  );
}
