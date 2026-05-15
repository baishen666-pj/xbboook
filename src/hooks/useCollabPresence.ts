import { useEffect, useRef } from "react";
import { useCollabStore } from "@/stores/collabStore";
import { collabService, createCollabWs } from "@/services/collabService";
import { useProjectStore } from "@/stores/projectStore";

export function useCollabPresence() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const currentUser = useCollabStore((s) => s.currentUser);
  const setOnlineUsers = useCollabStore((s) => s.setOnlineUsers);
  const setLocks = useCollabStore((s) => s.setLocks);
  const addLock = useCollabStore((s) => s.addLock);
  const removeLock = useCollabStore((s) => s.removeLock);
  const setWs = useCollabStore((s) => s.setWs);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!currentProject || !currentUser) return;

    const ws = createCollabWs();
    if (!ws) return;
    wsRef.current = ws;
    setWs(ws);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", payload: { userId: currentUser.id, projectId: currentProject.id } }));

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
          const userIds = (msg.payload.online as { userId: string }[]) ?? [];
          void (async () => {
            const enriched = await Promise.all(
              userIds.map(async (u) => {
                const res = await collabService.getMe(u.userId);
                return res.data ?? { userId: u.userId, displayName: "未知", avatarColor: "#6366f1" };
              })
            );
            setOnlineUsers(enriched.filter((u): u is { userId: string; displayName: string; avatarColor: string } => "userId" in u));
          })();
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
      wsRef.current = null;
      setWs(null);
    };

    // Load initial locks
    collabService.getLocks(currentProject.id).then((res) => {
      if (res.success && res.data) setLocks(res.data);
    });

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [currentProject, currentUser, setOnlineUsers, setLocks, addLock, removeLock, setWs]);
}
