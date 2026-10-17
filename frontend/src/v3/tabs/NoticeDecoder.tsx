import { useState } from "react";
import { api } from "../api";
import { Badge, Btn, CasePicker, DISCLAIMER, ErrorBox, Field, inputCls, List, Panel, SpeakButton, Spinner, Urgency } from "../ui";

type Decoded = {
  filename: string;
  method: string;
  result: {
    notice_type?: string;
    sender?: string;
    summary?: string;
    key_points?: string[];
    deadlines?: { label: string; date: string | null; days_from_receipt: number | null; consequence: string }[];
    what_to_do?: string[];
    documents_to_gather?: string[];
    risks?: string[];
    urgency?: string;
    questions_for_lawyer?: string[];
  };
  saved?: { case_id: string; events_added: number } | null;
};

export default function NoticeDecoder({ language }: { language: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [caseId, setCaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Decoded | null>(null);

  const run = async () => {
    setError(null);
    setData(null);
    if (!file && !text.trim()) {
      setError("Upload a notice (PDF, DOCX, TXT, photo) or paste its text.");
      return;
    }
    const form = new FormData();
    if (file) form.append("file", file);
    form.append("text", text);
    form.append("language", language);
    form.append("case_id", caseId);
    setBusy(true);
    try {
      setData(await api<Decoded>("/api/v3/notice/decode", { form }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const r = data?.result;
  const speakText = r ? [r.summary, ...(r.what_to_do || [])].filter(Boolean).join(". ") : "";

  return (
    <div className="space-y-4">
      <Panel title="Decode a notice">
        <div className="space-y-3">
          <Field label="Upload notice" hint="PDF, DOCX, TXT or a clear photo (JPG/PNG). Max 10 MB.">
            <input
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700"
            />
          </Field>
          <Field label="...or paste the text">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className={inputCls} placeholder="Paste the notice here" />
          </Field>
          <CasePicker value={caseId} onChange={setCaseId} label="Save notice and deadlines to a case (optional)" />
          <div className="flex items-center gap-3">
            <Btn onClick={run} disabled={busy}>Explain this notice</Btn>
            {busy && <Spinner label="Reading the notice..." />}
          </div>
          <ErrorBox message={error} />
          <p className="text-xs text-slate-500">Do not upload documents you are not allowed to share. {DISCLAIMER}</p>
        </div>
      </Panel>

      {r && (
        <Panel
          title={r.notice_type || "Notice explained"}
          right={
            <div className="flex items-center gap-2">
              <Urgency level={r.urgency} />
              <SpeakButton text={speakText} language={language} />
            </div>
          }
        >
          <div className="space-y-4 text-sm text-slate-800">
            {r.sender && (
              <p>
                <span className="font-medium">From:</span> {r.sender}
              </p>
            )}
            <p>{r.summary}</p>
            {r.key_points && r.key_points.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium">Key points</h4>
                <List items={r.key_points} />
              </div>
            )}
            {r.deadlines && r.deadlines.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium">Deadlines</h4>
                <ul className="space-y-2">
                  {r.deadlines.map((d, i) => (
                    <li key={i} className="rounded-md border border-amber-200 bg-amber-50 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{d.label}</span>
                        {d.date && <Badge tone="amber">{d.date}</Badge>}
                        {!d.date && d.days_from_receipt != null && <Badge tone="amber">{d.days_from_receipt} days from receipt</Badge>}
                      </div>
                      {d.consequence && <p className="mt-1 text-slate-700">If missed: {d.consequence}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.what_to_do && r.what_to_do.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium">What to do</h4>
                <ol className="list-decimal space-y-1 pl-5">
                  {r.what_to_do.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ol>
              </div>
            )}
            {r.documents_to_gather && r.documents_to_gather.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium">Documents to gather</h4>
                <List items={r.documents_to_gather} />
              </div>
            )}
            {r.risks && r.risks.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium">Risks</h4>
                <List items={r.risks} />
              </div>
            )}
            {r.questions_for_lawyer && r.questions_for_lawyer.length > 0 && (
              <div>
                <h4 className="mb-1 font-medium">Questions to ask a lawyer</h4>
                <List items={r.questions_for_lawyer} />
              </div>
            )}
            {data?.saved && (
              <p className="rounded-md bg-green-50 p-2 text-green-800">
                Saved to your case. {data.saved.events_added} deadline(s) added to the timeline.
              </p>
            )}
            <p className="text-xs text-slate-500">
              Read via: {data?.method}. {DISCLAIMER}
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
