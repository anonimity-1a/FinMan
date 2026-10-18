import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ParserStat } from '../types';
import Icon from './Icon';

// Synthetic messages (fake accounts and references) for trying the parser.
const SAMPLES = [
  { label: 'UPI payment', text: 'Rs.850.00 debited from A/c XX4521 on 23-08-26 to VPA swiggy@icici (UPI Ref No 523614789012). Not you? Call 1800-000-0000 -XYZ Bank' },
  { label: 'Card spend', text: 'INR 2,499.00 spent on XYZ Bank Credit Card XX9087 at AMAZON PAY INDIA on 2026-09-14 18:22:10. Avl Lmt: INR 47,501.00' },
  { label: 'Salary credit', text: 'Dear Customer, Rs.45,000.00 credited to your A/c XX4521 on 01-Oct-26 by NEFT from ACME TECH PVT LTD. Avl Bal Rs.52,310.40' },
  { label: 'Food order', text: 'Swiggy Order #18273645 | Paneer Butter Masala x1 Rs.260, Garlic Naan x2 Rs.120 | Item total Rs.380 | GST Rs.19 | Delivery Rs.30 | Grand Total Rs.429 | 05 Oct 2026 20:41' },
  { label: 'OTP (not a spend)', text: '482913 is your OTP for login. Do not share it with anyone. -XYZ Bank' },
];

export default function SampleMessages({ onPick }: { onPick: (text: string) => void }) {
  const [stats, setStats] = useState<ParserStat[]>([]);
  useEffect(() => { api.parserStats().then(setStats).catch(() => {}); }, []);
  const runs = stats.reduce((n, s) => n + s.runs, 0);
  const ok = stats.reduce((n, s) => n + s.runs * s.successRate, 0);
  return (
    <aside className="card">
      <div className="card-head"><h2>Try a sample</h2><span className="sub">Synthetic data</span></div>
      <ul className="samples">
        {SAMPLES.map((s) => (
          <li key={s.label}>
            <button className="sample" onClick={() => onPick(s.text)}>
              <strong><Icon name="message" size={14} />{s.label}</strong>
              <span>{s.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="side-note">The AI only suggests. Every field stays editable, and nothing is saved until you press Save.</p>
      {runs > 0 && (
        <p className="parser-stat">
          Last 30 days: {runs} {runs === 1 ? 'read' : 'reads'}, {Math.round((ok / runs) * 100)}% by AI,
          {' '}avg {(stats.reduce((n, s) => n + s.avgMs * s.runs, 0) / runs / 1000).toFixed(1)}s.
        </p>
      )}
    </aside>
  );
}
