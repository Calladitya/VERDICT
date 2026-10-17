import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { useAuth } from "./store/auth";
import type { ReactElement } from "react";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Explainer from "./pages/Explainer";
import Documents from "./pages/Documents";
import DocumentDetail from "./pages/DocumentDetail";
import SearchPage from "./pages/SearchPage";
import HistoryPage from "./pages/HistoryPage";
import ConversationView from "./pages/ConversationView";
import Saved from "./pages/Saved";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

// VERDICT 3.0 pages
import EverydayHelp from "./v3/pages/EverydayHelp";
import Cases from "./v3/pages/Cases";
import CaseDetail from "./v3/pages/CaseDetail";
import SharedCase from "./v3/pages/SharedCase";

function Protected({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Public, read-only case summary (no login) */}
      <Route path="/shared/:token" element={<SharedCase />} />

      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/explain" element={<Explainer />} />
        <Route path="/app/documents" element={<Documents />} />
        <Route path="/app/documents/:id" element={<DocumentDetail />} />
        <Route path="/app/search" element={<SearchPage />} />
        <Route path="/app/history" element={<HistoryPage />} />
        <Route path="/app/history/:id" element={<ConversationView />} />
        <Route path="/app/saved" element={<Saved />} />
        <Route path="/app/settings" element={<SettingsPage />} />

        {/* VERDICT 3.0 */}
        <Route path="/everyday-help" element={<EverydayHelp />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}