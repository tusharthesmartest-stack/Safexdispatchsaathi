export interface StockRow {
  materialCode: string;
  brand: string;
  technical: string;
  packing: string;
  batch: string;
  qty: number;
  cases: number;
  storage: string; // FGST or FGNS
  locations: string; // "A1,I3" comma-separated
}

export interface InvoiceLine {
  sn: number;
  productDesc: string;
  brand: string; // parsed from desc before "/"
  hsnCode: string;
  pack: string;
  batch: string;
  qty: number;
  cases: number;
}

export interface ParsedInvoice {
  invoiceNo: string;
  invoiceDate: string;
  party: string;
  destination: string;
  lines: InvoiceLine[];
}

export type MatchType = 'EXACT' | 'ALIAS' | 'BRAND_PACK' | 'MANUAL';

export interface PickListItem {
  pickId: string;
  invoiceNo: string;
  party: string;
  destination: string;
  sn: number;
  brand: string;
  pack: string;
  batch: string;
  qty: number;
  cases: number;
  expectedLocation: string; // "A1" or "A1,I3" or ""
  locationOptions: string[];
  confidence: number; // 100, 95, 80, 0
  matchType: MatchType;
  status: 'PENDING' | 'FOUND' | 'NOT_FOUND';
  actualLocation?: string;
  notFoundReason?: string;
  picker?: string;
  timestamp?: string;
}

export interface NotFoundReason {
  code: string;
  label: string;
}
