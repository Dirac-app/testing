'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [resetAt, setResetAt] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('sessionToken', data.sessionToken);
        localStorage.setItem('testerName', data.name);
        router.push(`/welcome?name=${encodeURIComponent(data.name)}`);
      } else {
        setError(data.error || 'Invalid access code');
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
        if (typeof data.attemptsRemaining === 'number') setAttemptsRemaining(data.attemptsRemaining);
        if (data.resetAt) setResetAt(new Date(data.resetAt).toLocaleTimeString());
      }
    } catch {
      setError('Network error — please try again');
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    } finally {
      setLoading(false);
    }
  }

  const isRateLimited = attemptsRemaining === 0;

  return (
    <main className="home-root">
      <div className={`home-card appear d1${shaking ? ' shake' : ''}`}>

        <img src="/favicon.png" alt="Dirac" className="home-logo" />

        <h1 className="home-title">Sign in to Dirac</h1>
        <p className="home-sub">Enter your private beta access code to continue.</p>

        <form onSubmit={handleSubmit} className="home-form">
          <label className="home-label" htmlFor="code">Access code</label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="xxxx-xxxx-xxxx"
            disabled={loading || isRateLimited}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="home-input"
          />
          <button
            type="submit"
            disabled={loading || isRateLimited || !code.trim()}
            className="home-btn"
          >
            {loading ? (
              <span className="dots">
                <span /><span /><span />
              </span>
            ) : 'Continue'}
          </button>
        </form>

        {error && (
          <div className="home-error">
            <span className="home-error-msg">{error}</span>
            {attemptsRemaining !== null && attemptsRemaining > 0 && (
              <span className="home-error-sub">
                {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
              </span>
            )}
            {isRateLimited && resetAt && (
              <span className="home-error-sub">Locked until {resetAt}</span>
            )}
          </div>
        )}

        <p className="home-footer">
          Questions? <a href="mailto:team@dirac.app">Contact the Dirac team</a>
        </p>
      </div>
    </main>
  );
}
