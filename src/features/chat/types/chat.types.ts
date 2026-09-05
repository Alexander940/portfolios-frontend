/**
 * Chat feature types — mirror the backend SSE contract at
 * POST /api/v1/chat/messages/stream.
 */

export type ChatRole = 'user' | 'assistant';

export type ToolStatus = 'running' | 'done' | 'error';

/** User-facing model choice. Mapped to a model id server-side.
 * 'fable' = Claude Fable 5, el modelo más capaz (precio superior a Opus). */
export type ChatModelId = 'fable' | 'opus' | 'sonnet' | 'haiku';

/** One data-tool call surfaced by the agentic loop (e.g. screen_stocks). */
export interface ToolActivity {
  name: string;
  status: ToolStatus;
  rowCount?: number;
  ticker?: string;
}

/**
 * A file produced by the assistant during a turn (PDF / DOCX / XLSX).
 * Backend fields are snake_case; they're mapped to camelCase at the SSE /
 * history boundary in `useChat`.
 */
export interface ChatFile {
  fileId: string;
  filename: string;
  /**
   * Absolute API path, e.g. "/api/v1/chat/files/{file_id}" — it already
   * includes the API prefix, so it must be resolved against the axios
   * baseURL's own prefix before requesting (see `downloadChatFile`).
   */
  url: string;
  mediaType: string;
  sizeBytes: number;
  /** Tool that generated it (create_document, export_screener_xlsx, ...). */
  tool: string;
  /** ISO timestamp; the backend keeps files for 7 days. */
  expiresAt?: string;
}

export interface ChatUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** User text, or the assistant's streamed markdown answer. */
  content: string;
  time: string;
  tools?: ToolActivity[];
  /** Assistant is reasoning and hasn't emitted any text yet. */
  thinking?: boolean;
  streaming?: boolean;
  error?: string;
  usage?: ChatUsage;
  /** Downloadable files generated during the turn. */
  files?: ChatFile[];
}

export type ChatStreamEventName =
  | 'session'
  | 'thinking'
  | 'token'
  | 'tool'
  | 'file'
  | 'usage'
  | 'done'
  | 'error';

export interface ChatStreamEvent {
  event: ChatStreamEventName;
  data: Record<string, unknown>;
}
