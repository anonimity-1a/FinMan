import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import Icon from '../components/Icon';
import type { Account } from '../types';

export default function Login({ onSignedIn }: { onSignedIn: (account: Account) => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [login, setLogin] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function switchMode(next: 'in' | 'up') {
    setMode(next);
    setError('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'up' && password !== confirm) {
      setError('Those passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const me = mode === 'in'
        ? await api.login(login, password)
        : await api.register(username, password, displayName.trim());
      onSignedIn(me);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-brand">
        <span className="brand-mark" aria-hidden="true">₹</span>
        <span className="brand-name">FinMan</span>
      </div>
      <form className="card login-card" onSubmit={submit}>
        <h1>{mode === 'in' ? 'Sign in' : 'Create account'}</h1>
        <p className="muted">
          {mode === 'in'
            ? 'Your spending stays with your account, stored in MongoDB.'
            : 'Pick a username. The password is stored only as a secret hash.'}
        </p>
        {error && <div className="banner error" role="alert"><div>{error}</div></div>}
        {mode === 'in' ? (
          <div className="field">
            <label htmlFor="l-login">Username or email</label>
            <input id="l-login" autoComplete="username" required autoFocus value={login} onChange={(e) => setLogin(e.target.value)} />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="l-user">Username</label>
              <input id="l-user" autoComplete="username" required autoFocus minLength={3} maxLength={24}
                pattern="[A-Za-z0-9_]+" title="Letters, numbers, or underscores" value={username}
                onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="l-name">Display name <span className="hint">optional</span></label>
              <input id="l-name" autoComplete="name" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor="l-pass">Password</label>
          <input id="l-pass" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            required minLength={mode === 'up' ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {mode === 'up' && (
          <div className="field">
            <label htmlFor="l-confirm">Confirm password</label>
            <input id="l-confirm" type="password" autoComplete="new-password" required minLength={8}
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        )}
        <button type="submit" className="primary" disabled={busy}>
          <Icon name={mode === 'in' ? 'lock' : 'user'} size={16} />
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <p className="login-switch">
          {mode === 'in' ? (
            <button type="button" className="link" onClick={() => switchMode('up')}>Need an account? Create one</button>
          ) : (
            <button type="button" className="link" onClick={() => switchMode('in')}>Already have an account? Sign in</button>
          )}
        </p>
      </form>
    </div>
  );
}
