import { ReactNode, useEffect, useState } from "react";

export const LANGUAGES: { label: string; value: string; voice: string }[] = [
  { label: "English", value: "English", voice: "en-IN" },
  { label: "हिन्दी (Hindi)", value: "Hindi", voice: "hi-IN" },
  { label: "Hinglish", value: "Hinglish", voice: "en-IN" },
  { label: "বাংলা (Bengali)", value: "Bengali", voice: "bn-IN" },
  { label: "मराठी (Marathi)", value: "Marathi", voice: "mr-IN" },
  { label: "தமிழ் (Tamil)", value: "Tamil", voice: "ta-IN" },
  { label: "తెలుగు (Telugu)", value: "Telugu", voice: "te-IN" },
  { label: "ગુજરાતી (Gujarati)", value: "Gujarati", voice: "gu-IN" },
  { label: "ಕನ್ನಡ (Kannada)", value: "Kannada", voice: "kn-IN" },
  { label: "മലയാളം (Malayalam)", value: "Malayalam", voice: "ml-IN" },
  { label: "ਪੰਜਾਬੀ (Punjabi)", value: "Punjabi", voice: "pa-IN" },
];

export function voiceFor(language: string): string {
  return LANGUAGES.find((l) => l.value === language)?.voice || "en-IN";
}

export function LangSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
      Answer language
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Panel({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  className?: string;
};

export function Btn({ children, onClick, disabled, variant = "primary", type = "button", className = "" }: BtnProps) {
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    ghost: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </div>
  );
}

export function Spinner({ label = "Working..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      {label}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "red" | "amber" | "green" | "indigo" }) {
  const t = {
    slate: "bg-slate-100 text-slate-700",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-green-100 text-green-800",
    indigo: "bg-indigo-100 text-indigo-800",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

// Voice output using the browser's built-in text-to-speech (free, no backend).
export function SpeakButton({ text, language = "English" }: { text: string; language?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  if (!supported) return null;
  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceFor(language);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  return (
    <Btn variant="ghost" onClick={toggle}>
      {speaking ? "Stop" : "Listen"}
    </Btn>
  );
}

export function Urgency({ level }: { level?: string }) {
  if (!level) return null;
  const tone = level === "high" ? "red" : level === "medium" ? "amber" : "green";
  return <Badge tone={tone}>{level} urgency</Badge>;
}

export function List({ items }: { items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

export const DISCLAIMER = "General legal information, not legal advice. Check important details with a lawyer or the official source.";

export function useCases() {
  const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    import("./api").then(({ api }) =>
      api<{ cases: { id: string; title: string }[] }>("/api/v3/cases")
        .then((r) => setCases(r.cases))
        .catch(() => setCases([]))
    );
  }, []);
  return cases;
}

export function CasePicker({ value, onChange, label = "Save to case (optional)" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const cases = useCases();
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">Do not save</option>
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </Field>
  );
}
