import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AtSign, Send } from 'lucide-react';
import type { ChatModelId } from '../types';

interface ComposerProps {
  onSend: (text: string) => void;
  disabled: boolean;
  model: ChatModelId;
  onModelChange: (model: ChatModelId) => void;
}

/** Auto-growing chat input with Enter-to-send (Shift+Enter for newline). */
export function Composer({ onSend, disabled, model, onModelChange }: ComposerProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    if (ref.current) ref.current.style.height = 'auto';
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={ref}
          className="composer-input"
          placeholder="Pregunta por una acción, compara dos, o filtra el universo…"
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          rows={1}
        />
        <div className="composer-actions">
          <span className="scope-chip" title="Datos que el asistente puede leer">
            <AtSign size={12} /> Mercado + mis carteras
          </span>
          <div className="composer-spacer" />
          <select
            className="composer-model-select"
            value={model}
            onChange={(e) => onModelChange(e.target.value as ChatModelId)}
            aria-label="Modelo de IA"
            title="Modelo de IA"
          >
            <option value="fable">Fable 5</option>
            <option value="opus">Opus 4.8</option>
            <option value="sonnet">Sonnet 5</option>
            <option value="haiku">Haiku 4.5</option>
          </select>
          <button
            className="send-btn"
            disabled={!value.trim() || disabled}
            onClick={submit}
            aria-label="Enviar"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
      <div className="composer-hint">
        El asistente puede cometer errores. Verifica las cifras importantes antes de
        operar. No es asesoramiento de inversión.
      </div>
    </div>
  );
}
