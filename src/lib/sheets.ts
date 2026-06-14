import { google, sheets_v4 } from 'googleapis';
import { StockRow } from '@/types';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

let cachedClient: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  cachedClient = google.sheets({ version: 'v4', auth });
  return cachedClient;
}

/**
 * Read STOCK_MASTER sheet.
 * Expected columns:
 * A Material Code | B Brand | C Technical | D Packing | E Batch
 * F Qty | G Cases | H Storage | I Locations
 */
export async function readStockMaster(): Promise<StockRow[]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: 'Safex_STOCK_MASTER!A2:M',
});

const rows = res.data.values || [];

console.log(
  "SHERDIL TEST",
  rows.find((r) => (r[0] || "").includes("SHERDIL"))
);
  return rows
  .filter((r) => r[0])
  .map((r) => ({
    materialCode: '',
    brand: r[0] || '',
    technical: '',
    packing: r[1] || '',
    batch: r[2] || '',
    qty: parseFloat(r[4] || '0') || 0,
    cases: 0,
    storage: r[7] || '',
    locations: [r[10], r[11], r[12]]
      .filter(Boolean)
      .join(','),
  }));
  
}

export async function appendRow(sheetName: string, row: (string | number)[]): Promise<void> {
  const sheets = getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function appendDispatchHistory(payload: {
  pickId: string;
  invoiceNo: string;
  party: string;
  brand: string;
  pack: string;
  batch: string;
  qty: number;
  cases: number;
  expectedLocation: string;
  actualLocation: string;
  user: string;
}) {
  await appendRow('DISPATCH_HISTORY', [
    payload.pickId,
    payload.invoiceNo,
    payload.party,
    new Date().toISOString().slice(0, 10),
    payload.brand,
    payload.pack,
    payload.batch,
    payload.qty,
    payload.cases,
    payload.expectedLocation,
    payload.actualLocation,
    payload.user,
    new Date().toISOString(),
  ]);
}

export async function appendNotFoundLog(payload: {
  pickId: string;
  invoiceNo: string;
  party: string;
  brand: string;
  pack: string;
  batch: string;
  qty: number;
  expectedLocation: string;
  reason: string;
  user: string;
}) {
  await appendRow('NOT_FOUND_LOG', [
    payload.pickId,
    payload.invoiceNo,
    payload.party,
    new Date().toISOString().slice(0, 10),
    payload.brand,
    payload.pack,
    payload.batch,
    payload.qty,
    payload.expectedLocation,
    payload.reason,
    payload.user,
    new Date().toISOString(),
    'PENDING',
  ]);
}

export async function appendLocationCorrection(payload: {
  brand: string;
  pack: string;
  batch: string;
  expectedLocation: string;
  actualLocation: string;
  user: string;
}) {
  await appendRow('LOCATION_CORRECTION_LOG', [
    `LC-${Date.now()}`,
    payload.brand,
    payload.pack,
    payload.batch,
    payload.expectedLocation,
    payload.actualLocation,
    payload.user,
    new Date().toISOString(),
    'PENDING',
    '',
    '',
    '',
  ]);
}

export async function readSheet(sheetName: string, range: string = 'A2:Z'): Promise<string[][]> {
  const sheets = getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!${range}`,
  });
  return (res.data.values as string[][]) || [];
}

export async function updateCell(
  sheetName: string,
  cell: string,
  value: string
): Promise<void> {
  const sheets = getClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!${cell}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}
