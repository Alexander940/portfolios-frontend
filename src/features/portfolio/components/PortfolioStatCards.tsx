/**
 * PortfolioStatCards
 *
 * Top-of-page summary tiles for the Portfolio Analysis view. Values are
 * placeholders until the backend exposes aggregate metrics.
 */
const STATS = [
  { label: 'Total AUM', sub: 'Aggregated across portfolios' },
  { label: 'Avg. YTD', sub: 'Weighted by AUM' },
  { label: "Today's P&L", sub: 'Mark-to-market change' },
  { label: 'Events (24h)', sub: 'Upgrades · Downgrades' },
] as const;

export function PortfolioStatCards() {
  return (
    <div className="stat-row">
      {STATS.map((s) => (
        <div key={s.label} className="stat-card">
          <div className="stat-label">{s.label}</div>
          <div className="stat-value placeholder">—</div>
          <div className="stat-delta">
            <span>{s.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
