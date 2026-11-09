import { useEffect, useState } from 'react';
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api';

const COLORS = ['#16a34a', '#f59e0b', '#dc2626', '#6b7280', '#2563eb', '#8b5cf6'];

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [certs, setCerts] = useState({});
  const [vers, setVers] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/certificates'),
      api.get('/dashboard/verifications'),
    ])
      .then(([s, c, v]) => {
        setStats(s || {});
        setCerts(c || {});
        setVers(v || {});
      })
      .catch((e) => setError(e.message));
  }, []);

  const cards = [
    ['Applicants', stats.total_applicants],
    ['Certificates', stats.total_certificates],
    ['Issuers', stats.total_issuers],
    ['Verifiers', stats.total_verifiers],
    ['Revoked', stats.revoked],
    ['Verifications', stats.total_verifications],
  ];

  const certsByStatus = certs?.by_status || [];
  const versByDay = vers?.by_day || [];

  return (
    <div>
      <div className="page-head"><h2>Dashboard</h2></div>
      {error && <div className="alert">{error}</div>}
      <div className="cards">
        {cards.map(([l, v]) => <div className="card stat" key={l}><span>{l}</span><b>{v ?? '—'}</b></div>)}
      </div>
      <div className="charts">
        <div className="card">
          <h4>Certificates by status</h4>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={certsByStatus} dataKey="count" nameKey="label" outerRadius={90} label>
                {certsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h4>Verifications (last 30 days)</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={versByDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
