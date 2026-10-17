import { useEffect, useState } from "react";
import { api } from "../api";
import { Badge, ErrorBox, inputCls, Panel } from "../ui";

type Row = { old_law: string; old: string; new_law: string; new: string; title: string };

export default function SectionConverter() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ rows: Row[]; note: string }>(`/api/v3/mapping?q=${encodeURIComponent(q)}`)
        .then((r) => { setRows(r.rows); setNote(r.note); setError(null); })
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-4">
      <Panel title="Old law to new law (IPC / CrPC / Evidence Act to BNS / BNSS / BSA)">
        <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls + " max-w-md"} placeholder="Type a section: 302, 498A, 420, BNSS 173, bail..." />
        <p className="mt-2 text-xs text-slate-500">Works both ways: type the old number or the new number.</p>
      </Panel>
      <ErrorBox message={error} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr><th className="px-3 py-2">Old</th><th className="px-3 py-2">New</th><th className="px-3 py-2">What it covers</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-3 py-2 whitespace-nowrap"><Badge>{r.old_law}</Badge> {r.old}</td>
                <td className="px-3 py-2 whitespace-nowrap"><Badge tone="indigo">{r.new_law}</Badge> {r.new}</td>
                <td className="px-3 py-2 text-slate-800">{r.title}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={3} className="px-3 py-4 text-slate-500">No match.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-amber-700">{note}</p>
    </div>
  );
}
