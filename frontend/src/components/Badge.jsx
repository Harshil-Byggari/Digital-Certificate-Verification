const COLORS = {
  valid: 'green',
  active: 'green',
  expired: 'amber',
  revoked: 'red',
  invalid: 'red',
  tampered: 'purple',
  draft: 'gray',
  pending: 'gray',
};
export default function Badge({ value }) {
  if (!value) return null;
  return <span className={`badge ${COLORS[String(value).toLowerCase()] || 'gray'}`}>{value}</span>;
}
