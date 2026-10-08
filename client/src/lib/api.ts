import { supabase } from './supabase';

const API_URL = 'http://localhost:5000/api';

const getAuthHeaders = async (forceRefresh = false) => {
  if (forceRefresh) {
    await supabase.auth.refreshSession();
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/login?msg=Session%20expired,%20please%20sign%20in%20again';
    throw new Error('Session expired');
  }
  
  // If expiring in < 60s, refresh preemptively
  if (!forceRefresh && session.expires_at && session.expires_at - Math.floor(Date.now() / 1000) < 60) {
    const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
    if (refreshedSession) {
       return {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${refreshedSession.access_token}`
       };
    }
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
};

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 1): Promise<any> => {
  const headers = await getAuthHeaders(false);
  let res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  
  if (res.status === 401 && retries > 0) {
    console.warn('[API] 401 Unauthorized received, attempting token refresh...');
    const newHeaders = await getAuthHeaders(true); // Force refresh
    res = await fetch(url, { ...options, headers: { ...newHeaders, ...options.headers } });
  }

  if (!res.ok) {
    if (res.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login?msg=Session%20expired,%20please%20sign%20in%20again';
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed with status ${res.status}`);
  }
  return res.json();
};

export const api = {
  getDashboard: () => fetchWithRetry(`${API_URL}/dashboard`),
  getCards: () => fetchWithRetry(`${API_URL}/cards`),
  getCatalogueCards: async () => {
    const res = await fetch(`${API_URL}/catalogue/cards`);
    if (!res.ok) throw new Error('Failed to fetch catalogue');
    return res.json();
  },
  addCard: (data: any) => fetchWithRetry(`${API_URL}/cards`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  deleteCard: (userCardId: string) => fetchWithRetry(`${API_URL}/cards/${userCardId}`, {
    method: 'DELETE'
  }),
  getTransactions: () => fetchWithRetry(`${API_URL}/transactions`),
  addTransaction: (data: any) => fetchWithRetry(`${API_URL}/transactions`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTransaction: (id: string, data: any) => fetchWithRetry(`${API_URL}/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteTransaction: (id: string) => fetchWithRetry(`${API_URL}/transactions/${id}`, {
    method: 'DELETE'
  }),
  getTravelGoals: () => fetchWithRetry(`${API_URL}/travel-goals`),
  saveTravelGoal: (data: any) => fetchWithRetry(`${API_URL}/travel-goals`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getRecommendation: (amount: number, category: string) => fetchWithRetry(`${API_URL}/recommendations`, {
    method: 'POST',
    body: JSON.stringify({ amount, category })
  }),
  getBestCardForPurchase: (amount: number, category: string) => fetchWithRetry(`${API_URL}/recommendations`, {
    method: 'POST',
    body: JSON.stringify({ amount, category })
  }),
};
