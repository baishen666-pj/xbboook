import { useCollabStore } from "@/stores/collabStore";

export function PresenceIndicator() {
  const onlineUsers = useCollabStore((s) => s.onlineUsers);

  if (onlineUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {onlineUsers.slice(0, 5).map((u) => (
        <div
          key={u.userId}
          className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white border border-white/10"
          style={{ backgroundColor: u.avatarColor }}
          title={u.displayName}
        >
          {u.displayName.charAt(0)}
        </div>
      ))}
      {onlineUsers.length > 5 && (
        <span className="text-[10px] text-white/30">+{onlineUsers.length - 5}</span>
      )}
    </div>
  );
}
