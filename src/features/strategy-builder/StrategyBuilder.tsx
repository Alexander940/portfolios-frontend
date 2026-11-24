import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { getErrorMessage } from '@/lib/apiErrors';

import './builder.css';
import { BuilderForm } from './components/BuilderForm';
import { ListView } from './components/ListView';
import { ResultsView } from './components/ResultsView';
import { ShareStrategyModal } from './components/ShareStrategyModal';
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
  specToConfig,
  unsupportedUniverseFilters,
} from './mapping';
import {
  createStrategy,
  duplicateStrategy,
  getBacktest,
  getStrategy,
  listTemplates,
  runBacktest,
  updateStrategy,
} from './service';
import { OWNER_ACCESS, useStrategyStore } from './store';
import type {
  BacktestStatusResponse,
  BuilderConfig,
  SavedStrategy,
  SharedStrategyListItem,
  StrategyDetailResponse,
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
  /** With `existingId`: PUT the (possibly edited) spec first, so date changes
   *  land as a NEW VERSION of the same strategy before the run. Only the edit
   *  flow sets this — the list's play button backtests the strategy as saved. */
  update?: boolean;
  /** Local draft card that this run persists server-side: drop it from the
   *  local store on success so the list doesn't show draft + backtested twins. */
  draftId?: string;
  /** Skip the backend dedupe (`POST …/backtest?force=true`, #278 D2): re-run a
   *  result persisted before the per-rebalance table so the «Rebalanceos» tab
   *  has data. Always creates a new job. */
  force?: boolean;
}

export function StrategyBuilder() {
  const local = useStrategyStore((s) => s.strategies);
  const server = useStrategyStore((s) => s.server);
  const loadServer = useStrategyStore((s) => s.loadServer);
  const upsert = useStrategyStore((s) => s.upsert);
  const remove = useStrategyStore((s) => s.remove);
  const forget = useStrategyStore((s) => s.forget);
  const openAccess = useStrategyStore((s) => s.openAccess);
  const setOpenAccess = useStrategyStore((s) => s.setOpenAccess);
  const strategies = useMemo(() => mergeStrategies(local, server), [local, server]);
  // The ONE place the caller's role on the open strategy turns into UI rights
  // (#349): a viewer gets a read-only form (Run only, no PUT); a co_owner
  // edits and shares; only the owner transfers, deletes and sees the tracker.
  const permission = openAccess.permission;
  const canEdit = permission !== 'viewer';
  const isOwner = permission === 'owner';

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
  const [notice, setNotice] = useState<string | null>(null);
  // The completed backtest's job id — feeds the results view's Selection tab
  // (`GET /backtests/{job_id}/selection-trace`, #174). State (not a ref, like
  // activeIdRef below): the results view needs to re-render when it changes.
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  // Last run's (cfg, opts) so Retry replays the SAME flow — retrying an edit of
  // a persisted strategy must not fall back to create (that duplicated/409'd).
  const lastRunRef = useRef<{ cfg: BuilderConfig; opts: RunOpts } | null>(null);
  // The persisted id + merged spec behind the results view, so "Edit" from
  // results keeps targeting the SAME strategy (id: null there meant the next
  // run created a duplicate).
  const activeIdRef = useRef<string | null>(null);
  const activeSpecRef = useRef<StrategySpec | null>(null);
  const [templates, setTemplates] = useState<TemplateListItem[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  // Duplicate / open failures, shown above the list or the form (#349).
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

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
      lastRunRef.current = { cfg: rawCfg, opts };
      activeIdRef.current = opts.existingId ?? null;
      activeSpecRef.current = opts.baseSpec ?? null;
      setView('results');
      setStatus('running');
      setActiveName(cfg.name);
      setActiveCfg(cfg);
      setErrorMsg(null);
      setResult(null);
      setNotice(null);
      setActiveJobId(null);
      // A strategy shared with the caller is never mirrored into the local
      // (own) list — that would show it as theirs, with Delete (#349).
      const keepLocal =
        !opts.existingId || useStrategyStore.getState().openAccess.permission === 'owner';
      try {
        // Preserve live-only filters: merge the form output over the original
        // server spec when editing a persisted strategy.
        const spec = opts.baseSpec
          ? mergeSpecPreserving(opts.baseSpec, cfgToSpec(cfg))
          : cfgToSpec(cfg);
        activeSpecRef.current = spec;
        let strategyId: string;
        if (opts.existingId) {
          strategyId = opts.existingId;
          // Edit flow: save the changed spec as a new version of the SAME
          // strategy — never a second row.
          if (opts.update) await updateStrategy(strategyId, cfg.name, spec);
        } else {
          strategyId = (await createStrategy(cfg.name, spec)).strategy_id;
          if (opts.draftId) void remove(opts.draftId);
        }
        activeIdRef.current = strategyId;
        const submit = await runBacktest(strategyId, opts.force ? { force: true } : {});
        setActiveJobId(submit.job_id);
        if (submit.cached && opts.existingId) {
          setNotice(
            "The backtest dates haven't changed since the last run — showing the existing result (nothing was re-run).",
          );
        }
        const final =
          submit.status === 'done' || submit.status === 'error'
            ? await getBacktest(submit.job_id)
            : await pollBacktest(submit.job_id);

        if (final.status !== 'done' || !final.result) {
          setStatus('error');
          setErrorMsg(final.error ?? 'Backtest failed');
          if (keepLocal) {
            upsert({ id: strategyId, name: cfg.name, status: 'draft', cfg, spec, updated: Date.now() });
          }
          return;
        }
        const display = adaptResult(final.result, final.warnings);
        setResult(display);
        setStatus('done');
        if (!keepLocal) return;
        upsert({
          id: strategyId,
          name: cfg.name,
          status: 'backtested',
          cfg,
          spec,
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
    [upsert, remove],
  );

  const goNew = () => {
    setOpenAccess(OWNER_ACCESS);
    setActionError(null);
    setEditing({ id: null, cfg: { ...DEFAULT_CONFIG } });
    setEditKey((k) => k + 1);
    setView('build');
  };
  const goEdit = (s: SavedStrategy) => {
    // Own list = the caller's strategies (local drafts + `GET /strategies`).
    setOpenAccess(OWNER_ACCESS);
    setActionError(null);
    setEditing({ id: s.id, cfg: normalizeCfg(s.cfg), baseSpec: s.spec });
    setEditKey((k) => k + 1);
    setView('build');
  };
  const editFromResults = () => {
    // Keep the persisted identity: editing from results must update the SAME
    // strategy on the next run, not create a duplicate (id: null did that).
    setEditing({
      id: activeIdRef.current,
      cfg: activeCfg,
      baseSpec: activeSpecRef.current ?? undefined,
    });
    setEditKey((k) => k + 1);
    setView('build');
  };
  const saveDraft = (cfg: BuilderConfig) => {
    // Never a local copy under someone else's id (#349) — the button is not
    // rendered for them either; this is the belt to that brace.
    if (!isOwner) return;
    const id = editing.id ?? `draft-${Date.now()}`;
    upsert({ id, name: cfg.name, status: 'draft', cfg, updated: Date.now() });
    setView('list');
  };
  const goBacktest = (s: SavedStrategy) => {
    // A persisted strategy is backtested AS SAVED (no duplicate row, no lossy
    // re-mapping); only local drafts go through create-from-config. An unchanged
    // spec dedupes server-side (cached) → the "dates haven't changed" notice.
    const isServer = !s.id.startsWith('draft-');
    setOpenAccess(OWNER_ACCESS);
    void runFlow(s.cfg, isServer ? { existingId: s.id, baseSpec: s.spec } : { draftId: s.id });
  };
  const goOpen = async (s: SavedStrategy) => {
    setOpenAccess(OWNER_ACCESS);
    setActionError(null);
    if (!s.jobId) {
      goEdit(s);
      return;
    }
    // Opening stored results: point the active refs at THIS strategy so an
    // Edit → re-run from here updates it instead of creating a duplicate.
    activeIdRef.current = s.id.startsWith('draft-') ? null : s.id;
    activeSpecRef.current = s.spec ?? null;
    lastRunRef.current = null;
    setView('results');
    setStatus('running');
    setActiveName(s.name);
    setActiveCfg(normalizeCfg(s.cfg));
    setResult(null);
    setErrorMsg(null);
    setNotice(null);
    setActiveJobId(s.jobId);
    try {
      const res = await getBacktest(s.jobId);
      if (res.status === 'done' && res.result) {
        setResult(adaptResult(res.result, res.warnings));
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

  // Open a persisted strategy from its detail (latest spec + the caller's
  // effective permission). No `permission` (older backend) → owner.
  const openDetail = (d: StrategyDetailResponse, fallbackOwnerEmail: string | null = null) => {
    setOpenAccess({
      permission: d.permission ?? 'owner',
      ownerEmail: d.owner_email ?? fallbackOwnerEmail,
    });
    setActionError(null);
    setEditing({ id: d.strategy_id, cfg: specToConfig(d.spec, d.name), baseSpec: d.spec });
    setEditKey((k) => k + 1);
    setView('build');
  };

  // Open a strategy shared WITH the caller (#348): always load the detail from
  // `GET /strategies/{id}` instead of the list row — the permission it carries
  // drives read-only mode (#349).
  const goOpenShared = async (s: SharedStrategyListItem) => {
    try {
      openDetail(await getStrategy(s.strategy_id), s.owner_email);
    } catch {
      window.alert('Could not open this strategy. Try again in a moment.');
    }
  };

  // «Duplicate» (#349): server-side copy of the latest version into a NEW
  // strategy the caller owns, then open it. On failure (409 name, 422
  // basket_not_found…) stay where we are and say why.
  const handleDuplicate = async (id: string) => {
    setActionError(null);
    try {
      const created = await duplicateStrategy(id);
      void loadServer();
      openDetail(await getStrategy(created.strategy_id));
    } catch (e) {
      setActionError(`Could not duplicate this strategy: ${getErrorMessage(e)}`);
    }
  };

  // Ownership handed over (#349): it is no longer in the caller's own list;
  // if it is the one open, the caller keeps editing it as co_owner.
  const handleTransferred = (id: string, detail?: StrategyDetailResponse) => {
    forget(id);
    void loadServer();
    if (detail && editing.id === id) {
      setOpenAccess({ permission: 'co_owner', ownerEmail: detail.owner_email ?? null });
    }
  };

  // «Volver a correr» from the Rebalanceos tab (#278, D2): the SAME persisted
  // strategy, as saved (no PUT), with the dedupe skipped — then the usual poll.
  const rerunForced = useCallback(() => {
    const id = activeIdRef.current;
    if (!id) return;
    void runFlow(activeCfg, {
      existingId: id,
      baseSpec: activeSpecRef.current ?? undefined,
      force: true,
    });
  }, [activeCfg, runFlow]);

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

  // The persisted strategy behind the form (null for new ones and local drafts).
  const persistedId =
    editing.id !== null && !editing.id.startsWith('draft-') ? editing.id : null;

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
            {view === 'build' && persistedId && (
              <>
                {isOwner && (
                  <Link
                    className="sb-back"
                    to={`/dashboard/strategy/${persistedId}`}
                    data-testid="sb-tracker-link"
                  >
                    <Icon name="play" size={13} /> Tracker
                  </Link>
                )}
                {canEdit && (
                  <button className="sb-back" data-testid="sb-share" onClick={() => setShareOpen(true)}>
                    <Icon name="share" size={13} /> Share
                  </button>
                )}
                <button
                  className="sb-back"
                  data-testid="sb-duplicate"
                  onClick={() => void handleDuplicate(persistedId)}
                >
                  <Icon name="copy" size={13} /> Duplicate
                </button>
              </>
            )}
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

      {actionError && (view === 'list' || view === 'build') && (
        <div className="sb-action-error" role="alert" data-testid="sb-action-error">
          <Icon name="warn" size={13} />
          <span>{actionError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setActionError(null)}>
            <Icon name="x" size={12} />
          </button>
        </div>
      )}

      {view === 'build' && permission === 'viewer' && (
        <div className="sb-readonly-note" data-testid="sb-readonly-banner">
          <Icon name="info" size={13} />
          <span>
            Read-only — shared by {openAccess.ownerEmail ?? 'another user'}. Run a backtest, or
            duplicate it to make changes.
          </span>
        </div>
      )}

      {shareOpen && persistedId && canEdit && (
        <ShareStrategyModal
          isOpen
          onClose={() => setShareOpen(false)}
          strategyId={persistedId}
          strategyName={editing.cfg.name}
          role={isOwner ? 'owner' : 'co_owner'}
          onTransferred={(d) => handleTransferred(persistedId, d)}
        />
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
          onOpenShared={goOpenShared}
          onDuplicate={(id) => void handleDuplicate(id)}
          onTransferred={(id) => handleTransferred(id)}
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
          readOnly={!canEdit}
          strategyId={persistedId}
          onCancel={() => setView('list')}
          // Local drafts only for the caller's own strategies (#349).
          onSave={isOwner ? saveDraft : undefined}
          onRun={(cfg) => {
            // Viewer: backtest the strategy AS SAVED — never a PUT.
            if (persistedId) void runFlow(cfg, { existingId: persistedId, baseSpec: editing.baseSpec });
          }}
          onSaveBacktest={(cfg) => {
            // Editing a persisted strategy → update it in place (new version of
            // the SAME row) and run; a draft/new config → create, replacing the
            // local draft card. The old flow always created → duplicates/409s.
            const id = editing.id;
            const isServer = id !== null && !id.startsWith('draft-');
            if (!canEdit) {
              if (isServer) void runFlow(cfg, { existingId: id, baseSpec: editing.baseSpec });
              return;
            }
            void runFlow(
              cfg,
              isServer
                ? { existingId: id, baseSpec: editing.baseSpec, update: true }
                : { baseSpec: editing.baseSpec, draftId: id ?? undefined },
            );
          }}
        />
      )}

      {view === 'results' && (
        <ResultsView
          status={status === 'running' ? 'running' : status === 'error' ? 'error' : 'done'}
          result={result}
          strategyName={activeName}
          errorMsg={errorMsg}
          notice={notice}
          costsAreZero={activeCfg.commission === 0 && activeCfg.slippage === 0}
          jobId={activeJobId}
          cadence={activeCfg.rebalance}
          universeBasketId={activeCfg.universeSource === 'basket' ? activeCfg.basketId : null}
          onRerun={rerunForced}
          onRetry={() => {
            // Replay the SAME flow (incl. existingId/update) — retrying an edit
            // of a persisted strategy must never fall back to create.
            const last = lastRunRef.current;
            void (last ? runFlow(last.cfg, last.opts) : runFlow(activeCfg));
          }}
          onEdit={editFromResults}
        />
      )}
    </div>
  );
}
