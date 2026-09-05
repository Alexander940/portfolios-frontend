import { AlertTriangle, Copy, Sparkles } from 'lucide-react';
import type { ChatMessage } from '../types';
import { ChatChartCard } from './ChatChartCard';
import { FileDownloadCard } from './FileDownloadCard';
import { MarkdownMessage } from './MarkdownMessage';
import { ToolActivityRow } from './ToolActivity';
import { Typing } from './Typing';

/** Renders one message — a right-aligned user bubble or the AI answer. */
export function ChatMessageItem({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="msg-bubble">{message.content}</div>
      </div>
    );
  }

  const showTyping = message.thinking && !message.content && !message.error;

  return (
    <div className="msg msg-ai">
      <div className="msg-ai-head">
        <div className="msg-avatar">
          <Sparkles size={15} />
        </div>
        <span className="msg-name">Portafolios AI</span>
        {message.time && <span className="msg-time">{message.time}</span>}
      </div>

      <div className="msg-body">
        <ToolActivityRow tools={message.tools ?? []} />

        {message.files && message.files.length > 0 && (
          <div className="file-cards">
            {message.files.map((f) => (
              <FileDownloadCard key={f.fileId} file={f} />
            ))}
          </div>
        )}

        {message.charts && message.charts.length > 0 && (
          <div className="chart-cards">
            {/* Keyed by position: the id is the model's label and two calls
                in one turn may reuse it. */}
            {message.charts.map((c, i) => (
              <ChatChartCard key={`${c.id}-${i}`} chart={c} />
            ))}
          </div>
        )}

        {showTyping ? <Typing /> : null}
        {message.content ? <MarkdownMessage content={message.content} /> : null}

        {message.error && (
          <div className="blk-note warn">
            <span className="blk-note-icon">
              <AlertTriangle size={16} />
            </span>
            <span>{message.error}</span>
          </div>
        )}

        {!message.streaming && message.content && !message.error && (
          <div className="msg-tools">
            <button
              className="msg-tool"
              title="Copiar"
              onClick={() => navigator.clipboard?.writeText(message.content)}
            >
              <Copy size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
