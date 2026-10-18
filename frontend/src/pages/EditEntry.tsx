import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError, api } from '../api';
import EntryForm from '../components/EntryForm';
import type { FormValues } from '../components/EntryForm';
import { fromInputs, toDateInput, toTimeInput } from '../format';
import type { Category, Transaction } from '../types';

export default function EditEntry() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(id).then(setTx).catch((e: Error) => {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setNotFound(true);
      else setError(e.message);
    });
    api.categories().then(setCategories).catch(() => {});
  }, [id]);

  async function save(v: FormValues) {
    if (!tx) return;
    setSaving(true); setError('');
    try {
      await api.update(id, {
        amount: Number(v.amount),
        direction: v.direction,
        merchant: v.merchant,
        occurredAt: fromInputs(v.date, v.time),
        description: v.description,
        category: v.category,
        paymentMethod: v.paymentMethod || 'Other',
        source: tx.source,
        aiParsed: tx.aiParsed,
        details: tx.details ?? {},
        ...(tx.rawInput ? { rawInput: tx.rawInput } : {}),
      });
      navigate(-1);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  if (notFound) {
    return <div className="empty"><p>This transaction no longer exists.</p><Link to="/history">Back to history</Link></div>;
  }

  return (
    <>
      <div className="page-head"><h1>Edit entry</h1></div>
      {error && <div className="banner error" role="alert">{error}</div>}
      {!tx && !error && <p className="muted" role="status">Loading...</p>}
      {tx && (
        <div className="card">
          <EntryForm
            initial={{
              amount: String(tx.amount), direction: tx.direction, merchant: tx.merchant ?? '',
              date: toDateInput(tx.occurredAt), time: toTimeInput(tx.occurredAt), category: tx.category,
              paymentMethod: tx.paymentMethod, description: tx.description ?? '',
            }}
            categories={categories} details={tx.details} submitLabel="Save changes" saving={saving}
            onSubmit={save} onCancel={() => navigate(-1)} />
        </div>
      )}
    </>
  );
}
