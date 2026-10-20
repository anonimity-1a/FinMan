import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, formatMoneyCompact, shortDay } from '../../format';
import { useCurrency } from '../../currency';
import type { DailyPoint } from '../../types';

export default function SpendingOverTimeChart({ data }: { data: DailyPoint[] }) {
  const code = useCurrency();
  if (data.every((d) => d.total === 0)) return <div className="empty-chart">No spending in this period</div>;
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} interval="preserveStartEnd" minTickGap={28}
            tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => formatMoneyCompact(Number(v), code)} width={64} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <Tooltip
            cursor={{ opacity: 0.6 }}
            labelFormatter={(l) => shortDay(String(l))}
            formatter={(v) => [formatMoney(Number(v), code), 'Spent']}
            contentStyle={{ borderRadius: 10, border: '1px solid #e9e1e0', fontSize: 13, boxShadow: '0 8px 24px -12px rgba(0,0,0,.3)' }}
          />
          <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
