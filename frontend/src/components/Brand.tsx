import type { SVGProps } from "react";

const GREEN = "#2e9f43";

/**
 * The Verdict mark: scales of justice fused with green circuit traces.
 * Structural parts use `currentColor` so the mark inherits text color
 * (navy on light backgrounds, white on dark). The circuit stays green.
 */
export function LogoMark({
  size = 28,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Verdict"
      {...props}
    >
      {/* Finial */}
      <path d="M24 3l3 4-3 4-3-4z" fill="currentColor" />
      {/* Beam */}
      <path
        d="M9 13Q24 6 39 13"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="9" cy="13" r="1.9" fill="currentColor" />
      <circle cx="39" cy="13" r="1.9" fill="currentColor" />
      {/* Central column */}
      <rect x="21" y="12.5" width="6" height="2" rx="0.5" fill="currentColor" />
      <rect x="22.4" y="14" width="3.2" height="24" fill="currentColor" />
      <rect x="20" y="38" width="8" height="2.2" rx="0.6" fill="currentColor" />
      <rect x="17.5" y="40" width="13" height="3" rx="0.8" fill="currentColor" />
      {/* Left pan */}
      <path d="M9 13L4 24M9 13l5 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.5 24Q9 31 14.5 24Z" fill="currentColor" />
      {/* Right pan */}
      <path d="M39 13l-5 11M39 13l5 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M33.5 24Q39 31 44.5 24Z" fill="currentColor" />
      {/* Circuit traces */}
      <g stroke={GREEN} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M26 20H30V17" />
        <path d="M26 25H31.5" />
        <path d="M26 30H29.5V33" />
      </g>
      <g fill={GREEN}>
        <circle cx="30" cy="17" r="1.4" />
        <circle cx="31.5" cy="25" r="1.4" />
        <circle cx="29.5" cy="33" r="1.4" />
      </g>
    </svg>
  );
}

/**
 * Full brand lockup: mark + "VERDICT" wordmark (+ optional tagline).
 * `tone` picks text color for the surface it sits on.
 */
export function Brand({
  size = 28,
  tone = "navy",
  showTagline = false,
  wordmarkClass = "",
}: {
  size?: number;
  tone?: "navy" | "light";
  showTagline?: boolean;
  wordmarkClass?: string;
}) {
  const text = tone === "light" ? "text-white" : "text-brand-800";
  return (
    <span className={`inline-flex items-center gap-2 ${text}`}>
      <LogoMark size={size} />
      <span className="leading-none">
        <span
          className={`block font-serif font-bold uppercase tracking-[0.18em] ${wordmarkClass}`}
          style={{ fontSize: size * 0.62 }}
        >
          Verdict
        </span>
        {showTagline && (
          <span
            className={`mt-1 block text-[9px] font-medium uppercase tracking-[0.2em] ${
              tone === "light" ? "text-white/70" : "text-brand-500"
            }`}
          >
            Justice · Trust · Empowerment
          </span>
        )}
      </span>
    </span>
  );
}
