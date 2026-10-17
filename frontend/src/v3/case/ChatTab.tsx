import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Btn, ErrorBox, inputCls, LangSelect, Panel, SpeakButton, Spinner } from "../ui";

type Msg = { id?: string; role: "user" | "assistant"; content: string };

const QUICK = ["Summarise this case in simple words", "What are my next deadlines?", "What documents am I missing?"];

export default function ChatTab({ caseId }: { caseId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("English");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ messages: Msg[] }>(`/api/v3/cases/${caseId}/chat`).then((r) => setMsgs(r.messages)).catch((e) => setError(e.message));
  }, [caseId]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async (message: string) => {
    if (!message.trim() || busy) return;
    setError(null);
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setText("");
    setBusy(true);
    try {
      const r = await api<{ answer: string }>(`/api/v3/cases/${caseId}/chat`, { json: { message, language } });
      setMsgs((m) => [...m, { role: "assistant", content: r.answer }]);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const clear = async () => {
    if (!confirm("Clear this chat?")) return;
    try { await api(`/api/v3/cases/${caseId}/chat`, { method: "DELETE" }); setMsgs([]); } catch (e: any) { setError(e.message); }
  };

  return (
    <Panel title="Ask about this case" right={<div className="flex items-center gap-2"><LangSelect value={language} onChange={setLanguage} /><Btn variant="ghost" onClick={clear}>Clear</Btn></div>}>
      <p className="mb-3 text-xs text-slate-500">Answers come only from this case's details, documents, notes and timeline.</p>
      <div className="mb-3 max-h-[28rem] space-y-3 overflow-y-auto rounded-md bg-slate-50 p-3">
        {!msgs.length && <p className="text-sm text-slate-500">Try one of the suggestions below.</p>}
        {msgs.map((m, i) => (
          <div key={m.id || i} className={m.role === "user" ? "text-right" : ""}>
            <div className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm ${m.role === "user" ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>{m.content}</div>
            {m.role === "assistant" && <div className="mt-1"><SpeakButton text={m.content} language={language} /></div>}
          </div>
        ))}
        {busy && <Spinner label="Thinking..." />}
        <div ref={end} />
      </div>
      <div className="mb-2 flex flex-wrap gap-2">{QUICK.map((q) => <Btn key={q} variant="ghost" onClick={() => send(q)} disabled={busy}>{q}</Btn>)}</div>
      <div className="flex gap-2">
        <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(text)} placeholder="Ask a question about this case" />
        <Btn onClick={() => send(text)} disabled={busy}>Send</Btn>
      </div>
      <div className="mt-2"><ErrorBox message={error} /></div>
    </Panel>
  );
}
