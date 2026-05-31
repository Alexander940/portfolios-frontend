import { useCallback, useEffect, useRef, useState } from 'react';
import { streamMessage } from '../services/chatService';
import type { ChatMessageRecord, ChatSessionDetail } from '../services/chatService';
import type { ChatMessage, ChatModelId, ToolActivity, ToolStatus } from '../types';

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

              case 'usage':
                patch(assistantId, (m) => ({ ...m, usage: data }));
                break;

              case 'done':
                patch(assistantId, (m) => ({
                  ...m,
                  content: m.content || String(data.content ?? ''),
                  streaming: false,
                  thinking: false,
                }));
                break;

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
