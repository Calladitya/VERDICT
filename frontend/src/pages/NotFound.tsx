import { Link } from "react-router-dom";
import { LogoMark } from "../components/Brand";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 text-center">
      <div>
        <LogoMark size={44} className="mx-auto mb-4 text-brand-800" />
        <p className="text-5xl font-extrabold text-ink">404</p>
        <p className="mt-2 text-ink-muted">We couldn't find that page.</p>
        <Link to="/" className="btn-primary mt-6">Back to home</Link>
      </div>
    </div>
  );
}
