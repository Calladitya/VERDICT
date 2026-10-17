import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, download } from "../api";
import { Badge, Btn, ErrorBox, Field, inputCls, Panel } from "../ui";

type CaseRow = {
  id: string; title: string; case_type: string; status: string; open_tasks: number; documents: number;
  next_deadline: { title: string; event_date: string; days_left: number } | null;
};
type Deadline = { id: string; title: string; event_date: string; days_left: number; case_id: string; case_title: string };

export default function Cases() {
  const nav = useNavigate();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", case_type: "other", forum: "", your_side: "", opposing_party: "", description: "" });
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    api<{ cases: CaseRow[]; types: string[] }>("/api/v3/cases").then((r) => { setCases(r.cases); setTypes(r.types); }).catch((e) => setError(e.message));
    api<{ deadlines: Deadline[] }>("/api/v3/deadlines").then((r) => setDeadlines(r.deadlines)).catch(() => {});
  };
  useEffect(load, []);

  const create = async () => {
    setError(null);
    if (form.title.trim().length < 2) { setError("Give the case a title."); return; }
    try {
      const c = await api<{ id: string }>("/api/v3/cases", { json: form });
      nav(`/cases/${c.id}`);
    } catch (e: any) { setError(e.message); }
  };

  const tone = (d: number) => (d < 0 ? "red" : d <= 3 ? "red" : d <= 14 ? "amber" : "green");
  const label = (d: number) => (d < 0 ? `${-d} days overdue` : d === 0 ? "today" : `in ${d} days`);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Case workspace</h1>
          <p className="text-sm text-slate-600">Keep documents, notes, deadlines and questions for each case in one place.</p>
        </div>
        <Btn onClick={() => setShowForm(!showForm)}>{showForm ? "Close" : "New case"}</Btn>
      </header>
      <ErrorBox message={error} />

      {showForm && (
        <Panel title="New case">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Title *"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Phone refund dispute" /></Field>
            <Field label="Type"><select className={inputCls} value={form.case_type} onChange={(e) => setForm({ ...form, case_type: e.target.value })}>{types.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Court / authority / forum"><input className={inputCls} value={form.forum} onChange={(e) => setForm({ ...form, forum: e.target.value })} /></Field>
            <Field label="Your side (name)"><input className={inputCls} value={form.your_side} onChange={(e) => setForm({ ...form, your_side: e.target.value })} /></Field>
            <Field label="Opposing party"><input className={inputCls} value={form.opposing_party} onChange={(e) => setForm({ ...form, opposing_party: e.target.value })} /></Field>
            <div className="md:col-span-2"><Field label="Short background"><textarea rows={3} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          </div>
          <div className="mt-3"><Btn onClick={create}>Create case</Btn></div>
        </Panel>
      )}

      <Panel title="Upcoming deadlines" right={<Btn variant="ghost" onClick={() => download("/api/v3/deadlines.ics", "verdict-deadlines.ics").catch((e) => setError(e.message))}>Add to calendar (.ics)</Btn>}>
        {deadlines.length === 0 ? (
          <p className="text-sm text-slate-500">No deadlines yet. Deadlines found in notices or added to a case appear here.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {deadlines.slice(0, 8).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={tone(d.days_left) as any}>{d.event_date} ({label(d.days_left)})</Badge>
                <span className="font-medium text-slate-900">{d.title}</span>
                <Link className="text-indigo-700 underline" to={`/cases/${d.case_id}`}>{d.case_title}</Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {cases.map((c) => (
          <Link key={c.id} to={`/cases/${c.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{c.title}</h3>
              <Badge tone={c.status === "closed" ? "slate" : "green"}>{c.status.replace("_", " ")}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">{c.case_type} - {c.documents} document(s) - {c.open_tasks} open task(s)</p>
            {c.next_deadline && <p className="mt-2 text-sm text-amber-800">Next deadline: {c.next_deadline.title} ({c.next_deadline.event_date})</p>}
          </Link>
        ))}
      </div>
      {cases.length === 0 && !error && <p className="text-sm text-slate-500">No cases yet. Create one to start.</p>}
    </div>
  );
}
