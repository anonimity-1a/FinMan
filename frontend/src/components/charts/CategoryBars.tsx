import Amount from '../Amount';
import type { CategoryPoint } from '../../types';

export default function CategoryBars({ data, empty }: { data: CategoryPoint[]; empty: string }) {
  const max = Math.max(0, ...data.map((d) => d.total));
  if (max === 0) return <div className="empty"><p>{empty}</p></div>;
  return (
    <ul className="cat-list">
      {data.map((d) => (
        <li key={d.category} className="cat-row">
          <span className="name"><span className="swatch" style={{ background: d.color }} aria-hidden="true" />{d.category}
            <span className="hint">· {d.count}</span></span>
          <Amount value={d.total} />
          <span className="bar" aria-hidden="true"><span style={{ width: `${(d.total / max) * 100}%`, background: d.color }} /></span>
        </li>
      ))}
    </ul>
  );
}
