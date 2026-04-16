import { useEffect, useState } from 'react';
import { pushOfflineScans } from '@/lib/db';
import { useAuth } from '@/contexts/auth-context';

export function useSync() {
  const { session } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const forceSync = async () => {
    if (!session?.access_token) return;
    setIsSyncing(true);
    try {
      await pushOfflineScans(session.access_token);
    } catch (error) {
      console.error("Force sync failed", error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!session?.access_token) return;

    // Set up auto-sync every 30 seconds
    const interval = setInterval(async () => {
      if (!isSyncing && navigator.onLine) {
        setIsSyncing(true);
        try {
          await pushOfflineScans(session.access_token);
        } catch (error) {
          console.error("Auto sync failed", error);
        } finally {
          setIsSyncing(false);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [session, isSyncing]);

  return { forceSync, isSyncing };
}
