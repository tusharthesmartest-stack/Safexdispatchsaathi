'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PickListItem } from '@/types';
import PickCard from '@/components/PickCard';

interface InvoiceSummary {
  invoiceNo: string;
  party: string;
  destination: string;
  lineCount: number;
}

const REASONS = [
  { code: 'LOCATION_EMPTY', label: 'Location Khaali Thi' },
  { code: 'MAAL_SHIFTED', label: 'Maal Shift Hua Hai' },
  { code: 'BATCH_MISSING', label: 'Batch Nahi Mila' },
  { code: 'STOCK_MISSING', label: 'Stock Missing Hai' },
  { code: 'UNKNOWN', label: 'Pata Nahi' },
];

export default function PickListPage() {
  const router = useRouter();
  const [items, setItems] = useState<PickListItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [user, setUser] = useState('');
  const [filterInvoice, setFilterInvoice] = useState<string>('ALL');

  useEffect(() => {
    const pl = sessionStorage.getItem('sds_picklist');
    const inv = sessionStorage.getItem('sds_invoices');
    const u = localStorage.getItem('sds_user') || '';
    if (!pl) {
      router.push('/');
      return;
    }
    setItems(JSON.parse(pl));
    if (inv) setInvoices(JSON.parse(inv));
    setUser(u);
  }, [router]);

  function persistItems(next: PickListItem[]) {
    setItems(next);
    sessionStorage.setItem('sds_picklist', JSON.stringify(next));
  }

  async function handleFound(
    item: PickListItem,
    actualLocation: string,
    saveNewLocation: boolean
  ) {
    const next = items.map((x) =>
      x.pickId === item.pickId
        ? {
            ...x,
            status: 'FOUND' as const,
            actualLocation,
            picker: user,
            timestamp: new Date().toISOString(),
          }
        : x
    );
    persistItems(next);

    try {
      await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'FOUND',
          pickId: item.pickId,
          invoiceNo: item.invoiceNo,
          party: item.party,
          brand: item.brand,
          pack: item.pack,
          batch: item.batch,
          qty: item.qty,
          cases: item.cases,
          expectedLocation: item.expectedLocation,
          actualLocation,
          user,
          saveNewLocation,
        }),
      });
    } catch (e) {
      console.error('Log failed', e);
    }
  }

  async function handleNotFound(item: PickListItem, reason: string) {
    const next = items.map((x) =>
      x.pickId === item.pickId
        ? {
            ...x,
            status: 'NOT_FOUND' as const,
            notFoundReason: reason,
            picker: user,
            timestamp: new Date().toISOString(),
          }
        : x
    );
    persistItems(next);

    try {
      await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'NOT_FOUND',
          pickId: item.pickId,
          invoiceNo: item.invoiceNo,
          party: item.party,
          brand: item.brand,
          pack: item.pack,
          batch: item.batch,
          qty: item.qty,
          expectedLocation: item.expectedLocation,
          reason,
          user,
        }),
      });
    } catch (e) {
      console.error('Log failed', e);
    }
  }

  const visible = items.filter((x) => filterInvoice === 'ALL' || x.invoiceNo === filterInvoice);
  const pending = visible.filter((x) => x.status === 'PENDING');
  const found = visible.filter((x) => x.status === 'FOUND');
  const notFound = visible.filter((x) => x.status === 'NOT_FOUND');

  return (
    <main className="min-h-screen p-3 max-w-md mx-auto pb-24">
      <header className="sticky top-0 bg-gray-50/95 backdrop-blur z-10 pb-3 pt-2 mb-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => router.push('/')} className="text-brand-700 font-semibold">
            ← Wapas
          </button>
          <div className="text-sm font-bold text-gray-700">{user}</div>
        </div>
        <h2 className="text-xl font-bold">🚚 Pick List</h2>

        {invoices.length > 1 && (
          <select
            value={filterInvoice}
            onChange={(e) => setFilterInvoice(e.target.value)}
            className="mt-2 w-full p-2 border-2 border-gray-300 rounded-lg"
          >
            <option value="ALL">📋 Saare Invoices ({items.length} lines)</option>
            {invoices.map((inv) => (
              <option key={inv.invoiceNo} value={inv.invoiceNo}>
                #{inv.invoiceNo} — {inv.party.slice(0, 30)} ({inv.lineCount})
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-2 mt-2 text-xs">
          <div className="flex-1 bg-yellow-100 border border-yellow-300 rounded-lg p-2 text-center">
            <div className="font-bold text-yellow-900">{pending.length}</div>
            <div>Baaki</div>
          </div>
          <div className="flex-1 bg-green-100 border border-green-300 rounded-lg p-2 text-center">
            <div className="font-bold text-green-900">{found.length}</div>
            <div>Mil Gaya</div>
          </div>
          <div className="flex-1 bg-red-100 border border-red-300 rounded-lg p-2 text-center">
            <div className="font-bold text-red-900">{notFound.length}</div>
            <div>Nahi Mila</div>
          </div>
        </div>
      </header>

      {pending.length === 0 && found.length + notFound.length > 0 && (
        <div className="bg-green-100 border-2 border-green-400 text-green-900 p-4 rounded-xl text-center font-bold mb-3">
          🎉 Saara maal check ho gaya!
        </div>
      )}

      <section className="space-y-3">
        {pending.map((item) => (
          <PickCard
            key={item.pickId}
            item={item}
            reasons={REASONS}
            onFound={handleFound}
            onNotFound={handleNotFound}
          />
        ))}
      </section>

      {(found.length > 0 || notFound.length > 0) && (
        <details className="mt-6">
          <summary className="font-bold text-gray-700 py-2 cursor-pointer">
            ✅ Ho Chuke ({found.length + notFound.length})
          </summary>
          <div className="space-y-2 mt-2">
            {[...found, ...notFound].map((item) => (
              <div
                key={item.pickId}
                className={`p-3 rounded-lg border-2 ${
                  item.status === 'FOUND'
                    ? 'bg-green-50 border-green-300'
                    : 'bg-red-50 border-red-300'
                }`}
              >
                <div className="flex justify-between text-sm">
                  <div className="font-bold">
                    {item.brand} {item.pack}
                  </div>
                  <div>{item.status === 'FOUND' ? '✓' : '✗'}</div>
                </div>
                <div className="text-xs text-gray-600">
                  {item.batch} · {item.cases} cs ·{' '}
                  {item.status === 'FOUND'
                    ? `Mila: ${item.actualLocation}`
                    : `Reason: ${item.notFoundReason}`}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
