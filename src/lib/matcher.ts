import { StockRow, InvoiceLine, PickListItem, MatchType } from '@/types';
import { v4 as uuid } from 'uuid';

// Hardcoded aliases for Day 1. Editable in MAPPING_OVERRIDES sheet later.
const BRAND_ALIASES: Record<string, string> = {
  NOVAGOLD: 'NOVA GOLD',
  SHERDILGR: 'SHERDIL GR',
  HALOSMITH: 'HALOSMITH',
};

export function normalizeBrand(b: string): string {
  return (b || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}

export function normalizePack(p: string): string {
  return (p || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '')

    // PDF break fixes
    .replace(/500MLCS/g, '500ML')
    .replace(/250MLCS/g, '250ML')
    .replace(/500GMCS/g, '500GM')
    .replace(/1KGCS/g, '1KG')
    .replace(/1LCS/g, '1L')

    .replace(/500ML/g, '500ML')
    .replace(/250ML/g, '250ML')
    .replace(/500GM/g, '500GM')
    .replace(/1KG/g, '1KG')
    .replace(/1L/g, '1L');
}
export function normalizeBatch(b: string): string {
  return (b || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .trim();
}


export function applyBrandAlias(brand: string): string {
  const norm = normalizeBrand(brand);
  return BRAND_ALIASES[norm.replace(/\s+/g, '')] || norm;
}

/**
 * Parse brand from SAP product description.
 * Format: "PATTON/PARAQUATDICHLORIDE24SL/12X1L CS()"
 * Brand = text before first "/"
 */
export function parseBrandFromDesc(desc: string): string {
  if (!desc) return '';
  const cleaned = desc.replace(/\s+/g, ' ').trim();
  const slashIdx = cleaned.indexOf('/');
  if (slashIdx === -1) return normalizeBrand(cleaned);
  return normalizeBrand(cleaned.substring(0, slashIdx));
}

/**
 * Match invoice line to stock rows. Returns best match + confidence.
 */
export function matchLineToStock(
  line: InvoiceLine,
  stock: StockRow[]
  
  
): {
  expectedLocation: string;
  locationOptions: string[];
  confidence: number;
  matchType: MatchType;
} {
  const brandRaw = line.brand || parseBrandFromDesc(line.productDesc);

const brandNorm = normalizeBrand(brandRaw);
const packNorm = normalizePack(line.pack);
const batchNorm = normalizeBatch(line.batch);

console.log("INVOICE LINE", {
  brand: brandNorm,
  pack: packNorm,
  batch: batchNorm,
});



console.log("MATCHING");
console.log({
  invoiceBrand: brandNorm,
  invoicePack: packNorm,
  invoiceBatch: batchNorm,
});
  // Only consider saleable stock
  const saleable = stock.filter((s) => (s.storage || '').toUpperCase() === 'FGST');
  console.log("INVOICE", {
  brand: brandNorm,
  pack: packNorm,
  batch: batchNorm,
});

saleable.forEach((s) => {
  if (normalizeBatch(s.batch) === batchNorm) {
    console.log("BATCH MATCH FOUND", {
      brand: normalizeBrand(s.brand),
      pack: normalizePack(s.packing),
      batch: normalizeBatch(s.batch),
      location: s.locations,
    });
  }
});
saleable.forEach((s) => {
  if (normalizeBrand(s.brand).includes("FINISH")) {
    console.log("STOCK ROW", {
      brand: normalizeBrand(s.brand),
      pack: normalizePack(s.packing),
      batch: normalizeBatch(s.batch),
      location: s.locations,
    });
  }
});
  // Priority 1: Exact (Brand + Pack + Batch)
  console.log("CHECKING EXACT MATCH", {
  brandNorm,
  packNorm,
  batchNorm,
});

 const exact = saleable.find(
  (s) =>
    normalizeBrand(s.brand) === brandNorm &&
    (
      normalizePack(s.packing).includes(packNorm) ||
      packNorm.includes(normalizePack(s.packing))
    ) &&
    normalizeBatch(s.batch) === batchNorm
);
  if (exact && exact.locations) {
    const opts = exact.locations.split(',').map((x) => x.trim()).filter(Boolean);
    return {
      expectedLocation: exact.locations,
      locationOptions: opts,
      confidence: 100,
      matchType: 'EXACT',
    };
  }

  // Priority 2: Alias match
  const aliasBrand = applyBrandAlias(brandRaw);
  if (aliasBrand !== brandNorm) {
    const aliasMatch = saleable.find(
  (s) =>
    normalizeBrand(s.brand) === normalizeBrand(aliasBrand) &&
    normalizeBatch(s.batch) === batchNorm
);
    
    if (aliasMatch && aliasMatch.locations) {
      const opts = aliasMatch.locations.split(',').map((x) => x.trim()).filter(Boolean);
      return {
        expectedLocation: aliasMatch.locations,
        locationOptions: opts,
        confidence: 95,
        matchType: 'ALIAS',
      };
    }
  }

  // Priority 3: Brand + Pack only (batch mismatch)
  const brandPackMatches = saleable.filter(
    (s) =>
      (normalizeBrand(s.brand) === brandNorm || normalizeBrand(s.brand) === aliasBrand) &&
      normalizePack(s.packing) === packNorm
  );
  if (brandPackMatches.length > 0) {
    const allLocs = brandPackMatches
      .map((m) => m.locations)
      .filter(Boolean)
      .join(',');
    const opts = Array.from(new Set(allLocs.split(',').map((x) => x.trim()).filter(Boolean)));
    return {
      expectedLocation: opts.join(','),
      locationOptions: opts,
      confidence: 80,
      matchType: 'BRAND_PACK',
    };
  }

  // Priority 4: Manual
  return {
    expectedLocation: '',
    locationOptions: [],
    confidence: 0,
    matchType: 'MANUAL',
  };
}

/**
 * Build pick list items from parsed invoices and stock.
 * Sort by location for walking order.
 */
export function buildPickList(
  invoices: Array<{
    invoiceNo: string;
    party: string;
    destination: string;
    lines: InvoiceLine[];
  }>,
  stock: StockRow[]
): PickListItem[] {
  const items: PickListItem[] = [];
  for (const inv of invoices) {
    for (const line of inv.lines) {
      const m = matchLineToStock(line, stock);
      items.push({
        pickId: uuid(),
        invoiceNo: inv.invoiceNo,
        party: inv.party,
        destination: inv.destination,
        sn: line.sn,
        brand: line.brand || parseBrandFromDesc(line.productDesc),
        pack: line.pack,
        batch: line.batch,
        qty: line.qty,
        cases: line.cases,
        expectedLocation: m.expectedLocation,
        locationOptions: m.locationOptions,
        confidence: m.confidence,
        matchType: m.matchType,
        status: 'PENDING',
      });
    }
  }

  // Sort: by first location alpha, MANUAL items at end
  items.sort((a, b) => {
    if (a.confidence === 0 && b.confidence !== 0) return 1;
    if (b.confidence === 0 && a.confidence !== 0) return -1;
    const la = a.locationOptions[0] || 'ZZZ';
    const lb = b.locationOptions[0] || 'ZZZ';
    return la.localeCompare(lb);
  });
  return items;
}
