"use client";

import { useState } from "react";

/* ─── Static mock data ─── */
const SECTIONS = [
  { id: "1", title: "Introduction", notes: "Hook the reader with a compelling question", evidence: "Smith et al. 2024", collapsed: false },
  { id: "2", title: "Historical Context", notes: "Trace the evolution of the debate", evidence: "Johnson 2023, Chapter 3", collapsed: true },
  { id: "3", title: "Core Argument", notes: "Present the central thesis with supporting evidence", evidence: "Data from field study", collapsed: false },
  { id: "4", title: "Counterarguments", notes: "Address opposing viewpoints fairly", evidence: "", collapsed: true },
  { id: "5", title: "Conclusion", notes: "Synthesize and call to action", evidence: "", collapsed: true },
];

const ESSAY_CONTENT = `The question of whether technology enhances or diminishes human creativity has occupied thinkers for decades. As artificial intelligence becomes increasingly capable of generating text, art, and music, this question takes on new urgency.

Throughout history, each technological revolution has sparked similar anxieties. The printing press, the camera, and the word processor were all initially feared as threats to authentic creative expression. Yet each ultimately expanded the boundaries of what creators could achieve.

Today's AI tools present a more complex case. Unlike previous technologies that primarily automated mechanical aspects of creation, AI systems can now engage with the conceptual and aesthetic dimensions of creative work.`;

const AI_ACTIONS = [
  { key: "outline", label: "Generate Outline", desc: "Create an outline from topic/thesis" },
  { key: "expand", label: "Expand Section", desc: "Write paragraphs for a section" },
  { key: "rephrase", label: "Rephrase", desc: "Rewrite selected text in your style" },
  { key: "humanize", label: "Humanize", desc: "Strip AI patterns from selected text" },
  { key: "score", label: "Style Score", desc: "Score text against your writing profile" },
];

/* ─── Ruled notebook lines for the editor ─── */
const ruled = {
  backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, #d4c5a9 31px, #d4c5a9 32px)",
  backgroundSize: "100% 32px",
  lineHeight: "32px",
};

export default function StationeryHybrid() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["1", "3"]));
  const [activeAI, setActiveAI] = useState("outline");

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <>
      <style>{`::selection { background: rgba(212, 184, 150, 0.4); color: inherit; }`}</style>
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "#E8DCC8",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: "#2C1F0E",
    }}>
      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px",
        background: "#FFFDF7",
        borderBottom: "2px solid #D4C5A9",
        boxShadow: "0 1px 4px rgba(139,115,85,0.08)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 6,
              background: "linear-gradient(135deg, #8B7355 0%, #A0845C 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#FFFDF7", fontSize: 13,
            }}>
              &#9998;
            </div>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700, color: "#3D2E1C" }}>
              Zora
            </span>
          </div>
          <div style={{ width: 1, height: 18, background: "#D4C5A9" }} />
          <span style={{
            fontFamily: "Georgia, serif", fontSize: 13, color: "#8B7355", fontStyle: "italic",
          }}>
            The Impact of AI on Creativity
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize: 11, color: "#7D9B76", fontWeight: 500,
            padding: "3px 10px", borderRadius: 10,
            background: "rgba(125,155,118,0.1)",
            border: "1px solid rgba(125,155,118,0.2)",
          }}>
            Saved
          </span>
          {["Upload Sample", "Samples"].map((label) => (
            <button key={label} style={{
              padding: "5px 14px", borderRadius: 8,
              border: "1px solid #D4C5A9", background: "#FFFDF7",
              color: "#5C4A32", fontSize: 12, cursor: "pointer",
              fontWeight: 500,
            }}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Outline Sidebar (from B) ── */}
        <aside style={{
          width: 240, flexShrink: 0, display: "flex", flexDirection: "column",
          background: "#FFFDF7",
          borderRight: "1px solid #D4C5A9",
        }}>
          <div style={{
            padding: "12px 16px 8px", fontSize: 10, fontWeight: 700,
            textTransform: "uppercase" as const, letterSpacing: 3, color: "#A0845C",
            borderBottom: "1px solid #E8DCC8",
          }}>
            Outline
          </div>

          <div style={{ flex: 1, overflowY: "auto" as const, padding: 8 }}>
            {SECTIONS.map((section, idx) => {
              const isOpen = expandedSections.has(section.id);
              return (
                <div key={section.id} style={{ marginBottom: 2 }}>
                  <div
                    onClick={() => toggleSection(section.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", cursor: "pointer",
                      borderRadius: 6, transition: "background 0.15s ease",
                      background: isOpen ? "#FBF5EC" : "transparent",
                    }}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: isOpen ? "#8B7355" : "#E8DCC8",
                      color: isOpen ? "#FFFDF7" : "#8B7355",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{
                      flex: 1, fontSize: 13, fontWeight: 600,
                      fontFamily: "Georgia, serif", color: "#3D2E1C",
                    }}>
                      {section.title}
                    </span>
                    <span style={{
                      fontSize: 8, color: "#A0845C",
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s ease",
                    }}>
                      &#9660;
                    </span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: "2px 10px 10px 38px" }}>
                      <div style={{
                        width: "100%", border: "1px solid #E8DCC8", borderRadius: 4,
                        padding: 6, fontSize: 11, color: "#5C4A32",
                        background: "#FFFDF7", lineHeight: 1.5,
                      }}>
                        {section.notes}
                      </div>
                      {section.evidence && (
                        <div style={{
                          marginTop: 4, fontSize: 10, color: "#A0845C",
                          fontStyle: "italic", paddingLeft: 2,
                        }}>
                          {section.evidence}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ padding: 8, borderTop: "1px solid #E8DCC8" }}>
            <button style={{
              width: "100%", padding: 8, borderRadius: 6,
              border: "1px dashed #C4A882", background: "transparent",
              fontSize: 12, color: "#A0845C", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Add Section
            </button>
          </div>

          <div style={{
            padding: "8px 14px", borderTop: "1px solid #E8DCC8",
            fontSize: 11, color: "#8B7355", display: "flex", justifyContent: "space-between",
          }}>
            <span>3 samples</span>
            <span style={{ color: "#7D9B76" }}>&#9679; Voice active</span>
          </div>
        </aside>

        {/* ── Editor Center (paper from A) ── */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: "#E8DCC8",
        }}>
          {/* Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 1,
            padding: "6px 14px",
            background: "#FFFDF7",
            borderBottom: "1px solid #E8DCC8",
            boxShadow: "0 1px 3px rgba(139,115,85,0.06)",
          }}>
            {[
              { label: "B", s: { fontWeight: 700 } },
              { label: "I", s: { fontStyle: "italic" as const } },
              { label: "U", s: { textDecoration: "underline" } },
            ].map(({ label, s }) => (
              <button key={label} style={{
                padding: "4px 10px", borderRadius: 4, border: "none",
                background: "transparent", color: "#5C4A32",
                fontSize: 13, cursor: "pointer", ...s,
              }}>
                {label}
              </button>
            ))}
            <div style={{ width: 1, height: 16, background: "#D4C5A9", margin: "0 6px" }} />
            {["H1", "H2", "H3"].map((h) => (
              <button key={h} style={{
                padding: "4px 8px", borderRadius: 4, border: "none",
                background: "transparent", color: "#8B7355",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                fontFamily: "Georgia, serif",
              }}>
                {h}
              </button>
            ))}
            <div style={{ width: 1, height: 16, background: "#D4C5A9", margin: "0 6px" }} />
            {["List", "Numbered", "Quote"].map((t) => (
              <button key={t} style={{
                padding: "4px 8px", borderRadius: 4, border: "none",
                background: "transparent", color: "#8B7355",
                fontSize: 11, cursor: "pointer",
              }}>
                {t}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button style={{
              padding: "5px 14px", borderRadius: 6, border: "none",
              background: "#7D9B76", color: "#FFFDF7",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
              boxShadow: "0 2px 6px rgba(125,155,118,0.25)",
            }}>
              <span>&#10024;</span> AI Assistant
            </button>
          </div>

          {/* Paper writing area */}
          <div style={{
            flex: 1, overflowY: "auto" as const,
            display: "flex", justifyContent: "center",
            padding: "24px 16px",
          }}>
            <div style={{
              width: "100%", maxWidth: 820, minHeight: 500,
              background: "#FFFDF7",
              borderRadius: 3,
              boxShadow: "0 2px 16px rgba(139,115,85,0.15), 0 0 0 1px rgba(139,115,85,0.08)",
              padding: "40px 56px",
              position: "relative",
            }}>
              <h1 style={{
                fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 700,
                color: "#2C1F0E", margin: "0 0 12px 0", lineHeight: 1.3,
              }}>
                The Impact of AI on Creativity
              </h1>
              <h2 style={{
                fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 600,
                color: "#5C4A32", margin: "24px 0 8px 0", lineHeight: 1.3,
              }}>
                Introduction
              </h2>
              {ESSAY_CONTENT.split("\n\n").map((para, i) => (
                <p key={i} style={{
                  fontSize: 15, color: "#3D2E1C", margin: "0 0 16px 0",
                  lineHeight: 1.7, fontFamily: "Georgia, serif",
                }}>
                  {para}
                </p>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 18px",
            background: "#FFFDF7",
            borderTop: "1px solid #E8DCC8",
            fontSize: 11, color: "#A0845C",
          }}>
            <span style={{ fontFamily: "Georgia, serif" }}>&#9998; Draft</span>
            <span>247 words</span>
          </div>
        </div>

        {/* ── AI Panel (from B) ── */}
        <aside style={{
          width: 270, flexShrink: 0, display: "flex", flexDirection: "column",
          background: "#FFFDF7",
          borderLeft: "1px solid #D4C5A9",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px 8px", borderBottom: "1px solid #E8DCC8",
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
              letterSpacing: 3, color: "#7D9B76",
            }}>
              &#10024; AI Assistant
            </span>
            <button style={{
              background: "none", border: "none", color: "#A0845C",
              fontSize: 16, cursor: "pointer", lineHeight: 1,
            }}>
              &times;
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto" as const, padding: 12 }}>
            {AI_ACTIONS.map((a) => (
              <div
                key={a.key}
                onClick={() => setActiveAI(a.key)}
                style={{
                  padding: "8px 10px", borderRadius: 6, marginBottom: 3,
                  cursor: "pointer", transition: "all 0.15s ease",
                  background: activeAI === a.key ? "rgba(125,155,118,0.06)" : "transparent",
                  borderLeft: activeAI === a.key ? "3px solid #7D9B76" : "3px solid transparent",
                }}
              >
                <div style={{
                  fontSize: 12, fontWeight: 600, fontFamily: "Georgia, serif",
                  color: activeAI === a.key ? "#5C7A56" : "#5C4A32",
                }}>
                  {a.label}
                </div>
                <div style={{ fontSize: 10, color: "#A0845C", marginTop: 1 }}>{a.desc}</div>
              </div>
            ))}

            <div style={{ margin: "10px 0" }}>
              <button style={{
                width: "100%", padding: 10, borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #7D9B76 0%, #5C7A56 100%)",
                color: "#FFFDF7", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "Georgia, serif",
                boxShadow: "0 3px 10px rgba(125,155,118,0.3)",
              }}>
                Generate
              </button>
            </div>

            <div style={{
              padding: 10, borderRadius: 8,
              background: "linear-gradient(135deg, #F5EDE0 0%, #FBF5EC 100%)",
              fontSize: 12, color: "#5C4A32", lineHeight: 1.6,
              fontFamily: "Georgia, serif",
              border: "1px solid #E8DCC8",
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: "#7D9B76", marginBottom: 4,
                textTransform: "uppercase" as const, letterSpacing: 1,
              }}>
                Result
              </div>
              Outline generated and applied! 5 sections created based on your topic and writing style.
            </div>
          </div>
        </aside>
      </div>

      {/* Mock footer note */}
      <div style={{
        position: "fixed", bottom: 8, left: "50%", transform: "translateX(-50%)",
        fontSize: 10, color: "rgba(92,74,50,0.4)",
        background: "rgba(255,253,247,0.8)", padding: "2px 10px", borderRadius: 6,
      }}>
        Mock exploration page — data is static.
      </div>
    </div>
    </>
  );
}
