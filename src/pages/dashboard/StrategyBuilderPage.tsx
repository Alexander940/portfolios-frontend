import { StrategyBuilder } from '@/features/strategy-builder';

/**
 * StrategyBuilderPage — build a rules-based StrategySpec, backtest it against
 * historical data, and see how it would have performed versus the S&P 500.
 */
export function StrategyBuilderPage() {
  return <StrategyBuilder />;
}
