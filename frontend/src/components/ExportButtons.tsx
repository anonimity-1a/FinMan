import { BASE } from '../api';
import Icon from './Icon';

export default function ExportButtons() {
  return (
    <div className="actions">
      <a className="button" href={`${BASE}/api/export/csv`} download><Icon name="download" size={16} />CSV</a>
      <a className="button" href={`${BASE}/api/export/json`} download><Icon name="download" size={16} />JSON</a>
    </div>
  );
}
