import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { ConversationDetail } from "../lib/types";
import { StructuredAnswer } from "../components/StructuredAnswer";
import { PageHeader, Spinner } from "../components/ui";

export default function ConversationView() {
  const { id } = useParams();
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.conversation(id).then(setConv).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner label="Loading conversation…" />;
  if (!conv) return <p className="text-sm text-ink-muted">Conversation not found.</p>;

  return (
    <div>
      <Link to="/app/history" className="mb-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
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
              <StructuredAnswer message={m} jurisdiction={conv.jurisdiction} />
            </div>
          ),
        )}
      </div>
      <div className="mt-6">
        <Link to="/app/explain" className="btn-primary">Ask a new question</Link>
      </div>
    </div>
  );
}
