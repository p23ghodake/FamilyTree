import { Session, User } from '@supabase/supabase-js';

const ADMIN_GITHUB_USERNAMES = ['p23ghodake'];
const ADMIN_EMAILS = ['ghodake.pankaj@gmail.com'];

/**
 * Admin check based on server-issued data only. `user_metadata` is editable by the
 * signed-in user, so the GitHub username is read from the provider identity and the
 * email is only trusted once Supabase has confirmed it.
 */
export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const githubLogin = user.identities
    ?.find(identity => identity.provider === 'github')
    ?.identity_data?.user_name;
  if (typeof githubLogin === 'string' && ADMIN_GITHUB_USERNAMES.includes(githubLogin.toLowerCase())) {
    return true;
  }
  return !!user.email_confirmed_at && !!user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

function signedInWithOAuth(accessToken: string): boolean {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload)) as { amr?: Array<{ method?: string }> };
    return !!claims.amr?.some(entry => entry.method === 'oauth');
  } catch {
    return false;
  }
}

/**
 * Deleting members needs a session signed in through GitHub (not email/password) on the
 * admin GitHub account, matched by username or its verified GitHub email.
 */
export function canDeleteMembers(session: Session | null | undefined): boolean {
  if (!session || !signedInWithOAuth(session.access_token)) return false;
  const github = session.user.identities?.find(identity => identity.provider === 'github')?.identity_data;
  if (!github) return false;
  const login = typeof github.user_name === 'string' ? github.user_name.toLowerCase() : '';
  const email = github.email_verified === true && typeof github.email === 'string' ? github.email.toLowerCase() : '';
  return ADMIN_GITHUB_USERNAMES.includes(login) || ADMIN_EMAILS.includes(email);
}
