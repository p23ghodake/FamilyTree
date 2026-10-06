import React, { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../lib/AuthContext';
import './LoginModal.css';

const LoginModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { signInWithPassword, signInWithGitHub } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

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
      <form className="login-modal" onClick={event => event.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Sign in to edit</h3>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" className="toolbar__btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="toolbar__btn" onClick={handleGitHub}>Sign in with GitHub</button>
        <button type="button" className="toolbar__btn" onClick={onClose}>Cancel</button>
      </form>
    </div>
  );
};

export default LoginModal;
