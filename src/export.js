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
