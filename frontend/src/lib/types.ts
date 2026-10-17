export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  persona: string;
  default_jurisdiction: string;
  created_at: string;
}

export interface Citation {
  id?: string;
  title: string;
  authority: string;
  section: string;
  jurisdiction: string;
  url: string;
  source_type: string;
  confidence: string;
  published_date: string;
  effective_date: string;
}

export interface ImportantDate {
  label: string;
  date: string;
  note: string;
}

export interface StructuredExplanation {
  short_answer: string;
  what_the_law_says: string;
  how_it_applies: string;
  your_rights: string[];
  your_obligations: string[];
  if_you_dont_comply: string;
  what_to_do_next: string[];
  documents_to_collect: string[];
  important_dates: ImportantDate[];
  exceptions: string[];
  risks: string[];
  verify_with_professional: string;
  confidence: string;
  citations: Citation[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured: StructuredExplanation | null;
  created_at: string;
  citations: Citation[];
}

export interface Conversation {
  id: string;
  title: string;
  jurisdiction: string;
  topic: string;
  mode: string;
  persona: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface Clause {
  heading: string;
  original: string;
  plain_english: string;
  what_it_means_for_you: string;
  risk_level: string;
  risk_color: string;
  recommended_action: string;
}

export interface DocumentAnalysis {
  summary: string;
  document_type: string;
  parties: string[];
  overall_risk: number;
  risk_categories: Record<string, number>;
  clauses: Clause[];
  important_dates: ImportantDate[];
  obligations: string[];
  penalties: string[];
  definitions: { term: string; meaning: string }[];
  problematic_provisions: string[];
  confidence: string;
  error?: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: string;
  risk_score: number;
  analysis: DocumentAnalysis | null;
  created_at: string;
}

export interface Bookmark {
  id: string;
  item_type: string;
  title: string;
  folder: string;
  ref_id: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface SearchResult {
  title: string;
  description: string;
  jurisdiction: string;
  authority: string;
  section: string;
  topic: string;
  url: string;
  published_date: string;
  effective_date: string;
  relevance: number;
}

export interface ReferenceMeta {
  jurisdictions: Record<string, { states: string[] }>;
  topics: string[];
  modes: { id: string; label: string; hint: string }[];
  personas: { id: string; label: string }[];
}
