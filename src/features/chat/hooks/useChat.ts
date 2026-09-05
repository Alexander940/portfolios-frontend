import { useCallback, useEffect, useRef, useState } from 'react';
import { streamMessage } from '../services/chatService';
import type { ChatMessageRecord, ChatSessionDetail } from '../services/chatService';
import type {
  ChatChart,
  ChatFile,
  ChatMessage,
  ChatModelId,
  ToolActivity,
  ToolStatus,
} from '../types';

/**
 * useChat — owns the active conversation and drives the streaming agentic
 * turn. Supports continuing/loading a persisted session, starting a fresh
 * one, and notifying the caller when a turn completes (to refresh history).
 */

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Map one file payload (snake_case, from the `file` SSE event, the `done`
 * event's `files[]`, or a persisted `tool_calls[].file`) into a ChatFile.
 * Returns null for anything that isn't a usable file object.
 */
function toChatFile(raw: unknown, toolName?: string): ChatFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  const fileId = typeof f.file_id === 'string' ? f.file_id : '';
  const url = typeof f.url === 'string' ? f.url : '';
  if (!fileId || !url) return null;
  return {
    fileId,
    filename: typeof f.filename === 'string' ? f.filename : 'archivo',
    url,
    mediaType: typeof f.media_type === 'string' ? f.media_type : '',
    sizeBytes: typeof f.size_bytes === 'number' ? f.size_bytes : 0,
    tool: typeof f.tool === 'string' ? f.tool : (toolName ?? ''),
    expiresAt: typeof f.expires_at === 'string' ? f.expires_at : undefined,
  };
}

/** Append files to a message, skipping ids that are already there. */
function mergeFiles(
  current: ChatFile[] | undefined,
  incoming: ChatFile[],
): ChatFile[] {
  const merged = [...(current ?? [])];
  for (const f of incoming) {
    if (!merged.some((x) => x.fileId === f.fileId)) merged.push(f);
  }
  return merged;
}

/** Rehydrate the file cards of a reloaded session from its tool_calls audit. */
function mapToolFiles(
  toolCalls: Array<Record<string, unknown>> | null,
): ChatFile[] | undefined {
  if (!toolCalls || toolCalls.length === 0) return undefined;
  const files: ChatFile[] = [];
  for (const t of toolCalls) {
    const f = toChatFile(t.file, typeof t.name === 'string' ? t.name : undefined);
    if (f) files.push(f);
  }
  const merged = mergeFiles(undefined, files);
  return merged.length > 0 ? merged : undefined;
}

/** Normalize one X-axis category: finite numbers stay numeric, the rest is text. */
function toChartX(v: unknown): string | number {
  return typeof v === 'number' && Number.isFinite(v) ? v : String(v ?? '');
}

/**
 * Map one chart payload (snake_case, from the `chart` SSE event, the `done`
 * event's `charts[]`, or a persisted `tool_calls[].chart`) into a ChatChart.
 * Returns null for anything that isn't renderable: no id, no categories, or
 * no usable series. Series values are padded/truncated to the length of `x`
 * so the card never has to defend itself against a ragged payload.
 */
function toChatChart(raw: unknown, toolName?: string): ChatChart | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;

  const id = typeof c.id === 'string' ? c.id : '';
  if (!id) return null;

  if (!Array.isArray(c.x) || c.x.length === 0) return null;
  const x = (c.x as unknown[]).map(toChartX);

  if (!Array.isArray(c.series) || c.series.length === 0) return null;
  const rawSeries = c.series as unknown[];
  const series: ChatChart['series'] = [];
  for (let i = 0; i < rawSeries.length; i += 1) {
    const entry = rawSeries[i];
    if (!entry || typeof entry !== 'object') continue;
    const se = entry as Record<string, unknown>;
    if (!Array.isArray(se.values)) continue;
    const values = se.values as unknown[];
    series.push({
      name: typeof se.name === 'string' && se.name ? se.name : `Serie ${i + 1}`,
      values: x.map((_, j) => {
        const v = values[j];
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
      }),
    });
  }
  if (series.length === 0) return null;

  return {
    id,
    type: c.type === 'bar' ? 'bar' : 'line',
    title: typeof c.title === 'string' && c.title ? c.title : undefined,
    x,
    series,
    xLabel: typeof c.x_label === 'string' && c.x_label ? c.x_label : undefined,
    yLabel: typeof c.y_label === 'string' && c.y_label ? c.y_label : undefined,
    tool: typeof c.tool === 'string' ? c.tool : (toolName ?? ''),
  };
}

/**
 * Rehydrate the charts of a reloaded session from its tool_calls audit — one
 * entry per `show_chart` call, in call order. Nothing is deduped: the id is
 * the model's label, not a key, and two calls that happen to reuse one are
 * still two charts the user asked for.
 */
function mapToolCharts(
  toolCalls: Array<Record<string, unknown>> | null,
): ChatChart[] | undefined {
  if (!toolCalls || toolCalls.length === 0) return undefined;
  const charts: ChatChart[] = [];
  for (const t of toolCalls) {
    const c = toChatChart(t.chart, typeof t.name === 'string' ? t.name : undefined);
    if (c) charts.push(c);
  }
  return charts.length > 0 ? charts : undefined;
}

/** Map a persisted tool_calls audit array into display chips. */
function mapToolCalls(
  toolCalls: Array<Record<string, unknown>> | null,
): ToolActivity[] | undefined {
  if (!toolCalls || toolCalls.length === 0) return undefined;
  return toolCalls.map((t) => ({
    name: String(t.name ?? ''),
    status: (t.error ? 'error' : 'done') as ToolStatus,
    rowCount: typeof t.row_count === 'number' ? (t.row_count as number) : undefined,
    ticker: typeof t.ticker === 'string' ? (t.ticker as string) : undefined,
  }));
}

function mapRecord(r: ChatMessageRecord): ChatMessage {
  return {
    id: r.message_id,
    role: r.role,
    content: r.content,
    time: timeLabel(r.created_at),
    tools: r.role === 'assistant' ? mapToolCalls(r.tool_calls) : undefined,
    files: r.role === 'assistant' ? mapToolFiles(r.tool_calls) : undefined,
    charts: r.role === 'assistant' ? mapToolCharts(r.tool_calls) : undefined,
    streaming: false,
  };
}

interface UseChatOptions {
  /** Called after each turn finishes (done or error) — refresh history. */
  onTurnComplete?: () => void;
}

export function useChat(options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onTurnCompleteRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    onTurnCompleteRef.current = options?.onTurnComplete;
  }, [options?.onTurnComplete]);

  const setSession = useCallback((id: string | null) => {
    sessionIdRef.current = id;
    setSessionId(id);
  }, []);

  const patch = useCallback(
    (id: string, fn: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
    },
    [],
  );

  /** Start a brand-new conversation (next message creates a session). */
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSession(null);
    setMessages([]);
    setIsStreaming(false);
  }, [setSession]);

  /** Load a persisted session and continue it. */
  const loadSession = useCallback(
    (detail: ChatSessionDetail) => {
      abortRef.current?.abort();
      abortRef.current = null;
      setSession(detail.session_id);
      setMessages(detail.messages.map(mapRecord));
      setIsStreaming(false);
    },
    [setSession],
  );

  const send = useCallback(
    async (text: string, model?: ChatModelId) => {
      const content = text.trim();
      if (!content || isStreaming) return;

      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content,
        time: nowLabel(),
      };
      const assistantId = uid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        time: nowLabel(),
        tools: [],
        thinking: true,
        streaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      await streamMessage(
        { message: content, session_id: sessionIdRef.current, model },
        {
          signal: controller.signal,
          onEvent: (evt) => {
            const data = evt.data as Record<string, unknown>;
            switch (evt.event) {
              case 'session':
                if (data.session_id) setSession(String(data.session_id));
                break;

              case 'thinking':
                patch(assistantId, (m) => ({ ...m, thinking: true }));
                break;

              case 'token':
                patch(assistantId, (m) => ({
                  ...m,
                  thinking: false,
                  content: m.content + String(data.text ?? ''),
                }));
                break;

              case 'tool': {
                const name = String(data.name ?? '');
                const status = String(data.status ?? 'running') as ToolStatus;
                patch(assistantId, (m) => {
                  const tools = [...(m.tools ?? [])];
                  const entry: ToolActivity = {
                    name,
                    status,
                    rowCount:
                      typeof data.row_count === 'number' ? data.row_count : undefined,
                    ticker: typeof data.ticker === 'string' ? data.ticker : undefined,
                  };
                  if (status === 'running') {
                    tools.push(entry);
                  } else {
                    const i = tools.map((t) => t.name).lastIndexOf(name);
                    if (i !== -1) tools[i] = entry;
                    else tools.push(entry);
                  }
                  return { ...m, thinking: false, tools };
                });
                break;
              }

              case 'file': {
                const f = toChatFile(data);
                if (f) {
                  patch(assistantId, (m) => ({
                    ...m,
                    thinking: false,
                    files: mergeFiles(m.files, [f]),
                  }));
                }
                break;
              }

              case 'chart': {
                // One event per show_chart call, in order — just append. The
                // `done` event below resends the full list and replaces this
                // one, so a repeated id never collapses two charts into one.
                const c = toChatChart(data);
                if (c) {
                  patch(assistantId, (m) => ({
                    ...m,
                    thinking: false,
                    charts: [...(m.charts ?? []), c],
                  }));
                }
                break;
              }

              case 'usage':
                patch(assistantId, (m) => ({ ...m, usage: data }));
                break;

              case 'done': {
                const doneFiles = Array.isArray(data.files)
                  ? (data.files as unknown[])
                      .map((x) => toChatFile(x))
                      .filter((x): x is ChatFile => x !== null)
                  : [];
                const doneCharts = Array.isArray(data.charts)
                  ? (data.charts as unknown[])
                      .map((x) => toChatChart(x))
                      .filter((x): x is ChatChart => x !== null)
                  : [];
                patch(assistantId, (m) => ({
                  ...m,
                  content: m.content || String(data.content ?? ''),
                  files:
                    doneFiles.length > 0 ? mergeFiles(m.files, doneFiles) : m.files,
                  // `done.charts` is the turn's complete, ordered list — it
                  // wins over what streamed (and covers a missed `chart`
                  // event). Empty/absent means the turn drew nothing.
                  charts: doneCharts.length > 0 ? doneCharts : m.charts,
                  streaming: false,
                  thinking: false,
                }));
                break;
              }

              case 'error':
                patch(assistantId, (m) => ({
                  ...m,
                  streaming: false,
                  thinking: false,
                  error: String(data.detail ?? 'Ocurrió un error.'),
                }));
                break;
            }
          },
        },
      );

      patch(assistantId, (m) =>
        m.streaming ? { ...m, streaming: false, thinking: false } : m,
      );
      setIsStreaming(false);
      abortRef.current = null;
      onTurnCompleteRef.current?.();
    },
    [isStreaming, patch, setSession],
  );

  return { messages, isStreaming, sessionId, send, newChat, loadSession };
}
