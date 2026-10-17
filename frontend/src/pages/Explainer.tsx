import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, streamExplain, transcribeAudio, type ExplainRequest } from "../api/client";
import { useAuth } from "../store/auth";
import { useToast } from "../store/toast";
import { useVoiceInput } from "../hooks/useVoiceInput";
import type { DocumentItem, Message, ReferenceMeta } from "../lib/types";
import { StructuredAnswer } from "../components/StructuredAnswer";
import { DisclaimerBanner, MockModeNotice, PageHeader } from "../components/ui";
import { ArrowRight, Chat } from "../lib/icons";

const SAMPLE_QUESTIONS = [
  "My landlord says I must vacate in 7 days. Is that legal?",
  "What does Section 138 of the Negotiable Instruments Act mean?",
  "I was terminated without notice — what are my options?",
  "Is my employer allowed to withhold my final salary?",
];

function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}

function StopIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export default function Explainer() {
  const { user } = useAuth();
  const { push } = useToast();
  const location = useLocation() as { state?: { question?: string } };

  const [meta, setMeta] = useState<ReferenceMeta | null>(null);
  const [mock, setMock] = useState(false);
  const [docs, setDocs] = useState<DocumentItem[]>([]);

  const [question, setQuestion] = useState(location.state?.question || "");
  const [jurisdiction, setJurisdiction] = useState(user?.default_jurisdiction || "India");
  const [stateSel, setStateSel] = useState("");
  const [persona, setPersona] = useState(user?.persona || "individual");
  const [mode, setMode] = useState("simple");
  const [topic, setTopic] = useState("");
  const [documentId, setDocumentId] = useState<string>("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Voice input: transcript is appended to the text box so the user can edit before sending.
  const voice = useVoiceInput({
    onText: (text) => setQuestion((prev) => (prev.trim() ? prev.trimEnd() + " " : "") + text),
    onError: (message) => push(message, "error"),
    transcribe: transcribeAudio,
  });

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
    api.health().then((h) => setMock(h.mock_mode)).catch(() => {});
    api.documents().then((d) => setDocs(d.filter((x) => x.status === "complete"))).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const effectiveJurisdiction = stateSel ? `${jurisdiction} → ${stateSel}` : jurisdiction;

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (q.length < 3 || busy) return;

    const userMsg: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: q,
      structured: null,
      created_at: new Date().toISOString(),
      citations: [],
    };
    setMessages((m) => [...m, userMsg]);
    setQuestion("");
    setBusy(true);
    setStatus("Understanding your question…");

    const req: ExplainRequest = {
      question: q,
      conversation_id: conversationId,
      jurisdiction: effectiveJurisdiction,
      mode,
      persona,
      topic,
      document_id: documentId || null,
    };

    try {
      await streamExplain(req, (ev) => {
        if (ev.type === "conversation") setConversationId(ev.conversation_id);
        else if (ev.type === "status") setStatus(ev.message);
        else if (ev.type === "result") {
          setMessages((m) => [...m, ev.message]);
          setStatus("");
        } else if (ev.type === "error") {
          push(ev.message, "error");
          setStatus("");
        }
      });
    } catch (err) {
      push(err instanceof Error ? err.message : "Something went wrong.", "error");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  const started = messages.length > 0;

  return (
    <div>
      <PageHeader
        title="AI Explainer"
        subtitle="Ask a legal or policy question and get a clear, structured, source-grounded answer."
      />

      {mock && <div className="mb-4"><MockModeNotice /></div>}

      {/* Controls */}
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="jur">Country</label>
          <select
            id="jur"
            className="input"
            value={jurisdiction}
            onChange={(e) => {
              setJurisdiction(e.target.value);
              setStateSel("");
            }}
          >
            {meta
              ? Object.keys(meta.jurisdictions).map((c) => <option key={c}>{c}</option>)
              : <option>India</option>}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="state">State / region</label>
          <select
            id="state"
            className="input"
            value={stateSel}
            onChange={(e) => setStateSel(e.target.value)}
            disabled={!meta?.jurisdictions[jurisdiction]?.states.length}
          >
            <option value="">All / not sure</option>
            {meta?.jurisdictions[jurisdiction]?.states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="persona">I am a…</label>
          <select id="persona" className="input" value={persona} onChange={(e) => setPersona(e.target.value)}>
            {(meta?.personas || [{ id: "individual", label: "Individual" }]).map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mode">Explanation style</label>
          <select id="mode" className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            {(meta?.modes || [{ id: "simple", label: "Simple", hint: "" }]).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="topic">Legal area (optional)</label>
          <select id="topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Auto-detect</option>
            {meta?.topics.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="doc">Reference an uploaded document (optional)</label>
          <select id="doc" className="input" value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
            <option value="">None</option>
            {docs.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
          </select>
        </div>
      </div>

      {/* Conversation */}
      {!started ? (
        <div className="card mb-4 p-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Chat width={24} height={24} />
          </div>
          <h3 className="font-semibold text-ink">Ask your first question</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Describe your situation in your own words, or tap the mic and speak. You can ask follow-up questions after.
          </p>
          <div className="mx-auto mt-4 flex max-w-lg flex-wrap justify-center gap-2">
            {SAMPLE_QUESTIONS.map((sq) => (
              <button
                key={sq}
                onClick={() => setQuestion(sq)}
                className="chip bg-slate-100 text-ink-soft hover:bg-slate-200"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-4 space-y-4">
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="card p-4 sm:p-5">
                <StructuredAnswer message={m} jurisdiction={effectiveJurisdiction} />
              </div>
            ),
          )}
          {status && (
            <div className="card flex items-center gap-3 p-4">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              <span className="text-sm text-ink-soft">{status}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Composer */}
      <form onSubmit={ask} className="sticky bottom-4 z-10">
        <div className="card flex items-end gap-2 p-2">
          <textarea
            className="input max-h-40 min-h-[46px] resize-none border-0 focus:ring-0"
            placeholder={
              voice.recording
                ? "Listening… tap stop when you're done"
                : voice.transcribing
                  ? "Transcribing your voice…"
                  : started
                    ? "Ask a follow-up question…"
                    : "Describe your legal or policy question…"
            }
            value={question}
            rows={1}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            aria-label="Your question"
          />
          <button
            type="button"
            onClick={voice.toggle}
            disabled={busy || voice.transcribing}
            aria-label={voice.recording ? "Stop recording" : "Speak your question"}
            title={voice.recording ? "Stop recording" : "Speak your question"}
            className={`grid h-[46px] w-[46px] shrink-0 place-items-center rounded-lg transition ${
              voice.recording
                ? "animate-pulse bg-red-100 text-red-600"
                : "text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            }`}
          >
            {voice.transcribing ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            ) : voice.recording ? (
              <StopIcon />
            ) : (
              <MicIcon />
            )}
          </button>
          <button
            type="submit"
            className="btn-primary shrink-0"
            disabled={busy || voice.recording || voice.transcribing || question.trim().length < 3}
          >
            {busy ? "Analyzing…" : "Explain"}
            {!busy && <ArrowRight width={16} height={16} />}
          </button>
        </div>
      </form>

      <div className="mt-4">
        <DisclaimerBanner compact />
      </div>
    </div>
  );
}