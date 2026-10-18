import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import Icon from '../components/Icon';
import type { Category } from '../types';

function Row({ cat, onDone }: { cat: Category; onDone: (msg: string) => void }) {
  const [name, setName] = useState(cat.name);
  const [color, setColor] = useState(cat.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changed = name.trim() !== cat.name || color !== cat.color;
  const used = cat.transactionCount ?? 0;

  async function save() {
    setBusy(true); setError('');
    try {
      const r = await api.updateCategory(cat.name, {
        ...(name.trim() !== cat.name ? { name: name.trim() } : {}),
        ...(color !== cat.color ? { color } : {}),
      });
      onDone(name.trim() !== cat.name
        ? `Renamed “${cat.name}” to “${r.category.name}” and updated ${r.transactionsUpdated} ${r.transactionsUpdated === 1 ? 'entry' : 'entries'} in one database transaction.`
        : `Updated the colour of “${cat.name}”.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the category “${cat.name}”?`)) return;
    setBusy(true); setError('');
    try {
      await api.deleteCategory(cat.name);
      onDone(`Deleted “${cat.name}”.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <li className="cat-edit">
      <input type="color" aria-label={`Colour for ${cat.name}`} value={color} onChange={(e) => setColor(e.target.value)} />
      <input aria-label={`Name for ${cat.name}`} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      <span className="hint num">{used} {used === 1 ? 'entry' : 'entries'}</span>
      <div className="actions">
        <button className="small primary" disabled={!changed || !name.trim() || busy} onClick={save}>Save</button>
        <button className="small icon-btn danger-ghost" disabled={busy || used > 0} onClick={remove}
          aria-label={`Delete ${cat.name}`} title={used > 0 ? 'In use. Rename it or move its entries first' : 'Delete'}>
          <Icon name="trash" size={16} />
        </button>
      </div>
      {error && <p className="field-error cat-error" role="alert">{error}</p>}
    </li>
  );
}

export default function Categories() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#8a2b3d');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => api.categories().then(setCats).catch((e: Error) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setAdding(true); setError('');
    try {
      await api.createCategory(name.trim(), color);
      setNotice(`Added “${name.trim()}”.`);
      setName('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Categories</h1>
          <p>Renaming one updates every entry that uses it, all at once.</p>
        </div>
      </div>
      <div className="stack">
        {notice && <div className="banner ok" role="status"><Icon name="check" size={18} /><div>{notice}</div></div>}
        {error && <div className="banner error" role="alert"><div>{error}</div></div>}
        <form className="card cat-add" onSubmit={add}>
          <input type="color" aria-label="Colour" value={color} onChange={(e) => setColor(e.target.value)} />
          <input aria-label="New category name" placeholder="New category, e.g. Subscriptions" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="primary" disabled={!name.trim() || adding}><Icon name="plus" size={16} />Add</button>
        </form>
        <section className="card">
          {!cats ? <div className="skeleton" style={{ height: 240 }} role="status" aria-label="Loading" /> : (
            <ul className="cat-edit-list">
              {cats.map((c) => (
                <Row key={`${c._id}-${c.name}-${c.color}`} cat={c} onDone={(m) => { setNotice(m); load(); }} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
