import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { DocumentItem } from "../lib/types";
import { ConfidenceBadge, DisclaimerBanner, PageHeader, Spinner } from "../components/ui";
import { Calendar, Doc } from "../lib/icons";

const RISK_COLORS: Record<string, string> = {
  red: "border-l-rose-500 bg-rose-50",
  yellow: "border-l-amber-500 bg-amber-50",
  green: "border-l-emerald-500 bg-emerald-50",
  blue: "border-l-brand-500 bg-brand-50",
};
const RISK_LABEL: Record<string, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

function RiskMeter({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "bg-rose-500" : score >= 4 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex items-end justify-between">
        <span className="text-sm font-medium text-ink-soft">Overall risk</span>
        <span className="text-2xl font-bold text-ink">{score}/10</span>
      </div>
      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-ink-muted">AI-assisted issue spotting — not a legal judgment.</p>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.document(id).then(setDoc).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner label="Loading analysis…" />;
  if (!doc) return <p className="text-sm text-ink-muted">Document not found.</p>;

  const a = doc.analysis;

  return (
    <div>
      <Link to="/app/documents" className="mb-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">
        ← Back to documents
      </Link>
      <PageHeader title={doc.filename} subtitle={a?.document_type || doc.content_type} />

      {a?.error && (
        <div className="card mb-4 border-l-4 border-l-rose-500 p-4 text-sm text-rose-700">{a.error}</div>
      )}

      {a && !a.error && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-semibold text-ink">Summary</h2>
                <ConfidenceBadge level={a.confidence} />
              </div>
              <p className="text-sm leading-relaxed text-ink-soft">{a.summary}</p>
              {a.parties?.length > 0 && (
                <p className="mt-3 text-xs text-ink-muted">
                  <span className="font-semibold text-ink-soft">Parties:</span> {a.parties.join(", ")}
                </p>
              )}
            </div>
            <div className="card p-5">
              <RiskMeter score={doc.risk_score} />
              <div className="mt-4 space-y-1.5">
                {Object.entries(a.risk_categories || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-xs capitalize text-ink-muted">{k}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${(Number(v) / 10) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs text-ink-muted">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {a.important_dates?.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 font-semibold text-ink">Important dates</h2>
              <ul className="space-y-2">
                {a.important_dates.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                    <Calendar width={16} height={16} className="mt-0.5 text-amber-600" />
                    <span><strong className="text-ink">{d.date || "TBD"}</strong> — {d.label} {d.note && <span className="text-ink-muted">({d.note})</span>}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Clauses */}
          <div>
            <h2 className="mb-3 font-semibold text-ink">Clause-by-clause breakdown</h2>
            <div className="space-y-3">
              {(a.clauses || []).map((c, i) => (
                <div key={i} className={`card border-l-4 p-4 ${RISK_COLORS[c.risk_color] || RISK_COLORS.blue}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-ink">{c.heading}</h3>
                    <span className={`chip ${RISK_LABEL[c.risk_level] || RISK_LABEL.low}`}>
                      {c.risk_level} risk
                    </span>
                  </div>
                  {c.original && (
                    <p className="mt-2 border-l-2 border-slate-300 pl-3 text-xs italic text-ink-muted">
                      “{c.original}”
                    </p>
                  )}
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px] font-bold uppercase text-ink-muted">Plain English</dt>
                      <dd className="text-ink-soft">{c.plain_english}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase text-ink-muted">What it means for you</dt>
                      <dd className="text-ink-soft">{c.what_it_means_for_you}</dd>
                    </div>
                  </dl>
                  {c.recommended_action && (
                    <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-ink-soft">
                      <span className="font-semibold text-ink">Recommended:</span> {c.recommended_action}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Obligations / penalties */}
          <div className="grid gap-4 sm:grid-cols-2">
            {a.obligations?.length > 0 && (
              <div className="card p-5">
                <h2 className="mb-2 font-semibold text-ink">Your obligations</h2>
                <ul className="list-inside list-disc space-y-1 text-sm text-ink-soft">
                  {a.obligations.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
              </div>
            )}
            {a.penalties?.length > 0 && (
              <div className="card p-5">
                <h2 className="mb-2 font-semibold text-ink">Penalties & consequences</h2>
                <ul className="list-inside list-disc space-y-1 text-sm text-ink-soft">
                  {a.penalties.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
          </div>

          {a.problematic_provisions?.length > 0 && (
            <div className="card border-l-4 border-l-rose-500 p-5">
              <h2 className="mb-2 font-semibold text-ink">Potentially problematic provisions</h2>
              <ul className="list-inside list-disc space-y-1 text-sm text-rose-700">
                {a.problematic_provisions.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          <DisclaimerBanner />
        </div>
      )}
    </div>
  );
}
