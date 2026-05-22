import * as XLSX from 'xlsx';

export class TickerExcelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TickerExcelParseError';
  }
}

const ACCEPTED_HEADERS = ['tickers', 'ticker', 'symbol', 'symbols'];

export interface ParseTickersResult {
  tickers: string[];
  headerUsed: string;
  rowsRead: number;
}

/**
 * Read a `.xlsx` / `.xls` / `.csv` file and extract all values from
 * a column named `tickers` (also accepts `ticker`, `symbol`, `symbols`).
 * Header matching is case- and whitespace-insensitive.
 *
 * Returns the list of normalized tickers (uppercased, trimmed, deduped)
 * preserving the order of first appearance in the sheet.
 */
export async function parseTickersFromExcel(file: File): Promise<ParseTickersResult> {
  const buf = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buf, { type: 'array' });
  } catch {
    throw new TickerExcelParseError(
      'Could not read the file. Make sure it is a valid Excel or CSV file.',
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new TickerExcelParseError('The file does not contain any sheets.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });

  if (rows.length === 0) {
    throw new TickerExcelParseError('The sheet is empty.');
  }

  const firstRow = rows[0];
  const headerKey = Object.keys(firstRow).find((k) =>
    ACCEPTED_HEADERS.includes(k.trim().toLowerCase()),
  );

  if (!headerKey) {
    throw new TickerExcelParseError(
      `Could not find a "tickers" column. Expected one of: ${ACCEPTED_HEADERS.join(', ')}.`,
    );
  }

  const seen = new Set<string>();
  const tickers: string[] = [];
  for (const row of rows) {
    const raw = row[headerKey];
    if (raw === null || raw === undefined) continue;
    const value = String(raw).trim().toUpperCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    tickers.push(value);
  }

  if (tickers.length === 0) {
    throw new TickerExcelParseError(
      `The "${headerKey}" column is empty.`,
    );
  }

  return {
    tickers,
    headerUsed: headerKey,
    rowsRead: rows.length,
  };
}
