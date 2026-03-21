'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nameParam = searchParams.get('name') || 'Tester';

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [githubUsername, setGithubUsername] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [githubDone, setGithubDone] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [repoUrl, setRepoUrl] = useState('https://github.com/Dirac-app/Dirac');

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (!token) { router.replace('/'); return; }
    setSessionToken(token);
  }, [router]);

  async function handleGithubInvite(e: FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setGithubError(null);
    setGithubLoading(true);
    try {
      const res = await fetch('/api/invite-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ githubUsername: githubUsername.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.repoUrl) setRepoUrl(data.repoUrl);
        setAlreadyMember(data.alreadyMember ?? false);
        setGithubDone(true);
        if (!data.alreadyMember && data.invitationUrl) {
          window.open(data.invitationUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        setGithubError(data.error || 'Failed to send invitation');
      }
    } catch {
      setGithubError('Network error — please try again');
    } finally {
      setGithubLoading(false);
    }
  }

  // Step states
  const step1State = githubDone ? 'done' : 'active';
  const step2State = githubDone ? 'active' : 'locked';

  if (!sessionToken) {
    return (
      <main className="wlc-root">
        <div className="wlc-inner" style={{ color: 'var(--text-3)', fontSize: '13px' }}>Loading...</div>
      </main>
    );
  }

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
          Complete both steps below to get started.
        </p>

        {/* Progress */}
        <div className="wlc-progress appear d3">
          <div className={`wlc-progress-seg wlc-progress-seg--${githubDone ? 'done' : 'active'}`} />
          <div className={`wlc-progress-seg wlc-progress-seg--${githubDone ? 'active' : ''}`} />
        </div>

        {/* Steps */}
        <div className="wlc-steps appear d4">

          {/* Step 1 */}
          <div className={`wlc-step wlc-step--${step1State}`}>
            <div className="wlc-step-head">
              <div className="wlc-step-num">{githubDone ? '✓' : '1'}</div>
              <span className="wlc-step-title">Join the GitHub Organization</span>
            </div>
            <p className="wlc-step-desc">
              Enter your GitHub username to receive an invitation to the private Dirac org where the source code lives.
            </p>

            {githubDone ? (
              <div className="wlc-step-success">
                {alreadyMember ? (
                  <p className="wlc-step-success-text">You&apos;re already a member — you&apos;re all set.</p>
                ) : (
                  <>
                    <p className="wlc-step-success-text">
                      Invitation sent to <strong>@{githubUsername}</strong>. A new tab opened for you to accept.
                    </p>
                    <a
                      href="https://github.com/orgs/Dirac-app/invitation"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wlc-step-success-link"
                    >
                      Accept on GitHub →
                    </a>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleGithubInvite} className="wlc-form">
                <input
                  type="text"
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  placeholder="username"
                  disabled={githubLoading}
                  autoComplete="off"
                  spellCheck={false}
                  className="wlc-input"
                />
                <button
                  type="submit"
                  disabled={githubLoading || !githubUsername.trim()}
                  className="wlc-btn"
                >
                  {githubLoading ? (
                    <span className="dots"><span /><span /><span /></span>
                  ) : 'Request access'}
                </button>
                {githubError && (
                  <div className="wlc-step-error">
                    <p className="wlc-step-error-text">{githubError}</p>
                  </div>
                )}
              </form>
            )}
          </div>

          {/* Step 2 */}
          <div className={`wlc-step wlc-step--${step2State}`}>
            <div className="wlc-step-head">
              <div className="wlc-step-num">2</div>
              <span className="wlc-step-title">Access the Repository</span>
            </div>
            <p className="wlc-step-desc">
              Once your invitation is accepted, head to the repo — the latest build and install instructions are in the README.
            </p>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="wlc-repo-btn"
              onClick={(e) => { if (!githubDone) e.preventDefault(); }}
            >
              Open repository on GitHub →
            </a>
          </div>

        </div>

        <p className="wlc-footer appear d5">
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
