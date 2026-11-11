import { Bell, BookOpen, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  text: string;
}

const FEATURES: Feature[] = [
  {
    icon: TrendingUp,
    title: 'Screener with a variety of indicators',
    text: 'Filter the universe with technical and fundamental indicators, and save your presets.',
  },
  {
    icon: BookOpen,
    title: 'Portfolios with a transaction ledger',
    text: 'Positions and performance against the benchmark derived from the ledger; rebalancing with preview and history.',
  },
  {
    icon: Bell,
    title: 'Alerts and news indicator',
    text: 'Rating changes, earnings and news classified by symbol, in a single feed.',
  },
];

/**
 * LoginArt — left panel of the login page (hidden under 980px).
 *
 * Describes what the product actually does. Deliberately free of
 * invented figures, fake certifications and live-status chrome (#34).
 */
export function LoginArt() {
  return (
    <div className="art-prime">
      <div className="art-grid" aria-hidden="true" />

      <div className="art-content">
        <div className="art-brand">
          <div className="art-brand-mark" aria-hidden="true">
            P
          </div>
          <span className="art-brand-name">Portafolios</span>
        </div>

        <div className="art-hero">
          <div className="art-eyebrow">Stock portfolio management</div>
          <h1 className="art-headline">
            Screen, build and{' '}
            <span className="art-headline-accent">track</span> your portfolios.
          </h1>
        </div>

        <ul className="art-features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="art-feature">
              <span className="art-feature-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={1.8} />
              </span>
              <div className="art-feature-body">
                <div className="art-feature-title">{title}</div>
                <div className="art-feature-text">{text}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="art-footer">
        <div>End-of-day market data · updated nightly</div>
        <div>portafolios.site</div>
      </div>
    </div>
  );
}
