import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Brand } from "./Brand";
import { Shield } from "../lib/icons";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-brand-600 p-10 text-white lg:flex">
        <Link to="/" className="flex items-center">
          <Brand size={30} tone="light" showTagline />
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            Understand laws, policies, and documents in plain language.
          </h2>
          <p className="mt-4 max-w-md text-brand-100">
            Structured, source-grounded explanations that tell you what the rules mean, what to do,
            and where to verify.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-brand-50">
            {["Plain-language answers", "Clause-by-clause document analysis", "Sources & citations you can check"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Shield width={16} height={16} /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-100">Information only — not legal advice.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-6 flex items-center lg:hidden">
            <Brand size={26} />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
