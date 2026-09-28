import React from "react";
import { Move, Maximize2, ArrowLeftRight } from "lucide-react";
import type { EditorObject } from "../lib/pdf/document";
import { liveLayout, liveFontFamily } from "../lib/pdf/live-layout";
type Labels = {
  image: string;
  text: string;
  edit: string;
  move: string;
  resize: string;
  resizeText: string;
  placeholder: string;
  editHint: string;
};
export function PDFObjectLayer({
  object: o,
  zoom,
  interactive,
  selected,
  live,
  editing,
  height,
  labels: t,
  editorRef,
  onSelect,
  onEdit,
  onDrag,
  onText,
  onTypingEnd,
}: {
  object: EditorObject;
  zoom: number;
  interactive: boolean;
  selected: boolean;
  live: boolean;
  editing: boolean;
  height?: number;
  labels: Labels;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  onSelect: () => void;
  onEdit: () => void;
  onDrag: (e: React.PointerEvent, resize?: boolean) => void;
  onText: (text: string) => void;
  onTypingEnd: () => void;
}) {
  const layout = o.kind === "text" && live ? liveLayout(o) : undefined;
  const h = live && layout ? layout.height : height || o.height;
  const family = o.kind === "text" ? liveFontFamily(o) : undefined;
  return (
    <div
      aria-hidden={!interactive}
      data-pdf-object={o.id}
      data-live={live ? "true" : "false"}
      style={{
        position: "absolute",
        pointerEvents: interactive ? "auto" : "none",
        left: o.x * zoom,
        top: o.y * zoom,
        width: o.width * zoom,
        height: Math.max(12, h * zoom),
        transform: `rotate(${o.rotation}deg)`,
        transformOrigin: "top left",
        zIndex: selected ? 2 : 1,
      }}
    >
      {live &&
        (o.kind === "image" ? (
          <img
            src={o.data}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        ) : (
          !editing && (
            <svg
              className="absolute inset-0 pointer-events-none overflow-visible"
              width={o.width * zoom}
              height={h * zoom}
              viewBox={`0 0 ${o.width} ${h}`}
            >
              <g
                fill={o.color}
                fontFamily={family}
                fontSize={o.size}
                fontWeight={
                  o.font.startsWith("embedded-") ||
                  o.font.startsWith("download-") ||
                  o.font.startsWith("uploaded-")
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
                {layout!.lines.map((line, i) => (
                  <text
                    key={i}
                    x={0}
                    y={layout!.ascent + i * o.size * 1.2}
                    textLength={layout!.widths[i] || undefined}
                    lengthAdjust="spacingAndGlyphs"
                  >
                    {line}
                  </text>
                ))}
              </g>
            </svg>
          )
        ))}
      {editing && live && o.kind === "text" ? (
        <textarea
          ref={editorRef}
          data-testid="pdf-inline-editor"
          data-pdf-inline="true"
          aria-label={t.edit}
          placeholder={t.placeholder}
          value={o.text}
          spellCheck={false}
          onChange={(e) => onText(e.target.value)}
          onBlur={onTypingEnd}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute inset-0 w-full h-full resize-none outline-none bg-transparent border-0 rounded-sm"
          style={{
            padding: 0,
            margin: 0,
            fontFamily: family,
            fontSize: o.size * zoom,
            lineHeight: 1.2,
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
            color: o.color,
            overflow: "hidden",
            overflowWrap: "anywhere",
            boxShadow: "0 0 0 2px var(--primary-color)",
          }}
        />
      ) : (
        <button
          type="button"
          aria-label={o.kind === "text" ? o.text || t.text : t.image}
          title={o.kind === "text" ? t.editHint : t.move}
          onClick={(e) => {
            e.stopPropagation();
            o.kind === "text" ? onEdit() : onSelect();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          onPointerDown={o.kind === "image" ? (e) => onDrag(e) : undefined}
          className={
            "absolute inset-0 w-full h-full bg-transparent rounded-sm " +
            (o.kind === "text" ? "cursor-text " : "cursor-move touch-none ") +
            (selected
              ? "outline outline-2 outline-primary"
              : "hover:outline hover:outline-1 hover:outline-primary/50 hover:bg-primary/10")
          }
        />
      )}
      {selected && (
        <>
          {(o.kind === "text"
            ? ["left", "top", "bottom"]
            : ["left", "right", "top", "bottom"]
          ).map((side) => (
            <span
              key={side}
              aria-hidden="true"
              onPointerDown={(e) => onDrag(e)}
              onClick={(e) => e.stopPropagation()}
              className="absolute cursor-move touch-none"
              style={{
                ...(side === "left" || side === "right"
                  ? { [side]: -4, top: 0, bottom: 0, width: 8 }
                  : { [side]: -4, left: 0, right: 0, height: 8 }),
              }}
            />
          ))}
          <button
            title={t.move}
            aria-label={t.move}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => onDrag(e)}
            className="absolute -left-7 -top-7 w-7 h-7 bg-primary text-white rounded-md flex items-center justify-center cursor-move touch-none"
          >
            <Move size={15} />
          </button>
          {o.kind === "text" && (
            <button
              type="button"
              title={t.resizeText}
              aria-label={t.resizeText}
              data-testid="pdf-width-handle"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => onDrag(e, true)}
              className="absolute -right-2 top-0 h-full w-4 cursor-ew-resize touch-none flex items-center justify-center"
            >
              <span className="w-2 h-3 rounded-sm bg-white border-2 border-primary pointer-events-none" />
            </button>
          )}
          <button
            title={o.kind === "text" ? t.resizeText : t.resize}
            aria-label={t.resize}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => onDrag(e, true)}
            className={
              "absolute -right-3 -bottom-3 w-6 h-6 bg-primary text-white rounded-md flex items-center justify-center touch-none " +
              (o.kind === "text" ? "cursor-ew-resize" : "cursor-nwse-resize")
            }
          >
            {o.kind === "text" ? (
              <ArrowLeftRight size={13} />
            ) : (
              <Maximize2 size={13} />
            )}
          </button>
        </>
      )}
    </div>
  );
}
