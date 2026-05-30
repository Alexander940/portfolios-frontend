import { useCallback, useRef, useState } from 'react';
import { streamMessage } from '../services/chatService';
import type { ChatMessage, ToolActivity, ToolStatus } from '../types';

/**
 * useChat — owns the conversation state and drives the streaming agentic
 * turn. One assistant message is appended per turn and patched in place as
 * token / tool / thinking / usage / done / error events arrive.
 */

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback(
    (id: string, fn: (m: ChatMessage) => ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
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
        { message: content, session_id: sessionIdRef.current },
        {
          signal: controller.signal,
          onEvent: (evt) => {
            const data = evt.data as Record<string, unknown>;
            switch (evt.event) {
              case 'session':
                if (data.session_id) sessionIdRef.current = String(data.session_id);
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
                    // Resolve the last still-running call with this name.
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

      // Stream ended — clear flags even if no terminal event arrived.
      patch(assistantId, (m) =>
        m.streaming ? { ...m, streaming: false, thinking: false } : m,
      );
      setIsStreaming(false);
      abortRef.current = null;
    },
    [isStreaming, patch],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionIdRef.current = null;
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, send, reset };
}
