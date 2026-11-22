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
  const alignment = alignRawLineChanges(left, right, prefix, suffix, line => {
    // Continue computing counts, but never retain unbounded draft contents.
    if (details.length >= MAX_PREVIEW_ROWS) return;
    details.push({
      section: id, kind: 'raw-line', field: label,
      change_type: line.change_type,
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
      change_type: 'changed',
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
    omitted_rows: 0
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
    'change_type','alignment_strategy','alignment_limited'
  ]];
  for (const item of report.details) {
    const section = report.sections.find(s => s.id === item.section);
    lines.push([
      report.from.name, report.to.name, item.section, item.kind, item.field,
      item.from_line ?? '', item.to_line ?? '', item.from_present,
      item.to_present, item.from_preview, item.to_preview, 'true',
      section.omitted_rows, item.change_type,
      section.alignment_strategy || 'settings', Boolean(section.alignment_limited)
    ]);
  }
  return '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
