/**
 * Bounded read-only search across complete changed lines of two workspaces.
 * This inspects opaque editor text, not parsed JSON or executable patches.
 * Results are paged by matching changed row, with at most 100 retained
 * snippets. Every page request scans the same bounded changed-line scope.
 * Phrase presence is checked on both sides before directional and
 * transition filtering. This distinguishes introduced, resolved and
 * persistent matches on the same aligned changed row. Whole-word
 * boundaries use Unicode word characters, not JSON key semantics.
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
// Unicode letters, digits, marks and underscore form a whole-word token.
// Anchors matter: a punctuation character next to a match is a boundary.
const WORD_BEFORE = /[\p{L}\p{N}\p{M}_]$/u;
const WORD_AFTER = /^[\p{L}\p{N}\p{M}_]/u;

function findMatchIndex(text, query, caseSensitive, wholeWord) {
  const source = caseSensitive ? text : text.toLocaleLowerCase();
  const needle = caseSensitive ? query : query.toLocaleLowerCase();
  let start = 0;
  while (start <= source.length - needle.length) {
    const at = source.indexOf(needle, start);
    if (at < 0) return -1;
    if (!wholeWord || (
      (at === 0 || !WORD_BEFORE.test(source.slice(Math.max(0, at - 2), at))) &&
      (at + needle.length === source.length ||
        !WORD_AFTER.test(source.slice(at + needle.length, at + needle.length + 2)))
    )) return at;
    start = at + 1;
  }
  return -1;
}
function matchingSnippet(text, matchIndex) {
  if (matchIndex < 0) return text.length <= MAX_PREVIEW ?
    text : text.slice(0, MAX_PREVIEW) + '…';
  const start = Math.max(0, matchIndex - 75);
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
  fromEntry, toEntry, queryText, editorFilter = 'all', sideFilter = 'both',
  matchPage = 1,
  { changeType = 'all', transition = 'all',
    caseSensitive = false, wholeWord = false } = {}
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
  if (!['all', 'added', 'removed', 'changed'].includes(changeType)) {
    throw new TypeError('Unknown changed-row type filter.');
  }
  if (!['all', 'introduced', 'resolved', 'persistent'].includes(transition)) {
    throw new TypeError('Unknown phrase-transition filter.');
  }
  if (typeof caseSensitive !== 'boolean' || typeof wholeWord !== 'boolean') {
    throw new TypeError('Search matching options must be true or false.');
  }
  if (!Number.isSafeInteger(matchPage) || matchPage < 1) {
    throw new RangeError('Match page must be a positive whole number.');
  }
  const matchOffset = (matchPage - 1) * MAX_RESULTS;
  if (!Number.isSafeInteger(matchOffset)) {
    throw new RangeError('Match page is outside the supported range.');
  }
  const earlier = parseWorkspace(fromEntry.content);
  const later = parseWorkspace(toEntry.content);
  const query = queryText.trim();
  const results = [], editors = [];
  const matchedTransitions = { introduced: 0, resolved: 0, persistent: 0 };
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
      if (changeType !== 'all' && item.change_type !== changeType) return;
      // Evaluate BOTH sides first so "introduced" and "resolved" remain
      // truthful even when the selected display scope is just one side.
      const fromAt = item.from_present ?
        findMatchIndex(item.from_text, query, caseSensitive, wholeWord) : -1;
      const toAt = item.to_present ?
        findMatchIndex(item.to_text, query, caseSensitive, wholeWord) : -1;
      const fromMatch = fromAt >= 0, toMatch = toAt >= 0;
      if (!fromMatch && !toMatch) return;
      if (sideFilter === 'earlier' && !fromMatch) return;
      if (sideFilter === 'later' && !toMatch) return;
      const matchTransition = fromMatch && toMatch ? 'persistent' :
        fromMatch ? 'resolved' : 'introduced';
      if (transition !== 'all' && transition !== matchTransition) return;
      matchedTransitions[matchTransition]++;
      matched++;
      fieldMatches++;
      // Match count spans the scanned scope, but memory holds only the
      // requested page. Earlier pages are never retained.
      if (matched <= matchOffset || results.length >= MAX_RESULTS) return;
      results.push({
        editor: field.id, editor_label: field.label,
        change_type: item.change_type, hunk_index: item.hunk_index,
        row_in_hunk: rowWithinHunk,
        hunk_page: Math.ceil(rowWithinHunk / PAGE_ROWS),
        match_side: fromMatch && toMatch ? 'both' :
          fromMatch ? 'earlier' : 'later',
        match_transition: matchTransition,
        from_line: item.from_line, to_line: item.to_line,
        from_present: item.from_present, to_present: item.to_present,
        from_preview: item.from_present ?
          matchingSnippet(item.from_text, fromAt) : '',
        to_preview: item.to_present ?
          matchingSnippet(item.to_text, toAt) : ''
      });
    });
    editors.push({
      id: field.id, alignment: aligned.strategy,
      total_changed_rows: aligned.rows, total_hunks: aligned.hunks,
      matching_scanned_rows: fieldMatches
    });
  }
  const totalPages = Math.max(1, Math.ceil(matched / MAX_RESULTS));
  if (matchPage > totalPages) {
    throw new RangeError('Match page ' + matchPage + ' does not exist. ' +
      'There are ' + totalPages + ' pages in the scanned search scope.');
  }
  return {
    format: 'json-diff-view-changed-line-search', version: 1,
    patch_not_executed: true, read_only: true, preview_only: true,
    from: { id: String(fromEntry.id), name: String(fromEntry.name) },
    to: { id: String(toEntry.id), name: String(toEntry.name) },
    query,
    filters: {
      editor: editorFilter, side: sideFilter,
      change_type: changeType, phrase_transition: transition,
      case_sensitive: caseSensitive, whole_word: wholeWord,
      word_definition: 'Unicode letters, numbers, marks and underscore'
    },
    window: {
      page: matchPage,
      total_pages: totalPages,
      page_size: MAX_RESULTS,
      first_match_index: results.length ? matchOffset + 1 : 0,
      last_match_index: matchOffset + results.length,
      has_previous_page: matchPage > 1,
      has_next_page: matchPage < totalPages
    },
    summary: {
      inspected_changed_rows: scanned,
      uninspected_changed_rows: skipped,
      incomplete: skipped > 0,
      matching_rows_in_inspected_scope: matched,
      matching_rows_by_transition: matchedTransitions,
      stored_results: results.length,
      omitted_matching_rows: matched - results.length,
      matches_outside_current_page: matched - results.length,
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
    'uninspected_changed_rows','preview_only','match_page','total_match_pages',
    'first_match_index','last_match_index','change_type_filter',
    'transition_filter','case_sensitive','whole_word','match_transition'
  ]];
  for (const x of report.results) rows.push([
    report.query,report.from.name,report.to.name,x.editor,report.filters.side,
    x.match_side,x.change_type,x.hunk_index,x.row_in_hunk,x.hunk_page,
    x.from_line ?? '',x.to_line ?? '',x.from_present,x.to_present,
    x.from_preview,x.to_preview,report.summary.incomplete,
    report.summary.uninspected_changed_rows,true,
    report.window.page,report.window.total_pages,
    report.window.first_match_index,report.window.last_match_index,
    report.filters.change_type,report.filters.phrase_transition,
    report.filters.case_sensitive,report.filters.whole_word,x.match_transition
  ]);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
