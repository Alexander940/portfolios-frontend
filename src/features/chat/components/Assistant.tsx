import { useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatMessageItem } from './ChatMessageItem';
import { Composer } from './Composer';
import { ContextRail } from './ContextRail';
import { EmptyState } from './EmptyState';
import '../styles/chat.css';

/**
 * Assistant — the AI stock-analysis chat page. Conversation column with a
 * scrolling thread + pinned composer, and a right-hand context rail. Renders
 * full-bleed inside the dashboard shell (see DashboardLayout).
 */
export function Assistant() {
  const { messages, isStreaming, send } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the thread pinned to the latest content as it streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-layout">
      <div className="chat-col">
        <div className="chat-scroll" ref={scrollRef}>
          {isEmpty ? (
            <EmptyState onPick={send} />
          ) : (
            <div className="chat-thread">
              {messages.map((m) => (
                <ChatMessageItem key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
        <Composer onSend={send} disabled={isStreaming} />
      </div>

      <ContextRail
        onAskPortfolio={(name) =>
          send(`Analiza mi portafolio "${name}": posiciones, ratings actuales y P&L.`)
        }
      />
    </div>
  );
}
