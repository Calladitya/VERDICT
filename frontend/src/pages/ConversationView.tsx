import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { ConversationDetail } from "../lib/types";
import { StructuredAnswer } from "../components/StructuredAnswer";
import { PageHeader, Spinner } from "../components/ui";

export default function ConversationView() {
  const { id } = useParams();
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    api
      .conversation(id)
      .then(setConv)
      .catch(() => setConv(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function askFollowUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const q = question.trim();
    if (!q || !id || !conv || busy) return;

    setBusy(true);
    setError("");

    try {
      await api.explain({
        question: q,
        conversation_id: id,
        jurisdiction: conv.jurisdiction,
        mode: conv.mode,
        persona: conv.persona,
        topic: conv.topic,
      });

      const updated = await api.conversation(id);
      setConv(updated);
      setQuestion("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send follow-up question.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Spinner label="Loading conversation…" />;
  }

  if (!conv) {
    return (
      <p className="text-sm text-ink-muted">
        Conversation not found.
      </p>
    );
  }

  return (
    <div>
      <Link
        to="/app/history"
        className="mb-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        ← Back to history
      </Link>

      <PageHeader
        title={conv.title}
        subtitle={`${conv.jurisdiction} · ${conv.mode} · ${conv.persona}`}
      />

      <div className="space-y-4">
        {conv.messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="card p-4 sm:p-5">
              <StructuredAnswer
                message={m}
                jurisdiction={conv.jurisdiction}
              />
            </div>
          ),
        )}

        <div className="mt-6 space-y-3">
          <form
            onSubmit={askFollowUp}
            className="card space-y-3 p-4"
          >
            <label htmlFor="follow-up" className="label">
              Ask a follow-up question
            </label>

            <textarea
              id="follow-up"
              className="input min-h-[100px] w-full"
              placeholder="Ask another question about this conversation..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={busy}
              required
              minLength={3}
              maxLength={2000}
            />

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={busy || question.trim().length < 3}
            >
              {busy ? "Generating answer..." : "Send follow-up"}
            </button>
          </form>

          <Link
            to="/app/explain"
            className="btn-primary inline-block"
          >
            Ask a new question
          </Link>
        </div>
      </div>
    </div>
  );
}
