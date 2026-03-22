import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUser, upsertGmailAccount } from "@/lib/dirac/user-db";
import { refreshGoogleToken } from "@/lib/dirac/token-refresh";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      // ── Initial sign-in ───────────────────────────────────
      if (account && profile) {
        const email = (profile.email as string | undefined) ?? (token.email as string) ?? "";
        const name  = (profile.name  as string | undefined) ?? null;
        const pic   = (profile.picture as string | undefined) ?? null;

        try {
          const userId = await upsertUser({ email, name, avatarUrl: pic });

          if (account.provider === "google" && account.access_token) {
            await upsertGmailAccount({
              userId,
              platformAccountId: email,
              displayName: name,
              accessToken: account.access_token,
              refreshToken: account.refresh_token ?? null,
              accessTokenExpiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            });
          }

          token.dbUserId = userId;
          token.dbError = undefined;
        } catch (err) {
          console.error("[auth] DB upsert failed:", err);
          token.dbError = "db_unavailable";
        }

        return {
          ...token,
          accessToken:  account.access_token,
          refreshToken: account.refresh_token,
          expiresAt:    account.expires_at ?? 0,
          provider:     account.provider,
        };
      }

      // ── Retry DB upsert if it failed on initial sign-in (max once per 60s) ──
      const now = Date.now();
      const lastRetry = (token.dbRetryAt as number) ?? 0;
      if (!token.dbUserId && token.email && now - lastRetry > 60_000) {
        token.dbRetryAt = now;
        try {
          const userId = await upsertUser({
            email: token.email as string,
            name: (token.name as string) ?? null,
            avatarUrl: (token.picture as string) ?? null,
          });
          token.dbUserId = userId;
        } catch {}
      }

      // ── Token still valid ─────────────────────────────────
      const expiresAt = (token.expiresAt as number) ?? 0;
      if (Date.now() / 1000 < expiresAt - 60) return token;

      // ── Refresh expired token ─────────────────────────────
      if (!token.refreshToken) return { ...token, error: "NoRefreshToken" };

      try {
        const data = await refreshGoogleToken(token.refreshToken as string);
        const newExpiry = Math.floor(Date.now() / 1000) + data.expires_in;

        if (token.dbUserId && token.email) {
          try {
            await upsertGmailAccount({
              userId:              token.dbUserId as string,
              platformAccountId:   token.email as string,
              accessToken:         data.access_token,
              refreshToken:        data.refresh_token ?? (token.refreshToken as string),
              accessTokenExpiresAt: new Date(newExpiry * 1000),
            });
          } catch (err) {
            console.error("[auth] DB refresh write failed:", err);
          }
        }

        return {
          ...token,
          accessToken:  data.access_token,
          expiresAt:    newExpiry,
          refreshToken: data.refresh_token ?? token.refreshToken,
          error:        undefined,
        };
      } catch {
        return { ...token, error: "RefreshTokenError" };
      }
    },

    async session({ session, token }) {
      session.accessToken    = token.accessToken as string | undefined;
      session.provider       = token.provider    as string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).userId = token.dbUserId as string | undefined;
      session.gmailConnected =
        token.provider === "google" && !!token.accessToken && !token.error;
      // Merge both OAuth and DB errors into the session error field
      session.error = (token.error as string | undefined)
        ?? (token.dbError as string | undefined);
      return session;
    },
  },

  pages: { signIn: "/login" },
});
