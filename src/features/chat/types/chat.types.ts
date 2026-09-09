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

/**
 * An interactive chart the assistant asked to render inline (show_chart).
 * Backend fields are snake_case (x_label / y_label); they're mapped to
 * camelCase at the SSE / history boundary in `useChat`, like ChatFile.
 */
export interface ChatChart {
  /** The model's label for the chart; not guaranteed unique within a turn. */
  id: string;
  type: 'line' | 'bar';
  title?: string;
  /** Categories / periods on the X axis (1..500 points). */
  x: (string | number)[];
  /** 1..8 series; each `values` has the same length as `x`, `null` = hueco. */
  series: { name: string; values: (number | null)[] }[];
  xLabel?: string;
  yLabel?: string;
  /** Tool that produced it (show_chart). */
  tool: string;
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
  /** Interactive charts rendered inline during the turn. */
  charts?: ChatChart[];
}

export type ChatStreamEventName =
  | 'session'
  | 'thinking'
  | 'token'
  | 'tool'
  | 'file'
  | 'chart'
  | 'usage'
  | 'done'
  | 'error';

export interface ChatStreamEvent {
  event: ChatStreamEventName;
  data: Record<string, unknown>;
}
