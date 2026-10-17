
import { useState } from "react";
import type { SVGProps } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { Brand } from "./Brand";
import { Chatbot } from "./Chatbot";
import {
  Bookmark,
  Chat,
  Close,
  Doc,
  Grid,
  History,
  Menu,
  Search,
  Settings,
} from "../lib/icons";

// Everyday Help icon
function LifeBuoyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
    </svg>
  );
}

// Case Workspace icon
function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}

const NAV = [
  { to: "/app", label: "Dashboard", icon: Grid, end: true },
  { to: "/app/explain", label: "AI Explainer", icon: Chat, end: false },
  {
    to: "/everyday-help",
    label: "Everyday help",
    icon: LifeBuoyIcon,
    end: false,
  },
  {
    to: "/cases",
    label: "Case workspace",
    icon: BriefcaseIcon,
    end: false,
  },
  { to: "/app/documents", label: "Documents", icon: Doc, end: false },
  { to: "/app/search", label: "Search law", icon: Search, end: false },
  { to: "/app/history", label: "History", icon: History, end: false },
  { to: "/app/saved", label: "Saved", icon: Bookmark, end: false },
  { to: "/app/settings", label: "Settings", icon: Settings, end: false },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const initials = (user?.full_name || user?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <Link
        to="/app"
        className="flex items-center px-5 py-5"
        onClick={() => setOpen(false)}
      >
        <Brand size={28} />
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Primary">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-soft hover:bg-slate-100 hover:text-ink"
              }`
            }
          >
            <Icon width={19} height={19} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-bold text-ink-soft">
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {user?.full_name || "Account"}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {user?.email}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-muted hover:bg-slate-100 hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            {SidebarInner}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            className="btn-ghost !p-2"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <Close /> : <Menu />}
          </button>

          <Link to="/app" className="flex items-center">
            <Brand size={24} />
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Floating Verdict Guide chatbot */}
      <Chatbot />
    </div>
  );
}
