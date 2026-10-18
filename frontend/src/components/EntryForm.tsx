import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PAYMENT_METHODS } from '../types';
import type { Category, Direction, PaymentMethod } from '../types';
import { todayStr } from '../format';
import Icon from './Icon';

export interface FormValues {
  amount: string;
  direction: Direction;
  merchant: string;
  date: string;
  time: string;
  category: string;
  paymentMethod: PaymentMethod | '';
  description: string;
}

type Errors = Partial<Record<keyof FormValues, string>>;

interface Props {
  initial: FormValues;
  aiFilled?: Set<string>;
  missing?: Set<string>;
  categories: Category[];
  details?: Record<string, unknown>;
  submitLabel: string;
  saving: boolean;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
}

function validate(v: FormValues): Errors {
  const e: Errors = {};
  const amount = Number(v.amount);
  if (!v.amount || !(amount > 0)) e.amount = 'Enter an amount above 0';
  if (!v.date) e.date = 'Choose a date';
  else if (v.date > todayStr()) e.date = 'Date is in the future';
  if (!v.category) e.category = 'Choose a category';
  return e;
}

const FIELD_ORDER: (keyof FormValues)[] = ['amount', 'date', 'category'];

export default function EntryForm({ initial, aiFilled, missing, categories, details, submitLabel, saving, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => setValues((p) => ({ ...p, [k]: v }));
  const blur = (k: keyof FormValues) => setErrors((p) => ({ ...p, [k]: validate(values)[k] }));

  function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validate(values);
    setErrors(e);
    const first = FIELD_ORDER.find((k) => e[k]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    onSubmit(values);
  }

  const badge = (k: string) =>
    aiFilled?.has(k) ? <span className="chip ai-chip" title="Filled by AI"><Icon name="sparkles" />AI</span> : null;
  const cls = (k: keyof FormValues) =>
    `field${missing?.has(k) && !values[k] ? ' missing' : ''}${errors[k] ? ' invalid' : ''}`;
  const help = (k: keyof FormValues) =>
    errors[k] ? <span className="field-error" id={`${k}-err`}>{errors[k]}</span>
    : missing?.has(k) && !values[k] ? <span className="hint">Not found in the message, please fill</span> : null;
  const aria = (k: keyof FormValues) => ({ 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `${k}-err` : undefined });
  const detailEntries = Object.entries(details ?? {});

  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className={cls('amount')}>
          <label htmlFor="f-amount">Amount (₹) {badge('amount')}</label>
          <input id="f-amount" name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" required
            value={values.amount} onChange={(e) => set('amount', e.target.value)} onBlur={() => blur('amount')} {...aria('amount')} />
          {help('amount')}
        </div>

        <fieldset className="field">
          <legend>Type {badge('direction')}</legend>
          <div className="dir-toggle">
            {(['debit', 'credit'] as const).map((d) => (
              <label key={d}>
                <input type="radio" name="direction" value={d} className={d} checked={values.direction === d} onChange={() => set('direction', d)} />
                <Icon name={d === 'debit' ? 'out' : 'in'} size={15} />{d === 'debit' ? 'Money out' : 'Money in'}
              </label>
            ))}
          </div>
        </fieldset>

        <div className={cls('merchant')}>
          <label htmlFor="f-merchant">Merchant {badge('merchant')}</label>
          <input id="f-merchant" name="merchant" maxLength={120} value={values.merchant} onChange={(e) => set('merchant', e.target.value)} />
          {help('merchant')}
        </div>

        <div className={cls('paymentMethod')}>
          <label htmlFor="f-method">Payment method {badge('paymentMethod')}</label>
          <select id="f-method" name="paymentMethod" value={values.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}>
            <option value="">Choose...</option>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
          {help('paymentMethod')}
        </div>

        <div className={cls('date')}>
          <label htmlFor="f-date">Date {badge('date')}</label>
          <input id="f-date" name="date" type="date" max={todayStr()} required value={values.date}
            onChange={(e) => set('date', e.target.value)} onBlur={() => blur('date')} {...aria('date')} />
          {help('date')}
        </div>

        <div className="field">
          <label htmlFor="f-time">Time {badge('time')}</label>
          <input id="f-time" name="time" type="time" value={values.time} onChange={(e) => set('time', e.target.value)} />
          <span className="hint">Optional. Noon is used if blank.</span>
        </div>

        <div className={cls('category')}>
          <label htmlFor="f-category">Category {badge('category')}</label>
          <select id="f-category" name="category" required value={values.category}
            onChange={(e) => set('category', e.target.value)} onBlur={() => blur('category')} {...aria('category')}>
            <option value="">Choose...</option>
            {categories.map((c) => <option key={c._id}>{c.name}</option>)}
            {values.category && !categories.some((c) => c.name === values.category) && <option>{values.category}</option>}
          </select>
          {help('category')}
        </div>

        <div className="field">
          <label htmlFor="f-desc">Description {badge('description')}</label>
          <input id="f-desc" name="description" maxLength={500} value={values.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        {detailEntries.length > 0 && (
          <div className="field wide">
            <details>
              <summary>Extra details</summary>
              <dl className="kv">
                {detailEntries.map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt>{k}</dt>
                    <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        )}
      </div>

      <div className="form-foot">
        <button type="submit" className="primary" disabled={saving}><Icon name="check" size={16} />{saving ? 'Saving…' : submitLabel}</button>
        <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
    </form>
  );
}
