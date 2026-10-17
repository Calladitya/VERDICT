
import type {
  Bookmark,
  Conversation,
  ConversationDetail,
  DocumentItem,
  Message,
  ReferenceMeta,
  SearchResult,
  StructuredExplanation,
  User,
} from "../lib/types";

const BASE = import.meta.env.VITE_API_BASE || "";
const TOKEN_KEY = "lpe_token";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;

  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      0,
      "Network error — please check your connection and try again.",
    );
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers
    .get("content-type")
    ?.includes("application/json");

  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const detail =
      (body && (body.detail || body.message)) ||
      (res.status === 401
        ? "Your session has expired. Please sign in again."
        : "Request failed.");

    throw new ApiError(
      res.status,
      typeof detail === "string" ? detail : "Request failed.",
    );
  }

  return body as T;
}

// Multipart upload (no JSON content-type).
async function upload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();

  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;

  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      body: form,
      headers,
    });
  } catch {
    throw new ApiError(
      0,
      "Network error — please check your connection and try again.",
    );
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = body && (body.detail || body.message);

    const message =
      typeof detail === "string"
        ? detail
        : detail &&
            typeof detail === "object" &&
            typeof detail.message === "string"
          ? detail.message
          : res.status === 401
            ? "Your session has expired. Please sign in again."
            : "Upload failed.";

    throw new ApiError(res.status, message);
  }

  return body as T;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ExplainRequest {
  question: string;
  conversation_id?: string | null;
  jurisdiction: string;
  mode: string;
  persona: string;
  topic?: string;
  document_id?: string | null;
}

export type StreamEvent =
  | { type: "conversation"; conversation_id: string }
  | { type: "status"; message: string }
  | { type: "result"; message: Message }
  | { type: "error"; message: string };

// Chatbot request and response types
export interface ChatbotRequest {
  message: string;
  current_page: string;
}

export interface ChatbotReply {
  reply: string;
  destination: string | null;
  destination_label: string | null;
}

export const api = {
  // Auth
  signup: (email: string, password: string, full_name: string) =>
    request<Token>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name }),
    }),

  login: (email: string, password: string) =>
    request<Token>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>("/api/auth/me"),

  updateMe: (
    data: Partial<
      Pick<User, "full_name" | "persona" | "default_jurisdiction">
    >,
  ) =>
    request<User>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteMe: () => request<void>("/api/auth/me", { method: "DELETE" }),

  // Reference / meta
  meta: () => request<ReferenceMeta>("/api/reference/meta"),

  health: () =>
    request<{ mock_mode: boolean; llm_provider: string }>("/api/health"),

  disclaimer: () =>
    request<{ short: string; full: string }>("/api/disclaimer"),

  // Explain
  explain: (req: ExplainRequest) =>
    request<Message>("/api/explain", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  // Chatbot
  sendChatbotMessage: (req: ChatbotRequest) =>
    request<ChatbotReply>("/api/chatbot", {
      method: "POST",
      body: JSON.stringify(req),
    }),

  // Conversations
  conversations: (q?: string, archived = false) =>
    request<Conversation[]>(
      `/api/conversations?archived=${archived}${
        q ? `&q=${encodeURIComponent(q)}` : ""
      }`,
    ),

  conversation: (id: string) =>
    request<ConversationDetail>(`/api/conversations/${id}`),

  updateConversation: (
    id: string,
    data: { title?: string; is_archived?: boolean },
  ) =>
    request<Conversation>(`/api/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteConversation: (id: string) =>
    request<void>(`/api/conversations/${id}`, { method: "DELETE" }),

  // Documents
  documents: () => request<DocumentItem[]>("/api/documents"),

  document: (id: string) => request<DocumentItem>(`/api/documents/${id}`),

  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return upload<DocumentItem>("/api/documents", form);
  },

  deleteDocument: (id: string) =>
    request<void>(`/api/documents/${id}`, { method: "DELETE" }),

  // Bookmarks
  bookmarks: (folder?: string) =>
    request<Bookmark[]>(
      `/api/bookmarks${
        folder ? `?folder=${encodeURIComponent(folder)}` : ""
      }`,
    ),

  createBookmark: (data: {
    item_type: string;
    title: string;
    folder?: string;
    ref_id?: string;
    payload?: Record<string, unknown>;
  }) =>
    request<Bookmark>("/api/bookmarks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteBookmark: (id: string) =>
    request<void>(`/api/bookmarks/${id}`, { method: "DELETE" }),

  // Feedback
  feedback: (
    message_id: string,
    helpful: boolean,
    reason = "",
    note = "",
  ) =>
    request<{ status: string }>("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ message_id, helpful, reason, note }),
    }),

  // Search
  search: (q: string, jurisdiction = "India", topic?: string) =>
    request<SearchResult[]>(
      `/api/search?q=${encodeURIComponent(q)}&jurisdiction=${encodeURIComponent(
        jurisdiction,
      )}${topic ? `&topic=${encodeURIComponent(topic)}` : ""}`,
    ),
};

/** Send recorded audio (WAV) to the backend and get the transcript. */
export async function transcribeAudio(wav: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", wav, "voice.wav");

  const res = await upload<{ text: string }>("/api/transcribe", form);
  return res.text;
}

/**
 * Stream an explanation via SSE.
 * Uses fetch so the Authorization header can be sent.
 */
export async function streamExplain(
  req: ExplainRequest,
  onEvent: (e: StreamEvent) => void,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;

  try {
    res = await fetch(`${BASE}/api/explain/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
    });
  } catch {
    throw new ApiError(
      0,
      "Network error — please check your connection and try again.",
    );
  }

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      (body && body.detail) || "Streaming failed.",
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;

      try {
        onEvent(JSON.parse(line.slice(5).trim()) as StreamEvent);
      } catch {
        // Ignore malformed SSE chunks.
      }
    }
  }
}

export type { StructuredExplanation };
