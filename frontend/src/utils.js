export const fullName = (r) => [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ');
export const d = (v) => (v ? String(v).slice(0, 10) : '—');
export const today = () => new Date().toISOString().slice(0, 10);
