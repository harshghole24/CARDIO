import { supabase } from './supabase';

const API_URL = 'http://localhost:5000/api';

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
};

export const api = {
  getDashboard: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/dashboard`, { headers });
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },
  getCards: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/cards`, { headers });
    if (!res.ok) throw new Error('Failed to fetch cards');
    return res.json();
  },
  getCatalogueCards: async () => {
    const res = await fetch(`${API_URL}/catalogue/cards`);
    if (!res.ok) throw new Error('Failed to fetch catalogue');
    return res.json();
  },
  addCard: async (data: any) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/cards`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add card');
    }
    return res.json();
  },
  getTravelGoals: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/travel-goals`, { headers });
    if (!res.ok) throw new Error('Failed to fetch travel goals');
    return res.json();
  },
  getRecommendation: async (amount: number, category: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/recommendations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount, category })
    });
    if (!res.ok) throw new Error('Failed to fetch recommendation');
    return res.json();
  },
  getTransactions: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/transactions`, { headers });
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },
  addTransaction: async (data: any) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to add transaction');
    return res.json();
  }
};
