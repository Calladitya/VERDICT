import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import type { Bookmark, Conversation, DocumentItem, SearchResult } from "../lib/types";
import { PageHeader } from "../components/ui";
import { ArrowRight, Bookmark as BookmarkIcon, Chat, Doc, History, Search } from "../lib/icons";

function StatCard({ label, value, to }: { label: string; value: number | string; to: string }) {
  return (
    <Link to={to} className="card p-5 transition hover:shadow-lg">
      <p className="text-3xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
    </Link>
  );
}

const QUICK = [
  { to: "/app/explain", label: "Ask a question", icon: Chat },
  { to: "/app/documents", label: "Analyze a document", icon: Doc },
  { to: "/app/search", label: "Search the law", icon: Search },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [saved, setSaved] = useState<Bookmark[]>([]);
  const [feed, setFeed] = useState<SearchResult[]>([]);

  useEffect(() => {
    api.conversations().then(setConvs).catch(() => {});
    api.documents().then(setDocs).catch(() => {});
    api.bookmarks().then(setSaved).catch(() => {});
    api.search("", user?.default_jurisdiction || "India").then((r) => setFeed(r.slice(0, 5))).catch(() => {});
  }, [user]);

  const firstName = (user?.full_name || "there").split(" ")[0];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's your legal & policy workspace."
        action={
          <Link to="/app/explain" className="btn-primary">
            New question <ArrowRight width={16} height={16} />
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Conversations" value={convs.length} to="/app/history" />
        <StatCard label="Documents analyzed" value={docs.length} to="/app/documents" />
        <StatCard label="Saved items" value={saved.length} to="/app/saved" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {QUICK.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="card flex items-center gap-3 p-4 transition hover:shadow-lg">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Icon width={20} height={20} />
            </span>
            <span className="font-semibold text-ink">{label}</span>
            <ArrowRight width={16} height={16} className="ml-auto text-ink-muted" />
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent conversations */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <History width={18} height={18} /> Recent questions
            </h2>
            <Link to="/app/history" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          {convs.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">
              No questions yet.{" "}
              <Link to="/app/explain" className="font-semibold text-brand-600">Ask your first one.</Link>
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {convs.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`/app/history/${c.id}`} className="block py-2.5 hover:bg-slate-50">
                    <p className="truncate text-sm font-medium text-ink">{c.title}</p>
                    <p className="text-xs text-ink-muted">
                      {c.jurisdiction} · {new Date(c.updated_at).toLocaleDateString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Legal feed */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <BookmarkIcon width={18} height={18} /> For you — key laws
            </h2>
            <Link to="/app/search" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              Browse
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {feed.map((f, i) => (
              <li key={i} className="py-2.5">
                <p className="truncate text-sm font-medium text-ink">{f.title}</p>
                <p className="truncate text-xs text-ink-muted">{f.authority} · {f.topic}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
