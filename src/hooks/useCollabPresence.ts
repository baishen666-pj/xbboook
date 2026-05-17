import { useEffect, useRef } from "react";
import { useCollabStore, getStoredToken } from "@/stores/collabStore";
import { collabService, createCollabWs } from "@/services/collabService";
import type { OnlineUser } from "@/types/project";
import { useProjectStore } from "@/stores/projectStore";

export function useCollabPresence() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentUser = useCollabStore((s) => s.currentUser);
  const setOnlineUsers = useCollabStore((s) => s.setOnlineUsers);
  const setLocks = useCollabStore((s) => s.setLocks);
  const addLock = useCollabStore((s) => s.addLock);
  const removeLock = useCollabStore((s) => s.removeLock);
  const setWs = useCollabStore((s) => s.setWs);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const manualCloseRef = useRef(false);

  useEffect(() => {
    if (!currentProject || !currentUser) return;

    const token = getStoredToken();
    if (!token) return;

    manualCloseRef.current = false;

    function connect() {
      const ws = createCollabWs();
      if (!ws) return;
      setWs(ws);

      ws.onopen = () => {
        attemptsRef.current = 0;
        ws.send(JSON.stringify({ type: "join", payload: { token, projectId: currentProject!.id } }));

        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping", payload: {} }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; payload: Record<string, unknown> };

          if (msg.type === "presence:update") {
            const online = (msg.payload.online ?? []) as OnlineUser[];
            setOnlineUsers(online);
          }

          if (msg.type === "lock:acquired") {
            addLock({
              chapterId: msg.payload.chapterId as string,
              userId: msg.payload.userId as string,
              displayName: "",
              lockedAt: new Date().toISOString(),
            });
          }

          if (msg.type === "lock:released") {
            removeLock(msg.payload.chapterId as string);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        setWs(null);
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (manualCloseRef.current) return;
      const base = Math.min(1000 * Math.pow(2, attemptsRef.current), 30000);
      const jitter = base * (0.5 + Math.random() * 0.5);
      reconnectRef.current = setTimeout(() => {
        attemptsRef.current++;
        connect();
      }, jitter);
    }

    connect();

    collabService.getLocks(currentProject.id).then((res) => {
      if (res.success && res.data) setLocks(res.data);
    });

    return () => {
      manualCloseRef.current = true;
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      const { ws } = useCollabStore.getState();
      if (ws) ws.close();
    };
  }, [currentProject, currentUser, setOnlineUsers, setLocks, addLock, removeLock, setWs]);
}
