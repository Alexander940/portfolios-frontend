import { useAuthStore } from '@/features/auth';
import type { ChatModelId, ChatStreamEvent } from '../types';

/**
 * Chat API service.
 *
 * The streaming endpoint uses Server-Sent Events and requires the JWT in
 * the Authorization header. `EventSource` can't set headers, so we use
 * `fetch` + a ReadableStream reader and parse SSE frames by hand. The token
 * comes from the auth store (the same one the axios client uses).
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SendMessageBody {
  message: string;
  session_id?: string | null;
  /** Model choice; omitted/None -> server default (Opus). */
  model?: ChatModelId | null;
}

export interface StreamHandlers {
  onEvent: (event: ChatStreamEvent) => void;
  signal?: AbortSignal;
}

function getToken(): string | null {
  return useAuthStore.getState().accessToken;
}

/**
 * Open the SSE stream for one user turn and invoke `onEvent` for every
 * parsed frame (session, thinking, token, tool, usage, done, error).
 * Resolves when the stream ends. Aborting via `signal` resolves quietly.
 */
export async function streamMessage(
  body: SendMessageBody,
  handlers: StreamHandlers,
): Promise<void> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${API_URL}/chat/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return;
    handlers.onEvent({
      event: 'error',
      data: { detail: 'No se pudo conectar con el asistente.' },
    });
    return;
  }

  if (res.status === 401) {
    useAuthStore.getState().logout();
    handlers.onEvent({
      event: 'error',
      data: { detail: 'Tu sesión expiró. Inicia sesión de nuevo.' },
    });
    return;
  }

  if (!res.ok || !res.body) {
    let detail = `Error ${res.status}`;
    try {
      const json = await res.json();
      if (json?.detail) detail = String(json.detail);
    } catch {
      /* non-JSON error body — keep the status-based message */
    }
    handlers.onEvent({ event: 'error', data: { detail } });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const evt = parseFrame(frame);
        if (evt) handlers.onEvent(evt);
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      handlers.onEvent({
        event: 'error',
        data: { detail: 'Se interrumpió la conexión con el asistente.' },
      });
    }
  }
}

/** Parse a single SSE frame ("event: x\ndata: {...}") into a typed event. */
function parseFrame(frame: string): ChatStreamEvent | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0) return null;

  try {
    return {
      event: event as ChatStreamEvent['event'],
      data: JSON.parse(dataLines.join('\n')),
    };
  } catch {
    return null;
  }
}
