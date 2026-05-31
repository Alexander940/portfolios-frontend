import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import type { ChatSessionSummary } from '../services/chatService';

interface ConversationListProps {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

/** Persisted chat sessions, newest first, with new-chat and delete actions. */
export function ConversationList({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onDelete,
}: ConversationListProps) {
  return (
    <div>
      <div className="ctx-conv-head">
        <span className="ctx-section-label" style={{ marginBottom: 0 }}>
          Conversaciones
        </span>
        <button className="ctx-newchat" onClick={onNewChat} title="Nuevo chat">
          <Plus size={13} /> Nuevo
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="ctx-tip" style={{ marginTop: 0 }}>
          Aún no tienes conversaciones. Empieza a chatear y aparecerán aquí.
        </div>
      ) : (
        <div className="conv-list">
          {sessions.map((s) => (
            <button
              key={s.session_id}
              className={`conv-item ${s.session_id === activeSessionId ? 'active' : ''}`}
              onClick={() => onSelect(s.session_id)}
              title={s.title ?? 'Nueva conversación'}
            >
              <MessageSquare size={14} className="conv-icon" />
              <span className="conv-text">
                <span className="conv-title">{s.title ?? 'Nueva conversación'}</span>
                <span className="conv-date">{relativeDate(s.updated_at)}</span>
              </span>
              <span
                className="conv-del"
                role="button"
                tabIndex={-1}
                title="Eliminar"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.session_id);
                }}
              >
                <Trash2 size={13} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
