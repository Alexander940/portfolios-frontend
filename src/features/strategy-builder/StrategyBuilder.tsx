import { useCallback, useEffect, useMemo, useState } from 'react';

import './builder.css';
import { BuilderForm } from './components/BuilderForm';
import { ListView } from './components/ListView';
import { ResultsView } from './components/ResultsView';
import { TemplateGallery } from './components/TemplateGallery';
import { Icon } from './icons';
import {
  adaptResult,
  cfgToSpec,
  DEFAULT_CONFIG,
  type DisplayResult,
  mergeSpecPreserving,
  normalizeCfg,
  sparkFromResult,
  unsupportedUniverseFilters,
} from './mapping';
import { createStrategy, getBacktest, listTemplates, runBacktest } from './service';
import { useStrategyStore } from './store';
import type {
  BacktestStatusResponse,
  BuilderConfig,
  SavedStrategy,
  StrategySpec,
  TemplateListItem,
} from './types';

type View = 'list' | 'build' | 'results' | 'templates';
type RunStatus = 'idle' | 'running' | 'done' | 'error';

function errMessage(e: unknown): string {
  if (e && typeof e === 'object') {
    const err = e as { status?: number; response?: { status?: number }; message?: unknown };
    if ((err.status ?? err.response?.status) === 409) {
      return 'You already have a strategy with this name — rename it to save this run as a new strategy.';
    }
    if (typeof err.message === 'string') return err.message;
  }
  return 'Backtest failed';
}

/** Merge local entries (drafts + this client's backtested runs) with the ones
 *  fetched from the backend; local wins on id collision (it carries the backtest
 *  summary/sparkline) but inherits the server row's spec + template provenance
 *  (the local copy never has them). Newest first. */
function mergeStrategies(local: SavedStrategy[], server: SavedStrategy[]): SavedStrategy[] {
  const byId = new Map<string, SavedStrategy>();
  for (const s of server) byId.set(s.id, s);
  for (const s of local) {
    const srv = byId.get(s.id);
    byId.set(
      s.id,
      srv
        ? {
            ...s,
            spec: s.spec ?? srv.spec,
            templateSlug: s.templateSlug ?? srv.templateSlug,
            templateVersion: s.templateVersion ?? srv.templateVersion,
          }
        : s,
    );
  }
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

interface RunOpts {
  /** Original server spec: form output is merged over it so live-only filters
   *  survive the edit round-trip (issue #59 / the #34 lossy-mapping gap). */
  baseSpec?: StrategySpec;
  /** Backtest an ALREADY-persisted strategy without re-creating it (the old
   *  flow created a duplicate row per run — and now the server 409s duplicate
   *  names, issue #58). */
  existingId?: string;
}

export function StrategyBuilder() {
  const local = useStrategyStore((s) => s.strategies);
  const server = useStrategyStore((s) => s.server);
  const loadServer = useStrategyStore((s) => s.loadServer);
  const upsert = useStrategyStore((s) => s.upsert);
  const remove = useStrategyStore((s) => s.remove);
  const strategies = useMemo(() => mergeStrategies(local, server), [local, server]);

  const [view, setView] = useState<View>('list');
  const [editing, setEditing] = useState<{
    id: string | null;
    cfg: BuilderConfig;
    baseSpec?: StrategySpec;
  }>({ id: null, cfg: DEFAULT_CONFIG });
  const [editKey, setEditKey] = useState(0);
  const [status, setStatus] = useState<RunStatus>('idle');
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [activeName, setActiveName] = useState('');
  const [activeCfg, setActiveCfg] = useState<BuilderConfig>(DEFAULT_CONFIG);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateListItem[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Hydrate server-persisted strategies (incl. ones the AI assistant created)
  // whenever the list is shown, so they appear next to local drafts/backtests.
  useEffect(() => {
    if (view === 'list') void loadServer();
  }, [view, loadServer]);

  // Template catalog: fetched once — feeds the gallery AND the "vN available"
  // upgrade notice on the list cards.
  useEffect(() => {
    listTemplates()
      .then((ts) => setTemplates(ts))
      .catch(() => setTemplatesError('Could not load the template catalog.'));
  }, []);

  const templateLatest = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of templates ?? []) out[t.slug] = t.latest_version;
    return out;
  }, [templates]);

  const runFlow = useCallback(
    async (rawCfg: BuilderConfig, opts: RunOpts = {}) => {
      const cfg = normalizeCfg(rawCfg);
      setView('results');
      setStatus('running');
      setActiveName(cfg.name);
      setActiveCfg(cfg);
      setErrorMsg(null);
      setResult(null);
      try {
        // Preserve live-only filters: merge the form output over the original
        // server spec when editing a persisted strategy.
        const spec = opts.baseSpec
          ? mergeSpecPreserving(opts.baseSpec, cfgToSpec(cfg))
          : cfgToSpec(cfg);
        const strategyId = opts.existingId ?? (await createStrategy(cfg.name, spec)).strategy_id;
        const submit = await runBacktest(strategyId);
        const final =
          submit.status === 'done' || submit.status === 'error'
            ? await getBacktest(submit.job_id)
            : await pollBacktest(submit.job_id);

        if (final.status !== 'done' || !final.result) {
          setStatus('error');
          setErrorMsg(final.error ?? 'Backtest failed');
          upsert({ id: strategyId, name: cfg.name, status: 'draft', cfg, updated: Date.now() });
          return;
        }
        const display = adaptResult(final.result);
        setResult(display);
        setStatus('done');
        upsert({
          id: strategyId,
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
    setEditing({ id: s.id, cfg: normalizeCfg(s.cfg), baseSpec: s.spec });
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
  const goBacktest = (s: SavedStrategy) => {
    // A persisted strategy is backtested AS SAVED (no duplicate row, no lossy
    // re-mapping); only local drafts go through create-from-config.
    const isServer = !s.id.startsWith('draft-');
    void runFlow(s.cfg, isServer ? { existingId: s.id, baseSpec: s.spec } : {});
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

  const handleDelete = useCallback(
    async (s: SavedStrategy) => {
      if (
        !window.confirm(
          `Delete "${s.name}"? This also removes its backtests and can't be undone.`,
        )
      ) {
        return;
      }
      try {
        await remove(s.id);
      } catch {
        window.alert('Could not delete this strategy. Try again in a moment.');
      }
    },
    [remove],
  );

  const preservedFilters = useMemo(
    () => (editing.baseSpec ? unsupportedUniverseFilters(editing.baseSpec) : undefined),
    [editing.baseSpec],
  );

  const headerTitle =
    view === 'list'
      ? 'Strategy Builder'
      : view === 'templates'
        ? 'Templates'
        : view === 'build'
          ? editing.cfg.name
          : activeName;
  const headerSub =
    view === 'list'
      ? 'Build, backtest and compare rules-based strategies against the S&P 500.'
      : view === 'templates'
        ? 'Curated strategy profiles — create a ready-made strategy in one click.'
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
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="sb-btn" style={{ width: 'auto' }} onClick={() => setView('templates')}>
              <Icon name="blocks" size={13} /> From template
            </button>
            <button className="sb-btn primary" style={{ width: 'auto' }} onClick={goNew}>
              <Icon name="plus" size={13} /> New strategy
            </button>
          </div>
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
          templateLatest={templateLatest}
          onNew={goNew}
          onOpen={goOpen}
          onEdit={goEdit}
          onBacktest={goBacktest}
          onDelete={handleDelete}
        />
      )}

      {view === 'templates' && (
        <TemplateGallery
          templates={templates}
          loadError={templatesError}
          onCreated={() => setView('list')}
        />
      )}

      {view === 'build' && (
        <BuilderForm
          key={editKey}
          initialCfg={editing.cfg}
          busy={false}
          preservedFilters={preservedFilters}
          onCancel={() => setView('list')}
          onSave={saveDraft}
          onSaveBacktest={(cfg) => void runFlow(cfg, { baseSpec: editing.baseSpec })}
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
