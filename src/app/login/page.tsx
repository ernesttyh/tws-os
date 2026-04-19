'use client';
import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-xl sm:text-2xl mx-auto mb-3 sm:mb-4">
            TWS
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">TWS OS</h1>
          <p className="text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">Marketing Command Center</p>
        </div>

        <form onSubmit={handleLogin} className="bg-[#16162a] rounded-xl sm:rounded-2xl p-5 sm:p-8 border border-white/10 space-y-4 sm:space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-xs sm:text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full" placeholder="you@twsbranding.com" required autoComplete="email" />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full" placeholder="Enter password" required autoComplete="current-password" />
          </div>

          <button type="submit" disabled={loading} className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold text-sm sm:text-base rounded-lg transition">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-[10px] sm:text-xs mt-6 sm:mt-8">© {new Date().getFullYear()} The Wok & Skillet · TWS OS v1.0</p>
      </div>
    </div>
  );
}
