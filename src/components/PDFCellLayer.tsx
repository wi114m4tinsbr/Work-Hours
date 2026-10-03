import React, { useEffect, useRef, useState } from "react";
import type { TextObject } from "../lib/pdf/document";
import { cellCharacters } from "../lib/pdf/cells";
import { liveCell, liveFontFamily } from "../lib/pdf/live-layout";
export function PDFCellLayer({
  object: o,
  zoom,
  live,
  editing,
  interactive,
  label,
  cellLabel,
  onEdit,
  onText,
  onTypingEnd,
}: {
  object: TextObject;
  zoom: number;
  live: boolean;
  editing: boolean;
  interactive: boolean;
  label: string;
  cellLabel: string;
  onEdit: () => void;
  onText: (text: string) => void;
  onTypingEnd: () => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]),
    [focusIndex, setFocusIndex] = useState(0);
  const cells = o.cells!,
    chars = [...o.text];
  useEffect(() => {
    if (editing && live) inputs.current[focusIndex]?.focus();
  }, [editing, live, focusIndex]);
  const write = (start: number, text: string) => {
    const next = Array.from(
      { length: cells.length },
      (_, i) => chars[i] || " ",
    );
    const value = [...cellCharacters(text, cells.length - start)];
    value.forEach((ch, i) => (next[start + i] = ch));
    if (!value.length) next[start] = " ";
    onText(next.join("").trimEnd());
    setFocusIndex(Math.min(cells.length - 1, start + value.length));
  };
  return (
    <div
      role="group"
      aria-label={label}
      data-testid="pdf-cell-field"
      style={{
        position: "absolute",
        left: o.x * zoom,
        top: o.y * zoom,
        width: o.width * zoom,
        height: o.height * zoom,
        zIndex: 3,
        pointerEvents: interactive ? "auto" : "none",
      }}
    >
      {cells.map((cell, i) => {
        const metrics = liveCell(o, i),
          style: React.CSSProperties = {
            position: "absolute",
            left: cell.x * zoom,
            top: cell.y * zoom,
            width: cell.width * zoom,
            height: cell.height * zoom,
          };
        return editing && live ? (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            aria-label={`${cellLabel} ${i + 1}/${cells.length}`}
            value={chars[i] || ""}
            autoComplete="off"
            spellCheck={false}
            style={{
              ...style,
              padding: 0,
              margin: 0,
              background: "transparent",
              border: 0,
              borderRadius: 2,
              color: o.color,
              fontFamily: liveFontFamily(o),
              fontSize: metrics.size * zoom,
              textAlign: "center",
              fontWeight: /^(embedded|download|uploaded)-/.test(o.font)
                ? 400
                : o.bold
                  ? 700
                  : 400,
              fontStyle: /^(embedded|download|uploaded)-/.test(o.font)
                ? "normal"
                : o.italic
                  ? "italic"
                  : "normal",
              outline: "1px solid var(--primary-color)",
            }}
            onFocus={(e) => {
              setFocusIndex(i);
              e.target.select();
            }}
            onBlur={onTypingEnd}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => write(i, e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              write(i, e.clipboardData.getData("text"));
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                e.stopPropagation();
                setFocusIndex(
                  Math.max(
                    0,
                    Math.min(
                      cells.length - 1,
                      i + (e.key === "ArrowLeft" ? -1 : 1),
                    ),
                  ),
                );
              }
              if (e.key === "Backspace" && !chars[i]?.trim() && i > 0) {
                e.preventDefault();
                write(i - 1, "");
                setFocusIndex(i - 1);
              }
            }}
          />
        ) : (
          <button
            key={i}
            type="button"
            aria-label={`${cellLabel} ${i + 1}/${cells.length}`}
            style={style}
            className="rounded-sm hover:outline hover:outline-1 hover:outline-primary focus-visible:outline-primary cursor-text"
            onClick={(e) => {
              e.stopPropagation();
              setFocusIndex(i);
              onEdit();
            }}
          >
            {live && chars[i] && (
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${cell.width} ${cell.height}`}
                className="pointer-events-none"
              >
                <text
                  x={cell.width / 2}
                  y={(cell.height + metrics.ascent) / 2}
                  textAnchor="middle"
                  fill={o.color}
                  fontSize={metrics.size}
                  fontFamily={liveFontFamily(o)}
                  fontWeight={
                    /^(embedded|download|uploaded)-/.test(o.font)
                      ? 400
                      : o.bold
                        ? 700
                        : 400
                  }
                  fontStyle={
                    /^(embedded|download|uploaded)-/.test(o.font)
                      ? "normal"
                      : o.italic
                        ? "italic"
                        : "normal"
                  }
                >
                  {chars[i]}
                </text>
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
