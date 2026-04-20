import { Screener } from '@/features/screener';

export function ScreeningPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Screening</h1>
          <div className="page-sub">
            Filter and find stocks based on your criteria.
          </div>
        </div>
      </div>

      <Screener />
    </>
  );
}
