/**
 * Opt-in, read-only semantic JSON comparison of two saved editing snapshots.
 *
 * Unlike the always-available raw-text comparison, each editor is parsed
 * separately as a JSON value. Invalid or blank drafts are reported per editor
 * and do not prevent valid editors from being compared. JSON Patch text is
 * compared as JSON data, never applied or validated as executable operations.
 *
 * The structural engine has its own 5k-change / 100k-node / 200-depth caps.
 * Only bounded descriptions are kept for display/export, not full values.
 */
import { diffJson, parseJson } from './diff.js';
import { parseWorkspace } from './workspace.js';

const EDITORS = [
  { key: 'beforeText', id: 'before', label: 'Before editor' },
  { key: 'afterText', id: 'after', label: 'After editor' },
  { key: 'patchText', id: 'patch', label: 'JSON Patch editor (JSON data)' }
];
export const MAX_SEMANTIC_PREVIEW_ROWS = 250;
export const MAX_SEMANTIC_VALUE_CHARS = 240;
const MAX_PATH_CHARS = 300;
const MAX_ERROR_CHARS = 240;

function clipped(text, limit) {
  return text.length <= limit ? text :
    text.slice(0, limit) + '… [shortened]';
}
function valuePreview(value) {
  const serialized = JSON.stringify(value);
  return clipped(serialized === undefined ? '(unavailable)' : serialized,
    MAX_SEMANTIC_VALUE_CHARS);
}
function parseDraft(text, side) {
  if (!text.trim()) return { status: 'empty', value: null };
  try {
    return { status: 'valid', value: parseJson(text, side) };
  } catch (error) {
    return {
      status: 'invalid',
      error: clipped(error instanceof Error ? error.message : 'Invalid JSON',
        MAX_ERROR_CHARS)
    };
  }
}
function compareEditor(a, b, item) {
  const first = parseDraft(a, item.label + ' in earlier snapshot');
  const second = parseDraft(b, item.label + ' in later snapshot');
  const section = {
    id: item.id,
    label: item.label,
    earlier_status: first.status,
    later_status: second.status,
    status: 'unavailable',
    earlier_error: first.error ?? null,
    later_error: second.error ?? null,
    error: null,
    counts: { added: 0, removed: 0, changed: 0 },
    recorded_changes: 0,
    shown_rows: 0,
    omitted_rows: 0,
    report_truncated: false
  };
  if (first.status !== 'valid' || second.status !== 'valid') return { section, rows: [] };
  try {
    const report = diffJson(first.value, second.value);
    const rows = report.changes.slice(0, MAX_SEMANTIC_PREVIEW_ROWS).map(change => ({
      section: item.id,
      path: clipped(change.path, MAX_PATH_CHARS),
      path_truncated: change.path.length > MAX_PATH_CHARS,
      type: change.type,
      before_present: change.type !== 'added',
      after_present: change.type !== 'removed',
      before_preview: change.type === 'added' ? '' : valuePreview(change.before),
      after_preview: change.type === 'removed' ? '' : valuePreview(change.after)
    }));
    section.status = 'compared';
    section.counts = report.counts;
    section.recorded_changes = report.changes.length;
    section.shown_rows = rows.length;
    section.omitted_rows = report.changes.length - rows.length;
    section.report_truncated = report.truncated;
    return { section, rows };
  } catch (error) {
    section.status = 'limit';
    section.error = clipped(error instanceof Error ?
      error.message : 'Structural comparison unavailable', MAX_ERROR_CHARS);
    return { section, rows: [] };
  }
}
export function compareSnapshotJsonStructures(fromEntry, toEntry) {
  if (!fromEntry || !toEntry ||
      typeof fromEntry.content !== 'string' ||
      typeof toEntry.content !== 'string' ||
      String(fromEntry.id) === String(toEntry.id)) {
    throw new TypeError('Select two different saved workspace snapshots.');
  }
  const before = parseWorkspace(fromEntry.content);
  const after = parseWorkspace(toEntry.content);
  const sections = [], details = [];
  for (const item of EDITORS) {
    const result = compareEditor(before[item.key], after[item.key], item);
    sections.push(result.section);
    details.push(...result.rows);
  }
  return {
    format: 'json-diff-view-snapshot-structural-comparison',
    version: 1,
    archived_workspace_drafts: true,
    patch_not_executed: true,
    bounded_value_previews_only: true,
    from: { id: String(fromEntry.id), name: fromEntry.name },
    to: { id: String(toEntry.id), name: toEntry.name },
    summary: {
      editors_compared: sections.filter(s => s.status === 'compared').length,
      editors_unavailable: sections.filter(s => s.status !== 'compared').length,
      recorded_changes: sections.reduce((n,s) => n + s.recorded_changes,0),
      shown_rows: details.length,
      omitted_recorded_rows: sections.reduce((n,s) => n + s.omitted_rows,0),
      truncated_reports: sections.filter(s => s.report_truncated).length,
      max_preview_rows_per_editor: MAX_SEMANTIC_PREVIEW_ROWS,
      max_preview_characters_per_value: MAX_SEMANTIC_VALUE_CHARS,
      maximum_path_preview_characters: MAX_PATH_CHARS
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
export function serializeSnapshotStructuralJson(report) {
  return JSON.stringify(report, null, 2) + '\n';
}
export function serializeSnapshotStructuralCsv(report) {
  const lines = [[
    'earlier_snapshot','later_snapshot','editor','editor_status',
    'path_preview','path_truncated','change_type',
    'before_present','after_present','before_value_preview',
    'after_value_preview','recorded_changes','report_truncated',
    'omitted_recorded_rows','no_patch_executed'
  ]];
  for (const row of report.details) {
    const section = report.sections.find(s => s.id === row.section);
    lines.push([
      report.from.name,report.to.name,row.section,section.status,
      row.path,row.path_truncated,row.type,row.before_present,row.after_present,
      row.before_preview,row.after_preview,section.recorded_changes,
      section.report_truncated,section.omitted_rows,'true'
    ]);
  }
  return '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
