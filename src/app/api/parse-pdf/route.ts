import { NextRequest, NextResponse } from 'next/server';
import { parseInvoicesFromText } from '@/lib/pdf-parser';
import { buildPickList } from '@/lib/matcher';
import { readStockMaster } from '@/lib/sheets';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {

    const raw = await req.text();

    console.log("RAW REQUEST:");
    console.log(raw.substring(0, 500));

    const body = JSON.parse(raw);

    const text: string = body.text || '';
	console.log("TEXT LENGTH:", text.length);

console.log(
  text.substring(0, 5000)
);
console.log("================================");
console.log("TEXT LENGTH:", text.length);
console.log(text.substring(0, 5000));
console.log("================================");
    const invoices = parseInvoicesFromText(text);
console.log("INVOICES FOUND:", invoices.length);
    if (invoices.length === 0) {
      return NextResponse.json(
        { error: 'Koi invoice nahi mila PDF mein' },
        { status: 400 }
      );
    }

    const stock = await readStockMaster();
    const pickList = buildPickList(invoices, stock);

    return NextResponse.json({
      invoices: invoices.map((i) => ({
        invoiceNo: i.invoiceNo,
        party: i.party,
        destination: i.destination,
        lineCount: i.lines.length,
      })),
      pickList,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
