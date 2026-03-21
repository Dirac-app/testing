# Dirac Testing Portal

A secure, self-contained Next.js 14 portal for managing private beta testers. Testers redeem invite codes, join your GitHub org, and download the app binary — all through a minimal web interface.

## Architecture Overview

- **Framework**: Next.js 14 App Router (TypeScript)
- **Database**: SQLite via `better-sqlite3` — single file, zero external dependencies
- **Auth**: Custom JWT sessions (`jsonwebtoken`) + bcrypt-hashed invite codes
- **GitHub**: `@octokit/rest` for org membership invitations
- **Rate Limiting**: In-memory per-IP limiting (resets on server restart)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `ADMIN_SECRET` | Yes | Password for the `/admin` panel |
| `APP_SECRET` | Yes | Secret key for signing JWT session tokens |
| `GITHUB_TOKEN` | Yes | GitHub personal access token with `admin:org` scope |
| `GITHUB_ORG` | Yes | GitHub organization slug (e.g. `my-org`) |
| `DOWNLOAD_URL` | One of these | Public URL to redirect testers to for the download |
| `DOWNLOAD_FILE_PATH` | One of these | Absolute path to the binary file on the server |

### 3. Run the development server

```bash
npm run dev
```

Visit `http://localhost:3000`.

### 4. Create your first invite code

Navigate to `http://localhost:3000/admin`, enter your `ADMIN_SECRET`, then create a code.

## Production Deployment

```bash
npm run build
npm start
```

The SQLite database is created automatically at `data/dirac.db` on first run. Ensure the `data/` directory is writable by the process. In production, mount this as a persistent volume.

## GitHub Token Permissions

The `GITHUB_TOKEN` must be a classic personal access token with the `admin:org` scope, or a fine-grained token with organization membership write permissions.

## Security Notes

- Invite codes are **never stored in plaintext** — only bcrypt hashes (cost 12) are persisted
- The admin panel uses session storage (cleared on tab close) for the admin secret
- Session tokens (JWT, 24h expiry) are stored in `localStorage` — acceptable for this use case since the data is not sensitive beyond download access
- Rate limiting is per-IP, 5 attempts per 15-minute window
- All admin API routes verify the `Authorization: Bearer {ADMIN_SECRET}` header

## File Structure

```
/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # / — Code entry page
│   ├── welcome/
│   │   └── page.tsx            # /welcome — GitHub invite + download
│   ├── admin/
│   │   └── page.tsx            # /admin — Admin panel
│   └── api/
│       ├── validate-code/
│       │   └── route.ts        # POST /api/validate-code
│       ├── invite-github/
│       │   └── route.ts        # POST /api/invite-github
│       ├── download/
│       │   └── route.ts        # GET /api/download
│       └── admin/
│           └── codes/
│               ├── route.ts    # GET + POST /api/admin/codes
│               └── [id]/
│                   └── route.ts # DELETE /api/admin/codes/:id
├── lib/
│   ├── db.ts                   # SQLite setup, schema, query helpers
│   ├── auth.ts                 # JWT issue/verify, admin secret validation
│   ├── github.ts               # Octokit org invite helper
│   └── rateLimit.ts            # In-memory IP rate limiter
├── data/
│   └── dirac.db                # SQLite DB (auto-created, git-ignored)
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
└── tsconfig.json
```

## Tester Flow

1. Tester visits `/` and enters their invite code
2. Code is validated against bcrypt hashes — if valid, a JWT session token is issued
3. Tester is redirected to `/welcome?name=Alice`
4. Tester enters their GitHub username — the API sends an org invitation
5. Tester clicks "Download Dirac" — the API validates the session and serves the file
6. The invite code is marked as used after the GitHub step completes

## Admin Flow

1. Visit `/admin` and enter `ADMIN_SECRET`
2. Create new invite codes (name + code)
3. View all codes with status, created date, and GitHub username
4. Delete codes as needed
