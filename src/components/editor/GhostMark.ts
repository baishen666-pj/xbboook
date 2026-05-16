import { Mark, mergeAttributes } from "@tiptap/core";

export interface GhostTextOptions {
  HTMLAttributes: Record<string, string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ghostText: {
      setGhostText: () => ReturnType;
      unsetGhostText: () => ReturnType;
      acceptAllGhost: () => ReturnType;
      removeAllGhost: () => ReturnType;
      insertGhostText: (text: string) => ReturnType;
    };
  }
}

export const GhostMark = Mark.create<GhostTextOptions>({
  name: "ghostText",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [{ tag: "span.ghost-text" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "ghost-text",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setGhostText:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name);
        },
      unsetGhostText:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      acceptAllGhost:
        () =>
        ({ tr, state }) => {
          const { doc } = state;
          let modified = false;

          doc.descendants((node, pos) => {
            if (!node.isLeaf) return;
            const ghostMark = node.marks.find(
              (m) => m.type.name === this.name
            );
            if (ghostMark) {
              tr.removeMark(pos, pos + node.nodeSize, ghostMark);
              modified = true;
            }
          });

          return modified;
        },
      removeAllGhost:
        () =>
        ({ tr, state }) => {
          const { doc } = state;
          const ranges: [number, number][] = [];

          doc.descendants((node, pos) => {
            if (!node.isLeaf) return;
            const ghostMark = node.marks.find(
              (m) => m.type.name === this.name
            );
            if (ghostMark) {
              ranges.push([pos, pos + node.nodeSize]);
            }
          });

          for (let i = ranges.length - 1; i >= 0; i--) {
            const range = ranges[i]!;
            tr.delete(range[0], range[1]);
          }

          return ranges.length > 0;
        },
      insertGhostText:
        (text: string) =>
        ({ tr, state }) => {
          const { from } = state.selection;
          const markType = state.schema.marks[this.name];
          const paragraph = state.schema.nodes.paragraph;
          if (!markType || !paragraph) return false;

          const paragraphs = text.split("\n").filter(Boolean);
          if (paragraphs.length === 0) return false;

          const nodes = paragraphs.map((p) =>
            paragraph.create(
              null,
              state.schema.text(p, [markType.create()])
            )
          );

          const fragment = paragraph.create(null, nodes);
          tr.insert(from, fragment);
          return true;
        },
    };
  },
});
