import { Session, User } from '@supabase/supabase-js';
import { canDeleteMembers, isAdminUser } from './admin';

const user = (over: Record<string, unknown>) => over as unknown as User;
const token = (method: string) => `h.${btoa(JSON.stringify({ amr: [{ method }] }))}.s`;
const session = (method: string, identityData: Record<string, unknown>) => ({
  access_token: token(method),
  user: user({ email: 'ghodake.pankaj@gmail.com', email_confirmed_at: 'x', identities: [{ provider: 'github', identity_data: identityData }] }),
}) as unknown as Session;

describe('canDeleteMembers', () => {
  it('allows the admin GitHub account by username or verified GitHub email', () => {
    expect(canDeleteMembers(session('oauth', { user_name: 'p23ghodake' }))).toBe(true);
    expect(canDeleteMembers(session('oauth', { user_name: 'someone', email: 'Ghodake.Pankaj@gmail.com', email_verified: true }))).toBe(true);
  });
  it('requires a GitHub sign-in, not email and password', () => {
    expect(canDeleteMembers(session('password', { user_name: 'p23ghodake' }))).toBe(false);
    const emailOnly = { access_token: token('password'), user: user({ email: 'ghodake.pankaj@gmail.com', email_confirmed_at: 'x', identities: [] }) } as unknown as Session;
    expect(canDeleteMembers(emailOnly)).toBe(false);
  });
  it('rejects other GitHub accounts, unverified emails and signed-out users', () => {
    expect(canDeleteMembers(session('oauth', { user_name: 'cousin' }))).toBe(false);
    expect(canDeleteMembers(session('oauth', { user_name: 'cousin', email: 'ghodake.pankaj@gmail.com', email_verified: false }))).toBe(false);
    expect(canDeleteMembers(null)).toBe(false);
  });
});

describe('isAdminUser', () => {
  it('accepts the GitHub identity username', () => {
    expect(isAdminUser(user({ identities: [{ provider: 'github', identity_data: { user_name: 'P23Ghodake' } }] }))).toBe(true);
  });
  it('ignores editable user_metadata', () => {
    expect(isAdminUser(user({ user_metadata: { user_name: 'p23ghodake' }, identities: [] }))).toBe(false);
  });
  it('accepts a confirmed admin email only', () => {
    expect(isAdminUser(user({ email: 'ghodake.pankaj@gmail.com', email_confirmed_at: '2026-01-01' }))).toBe(true);
    expect(isAdminUser(user({ email: 'ghodake.pankaj@gmail.com' }))).toBe(false);
  });
  it('rejects others and signed-out users', () => {
    expect(isAdminUser(user({ email: 'a@b.c', email_confirmed_at: 'x', identities: [{ provider: 'github', identity_data: { user_name: 'other' } }] }))).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });
});
