import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    provider?: string;
    userId?: string;        // internal Supabase/Prisma user ID
    gmailConnected?: boolean;
    error?: string;
  }
}
