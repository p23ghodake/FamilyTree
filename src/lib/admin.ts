import { User } from '@supabase/supabase-js';

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
