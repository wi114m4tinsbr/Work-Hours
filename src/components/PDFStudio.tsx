import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Trash2,
  Type,
  MousePointer2,
  Undo2,
  Redo2,
  Image as ImageIcon,
  PanelLeft,
  PenLine,
  Move,
  Maximize2,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { extractSources, type Matrix } from "../lib/pdf/content";
import {
  createExporter,
  groupSources,
  type EditorObject,
  type EditorState,
  type FieldValue,
  type Geometry,
  type TextObject,
} from "../lib/pdf/document";
import { getPdfium } from "../lib/pdf/runtime";

// Compatibility for PDF.js in browsers without the Map upsert APIs.
const map = Map.prototype as Map<unknown, unknown> & {
  getOrInsert?: Function;
  getOrInsertComputed?: Function;
};
if (!map.getOrInsert)
  map.getOrInsert = function (k: unknown, v: unknown) {
    if (!this.has(k)) this.set(k, v);
    return this.get(k);
  };
if (!map.getOrInsertComputed)
  map.getOrInsertComputed = function (k: unknown, f: (k: unknown) => unknown) {
    if (!this.has(k)) this.set(k, f(k));
    return this.get(k);
  };
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
type Lang = "pt" | "en" | "es";
const C = {
  pt: {
    open: "Abrir PDF",
    drop: "Solte um PDF aqui ou clique para abrir",
    select: "Selecionar",
    text: "Texto",
    image: "Imagem",
    signature: "Assinatura",
    rotate: "Girar objeto",
    download: "Baixar",
    page: "Página",
    empty: "Edite o conteúdo do documento diretamente aqui.",
    size: "Tamanho",
    font: "Fonte",
    color: "Cor",
    bold: "Negrito",
    italic: "Itálico",
    edit: "Editar texto",
    move: "Mover",
    resize: "Redimensionar",
    width: "Largura",
    angle: "Rotação",
    undo: "Desfazer",
    redo: "Refazer",
    remove: "Excluir",
    back: "Voltar",
    busy: "Atualizando PDF…",
    ready: "Alterações prontas para baixar",
    loading: "Abrindo PDF…",
    error: "Não foi possível concluir. Tente desfazer a última alteração.",
    unsafe:
      "Este trecho se sobrepõe a outro texto ou não pode ser removido com segurança. Desfaça a alteração e selecione outro trecho.",
    unsupported:
      "A fonte escolhida não contém um dos caracteres. Use caracteres latinos ou desfaça a alteração.",
    limits:
      "Selecione um texto e edite abaixo. Ao alterar, a fonte será substituída pela escolhida. Imagens, letras convertidas em desenho e alguns PDFs complexos não permitem edição de texto.",
    noText:
      "Nenhum texto editável reconhecido nesta página. Você pode adicionar texto ou imagem.",
    form: "Campo de formulário",
    noForms: "Este PDF não contém campos de formulário AcroForm.",
    forms: "Campos de formulário reconhecidos",
    cancel: "Cancelar",
    clear: "Limpar",
    insert: "Inserir",
    signHint:
      "Desenhe sua assinatura. Será inserida como imagem, sem certificado digital.",
    tooLarge: "Use um PDF de até 25 MB e 100 páginas.",
    imageError: "Use uma imagem PNG ou JPEG de até 10 MB.",
    selectHint: "Clique num texto existente para selecionar.",
    zoomIn: "Aumentar zoom",
    zoomOut: "Diminuir zoom",
    fieldLocked: "Campo somente leitura ou de tipo não suportado",
    restore: "Restaurar original",
  },
  en: {
    open: "Open PDF",
    drop: "Drop a PDF here or click to open",
    select: "Select",
    text: "Text",
    image: "Image",
    signature: "Signature",
    rotate: "Rotate object",
    download: "Download",
    page: "Page",
    empty: "Edit the document content directly here.",
    size: "Size",
    font: "Font",
    color: "Color",
    bold: "Bold",
    italic: "Italic",
    edit: "Edit text",
    move: "Move",
    resize: "Resize",
    width: "Width",
    angle: "Rotation",
    undo: "Undo",
    redo: "Redo",
    remove: "Delete",
    back: "Back",
    busy: "Updating PDF…",
    ready: "Changes ready to download",
    loading: "Opening PDF…",
    error: "Could not complete. Try undoing the last change.",
    unsafe:
      "This text overlaps other text or cannot be safely removed. Undo the change and select another text block.",
    unsupported:
      "The selected font does not support one of the characters. Use Latin characters or undo the change.",
    limits:
      "Select text and edit below. Changing text replaces its font with the selected font. Images, outlined letters and some complex PDFs do not support text editing.",
    noText:
      "No editable text recognized on this page. You can add text or an image.",
    form: "Form field",
    noForms: "This PDF has no AcroForm fields.",
    forms: "Form fields recognized",
    cancel: "Cancel",
    clear: "Clear",
    insert: "Insert",
    signHint:
      "Draw your signature. It will be inserted as an image without a digital certificate.",
    tooLarge: "Use a PDF up to 25 MB and 100 pages.",
    imageError: "Use a PNG or JPEG image up to 10 MB.",
    selectHint: "Click existing text to select it.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fieldLocked: "Read-only or unsupported field",
    restore: "Restore original",
  },
  es: {
    open: "Abrir PDF",
    drop: "Suelta un PDF aquí o haz clic para abrir",
    select: "Seleccionar",
    text: "Texto",
    image: "Imagen",
    signature: "Firma",
    rotate: "Girar objeto",
    download: "Descargar",
    page: "Página",
    empty: "Edita el contenido del documento directamente aquí.",
    size: "Tamaño",
    font: "Fuente",
    color: "Color",
    bold: "Negrita",
    italic: "Cursiva",
    edit: "Editar texto",
    move: "Mover",
    resize: "Redimensionar",
    width: "Ancho",
    angle: "Rotación",
    undo: "Deshacer",
    redo: "Rehacer",
    remove: "Eliminar",
    back: "Volver",
    busy: "Actualizando PDF…",
    ready: "Cambios listos para descargar",
    loading: "Abriendo PDF…",
    error: "No se pudo completar. Intenta deshacer el último cambio.",
    unsafe:
      "Este texto se superpone a otro o no se puede eliminar con seguridad. Deshaz el cambio y selecciona otro fragmento.",
    unsupported:
      "La fuente elegida no admite uno de los caracteres. Usa caracteres latinos o deshaz el cambio.",
    limits:
      "Selecciona un texto y edita abajo. Al modificarlo, se sustituye su fuente por la elegida. Las imágenes, letras convertidas en dibujos y algunos PDF complejos no permiten editar texto.",
    noText:
      "No se reconoce texto editable en esta página. Puedes añadir texto o una imagen.",
    form: "Campo de formulario",
    noForms: "Este PDF no contiene campos AcroForm.",
    forms: "Campos de formulario reconocidos",
    cancel: "Cancelar",
    clear: "Limpiar",
    insert: "Insertar",
    signHint:
      "Dibuja tu firma. Se insertará como imagen, sin certificado digital.",
    tooLarge: "Usa un PDF de hasta 25 MB y 100 páginas.",
    imageError: "Usa una imagen PNG o JPEG de hasta 10 MB.",
    selectHint: "Haz clic en un texto existente para seleccionarlo.",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
    fieldLocked: "Campo de solo lectura o no compatible",
    restore: "Restaurar original",
  },
};
type FormWidget = {
  id: string;
  name: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "text" | "checkbox" | "radio" | "choice" | "unsupported";
  value: FieldValue;
  options: { value: string; label: string }[];
  exportValue: string;
  readOnly: boolean;
  multiline: boolean;
  multiple: boolean;
  maxLength?: number;
};
const openPdf = (bytes: Uint8Array) =>
  pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    isEvalSupported: false,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
const initial: EditorState = { objects: [], fields: {} };
const control =
  "rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark px-2 py-1 text-sm text-stone-700 dark:text-white";

export function PDFStudio({
  language,
  onBack,
}: {
  language: Lang;
  onBack: () => void;
}) {
  const t = C[language] || C.pt;
  const [file, setFile] = useState<File | null>(null),
    [geometry, setGeometry] = useState<Geometry[]>([]),
    [widgets, setWidgets] = useState<FormWidget[]>([]);
  const [state, setState] = useState<EditorState>(initial),
    stateRef = useRef(state);
  const [selected, setSelected] = useState<string | null>(null),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1.35),
    [tool, setTool] = useState<"select" | "text">("select");
  const [renderedPage, setRenderedPage] = useState(0);
  const [layoutHeights, setLayoutHeights] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [signature, setSignature] = useState(false),
    [signed, setSigned] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0),
    undo = useRef<EditorState[]>([]),
    redo = useRef<EditorState[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    imageInput = useRef<HTMLInputElement>(null),
    signatureCanvas = useRef<HTMLCanvasElement>(null),
    editor = useRef<HTMLTextAreaElement>(null);
  const exporter = useRef<ReturnType<typeof createExporter> | null>(null),
    original = useRef<EditorState>(initial),
    version = useRef(0),
    loadVersion = useRef(0),
    renderTask = useRef<RenderTask | null>(null),
    downloadBytes = useRef<Uint8Array | null>(null);
  const current = state.objects.find((o) => o.id === selected && !o.deleted),
    box = geometry[page - 1];
  const message = (e: unknown) => {
    const s = e instanceof Error ? e.message : String(e);
    return s.includes("UNSAFE_TEXT_OVERLAP")
      ? t.unsafe
      : /encode|WinAnsi/.test(s)
        ? t.unsupported
        : s === "LIMIT"
          ? t.tooLarge
          : t.error;
  };
  const update = (next: EditorState, checkpoint = true) => {
    if (checkpoint) {
      undo.current = [...undo.current.slice(-39), stateRef.current];
      redo.current = [];
      setHistoryVersion((v) => v + 1);
    }
    stateRef.current = next;
    version.current++;
    setBusy(true);
    setState(next);
  };
  const patch = (
    id: string,
    change: Partial<EditorObject>,
    checkpoint = true,
  ) =>
    update(
      {
        ...stateRef.current,
        objects: stateRef.current.objects.map((o) =>
          o.id === id
            ? ({ ...o, ...change, changed: true } as EditorObject)
            : o,
        ),
      },
      checkpoint,
    );
  const travel = (
    from: React.RefObject<EditorState[]>,
    to: React.RefObject<EditorState[]>,
  ) => {
    const next = from.current.pop();
    if (!next) return;
    to.current.push(stateRef.current);
    update(next, false);
    setHistoryVersion((v) => v + 1);
  };
  const select = (id: string) => {
    setSelected(id);
    setTool("select");
    requestAnimationFrame(() => editor.current?.focus());
  };
  const load = async (f: File) => {
    const token = ++loadVersion.current;
    version.current++;
    setLoading(true);
    setError("");
    let doc: PDFDocumentProxy | undefined;
    try {
      if (f.size > 25 * 1024 * 1024) throw new Error("LIMIT");
      const bytes = new Uint8Array(await f.arrayBuffer());
      doc = await openPdf(bytes);
      if (doc.numPages > 100) throw new Error("LIMIT");
      const engine = await getPdfium(),
        sources = extractSources(engine, bytes),
        geo: Geometry[] = [],
        fields: FormWidget[] = [];
      for (let pn = 1; pn <= doc.numPages; pn++) {
        const pg = await doc.getPage(pn),
          vp = pg.getViewport({ scale: 1 });
        geo.push({
          width: vp.width,
          height: vp.height,
          matrix: vp.transform as Matrix,
        });
        for (const a of await pg.getAnnotations())
          if (a.subtype === "Widget" && a.fieldName) {
            const r = vp.convertToViewportRectangle(a.rect),
              type =
                a.fieldType === "Tx"
                  ? "text"
                  : a.checkBox
                    ? "checkbox"
                    : a.radioButton
                      ? "radio"
                      : a.fieldType === "Ch"
                        ? "choice"
                        : "unsupported";
            fields.push({
              id: a.id,
              name: a.fieldName,
              page: pn,
              x: Math.min(r[0], r[2]),
              y: Math.min(r[1], r[3]),
              width: Math.abs(r[2] - r[0]),
              height: Math.abs(r[3] - r[1]),
              type,
              value: a.checkBox
                ? !!a.fieldValue && a.fieldValue !== "Off"
                : (a.fieldValue ?? ""),
              options: (a.options || []).map((o: any) => ({
                value: o.exportValue,
                label: o.displayValue,
              })),
              exportValue: a.buttonValue || a.exportValue || "",
              readOnly: a.readOnly || false,
              multiline: a.multiLine || false,
              multiple: a.multiSelect || false,
              maxLength: a.maxLen || undefined,
            });
          }
      }
      if (token !== loadVersion.current) return;
      const next = { objects: groupSources(sources, geo), fields: {} };
      original.current = next;
      exporter.current = createExporter(engine, bytes, sources, geo);
      undo.current = [];
      redo.current = [];
      setHistoryVersion((v) => v + 1);
      setRenderedPage(0);
      setFile(f);
      setGeometry(geo);
      setWidgets(fields);
      setPage(1);
      setSelected(null);
      setTool("select");
      setZoom(
        Math.min(
          1.35,
          Math.max(
            0.5,
            ((stage.current?.parentElement?.clientWidth || window.innerWidth) -
              64) /
              geo[0].width,
          ),
        ),
      );
      update(next, false);
    } catch (e) {
      if (token === loadVersion.current) setError(message(e));
    } finally {
      await doc?.destroy();
      if (token === loadVersion.current) setLoading(false);
    }
  };
  // Render the exact generated file used for download. A detached canvas prevents
  // cancelled/older work from overwriting a newer document or page.
  useEffect(() => {
    if (!file || !exporter.current) return;
    let cancelled = false,
      doc: PDFDocumentProxy | undefined,
      task: RenderTask | undefined;
    const token = version.current,
      build = exporter.current;
    setBusy(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        let heights: Record<string, number> = {};
        const bytes = await build(state, (h) => {
          heights = h;
        });
        if (cancelled) return;
        doc = await openPdf(bytes);
        if (cancelled) return;
        const pg = await doc.getPage(page),
          vp = pg.getViewport({ scale: zoom }),
          off = document.createElement("canvas"),
          ratio = Math.min(window.devicePixelRatio || 1, 2);
        off.width = Math.ceil(vp.width * ratio);
        off.height = Math.ceil(vp.height * ratio);
        task = pg.render({
          canvas: off,
          canvasContext: off.getContext("2d")!,
          viewport: vp,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        renderTask.current = task;
        await task.promise;
        if (cancelled || token !== version.current || !canvas.current) return;
        const c = canvas.current;
        c.width = off.width;
        c.height = off.height;
        c.style.width = `${vp.width}px`;
        c.style.height = `${vp.height}px`;
        c.getContext("2d")!.drawImage(off, 0, 0);
        downloadBytes.current = bytes;
        setLayoutHeights(heights);
        setRenderedPage(page);
        setBusy(false);
      } catch (e: any) {
        if (!cancelled && e?.name !== "RenderingCancelledException") {
          setError(message(e));
          setBusy(false);
          downloadBytes.current = null;
        }
      } finally {
        await doc?.destroy();
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [state, page, zoom, file, language]);
  useEffect(
    () => () => {
      loadVersion.current++;
      version.current++;
      renderTask.current?.cancel();
    },
    [],
  );
  const remove = () => {
    if (current) {
      patch(current.id, { deleted: true });
      setSelected(null);
    }
  };
  const restore = () => {
    if (!current) return;
    const o = original.current.objects.find((o) => o.id === current.id);
    if (o)
      update({
        ...stateRef.current,
        objects: stateRef.current.objects.map((n) => (n.id === o.id ? o : n)),
      });
  };
  const drag = (e: React.PointerEvent, id: string, resize = false) => {
    e.preventDefault();
    e.stopPropagation();
    const o = stateRef.current.objects.find((o) => o.id === id);
    if (!o) return;
    setSelected(id);
    const x = e.clientX,
      y = e.clientY,
      target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved) {
        undo.current = [...undo.current.slice(-39), stateRef.current];
        redo.current = [];
        setHistoryVersion((v) => v + 1);
        moved = true;
      }
      const dx = (ev.clientX - x) / zoom,
        dy = (ev.clientY - y) / zoom,
        a = (o.rotation * Math.PI) / 180,
        local = dx * Math.cos(a) + dy * Math.sin(a),
        scale = Math.max(0.2, Math.min(5, (o.width + local) / o.width));
      patch(
        id,
        resize
          ? {
              width: Math.max(5, o.width * scale),
              height: o.height * scale,
              ...(o.kind === "text"
                ? { size: Math.max(4, Math.min(144, o.size * scale)) }
                : {}),
            }
          : {
              x: Math.max(0, Math.min(box.width - 5, o.x + dx)),
              y: Math.max(0, Math.min(box.height - 5, o.y + dy)),
            },
        false,
      );
    };
    const up = () => {
      target.removeEventListener("pointermove", move as EventListener);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move as EventListener);
    target.addEventListener("pointerup", up, { once: true });
    target.addEventListener("pointercancel", up, { once: true });
  };
  const addText = (e: React.MouseEvent) => {
    if (tool !== "text" || !stage.current || renderedPage !== page) return;
    const r = stage.current.getBoundingClientRect(),
      id = crypto.randomUUID(),
      o: TextObject = {
        id,
        kind: "text",
        page,
        x: (e.clientX - r.left) / zoom,
        y: (e.clientY - r.top) / zoom,
        width: 180,
        height: 20,
        rotation: 0,
        text: "",
        size: 12,
        font: "Helvetica",
        bold: false,
        italic: false,
        color: "#111111",
        sources: [],
        changed: true,
      };
    update({ ...stateRef.current, objects: [...stateRef.current.objects, o] });
    select(id);
  };
  const addImage = (data: string, width: number, height: number) => {
    const id = crypto.randomUUID(),
      w = Math.min(180, box.width / 2);
    update({
      ...stateRef.current,
      objects: [
        ...stateRef.current.objects,
        {
          id,
          kind: "image",
          page,
          x: 36,
          y: 36,
          width: w,
          height: (w * height) / width,
          rotation: 0,
          data,
          changed: true,
        },
      ],
    });
    setSelected(id);
    setTool("select");
  };
  const readImage = async (f: File) => {
    try {
      if (
        !["image/png", "image/jpeg"].includes(f.type) ||
        f.size > 10 * 1024 * 1024
      )
        throw Error();
      const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(f);
        }),
        img = new Image();
      img.src = data;
      await img.decode();
      addImage(data, img.width, img.height);
    } catch {
      setError(t.imageError);
    }
  };
  const drawSignature = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget,
      ctx = c.getContext("2d")!,
      r = c.getBoundingClientRect(),
      point = (ev: PointerEvent | React.PointerEvent) => [
        ((ev.clientX - r.left) * c.width) / r.width,
        ((ev.clientY - r.top) * c.height) / r.height,
      ];
    c.setPointerCapture(e.pointerId);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const [x, y] = point(e);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    setSigned(true);
    const move = (ev: PointerEvent) => {
      const [x, y] = point(ev);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const up = () => {
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointercancel", up);
    };
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up, { once: true });
    c.addEventListener("pointercancel", up, { once: true });
  };
  const save = () => {
    if (!downloadBytes.current || busy || error) return;
    const url = URL.createObjectURL(
        new Blob([downloadBytes.current as BlobPart], {
          type: "application/pdf",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download =
      (file?.name.replace(/\.pdf$/i, "") || "document") + "-editado.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const button = (
    label: string,
    Icon: React.ElementType,
    action: () => void,
    disabled = false,
    active = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      aria-pressed={active || undefined}
      onClick={action}
      className={
        "h-10 px-3 rounded-xl flex items-center gap-2 text-sm font-bold disabled:opacity-30 " +
        (active
          ? "bg-primary text-white"
          : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/10")
      }
    >
      <Icon size={17} />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
  return (
    <div className="min-h-[calc(100vh-72px)] flex flex-col bg-stone-100 dark:bg-stone-950">
      <div className="bg-white dark:bg-bg-card-dark border-b border-stone-200 dark:border-white/10 px-3 sm:px-5 py-3 flex flex-wrap items-center gap-1 sticky top-0 z-20">
        <button
          title={t.back}
          aria-label={t.back}
          onClick={onBack}
          className="mr-2 text-stone-400 hover:text-primary font-bold"
        >
          ←
        </button>
        <b className="mr-3 dark:text-white">PDF Studio</b>
        {button(t.open, Upload, () => input.current?.click(), loading)}
        {file && (
          <>
            {button(
              t.select,
              MousePointer2,
              () => setTool("select"),
              loading,
              tool === "select",
            )}
            {button(
              t.text,
              Type,
              () => setTool("text"),
              loading,
              tool === "text",
            )}
            {button(
              t.image,
              ImageIcon,
              () => imageInput.current?.click(),
              loading,
            )}
            {button(
              t.signature,
              PenLine,
              () => {
                setSignature(true);
                setSigned(false);
              },
              loading,
            )}
            {button(
              t.undo,
              Undo2,
              () => travel(undo, redo),
              !undo.current.length || loading,
            )}
            {button(
              t.redo,
              Redo2,
              () => travel(redo, undo),
              !redo.current.length || loading,
            )}
            <div className="ml-auto flex items-center gap-1">
              {button(
                t.zoomOut,
                ZoomOut,
                () => setZoom((z) => Math.max(0.35, z - 0.15)),
                loading,
              )}
              <span className="text-xs font-bold text-stone-500">
                {Math.round(zoom * 100)}%
              </span>
              {button(
                t.zoomIn,
                ZoomIn,
                () => setZoom((z) => Math.min(3, z + 0.15)),
                loading,
              )}
              <button
                aria-label={t.download}
                disabled={loading || busy || !!error}
                onClick={save}
                className="h-10 px-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center gap-2 disabled:opacity-40"
              >
                <Download size={17} />
                <span className="hidden sm:inline">{t.download}</span>
              </button>
            </div>
          </>
        )}
      </div>
      {file && (
        <div className="bg-white dark:bg-bg-card-dark border-b border-stone-200 dark:border-white/10 px-4 py-3 space-y-2">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {t.limits}
          </p>
          {current ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {current.kind === "text" && (
                  <>
                    <label className="text-xs text-stone-500">
                      {t.font}{" "}
                      <select
                        aria-label={t.font}
                        className={control}
                        value={current.font}
                        onChange={(e) =>
                          patch(current.id, { font: e.target.value })
                        }
                      >
                        <option>Helvetica</option>
                        <option>Times</option>
                        <option>Courier</option>
                      </select>
                    </label>
                    <label className="text-xs text-stone-500">
                      {t.size}{" "}
                      <input
                        aria-label={t.size}
                        className={control + " w-20"}
                        type="number"
                        min="4"
                        max="144"
                        step="0.5"
                        value={Math.round(current.size * 100) / 100}
                        onChange={(e) => {
                          const size = +e.target.value;
                          if (size >= 4 && size <= 144)
                            patch(current.id, {
                              size,
                              height: Math.max(current.height, size * 1.2),
                            });
                        }}
                      />
                    </label>
                    <button
                      title={t.bold}
                      aria-label={t.bold}
                      aria-pressed={current.bold}
                      onClick={() => patch(current.id, { bold: !current.bold })}
                      className={
                        control +
                        " font-black " +
                        (current.bold ? "ring-2 ring-primary" : "")
                      }
                    >
                      B
                    </button>
                    <button
                      title={t.italic}
                      aria-label={t.italic}
                      aria-pressed={current.italic}
                      onClick={() =>
                        patch(current.id, { italic: !current.italic })
                      }
                      className={
                        control +
                        " italic " +
                        (current.italic ? "ring-2 ring-primary" : "")
                      }
                    >
                      I
                    </button>
                    <input
                      aria-label={t.color}
                      title={t.color}
                      type="color"
                      value={current.color}
                      onChange={(e) =>
                        patch(current.id, { color: e.target.value })
                      }
                      className="w-9 h-8 bg-transparent"
                    />
                  </>
                )}
                <label className="text-xs text-stone-500">
                  {t.width}{" "}
                  <input
                    aria-label={t.width}
                    type="number"
                    min="5"
                    max="2000"
                    className={control + " w-20"}
                    value={Math.round(current.width)}
                    onChange={(e) => {
                      const width = +e.target.value;
                      if (width >= 5 && width <= 2000)
                        patch(current.id, {
                          width,
                          ...(current.kind === "image"
                            ? {
                                height:
                                  (current.height * width) / current.width,
                              }
                            : {}),
                        });
                    }}
                  />
                </label>
                <label className="text-xs text-stone-500">
                  {t.angle}{" "}
                  <input
                    aria-label={t.angle}
                    type="number"
                    min="-360"
                    max="360"
                    className={control + " w-20"}
                    value={Math.round(current.rotation)}
                    onChange={(e) => {
                      const rotation = +e.target.value;
                      if (
                        Number.isFinite(rotation) &&
                        Math.abs(rotation) <= 360
                      )
                        patch(current.id, { rotation });
                    }}
                  />
                </label>
                {button(t.rotate, RotateCw, () =>
                  patch(current.id, {
                    rotation: (current.rotation + 90) % 360,
                  }),
                )}
                {button(t.remove, Trash2, remove)}
                {current.kind === "text" && current.sources.length > 0 && (
                  <button className={control} onClick={restore}>
                    {t.restore}
                  </button>
                )}
              </div>
              {current.kind === "text" && (
                <textarea
                  ref={editor}
                  aria-label={t.edit}
                  value={current.text}
                  rows={2}
                  className={control + " w-full resize-y"}
                  onChange={(e) =>
                    patch(current.id, {
                      text: e.target.value,
                      height: Math.max(
                        current.height,
                        e.target.value.split("\n").length * current.size * 1.2,
                      ),
                    })
                  }
                />
              )}
            </>
          ) : (
            <p className="text-xs text-stone-400">{t.selectHint}</p>
          )}
          <div
            role="status"
            aria-live="polite"
            className="text-xs text-stone-500"
          >
            {loading ? t.loading : busy ? t.busy : error ? "" : t.ready}
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {!file ? (
        <button
          disabled={loading}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f && !loading) void load(f);
          }}
          className="m-4 sm:m-8 flex-1 min-h-[520px] rounded-[2rem] border-2 border-dashed border-stone-300 dark:border-white/15 bg-white dark:bg-bg-card-dark flex flex-col items-center justify-center gap-4 hover:border-primary"
        >
          <span className="w-20 h-20 rounded-3xl bg-primary text-white flex items-center justify-center">
            <Upload size={34} />
          </span>
          <b className="text-xl dark:text-white">
            {loading ? t.loading : t.drop}
          </b>
          <span className="text-sm text-stone-400">{t.empty}</span>
        </button>
      ) : (
        <div className="flex flex-1 min-w-0">
          <aside className="hidden md:flex w-20 lg:w-36 shrink-0 bg-white dark:bg-bg-card-dark border-r border-stone-200 dark:border-white/10 p-3 flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-black text-stone-400">
              <PanelLeft size={15} />
              <span className="hidden lg:inline">{t.page}</span>
            </div>
            {geometry.map((_, i) => (
              <button
                key={i}
                aria-label={`${t.page} ${i + 1}`}
                aria-current={page === i + 1 ? "page" : undefined}
                onClick={() => {
                  setPage(i + 1);
                  setSelected(null);
                }}
                className={
                  "rounded-xl border p-2 text-xs font-bold " +
                  (page === i + 1
                    ? "border-primary text-primary bg-primary-light"
                    : "border-stone-200 dark:border-white/10 dark:text-white")
                }
              >
                {i + 1}
              </button>
            ))}
          </aside>
          <main
            className="flex-1 min-w-0 overflow-auto p-4 sm:p-8"
            aria-busy={loading || busy}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-stone-500">
              <span className="break-all">{file.name}</span>
              <label>
                {t.page}{" "}
                <select
                  aria-label={t.page}
                  value={page}
                  className={control}
                  onChange={(e) => {
                    setPage(+e.target.value);
                    setSelected(null);
                  }}
                >
                  {geometry.map((_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} / {geometry.length}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              {widgets.length
                ? `${t.forms}: ${new Set(widgets.map((w) => w.name)).size}`
                : t.noForms}
            </p>
            {!state.objects.some(
              (o) => o.page === page && o.kind === "text",
            ) && <p className="text-sm text-stone-500 mb-3">{t.noText}</p>}
            <div className="w-fit mx-auto">
              <div
                ref={stage}
                data-testid="pdf-stage"
                onClick={addText}
                className={
                  "relative bg-white shadow-2xl " +
                  (tool === "text" ? "cursor-text" : "")
                }
                style={{
                  width: (box?.width || 600) * zoom,
                  height: (box?.height || 800) * zoom,
                  pointerEvents: loading ? "none" : undefined,
                }}
              >
                <canvas
                  ref={canvas}
                  className="block"
                  style={{
                    visibility: renderedPage === page ? "visible" : "hidden",
                  }}
                />
                {renderedPage !== page && (
                  <div
                    role="status"
                    className="absolute inset-0 flex items-center justify-center text-stone-500 bg-white"
                  >
                    {t.busy}
                  </div>
                )}
                {renderedPage === page &&
                  tool === "select" &&
                  state.objects
                    .filter((o) => o.page === page && !o.deleted)
                    .map((o) => (
                      <div
                        key={o.id}
                        style={{
                          position: "absolute",
                          left: o.x * zoom,
                          top: o.y * zoom,
                          width: o.width * zoom,
                          height: Math.max(
                            10,
                            (layoutHeights[o.id] || o.height) * zoom,
                          ),
                          transform: `rotate(${o.rotation}deg)`,
                          transformOrigin: "top left",
                        }}
                      >
                        <button
                          type="button"
                          aria-label={o.kind === "text" ? o.text : t.image}
                          title={o.kind === "text" ? o.text : t.image}
                          onClick={(e) => {
                            e.stopPropagation();
                            select(o.id);
                          }}
                          className={
                            "absolute inset-0 w-full h-full bg-transparent rounded-sm " +
                            (selected === o.id
                              ? "outline outline-2 outline-primary"
                              : "hover:outline hover:outline-1 hover:outline-primary/50 hover:bg-primary/10")
                          }
                        />
                        {selected === o.id && (
                          <>
                            <button
                              title={t.move}
                              aria-label={t.move}
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => drag(e, o.id)}
                              className="absolute -left-7 -top-7 w-7 h-7 bg-primary text-white rounded-md flex items-center justify-center cursor-move touch-none"
                            >
                              <Move size={15} />
                            </button>
                            <button
                              title={t.resize}
                              aria-label={t.resize}
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => drag(e, o.id, true)}
                              className="absolute -right-3 -bottom-3 w-6 h-6 bg-primary text-white rounded-md flex items-center justify-center cursor-nwse-resize touch-none"
                            >
                              <Maximize2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                {(renderedPage === page ? widgets : [])
                  .filter((w) => w.page === page)
                  .map((w) => {
                    const value = state.fields[w.name] ?? w.value,
                      change = (v: FieldValue) =>
                        update({
                          ...stateRef.current,
                          fields: { ...stateRef.current.fields, [w.name]: v },
                        }),
                      style = {
                        position: "absolute" as const,
                        left: w.x * zoom,
                        top: w.y * zoom,
                        width: w.width * zoom,
                        height: w.height * zoom,
                        fontSize:
                          Math.max(9, Math.min(14, w.height * 0.65)) * zoom,
                        color: "#111",
                        backgroundColor: "#fff",
                      },
                      common = {
                        style,
                        "aria-label": `${t.form}: ${w.name}`,
                        title: w.readOnly ? t.fieldLocked : w.name,
                        disabled: w.readOnly,
                        onClick: (e: React.MouseEvent) => e.stopPropagation(),
                        className:
                          "border border-blue-300 focus:outline-2 focus:outline-primary px-0.5",
                      };
                    return w.type === "text" ? (
                      w.multiline ? (
                        <textarea
                          key={w.id}
                          {...common}
                          maxLength={w.maxLength}
                          value={String(value)}
                          onChange={(e) => change(e.target.value)}
                        />
                      ) : (
                        <input
                          key={w.id}
                          {...common}
                          maxLength={w.maxLength}
                          value={String(value)}
                          onChange={(e) => change(e.target.value)}
                        />
                      )
                    ) : w.type === "checkbox" ? (
                      <input
                        key={w.id}
                        {...common}
                        type="checkbox"
                        checked={!!value}
                        onChange={(e) => change(e.target.checked)}
                      />
                    ) : w.type === "radio" ? (
                      <input
                        key={w.id}
                        {...common}
                        name={w.name}
                        type="radio"
                        checked={value === w.exportValue}
                        onChange={() => change(w.exportValue)}
                      />
                    ) : w.type === "choice" ? (
                      <select
                        key={w.id}
                        {...common}
                        multiple={w.multiple}
                        value={
                          w.multiple
                            ? Array.isArray(value)
                              ? value
                              : [String(value)]
                            : Array.isArray(value)
                              ? value[0] || ""
                              : String(value)
                        }
                        onChange={(e) =>
                          change(
                            w.multiple
                              ? Array.from(
                                  e.currentTarget.selectedOptions,
                                  (o: HTMLOptionElement) => o.value,
                                )
                              : e.target.value,
                          )
                        }
                      >
                        <option value="" />
                        {w.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        key={w.id}
                        title={t.fieldLocked}
                        style={{ ...style, backgroundColor: "transparent" }}
                      />
                    );
                  })}
              </div>
            </div>
          </main>
        </div>
      )}
      <input
        ref={input}
        hidden
        type="file"
        accept=".pdf,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void load(f);
        }}
      />
      <input
        ref={imageInput}
        hidden
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void readImage(f);
        }}
      />
      {signature && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.signature}
            className="bg-white dark:bg-bg-card-dark rounded-2xl p-5 w-full max-w-xl space-y-4"
          >
            <b className="dark:text-white">{t.signature}</b>
            <p className="text-sm text-stone-500">{t.signHint}</p>
            <canvas
              ref={signatureCanvas}
              width={600}
              height={220}
              onPointerDown={drawSignature}
              className="w-full bg-white border border-stone-300 rounded-lg touch-none"
            />
            <div className="flex justify-end gap-2">
              <button
                className={control}
                onClick={() => {
                  signatureCanvas.current
                    ?.getContext("2d")
                    ?.clearRect(0, 0, 600, 220);
                  setSigned(false);
                }}
              >
                {t.clear}
              </button>
              <button className={control} onClick={() => setSignature(false)}>
                {t.cancel}
              </button>
              <button
                disabled={!signed}
                className="rounded-lg bg-primary text-white px-4 py-2 disabled:opacity-40"
                onClick={() => {
                  addImage(
                    signatureCanvas.current!.toDataURL("image/png"),
                    600,
                    220,
                  );
                  setSignature(false);
                }}
              >
                {t.insert}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
