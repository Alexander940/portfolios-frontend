import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';
import {
  deleteSession as deleteSessionApi,
  getSession,
  listSessions,
  type ChatSessionSummary,
} from '../services';
import type { ChatModelId } from '../types';
import { ChatMessageItem } from './ChatMessageItem';
import { Composer } from './Composer';
import { ContextRail } from './ContextRail';
import { EmptyState } from './EmptyState';
import '../styles/chat.css';

/**
 * Assistant — the AI stock-analysis chat page. Conversation column with a
 * scrolling thread + pinned composer, and a right-hand rail that holds the
 * conversation history (new/select/delete), connected-data and portfolios.
 */
export function Assistant() {
  const [model, setModel] = useState<ChatModelId>('opus');
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshSessions = useCallback(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {
        /* history is non-critical — ignore */
      });
  }, []);

  const { messages, isStreaming, sessionId, send, newChat, loadSession } = useChat({
    onTurnComplete: refreshSessions,
  });

  // Send with the currently-selected model (shared by composer, suggestions
  // and the context rail). Model can change between messages.
  const sendWithModel = useCallback(
    (text: string) => send(text, model),
    [send, model],
  );

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // Keep the thread pinned to the latest content as it streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (id === sessionId) return;
      getSession(id)
        .then(loadSession)
        .catch(() => {
          /* ignore — selection failed */
        });
    },
    [sessionId, loadSession],
  );

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSessionApi(id)
        .then(() => {
          if (id === sessionId) newChat();
          refreshSessions();
        })
        .catch(() => {
          /* ignore — delete failed */
        });
    },
    [sessionId, newChat, refreshSessions],
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-layout">
      <div className="chat-col">
        <div className="chat-scroll" ref={scrollRef}>
          {isEmpty ? (
            <EmptyState onPick={sendWithModel} />
          ) : (
            <div className="chat-thread">
              {messages.map((m) => (
                <ChatMessageItem key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
        <Composer
          onSend={sendWithModel}
          disabled={isStreaming}
          model={model}
          onModelChange={setModel}
        />
      </div>

      <ContextRail
        sessions={sessions}
        activeSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewChat={newChat}
        onDeleteSession={handleDeleteSession}
        onAskPortfolio={(name) =>
          sendWithModel(
            `Analiza mi portafolio "${name}": posiciones, ratings actuales y P&L.`,
          )
        }
      />
    </div>
  );
}
