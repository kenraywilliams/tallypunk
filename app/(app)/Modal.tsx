"use client";

import { useRef, useState } from "react";

export default function Modal({
  title,
  onClose,
  children,
  sm,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  sm?: boolean;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const start = useRef<{ mx: number; my: number; bx: number; by: number } | null>(
    null,
  );

  // drag the dialog by its title bar
  const onDown = (e: React.MouseEvent) => {
    start.current = { mx: e.clientX, my: e.clientY, bx: pos.x, by: pos.y };
    const move = (ev: MouseEvent) => {
      if (!start.current) return;
      setPos({
        x: start.current.bx + (ev.clientX - start.current.mx),
        y: start.current.by + (ev.clientY - start.current.my),
      });
    };
    const up = () => {
      start.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="modal-overlay">
      <div
        className={"modal" + (sm ? " modal-sm" : "")}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
      >
        <div className="modal-bar" onMouseDown={onDown}>
          <h3 className="modal-title">{title}</h3>
          <button
            type="button"
            className="modal-x"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
