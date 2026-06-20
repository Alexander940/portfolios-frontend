import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import {
  confirmImportPortfolio,
  previewPortfolioFromExcel,
  type ImportConfirmCreate,
  type ImportPositionInput,
  type ImportPreviewRow,
  type PortfolioResponse,
  type SkippedTicker,
  type WeightingMethod,
} from '@/services/portfolioService';
import { getErrorMessage } from '@/lib/apiErrors';

interface ImportPortfolioFromExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (portfolio: PortfolioResponse) => void;
}

type Mode = 'quantities' | 'weighting';
type SelectableWeighting = Exclude<WeightingMethod, 'manual'>;

interface EditableRow {
  inputTicker: string;
  resolvedTicker: string;
  name: string;
  status: ImportPreviewRow['status'];
  recentPrice: number | null;
  quantity: number | null;
  /** Resolved to a symbol and not a duplicate → can become a position. */
  usable: boolean;
}

const ACCEPT = '.xlsx,.xls,.csv';

const WEIGHTING_OPTIONS: { value: SelectableWeighting; label: string; hint: string }[] = [
  { value: 'equal', label: 'Equal Weight', hint: 'Same allocation for every stock' },
  { value: 'rating_weighted', label: 'Rating Weighted', hint: 'Higher rating → higher weight' },
  { value: 'market_cap', label: 'Market Cap Weighted', hint: 'Larger companies get more weight' },
];

const STATUS_BADGE: Record<ImportPreviewRow['status'], { text: string; cls: string }> = {
  found: { text: 'Found', cls: 'bg-green-100 text-green-700' },
  normalized: { text: 'Matched', cls: 'bg-green-100 text-green-700' },
  not_found: { text: 'Not found', cls: 'bg-red-100 text-red-700' },
  duplicate: { text: 'Duplicate', cls: 'bg-gray-100 text-gray-500' },
  invalid_quantity: { text: 'Fix qty', cls: 'bg-amber-100 text-amber-800' },
};

const SKIP_REASON: Record<SkippedTicker['reason'], string> = {
  unknown_symbol: 'unknown symbol',
  no_price_asof: 'no price data',
  before_coverage: 'no price on/before the start date',
  too_small_to_size: 'allocation too small to buy one share',
  invalid_quantity: 'invalid quantity',
};

/** Today as YYYY-MM-DD in LOCAL time (native date inputs are local). */
function todayLocalISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function toEditableRows(rows: ImportPreviewRow[]): EditableRow[] {
  return rows.map((r) => ({
    inputTicker: r.input_ticker,
    resolvedTicker: r.resolved_ticker ?? r.input_ticker,
    name: r.name ?? '',
    status: r.status,
    recentPrice: r.recent_price,
    quantity: r.quantity,
    usable: r.symbol_id !== null && r.status !== 'duplicate',
  }));
}

const FIELD_CLS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400';

export function ImportPortfolioFromExcelModal({
  isOpen,
  onClose,
  onCreated,
}: ImportPortfolioFromExcelModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [rows, setRows] = useState<EditableRow[]>([]);
  const [mode, setMode] = useState<Mode>('weighting');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialCash, setInitialCash] = useState('100000');
  const [weightingMethod, setWeightingMethod] = useState<SelectableWeighting>('equal');
  const [startDate, setStartDate] = useState(todayLocalISO());

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<SkippedTicker[] | null>(null);

  const usableRows = useMemo(() => rows.filter((r) => r.usable), [rows]);

  // Rows that will actually become positions. In quantities mode a row is
  // included only when it has a quantity > 0, so blank/0 rows (e.g. a "CASH"
  // line that happens to resolve to a real ticker) are simply left out instead
  // of blocking creation — you can run fully invested with no cash position.
  const selectedRows = useMemo(
    () =>
      mode === 'quantities'
        ? usableRows.filter((r) => r.quantity != null && r.quantity > 0)
        : usableRows,
    [mode, usableRows],
  );
  const createCount = mode === 'quantities' ? selectedRows.length : usableRows.length;

  const estimatedCapital = useMemo(() => {
    if (mode !== 'quantities') return null;
    let sum = 0;
    let complete = selectedRows.length > 0;
    for (const r of selectedRows) {
      if (r.quantity && r.recentPrice != null) sum += r.quantity * r.recentPrice;
      else complete = false;
    }
    return { sum, complete };
  }, [mode, selectedRows]);

  function resetAll() {
    setStep('upload');
    setFileName(null);
    setUploading(false);
    setUploadError(null);
    setRows([]);
    setMode('weighting');
    setName('');
    setDescription('');
    setInitialCash('100000');
    setWeightingMethod('equal');
    setStartDate(todayLocalISO());
    setSubmitting(false);
    setSubmitError(null);
    setSkipped(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadError(null);
    setUploading(true);
    try {
      const preview = await previewPortfolioFromExcel(file);
      setRows(toEditableRows(preview.rows));
      setMode(preview.has_quantity_column ? 'quantities' : 'weighting');
      setStep('preview');
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function updateQuantity(index: number, raw: string) {
    const parsed = raw.trim() === '' ? NaN : Math.floor(Number(raw));
    const qty = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, quantity: qty } : r)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): string | null {
    if (!name.trim()) return 'Portfolio name is required.';
    if (!startDate) return 'Pick an analyze-from date.';
    if (startDate > todayLocalISO()) return 'The analyze-from date cannot be in the future.';
    if (usableRows.length === 0) return 'No valid tickers to import.';
    if (mode === 'quantities') {
      if (selectedRows.length === 0) {
        return 'Enter a share quantity for at least one ticker.';
      }
    } else {
      const cash = Number(initialCash);
      if (!Number.isFinite(cash) || cash < 1000) {
        return 'Initial capital must be at least $1,000.';
      }
    }
    return null;
  }

  async function handleConfirm() {
    setSubmitError(null);
    setSkipped(null);
    const err = validate();
    if (err) {
      setSubmitError(err);
      return;
    }

    const payload: ImportConfirmCreate = {
      name: name.trim(),
      description: description.trim() || null,
      start_date: startDate,
      positions:
        mode === 'quantities'
          ? selectedRows.map<ImportPositionInput>((r) => ({
              ticker: r.resolvedTicker,
              quantity: r.quantity,
            }))
          : usableRows.map<ImportPositionInput>((r) => ({ ticker: r.resolvedTicker })),
    };
    if (mode === 'weighting') {
      payload.initial_cash = Number(initialCash);
      payload.weighting_method = weightingMethod;
    }

    setSubmitting(true);
    try {
      const resp = await confirmImportPortfolio(payload);
      onCreated(resp.portfolio);
      if (resp.skipped.length > 0) {
        setSkipped(resp.skipped);
      } else {
        handleClose();
      }
    } catch (e) {
      setSubmitError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Portfolio from Excel"
      description={
        step === 'upload'
          ? 'Upload an .xlsx or .csv with a ticker column (and an optional quantity column).'
          : 'Review the tickers, set quantities or a weighting method, and pick the analyze-from date.'
      }
      size="2xl"
    >
      {step === 'upload' ? (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            className="hidden"
            id="tickers-excel-file"
            disabled={uploading}
          />
          <label
            htmlFor="tickers-excel-file"
            className={`flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg transition-colors ${
              uploading
                ? 'border-gray-200 bg-gray-50 cursor-wait'
                : 'border-gray-300 cursor-pointer hover:border-[#1e3a5f] hover:bg-gray-50'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 size={24} className="text-[#1e3a5f] animate-spin" />
                <div className="text-sm text-gray-700 font-medium">Reading {fileName}…</div>
              </>
            ) : (
              <>
                <Upload size={24} className="text-gray-400" />
                <div className="text-sm text-gray-700 font-medium">Click to choose a file</div>
                <div className="text-xs text-gray-500">
                  .xlsx, .xls or .csv — a column named ticker/symbol (optional: quantity)
                </div>
              </>
            )}
          </label>

          {uploadError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
              {uploadError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* File summary */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet size={16} className="text-[#1e3a5f] shrink-0" />
              <span className="truncate text-gray-900">{fileName}</span>
              <span className="text-gray-500 shrink-0">
                · {usableRows.length} usable / {rows.length} rows
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep('upload');
                setRows([]);
                setSkipped(null);
                setSubmitError(null);
              }}
              className="text-[#1e3a5f] hover:underline shrink-0"
            >
              Change file
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('quantities')}
              className={`flex-1 p-2 rounded-lg border text-sm font-medium transition-colors ${
                mode === 'quantities'
                  ? 'border-[#1e3a5f] bg-[#f0f4fa] text-[#1e3a5f]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Share quantities
            </button>
            <button
              type="button"
              onClick={() => setMode('weighting')}
              className={`flex-1 p-2 rounded-lg border text-sm font-medium transition-colors ${
                mode === 'weighting'
                  ? 'border-[#1e3a5f] bg-[#f0f4fa] text-[#1e3a5f]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              Capital + weighting
            </button>
          </div>

          {/* Preview table */}
          <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Ticker</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium text-right">
                    {mode === 'quantities' ? 'Shares' : 'Est. price'}
                  </th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const badge = STATUS_BADGE[r.status];
                  const willImport =
                    r.usable &&
                    (mode !== 'quantities' || (r.quantity != null && r.quantity > 0));
                  return (
                    <tr
                      key={`${r.inputTicker}-${i}`}
                      className={`border-t border-gray-100 ${willImport ? '' : 'opacity-45'}`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-900">{r.resolvedTicker}</td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-[180px]">
                        {r.name || '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {mode === 'quantities' ? (
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={!r.usable}
                            value={r.quantity ?? ''}
                            onChange={(e) => updateQuantity(i, e.target.value)}
                            placeholder="0"
                            className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] disabled:bg-gray-100"
                          />
                        ) : (
                          <span className="text-gray-600">
                            {r.recentPrice != null
                              ? `$${r.recentPrice.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}
                        >
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="text-gray-400 hover:text-red-600"
                          aria-label={`Remove ${r.resolvedTicker}`}
                          title="Remove from import"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mode-specific controls */}
          {mode === 'quantities' ? (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
              Initial capital is derived from your share quantities.
              {estimatedCapital && estimatedCapital.complete && (
                <span className="font-medium text-gray-900">
                  {' '}
                  ≈ $
                  {estimatedCapital.sum.toLocaleString(undefined, { maximumFractionDigits: 0 })} at
                  latest prices.
                </span>
              )}
              <span className="block text-xs text-gray-500 mt-0.5">
                The exact cost basis uses the closing price on your analyze-from date.
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Rows left blank or 0 (e.g. a cash line) are not included.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                label="Initial capital (USD)"
                type="number"
                step="1000"
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
              />
              <div>
                <div className="block text-sm font-medium text-gray-700 mb-2">Weighting method</div>
                <div className="space-y-2">
                  {WEIGHTING_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        weightingMethod === opt.value
                          ? 'border-[#1e3a5f] bg-[#f0f4fa]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="weighting"
                        value={opt.value}
                        checked={weightingMethod === opt.value}
                        onChange={() => setWeightingMethod(opt.value)}
                        className="mt-1 accent-[#1e3a5f]"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                        <div className="text-xs text-gray-500">{opt.hint}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Common fields */}
          <Input
            label="Portfolio name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <label
              htmlFor="import-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description (optional)
            </label>
            <textarea
              id="import-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={FIELD_CLS}
            />
          </div>
          <div>
            <label
              htmlFor="import-start-date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Analyze from
            </label>
            <input
              id="import-start-date"
              type="date"
              value={startDate}
              max={todayLocalISO()}
              onChange={(e) => setStartDate(e.target.value)}
              className={FIELD_CLS}
            />
            <div className="text-xs text-gray-500 mt-1">
              Returns and the equity curve are computed from this date.
            </div>
          </div>

          {skipped && skipped.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
              <div className="font-medium mb-1">
                Portfolio created — {skipped.length}{' '}
                {skipped.length === 1 ? 'ticker was' : 'tickers were'} skipped
              </div>
              <ul className="text-xs text-amber-800 space-y-0.5">
                {skipped.map((s) => (
                  <li key={s.ticker}>
                    <strong>{s.ticker}</strong> — {SKIP_REASON[s.reason]}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end mt-2">
                <Button type="button" variant="ghost" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
              {submitError}
            </div>
          )}

          {!skipped && (
            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('upload')}
                disabled={submitting}
              >
                Back
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {createCount} position{createCount === 1 ? '' : 's'} will be created
                </span>
                <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  isLoading={submitting}
                  disabled={createCount === 0}
                >
                  {submitting ? 'Creating…' : 'Create Portfolio'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
