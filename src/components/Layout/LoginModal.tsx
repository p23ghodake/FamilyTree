import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AlertCircleIcon, AlertTriangleIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon, EyeOffIcon, MailIcon, XIcon } from '../Icons';
import { useDialog } from '../useDialog';
import './LoginModal.css';

const GitHubMark: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);

type Step = 'choose' | 'email';

const LoginModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { signInWithPassword, signInWithGitHub } = useAuth();
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const emailOptionRef = useRef<HTMLButtonElement>(null);
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDialog(dialogRef, onClose);

  const shownStepRef = useRef(step);
  useEffect(() => {
    if (shownStepRef.current === step) return;
    shownStepRef.current = step;
    (step === 'email' ? emailInputRef.current : emailOptionRef.current)?.focus();
  }, [step]);

  const goTo = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInWithPassword(email.trim(), password);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(/invalid login credentials/i.test(message) ? t.loginInvalid : message || t.loginFailed);
      setBusy(false);
    }
  };

  const handleGitHub = async () => {
    setError(null);
    setGithubBusy(true);
    try {
      await signInWithGitHub();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.loginGitHubFailed);
      setGithubBusy(false);
    }
  };

  const trackCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState('CapsLock'));
  };

  const errorAlert = error && (
    <div className="login-modal__alert" role="alert">
      <AlertCircleIcon size={16} />
      <span>{error}</span>
    </div>
  );

  return (
    <div className="login-modal__backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="login-modal__grab" aria-hidden="true" />
        <button type="button" className="login-modal__close" onClick={onClose} aria-label={t.close}>
          <XIcon size={16} />
        </button>

        {step === 'choose' ? (
          <div className="login-modal__step">
            <div className="login-modal__logo" aria-hidden="true">🌳</div>
            <h2 id="login-title" className="login-modal__title">{t.loginTitle}</h2>
            <p className="login-modal__subtitle">{t.loginSubtitle}</p>
            {errorAlert}
            <div className="login-modal__methods">
              <button type="button" className="login-modal__method" onClick={handleGitHub} disabled={githubBusy} data-autofocus>
                <span className="login-modal__method-icon login-modal__method-icon--github"><GitHubMark /></span>
                <span className="login-modal__method-text">
                  <strong>{githubBusy ? t.loginGitHubOpening : t.loginGitHub}</strong>
                  <small>{t.loginGitHubHint}</small>
                </span>
                <ChevronRightIcon size={16} className="login-modal__chevron" />
              </button>
              <button type="button" ref={emailOptionRef} className="login-modal__method" onClick={() => goTo('email')}>
                <span className="login-modal__method-icon"><MailIcon size={18} /></span>
                <span className="login-modal__method-text">
                  <strong>{t.loginEmailOption}</strong>
                  <small>{t.loginEmailHint}</small>
                </span>
                <ChevronRightIcon size={16} className="login-modal__chevron" />
              </button>
            </div>
            <p className="login-modal__note">{t.loginBrowseNote}</p>
          </div>
        ) : (
          <form className="login-modal__step login-modal__form" onSubmit={handleSubmit}>
            <button type="button" className="login-modal__back" onClick={() => goTo('choose')}>
              <ChevronLeftIcon size={16} />
              {t.btnBack}
            </button>
            <h2 id="login-title" className="login-modal__title">{t.loginEmailTitle}</h2>
            <p className="login-modal__subtitle">{t.loginEmailSubtitle}</p>
            {errorAlert}
            <div className="login-modal__field">
              <label htmlFor="login-email">{t.loginEmail}</label>
              <input
                ref={emailInputRef}
                id="login-email"
                type="email"
                inputMode="email"
                placeholder={t.loginEmailPlaceholder}
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null); }}
                aria-invalid={error ? true : undefined}
                required
              />
            </div>
            <div className="login-modal__field">
              <label htmlFor="login-password">{t.loginPassword}</label>
              <div className="login-modal__password">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t.loginPasswordPlaceholder}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  onKeyDown={trackCapsLock}
                  onKeyUp={trackCapsLock}
                  onBlur={() => setCapsLock(false)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={capsLock ? 'login-caps' : undefined}
                  required
                />
                <button
                  type="button"
                  className="login-modal__eye"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={t.loginShowPassword}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
              {capsLock && (
                <span id="login-caps" className="login-modal__caps">
                  <AlertTriangleIcon size={13} />
                  {t.loginCapsLock}
                </span>
              )}
            </div>
            <button type="submit" className="login-modal__primary" disabled={busy}>
              {busy ? <><span className="login-modal__spinner" />{t.loginSigningIn}</> : t.authSignIn}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
