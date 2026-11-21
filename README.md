# JSON Diff View

**Compare two JSON documents side by side, privately in your browser.**

A dependency-free, static web app for developers, API users, QA engineers, and anyone who needs to find changed JSON values quickly. No signup, analytics, external scripts, upload, or backend.

## Features

- Paste JSON in two side-by-side editors or open local \`.json\` files. Imported documents are syntax-checked and require confirmation before replacing existing contents; stale asynchronous file loads cannot overwrite edits, swapped documents, cleared editors or a newly loaded sample.
- Compare object keys and nested structures with exact \`$\` paths.
- Highlight additions, removals, and changes in aligned before/after columns.
- Load an illustrative sample, swap documents, or clear editors.
- Copy a JSON change report to your clipboard.
- Export a **standards-based RFC 6902 JSON Patch** as a bare JSON array, through clipboard or a downloadable `.jsonpatch` file.
- Preview applying a JSON Patch to a **detached copy** of the Before document, inspect the resulting JSON, download it, or explicitly send it to the After editor for comparison.
- Import a local `.jsonpatch` or `.json` file into the patch editor. The import validates that it contains an array of at most 5,000 operations and respects the 2 MiB file limit; **it does not execute the patch or change either document**. If patch text is already present, replacing it requires confirmation. Switching to a newly generated patch cancels any unfinished import so an older file cannot overwrite the selected patch.
- Keyboard shortcut: **Ctrl+Enter** (Windows/Linux) or **⌘+Enter** (macOS).
- Responsive layout with keyboard-accessible controls, light and dark themes.

## Open locally

Open [index.html](index.html) in a modern browser, or serve this folder over HTTP:

\`\`\`sh
python3 -m http.server 8000
\`\`\`

Then visit \`http://localhost:8000\`. Browser security policies for ES modules may prevent some browsers from opening the app directly from a \`file://\` URL; serving over HTTP is the reliable method.

**Deployment:** Host the repository root on any static web host (for example GitHub Pages, Netlify, or Cloudflare Pages). GitHub Pages must be enabled separately in repository settings if desired.

## Comparison semantics

- Object keys are compared by name, regardless of their order in the original JSON.
- Arrays are compared **by index**, not by record ID or edit distance. Inserting an item near the front can produce several changed-index entries.
- Numbers, strings, booleans, and \`null\` compare by value. Unlike text diffs, \`1\` and \`1.0\` represent the same JSON number.
- Added or removed nested objects/arrays appear as a single path containing the full value, rather than one row per descendant.
- The **visual change report** is still a descriptive list of before/after values and is **not itself a patch**.
- The **separate JSON Patch export** emits RFC 6902 `add`, `remove`, and `replace` operations (without `move`, `copy`, or `test`). The **import/apply** editor additionally understands external `test`, `copy`, and `move` operations. Object paths use JSON Pointer escaping (`~0` for `~`, `~1` for `/`). The root document path is the empty string.
- Array changes are index-based: common positions are compared, excess trailing entries are removed from highest index to lowest, and new trailing entries are added in increasing index order. This does not infer semantic moves or record IDs.
- If the transformation needs more than 5,000 operations, the tool refuses to export a potentially incomplete patch. Review any patch before applying it to production data.
- The Patch preview accepts **`add`, `remove`, `replace`, `test`, `copy`, and `move`**. `test` checks the value at its JSON Pointer without modifying it. Object property order is ignored, while array order matters. A missing path or failing assertion aborts the entire preview and leaves the original document unchanged. JSON comparisons share a bounded 100,000-node work budget. `copy` reads an existing `from` pointer and inserts a detached value at `path`; `move` removes the source before inserting it at the destination, so array indexes are evaluated after removal. Moving into the source's own descendant is rejected; moving onto the same path is an existing-path-checked no-op. Removing the document root as part of a move is unsupported. Malformed pointers and array indices are rejected.
- An empty path targets the document root for add/replace. Removing the root document is unsupported. Arrays may be appended with \`-\` in an add operation; array indexes are otherwise canonical decimals.
- Example guard: `[{"op":"test","path":"/version","value":1},{"op":"replace","path":"/version","value":2}]`. Example array move: `[{"op":"move","from":"/items/0","path":"/items/2"}]` (the destination is interpreted after removing index 0). Example copy: `[{"op":"copy","from":"/settings","path":"/settingsBackup"}]`. The second operation applies only if the first matches.
- Patch application never mutates the input JSON value. Object property reads require own properties; assignments use safe property definition for keys such as \`__proto__\`. Invalid operations abort without returning a partially modified document.
- The result preview is capped at **2 MiB** and is not written into either editor until **Send result to After** is clicked. Importing a patch performs file reading and shape/size checks only; semantic validation occurs during explicit Preview. In-flight file loads are ignored when the patch editor changes, preventing stale asynchronous imports from replacing typed instructions. If After already has content, the tool requests confirmation before replacing it.

- Input is limited to **2 MiB per editor**. Traversal has limits of 100,000 visited nodes, nesting depth 200 and 5,000 shown differences. A truncated report is explicitly marked as such.
- Long values in the visual table have shortened previews; the copied report contains their full content.

## Project layout

\`\`\`text
index.html       Accessible editor and diff table
styles.css       Responsive layout, light/dark themes
src/diff.js      Pure structural comparison and JSON parsing
src/patch.js     RFC 6902 patch generation and serialization
src/apply.js     Detached RFC 6902 patch application, own-property pointers, safe move/copy
src/app.js       Browser interactions, file import, report rendering
\`\`\`

## Privacy

All parsing, comparisons, and file reads occur on your device. The application makes no network requests itself. If you host it publicly, the hosting provider may log requests for the static application files, but the pasted JSON is not sent to that host.

## Author

Built by Meir Dvir · [https://github.com/MeiRR17](https://github.com/MeiRR17)
