import { useCollabStore } from "@/stores/collabStore";

interface Props {
  chapterId: string;
}

export function LockIndicator({ chapterId }: Props) {
  const locks = useCollabStore((s) => s.locks);
  const lock = locks.find((l) => l.chapterId === chapterId);

  if (!lock) return null;

  return (
    <span className="text-[10px] text-amber-400/60" title={`被 ${lock.displayName} 锁定`}>
      🔒
    </span>
  );
}
