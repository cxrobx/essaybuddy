import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DecorationSet, Decoration } from "@tiptap/pm/view";

const WORDS_PER_PAGE = 250; // Standard double-spaced, 12pt, 1-inch margins

const pageBreakPluginKey = new PluginKey("pageBreaks");

function isSectionLabel(text: string): boolean {
  const t = text.trim();
  if (t.length > 80 || t.length < 2) return false;
  if (/^(part|section|chapter)\s+\d/i.test(t)) return true;
  if (/^(introduction|conclusion|abstract|references|works cited|bibliography|appendix)/i.test(t)) return true;
  if (t.length <= 40 && t.endsWith(":")) return true;
  return false;
}

function buildDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  // First pass: collect all text blocks with their word counts and positions
  const blocks: { pos: number; words: number; isSection: boolean }[] = [];
  let totalWords = 0;

  doc.descendants((node: any, pos: number) => {
    if (node.isTextblock) {
      const text = node.textContent.trim();
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      // Detect section headings and section-like labels
      const isSection =
        node.type.name === "heading" ||
        (node.type.name === "paragraph" && isSectionLabel(text));
      blocks.push({ pos, words, isSection });
      totalWords += words;
      return false;
    }
  });

  if (totalWords <= WORDS_PER_PAGE) return DecorationSet.create(doc, []);

  // Second pass: greedy page-filling algorithm.
  // Accumulate words and place a break BEFORE the block that would push
  // the current page past the word limit. This produces more evenly
  // distributed breaks than snapping to absolute word-count boundaries.
  let wordsSinceBreak = 0;
  let pageNum = 1;

  for (const block of blocks) {
    // If there's content on this page and adding this block exceeds the limit,
    // start a new page before this block — but never right before a section heading
    if (wordsSinceBreak > 0 && wordsSinceBreak + block.words > WORDS_PER_PAGE && !block.isSection) {
      pageNum++;
      const widget = document.createElement("div");
      widget.className = "page-break-indicator";
      widget.setAttribute("data-page", String(pageNum));
      decorations.push(Decoration.widget(block.pos, widget, { side: -1 }));
      wordsSinceBreak = 0;
    }
    wordsSinceBreak += block.words;
  }

  return DecorationSet.create(doc, decorations);
}

export const PageBreaks = Extension.create({
  name: "pageBreaks",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pageBreakPluginKey,
        state: {
          init(_, state) {
            return buildDecorations(state.doc);
          },
          apply(tr, old) {
            if (tr.docChanged) {
              return buildDecorations(tr.doc);
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
