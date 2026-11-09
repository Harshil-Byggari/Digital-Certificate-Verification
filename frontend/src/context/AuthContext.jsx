import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

const VALID_USER_TYPES = ['ADMIN', 'HR', 'VERIFIER', 'APPLICANT'];

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Deduplicate in-flight session checks across React StrictMode mount cycles
let inFlightMePromise = null;

function fetchMe() {
  if (!inFlightMePromise) {
    inFlightMePromise = api.get('/auth/me').finally(() => {
      inFlightMePromise = null;
    });
  }
  return inFlightMePromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem('user') || 'null');
      if (stored && VALID_USER_TYPES.includes(String(stored.role || '').toUpperCase())) {
        return stored;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Validate active session against Oracle ORDS GET /auth/me on mount
  useEffect(() => {
    let isMounted = true;
    const token = sessionStorage.getItem('access_token');

    // Case 1: No token present
    if (!token) {
      sessionStorage.removeItem('user');
      setUser(null);
      setLoading(false);
      return;
    }

    // Case 2: Token present -> validate via GET /auth/me
    fetchMe()
      .then((me) => {
        if (!isMounted) return;

        // Valid token: ensure expected user object and exact user_type
        if (me && me.username && VALID_USER_TYPES.includes(me.user_type)) {
          const role = me.user_type.toLowerCase();
          const u = {
            username: me.username,
            user_id: me.username,
            account_id: me.account_id,
            linked_id: me.linked_id,
            role,
          };
          sessionStorage.setItem('user', JSON.stringify(u));
          setUser(u);
        } else {
          // Unknown or missing role from /auth/me
          sessionStorage.removeItem('access_token');
          sessionStorage.removeItem('user');
          setUser(null);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        // Case 3 (Expired token) & Case 4 (Network failure): clear local session
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(username, password) {
    inFlightMePromise = null;
    const res = await api.post('/auth/login', { username, password });
    if (!res || !res.token || !res.user) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user');
      setUser(null);
      throw new Error('Invalid login response from server');
    }

    const userType = res.user.user_type;
    if (!userType || !VALID_USER_TYPES.includes(userType)) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user');
      setUser(null);
      throw new Error('Unauthorized or unknown user role: ' + (userType || 'none'));
    }

    const role = userType.toLowerCase();
    const u = {
      username: res.user.username,
      user_id: res.user.username,
      account_id: res.user.account_id,
      linked_id: res.user.linked_id,
      role,
    };
    sessionStorage.setItem('access_token', res.token);
    sessionStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    return u;
  }

  async function logout() {
    inFlightMePromise = null;
    try {
      await api.post('/auth/logout');
    } catch {
      // Server down, network timeout, or offline: proceed with local clearance
    } finally {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user');
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
