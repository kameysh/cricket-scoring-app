import { useEffect } from 'react';
import { useMatchStore } from '../stores/matchStore';

export function useOfflineSync() {
  const setOnline = useMatchStore(s => s.setOnline);
  const syncOfflineQueue = useMatchStore(s => s.syncOfflineQueue);
  const isOnline = useMatchStore(s => s.isOnline);

  useEffect(() => {
    function goOnline() {
      setOnline(true);
      syncOfflineQueue();
    }
    function goOffline() {
      setOnline(false);
    }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline };
}
