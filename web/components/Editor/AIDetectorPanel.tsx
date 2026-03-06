"use client";

import { useState } from "react";
import type { AIDetectionResult } from "@/lib/types";

function RiskGauge({ score, level }: { score: number; level: string }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    level === "low"
      ? "#15803d"
      : level === "medium"
        ? "#a16207"
        : "#dc2626";

  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-macos-border"
      />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${progress} ${circumference - progress}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
      />
      <text
        x="24"
        y="26"
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill={color}
      >
        {score}
      </text>
    </svg>
  );
}

function FlagCard({
  flag,
  onFix,
  hasProfile,
}: {
  flag: AIDetectionResult["flags"][number];
  onFix: (excerpt: string) => Promise<string>;
  hasProfile: boolean;
}) {
  const [fixing, setFixing] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [fixError, setFixError] = useState("");

  const severityColor =
    flag.severity === "high"
      ? "bg-red-600 text-white"
      : flag.severity === "medium"
        ? "bg-yellow-700 text-white"
        : "bg-green-700 text-white";

  const handleFix = async () => {
    if (!flag.excerpt) return;
    setFixing(true);
    setFixError("");
    try {
      await onFix(flag.excerpt);
      setFixed(true);
    } catch (e) {
      setFixError(e instanceof Error ? e.message : "Fix failed");
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className={`rounded border px-2 py-1.5 ${fixed ? "border-green-600/40 bg-green-900/10" : "border-macos-border bg-macos-elevated"}`}>
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${severityColor}`}
        >
          {flag.severity}
        </span>
        <span className="text-[11px] font-medium text-macos-text truncate flex-1">
          {flag.label}
        </span>
        {flag.excerpt && hasProfile && !fixed && (
          <button
            onClick={handleFix}
            disabled={fixing}
            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-macos-accent hover:bg-macos-accent-hover disabled:opacity-50 text-white transition-colors flex-shrink-0"
          >
            {fixing ? "Fixing..." : "Fix"}
          </button>
        )}
        {fixed && (
          <span className="text-[9px] font-medium text-green-700 flex-shrink-0">
            Fixed
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-macos-text-secondary">
        {flag.reason}
      </div>
      {flag.excerpt && !fixed && (
        <div className="mt-1 text-[11px] italic text-macos-text-secondary">
          &ldquo;{flag.excerpt}&rdquo;
        </div>
      )}
      {fixError && (
        <div className="mt-1 text-[10px] text-macos-error">{fixError}</div>
      )}
    </div>
  );
}

export default function AIDetectorPanel({
  result,
  loading,
  error,
  elapsed,
  onRunCheck,
  onFixFlag,
  hasProfile,
}: {
  result: AIDetectionResult | null;
  loading: boolean;
  error: string;
  elapsed: number;
  onRunCheck: () => void;
  onFixFlag: (excerpt: string) => Promise<string>;
  hasProfile: boolean;
}) {

  return (
    <div className="flex-1 bg-macos-surface flex flex-col overflow-hidden p-3">
      {/* Run button + gauge row */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onRunCheck}
          disabled={loading}
          className="px-3 py-1.5 rounded text-xs font-medium bg-macos-accent hover:bg-macos-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? "Checking..." : "Run Check"}
        </button>
        {loading && (
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-macos-accent" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </svg>
            <div className="flex flex-col">
              <span className="text-[11px] text-macos-text-secondary">
                Analyzing patterns... {elapsed}s
              </span>
              <span className="text-[10px] text-macos-text-secondary/60">
                Usually takes 60–90 seconds
              </span>
            </div>
          </div>
        )}
        {!loading && result && (
          <div className="flex items-center gap-2">
            <RiskGauge score={result.risk_score} level={result.risk_level} />
            <div className="flex flex-col">
              <div className="text-[11px] font-medium text-macos-text-secondary uppercase">
                {result.risk_level} Risk
              </div>
              <div className={`text-[11px] font-semibold ${
                result.verdict === "likely_human"
                  ? "text-green-500"
                  : result.verdict === "mixed"
                    ? "text-yellow-500"
                    : "text-red-500"
              }`}>
                {result.verdict === "likely_human"
                  ? "Likely Human"
                  : result.verdict === "mixed"
                    ? "Review Suggested"
                    : "Likely AI-Generated"}
              </div>
              <div className="text-[10px] text-macos-text-secondary">
                {result.confidence}% evidence strength{result.confidence < 40 && (
                  <span className="text-macos-text-secondary/60"> (limited signal)</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2 rounded bg-macos-error/10 border border-macos-error/30 text-xs text-macos-error mb-2">
          {error}
        </div>
      )}

      {/* Scrollable flags + suggestions */}
      {result && (
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {result.degraded && (
            <div className="p-2 rounded bg-yellow-700/15 border border-yellow-600/30 text-[11px] text-yellow-500">
              Detection returned partial results — scores may be unreliable. Try running again.
            </div>
          )}

          {result.profile_context_provided && result.risk_level === "low" && (
            <div className="text-[11px] text-green-500/80">
              Your writing profile was used in this analysis
            </div>
          )}

          {result.flags.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-macos-text-secondary">
                Flags: {result.flags.filter(f => f.severity === "high").length} high, {result.flags.filter(f => f.severity === "medium").length} medium, {result.flags.filter(f => f.severity === "low").length} low
              </div>
              {result.flags.map((flag) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  onFix={onFixFlag}
                  hasProfile={hasProfile}
                />
              ))}
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-macos-text-secondary">
                Suggestions
              </div>
              <ul className="list-disc pl-4 space-y-0.5">
                {result.suggestions.map((s, i) => (
                  <li
                    key={`${i}-${s.slice(0, 20)}`}
                    className="text-[11px] text-macos-text-secondary"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
