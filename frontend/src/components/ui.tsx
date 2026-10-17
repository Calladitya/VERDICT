import type { ReactNode } from "react";
import { Alert, Shield } from "../lib/icons";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
    >
      <Shield width={compact ? 16 : 18} height={compact ? 16 : 18} className="mt-0.5 shrink-0" />
      <p>
        <span className="font-semibold">Information, not legal advice.</span> AI can make
        mistakes and laws vary by place and time. Verify against official sources and consult a
        qualified professional for high-stakes matters.
      </p>
    </div>
  );
}

const CONF: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-rose-100 text-rose-800",
};

export function ConfidenceBadge({ level }: { level: string }) {
  const l = (level || "medium").toLowerCase();
  return (
    <span className={`chip ${CONF[l] || CONF.medium}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {l.charAt(0).toUpperCase() + l.slice(1)} confidence
    </span>
  );
}

export function SourceTypeBadge({ type }: { type: string }) {
  const primary = (type || "").toLowerCase() === "primary";
  return (
    <span
      className={`chip ${primary ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"}`}
    >
      {primary ? "Primary source" : "Secondary source"}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card grid place-items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-ink-muted">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-ink-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      {label}
    </div>
  );
}

export function MockModeNotice() {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-ink-muted">
      <Alert width={15} height={15} className="mt-0.5 shrink-0" />
      <span>
        Running in <strong>offline demo mode</strong>. Answers are illustrative samples. Add an
        LLM API key in the backend <code>.env</code> for real, source-grounded explanations.
      </span>
    </div>
  );
}
