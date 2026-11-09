// Edits a multivalued attribute (emails or phones) -> saved to the child tables via PUT /:id/contacts
export default function ContactEditor({ label, values, onChange, type = 'text', placeholder }) {
  const list = values.length ? values : [''];
  const set = (i, v) => onChange(list.map((x, idx) => (idx === i ? v : x)));
  return (
    <div className="field full">
      <label>{label}</label>
      {list.map((v, i) => (
        <div className="row-inline" key={i}>
          <input type={type} value={v} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          <button type="button" className="btn ghost" onClick={() => onChange(list.filter((_, idx) => idx !== i))} disabled={list.length === 1 && !v}>Remove</button>
        </div>
      ))}
      <button type="button" className="btn ghost small" onClick={() => onChange([...list, ''])}>+ Add {label.toLowerCase().replace(/s$/, '')}</button>
    </div>
  );
}
