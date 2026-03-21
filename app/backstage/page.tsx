'use client';

import { useState, useEffect, FormEvent, useMemo } from 'react';

interface InviteCode {
  id: number;
  testerName: string;
  used: boolean;
  usedAt: string | null;
  githubUsername: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
}

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function exportCSV(codes: InviteCode[]) {
  const header = 'ID,Name,Email,Status,GitHub,Used At,Notes,Created At';
  const rows = codes.map((c) =>
    [c.id, `"${c.testerName}"`, `"${c.email ?? ''}"`, c.used ? 'Redeemed' : 'Available',
      c.githubUsername ? `@${c.githubUsername}` : '', c.usedAt ?? '',
      `"${(c.notes ?? '').replace(/"/g, '""')}"`, c.createdAt].join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dirac-codes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtDate(s: string) {
  return new Date(s + (s.endsWith('Z') ? '' : 'Z')).toLocaleString();
}

export default function BackstagePage() {
  const [adminSecret, setAdminSecret] = useState('');
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'used' | 'unused'>('all');

  useEffect(() => {
    const s = sessionStorage.getItem('adminSecret');
    if (s) setAdminSecret(s);
  }, []);

  useEffect(() => {
    if (adminSecret) fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret]);

  function handleAuth(e: FormEvent) {
    e.preventDefault();
    if (!secretInput.trim()) return;
    sessionStorage.setItem('adminSecret', secretInput.trim());
    setAdminSecret(secretInput.trim());
  }

  async function fetchCodes() {
    setCodesLoading(true); setCodesError(null);
    try {
      const res = await fetch('/api/admin/codes', { headers: { Authorization: `Bearer ${adminSecret}` } });
      if (res.status === 401) {
        setAdminSecret(''); sessionStorage.removeItem('adminSecret');
        setCodesError('Invalid secret'); return;
      }
      const data = await res.json();
      if (data.success) setCodes(data.codes);
      else setCodesError(data.error || 'Failed to load');
    } catch { setCodesError('Network error'); }
    finally { setCodesLoading(false); }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateMsg(null); setCreating(true);
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSecret}` },
        body: JSON.stringify({ testerName: newName.trim(), code: newCode.trim(), email: newEmail.trim() || undefined, notes: newNotes.trim() || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateMsg({ type: 'ok', text: `Code created for ${newName.trim()}` });
        setNewName(''); setNewCode(''); setNewEmail(''); setNewNotes('');
        fetchCodes();
      } else {
        setCreateMsg({ type: 'err', text: data.error || 'Failed to create' });
      }
    } catch { setCreateMsg({ type: 'err', text: 'Network error' }); }
    finally { setCreating(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete code for "${name}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/codes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminSecret}` } });
      const data = await res.json();
      if (data.success) setCodes((p) => p.filter((c) => c.id !== id));
      else alert(`Failed: ${data.error}`);
    } catch { alert('Network error'); }
    finally { setDeletingId(null); }
  }

  function handleCopy() {
    if (!newCode) return;
    navigator.clipboard.writeText(newCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleLogout() {
    sessionStorage.removeItem('adminSecret');
    setAdminSecret(''); setSecretInput(''); setCodes([]);
  }

  const filtered = useMemo(() => codes.filter((c) => {
    const q = search.toLowerCase();
    const matchQ = !q || c.testerName.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.githubUsername ?? '').toLowerCase().includes(q);
    const matchS = filterStatus === 'all' ||
      (filterStatus === 'used' && c.used) ||
      (filterStatus === 'unused' && !c.used);
    return matchQ && matchS;
  }), [codes, search, filterStatus]);

  const stats = useMemo(() => ({
    total: codes.length,
    avail: codes.filter((c) => !c.used).length,
    used: codes.filter((c) => c.used).length,
  }), [codes]);

  /* ─── Login ─────────────────────────────────────────────────────────── */
  if (!adminSecret) {
    return (
      <main className="bs-login-root">
        <div className="bs-login-card appear">
          <img src="/favicon.png" alt="Dirac" className="bs-login-logo" />
          <h1 className="bs-login-title">Sign in to Backstage</h1>
          <p className="bs-login-sub">Founders only — enter your admin secret.</p>
          <form onSubmit={handleAuth} className="bs-login-form">
            <label className="bs-login-label" htmlFor="secret">Admin secret</label>
            <input
              id="secret"
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="••••••••••••"
              autoFocus
              className="bs-login-input"
            />
            <button type="submit" disabled={!secretInput.trim()} className="bs-login-btn">
              {secretInput.trim() ? 'Continue' : 'Continue'}
            </button>
          </form>
          {authError && <p className="bs-login-err">{authError}</p>}
        </div>
      </main>
    );
  }

  /* ─── Panel ──────────────────────────────────────────────────────────── */
  return (
    <div className="bs-page">

      <header className="bs-header">
        <div className="bs-header-inner">
          <div className="bs-header-left">
            <img src="/favicon.png" alt="Dirac" className="bs-header-logo" />
            <span className="bs-header-name">Dirac</span>
            <span className="bs-header-sep">/</span>
            <span className="bs-header-sub">Backstage</span>
          </div>
          <div className="bs-header-right">
            <button onClick={() => exportCSV(codes)} className="bs-ghost">Export CSV</button>
            <button onClick={handleLogout} className="bs-ghost">Sign out</button>
          </div>
        </div>
      </header>

      <main className="bs-main">

        {/* Stats */}
        <div className="bs-stats appear d1">
          <div className="bs-stat">
            <div className="bs-stat-n">{stats.total}</div>
            <div className="bs-stat-l">Total codes</div>
          </div>
          <div className="bs-stat">
            <div className="bs-stat-n bs-stat-n--green">{stats.avail}</div>
            <div className="bs-stat-l">Available</div>
          </div>
          <div className="bs-stat">
            <div className="bs-stat-n bs-stat-n--amber">{stats.used}</div>
            <div className="bs-stat-l">Redeemed</div>
          </div>
        </div>

        {/* Create */}
        <section className="bs-section appear d2">
          <div className="bs-section-head">
            <h2 className="bs-section-title">Create invite code</h2>
          </div>
          <p className="bs-section-desc">Codes are bcrypt-hashed before storage — the plaintext is never saved after you submit.</p>

          <form onSubmit={handleCreate} className="bs-form">
            <div className="bs-row">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Tester name *" className="bs-input" />
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email (optional)" className="bs-input" />
            </div>
            <div className="bs-code-row">
              <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)}
                placeholder="Invite code (min 6 chars) *" autoComplete="off" spellCheck={false}
                className="bs-input bs-input--mono" style={{ flex: 1 }} />
              <button type="button" onClick={() => setNewCode(randomCode())} className="bs-sm-btn">Generate</button>
              <button type="button" onClick={handleCopy} disabled={!newCode}
                className={`bs-sm-btn${copied ? ' bs-sm-btn--copied' : ''}`}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Notes (optional)" className="bs-textarea" />
            <button type="submit"
              disabled={creating || !newName.trim() || newCode.trim().length < 6}
              className="bs-primary">
              {creating ? <span className="dots"><span /><span /><span /></span> : 'Create code'}
            </button>
          </form>

          {createMsg && (
            <div className={`bs-notice bs-notice--${createMsg.type}`}>{createMsg.text}</div>
          )}
        </section>

        {/* Codes */}
        <section className="bs-section appear d3">
          <div className="bs-section-head">
            <h2 className="bs-section-title">Invite codes</h2>
            <div className="bs-filters">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..." className="bs-search" />
              <select value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'used' | 'unused')}
                className="bs-select">
                <option value="all">All</option>
                <option value="unused">Available</option>
                <option value="used">Redeemed</option>
              </select>
              <button onClick={fetchCodes} disabled={codesLoading} className="bs-ghost">
                {codesLoading ? <span className="dots"><span /><span /><span /></span> : 'Refresh'}
              </button>
            </div>
          </div>

          {codesError && (
            <div className="bs-notice bs-notice--err" style={{ marginBottom: 16 }}>{codesError}</div>
          )}

          {codesLoading && codes.length === 0 ? (
            <p className="bs-empty">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="bs-empty">
              {codes.length === 0 ? 'No invite codes yet — create one above.' : 'No results match your filter.'}
            </p>
          ) : (
            <div className="bs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>GitHub</th>
                    <th>Notes</th>
                    <th>Created</th>
                    <th>Redeemed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td className="td-dim">{c.id}</td>
                      <td className="td-primary">{c.testerName}</td>
                      <td className="td-mono">{c.email ?? <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td>
                        <span className={`badge badge--${c.used ? 'used' : 'avail'}`}>
                          {c.used ? 'Redeemed' : 'Available'}
                        </span>
                      </td>
                      <td>
                        {c.githubUsername
                          ? <a href={`https://github.com/${c.githubUsername}`} target="_blank" rel="noopener noreferrer" className="td-link">@{c.githubUsername}</a>
                          : <span style={{ color: 'var(--text-4)' }}>—</span>}
                      </td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="td-dim">
                        {c.notes ?? <span style={{ color: 'var(--text-4)' }}>—</span>}
                      </td>
                      <td className="td-ts">{fmtDate(c.createdAt)}</td>
                      <td className="td-ts">{c.usedAt ? fmtDate(c.usedAt) : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                      <td>
                        <button onClick={() => handleDelete(c.id, c.testerName)}
                          disabled={deletingId === c.id} className="del-btn">
                          {deletingId === c.id ? '...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="bs-count">Showing {filtered.length} of {codes.length} codes</p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
