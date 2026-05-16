import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";
import { GhostMark } from "./GhostMark";

export function getEditorExtensions(placeholder = "开始写作你的故事...") {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({ placeholder }),
    CharacterCount,
    Highlight.configure({ multicolor: false }),
    Underline,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Markdown.configure({
      transformPastedText: true,
      transformCopiedText: true,
    }),
    GhostMark,
  ];
}
