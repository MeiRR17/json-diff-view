/**
 * On-demand bounded inspection of ANY numbered hunk, including those beyond
 * the initial per-editor 48 hunk summaries / 180 preview rows.
 *
 * The same pure aligner is re-run for the selected editor. It may visit
 * all changed rows to count hunks, but stores only 180 rows from the
 * requested 1-based page of the hunk. Optional context uses only aligned
 * equal-line pairs and shared prefix/suffix, at most 5 lines per side.
 * Context before the hunk is shown on page 1, after it on the last page.
 * Raw editor drafts are never parsed as JSON or executed.
 */
import { parseWorkspace } from './workspace.js';
import { alignRawLineChanges } from './line-diff.js';

const MAX_HUNK_ROWS = 180;
const MAX_PREVIEW_CHARS = 240;
const MAX_CONTEXT_LINES = 5;
const EDITORS = {
  before: { key: 'beforeText', label: 'Before editor' },
  after: { key: 'afterText', label: 'After editor' },
  patch: { key: 'patchText', label: 'JSON Patch editor (raw text)' }
};

function short(text) {
  return text.length > MAX_PREVIEW_CHARS ?
    text.slice(0, MAX_PREVIEW_CHARS) + '… [line preview shortened]' : text;
}
function validateEntry(entry) {
  if (!entry || typeof entry.content !== 'string' ||
      typeof entry.name !== 'string') {
    throw new TypeError('A valid saved or captured workspace is required.');
  }
  return parseWorkspace(entry.content);
}
export function inspectSnapshotHunk(
  fromEntry, toEntry, editorId, hunkIndex, contextLines = 3, page = 1
) {
  if (!Object.hasOwn(EDITORS, editorId)) {
    throw new TypeError('Choose a valid raw editor to inspect.');
  }
  if (!Number.isSafeInteger(hunkIndex) || hunkIndex < 1) {
    throw new RangeError('Hunk number must be a positive integer.');
  }
  if (!Number.isSafeInteger(contextLines) ||
      contextLines < 0 || contextLines > MAX_CONTEXT_LINES) {
    throw new RangeError('Context must be from 0 to 5 lines on each side.');
  }
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new RangeError('Hunk preview page must be a positive integer.');
  }
  if (!fromEntry || !toEntry || String(fromEntry.id) === String(toEntry.id)) {
    throw new TypeError('Choose two different workspaces.');
  }
  const before = validateEntry(fromEntry);
  const after = validateEntry(toEntry);
  const key = EDITORS[editorId].key;
  const left = before[key].split('\n');
  const right = after[key].split('\n');
  const min = Math.min(left.length, right.length);
  let prefix = 0;
  while (prefix < min && left[prefix] === right[prefix]) prefix++;
  let suffix = 0;
  while (suffix < min - prefix &&
      left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix++;
  const changedDetails = [];
  // The requested page offset counts *changed rows in this hunk*, not
  // original source line numbers. No earlier page's text is retained.
  const offset = (page - 1) * MAX_HUNK_ROWS;
  const beforeContext = [];
  const afterContext = [];
  const toContextRow = (fromLine, toLine, text) => ({
    hunk_index: hunkIndex, change_type: 'context',
    from_line: fromLine, to_line: toLine,
    from_present: true, to_present: true,
    from_preview: short(text), to_preview: short(text)
  });
  // Shared prefix/suffix lines are trimmed by the aligner. Recover their
  // immediate context separately when inspecting the first/last hunk.
  if (hunkIndex === 1) {
    for (let i = Math.max(0, prefix - contextLines); i < prefix; i++) {
      beforeContext.push(toContextRow(i + 1, i + 1, left[i]));
    }
  }
  const summary = {
    index: hunkIndex, total_rows: 0,
    added: 0, removed: 0, changed: 0,
    from_start: null, from_end: null,
    to_start: null, to_end: null,
    preview_rows: 0, omitted_rows: 0
  };
  const alignment = alignRawLineChanges(left, right, prefix, suffix, line => {
    if (line.hunk_index !== hunkIndex) return;
    const rowOffset = summary.total_rows++;
    summary[line.change_type]++;
    if (line.from_line !== null) {
      if (summary.from_start === null) summary.from_start = line.from_line;
      summary.from_end = line.from_line;
    }
    if (line.to_line !== null) {
      if (summary.to_start === null) summary.to_start = line.to_line;
      summary.to_end = line.to_line;
    }
    if (rowOffset < offset || rowOffset >= offset + MAX_HUNK_ROWS) return;
    changedDetails.push({
      hunk_index: hunkIndex,
      change_type: line.change_type,
      from_line: line.from_line,
      to_line: line.to_line,
      from_present: line.from_present,
      to_present: line.to_present,
      from_preview: line.from_present ? short(line.from_text) : '',
      to_preview: line.to_present ? short(line.to_text) : ''
    });
  }, matched => {
    if (!contextLines) return;
    const row = toContextRow(
      matched.from_line, matched.to_line, matched.text);
    if (matched.after_hunk_index === hunkIndex - 1) {
      // Rolling window: only the last N equal lines before this hunk.
      beforeContext.push(row);
      if (beforeContext.length > contextLines) beforeContext.shift();
    } else if (matched.after_hunk_index === hunkIndex &&
               afterContext.length < contextLines) {
      // First N equal lines immediately after this hunk.
      afterContext.push(row);
    }
  });
  if (hunkIndex > alignment.hunks) {
    throw new RangeError('Hunk ' + hunkIndex + ' does not exist for ' +
      EDITORS[editorId].label + '. The editor contains ' + alignment.hunks +
      ' change hunks.');
  }
  const totalPages = Math.max(1, Math.ceil(summary.total_rows / MAX_HUNK_ROWS));
  if (page > totalPages) {
    throw new RangeError('Page ' + page + ' does not exist for hunk ' +
      hunkIndex + '. There are ' + totalPages + ' pages of changed rows.');
  }
  if (contextLines && hunkIndex === alignment.hunks) {
    const start = left.length - suffix;
    for (let i = start;
      i < left.length && afterContext.length < contextLines; i++) {
      afterContext.push(toContextRow(
        i + 1, right.length - suffix + (i - start) + 1, left[i]));
    }
  }
  summary.preview_rows = changedDetails.length;
  summary.omitted_rows = summary.total_rows - changedDetails.length;
  // Equal-line context is adjacent to the whole hunk, not to arbitrary
  // interior page boundaries. Never falsely place it beside a middle page.
  const shownBefore = page === 1 ? beforeContext : [];
  const shownAfter = page === totalPages ? afterContext : [];
  const details = [...shownBefore, ...changedDetails, ...shownAfter];
  return {
    format: 'json-diff-view-hunk-inspection',
    version: 1,
    raw_text_only: true,
    patch_not_executed: true,
    from: { id: String(fromEntry.id), name: fromEntry.name },
    to: { id: String(toEntry.id), name: toEntry.name },
    editor: { id: editorId, label: EDITORS[editorId].label },
    alignment: {
      strategy: alignment.strategy,
      limited: alignment.alignment_limited,
      total_hunks: alignment.hunks,
      shared_prefix_lines: prefix,
      shared_suffix_lines: suffix
    },
    summary,
    window: {
      page,
      total_pages: totalPages,
      first_changed_row: offset + 1,
      last_changed_row: offset + changedDetails.length,
      has_previous_page: page > 1,
      has_next_page: page < totalPages
    },
    context: {
      requested_lines_each_side: contextLines,
      before_lines_shown: shownBefore.length,
      after_lines_shown: shownAfter.length,
      shown_on_boundary_pages_only: true
    },
    limits: {
      max_changed_preview_rows: MAX_HUNK_ROWS,
      max_context_lines_each_side: MAX_CONTEXT_LINES,
      max_characters_per_line: MAX_PREVIEW_CHARS
    },
    details
  };
}
function csvCell(value) {
  const plain = String(value == null ? '' : value);
  const safe = /^[\u0000-\u0020\uFEFF]*[=+\-@]/u.test(plain) ? "'" + plain : plain;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function serializeHunkInspectionJson(report) {
  return JSON.stringify(report, null, 2) + '\n';
}
export function serializeHunkInspectionCsv(report) {
  const header = [
    'from_workspace','to_workspace','editor','hunk_index',
    'alignment_strategy','alignment_limited','hunk_rows','omitted_rows',
    'change_type','from_line','to_line','from_present','to_present',
    'from_preview','to_preview','raw_preview_only','patch_not_executed',
    'context_lines_requested','context_before_rows','context_after_rows',
    'window_page','window_total_pages','window_first_changed_row',
    'window_last_changed_row'
  ];
  const rows = [header];
  for (const line of report.details) {
    rows.push([
      report.from.name, report.to.name, report.editor.id, report.summary.index,
      report.alignment.strategy, report.alignment.limited, report.summary.total_rows,
      report.summary.omitted_rows, line.change_type, line.from_line ?? '',
      line.to_line ?? '', line.from_present, line.to_present,
      line.from_preview, line.to_preview, true, true,
      report.context.requested_lines_each_side,
      report.context.before_lines_shown, report.context.after_lines_shown,
      report.window.page, report.window.total_pages,
      report.window.first_changed_row, report.window.last_changed_row
    ]);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
