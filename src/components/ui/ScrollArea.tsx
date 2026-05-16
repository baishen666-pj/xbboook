import { type ReactNode } from "react";

interface ScrollAreaProps {
  children: ReactNode;
  className?: string;
}

export function ScrollArea({ children, className = "" }: ScrollAreaProps) {
  return (
    <div
      className={[
        "overflow-y-auto overflow-x-hidden smooth-scroll",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
