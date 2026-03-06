import { useState, useCallback, useRef } from "react";

/**
 * Hook for making a panel horizontally resizable via drag.
 * @param defaultWidth - initial width in px
 * @param side - which side of the screen the panel is on ("left" = handle on right edge, "right" = handle on left edge)
 * @param min - minimum width
 * @param max - maximum width
 */
export function useResizablePanel(
  defaultWidth: number,
  side: "left" | "right",
  min = 240,
  max = 600
) {
  const [width, setWidth] = useState(defaultWidth);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = e.clientX - startX;
        // Left-side panels grow when dragged right; right-side panels grow when dragged left
        const newWidth = side === "left" ? startWidth + delta : startWidth - delta;
        setWidth(Math.min(Math.max(newWidth, min), max));
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, side, min, max]
  );

  return { width, handleMouseDown };
}
