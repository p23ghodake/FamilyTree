import { User } from '@supabase/supabase-js';
import { isAdminUser } from './admin';

const user = (over: Record<string, unknown>) => over as unknown as User;

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
