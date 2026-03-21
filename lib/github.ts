import { Octokit } from '@octokit/rest';

/**
 * Returns an authenticated Octokit instance.
 * Throws if GITHUB_TOKEN is not configured.
 */
function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not configured');
  }
  return new Octokit({ auth: token });
}

/**
 * Returns the configured GitHub org name.
 * Throws if GITHUB_ORG is not configured.
 */
function getOrg(): string {
  const org = process.env.GITHUB_ORG;
  if (!org) {
    throw new Error('GITHUB_ORG environment variable is not configured');
  }
  return org;
}

export interface GitHubInviteResult {
  success: boolean;
  error?: string;
  alreadyMember?: boolean;
}

/**
 * Sends a GitHub organization membership invitation to the given username.
 *
 * Handles the common cases:
 * - User exists and is invited successfully
 * - User is already a member of the org (treated as success)
 * - User does not exist on GitHub
 * - API rate limit or token permission errors
 */
export async function inviteUserToOrg(githubUsername: string): Promise<GitHubInviteResult> {
  try {
    const octokit = getOctokit();
    const org = getOrg();

    // First check if the user already has a pending invite or is a member
    try {
      const { data: membership } = await octokit.orgs.getMembershipForUser({
        org,
        username: githubUsername,
      });

      if (membership.state === 'active' || membership.state === 'pending') {
        return { success: true, alreadyMember: true };
      }
    } catch (membershipError: unknown) {
      // 404 means user is not a member — proceed with invite
      if (!isOctokitError(membershipError) || membershipError.status !== 404) {
        throw membershipError;
      }
    }

    // Send the org invitation via membership API
    await octokit.orgs.setMembershipForUser({
      org,
      username: githubUsername,
      role: 'member',
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('GitHub invite error:', error);

    if (isOctokitError(error)) {
      if (error.status === 404) {
        return {
          success: false,
          error: `GitHub user "${githubUsername}" does not exist`,
        };
      }
      if (error.status === 422) {
        return {
          success: false,
          error: 'Unable to invite user — they may have a pending invitation already',
        };
      }
      if (error.status === 401 || error.status === 403) {
        return {
          success: false,
          error: 'GitHub API authentication failed — check GITHUB_TOKEN permissions',
        };
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `GitHub API error: ${message}` };
  }
}

/**
 * Type guard for Octokit HTTP errors.
 */
function isOctokitError(err: unknown): err is { status: number; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}
