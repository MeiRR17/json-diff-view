# JSON Diff View

**Compare two JSON documents side by side, privately in your browser.**

A dependency-free, static web app for developers, API users, QA engineers, and anyone who needs to find changed JSON values quickly. No signup, analytics, external scripts, upload, or backend.

## Features

- Paste JSON in two side-by-side editors or open local \`.json\` files.
- Compare object keys and nested structures with exact \`$\` paths.
- Highlight additions, removals, and changes in aligned before/after columns.
- Load an illustrative sample, swap documents, or clear editors.
- Copy a JSON change report to your clipboard.
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
- The change report is **not a JSON Patch** and should not be applied automatically to production data.
- Input is limited to **2 MiB per editor**. Traversal has limits of 100,000 visited nodes, nesting depth 200 and 5,000 shown differences. A truncated report is explicitly marked as such.
- Long values in the visual table have shortened previews; the copied report contains their full content.

## Project layout

\`\`\`text
index.html       Accessible editor and diff table
styles.css       Responsive layout, light/dark themes
src/diff.js      Pure structural comparison and JSON parsing
src/app.js       Browser interactions, file import, report rendering
\`\`\`

## Privacy

All parsing, comparisons, and file reads occur on your device. The application makes no network requests itself. If you host it publicly, the hosting provider may log requests for the static application files, but the pasted JSON is not sent to that host.

## Author

Built by Meir Dvir · [https://github.com/MeiRR17](https://github.com/MeiRR17)
