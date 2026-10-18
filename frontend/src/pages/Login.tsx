import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import Icon from '../components/Icon';

export default function Login({ onSignedIn }: { onSignedIn: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const me = await api.login(email, password);
      onSignedIn(me.email);
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
        <h1>Sign in</h1>
        <p className="muted">Your spending, read from the messages your bank already sends.</p>
        {error && <div className="banner error" role="alert"><div>{error}</div></div>}
        <div className="field">
          <label htmlFor="l-email">Email</label>
          <input id="l-email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="l-pass">Password</label>
          <input id="l-pass" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="primary" disabled={busy}><Icon name="lock" size={16} />{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
