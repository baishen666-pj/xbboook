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
          let modified = false;

          doc.descendants((node, pos) => {
            if (!node.isLeaf) return;
            const ghostMark = node.marks.find(
              (m) => m.type.name === this.name
            );
            if (ghostMark) {
              tr.delete(pos, pos + node.nodeSize);
              modified = true;
            }
          });

          return modified;
        },
    };
  },
});
