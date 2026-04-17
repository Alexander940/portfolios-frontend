import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bookmark, Loader2 } from 'lucide-react';
import axios from 'axios';
import { Modal, Button, Input } from '@/components/ui';
import { useScreenerStore } from '../stores';
import {
  createPortfolioFromScreener,
  type WeightingMethod,
} from '@/services/portfolioService';

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

interface SavePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalCount: number;
}

const WEIGHTING_OPTIONS: { value: WeightingMethod; label: string; hint: string }[] = [
  { value: 'equal', label: 'Equal Weight', hint: 'Same allocation for every stock' },
  { value: 'rating_weighted', label: 'Rating Weighted', hint: 'Higher rating → higher weight' },
  { value: 'market_cap', label: 'Market Cap Weighted', hint: 'Larger companies get more weight' },
];

export function SavePortfolioModal({
  isOpen,
  onClose,
  totalCount,
}: SavePortfolioModalProps) {
  const navigate = useNavigate();
  const getApiRequest = useScreenerStore((s) => s.getApiRequest);
  const [serverError, setServerError] = useState<string | null>(null);

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

  function handleClose() {
    reset();
    setServerError(null);
    onClose();
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const filters = getApiRequest();
      const response = await createPortfolioFromScreener({
        name: values.name,
        description: values.description || null,
        initial_cash: values.initial_cash,
        weighting_method: values.weighting_method,
        screener_filters: filters,
      });
      reset();
      onClose();
      navigate(`/dashboard/analysis/${response.portfolio.portfolio_id}`);
    } catch (err) {
      let message = 'Could not create portfolio. Please try again.';
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') message = detail;
      }
      setServerError(message);
    }
  }

  const tooMany = totalCount > 100;
  const noResults = totalCount === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Save as Portfolio"
      description="Create a model portfolio from the current screener filters."
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Portfolio name"
          type="text"
          error={errors.name?.message}
          {...register('name')}
        />

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description (optional)
          </label>
          <textarea
            id="description"
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

        {/* Preview */}
        <div
          className={`
            flex items-center gap-2 p-3 rounded-lg text-sm
            ${
              tooMany || noResults
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }
          `}
        >
          <Bookmark size={16} />
          {noResults ? (
            <span>No stocks match the current filters.</span>
          ) : tooMany ? (
            <span>
              {totalCount.toLocaleString()} stocks match — narrow filters to ≤ 100 to
              save as portfolio.
            </span>
          ) : (
            <span>
              Portfolio will include{' '}
              <strong>{totalCount.toLocaleString()} stocks</strong>.
            </span>
          )}
        </div>

        {serverError && (
          <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
            {serverError}
          </div>
        )}

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
            disabled={isSubmitting || tooMany || noResults}
            leftIcon={
              isSubmitting ? <Loader2 size={16} className="animate-spin" /> : undefined
            }
          >
            {isSubmitting ? 'Creating...' : 'Create Portfolio'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
