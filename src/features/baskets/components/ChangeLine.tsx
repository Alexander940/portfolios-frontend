import type { BasketChange } from '../types';

/** Una línea de cambio de composición: «▲ TWLO» (entered) / «▼ WBD» (left). */
export function ChangeLine({ change, showReason = false }: { change: BasketChange; showReason?: boolean }) {
  const entered = change.kind === 'entered';
  return (
    <li className="flex items-baseline gap-2 text-sm" data-testid="recent-change">
      <span className={`font-semibold ${entered ? 'text-emerald-700' : 'text-red-600'}`}>
        {entered ? '▲' : '▼'} {change.ticker}
      </span>
      {change.name && <span className="truncate text-gray-600">{change.name}</span>}
      <span className="ml-auto shrink-0 tabular-nums text-xs text-gray-500">
        {entered ? 'entered' : 'left'} {change.date}
      </span>
      {showReason && change.reason && (
        <span className="shrink-0 text-xs text-gray-400">· {change.reason}</span>
      )}
    </li>
  );
}
