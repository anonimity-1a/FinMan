import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiError, api } from '../api';
import EntryForm from '../components/EntryForm';
import type { FormValues } from '../components/EntryForm';
import ParseInput from '../components/ParseInput';
import Amount from '../components/Amount';
import Icon from '../components/Icon';
import SampleMessages from '../components/SampleMessages';
import { formatMoney, fromInputs, moneySymbol, todayStr } from '../format';
import { useCurrency } from '../currency';
import type { Category, ParseResult, Source, TransactionInput } from '../types';

type Step = 'input' | 'parsing' | 'review' | 'saving';

interface Review {
  values: FormValues;
  aiFilled: Set<string>;
  missing: Set<string>;
  details: Record<string, unknown>;
  rawInput: string;
  source: Source;
  warnings: string[];
}

const EMPTY: FormValues = { amount: '', direction: 'debit', merchant: '', date: todayStr(), time: '', category: '', paymentMethod: '', description: '' };

const manualReview = (): Review => ({
  values: { ...EMPTY, date: todayStr() }, aiFilled: new Set(), missing: new Set(), details: {}, rawInput: '', source: 'manual', warnings: [],
});

function fromParse(r: ParseResult): Review {
  const f = r.fields!;
  return {
    values: {
      amount: f.amount != null ? String(f.amount) : '',
      direction: f.direction ?? 'debit',
      merchant: f.merchant ?? '',
      date: f.date ?? todayStr(),
      time: f.time ?? '',
      category: f.category ?? '',
      paymentMethod: f.paymentMethod ?? '',
      description: f.description ?? '',
    },
    aiFilled: new Set(r.aiFilled),
    missing: new Set(f.date ? r.missing : [...r.missing, 'date']),
    details: f.details,
    rawInput: r.rawInput,
    source: r.source,
    warnings: r.warnings,
  };
}

export default function AddEntry() {
  const currency = useCurrency();
  const [step, setStep] = useState<Step>('input');
  const [text, setText] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [notTx, setNotTx] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [saved, setSaved] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => { api.categories().then(setCategories).catch((e: Error) => setError(e.message)); }, []);

  async function run(call: () => Promise<ParseResult>) {
    setStep('parsing'); setError(''); setNotTx(false); setSaved(''); setDuplicate(false);
    try {
      const r = await call();
      if (!r.isTransaction) { setNotTx(true); setStep('input'); return; }
      setReview(fromParse(r));
      setFormKey((k) => k + 1);
      setStep('review');
    } catch (e) {
      setError((e as Error).message);
      setStep('input');
    }
  }

  const manual = () => { setReview(manualReview()); setFormKey((k) => k + 1); setSaved(''); setDuplicate(false); setError(''); setNotTx(false); setStep('review'); };

  async function save(v: FormValues) {
    if (!review) return;
    const payload: TransactionInput = {
      amount: Number(v.amount),
      direction: v.direction,
      merchant: v.merchant,
      occurredAt: fromInputs(v.date, v.time),
      description: v.description,
      category: v.category,
      paymentMethod: v.paymentMethod || 'Other',
      source: review.source,
      aiParsed: review.aiFilled.size > 0,
      details: review.details,
      ...(review.rawInput ? { rawInput: review.rawInput } : {}),
    };
    setStep('saving'); setError(''); setDuplicate(false);
    try {
      await api.create(payload);
      setSaved(`Saved ${formatMoney(payload.amount, currency)}${payload.merchant ? ` at ${payload.merchant}` : ''}`);
      setText(''); setReview(null); setStep('input');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setDuplicate(true);
      else setError((e as Error).message);
      setStep('review');
    }
  }

  const banners = (
    <>
      {saved && (
        <div className="banner ok" role="status">
          <Icon name="check" size={18} />
          <div>{saved}. <Link to="/history">See it in transactions</Link></div>
        </div>
      )}
      {duplicate && (
        <div className="banner error" role="alert">
          <div>You already saved this message. <Link to="/history">Open transactions</Link></div>
        </div>
      )}
    </>
  );

  if (review && (step === 'review' || step === 'saving')) {
    const amount = Number(review.values.amount);
    return (
      <>
        <div className="page-head">
          <div><h1>Check and save</h1><p>Fix anything the AI got wrong, then save.</p></div>
        </div>
        <div className="stack">
          <section className="statement review-head" aria-label="Parsed transaction">
            <div>
              <div className="statement-label"><span className="dot" />
                {review.source === 'manual' ? 'Manual entry' : review.values.direction === 'credit' ? 'Money in' : 'Money out'}
              </div>
              {amount > 0 ? <Amount value={amount} className="big-amount" /> : <div className="big-amount" style={{ opacity: 0.4 }}>{moneySymbol(currency)} —</div>}
              <div className="meta">
                <span>{review.values.merchant || 'Unknown merchant'}</span>
                {review.values.category && <span className="chip">{review.values.category}</span>}
                {review.values.paymentMethod && <span className="chip">{review.values.paymentMethod}</span>}
              </div>
            </div>
            {review.aiFilled.size > 0 && (
              <span className="chip signal"><Icon name="sparkles" size={13} />AI filled {review.aiFilled.size} fields</span>
            )}
          </section>

          {banners}
          {error && <div className="banner error" role="alert"><div>{error}</div></div>}
          {review.warnings.length > 0 && (
            <div className="banner warn" role="status"><ul>{review.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>
          )}

          <div className="grid-main">
            <section className="card">
              <EntryForm key={formKey} initial={review.values} aiFilled={review.aiFilled} missing={review.missing}
                categories={categories} details={review.details} submitLabel="Save entry" saving={step === 'saving'}
                onSubmit={save} onCancel={() => { setStep('input'); setDuplicate(false); setError(''); }} />
            </section>
            {review.rawInput ? (
              <details className="raw-panel" open>
                <summary>Original message</summary>
                <pre>{review.rawInput}</pre>
              </details>
            ) : <div />}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Add entry</h1><p>Paste a bank SMS or upload a bill. FinMan reads it and you confirm.</p></div>
      </div>
      <div className="grid-main">
        <div className="stack">
          {banners}
          {notTx && (
            <div className="banner warn" role="status">
              <div>
                This looks like an OTP or promotion, not a transaction.
                <div className="actions">
                  <button className="small" onClick={manual}>Enter manually</button>
                  <button className="small" onClick={() => setNotTx(false)}>Edit text</button>
                </div>
              </div>
            </div>
          )}
          <ParseInput text={text} setText={setText} busy={step === 'parsing'} error={error}
            onParseText={() => run(() => api.parse(text, 'sms'))}
            onParseFile={(blob, name) => run(() => api.parseFile(blob, name))}
            onManual={manual} />
        </div>
        <SampleMessages onPick={(t) => { setText(t); setNotTx(false); setSaved(''); document.getElementById('parse-text')?.focus(); }} />
      </div>
    </>
  );
}
