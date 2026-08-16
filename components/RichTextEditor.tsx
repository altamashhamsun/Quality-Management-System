"use client";

import { useEffect, useRef } from "react";

export type RichTextChange = (html: string) => void;

const FONTS = [
  "Arial",
  "Arial Black",
  "Arial Narrow",
  "Calibri",
  "Cambria",
  "Candara",
  "Century Gothic",
  "Comic Sans MS",
  "Consolas",
  "Constantia",
  "Corbel",
  "Courier New",
  "Franklin Gothic Medium",
  "Gabriola",
  "Georgia",
  "Impact",
  "Lato",
  "Lucida Console",
  "Lucida Sans Unicode",
  "Microsoft Sans Serif",
  "Montserrat",
  "Open Sans",
  "Palatino Linotype",
  "Roboto",
  "Segoe Print",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
];

const FONT_SIZES = Array.from({ length: 64 }, (_, i) => i + 9);

const STYLES: { value: string; label: string; block: string }[] = [
  { value: "normal", label: "Normal text", block: "<p>" },
  { value: "h1", label: "Heading 1", block: "<h1>" },
  { value: "h2", label: "Heading 2", block: "<h2>" },
  { value: "h3", label: "Heading 3", block: "<h3>" },
  { value: "h4", label: "Heading 4", block: "<h4>" },
  { value: "h5", label: "Heading 5", block: "<h5>" },
];

const HIGHLIGHTS: { value: string; label: string }[] = [
  { value: "#fef08a", label: "Yellow" },
  { value: "#bef264", label: "Lime" },
  { value: "#67e8f9", label: "Cyan" },
  { value: "#f9a8d4", label: "Pink" },
  { value: "#fdba74", label: "Orange" },
  { value: "#fca5a5", label: "Red" },
  { value: "#86efac", label: "Green" },
  { value: "#93c5fd", label: "Blue" },
  { value: "#d8b4fe", label: "Purple" },
];

const LINE_HEIGHTS = ["1", "1.15", "1.5", "2", "2.5", "3"];
const PARAGRAPH_SPACING = ["0", "6", "12", "18", "24"];

const TOOLBAR_BTN =
  "flex h-7 min-w-7 items-center justify-center rounded-md border border-zinc-700 px-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-400 hover:bg-zinc-800 hover:text-white";

const TOOLBAR_SELECT =
  "h-7 rounded-md border border-zinc-700 bg-zinc-950 px-1 text-xs text-zinc-300 outline-none transition-colors focus:border-zinc-400 [color-scheme:dark]";

const editorCss = `
  .rte-body { outline: none; }
  .rte-body[data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: #71717a;
    pointer-events: none;
  }
  .rte-body h1 { font-size: 1.9em; font-weight: 700; margin: 0.6em 0 0.3em; }
  .rte-body h2 { font-size: 1.6em; font-weight: 700; margin: 0.6em 0 0.3em; }
  .rte-body h3 { font-size: 1.35em; font-weight: 600; margin: 0.6em 0 0.3em; }
  .rte-body h4 { font-size: 1.15em; font-weight: 600; margin: 0.5em 0 0.25em; }
  .rte-body h5 { font-size: 1em; font-weight: 600; margin: 0.5em 0 0.25em; }
  .rte-body p, .rte-body li { margin: 0.25em 0; }
  .rte-body ul { list-style: disc; list-style-position: outside; padding-left: 1.6em; margin: 0.25em 0; }
  .rte-body ol { list-style: decimal; list-style-position: outside; padding-left: 1.6em; margin: 0.25em 0; }
  .rte-body ul ul { list-style: circle; }
  .rte-body ul ul ul { list-style: square; }
  .rte-body ol ul { list-style: disc; }
  .tw-check-row { display: flex; gap: 0.5rem; align-items: flex-start; margin: 0.25em 0; }
  .tw-check-row .tw-check { margin-top: 0.35em; }
  .tw-check-row .tw-check-content { flex: 1; }
  .tw-check-row.tw-check-done .tw-check-content {
    text-decoration: line-through;
    color: #71717a;
  }
`;

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "10rem",
}: {
  value: string;
  onChange: RichTextChange;
  placeholder?: string;
  minHeight?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  function emit() {
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function exec(command: string, value?: string) {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    emit();
  }

  function applyStyle(block: string) {
    document.execCommand("formatBlock", false, block);
    emit();
  }

  function applyFont(font: string) {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontName", false, font);
    emit();
  }

  function applyFontSize(px: number) {
    const editor = editorRef.current;
    if (!editor) return;
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");
    editor.querySelectorAll<HTMLElement>('font[size="7"]').forEach((el) => {
      el.removeAttribute("size");
      el.style.fontSize = `${px}px`;
    });
    emit();
  }

  function clearInlineProp(prop: keyof CSSStyleDeclaration) {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) =>
        range.intersectsNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP,
    });
    const nodes: HTMLElement[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as HTMLElement);
    for (const node of nodes) {
      node.style.removeProperty(prop as string);
    }
  }

  function applyHighlight(color: string) {
    if (color === "none") {
      clearInlineProp("backgroundColor");
      emit();
      return;
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("hiliteColor", false, color);
    emit();
  }

  function setBlockProp(prop: "lineHeight" | "marginTop" | "marginBottom", value: string) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode;
    const el =
      node && node.nodeType === Node.TEXT_NODE
        ? node.parentElement
        : (node as HTMLElement | null);
    if (!el) return;
    const block = el.closest("p,h1,h2,h3,h4,h5,li,blockquote");
    ((block ?? el) as HTMLElement).style[prop] = value;
    emit();
  }

  function placeCaretAtEnd(el: Node) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function toggleList(listType: "ul" | "ol") {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode;
    const el =
      node && node.nodeType === Node.TEXT_NODE
        ? node.parentElement
        : (node as HTMLElement | null);
    if (!el) return;
    const block = el.closest<HTMLElement>("p,div,h1,h2,h3,h4,h5,li,blockquote");
    if (!block || block === editorRef.current) return;

    const list = block.closest<HTMLElement>("ul,ol");
    const listTag = list?.tagName.toLowerCase();

    if (list && listTag === listType) {
      const items = Array.from(list.children).filter(
        (c) => c.tagName.toLowerCase() === "li",
      ) as HTMLElement[];
      const fragment = document.createDocumentFragment();
      for (const item of items) {
        const p = document.createElement("p");
        p.innerHTML = item.innerHTML;
        fragment.appendChild(p);
      }
      list.replaceWith(fragment);
      const last = fragment.lastChild;
      if (last) placeCaretAtEnd(last);
      emit();
      return;
    }

    if (list) {
      const converted = document.createElement(listType);
      converted.innerHTML = list.innerHTML;
      list.replaceWith(converted);
      placeCaretAtEnd(converted);
      emit();
      return;
    }

    const newList = document.createElement(listType);
    const li = document.createElement("li");
    li.innerHTML = block.innerHTML;
    newList.appendChild(li);
    block.replaceWith(newList);
    placeCaretAtEnd(newList);
    emit();
  }

  function toggleChecklist() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const node = sel.anchorNode;
    const el =
      node && node.nodeType === Node.TEXT_NODE
        ? node.parentElement
        : (node as HTMLElement | null);
    if (!el) return;
    const block = el.closest("p,div,h1,h2,h3,h4,h5,li,blockquote");
    if (!block || block === editorRef.current) return;
    const existingRow = block.closest(".tw-check-row");
    if (existingRow) {
      const content = existingRow.querySelector(".tw-check-content");
      const div = document.createElement("p");
      div.innerHTML = content ? content.innerHTML : block.innerHTML;
      existingRow.replaceWith(div);
      placeCaretAtEnd(div);
      emit();
      return;
    }
    const row = document.createElement("div");
    row.className = "tw-check-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "tw-check";
    const contentDiv = document.createElement("div");
    contentDiv.className = "tw-check-content";
    contentDiv.innerHTML = block.innerHTML;
    cb.addEventListener("change", () =>
      row.classList.toggle("tw-check-done", cb.checked),
    );
    row.append(cb, contentDiv);
    block.replaceWith(row);
    placeCaretAtEnd(contentDiv);
    emit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const sel = window.getSelection();
    const node = sel?.anchorNode;
    const el =
      node && node.nodeType === Node.TEXT_NODE
        ? node.parentElement
        : (node as HTMLElement | null);
    if (e.key === "Enter") {
      const content = el?.closest<HTMLElement>(".tw-check-content");
      if (content && sel && sel.rangeCount) {
        e.preventDefault();
        const row = content.closest<HTMLElement>(".tw-check-row");
        if (!row) return;
        if (content.textContent?.trim() === "") {
          const div = document.createElement("p");
          row.replaceWith(div);
          placeCaretAtEnd(div);
          emit();
          return;
        }
        const range = sel.getRangeAt(0);
        const before = document.createRange();
        before.selectNodeContents(content);
        before.setEnd(range.startContainer, range.startOffset);
        const after = document.createRange();
        after.selectNodeContents(content);
        after.setStart(range.endContainer, range.endOffset);
        const newRow = document.createElement("div");
        newRow.className = "tw-check-row";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "tw-check";
        const newContent = document.createElement("div");
        newContent.className = "tw-check-content";
        newContent.textContent = after.toString();
        cb.addEventListener("change", () =>
          newRow.classList.toggle("tw-check-done", cb.checked),
        );
        newRow.append(cb, newContent);
        content.textContent = before.toString();
        row.after(newRow);
        placeCaretAtEnd(newContent);
        emit();
      }
    }
    if (e.key === "Backspace") {
      const content = el?.closest<HTMLElement>(".tw-check-content");
      if (content && content.textContent?.trim() === "") {
        const row = content.closest<HTMLElement>(".tw-check-row");
        if (!row) return;
        if (!row.previousElementSibling && !row.nextElementSibling) return;
        e.preventDefault();
        const div = document.createElement("p");
        row.replaceWith(div);
        placeCaretAtEnd(div);
        emit();
      }
    }
  }

  function handleInput() {
    const editor = editorRef.current;
    if (!editor) return;
    if (
      editor.innerHTML === "<br>" ||
      editor.innerHTML === "&nbsp;" ||
      editor.textContent === ""
    ) {
      editor.innerHTML = "";
    }
    emit();
  }

  function clearFormatting() {
    document.execCommand("removeFormat", false, undefined);
    emit();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-700">
      <style>{editorCss}</style>
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-800 bg-zinc-900/70 p-1.5">
        <button type="button" title="Undo" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("undo"); }}>
          ↩
        </button>
        <button type="button" title="Redo" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("redo"); }}>
          ↪
        </button>

        <div className="mx-0.5 h-5 w-px bg-zinc-700" />

        <select
          className={TOOLBAR_SELECT}
          title="Paragraph style"
          defaultValue=""
          onChange={(e) => {
            const s = STYLES.find((x) => x.value === e.target.value);
            if (s) applyStyle(s.block);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Style
          </option>
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          className={TOOLBAR_SELECT}
          title="Font family"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) applyFont(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Font
          </option>
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>

        <select
          className={TOOLBAR_SELECT}
          title="Font size"
          defaultValue=""
          onChange={(e) => {
            const size = Number(e.target.value);
            if (size) applyFontSize(size);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Size
          </option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="mx-0.5 h-5 w-px bg-zinc-700" />

        <button type="button" title="Bold" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}>
          <b>B</b>
        </button>
        <button type="button" title="Italic" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}>
          <i>I</i>
        </button>
        <button type="button" title="Underline" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("underline"); }}>
          <u>U</u>
        </button>
        <button type="button" title="Strikethrough" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("strikeThrough"); }}>
          <s>S</s>
        </button>

        <select
          className={TOOLBAR_SELECT}
          title="Highlight"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) applyHighlight(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Highlight
          </option>
          {HIGHLIGHTS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
          <option value="none">Remove highlight</option>
        </select>

        <div className="mx-0.5 h-5 w-px bg-zinc-700" />

        <button type="button" title="Align left" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("justifyLeft"); }}>
          ⇤
        </button>
        <button type="button" title="Align center" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("justifyCenter"); }}>
          ⇹
        </button>
        <button type="button" title="Align right" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("justifyRight"); }}>
          ⇥
        </button>
        <button type="button" title="Justify" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("justifyFull"); }}>
          ≣
        </button>

        <select
          className={TOOLBAR_SELECT}
          title="Line spacing"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) setBlockProp("lineHeight", e.target.value);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Line
          </option>
          {LINE_HEIGHTS.map((lh) => (
            <option key={lh} value={lh}>
              {lh}
            </option>
          ))}
        </select>

        <select
          className={TOOLBAR_SELECT}
          title="Paragraph spacing (px)"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) {
              setBlockProp("marginTop", `${e.target.value}px`);
              setBlockProp("marginBottom", `${e.target.value}px`);
            }
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Para px
          </option>
          {PARAGRAPH_SPACING.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div className="mx-0.5 h-5 w-px bg-zinc-700" />

        <button type="button" title="Checklist" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); toggleChecklist(); }}>
          ☑
        </button>
        <button type="button" title="Bulleted list" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); toggleList("ul"); }}>
          •≡
        </button>
        <button type="button" title="Numbered list" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); toggleList("ol"); }}>
          1≡
        </button>
        <button type="button" title="Indent" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("indent"); }}>
          →|
        </button>
        <button type="button" title="Outdent" className={TOOLBAR_BTN} onMouseDown={(e) => { e.preventDefault(); exec("outdent"); }}>
          |←
        </button>

        <div className="mx-0.5 h-5 w-px bg-zinc-700" />

        <button
          type="button"
          title="Clear formatting"
          className={TOOLBAR_BTN}
          onMouseDown={(e) => {
            e.preventDefault();
            clearFormatting();
          }}
        >
          ⌫
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="rte-body bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
        style={{ minHeight }}
      />
    </div>
  );
}
