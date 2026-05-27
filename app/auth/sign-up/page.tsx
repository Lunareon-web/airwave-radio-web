'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }
      // Auto sign in after registration
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError('Account created but sign-in failed. Please sign in manually.');
        router.push('/auth/sign-in');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F0EFEC' }}>
      <div className="w-full max-w-[390px]">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: '#FF4D3D' }}>
            <Radio size={32} color="white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#131313', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Airwave
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B6B6B' }}>AI Music Radio</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: '#FFFFFF', boxShadow: '0 4px 24px rgba(14,14,14,0.08)' }}>
          <h2 className="text-xl font-bold mb-6" style={{ color: '#131313' }}>Create account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#9A9A9A' }}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: '#F0EFEC',
                  color: '#131313',
                  border: '1.5px solid #DCDBD7',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#9A9A9A' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: '#F0EFEC',
                  color: '#131313',
                  border: '1.5px solid #DCDBD7',
                  fontFamily: "'Plus Jakarta Sans', sans-serif"
                }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: '#9A9A9A' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none pr-12 transition-all"
                  style={{
                    background: '#F0EFEC',
                    color: '#131313',
                    border: '1.5px solid #DCDBD7',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#9A9A9A' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#9A9A9A' }}>Minimum 6 characters</p>
            </div>

            {error && (
              <p className="text-sm text-center py-2 px-3 rounded-xl" style={{ color: '#FF4D3D', background: 'rgba(255,77,61,0.08)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#FF4D3D' }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: '#6B6B6B' }}>
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="font-semibold" style={{ color: '#FF4D3D' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
