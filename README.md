# JSON Diff View

**Compare two JSON documents side by side, privately in your browser.**

A dependency-free, static web app for developers, API users, QA engineers, and anyone who needs to find changed JSON values quickly. No signup, analytics, external scripts, upload, or backend.

## Features

- Paste JSON in two side-by-side editors or open local \`.json\` files. Imported documents are syntax-checked and require confirmation before replacing existing contents; stale asynchronous file loads cannot overwrite edits, swapped documents, cleared editors or a newly loaded sample.
- Compare object keys and nested structures with exact \`$\` paths.
- Highlight additions, removals, and changes in aligned before/after columns. Filter recorded changes by a case-insensitive JSON path substring and by change type; navigate 100-result pages without rendering all 5,000 entries simultaneously.
- Load an illustrative sample, swap documents, or clear editors.
- Copy the full JSON change report or download it in **JSON** or **CSV** format. CSV is UTF-8 with spreadsheet-formula neutralization; exports include recorded changes regardless of UI filters or pages.
- Export a **standards-based RFC 6902 JSON Patch** as a bare JSON array, through clipboard or a downloadable `.jsonpatch` file. Select **Before → After** for forward changes or **After → Before** for a reverse/rollback patch. Optionally add `test` operations before each generated removal or replacement to detect unexpected values at those paths.
- Preview applying any imported or generated JSON Patch to a **detached copy** of the selected Before or After document. Inspect the resulting JSON plus a **separate source-to-preview impact report** with added/removed/changed counts, path/type filters, 100-row pages and full-report clipboard, JSON and CSV exports. Download the result or explicitly send it to the opposite editor for comparison. **Use generated patch** automatically selects the appropriate source for forward or reverse output.
- Inspect patch instructions before applying them: a read-only, 100-row-paged operation ledger shows instruction order, type, JSON Pointer path, `from` source, shortened value preview and basic shape warnings. Filter by operation and path. The ledger does not apply operations or claim semantic validity.
- **Step-by-step preview:** choose an integer N from 0 to the patch length to preview the source document after exactly the first N operations; navigate through intermediate states with Previous/Next or select **View step** directly from the patch operation ledger. Each step also displays a **per-operation structural diff** between the immediately previous and current snapshots, with 100-row pagination. The result is an isolated, read-only JSON view (up to 2 MiB) that can be copied or downloaded as a direction- and step-specific JSON checkpoint. Its per-operation change report can likewise be copied in full or exported as JSON/CSV, including truncation and step-source metadata. The remaining operations are not executed and failed earlier operations abort that step without displaying a partial result.
- **Compare two patch checkpoints:** choose any steps A and B with `0 ≤ A ≤ B ≤ patch length`, and inspect the net structural differences between those intermediate documents. Both checkpoints are independently replayed from the same selected source, so earlier `test`/`move`/`copy` semantics are respected. Filter the recorded changes by JSON path/type, navigate 100-row pages, and copy or locally download the complete recorded range report as JSON/CSV.
- **Generate a checkpoint-range JSON Patch:** derive a new standards-compliant `.jsonpatch` array from the two computed checkpoint documents (rather than copying original operations), with optional `test` guards before generated remove/replace instructions. Copy or download this patch independently of report filters. Both **start checkpoint (patch input)** and **end checkpoint (expected result)** are also available as independent, copyable/downloadable JSON documents named with the source and step number. The patch must be applied to the **step A checkpoint document**, not directly to the original source when A > 0.
- **Portable checkpoint bundle:** download the two complete endpoint JSON documents, the generated patch and the original source/step metadata as a single versioned `*-bundle.json` file. On another browser, **Import checkpoint bundle** loads the starting checkpoint into Before, the ending checkpoint into After and the patch instructions into the patch editor. Replacing existing content needs confirmation; importing a bundle never executes its patch or submits data to a server.
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
- The **visual change report** is still a descriptive list of before/after values and is **not itself a patch**. On-screen path/type filters and pagination only change the displayed rows; **Copy change report**, JSON/CSV report downloads and JSON Patch exports use the complete recorded comparison, not the current filtered page. A report truncated by the 5,000-change safety limit remains marked as truncated.
- The **separate JSON Patch export** emits RFC 6902 `add`, `remove`, and `replace` operations in either direction, independently computed from the actual Before and After values; opt-in **guarded generation** inserts `test` checks immediately before `remove` and `replace` (but never generates `move` or `copy`). The **import/apply** editor additionally understands external `test`, `copy`, and `move` operations. Object paths use JSON Pointer escaping (`~0` for `~`, `~1` for `/`). The root document path is the empty string.
- Array changes are index-based: common positions are compared, excess trailing entries are removed from highest index to lowest, and new trailing entries are added in increasing index order. This does not infer semantic moves or record IDs.
- A guarded patch compares each value that will be removed or replaced with the expected source value (Before in forward mode, After in reverse mode). It is **not** a full-document concurrency guard: newly added properties, array appends, and unrelated changes are not protected. No guards are added when generating a pure-add patch.
- If the transformation needs more than 5,000 operations, or if the serialized patch exceeds 2 MiB, the tool refuses to export a potentially incomplete or unimportable patch. Forward and reverse exports use direction-specific filenames (for example, `changes-after-to-before.jsonpatch`). Guarded generation also enforces the preview engine's shared 100,000-node/200-level test budget. Guard operations count toward the 5,000-operation limit. Review any patch before applying it to production data.
- The step preview shares the real patch engine's RFC 6902 semantics, order and `test` budget. Each request recomputes a detached prefix from the selected source, without storing prior intermediate states. The per-step change report independently recomputes the previous prefix and compares two detached snapshots; if its bounded comparison fails, the intermediate JSON remains available and the unavailable effect is explicitly shown. A successful `test` or no-op may produce an empty per-step change report. Editing the source or patch, importing or generating new instructions, switching the selected source, or editing the selected step discards the previous step result and disables exports until another successful preview. Checkpoint downloads and full step-impact downloads are local only; the shared 8 MiB report export limit applies, and the step JSON itself remains capped at 2 MiB. It does not replace the full patch preview or transfer any document to the editors.
- Checkpoint bundle format is `json-diff-view-checkpoint-bundle` version `1`. The bundle is capped at **8 MiB**, while its embedded documents and patch must each fit the **2 MiB** editor/import limit and patch operation count must not exceed 5,000. Unknown format versions or malformed metadata are rejected. In-flight local bundle imports cannot overwrite intervening editor changes, patch edits or newer imports. The embedded patch is not automatically applied or semantically executed on import.
- A checkpoint-generated patch represents the **net transformation** between the selected endpoint documents. It may omit canceled-out operations, replace moves with ordinary add/remove/replace instructions, and does not guarantee identical intermediate behavior. Guarded exports test only removed/replaced values, not additions or unrelated changes. Patch generation is separately bounded to 5,000 operations and 2 MiB; if it exceeds those limits, the range report and endpoint-document exports stay available. Checkpoint JSON is constrained to the 2 MiB editor/import limit, with compact formatting used if pretty-printing would exceed that size. Endpoint export actions refuse stale range selections and never modify either source editor.
- Range comparison shows **net state changes**, not necessarily every intermediate mutation: two opposite operations can cancel out. It executes both prefixes on detached copies, does not run operations after the selected end step, and refuses invalid steps, failed earlier operations, oversized endpoint documents or excessive structural diff complexity. Reports may be truncated at 5,000 changes and exports are subject to the existing 8 MiB cap. Editing the selected source, patch text, or step numbers invalidates the previous range result.
- **Inspect patch operations** is read-only and flags obvious malformed instruction shapes (including missing pointers/values and unsupported operations); it cannot predict whether paths or array indexes resolve on the selected source. Changing the patch text, clearing the editors, importing another patch, or using a new generated patch discards the earlier ledger.
- The Patch preview accepts **`add`, `remove`, `replace`, `test`, `copy`, and `move`**. `test` checks the value at its JSON Pointer without modifying it. Object property order is ignored, while array order matters. A missing path or failing assertion aborts the entire preview and leaves the original document unchanged. JSON comparisons share a bounded 100,000-node work budget. `copy` reads an existing `from` pointer and inserts a detached value at `path`; `move` removes the source before inserting it at the destination, so array indexes are evaluated after removal. Moving into the source's own descendant is rejected; moving onto the same path is an existing-path-checked no-op. Removing the document root as part of a move is unsupported. Malformed pointers and array indices are rejected.
- An empty path targets the document root for add/replace. Removing the root document is unsupported. Arrays may be appended with \`-\` in an add operation; array indexes are otherwise canonical decimals.
- Example guard: `[{"op":"test","path":"/version","value":1},{"op":"replace","path":"/version","value":2}]`; the replacement executes only if the test matches. Example array move: `[{"op":"move","from":"/items/0","path":"/items/2"}]` (the destination is interpreted after removing index 0). Example copy: `[{"op":"copy","from":"/settings","path":"/settingsBackup"}]`.
- Patch application never mutates the input JSON value. Object property reads require own properties; assignments use safe property definition for keys such as \`__proto__\`. Invalid operations abort without returning a partially modified document.
- The result preview is capped at **2 MiB** and is not written into either editor until **Send result to After** or **Send result to Before** is clicked, depending on the selected patch source. The impact review compares the original selected source against the computed result, not the operations in the patch. It can be truncated at 5,000 recorded differences; if its 100,000-node/200-depth comparison limit is exceeded, the result remains available but the impact review is marked unavailable. Filters only affect visible impact rows, not the copied impact report. Importing a patch performs file reading and shape/size checks only; semantic validation occurs during explicit Preview. In-flight file loads are ignored when the patch editor changes, preventing stale asynchronous imports from replacing typed instructions. If the destination editor already has content, the tool requests confirmation before replacing it. Switching the preview source invalidates the previous preview, and changes to the selected source or patch text invalidate result transfer/download.

- Input is limited to **2 MiB per editor**. Traversal has limits of 100,000 visited nodes, nesting depth 200 and 5,000 recorded differences. The table displays up to 100 rows per page, with filters operating on those recorded differences; a truncated report is explicitly marked as such.
- Long values in the visual table have shortened previews; copied and downloaded reports contain full recorded values.
- CSV exports use CRLF rows, UTF-8 BOM, and complete JSON-serialized values in `before_json`/`after_json` columns (so explicit `null` differs from a missing value). The `report_truncated` and `source` columns provide context. User-controlled cells beginning with spreadsheet formula prefixes are escaped before quoting. No data is uploaded; downloads are created locally. Downloads refuse files exceeding **8 MiB** rather than silently truncating them. An empty CSV report contains a header row only.

## Project layout

\`\`\`text
index.html       Accessible editor and diff table
styles.css       Responsive layout, light/dark themes
src/diff.js      Pure structural comparison and JSON parsing
src/patch.js     RFC 6902 patch generation and serialization
src/apply.js     Detached RFC 6902 patch application, own-property pointers, safe move/copy
src/app.js       Browser interactions, file import, report rendering
src/export.js    Full report JSON and safe CSV serialization
src/inspect.js   Read-only patch instruction summaries and shape warnings
src/range.js     Compare detached RFC 6902 step checkpoints
src/bundle.js    Portable checkpoint bundle serialization and parsing
\`\`\`

## Privacy

All parsing, comparisons, and file reads occur on your device. The application makes no network requests itself. If you host it publicly, the hosting provider may log requests for the static application files, but the pasted JSON is not sent to that host.

## Author

Built by Meir Dvir · [https://github.com/MeiRR17](https://github.com/MeiRR17)
