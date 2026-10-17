// Tiny API client for the v3 features. Independent of your existing src/api code.
//
// TOKEN: it auto-detects your login token in sessionStorage/localStorage.
// If detection fails, set TOKEN_KEY below to the exact storage key your app uses
// (DevTools -> Application -> Session Storage).

export const TOKEN_KEY: string | null = null;

const BASE: string = (
  (import.meta as any).env?.VITE_API_URL ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.VITE_BACKEND_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

function pickToken(raw: string): string | null {
  const v = raw.trim().replace(/^"|"$/g, "");
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(v)) return v; // JWT
  try {
    const obj = JSON.parse(raw);
    const stack: any[] = [obj];
    while (stack.length) {
      const cur = stack.pop();
      if (cur && typeof cur === "object") {
        for (const [k, val] of Object.entries(cur)) {
          if (typeof val === "string" && /token/i.test(k) && val.length > 20) return val;
          if (val && typeof val === "object") stack.push(val);
        }
      }
    }
  } catch {
    /* not JSON */
  }
  return null;
}

export function getToken(): string | null {
  for (const store of [sessionStorage, localStorage]) {
    if (TOKEN_KEY) {
      const raw = store.getItem(TOKEN_KEY);
      if (raw) return pickToken(raw) || raw;
      continue;
    }
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (!k) continue;
      const raw = store.getItem(k);
      if (!raw) continue;
      if (/token|auth|jwt|verdict/i.test(k)) {
        const t = pickToken(raw);
        if (t) return t;
      }
    }
  }
  return null;
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function errorFrom(res: Response): Promise<Error> {
  let msg = `Request failed (${res.status})`;
  try {
    const j = await res.json();
    if (typeof j?.detail === "string") msg = j.detail;
    else if (Array.isArray(j?.detail) && j.detail[0]?.msg) msg = j.detail.map((d: any) => d.msg).join("; ");
  } catch {
    /* ignore */
  }
  if (res.status === 401) msg = "Please log in again.";
  return new Error(msg);
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; json?: unknown; form?: FormData; auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = opts.auth === false ? {} : authHeaders();
  let body: BodyInit | undefined;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    body = opts.form;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: opts.method || (body ? "POST" : "GET"), headers, body });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

async function saveBlob(res: Response, filename: string) {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function download(path: string, filename: string, json?: unknown, auth = true) {
  const headers: Record<string, string> = auth ? authHeaders() : {};
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method: json !== undefined ? "POST" : "GET",
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  if (!res.ok) throw await errorFrom(res);
  await saveBlob(res, filename);
}

export const apiBase = BASE;
