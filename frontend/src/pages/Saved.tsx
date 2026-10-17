import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../store/toast";
import type { Bookmark } from "../lib/types";
import { EmptyState, PageHeader } from "../components/ui";
import { Bookmark as BookmarkIcon, External, Trash } from "../lib/icons";

export default function Saved() {
  const { push } = useToast();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState("All");

  useEffect(() => {
    api.bookmarks().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const folders = useMemo(
    () => ["All", ...Array.from(new Set(items.map((i) => i.folder)))],
    [items],
  );
  const filtered = folder === "All" ? items : items.filter((i) => i.folder === folder);

  async function remove(id: string) {
    try {
      await api.deleteBookmark(id);
      setItems((x) => x.filter((i) => i.id !== id));
      push("Removed.", "success");
    } catch {
      push("Could not remove.", "error");
    }
  }

  return (
    <div>
      <PageHeader title="Saved items" subtitle="Explanations, laws, and documents you've bookmarked." />

      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {folders.map((f) => (
            <button
              key={f}
              onClick={() => setFolder(f)}
              className={`chip ${folder === f ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-soft hover:bg-slate-200"}`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookmarkIcon width={24} height={24} />}
          title="Nothing saved yet"
          description="Save an answer or a law and it will show up here, organized into folders."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const url = (b.payload as { url?: string } | null)?.url;
            return (
              <div key={b.id} className="card flex items-start gap-3 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <BookmarkIcon width={18} height={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{b.title}</p>
                  <p className="text-xs text-ink-muted">
                    {b.item_type} · {b.folder} · {new Date(b.created_at).toLocaleDateString()}
                  </p>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Open source <External width={13} height={13} />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => remove(b.id)}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove"
                >
                  <Trash width={16} height={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
