import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { Badge, Btn, ErrorBox, Field, inputCls, Panel } from "../ui";
import DocsTab from "../case/DocsTab";
import TimelineTab from "../case/TimelineTab";
import TasksTab from "../case/TasksTab";
import NotesTab from "../case/NotesTab";
import ChatTab from "../case/ChatTab";
import SharePanel from "../case/SharePanel";

const TABS = ["Overview", "Documents", "Timeline", "Tasks", "Notes", "Ask", "Share"] as const;
type Tab = (typeof TABS)[number];

export default function CaseDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>(null);

  const reload = useCallback(() => {
    api(`/api/v3/cases/${id}`).then((r) => { setData(r); setError(null); }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(reload, [reload]);

  if (error && !data) return <div className="mx-auto max-w-5xl space-y-3 p-4"><ErrorBox message={error} /><Link to="/cases" className="text-sm text-indigo-700 underline">Back to cases</Link></div>;
  if (!data) return <div className="p-4 text-sm text-slate-600">Loading...</div>;

  const c = data.case;
  const save = async () => {
    try { await api(`/api/v3/cases/${id}`, { method: "PATCH", json: edit }); setEdit(null); reload(); } catch (e: any) { setError(e.message); }
  };
  const remove = async () => {
    if (!confirm("Delete this case and everything in it? This cannot be undone.")) return;
    try { await api(`/api/v3/cases/${id}`, { method: "DELETE" }); nav("/cases"); } catch (e: any) { setError(e.message); }
  };
  const nextDeadline = data.events.find((e: any) => e.kind === "deadline" && e.days_left != null && e.days_left >= 0);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Link to="/cases" className="text-sm text-indigo-700 underline">All cases</Link>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{c.title}</h1>
          <div className="mt-1 flex flex-wrap gap-2"><Badge tone="indigo">{c.case_type}</Badge><Badge tone={c.status === "closed" ? "slate" : "green"}>{c.status.replace("_", " ")}</Badge>
            {nextDeadline && <Badge tone="amber">next deadline {nextDeadline.event_date}</Badge>}</div>
        </div>
      </header>
      <ErrorBox message={error} />

      <nav className="flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-600 hover:text-slate-900"}`}>
            {t}{t === "Documents" ? ` (${data.documents.length})` : t === "Tasks" ? ` (${data.tasks.filter((x: any) => !x.done).length})` : ""}
          </button>
        ))}
      </nav>

      {tab === "Overview" && (
        <Panel title="Case details" right={!edit && <Btn variant="ghost" onClick={() => setEdit({ ...c })}>Edit</Btn>}>
          {!edit ? (
            <dl className="grid gap-1 text-sm text-slate-800">
              <div><b>Forum / authority:</b> {c.forum || "-"}</div>
              <div><b>Your side:</b> {c.your_side || "-"}</div>
              <div><b>Opposing party:</b> {c.opposing_party || "-"}</div>
              <p className="mt-2 whitespace-pre-wrap">{c.description || "No background added."}</p>
              <div className="mt-4"><Btn variant="danger" onClick={remove}>Delete case</Btn></div>
            </dl>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Title"><input className={inputCls} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
              <Field label="Type"><select className={inputCls} value={edit.case_type} onChange={(e) => setEdit({ ...edit, case_type: e.target.value })}>{data.types.map((t: string) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Status"><select className={inputCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{data.statuses.map((t: string) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</select></Field>
              <Field label="Forum / authority"><input className={inputCls} value={edit.forum} onChange={(e) => setEdit({ ...edit, forum: e.target.value })} /></Field>
              <Field label="Your side"><input className={inputCls} value={edit.your_side} onChange={(e) => setEdit({ ...edit, your_side: e.target.value })} /></Field>
              <Field label="Opposing party"><input className={inputCls} value={edit.opposing_party} onChange={(e) => setEdit({ ...edit, opposing_party: e.target.value })} /></Field>
              <div className="md:col-span-2"><Field label="Background"><textarea rows={4} className={inputCls} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field></div>
              <div className="flex gap-2"><Btn onClick={save}>Save</Btn><Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn></div>
            </div>
          )}
        </Panel>
      )}
      {tab === "Documents" && <DocsTab caseId={id!} docs={data.documents} reload={reload} />}
      {tab === "Timeline" && <TimelineTab caseId={id!} events={data.events} reload={reload} />}
      {tab === "Tasks" && <TasksTab caseId={id!} tasks={data.tasks} reload={reload} />}
      {tab === "Notes" && <NotesTab caseId={id!} notes={data.notes} reload={reload} />}
      {tab === "Ask" && <ChatTab caseId={id!} />}
      {tab === "Share" && <SharePanel caseId={id!} />}
    </div>
  );
}
