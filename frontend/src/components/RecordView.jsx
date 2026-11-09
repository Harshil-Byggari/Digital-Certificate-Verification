// Generic read-only key/value view for any row (verification details, revocation details...)
export default function RecordView({ row }) {
  return (
    <dl className="kv">
      {Object.entries(row).map(([k, v]) => (
        <div key={k}>
          <dt>{k.replace(/_/g, ' ')}</dt>
          <dd>{v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
