import { ParsedInvoice, InvoiceLine } from '@/types';
import { parseBrandFromDesc } from './matcher';

/**
 * Parse SAP-generated Smith N Smith PDF text into structured invoices.
 *
 * Real-world observation:
 *  - Each invoice appears 3 times: Original/Duplicate/Triplicate copies.
 *  - "Bill To" and "Invoice No." appear on the SAME extracted line.
 *  - Items span 1-3 lines: main row (with qty, batch, dates) + continuation
 *    with brand-extra + HSN code + pack-unit-suffix.
 *  - Party name often runs into "Credit Days" because both columns appear
 *    on the same physical line.
 *
 * Approach:
 *  1. Split on "TAX INVOICE" marker (appears at top of each copy)
 *  2. Dedupe by Invoice No.
 *  3. Per block: line-by-line scan to find main item rows, attach continuation
 */

const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;

function cleanLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function splitIntoInvoiceBlocks(fullText: string): string[] {
  const text = fullText.replace(/\r\n/g, '\n');
  // Split on TAX INVOICE marker which is the page header for each copy
  const parts = text.split(/(?=TAX INVOICE)/g);
  return parts.filter((p) => /Invoice No\./.test(p));
}

function extractField(block: string, regex: RegExp): string {
  const m = block.match(regex);
  return m ? cleanLine(m[1]) : '';
}

/**
 * Extract party name. "Party Name." appears once at line start; everything
 * up to the next column ("Credit Days" / "Sales Person" etc) is the party.
 * Pattern: "Party Name. <name>   Credit Days : ..."
 */
function extractParty(block: string): string {
  // Try with column-separator
  let m = block.match(/Party Name\.\s+([^\n]+?)\s{2,}(?:Credit Days|Sales Person|Old ERP|Reference|Bank Details)/);
  if (m) return cleanLine(m[1]);
  // Fallback
  m = block.match(/Party Name\.\s+([^\n]+)/);
  return m ? cleanLine(m[1]) : '';
}

function extractDestination(block: string): string {
  let m = block.match(/Destination\s*:\s*([^\n]+?)(?:\s{2,}|$)/);
  if (m) return cleanLine(m[1]);
  m = block.match(/Destination\s*:\s*([^\n]+)/);
  return m ? cleanLine(m[1]) : '';
}

function isMainRowLine(line: string, nextLine: string = ''): boolean {
  const t = line.trim();
  if (!/^\d{1,2}\s/.test(t)) return false;
  // Slash may be on this line OR the next line (brand wraps like VOLT\n SMITH/WETTING)
  if (!t.includes('/') && !(nextLine || '').includes('/')) return false;
  if (!/\d{2}\.\d{2}\.\d{4}/.test(t)) return false;
  const nums = t.match(/[\d,]+\.\d{2}/g);
  return !!(nums && nums.length >= 3);
}

interface ParsedRowParts {
  sn: number;
  brandFrag: string;
  pack1: string;
  batch: string;
  qty: number;
  cases: number;
}

function parseMainRow(line: string, nextLine: string = ''): ParsedRowParts | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 8) return null;

  const sn = parseInt(tokens[0], 10);
  if (isNaN(sn)) return null;

  const dateIdx = tokens.findIndex((t) => DATE_RE.test(t));
  if (dateIdx < 3) return null;

  const batchToken = tokens[dateIdx - 1];
  if (!/^[A-Z]{2}[A-Z0-9\-]{2,}$/.test(batchToken)) return null;

  // Brand fragment. If token 1 has "/", use up to first "/".
  // Otherwise brand wraps to next line — look at next line for SMITH/... pattern.
  let brandFrag = tokens[1];
  if (!brandFrag.includes('/') && nextLine) {
    // Look at first uppercase token in next line that has "/"
    const nextTokens = nextLine.trim().split(/\s+/);
    for (const t of nextTokens) {
      if (t.includes('/') && /^[A-Z]/.test(t)) {
        // Combine: "VOLT" + " " + "SMITH/..." -> "VOLT SMITH"
        const beforeSlash = t.split('/')[0];
        brandFrag = `${tokens[1]} ${beforeSlash}/`;
        break;
      }
    }
  }

  const packTokens: string[] = [];
  let foundPackStart = false;
  for (let i = 2; i < dateIdx - 1; i++) {
    const t = tokens[i];
    if (/^\d+X[\dA-Z\.]+$/i.test(t) || /^\d+X\d+/.test(t)) {
      packTokens.push(t);
      foundPackStart = true;
    } else if (foundPackStart && ['CS', 'KG', 'ML', 'EA', 'GM', 'BTL', 'L'].includes(t)) {
      // Unit suffix immediately following the size token
      packTokens.push(t);
    } else if (foundPackStart) {
      // Stop collecting once we hit a non-pack token after starting
      break;
    }
  }

  const afterDate = tokens.slice(dateIdx + 1);
  const numericTokens = afterDate.filter((t) => /^[\d,]+\.?\d*$/.test(t) && /\d/.test(t));
  const qty = numericTokens.length > 0 ? parseFloat(numericTokens[0].replace(/,/g, '')) : 0;
  const cases = numericTokens.length > 1 ? parseFloat(numericTokens[1].replace(/,/g, '')) : 0;

  return { sn, brandFrag, pack1: packTokens.join(' '), batch: batchToken, qty, cases };
}

/**
 * Pack-unit suffix from continuation. Scan next 2 lines for short uppercase
 * unit tokens (CS, L, KG, ML, etc.). They appear after the HSN code.
 */
function extractPackContinuation(nextLines: string[]): string {
  const found: string[] = [];
  const UNITS = new Set(['CS', 'KG', 'EA', 'ML', 'GM', 'BTL', 'L']);
  for (const raw of nextLines) {
    if (!raw) continue;
    for (const t of raw.trim().split(/\s+/)) {
      if (DATE_RE.test(t)) continue;
      if (UNITS.has(t) && !found.includes(t)) found.push(t);
    }
  }
  return found.join(' ');
}

function extractLines(block: string): InvoiceLine[] {
  const results: InvoiceLine[] = [];

  const headerIdx = block.indexOf("Product Description");

  if (headerIdx === -1) return results;

  const lines = block
    .substring(headerIdx)
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  console.log("ALL LINES");
  lines.forEach((l, idx) => console.log(idx, l));

  for (let i = 0; i < lines.length; i++) {

    const m = lines[i].match(/^(\d+)\s+/);

if (!m) continue;

const sn = Number(m[1]);
    let desc: string[] = [];
    let j = i;

    while (
      j < lines.length &&
      !/\d{2}\.\d{2}\.\d{4}/.test(lines[j])
    ) {
      desc.push(lines[j]);
      j++;
    }

    if (j >= lines.length) continue;

    const batchLine = lines[j];

    const batchMatch =
      batchLine.match(/[A-Z]{2}-?\d+/);

    if (!batchMatch) continue;

    const batch = batchMatch[0];

    const qtyLine = lines[j + 2] || "";

    const nums =
      qtyLine.match(/[\d,]+\.\d+/g) || [];

    const qty =
      nums.length > 0
        ? Number(nums[0]!.replace(/,/g, ""))
        : 0;

    const cases =
      nums.length > 1
        ? Number(nums[1]!.replace(/,/g, ""))
        : 0;

    const productDesc =
      desc.join(" ");
    const cleanProductDesc = productDesc.replace(/^\d+\s+/, "").trim();

    const descParts = cleanProductDesc.split('/');

let pack = '';

if (descParts.length >= 3) {
  pack = descParts[2]
    .replace(/\(\)/g, '')
    .replace(/\s+3808935.*$/i, '')
    .trim();
}
    const pack = descParts.length >= 3 ? descParts[2].trim() : '';

console.log({
  original: productDesc,
  cleaned: cleanProductDesc,
  batch,
  pack,
});
    results.push({
      sn,
      productDesc: cleanProductDesc,
brand: parseBrandFromDesc(cleanProductDesc),
      hsnCode: "",
      pack,
      batch,
      qty,
      cases
    });

    i = j;
  }

  console.log("PARSED ITEMS", results);

  return results;
}



export function parseInvoicesFromText(fullText: string): ParsedInvoice[] {
  const blocks = splitIntoInvoiceBlocks(fullText);
console.log("BLOCKS FOUND:", blocks.length);
  const byNo = new Map<string, ParsedInvoice>();

  for (const block of blocks) {
console.log("================================");
console.log(block);
console.log("================================");
    const invoiceNo = extractField(block, /Invoice No\.\s*:\s*(\d+)/);
console.log("INVOICE:", invoiceNo);
    if (!invoiceNo || byNo.has(invoiceNo)) continue;

    const invoiceDate = extractField(block, /Invoice No\.[^\n]*?Date\s*:\s*([\d\.]+)/);
    const party = extractParty(block);
    const destination = extractDestination(block);

    const lines = extractLines(block);
console.log("LINES:", lines.length);
    if (lines.length === 0) continue;

    byNo.set(invoiceNo, {
      invoiceNo,
      invoiceDate,
      party,
      destination,
      lines,
    });
  }

  return Array.from(byNo.values()).sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo));
}
