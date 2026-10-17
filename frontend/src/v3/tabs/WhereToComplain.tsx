import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, DISCLAIMER, ErrorBox, inputCls, Panel } from "../ui";

type Item = { id: string; name: string; issues: string[]; states: string[]; what: string; helpline: string; website: string; how_to: string; last_verified: string | null };

export default function WhereToComplain() {
  const [items, setItems] = useState<Item[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [issue, setIssue] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams();
    if (issue) p.set("issue", issue);
    if (q) p.set("q", q);
    api<{ items: Item[]; issues: string[] }>(`/api/v3/resources?${p.toString()}`)
      .then((r) => { setItems(r.items); if (!issues.length) setIssues(r.issues); setError(null); })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (bank, police, refund...)" className={inputCls + " max-w-sm"} />
        <select value={issue} onChange={(e) => setIssue(e.target.value)} className={inputCls + " max-w-xs"}>
          <option value="">All issues</option>
          {issues.map((i) => <option key={i}>{i}</option>)}
        </select>
      </div>
      <ErrorBox message={error} />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((it) => (
          <Panel key={it.id} title={it.name}>
            <div className="space-y-2 text-sm text-slate-800">
              <div className="flex flex-wrap gap-1">{it.issues.map((x) => <Badge key={x} tone="indigo">{x}</Badge>)}</div>
              <p>{it.what}</p>
              {it.helpline && <p><span className="font-medium">Helpline:</span> <a className="text-indigo-700 underline" href={`tel:${it.helpline.replace(/[^0-9+]/g, "")}`}>{it.helpline}</a></p>}
              {it.website && <p><span className="font-medium">Website:</span> <a className="break-all text-indigo-700 underline" href={it.website} target="_blank" rel="noreferrer">{it.website}</a></p>}
              <p><span className="font-medium">How:</span> {it.how_to}</p>
              <p>{it.last_verified ? <Badge tone="green">last verified {it.last_verified}</Badge> : <Badge tone="amber">not yet verified - check before use</Badge>}</p>
            </div>
          </Panel>
        ))}
      </div>
      {!items.length && !error && <p className="text-sm text-slate-500">Nothing found. Try a different search.</p>}
      <p className="text-xs text-slate-500">State and district offices differ. Add your state's entries in backend/app/v3/data/resources.json. {DISCLAIMER}</p>
    </div>
  );
}
