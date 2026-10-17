import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import { useToast } from "../store/toast";
import type { ReferenceMeta } from "../lib/types";
import { DisclaimerBanner, PageHeader } from "../components/ui";

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<ReferenceMeta | null>(null);

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [persona, setPersona] = useState(user?.persona || "individual");
  const [jurisdiction, setJurisdiction] = useState(user?.default_jurisdiction || "India");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateMe({
        full_name: fullName,
        persona,
        default_jurisdiction: jurisdiction,
      });
      setUser(updated);
      push("Profile updated.", "success");
    } catch {
      push("Could not save profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your account and all data permanently? This cannot be undone.")) return;
    try {
      await api.deleteMe();
      logout();
      navigate("/");
    } catch {
      push("Could not delete account.", "error");
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Manage your profile and account." />

      <form onSubmit={save} className="card space-y-4 p-6">
        <h2 className="font-semibold text-ink">Profile</h2>
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input bg-slate-50" value={user?.email} disabled />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="persona">Default persona</label>
            <select id="persona" className="input" value={persona} onChange={(e) => setPersona(e.target.value)}>
              {(meta?.personas || [{ id: "individual", label: "Individual" }]).map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="jur">Default jurisdiction</label>
            <select id="jur" className="input" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
              {meta ? Object.keys(meta.jurisdictions).map((c) => <option key={c}>{c}</option>) : <option>India</option>}
            </select>
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="mt-6">
        <DisclaimerBanner />
      </div>

      <div className="card mt-6 border border-rose-200 p-6">
        <h2 className="font-semibold text-rose-700">Danger zone</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Deleting your account permanently removes your conversations, documents, and saved items.
        </p>
        <button onClick={deleteAccount} className="btn mt-3 bg-rose-600 text-white hover:bg-rose-700">
          Delete account
        </button>
      </div>
    </div>
  );
}
