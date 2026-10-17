import { useEffect, useState } from "react";
import { api, download } from "../api";
import { Badge, Btn, ErrorBox, Panel } from "../ui";

type Share = { token: string; expires_at: string; include_notes: boolean; active: boolean };

export default function SharePanel({ caseId }: { caseId: string }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [days, setDays] = useState(7);
  const [notes, setNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => api<{ shares: Share[] }>(`/api/v3/cases/${caseId}/shares`).then((r) => setShares(r.shares)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = (t: string) => `${window.location.origin}/shared/${t}`;
  const create = async () => {
    setError(null);
    try { await api(`/api/v3/cases/${caseId}/share`, { json: { days, include_notes: notes } }); load(); } catch (e: any) { setError(e.message); }
  };
  const revoke = async (t: string) => { try { await api(`/api/v3/cases/${caseId}/share/${t}`, { method: "DELETE" }); load(); } catch (e: any) { setError(e.message); } };
  const copy = async (t: string) => { await navigator.clipboard.writeText(link(t)); setCopied(t); setTimeout(() => setCopied(null), 1500); };

  return (
    <div className="space-y-4">
      <Panel title="Case summary for a lawyer">
        <p className="mb-3 text-sm text-slate-600">One document with case details, deadlines, timeline, tasks and the list of documents.</p>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => download(`/api/v3/cases/${caseId}/export?format=pdf`, "case-summary.pdf").catch((e) => setError(e.message))}>Download PDF</Btn>
          <Btn variant="ghost" onClick={() => download(`/api/v3/cases/${caseId}/export?format=docx`, "case-summary.docx").catch((e) => setError(e.message))}>Download Word</Btn>
        </div>
      </Panel>
      <Panel title="Read-only share link">
        <p className="mb-3 text-sm text-slate-600">Anyone with the link can view the summary without logging in. Document contents are never shared, only their names.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-700">Expires after
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-2 rounded-md border border-slate-300 px-2 py-1">
              <option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} /> Include my notes</label>
          <Btn onClick={create}>Create link</Btn>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {shares.map((s) => (
            <li key={s.token} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-2">
              <span className="break-all">{s.active ? link(s.token) : <span className="text-slate-400 line-through">{link(s.token)}</span>}{" "}
                <Badge tone={s.active ? "green" : "slate"}>{s.active ? `until ${new Date(s.expires_at + "Z").toLocaleDateString()}` : "expired / revoked"}</Badge></span>
              {s.active && <span className="flex gap-2"><Btn variant="ghost" onClick={() => copy(s.token)}>{copied === s.token ? "Copied" : "Copy"}</Btn><Btn variant="danger" onClick={() => revoke(s.token)}>Revoke</Btn></span>}
            </li>
          ))}
          {!shares.length && <li className="text-slate-500">No links created yet.</li>}
        </ul>
        <div className="mt-2"><ErrorBox message={error} /></div>
      </Panel>
    </div>
  );
}
