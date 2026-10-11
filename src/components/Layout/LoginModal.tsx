import React, { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../lib/AuthContext';
import { EyeIcon, XIcon } from '../Icons';
import './LoginModal.css';

const GitHubMark: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);

const LoginModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { signInWithPassword, signInWithGitHub } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await signInWithPassword(email.trim(), password);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGitHub = async () => {
    try {
      await signInWithGitHub();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'GitHub sign in failed.');
    }
  };

  return (
    <div className="login-modal__backdrop" onClick={onClose}>
      <div
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={event => event.stopPropagation()}
      >
        <button type="button" className="login-modal__close" onClick={onClose} aria-label="Close">
          <XIcon size={16} />
        </button>

        <div className="login-modal__header">
          <div className="login-modal__logo" aria-hidden="true">🌳</div>
          <h3 id="login-title">Welcome back</h3>
          <p>Sign in to add, edit and save family members.</p>
        </div>

        <form className="login-modal__form" onSubmit={handleSubmit}>
          <label className="login-modal__field">
            <span>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="login-modal__field">
            <span>Password</span>
            <div className="login-modal__password">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-modal__eye"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                <EyeIcon size={16} />
              </button>
            </div>
          </label>

          <button type="submit" className="login-modal__primary" disabled={busy}>
            {busy ? <><span className="login-modal__spinner" />Signing in…</> : 'Sign in'}
          </button>
        </form>

        <div className="login-modal__divider"><span>or</span></div>

        <button type="button" className="login-modal__github" onClick={handleGitHub}>
          <GitHubMark /> Continue with GitHub
        </button>

        <p className="login-modal__note">Browsing the family tree doesn’t need an account.</p>
      </div>
    </div>
  );
};

export default LoginModal;
