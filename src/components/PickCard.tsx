'use client';

import { useState } from 'react';
import type { PickListItem } from '@/types';

interface Reason {
  code: string;
  label: string;
}

interface Props {
  item: PickListItem;
  reasons: Reason[];
  onFound: (item: PickListItem, actualLocation: string, saveNewLocation: boolean) => void;
  onNotFound: (item: PickListItem, reason: string) => void;
}

export default function PickCard({ item, reasons, onFound, onNotFound }: Props) {
  const [selectedLoc, setSelectedLoc] = useState<string>(
    item.locationOptions.length === 1 ? item.locationOptions[0] : ''
  );
  const [otherLoc, setOtherLoc] = useState('');
  const [askSave, setAskSave] = useState(false);
  const [showNotFound, setShowNotFound] = useState(false);

  function confidenceBadge() {
    if (item.confidence === 100)
      return <span className="badge bg-green-200 text-green-900">100% PAKKA</span>;
    if (item.confidence === 95)
      return <span className="badge bg-blue-200 text-blue-900">95% ALIAS</span>;
    if (item.confidence === 80)
      return <span className="badge bg-yellow-200 text-yellow-900">80% BATCH ALAG</span>;
    return <span className="badge bg-red-200 text-red-900">MANUAL — DHOONDHO</span>;
  }

  function attemptFound() {
    const actual = otherLoc.trim() || selectedLoc;
    if (!actual) {
      alert('Pehle location chuno ya likho');
      return;
    }
    const isDifferent =
      !item.locationOptions.includes(actual) && item.expectedLocation !== actual;
    if (isDifferent) {
      setAskSave(true);
    } else {
      onFound(item, actual, false);
    }
  }

  function confirmSaveNewLocation(save: boolean) {
    const actual = otherLoc.trim() || selectedLoc;
    onFound(item, actual, save);
    setAskSave(false);
  }

  function handleReason(reason: string) {
    onNotFound(item, reason);
    setShowNotFound(false);
  }

  return (
    <article className="card">
      {/* Top: location pill big + product info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0">
          {item.expectedLocation ? (
            <div className="loc-pill">{item.locationOptions[0] || item.expectedLocation}</div>
          ) : (
            <div className="loc-pill bg-red-200 text-red-900 border-red-500">?</div>
          )}
          <div className="text-xs text-center mt-1 text-gray-500">📍 Yahan Dekho</div>
        </div>
        <div className="flex-1">
          <div className="font-extrabold text-lg leading-tight">{item.brand}</div>
          <div className="text-sm text-gray-700">{item.pack}</div>
          <div className="text-sm font-mono bg-gray-100 inline-block px-2 py-0.5 rounded mt-1">
            Batch: {item.batch}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-base">
          <span className="font-bold text-2xl text-brand-700">{item.cases}</span>
          <span className="text-gray-600 ml-1">Cases</span>
          <span className="text-gray-500 text-sm ml-2">({item.qty} units)</span>
        </div>
        {confidenceBadge()}
      </div>

      <div className="text-xs text-gray-500 mb-2">
        Invoice #{item.invoiceNo} · {item.party.slice(0, 30)}
        {item.destination && ` · ${item.destination}`}
      </div>

      {/* Location selector */}
      {item.locationOptions.length > 1 && (
        <div className="mb-2">
          <div className="text-sm font-semibold text-gray-700 mb-1">Konsi Location?</div>
          <div className="flex flex-wrap gap-2">
            {item.locationOptions.map((loc) => (
              <button
                key={loc}
                onClick={() => {
                  setSelectedLoc(loc);
                  setOtherLoc('');
                }}
                className={`px-4 py-2 rounded-lg font-bold border-2 ${
                  selectedLoc === loc && !otherLoc
                    ? 'bg-brand-600 text-white border-brand-700'
                    : 'bg-white text-gray-800 border-gray-300'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="text-xs text-gray-600">Ya Dusri Jagah:</label>
        <input
          type="text"
          value={otherLoc}
          onChange={(e) => {
            setOtherLoc(e.target.value.toUpperCase());
            if (e.target.value) setSelectedLoc('');
          }}
          placeholder="Type karo... (jaise C4)"
          className="w-full p-2 border-2 border-gray-300 rounded-lg uppercase"
        />
      </div>

      {/* Action buttons */}
      {!askSave && !showNotFound && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={attemptFound} className="btn-found">
            ✓ MAAL MIL GAYA
          </button>
          <button onClick={() => setShowNotFound(true)} className="btn-notfound">
            ✗ MAAL NAHI MILA
          </button>
        </div>
      )}

      {/* Save new location prompt */}
      {askSave && (
        <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-3">
          <div className="text-sm mb-2">
            <div>
              System Bola: <strong>{item.expectedLocation || '—'}</strong>
            </div>
            <div>
              Aapko Mila: <strong>{otherLoc.trim() || selectedLoc}</strong>
            </div>
          </div>
          <div className="font-bold text-blue-900 mb-2">
            Kya Agli Baar Se Yahin Dikhana Hai?
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => confirmSaveNewLocation(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
            >
              HAAN
            </button>
            <button
              onClick={() => confirmSaveNewLocation(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-3 rounded-lg"
            >
              NAHI
            </button>
          </div>
        </div>
      )}

      {/* Not found reasons */}
      {showNotFound && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3">
          <div className="font-bold text-red-900 mb-2">Kya Problem Hui?</div>
          <div className="space-y-2">
            {reasons.map((r) => (
              <button
                key={r.code}
                onClick={() => handleReason(r.code)}
                className="block w-full text-left bg-white border-2 border-red-300 hover:bg-red-100 py-3 px-4 rounded-lg font-semibold"
              >
                {r.label}
              </button>
            ))}
            <button
              onClick={() => setShowNotFound(false)}
              className="block w-full text-center text-gray-600 py-2"
            >
              ← Wapas
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
