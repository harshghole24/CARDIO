/**
 * Local Authentication Provider (Offline SQLite Backend)
 * Replaces remote Supabase Auth with direct local username & password sessions.
 */

const SESSION_KEY = 'cardio_local_session';
const API_URL = 'http://localhost:5000/api';

type AuthListener = (event: string, session: any) => void;
const listeners = new Set<AuthListener>();

function notify(event: string, session: any) {
  listeners.forEach(cb => {
    try {
      cb(event, session);
    } catch (err) {
      console.error('[Auth Listener Error]:', err);
    }
  });
}

export const localAuth = {
  async getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return { data: { session: null }, error: null };
      const session = JSON.parse(raw);
      return { data: { session }, error: null };
    } catch {
      return { data: { session: null }, error: null };
    }
  },

  async getUser() {
    const { data: { session } } = await this.getSession();
    return { data: { user: session?.user || null }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password?: string }) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Invalid username or password');
    }

    const session = {
      access_token: data.token,
      user: data.user
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    notify('SIGNED_IN', session);
    return { data: { session, user: data.user }, error: null };
  },

  async signUp({ email, password, options }: { email: string; password?: string; options?: any }) {
    const fullName = options?.data?.full_name || email;
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password, full_name: fullName })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    const session = {
      access_token: data.token,
      user: data.user
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    notify('SIGNED_IN', session);
    return { data: { session, user: data.user }, error: null };
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
    notify('SIGNED_OUT', null);
    return { error: null };
  },

  onAuthStateChange(callback: AuthListener) {
    listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
          }
        }
      }
    };
  },

  async refreshSession() {
    return this.getSession();
  }
};

// Export as `supabase` to maintain backwards-compatibility across all client components
export const supabase = {
  auth: localAuth
};
