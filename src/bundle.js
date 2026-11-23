/**
 * Portable, versioned JSON checkpoint bundle.
 *
 * Holds the exact two endpoint values and a generated RFC 6902 patch so the
 * base document and expected result travel together. Parsing never executes
 * the patch, writes to an editor, or accesses a network.
 */
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 8 * 1024 * 1024;
const MAX_OPERATIONS = 5000;
const encoder = new TextEncoder();

function limit(text, max, label) {
  if (encoder.encode(text).byteLength > max) {
    throw new RangeError(label + ' exceeds ' +
      (max / (1024 * 1024)) + ' MiB.');
  }
  return text;
}

function formatEditorJson(value, label) {
  const compact = JSON.stringify(value);
  // Parsed JSON cannot contain undefined at the root, but defend against
  // non-JSON callers rather than silently writing a corrupt bundle.
  if (compact === undefined) throw new TypeError(label + ' is not JSON-compatible.');
  const pretty = JSON.stringify(value, null, 2);
  if (encoder.encode(pretty).byteLength <= MAX_DOCUMENT_BYTES) return pretty;
  return limit(compact, MAX_DOCUMENT_BYTES, label);
}

function ordinaryObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function serializeCheckpointBundle(snapshot) {
  if (typeof snapshot.patch !== 'string') {
    throw new TypeError('A checkpoint patch must be generated before exporting a bundle.');
  }
  const patch = JSON.parse(limit(snapshot.patch, MAX_DOCUMENT_BYTES, 'Patch'));
  if (!Array.isArray(patch) || patch.length > MAX_OPERATIONS) {
    throw new RangeError('Bundle patch must contain at most 5,000 operations.');
  }
  const data = {
    format: 'json-diff-view-checkpoint-bundle',
    version: 1,
    source: snapshot.source,
    start_step: snapshot.start,
    end_step: snapshot.end,
    before: snapshot.before,
    after: snapshot.after,
    patch
  };
  // Exported endpoints must remain reusable in the app's 2 MiB editors.
  formatEditorJson(data.before, 'Starting checkpoint');
  formatEditorJson(data.after, 'Ending checkpoint');
  let serialized = JSON.stringify(data, null, 2) + '\n';
  if (encoder.encode(serialized).byteLength > MAX_BUNDLE_BYTES) {
    serialized = JSON.stringify(data) + '\n';
  }
  return limit(serialized, MAX_BUNDLE_BYTES, 'Checkpoint bundle');
}

export function parseCheckpointBundle(text) {
  limit(text, MAX_BUNDLE_BYTES, 'Checkpoint bundle file');
  const data = JSON.parse(text);
  if (!ordinaryObject(data) ||
      data.format !== 'json-diff-view-checkpoint-bundle' || data.version !== 1) {
    throw new TypeError('Unsupported checkpoint bundle format or version.');
  }
  if (data.source !== 'before' && data.source !== 'after') {
    throw new TypeError('Bundle source must be Before or After.');
  }
  if (!Number.isSafeInteger(data.start_step) ||
      !Number.isSafeInteger(data.end_step) ||
      data.start_step < 0 || data.start_step > data.end_step ||
      data.end_step > MAX_OPERATIONS) {
    throw new RangeError('Bundle checkpoint steps are invalid.');
  }
  if (!Object.hasOwn(data, 'before') || !Object.hasOwn(data, 'after') ||
      !Array.isArray(data.patch) || data.patch.length > MAX_OPERATIONS) {
    throw new TypeError('Bundle must contain start, end and a JSON Patch array.');
  }
  const beforeText = formatEditorJson(data.before, 'Starting checkpoint');
  const afterText = formatEditorJson(data.after, 'Ending checkpoint');
  const patchText = formatEditorJson(data.patch, 'JSON Patch');
  return {
    beforeText, afterText, patchText,
    source: data.source, start: data.start_step, end: data.end_step
  };
}
