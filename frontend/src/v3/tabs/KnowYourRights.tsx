import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Badge, DISCLAIMER, ErrorBox, inputCls, Panel, SpeakButton } from "../ui";

type Card = {
  id: string; topic: string; title: string; summary: string; points: string[]; act: string;
  source_name: string; source_url: string; last_verified: string | null;
};

export default function KnowYourRights({ language }: { language: string }) {
  const [items, setItems] = useState<Card[]>([]);
  const [topic, setTopic] = useState("All");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Card[] }>("/api/v3/rights").then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }, []);

  const topics = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.topic)))], [items]);
  const shown = items.filter(
    (i) => (topic === "All" || i.topic === topic) && (!q || (i.title + i.summary + i.points.join(" ")).toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rights, e.g. FIR, deposit, refund" className={inputCls + " max-w-sm"} />
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className={inputCls + " max-w-xs"}>
          {topics.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <ErrorBox message={error} />
      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((c) => (
          <Panel key={c.id} title={c.title} right={<SpeakButton text={`${c.title}. ${c.summary}. ${c.points.join(". ")}`} language={language === "English" ? "English" : language} />}>
            <div className="space-y-2 text-sm text-slate-800">
              <Badge tone="indigo">{c.topic}</Badge>
              <p>{c.summary}</p>
              <ul className="list-disc space-y-1 pl-5">{c.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
              <p className="text-xs text-slate-500">Law: {c.act}</p>
              <p className="text-xs">
                Source: <a className="text-indigo-700 underline" href={c.source_url} target="_blank" rel="noreferrer">{c.source_name}</a>
                {" "}{c.last_verified ? <Badge tone="green">verified {c.last_verified}</Badge> : <Badge tone="amber">not yet verified</Badge>}
              </p>
            </div>
          </Panel>
        ))}
      </div>
      {!shown.length && !error && <p className="text-sm text-slate-500">No matching rights card.</p>}
      <p className="text-xs text-slate-500">These cards are written in English. Use the Sourced answer or Notice tabs for answers in your language. {DISCLAIMER}</p>
    </div>
  );
}
