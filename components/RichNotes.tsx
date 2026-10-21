"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  ListChecks, Heading1, Heading2, Link2, Undo2, Redo2,
  Palette
} from "lucide-react";

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  TextStyle,
  Color,
  Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({
    placeholder: "What did you last do? What comes next? Anything worth remembering?"
  })
];

export function legacyNoteToContent(note: string): string | JSONContent {
  // Existing guest notes are plain text; don't let raw '<' or HTML snippets
  // accidentally become executable markup during the editor migration.
  if (/^\s*<(p|h[1-6]|ul|ol|blockquote|div)\b/i.test(note)) return note;
  const blocks = note.split(/\r?\n/).map(line => ({
    type: "paragraph",
    ...(line ? { content: [{ type: "text", text: line }] } : {})
  }));
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] };
}

type Props = { note: string; onChange: (html: string) => void; editable?: boolean };

export default function RichNotes({ note, onChange, editable = true }: Props) {
  const editor = useEditor({
    extensions,
    content: legacyNoteToContent(note),
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: "rich-content", "aria-label": "Your game notes" } }
  });
  if (!editor) return <div className="editor-loading">Opening your notes…</div>;

  const action = (label: string, active: boolean, run: () => void, Icon: typeof Bold) => (
    <button type="button" aria-label={label} title={label}
      className={active ? "editor-tool active" : "editor-tool"}
      onMouseDown={e => e.preventDefault()} onClick={run}>
      <Icon size={16}/>
    </button>
  );
  const setLink = () => {
    const old = editor.getAttributes("link").href || "";
    const url = window.prompt("Paste a link (leave empty to remove):", old);
    if (url === null) return;
    if (!url.trim()) return void editor.chain().focus().unsetLink().run();
    try {
      const parsed = new URL(url.trim());
      if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
      editor.chain().focus().extendMarkRange("link").setLink({
        href: parsed.toString(), target: "_blank", rel: "noopener noreferrer"
      }).run();
    } catch { window.alert("Please enter a valid http:// or https:// address."); }
  };
  return (
    <div className="rich-editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
        {action("Bold", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), Bold)}
        {action("Italic", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), Italic)}
        {action("Underline", editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), UnderlineIcon)}
        <span className="editor-divider"/>
        {action("Heading 1", editor.isActive("heading",{level:1}), () => editor.chain().focus().toggleHeading({level:1}).run(), Heading1)}
        {action("Heading 2", editor.isActive("heading",{level:2}), () => editor.chain().focus().toggleHeading({level:2}).run(), Heading2)}
        {action("Bulleted list", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), List)}
        {action("Numbered list", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered)}
        {action("Checklist", editor.isActive("taskList"), () => editor.chain().focus().toggleTaskList().run(), ListChecks)}
        <span className="editor-divider"/>
        {action("Hyperlink", editor.isActive("link"), setLink, Link2)}
        <label className="editor-color" title="Text color"><Palette size={16}/>
          <select aria-label="Text color" value={editor.getAttributes("textStyle").color || ""} onChange={e=>{
            if (e.target.value) editor.chain().focus().setColor(e.target.value).run();
            else editor.chain().focus().unsetColor().run();
          }}>
            <option value="">Default</option>
            <option value="#77a9f7">Blue</option>
            <option value="#70c8be">Teal</option>
            <option value="#e8b878">Gold</option>
            <option value="#f29bad">Pink</option>
            <option value="#b39bfa">Violet</option>
          </select>
        </label>
        <span className="editor-spacer"/>
        {action("Undo", false, () => editor.chain().focus().undo().run(), Undo2)}
        {action("Redo", false, () => editor.chain().focus().redo().run(), Redo2)}
      </div>
      <EditorContent editor={editor}/>
      <div className="editor-foot">Autosaves locally as you type · Ctrl+Z to undo</div>
    </div>
  );
}
