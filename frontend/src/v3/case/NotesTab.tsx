import { useState } from "react";
import { api } from "../api";
import { Btn, ErrorBox, inputCls, Panel } from "../ui";

type Note = { id: string; body: string; created_at: string };

export default function NotesTab({ caseId, notes, reload }: { caseId: string; notes: Note[]; reload: () => void }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    if (!body.trim()) return;
    try { await api(`/api/v3/cases/${caseId}/notes`, { json: { body } }); setBody(""); reload(); } catch (e: any) { setError(e.message); }
  };
  const remove = async (id: string) => { try { await api(`/api/v3/cases/${caseId}/notes/${id}`, { method: "DELETE" }); reload(); } catch (e: any) { setError(e.message); } };
  return (
    <div className="space-y-4">
      <Panel title="Add a note">
        <textarea rows={4} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Calls made, promises, what the other side said..." />
        <div className="mt-3"><Btn onClick={add}>Save note</Btn></div>
        <div className="mt-2"><ErrorBox message={error} /></div>
      </Panel>
      <Panel title={`Notes (${notes.length})`}>
        <ul className="space-y-2 text-sm">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-slate-200 p-2">
              <p className="whitespace-pre-wrap text-slate-800">{n.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>{new Date(n.created_at + "Z").toLocaleString()}</span>
                <Btn variant="danger" onClick={() => remove(n.id)}>Delete</Btn>
              </div>
            </li>
          ))}
          {!notes.length && <li className="text-slate-500">No notes yet.</li>}
        </ul>
      </Panel>
    </div>
  );
}
