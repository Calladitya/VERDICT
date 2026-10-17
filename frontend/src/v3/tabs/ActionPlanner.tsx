import { useState } from "react";
import { api } from "../api";
import { Badge, Btn, CasePicker, DISCLAIMER, ErrorBox, Field, inputCls, List, Panel, SpeakButton, Spinner, Urgency } from "../ui";

type Plan = {
  summary?: string; urgency?: string;
  steps?: { title: string; detail: string; due_in_days: number | null }[];
  documents_to_collect?: string[]; authorities?: string[]; warnings?: string[]; when_to_see_a_lawyer?: string;
};

export default function ActionPlanner({ language }: { language: string }) {
  const [situation, setSituation] = useState("");
  const [caseId, setCaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const run = async () => {
    setError(null); setPlan(null); setSaved(null); setChecked({});
    if (situation.trim().length < 10) { setError("Describe your situation in a few sentences."); return; }
    setBusy(true);
    try {
      const r = await api<{ result: Plan; emergency: boolean; saved?: { tasks: unknown[] } | null }>("/api/v3/planner", { json: { situation, language, case_id: caseId || null } });
      setPlan(r.result); setEmergency(r.emergency); setSaved(r.saved ? r.saved.tasks.length : null);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Panel title="Tell us what happened">
        <div className="space-y-3">
          <Field label="Your situation" hint="Who, what, when, where, and what you want. Do not include Aadhaar, bank or card numbers.">
            <textarea rows={6} value={situation} onChange={(e) => setSituation(e.target.value)} className={inputCls} placeholder="e.g. My landlord is refusing to return my Rs 40,000 deposit although I vacated on 1 September." />
          </Field>
          <CasePicker value={caseId} onChange={setCaseId} label="Add the steps as tasks to a case (optional)" />
          <div className="flex items-center gap-3"><Btn onClick={run} disabled={busy}>Make my action plan</Btn>{busy && <Spinner />}</div>
          <ErrorBox message={error} />
        </div>
      </Panel>

      {emergency && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          If you or someone else is in immediate danger, call <strong>112</strong> now. Women Helpline: <strong>181</strong>. Cyber fraud: <strong>1930</strong>.
        </div>
      )}

      {plan && (
        <Panel title="Your plan" right={<div className="flex items-center gap-2"><Urgency level={plan.urgency} /><SpeakButton text={[plan.summary, ...(plan.steps || []).map((s) => s.title + ". " + s.detail)].join(". ")} language={language} /></div>}>
          <div className="space-y-4 text-sm text-slate-800">
            <p>{plan.summary}</p>
            <ol className="space-y-2">
              {(plan.steps || []).map((s, i) => (
                <li key={i} className="flex gap-3 rounded-md border border-slate-200 p-2">
                  <input type="checkbox" className="mt-1" checked={!!checked[i]} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} aria-label={`Done: ${s.title}`} />
                  <div>
                    <div className={`font-medium ${checked[i] ? "line-through text-slate-400" : ""}`}>{s.title}</div>
                    <div className="text-slate-700">{s.detail}</div>
                    {s.due_in_days != null && <Badge tone="amber">within {s.due_in_days} days</Badge>}
                  </div>
                </li>
              ))}
            </ol>
            {plan.documents_to_collect && plan.documents_to_collect.length > 0 && <div><h4 className="mb-1 font-medium">Documents to collect</h4><List items={plan.documents_to_collect} /></div>}
            {plan.authorities && plan.authorities.length > 0 && <div><h4 className="mb-1 font-medium">Where to go</h4><List items={plan.authorities} /></div>}
            {plan.warnings && plan.warnings.length > 0 && <div><h4 className="mb-1 font-medium">Be careful</h4><List items={plan.warnings} /></div>}
            {plan.when_to_see_a_lawyer && <p><span className="font-medium">See a lawyer when:</span> {plan.when_to_see_a_lawyer}</p>}
            {saved != null && <p className="rounded-md bg-green-50 p-2 text-green-800">{saved} task(s) added to your case.</p>}
            <p className="text-xs text-slate-500">{DISCLAIMER}</p>
          </div>
        </Panel>
      )}
    </div>
  );
}
