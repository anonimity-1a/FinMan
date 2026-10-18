import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inr, shortDay } from '../../format';
import type { DailyPoint } from '../../types';

const compact = (v: number) => (v >= 1000 ? `₹${(v / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k` : `₹${v}`);

// Colours come from the --panel-* theme tokens (see .statement rules in index.css).
export default function SpendingOverTimeChart({ data }: { data: DailyPoint[] }) {
  if (data.every((d) => d.total === 0)) return <div className="empty-chart">No spending in this period</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} interval="preserveStartEnd" minTickGap={28}
            tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={compact} width={52} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Tooltip
            cursor={{ opacity: 0.6 }}
            labelFormatter={(l) => shortDay(String(l))}
            formatter={(v) => [inr.format(Number(v)), 'Spent']}
            contentStyle={{ borderRadius: 10, border: '1px solid #e9e1e0', fontSize: 13, boxShadow: '0 8px 24px -12px rgba(0,0,0,.3)' }}
          />
          <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
