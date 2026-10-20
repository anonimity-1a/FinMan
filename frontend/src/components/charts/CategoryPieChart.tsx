import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import Amount from '../Amount';
import { formatMoney } from '../../format';
import { useCurrency } from '../../currency';
import type { CategoryPoint } from '../../types';

export default function CategoryPieChart({ data }: { data: CategoryPoint[] }) {
  const code = useCurrency();
  const total = data.reduce((s, d) => s + d.total, 0);
  if (total === 0) return <div className="empty"><p>No spending in this month</p></div>;
  return (
    <div className="donut-wrap">
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="category" innerRadius={66} outerRadius={94} paddingAngle={2}
              stroke="none" cornerRadius={3} startAngle={90} endAngle={-270}>
              {data.map((d) => <Cell key={d.category} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v) => formatMoney(Number(v), code)}
              contentStyle={{ borderRadius: 10, border: '1px solid #e9e1e0', fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-total">
          <span className="hint">Total spent</span>
          <Amount value={total} className="mid-amount" />
        </div>
      </div>
      <ul className="cat-list">
        {data.slice(0, 6).map((d) => (
          <li key={d.category} className="cat-row">
            <span className="name"><span className="swatch" style={{ background: d.color }} aria-hidden="true" />{d.category}</span>
            <span className="hint num">{Math.round((d.total / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
