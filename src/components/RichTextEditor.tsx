'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TiptapLink from '@tiptap/extension-link';
import TiptapUnderline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Link as LinkIcon, Quote, Code,
  Undo, Redo, Minus
} from 'lucide-react';
import { useEffect, useRef } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export default function RichTextEditor({ content, onChange, placeholder = 'Start writing...', editable = true, className = '', autoFocus = false }: RichTextEditorProps) {
  const initialContent = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      TiptapUnderline,
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent.current,
    editable,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none min-h-[300px] sm:min-h-[400px] px-3 sm:px-5 py-3 sm:py-4',
      },
    },
  });

  // Sync editable prop
  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, icon: Icon, title }: { onClick: () => void; active?: boolean; icon: React.ElementType; title: string }) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1 sm:p-1.5 rounded transition shrink-0 ${active ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
    >
      <Icon size={15} />
    </button>
  );

  const addLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Enter URL:', prev);
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {editable && (
        <div className="flex items-center gap-0.5 px-1.5 sm:px-2 py-1 sm:py-1.5 border-b border-gray-200 bg-gray-50 overflow-x-auto scrollbar-hide">
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} title="Bold (Ctrl+B)" />
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} title="Italic (Ctrl+I)" />
          <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={UnderlineIcon} title="Underline (Ctrl+U)" />
          <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} icon={Strikethrough} title="Strikethrough" />

          <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1 shrink-0" />

          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={Heading1} title="Heading 1" />
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={Heading2} title="Heading 2" />
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={Heading3} title="Heading 3" />

          <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1 shrink-0" />

          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={List} title="Bullet List" />
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={ListOrdered} title="Numbered List" />
          <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} icon={CheckSquare} title="Checklist" />

          <div className="w-px h-4 bg-gray-300 mx-0.5 sm:mx-1 shrink-0" />

          <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} icon={Quote} title="Quote" />
          <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} icon={Code} title="Code Block" />
          <ToolBtn onClick={addLink} active={editor.isActive('link')} icon={LinkIcon} title="Link" />
          <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={Minus} title="Divider" />

          <div className="flex-1 min-w-2" />

          <ToolBtn onClick={() => editor.chain().focus().undo().run()} icon={Undo} title="Undo" />
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} icon={Redo} title="Redo" />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
