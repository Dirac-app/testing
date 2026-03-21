import path from 'path';
import fs from 'fs';
import type { Database as DatabaseType } from 'better-sqlite3';

// Resolve the database path relative to the project root
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'dirac.db');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface InviteCode {
  id: number;
  code_hash: string;
  tester_name: string;
  used: number;
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
// Lazy database initialization
// ---------------------------------------------------------------------------
// We use a lazy initializer so that the DB is only opened at request time,
// not during Next.js build-time static analysis. This prevents build failures
// when environment is not fully configured.

let _db: DatabaseType | null = null;

function getDb(): DatabaseType {
  if (_db) return _db;

  // Dynamic require — keeps better-sqlite3 out of webpack bundling
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');

  // Ensure the data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db: DatabaseType = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema on first connection
  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_hash TEXT NOT NULL UNIQUE,
      tester_name TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      used_at TEXT,
      github_username TEXT,
      email TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      ip TEXT NOT NULL,
      attempts INTEGER DEFAULT 1,
      window_start TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (ip)
    );
  `);

  // Migrate existing databases — safe to run if columns already exist (SQLite ignores errors in exec for ALTER)
  try { db.exec(`ALTER TABLE invite_codes ADD COLUMN email TEXT`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE invite_codes ADD COLUMN notes TEXT`); } catch { /* already exists */ }

  _db = db;
  return db;
}

// ---------------------------------------------------------------------------
// Query helpers — all access the DB through the lazy getter
// ---------------------------------------------------------------------------

/**
 * Returns all invite codes without exposing the raw hash — safe for admin UI.
 */
export function getAllCodes(): InviteCodePublic[] {
  const db = getDb();
  const rows = db
    .prepare<[], InviteCode>(
      `SELECT id, tester_name, used, used_at, github_username, email, notes, created_at
       FROM invite_codes
       ORDER BY created_at DESC`
    )
    .all();

  return rows.map((row) => ({
    id: row.id,
    testerName: row.tester_name,
    used: row.used === 1,
    usedAt: row.used_at,
    githubUsername: row.github_username,
    email: row.email,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

/**
 * Returns all unused codes including their hashes — used for bcrypt comparison.
 * This data stays server-side only, never returned to clients.
 */
export function getUnusedCodesWithHashes(): InviteCode[] {
  const db = getDb();
  return db
    .prepare<[], InviteCode>(
      `SELECT id, code_hash, tester_name FROM invite_codes WHERE used = 0`
    )
    .all();
}

/**
 * Inserts a new invite code. The caller is responsible for hashing before calling.
 */
export function insertCode(codeHash: string, testerName: string, email?: string, notes?: string): number {
  const db = getDb();
  const result = db
    .prepare<[string, string, string | null, string | null]>(
      `INSERT INTO invite_codes (code_hash, tester_name, email, notes) VALUES (?, ?, ?, ?)`
    )
    .run(codeHash, testerName, email ?? null, notes ?? null);
  return Number(result.lastInsertRowid);
}

/**
 * Marks an invite code as used and records the GitHub username.
 */
export function markCodeUsed(id: number, githubUsername: string): void {
  const db = getDb();
  db.prepare<[string, number]>(
    `UPDATE invite_codes SET used = 1, used_at = datetime('now'), github_username = ? WHERE id = ?`
  ).run(githubUsername, id);
}

/**
 * Deletes an invite code by ID.
 */
export function deleteCode(id: number): void {
  const db = getDb();
  db.prepare<[number]>(`DELETE FROM invite_codes WHERE id = ?`).run(id);
}

/**
 * Fetches a single code by ID (used for validation before delete).
 */
export function getCodeById(id: number): InviteCode | undefined {
  const db = getDb();
  return db
    .prepare<[number], InviteCode>(`SELECT * FROM invite_codes WHERE id = ?`)
    .get(id);
}
