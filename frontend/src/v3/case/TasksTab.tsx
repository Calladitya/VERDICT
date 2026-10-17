import { useState } from "react";
import { api } from "../api";
import { Badge, Btn, ErrorBox, Field, inputCls, Panel } from "../ui";

type Task = { id: string; title: string; detail: string; due_date: string | null; done: boolean; source: string };

export default function TasksTab({ caseId, tasks, reload }: { caseId: string; tasks: Task[]; reload: () => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!title.trim()) return;
    try { await api(`/api/v3/cases/${caseId}/tasks`, { json: { title, due_date: due || null } }); setTitle(""); setDue(""); reload(); }
    catch (e: any) { setError(e.message); }
  };
  const toggle = async (t: Task) => { try { await api(`/api/v3/cases/${caseId}/tasks/${t.id}`, { method: "PATCH", json: { done: !t.done } }); reload(); } catch (e: any) { setError(e.message); } };
  const remove = async (id: string) => { try { await api(`/api/v3/cases/${caseId}/tasks/${id}`, { method: "DELETE" }); reload(); } catch (e: any) { setError(e.message); } };

  return (
    <div className="space-y-4">
      <Panel title="Add a task">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2"><Field label="Task"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. Collect payment receipts" /></Field></div>
          <Field label="Due date (optional)"><input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <div className="mt-3"><Btn onClick={add}>Add task</Btn></div>
        <div className="mt-2"><ErrorBox message={error} /></div>
      </Panel>
      <Panel title={`Checklist (${tasks.filter((t) => !t.done).length} open)`}>
        <ul className="space-y-2 text-sm">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-2 rounded-md border border-slate-200 p-2">
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={t.done} onChange={() => toggle(t)} />
                <span>
                  <span className={t.done ? "text-slate-400 line-through" : "font-medium text-slate-900"}>{t.title}</span>{" "}
                  {t.due_date && <Badge tone="amber">due {t.due_date}</Badge>} {t.source === "planner" && <Badge tone="indigo">from planner</Badge>}
                  {t.detail && <span className="block text-slate-600">{t.detail}</span>}
                </span>
              </label>
              <Btn variant="danger" onClick={() => remove(t.id)}>Remove</Btn>
            </li>
          ))}
          {!tasks.length && <li className="text-slate-500">No tasks yet. Use the Action planner tab to generate steps for this case.</li>}
        </ul>
      </Panel>
    </div>
  );
}
