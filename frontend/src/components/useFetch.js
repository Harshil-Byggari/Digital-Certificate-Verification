import { useEffect, useState } from 'react';
import { api } from '../services/api';

// Loads several endpoints at once. Returns null while loading, then an array (null for any that failed).
export default function useFetch(paths) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    let alive = true;
    Promise.allSettled(paths.map((p) => api.get(p))).then((r) => {
      if (alive) setRes(r.map((x) => (x.status === 'fulfilled' ? x.value : null)));
    });
    return () => { alive = false; };
  }, [paths.join('|')]);
  return res;
}
