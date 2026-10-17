import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { ApiError } from "../api/client";
import { AuthShell } from "../components/AuthShell";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { question?: string } };
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await signup(email, password, fullName);
      navigate("/app/explain", { state: { question: location.state?.question } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Free to start. No credit card required.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input
            id="name"
            className="input"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-describedby="pw-hint"
          />
          <p id="pw-hint" className="mt-1 text-xs text-ink-muted">At least 8 characters.</p>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-ink-muted">
        By continuing you agree this is informational only and not legal advice.
      </p>
    </AuthShell>
  );
}
