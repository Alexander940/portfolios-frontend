import { useParams } from 'react-router-dom';
import { BasketDetailView } from '@/features/baskets';

/**
 * BasketDetailPage — detalle de un basket (/dashboard/baskets/:id), #295.
 * `key` por id: al duplicar se navega a otro id y el estado se reinicia.
 */
export function BasketDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  return <BasketDetailView key={id} basketId={id} />;
}
