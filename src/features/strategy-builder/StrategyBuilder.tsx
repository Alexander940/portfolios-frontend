import { useCallback, useEffect, useMemo, useState } from 'react';

import './builder.css';
import { BuilderForm } from './components/BuilderForm';
import { ListView } from './components/ListView';
import { ResultsView } from './components/ResultsView';
import { Icon } from './icons';
import {
  adaptResult,
  cfgToSpec,
  DEFAULT_CONFIG,
  type DisplayResult,
  normalizeCfg,
  sparkFromResult,
} from './mapping';
import { createStrategy, getBacktest, runBacktest } from './service';
import { useStrategyStore } from './store';
import type { BacktestStatusResponse, BuilderConfig, SavedStrategy } from './types';

type View = 'list' | 'build' | 'results';
type RunStatus = 'idle' | 'running' | 'done' | 'error';

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return 'Backtest failed';
}

/** Merge local entries (drafts + this client's backtested runs) with the ones
 *  fetched from the backend; local wins on id collision (it carries the backtest
 *  summary/sparkline). Newest first. */
function mergeStrategies(local: SavedStrategy[], server: SavedStrategy[]): SavedStrategy[] {
  const byId = new Map<string, SavedStrategy>();
  for (const s of server) byId.set(s.id, s);
  for (const s of local) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => b.updated - a.updated);
}

// The backtest runs asynchronously on the backend (it can take a few minutes on
// a large universe / long window), so poll generously — ~10 min at 2.5s.
async function pollBacktest(jobId: string, tries = 240): Promise<BacktestStatusResponse> {
  for (let i = 0; i < tries; i++) {
    const res = await getBacktest(jobId);
    if (res.status === 'done' || res.status === 'error') return res;
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error('Backtest is taking longer than expected — check back shortly.');
}

export function StrategyBuilder() {
  const local = useStrategyStore((s) => s.strategies);
  const server = useStrategyStore((s) => s.server);
  const loadServer = useStrategyStore((s) => s.loadServer);
  const upsert = useStrategyStore((s) => s.upsert);
  const remove = useStrategyStore((s) => s.remove);
  const strategies = useMemo(() => mergeStrategies(local, server), [local, server]);

  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<{ id: string | null; cfg: BuilderConfig }>({
    id: null,
    cfg: DEFAULT_CONFIG,
  });
  const [editKey, setEditKey] = useState(0);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [activeName, setActiveName] = useState('');
  const [activeCfg, setActiveCfg] = useState<BuilderConfig>(DEFAULT_CONFIG);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Hydrate server-persisted strategies (incl. ones the AI assistant created)
  // whenever the list is shown, so they appear next to local drafts/backtests.
  useEffect(() => {
    if (view === 'list') void loadServer();
  }, [view, loadServer]);

  const runFlow = useCallback(
    async (rawCfg: BuilderConfig) => {
      const cfg = normalizeCfg(rawCfg);
      setView('results');
      setStatus('running');
      setActiveName(cfg.name);
      setActiveCfg(cfg);
      setErrorMsg(null);
      setResult(null);
      try {
        const created = await createStrategy(cfg.name, cfgToSpec(cfg));
        const submit = await runBacktest(created.strategy_id);
        const final =
          submit.status === 'done' || submit.status === 'error'
            ? await getBacktest(submit.job_id)
            : await pollBacktest(submit.job_id);

        if (final.status !== 'done' || !final.result) {
          setStatus('error');
          setErrorMsg(final.error ?? 'Backtest failed');
          upsert({ id: created.strategy_id, name: cfg.name, status: 'draft', cfg, updated: Date.now() });
          return;
        }
        const display = adaptResult(final.result);
        setResult(display);
        setStatus('done');
        upsert({
          id: created.strategy_id,
          name: cfg.name,
          status: 'backtested',
          cfg,
          updated: Date.now(),
          jobId: final.job_id,
          summary: {
            totalReturn: display.metrics.totalReturn,
            sharpe: display.metrics.sharpe,
            maxDD: display.metrics.maxDD,
            trades: display.metrics.trades,
            lowConf: display.metrics.lowConf,
          },
          spark: sparkFromResult(final.result),
        });
      } catch (e) {
        setStatus('error');
        setErrorMsg(errMessage(e));
      }
    },
    [upsert],
  );

  const goNew = () => {
    setEditing({ id: null, cfg: { ...DEFAULT_CONFIG } });
    setEditKey((k) => k + 1);
    setView('build');
  };
  const goEdit = (s: SavedStrategy) => {
    setEditing({ id: s.id, cfg: normalizeCfg(s.cfg) });
    setEditKey((k) => k + 1);
    setView('build');
  };
  const editFromResults = () => {
    setEditing({ id: null, cfg: activeCfg });
    setEditKey((k) => k + 1);
    setView('build');
  };
  const saveDraft = (cfg: BuilderConfig) => {
    const id = editing.id ?? `draft-${Date.now()}`;
    upsert({ id, name: cfg.name, status: 'draft', cfg, updated: Date.now() });
    setView('list');
  };
  const goOpen = async (s: SavedStrategy) => {
    if (!s.jobId) {
      goEdit(s);
      return;
    }
    setView('results');
    setStatus('running');
    setActiveName(s.name);
    setActiveCfg(normalizeCfg(s.cfg));
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await getBacktest(s.jobId);
      if (res.status === 'done' && res.result) {
        setResult(adaptResult(res.result));
        setStatus('done');
      } else {
        setStatus('error');
        setErrorMsg(res.error ?? 'Result unavailable');
      }
    } catch (e) {
      setStatus('error');
      setErrorMsg(errMessage(e));
    }
  };

  const headerTitle =
    view === 'list' ? 'Strategy Builder' : view === 'build' ? editing.cfg.name : activeName;
  const headerSub =
    view === 'list'
      ? 'Build, backtest and compare rules-based strategies against the S&P 500.'
      : view === 'build'
        ? 'Define rules, validate, then backtest.'
        : 'Backtest results';

  return (
    <div className="sb">
      {view === 'list' ? (
        <div className="page-header">
          <div>
            <h1 className="page-title">{headerTitle}</h1>
            <div className="page-sub">{headerSub}</div>
          </div>
          <button className="sb-btn primary" style={{ width: 'auto' }} onClick={goNew}>
            <Icon name="plus" size={13} /> New strategy
          </button>
        </div>
      ) : (
        <>
          <div className="sb-head">
            <button className="sb-back" onClick={() => setView('list')}>
              <Icon name="back" size={14} /> Strategies
            </button>
            <div className="sb-head-spacer" />
            {view === 'results' && status === 'done' && (
              <button className="sb-back" onClick={editFromResults}>
                <Icon name="edit" size={13} /> Edit
              </button>
            )}
          </div>
          <div className="page-header" style={{ marginBottom: 18 }}>
            <div>
              <h1 className="page-title">{headerTitle}</h1>
              <div className="page-sub">{headerSub}</div>
            </div>
          </div>
        </>
      )}

      {view === 'list' && (
        <ListView
          strategies={strategies}
          onNew={goNew}
          onOpen={goOpen}
          onEdit={goEdit}
          onBacktest={(s) => runFlow(s.cfg)}
          onDelete={(s) => remove(s.id)}
        />
      )}

      {view === 'build' && (
        <BuilderForm
          key={editKey}
          initialCfg={editing.cfg}
          busy={false}
          onCancel={() => setView('list')}
          onSave={saveDraft}
          onSaveBacktest={runFlow}
        />
      )}

      {view === 'results' && (
        <ResultsView
          status={status === 'running' ? 'running' : status === 'error' ? 'error' : 'done'}
          result={result}
          strategyName={activeName}
          errorMsg={errorMsg}
          onRetry={() => runFlow(activeCfg)}
          onEdit={editFromResults}
        />
      )}
    </div>
  );
}
