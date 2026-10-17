import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../store/toast";
import type { ReferenceMeta, SearchResult } from "../lib/types";
import { EmptyState, PageHeader } from "../components/ui";
import { Bookmark, External, Search } from "../lib/icons";

export default function SearchPage() {
  const { push } = useToast();
  const [meta, setMeta] = useState<ReferenceMeta | null>(null);
  const [q, setQ] = useState("");
  const [jurisdiction, setJurisdiction] = useState("India");
  const [topic, setTopic] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
    run("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(query: string) {
    setLoading(true);
    try {
      setResults(await api.search(query, jurisdiction, topic || undefined));
      setSearched(true);
    } catch {
      push("Search failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function save(r: SearchResult) {
    try {
      await api.createBookmark({
        item_type: "law",
        title: r.title,
        folder: r.topic || "General",
        payload: { url: r.url, authority: r.authority },
      });
      push("Saved to your items.", "success");
    } catch {
      push("Could not save.", "error");
    }
  }

  return (
    <div>
      <PageHeader title="Search the law" subtitle="Browse a curated set of key laws and policies with official sources." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
        className="card mb-4 p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search width={18} height={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              className="input pl-10"
              placeholder="e.g. tenant eviction, cheque bounce, GST registration"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search laws"
            />
          </div>
          <button className="btn-primary shrink-0" type="submit">Search</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <select className="input max-w-[200px]" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
            {meta ? Object.keys(meta.jurisdictions).map((c) => <option key={c}>{c}</option>) : <option>India</option>}
          </select>
          <select className="input max-w-[200px]" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">All topics</option>
            {meta?.topics.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-ink-muted">Searching…</p>
      ) : results.length === 0 && searched ? (
        <EmptyState
          icon={<Search width={24} height={24} />}
          title="No results"
          description="Try a different keyword or broaden the topic filter."
        />
      ) : (
        <div className="space-y-3">
          {results.map((r, i) => (
            <div key={i} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-ink">{r.title}</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {r.authority} · {r.jurisdiction} · {r.topic}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.relevance > 0 && (
                    <span className="chip bg-brand-50 text-brand-700">{Math.round(r.relevance * 100)}% match</span>
                  )}
                  <button onClick={() => save(r)} className="btn-ghost !p-2" aria-label="Save">
                    <Bookmark width={16} height={16} />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{r.description}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                {r.effective_date && <span>Effective {r.effective_date}</span>}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Official source <External width={13} height={13} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
