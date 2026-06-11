'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SupervisorPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'CORRECTIONS' | 'NOT_FOUND'>('CORRECTIONS');
  const [corrections, setCorrections] = useState<string[][]>([]);
  const [notFound, setNotFound] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('sds_user') || 'supervisor' : 'supervisor'
  );

  async function loadCorrections() {
    setLoading(true);
    const res = await fetch('/api/sheets?sheet=LOCATION_CORRECTION_LOG');
    const data = await res.json();
    setCorrections(data.rows || []);
    setLoading(false);
  }

  async function loadNotFound() {
    setLoading(true);
    const res = await fetch('/api/sheets?sheet=NOT_FOUND_LOG');
    const data = await res.json();
    setNotFound(data.rows || []);
    setLoading(false);
  }

  useEffect(() => {
    if (tab === 'CORRECTIONS') loadCorrections();
    else loadNotFound();
  }, [tab]);

  async function decide(action: 'APPROVE_LOCATION_CORRECTION' | 'REJECT_LOCATION_CORRECTION', rowIdx: number) {
    // rowIdx is 0-based among data rows; sheet row = rowIdx + 2 (header at 1)
    const rowNum = rowIdx + 2;
    await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rowNum, user }),
    });
    loadCorrections();
  }

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <header className="mb-4">
        <button onClick={() => router.push('/')} className="text-brand-700 font-semibold">
          ← Wapas
        </button>
        <h1 className="text-2xl font-bold mt-2">👮 Supervisor Panel</h1>
      </header>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('CORRECTIONS')}
          className={`flex-1 py-3 rounded-xl font-bold ${
            tab === 'CORRECTIONS' ? 'bg-brand-600 text-white' : 'bg-white border-2 border-gray-300'
          }`}
        >
          Location Updates
        </button>
        <button
          onClick={() => setTab('NOT_FOUND')}
          className={`flex-1 py-3 rounded-xl font-bold ${
            tab === 'NOT_FOUND' ? 'bg-brand-600 text-white' : 'bg-white border-2 border-gray-300'
          }`}
        >
          Not Found Logs
        </button>
      </div>

      {loading && <div className="text-center text-gray-500">Loading...</div>}

      {tab === 'CORRECTIONS' && !loading && (
        <div className="space-y-3">
          {corrections.length === 0 && (
            <div className="text-center text-gray-500 py-8">Koi pending correction nahi</div>
          )}
          {corrections.map((row, idx) => {
            // Columns: LogID | Brand | Pack | Batch | Expected | Actual | User | Timestamp | Status | SupUser | ReviewDate | Notes
            const [logId, brand, pack, batch, expected, actual, dispatcher, ts, status] = row;
            return (
              <div key={logId || idx} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold">{brand} {pack}</div>
                    <div className="text-sm text-gray-600 font-mono">{batch}</div>
                  </div>
                  <span
                    className={`badge ${
                      status === 'PENDING'
                        ? 'bg-yellow-200 text-yellow-900'
                        : status === 'APPROVED'
                        ? 'bg-green-200 text-green-900'
                        : 'bg-red-200 text-red-900'
                    }`}
                  >
                    {status || 'PENDING'}
                  </span>
                </div>
                <div className="text-sm mb-2">
                  <div>System: <strong>{expected || '—'}</strong></div>
                  <div>Mila: <strong className="text-blue-700">{actual}</strong></div>
                  <div className="text-xs text-gray-500 mt-1">
                    By {dispatcher} · {ts?.slice(0, 16).replace('T', ' ')}
                  </div>
                </div>
                {(!status || status === 'PENDING') && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => decide('APPROVE_LOCATION_CORRECTION', idx)}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => decide('REJECT_LOCATION_CORRECTION', idx)}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg"
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'NOT_FOUND' && !loading && (
        <div className="space-y-3">
          {notFound.length === 0 && (
            <div className="text-center text-gray-500 py-8">Koi not-found entry nahi</div>
          )}
          {notFound.map((row, idx) => {
            // PickId | Invoice | Party | Date | Brand | Pack | Batch | Qty | Expected | Reason | User | Timestamp | Resolved
            const [, invoice, party, date, brand, pack, batch, qty, expected, reason, dispatcher, ts] = row;
            return (
              <div key={idx} className="card">
                <div className="flex justify-between mb-1">
                  <div className="font-bold">{brand} {pack}</div>
                  <span className="badge bg-red-200 text-red-900">{reason}</span>
                </div>
                <div className="text-sm text-gray-700">
                  Invoice #{invoice} · {party}
                </div>
                <div className="text-sm font-mono text-gray-600">
                  Batch {batch} · Qty {qty} · Expected: {expected || '—'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  By {dispatcher} · {ts?.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
