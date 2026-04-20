/**
 * LoginArt — decorative left panel for the login page.
 *
 * Ported from the Cloud Design Prime variation: animated gradient mesh
 * background, subtle grid overlay, eyebrow text, headline, and two
 * floating glass cards previewing portfolio data + an event feed.
 *
 * Pure presentational — no interaction, no real data.
 */
export function LoginArt() {
  const series = [
    42, 45, 43, 48, 52, 50, 55, 58, 56, 62, 65, 63, 68, 72, 70, 75, 78, 82, 80,
    85,
  ];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const w = 320;
  const h = 80;
  const step = w / (series.length - 1);
  const path = series
    .map((v, i) => `${i * step},${h - ((v - min) / (max - min)) * h}`)
    .join(' L ');

  return (
    <div className="art-prime">
      <div className="art-mesh" />
      <div className="art-grid" />
      <div className="art-content">
        <div className="art-eyebrow">Portafolios / v1.0</div>
        <h1 className="art-headline">
          The control room for{' '}
          <span className="art-headline-accent">disciplined</span> portfolio
          managers.
        </h1>
        <p className="art-sub">
          Monitor every position, react to rating changes the moment they hit
          the tape, and rebalance with conviction.
        </p>

        <div className="art-card art-card-1">
          <div className="art-card-head">
            <div>
              <div className="art-card-label">Global Growth Composite</div>
              <div className="art-card-code">GGC · MSCI ACWI</div>
            </div>
            <div className="art-card-tcr">A</div>
          </div>
          <div>
            <div className="art-card-stat-v">+14.2%</div>
            <div className="art-card-stat-d">+2.4% vs benchmark · YTD</div>
          </div>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="art-card-spark"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <path d={`M ${path} L ${w},${h} L 0,${h} Z`} fill="url(#sparkGrad)" />
            <path
              d={`M ${path}`}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>
        </div>

        <div className="art-card art-card-2">
          <div className="art-event-row">
            <span className="art-event-icon up">↑</span>
            <span className="art-event-tk">NVDA</span>
            <span className="art-event-trans">
              <span className="dim">B+</span> → <b>A</b>
            </span>
            <span className="art-event-time">09:41</span>
          </div>
          <div className="art-event-row">
            <span className="art-event-icon up">↑</span>
            <span className="art-event-tk">AVGO</span>
            <span className="art-event-trans">
              <span className="dim">A−</span> → <b>A</b>
            </span>
            <span className="art-event-time">09:38</span>
          </div>
          <div className="art-event-row">
            <span className="art-event-icon down">↓</span>
            <span className="art-event-tk">TXN</span>
            <span className="art-event-trans">
              <span className="dim">A</span> → <b>B+</b>
            </span>
            <span className="art-event-time">09:32</span>
          </div>
        </div>
      </div>

      <div className="art-footer">
        <div>SOC 2 Type II · ISO 27001 · MiFID II ready</div>
        <div className="art-status">
          <span className="art-status-dot" /> Markets open · NYSE
        </div>
      </div>
    </div>
  );
}
