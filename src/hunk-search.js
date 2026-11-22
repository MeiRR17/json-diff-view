/**
 * Bounded read-only search across complete changed lines of two workspaces.
 * This inspects opaque editor text, not parsed JSON or executable patches.
 */
import { parseWorkspace } from './workspace.js';
import { alignRawLineChanges } from './line-diff.js';

const FIELDS = [
  { id: 'before', key: 'beforeText', label: 'Before editor' },
  { id: 'after', key: 'afterText', label: 'After editor' },
  { id: 'patch', key: 'patchText', label: 'JSON Patch editor' }
];
const PAGE_ROWS = 180, MAX_RESULTS = 100, MAX_SCAN = 200000;
const MAX_QUERY_LENGTH = 120, MAX_PREVIEW = 240;

function matchingSnippet(text, query) {
  const at = text.toLocaleLowerCase().indexOf(query);
  if (at < 0) return text.length <= MAX_PREVIEW ?
    text : text.slice(0, MAX_PREVIEW) + '…';
  const start = Math.max(0, at - 75);
  const end = Math.min(text.length, start + MAX_PREVIEW);
  return (start ? '…' : '') + text.slice(start, end) +
    (end < text.length ? '…' : '');
}
function trimmedRegion(left, right) {
  const length = Math.min(left.length, right.length);
  let prefix = 0, suffix = 0;
  while (prefix < length && left[prefix] === right[prefix]) prefix++;
  while (suffix < length - prefix &&
    left[left.length - suffix - 1] === right[right.length - suffix - 1]) suffix++;
  return { prefix, suffix };
}
export function searchChangedSnapshotLines(
  fromEntry, toEntry, queryText, editorFilter = 'all', sideFilter = 'both'
) {
  if (!fromEntry || !toEntry || String(fromEntry.id) === String(toEntry.id) ||
      typeof fromEntry.content !== 'string' || typeof toEntry.content !== 'string') {
    throw new TypeError('Choose two different workspaces for changed-line search.');
  }
  if (typeof queryText !== 'string' || !queryText.trim() ||
      queryText.trim().length > MAX_QUERY_LENGTH) {
    throw new TypeError('The search phrase must contain 1–120 characters.');
  }
  if (editorFilter !== 'all' && !FIELDS.some(f => f.id === editorFilter)) {
    throw new TypeError('Unknown editor search scope.');
  }
  if (!['both', 'earlier', 'later'].includes(sideFilter)) {
    throw new TypeError('Unknown search-side filter.');
  }
  const earlier = parseWorkspace(fromEntry.content);
  const later = parseWorkspace(toEntry.content);
  const query = queryText.trim(), lower = query.toLocaleLowerCase();
  const results = [], editors = [];
  let scanned = 0, skipped = 0, matched = 0;

  for (const field of FIELDS) {
    if (editorFilter !== 'all' && editorFilter !== field.id) continue;
    const left = earlier[field.key].split('\n');
    const right = later[field.key].split('\n');
    const { prefix, suffix } = trimmedRegion(left, right);
    let lastHunk = 0, rowWithinHunk = 0, fieldMatches = 0;
    const aligned = alignRawLineChanges(left, right, prefix, suffix, item => {
      if (lastHunk !== item.hunk_index) {
        lastHunk = item.hunk_index;
        rowWithinHunk = 0;
      }
      rowWithinHunk++;
      if (scanned >= MAX_SCAN) { skipped++; return; }
      scanned++;
      const fromMatch = item.from_present && sideFilter !== 'later' &&
        item.from_text.toLocaleLowerCase().includes(lower);
      const toMatch = item.to_present && sideFilter !== 'earlier' &&
        item.to_text.toLocaleLowerCase().includes(lower);
      if (!fromMatch && !toMatch) return;
      matched++;
      fieldMatches++;
      if (results.length >= MAX_RESULTS) return;
      results.push({
        editor: field.id, editor_label: field.label,
        change_type: item.change_type, hunk_index: item.hunk_index,
        row_in_hunk: rowWithinHunk,
        hunk_page: Math.ceil(rowWithinHunk / PAGE_ROWS),
        match_side: fromMatch && toMatch ? 'both' :
          fromMatch ? 'earlier' : 'later',
        from_line: item.from_line, to_line: item.to_line,
        from_present: item.from_present, to_present: item.to_present,
        from_preview: item.from_present ?
          matchingSnippet(item.from_text, lower) : '',
        to_preview: item.to_present ?
          matchingSnippet(item.to_text, lower) : ''
      });
    });
    editors.push({
      id: field.id, alignment: aligned.strategy,
      total_changed_rows: aligned.rows, total_hunks: aligned.hunks,
      matching_scanned_rows: fieldMatches
    });
  }
  return {
    format: 'json-diff-view-changed-line-search', version: 1,
    patch_not_executed: true, read_only: true, preview_only: true,
    from: { id: String(fromEntry.id), name: String(fromEntry.name) },
    to: { id: String(toEntry.id), name: String(toEntry.name) },
    query,
    filters: { editor: editorFilter, side: sideFilter },
    summary: {
      inspected_changed_rows: scanned,
      uninspected_changed_rows: skipped,
      incomplete: skipped > 0,
      matching_rows_in_inspected_scope: matched,
      stored_results: results.length,
      omitted_matching_rows: matched - results.length,
      maximum_scanned_changed_rows: MAX_SCAN,
      maximum_saved_results: MAX_RESULTS,
      changed_rows_per_hunk_page: PAGE_ROWS,
      maximum_snippet_characters: MAX_PREVIEW
    },
    editors, results
  };
}
function csvCell(value) {
  const s = String(value == null ? '' : value);
  const safe = /^[\u0000-\u0020\uFEFF]*[=+\-@]/u.test(s) ? "'" + s : s;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function serializeChangedLineSearchJson(report) {
  return JSON.stringify(report, null, 2) + '\n';
}
export function serializeChangedLineSearchCsv(report) {
  const rows = [[
    'query','from_workspace','to_workspace','editor','side_scope','match_side',
    'change_type','hunk_index','row_in_hunk','hunk_page','from_line','to_line',
    'from_present','to_present','from_preview','to_preview','incomplete',
    'uninspected_changed_rows','preview_only'
  ]];
  for (const x of report.results) rows.push([
    report.query,report.from.name,report.to.name,x.editor,report.filters.side,
    x.match_side,x.change_type,x.hunk_index,x.row_in_hunk,x.hunk_page,
    x.from_line ?? '',x.to_line ?? '',x.from_present,x.to_present,
    x.from_preview,x.to_preview,report.summary.incomplete,
    report.summary.uninspected_changed_rows,true
  ]);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
