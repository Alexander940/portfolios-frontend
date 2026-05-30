/**
 * Chat feature types — mirror the backend SSE contract at
 * POST /api/v1/chat/messages/stream.
 */

export type ChatRole = 'user' | 'assistant';

export type ToolStatus = 'running' | 'done' | 'error';

/** One data-tool call surfaced by the agentic loop (e.g. screen_stocks). */
export interface ToolActivity {
  name: string;
  status: ToolStatus;
  rowCount?: number;
  ticker?: string;
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
}

export type ChatStreamEventName =
  | 'session'
  | 'thinking'
  | 'token'
  | 'tool'
  | 'usage'
  | 'done'
  | 'error';

export interface ChatStreamEvent {
  event: ChatStreamEventName;
  data: Record<string, unknown>;
}
