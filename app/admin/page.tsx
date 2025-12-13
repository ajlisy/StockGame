'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Upload failed' });
        setLoading(false);
        return;
      }

      setMessage({ type: 'success', text: data.message || 'Upload successful!' });
      setFile(null);
      const fileInput = document.getElementById('csv-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1419]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#1d9bf0] hover:text-[#1a8cd8] transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          <p className="text-[#71767b] mt-1">Upload initial positions and manage competition</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="bg-[#16202a] rounded-xl border border-[#2f3336] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2f3336] bg-[#1d2a35]">
              <h2 className="text-xl font-bold text-white">Upload Initial Positions</h2>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[#71767b] uppercase tracking-wider mb-3">CSV Format</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Upload a CSV file with the following columns:
                </p>
                <div className="bg-[#1d2a35] p-4 rounded-lg border border-[#2f3336]">
                  <code className="text-sm text-emerald-400 font-mono">
                    Player, Symbol, Quantity, PurchasePrice, Date
                  </code>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-[#71767b] mb-2">Example (use <code className="text-emerald-400 bg-[#2f3336] px-1.5 py-0.5 rounded">$CASH</code> to specify starting cash):</p>
                  <div className="bg-[#1d2a35] p-4 rounded-lg border border-[#2f3336]">
                    <code className="text-sm text-gray-300 font-mono whitespace-pre">
{`Player, Symbol, Quantity, PurchasePrice, Date
John, $CASH, 1, 5000.00, 2024-12-07
John, AAPL, 10, 150.50, 2024-12-07
John, MSFT, 5, 380.25, 2024-12-07
Jane, $CASH, 1, 3000.00, 2024-12-07
Jane, GOOGL, 8, 140.75, 2024-12-07`}
                    </code>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[#71767b] mb-2">
                    Select CSV File
                  </label>
                  <div className="relative">
                    <input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="w-full px-4 py-3 bg-[#1d2a35] border border-[#2f3336] rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#1d9bf0] file:text-white file:font-semibold file:cursor-pointer hover:file:bg-[#1a8cd8] focus:outline-none focus:ring-2 focus:ring-[#1d9bf0] focus:border-transparent transition-all"
                      required
                    />
                  </div>
                  {file && (
                    <p className="text-sm text-emerald-400 mt-2">
                      Selected: {file.name}
                    </p>
                  )}
                </div>

                {message && (
                  <div className={`p-4 rounded-lg ${
                    message.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-red-500/10 border border-red-500/20'
                  }`}>
                    <p className={`text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {message.text}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !file}
                  className="w-full bg-[#1d9bf0] text-white py-3 px-4 rounded-lg font-semibold hover:bg-[#1a8cd8] disabled:bg-[#2f3336] disabled:text-[#71767b] disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading...
                    </span>
                  ) : (
                    'Upload CSV'
                  )}
                </button>
              </form>

              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm text-amber-400 font-medium">Important Notes</p>
                    <ul className="text-sm text-[#71767b] mt-2 space-y-1">
                      <li>• New players will be created with default password: <code className="text-white bg-[#2f3336] px-1.5 py-0.5 rounded">changeme</code></li>
                      <li>• Use <code className="text-emerald-400 bg-[#2f3336] px-1.5 py-0.5 rounded">$CASH</code> as the symbol to specify cash position</li>
                      <li>• P&L is calculated from initial total value (stocks + cash)</li>
                      <li>• Uploading will replace existing positions for affected players</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
