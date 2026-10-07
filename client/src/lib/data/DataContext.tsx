import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadDataStore, type DataStore } from './dataStore';

interface DataContextValue {
  store: DataStore | null;
  loading: boolean;
  error: string | null;
}

const DataContext = createContext<DataContextValue>({ store: null, loading: true, error: null });

export function DataProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<DataStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDataStore()
      .then(s => {
        setStore(s);
        setLoading(false);
      })
      .catch(err => {
        console.error('[DataProvider] Failed to load data:', err);
        setError(err.message || 'Failed to load dataset');
        setLoading(false);
      });
  }, []);

  return (
    <DataContext.Provider value={{ store, loading, error }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDataStore(): DataContextValue {
  return useContext(DataContext);
}
