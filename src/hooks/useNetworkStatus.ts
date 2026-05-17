import { useEffect } from "react";
import { useOfflineStore } from "@/stores/offlineStore";
import { offlineQueue } from "@/services/offlineQueue";

export function useNetworkStatus() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const pendingCount = useOfflineStore((s) => s.pendingCount);
  const isReplaying = useOfflineStore((s) => s.isReplaying);

  useEffect(() => {
    const { setOnline, setPendingCount } = useOfflineStore.getState();

    async function handleOnline() {
      setOnline(true);
      const count = await offlineQueue.getPendingCount();
      setPendingCount(count);
      if (count > 0) {
        void offlineQueue.replayAll();
      }
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, pendingCount, isReplaying };
}
