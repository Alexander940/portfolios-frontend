// Pure helpers for the Selection funnel tab (issue #174, Fase B). Kept apart
// from `mapping.ts` (already ~1150 lines of cfg<->spec plumbing) because these
// operate on a completely different shape — the `selection-trace` response,
// not `StrategySpec`/`BuilderConfig` — and are exercised directly by the
// executable check `tests/checks/funnel-view.ts` (Playwright can't launch in
// this WSL, so this is the oracle that actually runs).
import type { SelectionRow, SelectionStage, SelectionStageKey } from './types';

/** Pipeline order the engine actually runs in — mirrors `stages[]` from the
 *  endpoint, and is the ONLY source of stage ordering (never infer it from
 *  array position: `stages[]` is a fixed contract but this list is what the
 *  filtering math below depends on). */
export const STAGE_ORDER: SelectionStageKey[] = [
  'universe',
  'selection_rules',
  'ranking',
  'weighting',
  'execution',
];

export const STAGE_LABELS: Record<SelectionStageKey, string> = {
  universe: 'Universe',
  selection_rules: 'Selection rules',
  ranking: 'Ranking',
  weighting: 'Weighting',
  execution: 'Execution',
};

function stageIndex(key: SelectionStageKey): number {
  const i = STAGE_ORDER.indexOf(key);
  return i === -1 ? Infinity : i;
}

/** A candidate is "at" a stage if it survived that stage's cut — i.e. it
 *  wasn't the one eliminated there. `exit_stage: null` means it rode all the
 *  way to the portfolio, so it's present at every stage. This is what makes
 *  `rowsAtStage(rows, 'ranking').length === stages.find(s=>s.key==='ranking').count`
 *  hold: each stage's `count` in the contract is its OUTPUT size (survivors),
 *  not its input, so a row eliminated exactly at stage X is excluded from X's
 *  own count but included in every stage before it. */
export function rowsAtStage(rows: SelectionRow[], stageKey: SelectionStageKey): SelectionRow[] {
  const idx = stageIndex(stageKey);
  return rows.filter((r) => r.exit_stage == null || stageIndex(r.exit_stage) > idx);
}

/** Human label for a row's fate: "In portfolio" for `exit_stage: null`, never
 *  treated as an exit stage itself — this is the distinction the #174 check
 *  guards (a portfolio holding must not read as having "exited" anywhere). */
export function exitStageLabel(exitStage: SelectionStageKey | null): string {
  if (exitStage == null) return 'In portfolio';
  return STAGE_LABELS[exitStage] ?? exitStage;
}

/** Short exit-reason code -> readable text. The contract fixes the code list
 *  (`top_n_cut`, `per_sector_full`, `below_floor`, `no_price`, `turnover_cap`,
 *  `min_trade`, `min_holding`, `max_entries`); every one of them must resolve
 *  to prose here, never render as the raw snake_case code. An unrecognized
 *  code (future addition on the backend side) still gets humanized rather
 *  than shown verbatim. */
const REASON_LABELS: Record<string, string> = {
  top_n_cut: 'Cut by the top-N ranking cutoff',
  per_sector_full: 'Sector allocation cap reached',
  below_floor: 'Weight fell below the minimum floor',
  no_price: 'No price available on the rebalance date',
  turnover_cap: 'Blocked by the turnover cap',
  min_trade: 'Below the minimum trade size',
  min_holding: 'Held below the minimum holding period',
  max_entries: 'Rebalance entry limit reached',
};

export function reasonLabel(reason: string | null): string {
  if (!reason) return '—';
  return REASON_LABELS[reason] ?? reason.replace(/_/g, ' ');
}

/** Drop caption for the stage rail: "no rules" when the section doesn't apply
 *  (greyed per the approved design — stages never hide), otherwise the count
 *  dropped relative to the previous stage. */
export function stageDropLabel(stage: SelectionStage): string {
  if (!stage.applies) return 'no rules';
  if (stage.dropped_from_prev <= 0) return 'no change';
  return `−${stage.dropped_from_prev.toLocaleString()}`;
}

export interface RankingTieInfo {
  tied: boolean;
  /** The best (numerically highest) score seen among ranked candidates. */
  topScore: number | null;
  /** How many candidates share that top score. */
  tiedCount: number;
}

/** Detects the design's called-out failure mode: a ranking key with few
 *  distinct values (e.g. `rating`, an integer from -3 to +3) ties out dozens
 *  of candidates for the best score, so "who's #1" is arbitrary among the
 *  tied set. Looks at the best score across ALL ranked rows (not just the
 *  chosen top-N) because the tie can extend past the cutoff — the reference
 *  case ties ranks 1-40 on a top_n of 30. Fires only when 2+ rows share the
 *  max; a strictly-decreasing top never trips it. */
export function detectRankingTies(rows: SelectionRow[]): RankingTieInfo {
  const scored = rows.filter(
    (r): r is SelectionRow & { score: number; rank: number } => r.score != null && r.rank != null,
  );
  if (scored.length === 0) return { tied: false, topScore: null, tiedCount: 0 };
  const topScore = Math.max(...scored.map((r) => r.score));
  const tiedCount = scored.filter((r) => r.score === topScore).length;
  return { tied: tiedCount > 1, topScore, tiedCount };
}
