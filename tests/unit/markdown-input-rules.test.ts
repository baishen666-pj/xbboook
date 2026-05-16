/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';

function createEditor(content = '<p></p>') {
  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Markdown.configure({
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content,
  });
}

/**
 * Simulate typing text character-by-character into the editor.
 * This triggers the ProseMirror handleTextInput pipeline which
 * is where input rules are evaluated.
 */
function typeText(editor: Editor, text: string) {
  const { view } = editor;
  for (const char of text) {
    const { from } = editor.state.selection;
    view.dispatch(
      editor.state.tr.insertText(char, from, from)
    );
    // Trigger handleTextInput for each character
    const newPos = editor.state.selection.from;
    const textBefore = editor.state.doc.resolve(newPos).parent.textContent;
    // Find the inputRules plugin and run its handleTextInput
    for (const plugin of editor.state.plugins) {
      if ((plugin.spec as any).isInputRules && plugin.props?.handleTextInput) {
        const handled = plugin.props.handleTextInput(
          view,
          newPos - char.length,
          newPos - char.length,
          char
        );
        if (handled) break;
      }
    }
  }
}

/**
 * Simulate typing a Markdown shortcut at the end of an empty paragraph.
 * Uses the ProseMirror handleTextInput directly for the final character
 * which triggers the input rule.
 */
function typeMarkdownShortcut(editor: Editor, fullText: string) {
  const { view } = editor;

  // First insert all characters except the last one
  const prefix = fullText.slice(0, -1);
  if (prefix) {
    const { from } = editor.state.selection;
    view.dispatch(editor.state.tr.insertText(prefix, from, from));
  }

  // Now insert the last character through handleTextInput to trigger input rules
  const lastChar = fullText.slice(-1);
  const { from } = editor.state.selection;

  for (const plugin of editor.state.plugins) {
    if ((plugin.spec as any).isInputRules && plugin.props?.handleTextInput) {
      const handled = plugin.props.handleTextInput(view, from, from, lastChar);
      if (handled) return;
    }
  }

  // If no input rule matched, just insert the character normally
  view.dispatch(editor.state.tr.insertText(lastChar, from, from));
}

describe('Markdown Input Rules', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor();
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Heading input rules', () => {
    it('converts # + space to H1', () => {
      typeMarkdownShortcut(editor, '# ');
      const html = editor.getHTML();
      expect(html).toContain('h1');
    });

    it('converts ## + space to H2', () => {
      typeMarkdownShortcut(editor, '## ');
      const html = editor.getHTML();
      expect(html).toContain('h2');
    });

    it('converts ### + space to H3', () => {
      typeMarkdownShortcut(editor, '### ');
      const html = editor.getHTML();
      expect(html).toContain('h3');
    });
  });

  describe('Blockquote input rule', () => {
    it('converts > + space to blockquote', () => {
      typeMarkdownShortcut(editor, '> ');
      const html = editor.getHTML();
      expect(html).toContain('blockquote');
    });
  });

  describe('Bullet list input rule', () => {
    it('converts - + space to bullet list', () => {
      typeMarkdownShortcut(editor, '- ');
      const html = editor.getHTML();
      expect(html).toContain('ul');
    });

    it('converts * + space to bullet list', () => {
      typeMarkdownShortcut(editor, '* ');
      const html = editor.getHTML();
      expect(html).toContain('ul');
    });
  });

  describe('Ordered list input rule', () => {
    it('converts 1. + space to ordered list', () => {
      typeMarkdownShortcut(editor, '1. ');
      const html = editor.getHTML();
      expect(html).toContain('ol');
    });
  });

  describe('Code block input rule', () => {
    it('converts ``` + space to code block', () => {
      typeMarkdownShortcut(editor, '``` ');
      const html = editor.getHTML();
      expect(html).toContain('pre');
    });
  });

  describe('Horizontal rule input rule', () => {
    it('converts --- to horizontal rule', () => {
      typeMarkdownShortcut(editor, '---');
      const html = editor.getHTML();
      expect(html).toContain('hr');
    });
  });

  describe('Bold input rule', () => {
    it('applies bold for **text** pattern', () => {
      // Bold input rule: type **bold** and the closing ** triggers the rule
      typeMarkdownShortcut(editor, '**bold**');
      const html = editor.getHTML();
      expect(html).toContain('strong');
    });
  });

  describe('Italic input rule', () => {
    it('applies italic for *text* pattern', () => {
      typeMarkdownShortcut(editor, '*italic*');
      const html = editor.getHTML();
      expect(html).toContain('em');
    });
  });

  describe('Strike input rule', () => {
    it('applies strikethrough for ~~text~~ pattern', () => {
      typeMarkdownShortcut(editor, '~~strike~~');
      const html = editor.getHTML();
      expect(html).toContain('s');
    });
  });

  describe('Markdown extension configuration', () => {
    it('has Markdown extension with transformPastedText enabled', () => {
      const mdExt = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'markdown'
      );
      expect(mdExt).toBeDefined();
      expect(mdExt.options.transformPastedText).toBe(true);
      expect(mdExt.options.transformCopiedText).toBe(true);
    });

    it('has Markdown storage with parser and serializer', () => {
      const storage = editor.storage.markdown;
      expect(storage).toBeDefined();
      expect(storage.parser).toBeDefined();
      expect(storage.serializer).toBeDefined();
      expect(typeof storage.getMarkdown).toBe('function');
    });

    it('can serialize content to Markdown', () => {
      editor.commands.setContent('<h1>Title</h1><p>Hello <strong>world</strong></p>');
      const md = editor.storage.markdown.getMarkdown();
      expect(md).toContain('# Title');
      expect(md).toContain('**world**');
    });

    it('can parse Markdown content via setContent', () => {
      editor.commands.setContent('# Parsed Title\n\nSome paragraph text');
      const html = editor.getHTML();
      expect(html).toContain('h1');
      expect(html).toContain('Parsed Title');
    });
  });

  describe('StarterKit extensions are loaded', () => {
    it('includes heading extension', () => {
      const ext = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'heading'
      );
      expect(ext).toBeDefined();
    });

    it('includes bold extension', () => {
      const ext = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'bold'
      );
      expect(ext).toBeDefined();
    });

    it('includes italic extension', () => {
      const ext = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'italic'
      );
      expect(ext).toBeDefined();
    });

    it('includes blockquote extension', () => {
      const ext = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'blockquote'
      );
      expect(ext).toBeDefined();
    });

    it('includes bulletList extension', () => {
      const ext = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'bulletList'
      );
      expect(ext).toBeDefined();
    });

    it('includes orderedList extension', () => {
      const ext = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'orderedList'
      );
      expect(ext).toBeDefined();
    });

    it('includes codeBlock extension', () => {
      const ext = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'codeBlock'
      );
      expect(ext).toBeDefined();
    });

    it('includes horizontalRule extension', () => {
      const ext = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'horizontalRule'
      );
      expect(ext).toBeDefined();
    });

    it('includes strike extension', () => {
      const ext = (editor as any).extensionManager.extensions.find(
        (ext: any) => ext.name === 'strike'
      );
      expect(ext).toBeDefined();
    });
  });
});
