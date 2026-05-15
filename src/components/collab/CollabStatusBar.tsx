import { useCollabStore } from "@/stores/collabStore";
import { PresenceIndicator } from "./PresenceIndicator";

export function CollabStatusBar() {
  const currentUser = useCollabStore((s) => s.currentUser);
  const onlineUsers = useCollabStore((s) => s.onlineUsers);

  return (
    <div className="flex items-center gap-2">
      {currentUser && (
        <>
          <div
            className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
            style={{ backgroundColor: currentUser.avatarColor }}
          >
            {currentUser.displayName.charAt(0)}
          </div>
          <span className="text-[10px] text-white/40">{currentUser.displayName}</span>
        </>
      )}
      {onlineUsers.length > 0 && (
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-[10px] text-white/30">{onlineUsers.length} 在线</span>
          <PresenceIndicator />
        </div>
      )}
    </div>
  );
}
