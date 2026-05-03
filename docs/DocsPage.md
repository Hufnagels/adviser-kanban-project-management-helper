# Docs Page — How to Use

The Docs page (`/docs`) is a lightweight in-browser text editor for quick notes and scratch documents.

---

## Current Capabilities

| Feature | How it works |
|---|---|
| **Title** | Click the title field at the top and type to rename your document |
| **Add a block** | Press **Enter** at the end of any block to create a new one below it |
| **Delete a block** | Press **Backspace** on an empty block to remove it |
| **Add block manually** | Click **+ Add block** at the bottom of the page |
| **Heading style** | Blocks created with type `heading` render in a larger, bold font |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Enter` | Create a new text block below the current one |
| `Backspace` (on empty block) | Delete the current block |
| `Shift + Enter` | Insert a line break within the current block |

---

## Current Limitations

- **No persistence** — content is held in React state only. Refreshing the page or navigating away **clears the document**.
- **No save / load** — there is no backend storage for docs yet. This is planned for Phase 3 (MongoDB-backed Notion-style docs).
- **No rich text** — bold, italic, links, lists etc. are not supported yet.
- **Single document** — only one document is shown at a time; there is no document list or folder structure.

---

## Planned Phase 3 Features

- MongoDB-backed document storage (persist across sessions)
- Document list / sidebar
- Rich text blocks (headings, bullet lists, code blocks, links)
- Notion-style slash (`/`) command to insert block types
- Real-time collaboration

---

## Tip

Use the Docs page as a **scratchpad** during a work session — for meeting notes, copy-paste reference text, or a temporary checklist while working on a contract or task. For long-term notes, attach a file to the relevant contract via the **Documents** tab instead.
