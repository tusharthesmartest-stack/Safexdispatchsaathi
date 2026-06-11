'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('sds_user') || '' : ''
  );
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');

  async function extractTextFromPDF(file: File): Promise<string> {
    // Load pdfjs dynamically (client-side only)
    const pdfjs: any = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      // Reconstruct text with newlines based on Y position
      let lastY: number | null = null;
      let pageText = '';
      for (const item of tc.items as any[]) {
        const y = item.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          pageText += '\n';
        }
        pageText += item.str + ' ';
        lastY = y;
      }
      fullText += pageText + '\n';
    }
    return fullText;
  }

  async function handleProcessText(text: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kuch problem hui');
        setLoading(false);
        return;
      }
      sessionStorage.setItem('sds_picklist', JSON.stringify(data.pickList));
      sessionStorage.setItem('sds_invoices', JSON.stringify(data.invoices));
      router.push('/pick-list');
    } catch (e: any) {
      setError(e.message || 'Network error');
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user.trim()) {
      setError('Pehle apna naam likho');
      return;
    }
    localStorage.setItem('sds_user', user.trim());
    setLoading(true);
    setError('');
    try {
      const text = await extractTextFromPDF(file);
      await handleProcessText(text);
    } catch (e: any) {
      setError('PDF padhne mein problem: ' + (e.message || ''));
      setLoading(false);
    }
  }

  function handlePasteSubmit() {
    if (!user.trim()) {
      setError('Pehle apna naam likho');
      return;
    }
    if (!pasteText.trim()) {
      setError('PDF ka text paste karo');
      return;
    }
    localStorage.setItem('sds_user', user.trim());
    handleProcessText(pasteText);
  }

  function handleResume() {
    const existing = sessionStorage.getItem('sds_picklist');
    if (existing) router.push('/pick-list');
    else setError('Koi purani pick list nahi mili');
  }

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto">
      <header className="text-center py-6">
        <h1 className="text-3xl font-extrabold text-brand-700">
          📦 SINGH DISPATCH SAATHI
        </h1>
        <p className="text-gray-600 mt-1">Maal dispatch aasaan</p>
      </header>

      <div className="card mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Aapka Naam
        </label>
        <input
          type="text"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="Naam likho..."
          className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg"
        />
      </div>

      {error && (
        <div className="bg-red-100 border-2 border-red-300 text-red-800 p-3 rounded-lg mb-4">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="bg-blue-100 border-2 border-blue-300 text-blue-800 p-3 rounded-lg mb-4 text-center font-semibold">
          ⏳ Invoice padh rahe hain... thoda ruko
        </div>
      )}

      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="btn-primary"
        >
          📎 Invoice Upload Karo
        </button>

        <button
          onClick={() => setShowPaste(!showPaste)}
          disabled={loading}
          className="btn-ghost w-full"
        >
          📋 Invoice Paste Karo
        </button>

        {showPaste && (
          <div className="card">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="PDF ka pura text yahan paste karo..."
              rows={6}
              className="w-full p-3 border-2 border-gray-300 rounded-lg"
            />
            <button onClick={handlePasteSubmit} disabled={loading} className="btn-primary mt-2">
              ✅ Process Karo
            </button>
          </div>
        )}

        <button onClick={handleResume} disabled={loading} className="btn-ghost w-full">
          🚚 Purani Pick List Dekho
        </button>

        <button
          onClick={() => router.push('/supervisor')}
          className="btn-ghost w-full mt-4 text-sm"
        >
          👮 Supervisor Panel
        </button>
      </div>

      <footer className="text-center text-xs text-gray-500 mt-8 pb-4">
        Singh Associates · Lucknow / Rudrapur / Ghaziabad
      </footer>
    </main>
  );
}
