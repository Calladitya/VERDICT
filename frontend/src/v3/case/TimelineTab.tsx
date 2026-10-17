import { useState } from "react";
import { api, download } from "../api";
import { Badge, Btn, ErrorBox, Field, inputCls, Panel, Spinner } from "../ui";

type Ev = { id: string; title: string; detail: string; event_date: string | null; kind: string; source: string; days_left: number | null };

export default function TimelineTab({ caseId, events, reload }: { caseId: string; events: Ev[]; reload: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState("deadline");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    if (!title.trim()) return;
    try { await api(`/api/v3/cases/${caseId}/events`, { json: { title, date: date || null, kind } }); setTitle(""); setDate(""); reload(); }
    catch (e: any) { setError(e.message); }
  };
  const extract = async () => {
    setError(null); setMsg(null); setBusy(true);
    try { const r = await api<{ added: number }>(`/api/v3/cases/${caseId}/events/extract`, { method: "POST" }); setMsg(`${r.added} new item(s) added from your documents.`); reload(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { try { await api(`/api/v3/cases/${caseId}/events/${id}`, { method: "DELETE" }); reload(); } catch (e: any) { setError(e.message); } };

  const dated = events.filter((e) => e.event_date);
  const undated = events.filter((e) => !e.event_date);
  const tone = (e: Ev) => (e.kind !== "deadline" ? "slate" : e.days_left! < 0 ? "red" : e.days_left! <= 3 ? "red" : e.days_left! <= 14 ? "amber" : "green");

  return (
    <div className="space-y-4">
      <Panel title="Add an event or deadline">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2"><Field label="What"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reply to notice due" /></Field></div>
          <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Type"><select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}><option value="deadline">Deadline</option><option value="event">Event</option></select></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn onClick={add}>Add</Btn>
          <Btn variant="ghost" onClick={extract} disabled={busy}>Build timeline from documents (AI)</Btn>
          <Btn variant="ghost" onClick={() => download(`/api/v3/cases/${caseId}/deadlines.ics`, "case-deadlines.ics").catch((e) => setError(e.message))}>Add deadlines to calendar (.ics)</Btn>
          {busy && <Spinner label="Reading documents..." />}
        </div>
        {msg && <p className="mt-2 text-sm text-green-700">{msg}</p>}
        <div className="mt-2"><ErrorBox message={error} /></div>
      </Panel>
      <Panel title="Timeline">
        <ol className="space-y-2 text-sm">
          {[...dated, ...undated].map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-200 p-2">
              <div>
                <Badge tone={tone(e) as any}>{e.event_date || "no date"}{e.kind === "deadline" ? " - deadline" : ""}</Badge>{" "}
                <span className="font-medium text-slate-900">{e.title}</span>
                {e.source !== "manual" && <span className="ml-2 text-xs text-slate-500">({e.source === "ai" ? "from documents" : "from notice"})</span>}
                {e.detail && <p className="mt-1 text-slate-700">{e.detail}</p>}
              </div>
              <Btn variant="danger" onClick={() => remove(e.id)}>Remove</Btn>
            </li>
          ))}
          {!events.length && <li className="text-slate-500">Nothing on the timeline yet.</li>}
        </ol>
        <p className="mt-3 text-xs text-slate-500">AI-extracted dates can be wrong. Check them against the original document.</p>
      </Panel>
    </div>
  );
}
