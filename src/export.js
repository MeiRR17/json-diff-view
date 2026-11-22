/**
 * Serialize complete, recorded JSON diff and patch-impact reports.
 * UI filters/page navigation do not influence these exports.
 *
 * JSON preserves the native report structure, including the truncated flag.
 * CSV encodes before/after values as complete JSON strings and protects
 * spreadsheet applications from interpreting user-controlled cells as formulas.
 */

function formulaSafeCell(value) {
  const source = String(value);
  // A leading whitespace/control prefix can disguise an Excel/Sheets formula.
  // The apostrophe is part of the exported cell, not an executable formula.
  const escaped = /^[\u0000-\u0020\uFEFF]*[=+\-@]/u.test(source) ?
    "'" + source : source;
  return '"' + escaped.replaceAll('"', '""') + '"';
}

export function serializeReportJson(report, {
  format = 'json-diff-view-report',
  source
} = {}) {
  const payload = { format };
  if (source !== undefined) payload.source = source;
  payload.counts = report.counts;
  payload.truncated = report.truncated;
  payload.changes = report.changes;
  return JSON.stringify(payload, null, 2) + '\n';
}

/**
 * RFC 4180-style CSV: a single header, CRLF rows and UTF-8 BOM.
 * The source and truncation columns make partial reports explicit to readers.
 * Missing change values use empty cells; explicit JSON null is written "null".
 */
export function serializeReportCsv(report, { source = 'Before → After' } = {}) {
  const rows = [
    ['path', 'type', 'before_json', 'after_json', 'report_truncated', 'source']
  ];
  for (const change of report.changes) {
    rows.push([
      change.path,
      change.type,
      Object.hasOwn(change, 'before') ? JSON.stringify(change.before) : '',
      Object.hasOwn(change, 'after') ? JSON.stringify(change.after) : '',
      report.truncated ? 'true' : 'false',
      source
    ]);
  }
  return '\uFEFF' + rows.map(cells => cells.map(formulaSafeCell).join(',')).join('\r\n') + '\r\n';
}


/**
 * Counts-only structural diff export for sharing approximate change volume.
 * Does not include JSON paths, source values, patches or individual changes.
 * Counts reflect *recorded* changes only; a truncated comparison is labeled
 * as incomplete rather than presented as an exhaustive difference count.
 */
export function serializeReportCountsJson(report) {
  const keys = ['added', 'removed', 'changed'];
  if (!report || typeof report !== 'object' ||
      !Array.isArray(report.changes) || report.changes.length > 5000 ||
      !report.counts || typeof report.counts !== 'object' ||
      typeof report.truncated !== 'boolean' ||
      !keys.every(key => Number.isSafeInteger(report.counts[key]) &&
        report.counts[key] >= 0 && report.counts[key] <= 5000)) {
    throw new TypeError('Expected a bounded JSON difference report.');
  }
  const total = keys.reduce((sum, key) => sum + report.counts[key], 0);
  if (total !== report.changes.length) {
    throw new TypeError('JSON difference totals do not match the recorded changes.');
  }
  return JSON.stringify({
    format: 'json-diff-view-counts-v1',
    complete: !report.truncated,
    recordedChanges: total,
    counts: Object.fromEntries(keys.map(key => [key, report.counts[key]])),
    advisory: report.truncated
      ? 'Comparison was truncated. Counts represent only recorded changes and are lower bounds, not complete totals.'
      : 'Counts only; no source values, JSON paths, or patch operations. Aggregates can still reveal sensitive activity.',
  }, null, 2) + '\n';
}
