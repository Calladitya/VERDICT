import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { Brand } from "../components/Brand";
import {
  ArrowRight,
  Chat,
  Doc,
  Search,
  Shield,
  Check,
} from "../lib/icons";

const FEATURES = [
  { icon: Chat, title: "AI Legal Explainer", body: "Ask a question in plain English and get a structured answer: what the law says, how it applies, your rights, and next steps." },
  { icon: Doc, title: "Document analysis", body: "Upload a contract, notice, or policy. Get a clause-by-clause plain-English breakdown with risk flags." },
  { icon: Shield, title: "Source citations", body: "Every answer separates what the source says from AI interpretation, with links to official documents." },
  { icon: Search, title: "Jurisdiction-aware", body: "Answers tuned to your country and state — India-first, so you get local context, not generic advice." },
];

const STEPS = [
  { n: "1", title: "Ask", body: "Type a question or upload a document. Pick your jurisdiction and who you are." },
  { n: "2", title: "Analyze", body: "We find relevant provisions and official sources, then interpret them." },
  { n: "3", title: "Understand", body: "Read a clear explanation of your rights, obligations, deadlines, and risks." },
  { n: "4", title: "Act", body: "Get practical next steps, save the answer, export it, or ask a follow-up." },
];

const FAQ = [
  { q: "Is this legal advice?", a: "No. This platform gives general information generated with AI assistance and curated sources. It is not a substitute for a qualified lawyer. For high-stakes matters, always consult a professional." },
  { q: "Which laws does it cover?", a: "The demo is India-first, with a curated set of well-known laws (tenancy, employment, consumer, cheque bounce, GST, data protection, RTI and more) plus a jurisdiction selector. Production deployments plug in a full legal corpus via RAG." },
  { q: "How does it stay accurate?", a: "The architecture is built for Retrieval-Augmented Generation: answers are grounded in retrieved sources with citations, and the UI clearly separates 'source says' from 'AI interpretation'." },
  { q: "Is my document data private?", a: "Documents are tied to your account, and you can delete them or your whole account at any time. The reference build includes security headers, hashed passwords, and rate limiting; production adds encryption at rest and PII controls." },
];

const EXAMPLES = [
  "My landlord says I have to leave within 7 days. Is that legal?",
  "What does Section 138 of the Negotiable Instruments Act mean?",
  "My employer terminated me without notice — what are my options?",
  "Explain this termination clause in my contract.",
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ex, setEx] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setInterval(() => setEx((e) => (e + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(t);
  }, []);

  const start = () => {
    if (user) {
      navigate("/app/explain", { state: { question: q } });
    } else {
      navigate("/signup", { state: { question: q } });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center">
            <Brand size={28} />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-soft md:flex">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/app" className="btn-primary">Open app</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Log in</Link>
                <Link to="/signup" className="btn-primary">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50/70 to-white" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="chip mx-auto mb-5 w-fit bg-brand-50 text-brand-700">
            <Shield width={14} height={14} /> Backed by sources you can verify
          </span>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
            Understand the law.
            <br />
            <span className="text-brand-600">Without the jargon.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-muted">
            Turn complex legal, regulatory, and policy information into clear, actionable
            explanations — what it means, what to do, and where to verify it.
          </p>

          <div className="mx-auto mt-8 max-w-2xl">
            <div className="card flex flex-col gap-2 p-2 sm:flex-row">
              <input
                className="input border-0 focus:ring-0"
                placeholder={EXAMPLES[ex]}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && start()}
                aria-label="Ask a legal question"
              />
              <button className="btn-primary shrink-0" onClick={start}>
                Explain <ArrowRight width={16} height={16} />
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              Try: “{EXAMPLES[ex]}”
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold tracking-tight text-ink">How it works</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-ink-muted">
          Ask → Analyze → Understand → Act. The complete loop, in one place.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                {s.n}
              </span>
              <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
            Everything you need to make sense of the rules
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="card flex gap-4 p-6">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <f.icon width={22} height={22} />
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{f.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example structured answer */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-ink">
              Not a chatbot. A structured explanation.
            </h2>
            <p className="mt-3 text-ink-muted">
              Instead of a wall of text, every answer is broken into the parts that actually
              matter to you — with a clear line between what the source says and how the AI
              interprets it.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-ink-soft">
              {["Short answer first", "What the law says + how it applies", "Your rights, obligations & deadlines", "Practical next steps and sources"].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check width={18} height={18} className="text-accent-600" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="card overflow-hidden">
            <div className="bg-brand-600 p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-100">Short answer</p>
              <p className="mt-1 text-sm">
                A 7-day eviction notice is generally not enough. Tenancy law usually requires proper
                notice and due process before you can be made to leave.
              </p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {[
                ["Your rights", "Right to reasonable notice and due process."],
                ["Your obligations", "Pay rent due and follow the lease terms."],
                ["Next steps", "Ask for written notice; check your state Rent Act."],
                ["Source", "Model Tenancy Act, 2021 · India"],
              ].map(([h, b]) => (
                <div key={h} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{h}</p>
                  <p className="mt-1 text-sm text-ink-soft">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-ink">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="card group p-5">
                <summary className="cursor-pointer list-none font-semibold text-ink marker:content-none">
                  <span className="flex items-center justify-between">
                    {f.q}
                    <span className="text-brand-500 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-ink-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="card overflow-hidden bg-brand-600 p-10 text-center text-white">
          <h2 className="text-3xl font-bold">Start understanding the law today</h2>
          <p className="mx-auto mt-2 max-w-xl text-brand-100">
            Free to try. No credit card. Your first explanation is one question away.
          </p>
          <Link
            to={user ? "/app/explain" : "/signup"}
            className="btn mt-6 bg-white text-brand-700 hover:bg-brand-50"
          >
            {user ? "Open the app" : "Create free account"} <ArrowRight width={16} height={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:px-6">
          <Brand size={26} />
          <p className="max-w-md text-center text-xs sm:text-right">
            Information only — not legal advice. Verify against official sources and consult a
            qualified professional for high-stakes matters.
          </p>
        </div>
      </footer>
    </div>
  );
}
