import { useState } from "react";
import { api } from "../api";
import { Badge, Btn, ErrorBox, Panel, Spinner } from "../ui";

type Doc = { id: string; filename: string; kind: string; chars: number };

export default function DocsTab({ caseId, docs, reload }: { caseId: string; docs: Doc[]; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<{ filename: string; text: string } | null>(null);

  const upload = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try { await api(`/api/v3/cases/${caseId}/documents`, { form }); reload(); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const open = async (id: string) => {
    try { setView(await api(`/api/v3/cases/${caseId}/documents/${id}`)); } catch (e: any) { setError(e.message); }
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this document from the case?")) return;
    try { await api(`/api/v3/cases/${caseId}/documents/${id}`, { method: "DELETE" }); reload(); } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <Panel title="Add a document">
        <input type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp" disabled={busy} onChange={(e) => { upload(e.target.files?.[0] || null); e.target.value = ""; }}
          className="block text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700" />
        {busy && <div className="mt-2"><Spinner label="Reading the file..." /></div>}
        <p className="mt-2 text-xs text-slate-500">PDF, DOCX, TXT or photo (max 10 MB). The text is extracted so the case chat can use it.</p>
        <div className="mt-2"><ErrorBox message={error} /></div>
      </Panel>
      <Panel title={`Documents (${docs.length})`}>
        <ul className="divide-y divide-slate-100 text-sm">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-medium text-slate-900">{d.filename} <Badge>{d.kind}</Badge> <span className="text-xs text-slate-500">{d.chars.toLocaleString()} chars</span></span>
              <span className="flex gap-2"><Btn variant="ghost" onClick={() => open(d.id)}>View text</Btn><Btn variant="danger" onClick={() => remove(d.id)}>Delete</Btn></span>
            </li>
          ))}
          {!docs.length && <li className="py-2 text-slate-500">No documents yet.</li>}
        </ul>
      </Panel>
      {view && (
        <Panel title={view.filename} right={<Btn variant="ghost" onClick={() => setView(null)}>Close</Btn>}>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs text-slate-800">{view.text}</pre>
        </Panel>
      )}
    </div>
  );
}
