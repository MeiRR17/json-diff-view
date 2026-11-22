/**
 * Read-only comparison of two named manual snapshot workspace files.
 * Editor drafts are treated as raw strings, including incomplete JSON.
 * The line window is index-aligned after shared prefix/suffix removal;
 * this is not an LCS diff, a semantic JSON comparison or patch execution.
 */
import { parseWorkspace } from './workspace.js';

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
  const totalRows = Math.max(fromMiddle, toMiddle);
  const details = [];
  for (let i = 0; i < Math.min(MAX_PREVIEW_ROWS, totalRows); i++) {
    const hasFrom = i < fromMiddle, hasTo = i < toMiddle;
    const fromText = hasFrom ? left[prefix + i] : '';
    const toText = hasTo ? right[prefix + i] : '';
    details.push({
      section: id, kind: 'raw-line',
      field: label,
      from_line: hasFrom ? prefix + i + 1 : null,
      to_line: hasTo ? prefix + i + 1 : null,
      from_preview: hasFrom ? safePreview(fromText) : '',
      to_preview: hasTo ? safePreview(toText) : '',
      from_present: hasFrom,
      to_present: hasTo
    });
  }
  return {
    section: {
      id, label, kind: 'raw-text',
      changed: a !== b,
      from_bytes: byteCount(a), to_bytes: byteCount(b),
      from_lines: left.length, to_lines: right.length,
      shared_prefix_lines: prefix,
      shared_suffix_lines: suffix,
      from_middle_lines: fromMiddle,
      to_middle_lines: toMiddle,
      aligned_middle_rows: totalRows,
      shown_rows: details.length,
      omitted_rows: totalRows - details.length
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
    patch_not_executed: true,
    from: { id: String(fromEntry.id), name: fromEntry.name },
    to: { id: String(toEntry.id), name: toEntry.name },
    summary: {
      changed_sections: sections.filter(item => item.changed).length,
      total_sections: sections.length,
      changed_option_fields: changedOptions.length,
      recorded_preview_rows: details.length,
      omitted_middle_rows: sections.reduce((n,item)=>n + item.omitted_rows,0),
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
    'from_preview','to_preview','preview_only','omitted_middle_rows'
  ]];
  for (const item of report.details) {
    const section = report.sections.find(s => s.id === item.section);
    lines.push([
      report.from.name, report.to.name, item.section, item.kind, item.field,
      item.from_line ?? '', item.to_line ?? '', item.from_present,
      item.to_present, item.from_preview, item.to_preview, 'true',
      section.omitted_rows
    ]);
  }
  return '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
