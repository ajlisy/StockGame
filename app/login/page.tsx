'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1419] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#16202a] rounded-xl border border-[#2f3336] p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#1d9bf0] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Login to Trade</h1>
            <p className="text-[#71767b] mt-2">Enter your credentials to access trading</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#71767b] mb-2">
                Player Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-[#1d2a35] border border-[#2f3336] rounded-lg text-white placeholder-[#71767b] focus:outline-none focus:ring-2 focus:ring-[#1d9bf0] focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#71767b] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 bg-[#1d2a35] border border-[#2f3336] rounded-lg text-white placeholder-[#71767b] focus:outline-none focus:ring-2 focus:ring-[#1d9bf0] focus:border-transparent transition-all"
                required
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1d9bf0] text-white py-3 px-4 rounded-lg font-semibold hover:bg-[#1a8cd8] disabled:bg-[#2f3336] disabled:text-[#71767b] disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Logging in...
                </span>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-[#1d9bf0] hover:text-[#1a8cd8] text-sm transition-colors">
              Back to Dashboard
            </Link>
          </div>

          <div className="mt-6 p-4 bg-[#1d2a35] rounded-lg border border-[#2f3336]">
            <p className="text-sm text-[#71767b]">
              <span className="text-white font-medium">Default password:</span> changeme
            </p>
            <p className="text-xs text-[#71767b] mt-1">
              Contact admin if you need password reset.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
