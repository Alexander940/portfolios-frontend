import { useState } from 'react';
import {
  Download,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { isApiError } from '@/lib/apiErrors';
import { triggerDownload } from '@/lib/download';
import { downloadChatFile } from '../services/chatService';
import type { ChatFile } from '../types';

/**
 * One downloadable file produced by the assistant (PDF / DOCX / XLSX).
 *
 * The endpoint is JWT-protected, so the blob is fetched through the axios
 * client and handed to the browser from memory — a plain link can't carry the
 * Bearer token. A 404 means the file expired (TTL 7 days) or isn't the
 * viewer's.
 */

type FileKind = 'pdf' | 'xlsx' | 'docx' | 'other';

const KIND_LABEL: Record<FileKind, string> = {
  pdf: 'PDF',
  xlsx: 'Excel',
  docx: 'Word',
  other: 'Archivo',
};

const KIND_ICON: Record<FileKind, typeof FileText> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  docx: FileText,
  other: FileIcon,
};

/** Classify by media type first, then by the filename extension. */
function fileKind(file: ChatFile): FileKind {
  const media = (file.mediaType ?? '').toLowerCase();
  const ext = (/\.([a-z0-9]+)$/i.exec(file.filename ?? '')?.[1] ?? '').toLowerCase();
  if (media.includes('pdf') || ext === 'pdf') return 'pdf';
  if (
    media.includes('spreadsheet') ||
    media.includes('excel') ||
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'csv'
  ) {
    return 'xlsx';
  }
  if (
    media.includes('wordprocessing') ||
    media.includes('msword') ||
    ext === 'docx' ||
    ext === 'doc'
  ) {
    return 'docx';
  }
  return 'other';
}

/** "812 KB" / "1,4 MB"; empty string when the size is unknown. */
function fmtSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toLocaleString(undefined, {
      maximumFractionDigits: kb < 10 ? 1 : 0,
    })} KB`;
  }
  return `${(kb / 1024).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} MB`;
}

export function FileDownloadCard({ file }: { file: ChatFile }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = fileKind(file);
  const Icon = KIND_ICON[kind];
  const size = fmtSize(file.sizeBytes);
  const meta = [KIND_LABEL[kind], size].filter(Boolean).join(' · ');

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await downloadChatFile(file);
      triggerDownload(blob, filename);
    } catch (err) {
      setError(
        isApiError(err) && err.status === 404
          ? 'Archivo expirado'
          : 'No se pudo descargar',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`file-card${error ? ' has-error' : ''}`}>
      <span className={`file-card-icon ${kind}`} aria-hidden="true">
        <Icon size={16} />
      </span>

      <span className="file-card-info">
        <span className="file-card-name" title={file.filename}>
          {file.filename}
        </span>
        <span className="file-card-meta">
          {meta}
          {error && (
            <span className="file-card-error" role="status">
              {' · '}
              {error}
            </span>
          )}
        </span>
      </span>

      <button
        type="button"
        className="file-card-btn"
        onClick={handleDownload}
        disabled={busy}
        aria-busy={busy}
        aria-label={
          busy ? `Descargando ${file.filename}` : `Descargar ${file.filename}`
        }
      >
        {busy ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
        {busy ? 'Descargando…' : 'Descargar'}
      </button>
    </div>
  );
}
