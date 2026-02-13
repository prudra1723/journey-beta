// src/features/chat/components/ChatFab.tsx
import { useEffect, useRef, useState } from "react";

const FAB_KEY = "journey_beta_chat_fab_pos_v1";

export function ChatFab({
  unreadCount,
  open,
  onToggle,
}: {
  unreadCount: number;
  open: boolean;
  onToggle: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragging: boolean;
  } | null>(null);
  const draggedClickRef = useRef(false);

  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 20, y: 20 };
    const raw = localStorage.getItem(FAB_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw) as { x: number; y: number };
        if (Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
      } catch {
        // ignore
      }
    }
    return {
      x: Math.max(12, window.innerWidth - 140),
      y: Math.max(12, window.innerHeight - 160),
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(FAB_KEY, JSON.stringify(pos));
  }, [pos]);

  function clampPos(x: number, y: number) {
    const rect = btnRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 120;
    const h = rect?.height ?? 48;
    const maxX = window.innerWidth - w - 8;
    const maxY = window.innerHeight - h - 8;
    return {
      x: Math.max(8, Math.min(maxX, x)),
      y: Math.max(8, Math.min(maxY, y)),
    };
  }

  useEffect(() => {
    const onResize = () => {
      setPos((p) => clampPos(p.x, p.y));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 9998,
        touchAction: "none",
      }}
    >
      <button
        ref={btnRef}
        type="button"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          draggedClickRef.current = false;
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originX: pos.x,
            originY: pos.y,
            dragging: false,
          };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          if (Math.abs(dx) + Math.abs(dy) > 4) {
            dragRef.current.dragging = true;
            draggedClickRef.current = true;
          }
          if (!dragRef.current.dragging) return;
          const next = clampPos(
            dragRef.current.originX + dx,
            dragRef.current.originY + dy,
          );
          setPos(next);
        }}
        onPointerUp={(e) => {
          if (!dragRef.current) return;
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
          dragRef.current = null;
        }}
        onClick={() => {
          if (draggedClickRef.current) {
            draggedClickRef.current = false;
            return;
          }
          onToggle();
        }}
        className="rounded-2xl shadow-soft border border-gray-200 bg-blue-600 text-white px-4 py-3 font-extrabold flex items-center gap-2 hover:opacity-95"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        💬 Chat
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-yellow-300 text-gray-900 text-xs font-extrabold px-2">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
