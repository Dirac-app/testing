'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nameParam = searchParams.get('name') || 'Tester';

  const testerUrl = process.env.NEXT_PUBLIC_TESTER_URL || '#';

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (!token) { router.replace('/'); return; }
  }, [router]);

  return (
    <main className="wlc-root">
      <div className="wlc-inner">

        {/* Topbar */}
        <div className="wlc-topbar appear d1">
          <img src="/favicon.png" alt="Dirac" className="wlc-topbar-logo" />
          <span className="wlc-topbar-name">Dirac</span>
        </div>

        {/* Greeting */}
        <h1 className="wlc-greeting appear d2">
          Welcome, <span className="wlc-greeting-name">{nameParam}</span>
        </h1>
        <p className="wlc-sub appear d2">
          You&apos;ve been granted access to the Dirac private beta.
        </p>

        {/* Single step card */}
        <div className="wlc-steps appear d3">
          <div className="wlc-step wlc-step--active">
            <div className="wlc-step-head">
              <div className="wlc-step-num">→</div>
              <span className="wlc-step-title">Access Dirac Beta</span>
            </div>
            <p className="wlc-step-desc">
              Click below to open the hosted Dirac beta environment. Your access has been verified.
            </p>
            <a
              href={testerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="wlc-repo-btn"
            >
              Open Dirac Beta →
            </a>
          </div>
        </div>

        <p className="wlc-footer appear d4">
          Need help? <a href="mailto:team@dirac.app" style={{ color: 'var(--text-3)' }}>Contact the Dirac team</a>
        </p>
      </div>
    </main>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={
      <main className="wlc-root">
        <div className="wlc-inner" style={{ color: 'var(--text-3)', fontSize: '13px' }}>Loading...</div>
      </main>
    }>
      <WelcomeContent />
    </Suspense>
  );
}
