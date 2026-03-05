"use client";

import { useState } from "react";

/* ─── Static mock data ─── */
const SECTIONS = [
  { id: "1", title: "Introduction", notes: "Hook with a compelling question", evidence: [] as { id: string; text: string; source: string }[] },
  { id: "2", title: "Historical Context", notes: "Trace the evolution of the debate", evidence: [
    { id: "e1", text: "The printing press democratized knowledge but was initially feared by scribes...", source: "Thompson Ch.2 p.34" },
  ] },
  { id: "3", title: "Core Argument", notes: "Present the central thesis", evidence: [
    { id: "e2", text: "AI-generated art lacks intentionality, a key component of creative expression.", source: "Rivera 2024 p.112" },
    { id: "e3", text: "Studies show 73% of professional artists now use AI tools in their workflow.", source: "Field Study Data" },
  ] },
  { id: "4", title: "Counterarguments", notes: "Address opposing viewpoints fairly", evidence: [] },
  { id: "5", title: "Conclusion", notes: "Synthesize and call to action", evidence: [] },
];

const TEXTBOOKS = [
  { id: "t1", name: "Digital Creativity — Thompson (2023)", pages: 342 },
  { id: "t2", name: "Art & Algorithms — Rivera (2024)", pages: 287 },
  { id: "t3", name: "The Human Element — Park (2025)", pages: 198 },
];

const ALL_EVIDENCE = [
  { id: "e1", text: "The printing press democratized knowledge but was initially feared by scribes...", source: "Thompson Ch.2 p.34", section: "2" },
  { id: "e2", text: "AI-generated art lacks intentionality, a key component of creative expression.", source: "Rivera 2024 p.112", section: "3" },
  { id: "e3", text: "Studies show 73% of professional artists now use AI tools in their workflow.", source: "Field Study Data", section: "3" },
  { id: "e4", text: "Creative cognition requires embodied experience that machines fundamentally lack.", source: "Park 2025 p.67", section: null },
  { id: "e5", text: "Copyright frameworks have not kept pace with generative AI capabilities.", source: "Thompson Ch.8 p.201", section: null },
];

const ESSAY_CONTENT = `The question of whether technology enhances or diminishes human creativity has occupied thinkers for decades. As artificial intelligence becomes increasingly capable of generating text, art, and music, this question takes on new urgency.

Throughout history, each technological revolution has sparked similar anxieties. The printing press, the camera, and the word processor were all initially feared as threats to authentic creative expression. Yet each ultimately expanded the boundaries of what creators could achieve.

Today's AI tools present a more complex case. Unlike previous technologies that primarily automated mechanical aspects of creation, AI systems can now engage with the conceptual and aesthetic dimensions of creative work.`;

/* ─── Color tokens (macOS dark) ─── */
const C = {
  bg: "#1C1C1E",
  surface: "#2C2C2E",
  surfaceHover: "#3A3A3C",
  border: "#3A3A3C",
  borderLight: "#48484A",
  text: "#F5F5F7",
  textSecondary: "#98989D",
  textTertiary: "#636366",
  accent: "#6CB4EE",
  accentDim: "rgba(108,180,238,0.12)",
  green: "#32D74B",
  greenDim: "rgba(50,215,75,0.12)",
  orange: "#FF9F0A",
  orangeDim: "rgba(255,159,10,0.12)",
};

/* ─── Shared sub-components ─── */

function HeaderPill({ label, active, count, onClick }: { label: string; active?: boolean; count?: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 12px", borderRadius: 20,
      border: `1px solid ${active ? C.accent : C.border}`,
      background: active ? C.accentDim : "transparent",
      color: active ? C.accent : C.textSecondary,
      fontSize: 12, fontWeight: 500, cursor: "pointer",
      transition: "all 0.15s ease", display: "flex", alignItems: "center", gap: 4,
    }}>
      {label}{count !== undefined && count > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>({count})</span>}
    </button>
  );
}

function SavedBadge() {
  return (
    <span style={{
      fontSize: 11, color: C.green, fontWeight: 500,
      padding: "3px 10px", borderRadius: 10,
      background: C.greenDim, border: `1px solid rgba(50,215,75,0.2)`,
    }}>
      Saved
    </span>
  );
}

function MockHeader({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 16px", background: C.surface,
      borderBottom: `1px solid ${C.border}`, flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 14, fontWeight: 700, color: C.text }}>
          &#9998; Zora
        </span>
        <span style={{ fontSize: 12, color: C.textSecondary, fontStyle: "italic" }}>
          The Impact of AI on Creativity
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {left}
        {right}
      </div>
    </header>
  );
}

function OutlineSidebar({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <aside style={{
      width: 240, flexShrink: 0, display: "flex", flexDirection: "column",
      background: C.surface, borderRight: `1px solid ${C.border}`,
    }}>
      {children}
      {footer && (
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textSecondary }}>
          {footer}
        </div>
      )}
    </aside>
  );
}

function SidebarSectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      padding: "12px 16px 8px", fontSize: 10, fontWeight: 700,
      textTransform: "uppercase" as const, letterSpacing: 3, color: C.textTertiary,
      borderBottom: `1px solid ${C.border}`,
    }}>
      {label}
    </div>
  );
}

function OutlineItem({ section, idx, isOpen, onToggle, extra }: {
  section: typeof SECTIONS[0]; idx: number; isOpen: boolean;
  onToggle: () => void; extra?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 2 }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", cursor: "pointer", borderRadius: 6,
        background: isOpen ? "rgba(108,180,238,0.06)" : "transparent",
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: "50%",
          background: isOpen ? C.accent : C.borderLight,
          color: isOpen ? "#fff" : C.textSecondary,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>
          {idx + 1}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text }}>{section.title}</span>
        {extra}
        <span style={{
          fontSize: 8, color: C.textTertiary,
          transform: isOpen ? "rotate(180deg)" : "none",
          transition: "transform 0.2s ease",
        }}>&#9660;</span>
      </div>
      {isOpen && (
        <div style={{ padding: "2px 10px 10px 38px" }}>
          <div style={{
            border: `1px solid ${C.border}`, borderRadius: 4,
            padding: 6, fontSize: 11, color: C.textSecondary,
            background: C.bg, lineHeight: 1.5,
          }}>
            {section.notes}
          </div>
        </div>
      )}
    </div>
  );
}

function EditorArea() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.bg }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 1,
        padding: "6px 14px", background: C.surface,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {["B", "I", "U"].map((label) => (
          <button key={label} style={{
            padding: "4px 10px", borderRadius: 4, border: "none",
            background: "transparent", color: C.textSecondary,
            fontSize: 13, cursor: "pointer",
            fontWeight: label === "B" ? 700 : 400,
            fontStyle: label === "I" ? "italic" : "normal",
            textDecoration: label === "U" ? "underline" : "none",
          }}>{label}</button>
        ))}
        <div style={{ width: 1, height: 16, background: C.border, margin: "0 6px" }} />
        {["H1", "H2", "H3"].map((h) => (
          <button key={h} style={{
            padding: "4px 8px", borderRadius: 4, border: "none",
            background: "transparent", color: C.textTertiary,
            fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>{h}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{
          padding: "5px 14px", borderRadius: 6, border: "none",
          background: C.accent, color: "#fff",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>
          &#10024; AI Assistant
        </button>
      </div>
      {/* Paper */}
      <div style={{ flex: 1, overflowY: "auto" as const, display: "flex", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{
          width: "100%", maxWidth: 820, minHeight: 500,
          background: C.surface, borderRadius: 6,
          boxShadow: "0 2px 16px rgba(0,0,0,0.3)",
          padding: "40px 56px",
        }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: "0 0 12px 0" }}>
            The Impact of AI on Creativity
          </h1>
          {ESSAY_CONTENT.split("\n\n").map((para, i) => (
            <p key={i} style={{ fontSize: 15, color: C.textSecondary, margin: "0 0 16px 0", lineHeight: 1.7 }}>{para}</p>
          ))}
        </div>
      </div>
      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 18px", background: C.surface,
        borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textTertiary,
      }}>
        <span>&#9998; Draft</span>
        <span>247 words</span>
      </div>
    </div>
  );
}

function EvidenceCard({ item, compact }: { item: typeof ALL_EVIDENCE[0]; compact?: boolean }) {
  return (
    <div style={{
      padding: compact ? "6px 8px" : "8px 10px", borderRadius: 6,
      background: C.bg, border: `1px solid ${C.border}`,
      marginBottom: compact ? 4 : 6,
    }}>
      <div style={{
        fontSize: compact ? 11 : 12, color: C.text, lineHeight: 1.5,
        display: "-webkit-box", WebkitLineClamp: compact ? 2 : 3,
        WebkitBoxOrient: "vertical" as const, overflow: "hidden",
      }}>
        &ldquo;{item.text}&rdquo;
      </div>
      <div style={{
        fontSize: 10, color: C.accent, marginTop: 3, fontWeight: 500,
      }}>
        {item.source}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   MOCK A — "Sources Panel": single button, tabbed right panel
   ──────────────────────────────────────────────────────── */

function MockA() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1", "3"]));
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [sourceTab, setSourceTab] = useState<"textbooks" | "evidence">("textbooks");
  const [extractingBook, setExtractingBook] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <MockHeader
        left={<>
          <SavedBadge />
          <HeaderPill label="Upload Sample" />
          <HeaderPill label="Voice" />
          <HeaderPill label="Sources" count={ALL_EVIDENCE.length} active={sourcesOpen} onClick={() => setSourcesOpen(!sourcesOpen)} />
          <HeaderPill label="Research" />
        </>}
        right={null}
      />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <OutlineSidebar footer={<><span>3 samples</span> &middot; <span style={{ color: C.green }}>&#9679; Voice active</span></>}>
          <SidebarSectionHeader label="Outline" />
          <div style={{ flex: 1, overflowY: "auto" as const, padding: 8 }}>
            {SECTIONS.map((s, i) => (
              <OutlineItem key={s.id} section={s} idx={i} isOpen={expanded.has(s.id)} onToggle={() => toggle(s.id)} />
            ))}
          </div>
        </OutlineSidebar>

        <EditorArea />

        {/* Sources right panel */}
        {sourcesOpen && (
          <aside style={{
            width: 300, flexShrink: 0, display: "flex", flexDirection: "column",
            background: C.surface, borderLeft: `1px solid ${C.border}`,
          }}>
            {/* Tabs */}
            <div style={{
              display: "flex", borderBottom: `1px solid ${C.border}`,
            }}>
              {(["textbooks", "evidence"] as const).map((tab) => (
                <button key={tab} onClick={() => setSourceTab(tab)} style={{
                  flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const,
                  letterSpacing: 1, background: "transparent",
                  color: sourceTab === tab ? C.accent : C.textTertiary,
                  borderBottom: sourceTab === tab ? `2px solid ${C.accent}` : "2px solid transparent",
                }}>
                  {tab === "textbooks" ? "Textbooks" : `Evidence (${ALL_EVIDENCE.length})`}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto" as const, padding: 12 }}>
              {sourceTab === "textbooks" ? (
                <>
                  {TEXTBOOKS.map((book) => (
                    <div key={book.id} style={{
                      padding: "10px 12px", borderRadius: 6,
                      background: extractingBook === book.id ? C.accentDim : C.bg,
                      border: `1px solid ${extractingBook === book.id ? C.accent : C.border}`,
                      marginBottom: 6, cursor: "pointer",
                    }} onClick={() => setExtractingBook(extractingBook === book.id ? null : book.id)}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{book.name}</div>
                      <div style={{ fontSize: 10, color: C.textTertiary, marginTop: 2 }}>{book.pages} pages</div>
                      {extractingBook === book.id && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 6 }}>Extract quotes from pages:</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input placeholder="e.g. 34-42" style={{
                              flex: 1, padding: "4px 8px", borderRadius: 4,
                              border: `1px solid ${C.border}`, background: C.bg,
                              color: C.text, fontSize: 11, outline: "none",
                            }} />
                            <button style={{
                              padding: "4px 10px", borderRadius: 4, border: "none",
                              background: C.accent, color: "#fff", fontSize: 11,
                              fontWeight: 600, cursor: "pointer",
                            }}>Extract</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button style={{
                    width: "100%", padding: 8, borderRadius: 6,
                    border: `1px dashed ${C.borderLight}`, background: "transparent",
                    fontSize: 12, color: C.textTertiary, cursor: "pointer",
                    marginTop: 4,
                  }}>+ Upload Textbook</button>
                </>
              ) : (
                <>
                  {ALL_EVIDENCE.map((item) => (
                    <div key={item.id}>
                      <EvidenceCard item={item} />
                      <div style={{
                        fontSize: 10, color: item.section ? C.green : C.textTertiary,
                        marginBottom: 8, marginTop: -4, paddingLeft: 4,
                      }}>
                        {item.section ? `Assigned to Section ${item.section}` : "Unassigned"}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   MOCK B — "Outline-Integrated": no new header buttons
   ──────────────────────────────────────────────────────── */

function MockB() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1", "3"]));
  const [sidebarMode, setSidebarMode] = useState<"outline" | "sources">("outline");

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <MockHeader
        left={<>
          <SavedBadge />
          <HeaderPill label="Upload Sample" />
          <HeaderPill label="Voice" />
          <HeaderPill label="Research" />
        </>}
        right={null}
      />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <OutlineSidebar footer={<><span>3 samples</span> &middot; <span style={{ color: C.green }}>&#9679; Voice active</span></>}>
          {/* Toggle between Outline and Sources */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
            {(["outline", "sources"] as const).map((mode) => (
              <button key={mode} onClick={() => setSidebarMode(mode)} style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
                letterSpacing: 2, background: "transparent",
                color: sidebarMode === mode ? C.accent : C.textTertiary,
                borderBottom: sidebarMode === mode ? `2px solid ${C.accent}` : "2px solid transparent",
              }}>
                {mode === "outline" ? "Outline" : `Sources (${ALL_EVIDENCE.length})`}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto" as const, padding: 8 }}>
            {sidebarMode === "outline" ? (
              /* Outline with inline evidence cards */
              SECTIONS.map((s, i) => (
                <div key={s.id} style={{ marginBottom: 2 }}>
                  <OutlineItem section={s} idx={i} isOpen={expanded.has(s.id)} onToggle={() => toggle(s.id)} />
                  {expanded.has(s.id) && s.evidence.length > 0 && (
                    <div style={{ padding: "0 10px 8px 38px" }}>
                      {s.evidence.map((ev) => (
                        <div key={ev.id} style={{
                          padding: "5px 8px", borderRadius: 4,
                          background: C.orangeDim, border: `1px solid rgba(255,159,10,0.2)`,
                          marginBottom: 3,
                        }}>
                          <div style={{
                            fontSize: 10, color: C.text, lineHeight: 1.4,
                            display: "-webkit-box", WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                          }}>
                            &ldquo;{ev.text}&rdquo;
                          </div>
                          <div style={{ fontSize: 9, color: C.orange, marginTop: 2 }}>{ev.source}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              /* Sources mode: textbooks + evidence list */
              <>
                <div style={{ padding: "8px 4px 4px", fontSize: 10, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  Textbooks
                </div>
                {TEXTBOOKS.map((book) => (
                  <div key={book.id} style={{
                    padding: "8px 10px", borderRadius: 6,
                    background: C.bg, border: `1px solid ${C.border}`,
                    marginBottom: 4,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{book.name}</div>
                    <div style={{ fontSize: 10, color: C.textTertiary, marginTop: 1 }}>{book.pages} pages</div>
                  </div>
                ))}
                <button style={{
                  width: "100%", padding: 6, borderRadius: 4,
                  border: `1px dashed ${C.borderLight}`, background: "transparent",
                  fontSize: 11, color: C.textTertiary, cursor: "pointer",
                  marginBottom: 10,
                }}>+ Upload</button>

                <div style={{ padding: "8px 4px 4px", fontSize: 10, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                  Evidence ({ALL_EVIDENCE.length})
                </div>
                {ALL_EVIDENCE.map((item) => (
                  <EvidenceCard key={item.id} item={item} compact />
                ))}
              </>
            )}
          </div>
        </OutlineSidebar>

        <EditorArea />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   MOCK C — "Contextual": per-section evidence access
   ──────────────────────────────────────────────────────── */

function MockC() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["1", "3"]));
  const [popoverSection, setPopoverSection] = useState<string | null>("3");
  const [sourcesModalOpen, setSourcesModalOpen] = useState(false);

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const togglePopover = (id: string) => setPopoverSection(popoverSection === id ? null : id);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <MockHeader
        left={<>
          <SavedBadge />
          <HeaderPill label="Upload Sample" />
          <HeaderPill label="Voice" />
          <HeaderPill label="Sources" active={sourcesModalOpen} onClick={() => setSourcesModalOpen(!sourcesModalOpen)} />
          <HeaderPill label="Research" />
        </>}
        right={null}
      />
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        <OutlineSidebar footer={<><span>3 samples</span> &middot; <span style={{ color: C.green }}>&#9679; Voice active</span></>}>
          <SidebarSectionHeader label="Outline" />
          <div style={{ flex: 1, overflowY: "auto" as const, padding: 8 }}>
            {SECTIONS.map((s, i) => {
              const evCount = s.evidence.length;
              const isPopover = popoverSection === s.id;
              return (
                <div key={s.id} style={{ marginBottom: 2, position: "relative" }}>
                  <OutlineItem
                    section={s} idx={i}
                    isOpen={expanded.has(s.id)}
                    onToggle={() => toggle(s.id)}
                    extra={
                      <button onClick={(e) => { e.stopPropagation(); togglePopover(s.id); }} style={{
                        width: 22, height: 22, borderRadius: 4,
                        border: `1px solid ${evCount > 0 ? C.orange : C.border}`,
                        background: isPopover ? C.orangeDim : (evCount > 0 ? "rgba(255,159,10,0.06)" : "transparent"),
                        color: evCount > 0 ? C.orange : C.textTertiary,
                        fontSize: 10, fontWeight: 700, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {evCount > 0 ? evCount : "+"}
                      </button>
                    }
                  />
                  {/* Inline popover */}
                  {isPopover && (
                    <div style={{
                      margin: "2px 10px 8px 38px", padding: 10, borderRadius: 8,
                      background: C.surface, border: `1px solid ${C.border}`,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        marginBottom: 8,
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.orange, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                          Evidence
                        </span>
                        <button onClick={() => setPopoverSection(null)} style={{
                          background: "none", border: "none", color: C.textTertiary,
                          fontSize: 14, cursor: "pointer", lineHeight: 1,
                        }}>&times;</button>
                      </div>
                      {s.evidence.length > 0 ? (
                        s.evidence.map((ev) => (
                          <div key={ev.id} style={{
                            padding: "5px 8px", borderRadius: 4,
                            background: C.bg, border: `1px solid ${C.border}`,
                            marginBottom: 4,
                          }}>
                            <div style={{
                              fontSize: 10, color: C.text, lineHeight: 1.4,
                              display: "-webkit-box", WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                            }}>
                              &ldquo;{ev.text}&rdquo;
                            </div>
                            <div style={{ fontSize: 9, color: C.accent, marginTop: 2 }}>{ev.source}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 11, color: C.textTertiary, fontStyle: "italic", padding: "4px 0" }}>
                          No evidence assigned
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        <button style={{
                          flex: 1, padding: "5px 0", borderRadius: 4,
                          border: `1px solid ${C.border}`, background: "transparent",
                          color: C.textSecondary, fontSize: 10, cursor: "pointer",
                        }}>Assign Existing</button>
                        <button style={{
                          flex: 1, padding: "5px 0", borderRadius: 4,
                          border: "none", background: C.accent, color: "#fff",
                          fontSize: 10, fontWeight: 600, cursor: "pointer",
                        }}>Extract New</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </OutlineSidebar>

        <EditorArea />

        {/* Sources modal overlay (like Voice modal) */}
        {sourcesModalOpen && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50,
          }}>
            <div style={{
              width: 520, maxHeight: "80%", background: C.surface,
              borderRadius: 12, border: `1px solid ${C.border}`,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Sources</span>
                <button onClick={() => setSourcesModalOpen(false)} style={{
                  background: "none", border: "none", color: C.textTertiary,
                  fontSize: 18, cursor: "pointer", lineHeight: 1,
                }}>&times;</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto" as const, padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>
                  Textbooks ({TEXTBOOKS.length})
                </div>
                {TEXTBOOKS.map((book) => (
                  <div key={book.id} style={{
                    padding: "10px 12px", borderRadius: 6,
                    background: C.bg, border: `1px solid ${C.border}`,
                    marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{book.name}</div>
                      <div style={{ fontSize: 10, color: C.textTertiary, marginTop: 1 }}>{book.pages} pages</div>
                    </div>
                    <button style={{
                      padding: "4px 10px", borderRadius: 4, border: `1px solid ${C.border}`,
                      background: "transparent", color: C.accent, fontSize: 11,
                      cursor: "pointer", fontWeight: 500,
                    }}>Extract</button>
                  </div>
                ))}
                <button style={{
                  width: "100%", padding: 8, borderRadius: 6,
                  border: `1px dashed ${C.borderLight}`, background: "transparent",
                  fontSize: 12, color: C.textTertiary, cursor: "pointer",
                  marginBottom: 16,
                }}>+ Upload Textbook</button>

                <div style={{ fontSize: 11, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>
                  All Evidence ({ALL_EVIDENCE.length})
                </div>
                {ALL_EVIDENCE.map((item) => (
                  <EvidenceCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   PAGE — Variant switcher
   ──────────────────────────────────────────────────────── */

type Variant = "A" | "B" | "C";

const VARIANT_INFO: Record<Variant, { title: string; desc: string }> = {
  A: { title: "Sources Panel", desc: "Single \"Sources\" button opens tabbed right panel (Textbooks | Evidence)" },
  B: { title: "Outline-Integrated", desc: "Outline sidebar toggles to Sources mode; no new header buttons" },
  C: { title: "Contextual", desc: "Per-section evidence badges + Sources modal for textbook CRUD" },
};

export default function EvidenceUIMocks() {
  const [variant, setVariant] = useState<Variant>("A");

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: C.text, background: C.bg,
    }}>
      {/* Variant switcher bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 16px", background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase" as const, letterSpacing: 2 }}>
          Evidence UI Mock
        </span>
        <div style={{ width: 1, height: 16, background: C.border }} />
        {(["A", "B", "C"] as Variant[]).map((v) => (
          <button key={v} onClick={() => setVariant(v)} style={{
            padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            background: variant === v ? C.accent : "transparent",
            color: variant === v ? "#fff" : C.textSecondary,
            transition: "all 0.15s ease",
          }}>
            {v}: {VARIANT_INFO[v].title}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: C.textTertiary, maxWidth: 400 }}>
          {VARIANT_INFO[variant].desc}
        </span>
      </div>

      {/* Active variant */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {variant === "A" && <MockA />}
        {variant === "B" && <MockB />}
        {variant === "C" && <MockC />}
      </div>

      {/* Mock footer note */}
      <div style={{
        position: "fixed", bottom: 8, left: "50%", transform: "translateX(-50%)",
        fontSize: 10, color: "rgba(245,245,247,0.3)",
        background: "rgba(44,44,46,0.8)", padding: "2px 10px", borderRadius: 6,
      }}>
        Mock exploration page — data is static
      </div>
    </div>
  );
}
