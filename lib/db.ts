import postgres from 'postgres';

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------
let _sql: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (!_sql) {
    const url = process.env.POSTGRES_URL;
    if (!url) throw new Error('POSTGRES_URL environment variable is not set');
    _sql = postgres(url, { ssl: 'require', max: 5 });
  }
  return _sql;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface InviteCode {
  id: number;
  code_hash: string;
  tester_name: string;
  used: boolean;
  used_at: string | null;
  github_username: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface InviteCodePublic {
  id: number;
  testerName: string;
  used: boolean;
  usedAt: string | null;
  githubUsername: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Schema init — runs once per cold start, idempotent
// ---------------------------------------------------------------------------
let _initialized = false;

export async function initDb(): Promise<void> {
  if (_initialized) return;
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id            SERIAL PRIMARY KEY,
      code_hash     TEXT        NOT NULL UNIQUE,
      tester_name   TEXT        NOT NULL,
      used          BOOLEAN     NOT NULL DEFAULT FALSE,
      used_at       TIMESTAMPTZ,
      github_username TEXT,
      email         TEXT,
      notes         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  _initialized = true;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export async function getAllCodes(): Promise<InviteCodePublic[]> {
  await initDb();
  const sql = getDb();
  const rows = await sql<InviteCode[]>`
    SELECT id, tester_name, used, used_at, github_username, email, notes, created_at
    FROM invite_codes
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    testerName: r.tester_name,
    used: r.used,
    usedAt: r.used_at,
    githubUsername: r.github_username,
    email: r.email,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

export async function getUnusedCodesWithHashes(): Promise<InviteCode[]> {
  await initDb();
  const sql = getDb();
  const rows = await sql<InviteCode[]>`
    SELECT id, code_hash, tester_name FROM invite_codes WHERE used = FALSE
  `;
  return rows;
}

export async function insertCode(
  codeHash: string,
  testerName: string,
  email?: string,
  notes?: string,
): Promise<number> {
  await initDb();
  const sql = getDb();
  const rows = await sql<{ id: number }[]>`
    INSERT INTO invite_codes (code_hash, tester_name, email, notes)
    VALUES (${codeHash}, ${testerName}, ${email ?? null}, ${notes ?? null})
    RETURNING id
  `;
  return rows[0].id;
}

export async function markCodeUsed(id: number, githubUsername: string): Promise<void> {
  await initDb();
  const sql = getDb();
  await sql`
    UPDATE invite_codes
    SET used = TRUE, used_at = NOW(), github_username = ${githubUsername}
    WHERE id = ${id}
  `;
}

export async function deleteCode(id: number): Promise<void> {
  await initDb();
  const sql = getDb();
  await sql`DELETE FROM invite_codes WHERE id = ${id}`;
}

export async function getCodeById(id: number): Promise<InviteCode | null> {
  await initDb();
  const sql = getDb();
  const rows = await sql<InviteCode[]>`
    SELECT * FROM invite_codes WHERE id = ${id}
  `;
  return rows[0] ?? null;
}
