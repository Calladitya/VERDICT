import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../store/toast";
import type { DocumentItem } from "../lib/types";
import { DisclaimerBanner, EmptyState, PageHeader } from "../components/ui";
import { Doc, Trash, Upload } from "../lib/icons";

const STAGES = ["Uploading", "Extracting text", "Analyzing", "Complete"];

function riskTone(score: number) {
  if (score >= 7) return "bg-rose-100 text-rose-700";
  if (score >= 4) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export default function Documents() {
  const { push } = useToast();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api.documents().then(setDocs).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function handleFile(file: File) {
    if (uploading) return;
    setUploading(true);
    setStage(0);
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, 2)), 700);
    try {
      await api.uploadDocument(file);
      clearInterval(timer);
      setStage(3);
      push("Document analyzed.", "success");
      await load();
    } catch (err) {
      clearInterval(timer);
      push(err instanceof ApiError ? err.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
      setTimeout(() => setStage(0), 800);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteDocument(id);
      setDocs((d) => d.filter((x) => x.id !== id));
      push("Document deleted.", "success");
    } catch {
      push("Could not delete document.", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Upload a contract, notice, or policy for a clause-by-clause, plain-English analysis."
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        }}
        className={`card mb-4 flex flex-col items-center justify-center border-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-200"
        }`}
      >
        <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Upload width={24} height={24} />
        </span>
        {uploading ? (
          <div className="w-full max-w-sm">
            <p className="text-sm font-medium text-ink">{STAGES[stage]}…</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="font-semibold text-ink">Drop your document here</p>
            <p className="mt-1 text-sm text-ink-muted">or</p>
            <button className="btn-primary mt-2" onClick={() => inputRef.current?.click()}>
              Browse files
            </button>
            <p className="mt-3 text-xs text-ink-muted">PDF · DOCX · TXT — up to 15 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      <div className="mb-4">
        <DisclaimerBanner compact />
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<Doc width={24} height={24} />}
          title="No documents yet"
          description="Upload your first document to see a risk score and clause breakdown."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <div key={d.id} className="card flex items-start gap-3 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-ink-soft">
                <Doc width={22} height={22} />
              </span>
              <div className="min-w-0 flex-1">
                <Link to={`/app/documents/${d.id}`} className="block">
                  <p className="truncate font-semibold text-ink hover:text-brand-600">{d.filename}</p>
                </Link>
                <p className="text-xs text-ink-muted">
                  {(d.size_bytes / 1024).toFixed(0)} KB · {new Date(d.created_at).toLocaleDateString()}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {d.status === "complete" ? (
                    <span className={`chip ${riskTone(d.risk_score)}`}>Risk {d.risk_score}/10</span>
                  ) : (
                    <span className="chip bg-slate-100 text-slate-600">{d.status}</span>
                  )}
                  <Link to={`/app/documents/${d.id}`} className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                    View analysis
                  </Link>
                </div>
              </div>
              <button
                onClick={() => remove(d.id)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Delete ${d.filename}`}
              >
                <Trash width={17} height={17} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
