import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import Icon from '../components/Icon';
import { currencyOptions, moneySymbol } from '../format';
import type { Account, CurrencyCode } from '../types';

const when = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

function stamp(iso: string | null) {
  if (!iso) return 'Not yet';
  return when.format(new Date(iso));
}

export default function AccountPage({ user, onUpdated }: { user: Account; onUpdated: (account: Account) => void }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [currency, setCurrency] = useState<CurrencyCode>(user.currency || 'INR');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy('profile');
    setError('');
    setNotice('');
    try {
      const next = await api.updateProfile({ displayName: displayName.trim(), currency });
      onUpdated(next);
      setDisplayName(next.displayName);
      setCurrency(next.currency);
      setNotice('Profile saved.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (newPassword !== confirm) {
      setError('Those passwords do not match');
      return;
    }
    setBusy('password');
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setNotice('Password updated. The old one no longer works.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p>Your login lives in MongoDB. Transactions on this server belong only to this account.</p>
        </div>
      </div>
      <div className="stack">
        {notice && <div className="banner ok" role="status"><Icon name="check" size={18} /><div>{notice}</div></div>}
        {error && <div className="banner error" role="alert"><div>{error}</div></div>}
        <div className="grid-2">
          <section className="card stack">
            <div className="card-head"><h2>Profile</h2></div>
            <dl className="kv">
              <dt>Username</dt>
              <dd>{user.username}</dd>
              <dt>Email</dt>
              <dd>{user.email ?? 'None'}</dd>
              <dt>Member since</dt>
              <dd>{stamp(user.createdAt)}</dd>
              <dt>Last sign-in</dt>
              <dd>{stamp(user.lastLoginAt)}</dd>
            </dl>
            <form className="stack" onSubmit={saveProfile}>
              <div className="field">
                <label htmlFor="a-name">Display name</label>
                <input id="a-name" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="a-currency">Currency</label>
                <select id="a-currency" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
                  {currencyOptions.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code}) · {moneySymbol(c.code)}</option>
                  ))}
                </select>
                <span className="hint">Shown on amounts. Existing numbers stay as they are and are not converted.</span>
              </div>
              <button type="submit" className="primary" disabled={busy !== null || (displayName.trim() === user.displayName && currency === (user.currency || 'INR'))}>
                {busy === 'profile' ? 'Saving…' : 'Save profile'}
              </button>
            </form>
          </section>
          <section className="card stack">
            <div className="card-head">
              <h2>Password</h2>
              <span className="sub">Stored as a salted hash</span>
            </div>
            <p className="muted">FinMan never keeps the password itself, so this screen cannot show it. Enter the current one to replace it.</p>
            <form className="stack" onSubmit={savePassword}>
              <div className="field">
                <label htmlFor="a-current">Current password</label>
                <input id="a-current" type="password" autoComplete="current-password" required value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="a-new">New password</label>
                <input id="a-new" type="password" autoComplete="new-password" required minLength={8} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="a-confirm">Confirm new password</label>
                <input id="a-confirm" type="password" autoComplete="new-password" required minLength={8} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <button type="submit" className="primary" disabled={busy !== null}>
                <Icon name="lock" size={16} />{busy === 'password' ? 'Updating…' : 'Change password'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
