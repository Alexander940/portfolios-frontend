import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import axios from 'axios';
import { Modal, Button, Input } from '@/components/ui';
import {
  createPortfolioFromTickers,
  type PortfolioResponse,
  type WeightingMethod,
} from '@/services/portfolioService';
import {
  parseTickersFromExcel,
  TickerExcelParseError,
} from '@/lib/parseTickersFromExcel';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Max 255 characters'),
  description: z.string().trim().max(1000).optional(),
  initial_cash: z
    .number({ message: 'Must be a number' })
    .min(1000, 'Minimum $1,000')
    .max(1_000_000_000, 'Too large'),
  weighting_method: z.enum(['equal', 'rating_weighted', 'market_cap']),
});

type FormValues = z.infer<typeof schema>;

interface ImportPortfolioFromExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (portfolio: PortfolioResponse) => void;
}

const WEIGHTING_OPTIONS: { value: WeightingMethod; label: string; hint: string }[] = [
  { value: 'equal', label: 'Equal Weight', hint: 'Same allocation for every stock' },
  { value: 'rating_weighted', label: 'Rating Weighted', hint: 'Higher rating → higher weight' },
  { value: 'market_cap', label: 'Market Cap Weighted', hint: 'Larger companies get more weight' },
];

const ACCEPT = '.xlsx,.xls,.csv';

export function ImportPortfolioFromExcelModal({
  isOpen,
  onClose,
  onCreated,
}: ImportPortfolioFromExcelModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tickers, setTickers] = useState<string[]>([]);
  const [headerUsed, setHeaderUsed] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[] | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      initial_cash: 100000,
      weighting_method: 'equal',
    },
  });

  const weightingMethod = watch('weighting_method');

  function resetAll() {
    reset();
    setFileName(null);
    setTickers([]);
    setHeaderUsed(null);
    setParseError(null);
    setServerError(null);
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
    setParseError(null);
    setServerError(null);
    setSkipped(null);
    setTickers([]);
    setHeaderUsed(null);
    try {
      const result = await parseTickersFromExcel(file);
      setTickers(result.tickers);
      setHeaderUsed(result.headerUsed);
    } catch (err) {
      const message =
        err instanceof TickerExcelParseError
          ? err.message
          : 'Could not read the file.';
      setParseError(message);
    }
  }

  function clearFile() {
    setFileName(null);
    setTickers([]);
    setHeaderUsed(null);
    setParseError(null);
    setSkipped(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSkipped(null);
    if (tickers.length === 0) {
      setParseError('Upload a file with a "tickers" column first.');
      return;
    }
    try {
      const response = await createPortfolioFromTickers({
        name: values.name,
        description: values.description || null,
        initial_cash: values.initial_cash,
        weighting_method: values.weighting_method,
        tickers,
      });
      if (response.skipped_tickers.length > 0) {
        // Notify and keep the modal open so the user can review which tickers
        // were dropped (unknown symbol or no current price).
        setSkipped(response.skipped_tickers);
        onCreated(response.portfolio);
        return;
      }
      onCreated(response.portfolio);
      handleClose();
    } catch (err) {
      let message = 'Could not create portfolio. Please try again.';
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') message = detail;
      }
      setServerError(message);
    }
  }

  const canSubmit = tickers.length > 0 && !parseError && !isSubmitting;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Portfolio from Excel"
      description='Upload an .xlsx, .xls, or .csv file with a "tickers" column.'
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* File picker */}
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-1">
            Excel file
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            className="hidden"
            id="tickers-excel-file"
          />
          {!fileName ? (
            <label
              htmlFor="tickers-excel-file"
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1e3a5f] hover:bg-gray-50 transition-colors"
            >
              <Upload size={24} className="text-gray-400" />
              <div className="text-sm text-gray-700 font-medium">
                Click to choose a file
              </div>
              <div className="text-xs text-gray-500">
                .xlsx, .xls or .csv — must contain a column named "tickers"
              </div>
            </label>
          ) : (
            <div className="flex items-center justify-between gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet size={18} className="text-[#1e3a5f] shrink-0" />
                <span className="text-sm text-gray-900 truncate">{fileName}</span>
              </div>
              <button
                type="button"
                onClick={clearFile}
                className="text-gray-400 hover:text-gray-700 shrink-0"
                aria-label="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {parseError && (
          <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
            {parseError}
          </div>
        )}

        {tickers.length > 0 && (
          <div className="p-3 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-sm">
            <div className="flex items-center gap-2 font-medium mb-1">
              <FileSpreadsheet size={16} />
              Found <strong>{tickers.length}</strong>{' '}
              {tickers.length === 1 ? 'ticker' : 'tickers'}
              {headerUsed && (
                <span className="text-blue-700 font-normal">
                  &nbsp;in column "{headerUsed}"
                </span>
              )}
            </div>
            <div className="text-xs text-blue-700 line-clamp-2 break-all">
              {tickers.slice(0, 20).join(', ')}
              {tickers.length > 20 && ` … +${tickers.length - 20} more`}
            </div>
          </div>
        )}

        <Input
          label="Portfolio name"
          type="text"
          error={errors.name?.message}
          {...register('name')}
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent text-sm"
            {...register('description')}
          />
        </div>

        <Input
          label="Initial capital (USD)"
          type="number"
          step="1000"
          error={errors.initial_cash?.message}
          {...register('initial_cash', { valueAsNumber: true })}
        />

        <div>
          <div className="block text-sm font-medium text-gray-700 mb-2">
            Weighting method
          </div>
          <div className="space-y-2">
            {WEIGHTING_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`
                  flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${
                    weightingMethod === opt.value
                      ? 'border-[#1e3a5f] bg-[#f0f4fa]'
                      : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <input
                  type="radio"
                  value={opt.value}
                  {...register('weighting_method')}
                  className="mt-1 accent-[#1e3a5f]"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {opt.label}
                  </div>
                  <div className="text-xs text-gray-500">{opt.hint}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {skipped && skipped.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-sm">
            <div className="font-medium mb-1">
              Portfolio created — but {skipped.length}{' '}
              {skipped.length === 1 ? 'ticker was' : 'tickers were'} skipped
            </div>
            <div className="text-xs text-amber-800 break-all">
              {skipped.join(', ')}
            </div>
            <div className="text-xs text-amber-800 mt-2">
              These tickers were unknown or had no recent price data.
            </div>
            <div className="flex justify-end mt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
            {serverError}
          </div>
        )}

        {!skipped && (
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              leftIcon={
                isSubmitting ? <Loader2 size={16} className="animate-spin" /> : undefined
              }
            >
              {isSubmitting ? 'Creating...' : 'Create Portfolio'}
            </Button>
          </div>
        )}
      </form>
    </Modal>
  );
}
