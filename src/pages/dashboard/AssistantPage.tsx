import { Assistant } from '@/features/chat';

/**
 * AssistantPage — AI stock-analysis chat. Rendered full-bleed by
 * DashboardLayout (no padded content wrapper) so the chat fills the
 * shell with its own scroll area and pinned composer.
 */
export function AssistantPage() {
  return <Assistant />;
}
