import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bookmark, Loader2 } from 'lucide-react';
import axios from 'axios';
import { Button, Checkbox, Input, Modal } from '@/components/ui';
import { useScreenerStore, usePresetStore } from '../stores';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Max 255 characters'),
  description: z.string().trim().max(1000).optional(),
  is_public: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface SaveScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal that captures the current filter + view state and persists it as
 * a named preset. The actual snapshot comes from
 * `useScreenerStore.getCriteriaForSave()` so this component only owns the
 * form input and error surface — it never reads filter state directly.
 */
export function SaveScreenModal({ isOpen, onClose }: SaveScreenModalProps) {
  const getCriteriaForSave = useScreenerStore((s) => s.getCriteriaForSave);
  const savePreset = usePresetStore((s) => s.savePreset);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', is_public: false },
  });

  // Clear the form whenever the modal opens fresh.
  useEffect(() => {
    if (isOpen) {
      reset({ name: '', description: '', is_public: false });
      setServerError(null);
    }
  }, [isOpen, reset]);

  function handleClose() {
    if (!isSubmitting) onClose();
  }

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await savePreset({
        name: values.name,
        description: values.description?.trim() ? values.description : undefined,
        isPublic: values.is_public ?? false,
        criteria: getCriteriaForSave(),
      });
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string') {
          setServerError(detail);
          return;
        }
      }
      setServerError('Could not save screen. Try again.');
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Save screen"
      description="Persist the current filters and column preset so you can re-apply them in a future session."
      size="md"
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <Input
          label="Name"
          placeholder="e.g. Mega-cap tech with strong FCF"
          error={errors.name?.message}
          autoFocus
          {...register('name')}
        />

        <Input
          label="Description (optional)"
          placeholder="What this screen is looking for"
          error={errors.description?.message}
          {...register('description')}
        />

        <Checkbox label="Make this screen public" {...register('is_public')} />

        {serverError && (
          <div
            role="alert"
            style={{
              fontSize: 12,
              color: 'var(--c-danger, #ef4444)',
              padding: '8px 10px',
              border: '1px solid var(--c-danger, #ef4444)',
              borderRadius: 6,
            }}
          >
            {serverError}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 4,
          }}
        >
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            leftIcon={
              isSubmitting ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Bookmark size={14} />
              )
            }
          >
            {isSubmitting ? 'Saving...' : 'Save screen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
