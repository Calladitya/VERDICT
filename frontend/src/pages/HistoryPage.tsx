import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../store/toast";
import type { Conversation } from "../lib/types";
import { EmptyState, PageHeader } from "../components/ui";
import { History, Search, Trash } from "../lib/icons";

export default function HistoryPage() {
  const { push } = useToast();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (query = "") =>
    api.conversations(query).then(setConvs).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function rename(c: Conversation) {
    const title = window.prompt("Rename conversation", c.title);
    if (!title) return;
    try {
      await api.updateConversation(c.id, { title });
      setConvs((cs) => cs.map((x) => (x.id === c.id ? { ...x, title } : x)));
    } catch {
      push("Could not rename.", "error");
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteConversation(id);
      setConvs((cs) => cs.filter((x) => x.id !== id));
      push("Conversation deleted.", "success");
    } catch {
      push("Could not delete.", "error");
    }
  }

  return (
    <div>
      <PageHeader title="History" subtitle="Your past questions and conversations." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="relative mb-4"
      >
        <Search width={18} height={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          className="input pl-10"
          placeholder="Search conversations…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : convs.length === 0 ? (
        <EmptyState
          icon={<History width={24} height={24} />}
          title="No conversations yet"
          description="Your questions will appear here so you can revisit and continue them."
          action={<Link to="/app/explain" className="btn-primary">Ask a question</Link>}
        />
      ) : (
        <ul className="space-y-2">
          {convs.map((c) => (
            <li key={c.id} className="card flex items-center gap-3 p-4">
              <Link to={`/app/history/${c.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink hover:text-brand-600">{c.title}</p>
                <p className="text-xs text-ink-muted">
                  {c.jurisdiction} · {c.mode} · {new Date(c.updated_at).toLocaleString()}
                </p>
              </Link>
              <button onClick={() => rename(c)} className="text-xs font-semibold text-ink-muted hover:text-ink">
                Rename
              </button>
              <button
                onClick={() => remove(c.id)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600"
                aria-label="Delete conversation"
              >
                <Trash width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
