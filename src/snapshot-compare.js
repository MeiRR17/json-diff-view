/**
 * Read-only comparison of two named manual snapshot workspace files.
 * Editor drafts are treated as raw strings, including incomplete JSON.
 * Changed line regions use a bounded LCS alignment, with an explicit
 * positional fallback for large regions. Raw text is never interpreted
 * as JSON or executed as a patch.
 */
import { parseWorkspace } from './workspace.js';
import { alignRawLineChanges, MAX_LINE_LCS_CELLS,
  MAX_LINE_LCS_AXIS } from './line-diff.js';

const MAX_PREVIEW_ROWS = 180;
const MAX_LINE_PREVIEW = 240;
const MAX_HUNK_SUMMARIES = 48;
const encoder = new TextEncoder();
const EDITORS = [
  { key: 'beforeText', id: 'before', label: 'Before editor' },
  { key: 'afterText', id: 'after', label: 'After editor' },
  { key: 'patchText', id: 'patch', label: 'JSON Patch editor' }
];
const OPTIONS = [
  ['patchBase', 'Patch base'],
  ['patchDirection', 'Patch generation direction'],
  ['guardPatch', 'Guard generated patch'],
  ['guardRangePatch', 'Guard range patch'],
  ['rangeStart', 'Range start'],
  ['rangeEnd', 'Range end'],
  ['stepCount', 'Step count']
];

function safePreview(text) {
  return text.length <= MAX_LINE_PREVIEW ? text :
    text.slice(0, MAX_LINE_PREVIEW) + '… [line preview shortened]';
}
function byteCount(text) {
  return encoder.encode(text).byteLength;
}
function compareEditor(a, b, key, id, label) {
  const left = a.split('\n'), right = b.split('\n');
  const min = Math.min(left.length, right.length);
  let prefix = 0;
  while (prefix < min && left[prefix] === right[prefix]) prefix++;
  let suffix = 0;
  while (suffix < min - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix++;
  const fromMiddle = left.length - prefix - suffix;
  const toMiddle = right.length - prefix - suffix;
  const details = [];
  const hunkSummaries = [];
  const alignment = alignRawLineChanges(left, right, prefix, suffix, line => {
    // Retain metadata for at most 48 initial hunks. Counts for ALL hunks
    // remain available in the alignment result without storing their text.
    if (line.hunk_index <= MAX_HUNK_SUMMARIES) {
      if (hunkSummaries.length < line.hunk_index) hunkSummaries.push({
        index: line.hunk_index, total_rows: 0, preview_rows: 0,
        added: 0, removed: 0, changed: 0,
        from_start: null, from_end: null, to_start: null, to_end: null
      });
      const hunk = hunkSummaries[line.hunk_index - 1];
      hunk.total_rows++;
      hunk[line.change_type]++;
      if (line.from_line !== null) {
        if (hunk.from_start === null) hunk.from_start = line.from_line;
        hunk.from_end = line.from_line;
      }
      if (line.to_line !== null) {
        if (hunk.to_start === null) hunk.to_start = line.to_line;
        hunk.to_end = line.to_line;
      }
      if (details.length < MAX_PREVIEW_ROWS) hunk.preview_rows++;
    }
    // Continue computing counts, but never retain unbounded draft contents.
    if (details.length >= MAX_PREVIEW_ROWS) return;
    details.push({
      section: id, kind: 'raw-line', field: label,
      change_type: line.change_type, hunk_index: line.hunk_index,
      from_line: line.from_line,
      to_line: line.to_line,
      from_preview: line.from_present ? safePreview(line.from_text) : '',
      to_preview: line.to_present ? safePreview(line.to_text) : '',
      from_present: line.from_present,
      to_present: line.to_present
    });
  });
  return {
    section: {
      id, label, kind: 'raw-text',
      changed: a !== b,
      from_bytes: byteCount(a), to_bytes: byteCount(b),
      from_lines: left.length, to_lines: right.length,
      shared_prefix_lines: prefix, shared_suffix_lines: suffix,
      from_middle_lines: fromMiddle, to_middle_lines: toMiddle,
      alignment_strategy: alignment.strategy,
      alignment_limited: alignment.alignment_limited,
      hunk_count: alignment.hunks,
      hunk_summaries: hunkSummaries,
      omitted_hunk_summaries: alignment.hunks - hunkSummaries.length,
      added_rows: alignment.added,
      removed_rows: alignment.removed,
      changed_rows: alignment.changed,
      aligned_middle_rows: alignment.rows,
      shown_rows: details.length,
      omitted_rows: alignment.rows - details.length
    },
    details
  };
}
export function compareSnapshotWorkspaces(fromEntry, toEntry) {
  if (!fromEntry || !toEntry ||
      typeof fromEntry.content !== 'string' || typeof toEntry.content !== 'string' ||
      String(fromEntry.id) === String(toEntry.id)) {
    throw new TypeError('Select two different saved workspace snapshots.');
  }
  const before = parseWorkspace(fromEntry.content);
  const after = parseWorkspace(toEntry.content);
  const sections = [];
  const details = [];
  for (const item of EDITORS) {
    const comparison = compareEditor(before[item.key], after[item.key],
      item.key, item.id, item.label);
    sections.push(comparison.section);
    details.push(...comparison.details);
  }
  const changedOptions = OPTIONS.filter(([key]) => before[key] !== after[key]);
  for (const [key,label] of changedOptions) {
    details.push({
      section: 'settings', kind: 'option', field: label,
      change_type: 'changed', hunk_index: null,
      from_line: null, to_line: null,
      from_preview: String(before[key]), to_preview: String(after[key]),
      from_present: true, to_present: true
    });
  }
  sections.push({
    id: 'settings', label: 'Patch and range settings', kind: 'options',
    changed: changedOptions.length > 0,
    option_count: OPTIONS.length,
    changed_options: changedOptions.length,
    shown_rows: changedOptions.length,
    omitted_rows: 0,
    hunk_count: 0, hunk_summaries: [], omitted_hunk_summaries: 0
  });
  return {
    format: 'json-diff-view-snapshot-comparison',
    version: 1,
    archived_workspace_drafts: true,
    raw_line_alignment_not_semantic_diff: true,
    line_alignment: 'bounded-lcs-with-positional-fallback',
    patch_not_executed: true,
    from: { id: String(fromEntry.id), name: fromEntry.name },
    to: { id: String(toEntry.id), name: toEntry.name },
    summary: {
      changed_sections: sections.filter(item => item.changed).length,
      total_sections: sections.length,
      changed_option_fields: changedOptions.length,
      recorded_preview_rows: details.length,
      omitted_middle_rows: sections.reduce((n,item)=>n + item.omitted_rows,0),
      total_hunks: sections.reduce((n,item) => n + (item.hunk_count || 0),0),
      omitted_hunk_summaries: sections.reduce(
        (n,item) => n + (item.omitted_hunk_summaries || 0),0),
      max_hunk_summaries_per_editor: MAX_HUNK_SUMMARIES,
      lcs_editors: sections.filter(item => item.alignment_strategy === 'lcs').length,
      positional_fallback_editors: sections.filter(
        item => item.alignment_strategy === 'positional-fallback').length,
      added_lines: sections.reduce((n,item)=>n + (item.added_rows || 0),0),
      removed_lines: sections.reduce((n,item)=>n + (item.removed_rows || 0),0),
      changed_lines: sections.reduce((n,item)=>n + (item.changed_rows || 0),0),
      max_lcs_matrix_cells: MAX_LINE_LCS_CELLS,
      max_lcs_middle_lines_per_side: MAX_LINE_LCS_AXIS,
      max_preview_rows_per_editor: MAX_PREVIEW_ROWS,
      max_characters_per_line_preview: MAX_LINE_PREVIEW
    },
    sections,
    details
  };
}
function csvCell(value) {
  const plain = String(value == null ? '' : value);
  const safe = /^[\u0000-\u0020\uFEFF]*[=+\-@]/u.test(plain) ?
    "'" + plain : plain;
  return '"' + safe.replaceAll('"','""') + '"';
}
export function serializeSnapshotComparisonJson(report) {
  return JSON.stringify(report, null, 2) + '\n';
}
export function serializeSnapshotComparisonCsv(report) {
  const lines = [[
    'from_snapshot','to_snapshot','section','entry_kind','field',
    'from_line','to_line','from_present','to_present',
    'from_preview','to_preview','preview_only','omitted_middle_rows',
    'change_type','alignment_strategy','alignment_limited',
    'hunk_index','hunk_total_rows','hunk_preview_rows'
  ]];
  for (const item of report.details) {
    const section = report.sections.find(s => s.id === item.section);
    const hunk = section.hunk_summaries?.find(h => h.index === item.hunk_index);
    lines.push([
      report.from.name, report.to.name, item.section, item.kind, item.field,
      item.from_line ?? '', item.to_line ?? '', item.from_present,
      item.to_present, item.from_preview, item.to_preview, 'true',
      section.omitted_rows, item.change_type,
      section.alignment_strategy || 'settings', Boolean(section.alignment_limited),
      item.hunk_index ?? '', hunk?.total_rows ?? '', hunk?.preview_rows ?? ''
    ]);
  }
  return '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
