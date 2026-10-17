import { Fragment, useEffect, useState } from "react";
import { api } from "../api";
import { Btn, DISCLAIMER, ErrorBox, inputCls, Panel, SpeakButton, Spinner } from "../ui";

type Src = { id: string; act: string; section: string; url: string; excerpt: string };
type Ans = { needs_sources: boolean; answer: string | null; sources: Src[]; emergency: boolean; message?: string };

export default function SourcedAnswer({ language }: { language: string }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Ans | null>(null);
  const [acts, setActs] = useState<string[] | null>(null);

  useEffect(() => {
    api<{ sources: { acts: string[] } }>("/api/v3/health").then((r) => setActs(r.sources.acts)).catch(() => setActs(null));
  }, []);

  const run = async () => {
    setError(null); setRes(null);
    if (q.trim().length < 3) return;
    setBusy(true);
    try { setRes(await api<Ans>("/api/v3/ask", { json: { question: q, language } })); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  // turn [S1] markers into links to the source list
  const render = (text: string) =>
    text.split(/(\[S\d+\])/g).map((part, i) => {
      const m = part.match(/^\[(S\d+)\]$/);
      return m ? <a key={i} href={`#src-${m[1]}`} className="mx-0.5 rounded bg-indigo-100 px-1 text-xs font-medium text-indigo-800 no-underline">{m[1]}</a> : <Fragment key={i}>{part}</Fragment>;
    });

  return (
    <div className="space-y-4">
      <Panel title="Ask with official sources">
        <div className="space-y-3">
          <textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} placeholder="e.g. Within how many years can I file a consumer complaint?" />
          <div className="flex items-center gap-3"><Btn onClick={run} disabled={busy}>Find answer</Btn>{busy && <Spinner label="Searching the laws..." />}</div>
          <ErrorBox message={error} />
          {acts && <p className="text-xs text-slate-500">Loaded texts: {acts.length ? acts.join("; ") : "none yet - add files to backend/legal_sources (see README there)."}</p>}
        </div>
      </Panel>

      {res?.needs_sources && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">No legal texts are loaded yet. Add .txt files to <code>backend/legal_sources/</code> and ask again.</p>}
      {res?.emergency && <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">In immediate danger? Call <strong>112</strong>.</div>}
      {res && !res.answer && !res.needs_sources && <p className="text-sm text-slate-600">{res.message || "No answer found in the loaded texts."}</p>}

      {res?.answer && (
        <Panel title="Answer" right={<SpeakButton text={res.answer.replace(/\[S\d+\]/g, "")} language={language} />}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{render(res.answer)}</p>
          <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-900">Sources used</h4>
          <ul className="space-y-2">
            {res.sources.map((s) => (
              <li key={s.id} id={`src-${s.id}`} className="rounded-md border border-slate-200 p-2 text-sm">
                <div className="font-medium">[{s.id}] {s.act} - {s.section} {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-indigo-700 underline">open source</a>}</div>
                <p className="mt-1 text-xs text-slate-600">{s.excerpt}...</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">{DISCLAIMER}</p>
        </Panel>
      )}
    </div>
  );
}
