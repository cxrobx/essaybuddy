"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const FIELDS_OF_STUDY = [
  "Computer Science", "Medicine", "Biology", "Physics", "Chemistry",
  "Mathematics", "Psychology", "Economics", "Political Science",
  "Sociology", "Environmental Science", "Engineering", "History",
  "Philosophy", "Linguistics", "Education", "Business", "Law",
  "Geography", "Art",
];

export default function SearchBar({
  onSearch,
  loading,
}: {
  onSearch: (query: string, filters: { year_min?: number; year_max?: number; fields_of_study?: string }) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [field, setField] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  const triggerSearch = useCallback(
    (q: string, yMin: string, yMax: string, f: string) => {
      if (!q.trim()) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(q.trim(), {
          year_min: yMin ? parseInt(yMin) : undefined,
          year_max: yMax ? parseInt(yMax) : undefined,
          fields_of_study: f || undefined,
        });
      }, 300);
    },
    [onSearch]
  );

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    triggerSearch(val, yearMin, yearMax, field);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim()) {
      onSearch(query.trim(), {
        year_min: yearMin ? parseInt(yearMin) : undefined,
        year_max: yearMax ? parseInt(yearMax) : undefined,
        fields_of_study: field || undefined,
      });
    }
  };

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search papers..."
          className="flex-1 bg-macos-bg text-xs text-macos-text rounded px-2.5 py-1.5 outline-none border border-macos-border focus:border-macos-accent placeholder:text-macos-text-secondary/50"
        />
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`px-2 py-1.5 rounded text-[11px] border transition-colors ${
            showFilters ? "border-macos-accent text-macos-accent" : "border-macos-border text-macos-text-secondary hover:text-macos-text"
          }`}
        >
          Filters
        </button>
      </form>
      {showFilters && (
        <div className="flex gap-1.5 flex-wrap">
          <input
            type="number"
            value={yearMin}
            onChange={(e) => { setYearMin(e.target.value); triggerSearch(query, e.target.value, yearMax, field); }}
            placeholder="From year"
            className="w-20 bg-macos-bg text-[11px] text-macos-text rounded px-2 py-1 outline-none border border-macos-border focus:border-macos-accent"
          />
          <input
            type="number"
            value={yearMax}
            onChange={(e) => { setYearMax(e.target.value); triggerSearch(query, yearMin, e.target.value, field); }}
            placeholder="To year"
            className="w-20 bg-macos-bg text-[11px] text-macos-text rounded px-2 py-1 outline-none border border-macos-border focus:border-macos-accent"
          />
          <select
            value={field}
            onChange={(e) => { setField(e.target.value); triggerSearch(query, yearMin, yearMax, e.target.value); }}
            className="flex-1 min-w-[120px] bg-macos-bg text-[11px] text-macos-text rounded px-2 py-1 outline-none border border-macos-border"
          >
            <option value="">All fields</option>
            {FIELDS_OF_STUDY.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
