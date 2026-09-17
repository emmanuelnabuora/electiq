"use client";

import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";

type SearchResult = { id: string; name: string; kind: string; parentName: string | null };

export function PublicSearch({ electionId }: { electionId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/public/search?electionId=${electionId}&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center rounded-full bg-white shadow-lg">
        <Search className="ml-4 h-5 w-5 text-pub-text-secondary" />
        <input
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search results by county, constituency or polling station..."
          className="flex-1 rounded-full bg-transparent px-3 py-3.5 text-sm text-pub-text outline-none placeholder:text-pub-text-secondary"
        />
        <button
          type="button"
          className="m-1.5 rounded-full bg-pub-blue px-6 py-2.5 text-sm font-medium text-white"
        >
          Search
        </button>
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-pub-border bg-white shadow-lg">
          {results.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between border-b border-pub-border px-4 py-2.5 text-left text-sm last:border-0 hover:bg-pub-bg"
            >
              <span className="text-pub-text">{r.name}</span>
              <span className="text-xs capitalize text-pub-text-secondary">
                {r.kind}
                {r.parentName ? ` · ${r.parentName}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
      {open && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-10 mt-2 w-full rounded-lg border border-pub-border bg-white px-4 py-3 text-sm text-pub-text-secondary shadow-lg">
          No matches found.
        </div>
      )}
    </div>
  );
}
