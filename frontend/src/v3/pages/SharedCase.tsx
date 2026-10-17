// PUBLIC page (no login). Route it OUTSIDE your protected routes: /shared/:token
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { Badge, ErrorBox, Panel } from "../ui";

export default function SharedCase() {
  const { token } = useParams();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api(`/api/v3/shared/${token}`, { auth: false }).then(setD).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <div className="mx-auto max-w-3xl p-4"><ErrorBox message={error} /></div>;
  if (!d) return <div className="p-4 text-sm text-slate-600">Loading...</div>;
  const c = d.case;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{c.title}</h1>
        <p className="text-sm text-slate-600">Read-only case summary. Link expires {new Date(d.expires_at).toLocaleDateString()}.</p>
        <a className="mt-2 inline-block text-sm text-indigo-700 underline" href={`${apiBase}/api/v3/shared/${token}/pdf`}>Download PDF</a>
      </header>
      <Panel title="Details">
        <dl className="grid gap-1 text-sm text-slate-800">
          <div><b>Type:</b> {c.case_type}</div><div><b>Status:</b> {c.status}</div>
          {c.forum && <div><b>Forum:</b> {c.forum}</div>}
          {c.your_side && <div><b>Client:</b> {c.your_side}</div>}
          {c.opposing_party && <div><b>Opposing party:</b> {c.opposing_party}</div>}
          {c.description && <p className="mt-2 whitespace-pre-wrap">{c.description}</p>}
        </dl>
      </Panel>
      <Panel title="Timeline and deadlines">
        <ul className="space-y-2 text-sm">
          {d.timeline.map((e: any) => (
            <li key={e.id}><Badge tone={e.kind === "deadline" ? "amber" : "slate"}>{e.event_date || "no date"}</Badge> <b>{e.title}</b>{e.detail ? ` - ${e.detail}` : ""}</li>
          ))}
          {!d.timeline.length && <li className="text-slate-500">Nothing recorded.</li>}
        </ul>
      </Panel>
      {d.tasks.length > 0 && <Panel title="Tasks"><ul className="list-disc pl-5 text-sm">{d.tasks.map((t: any) => <li key={t.id}>{t.done ? "[done] " : ""}{t.title}{t.due_date ? ` (due ${t.due_date})` : ""}</li>)}</ul></Panel>}
      {d.documents.length > 0 && <Panel title="Documents on file"><ul className="list-disc pl-5 text-sm">{d.documents.map((x: any, i: number) => <li key={i}>{x.filename}</li>)}</ul></Panel>}
      {d.notes.length > 0 && <Panel title="Notes">{d.notes.map((n: any) => <p key={n.id} className="mb-2 whitespace-pre-wrap text-sm">{n.body}</p>)}</Panel>}
      <p className="text-xs text-slate-500">General information, not legal advice.</p>
    </div>
  );
}
