/**
 * Export / import standalone, read-only JSON Patch verification evidence.
 *
 * The evidence contains recorded findings and bounded structural differences,
 * not executable patches, original documents or a claim of provenance.
 * Import is data-only: never replay, execute or modify editor contents.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_CHANGES = 5000;
const encoder = new TextEncoder();
const TYPES = new Set(['added', 'removed', 'changed']);

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function limitedString(value, maximum, label) {
  if (typeof value !== 'string' || value.length > maximum) {
    throw new TypeError(label + ' must be text of at most ' + maximum + ' characters.');
  }
  return value;
}
function validStep(value) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 5000;
}
function validateReport(report) {
  if (!record(report) || !record(report.counts) ||
      !Array.isArray(report.changes) || report.changes.length > MAX_CHANGES ||
      typeof report.truncated !== 'boolean') {
    throw new TypeError('Evidence needs a bounded structural checkpoint report.');
  }
  let total = 0;
  for (const key of TYPES) {
    const count = report.counts[key];
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_CHANGES) {
      throw new RangeError('Evidence change counts are invalid.');
    }
    total += count;
  }
  if (total !== report.changes.length) {
    throw new RangeError('Evidence change counts do not match recorded rows.');
  }
  for (const row of report.changes) {
    if (!record(row) || !TYPES.has(row.type) ||
        typeof row.path !== 'string' || row.path.length > 8192 ||
        !row.path.startsWith('$') ||
        (row.type !== 'added' && !Object.hasOwn(row, 'before')) ||
        (row.type !== 'removed' && !Object.hasOwn(row, 'after'))) {
      throw new TypeError('Malformed checkpoint difference row.');
    }
  }
  return report;
}
function validateVerdict(result) {
  if (!record(result) || !validStep(result.expectedIndex) ||
      !(result.fullFailedAt === null || validStep(result.fullFailedAt))) {
    throw new TypeError('Invalid expected/observed failed instruction index.');
  }
  for (const key of [
    'reproduced', 'checkpointMatches', 'checkpointTruncated',
    'fullFailedAtExpected', 'isolatedFailed', 'recordedReasonMatches'
  ]) {
    if (typeof result[key] !== 'boolean') {
      throw new TypeError('Invalid boolean verification finding: ' + key);
    }
  }
  const report = validateReport(result.checkpointReport);
  if (result.checkpointTruncated !== report.truncated ||
      result.checkpointMatches !==
        (report.changes.length === 0 && !report.truncated) ||
      result.reproduced !== (result.checkpointMatches &&
        result.fullFailedAtExpected && result.isolatedFailed) ||
      result.fullFailedAtExpected !==
        (result.fullFailedAt === result.expectedIndex)) {
    throw new TypeError('Evidence verdict contradicts its checkpoint or operation results.');
  }
  return result;
}
function serializeWithinLimit(payload) {
  let text = JSON.stringify(payload, null, 2) + '\n';
  if (encoder.encode(text).byteLength > MAX_BYTES) {
    text = JSON.stringify(payload) + '\n';
  }
  if (encoder.encode(text).byteLength > MAX_BYTES) {
    throw new RangeError('Verification evidence exceeds the 8 MiB limit.');
  }
  return text;
}
export function serializeVerificationEvidence(loaded, result) {
  validateVerdict(result);
  const original = JSON.parse(loaded.text);
  const operation = original.patch_through_failure?.[result.expectedIndex - 1];
  const detail = record(operation) ? operation : {};
  const metadata = {
    source: loaded.source,
    replay_mode: loaded.mode,
    failed_operation_index: result.expectedIndex,
    operation_type: typeof detail.op === 'string' ? detail.op.slice(0, 1024) : '(invalid)',
    operation_path: typeof detail.path === 'string' ? detail.path.slice(0, 8192) : '(missing)',
    operation_from: typeof detail.from === 'string' ? detail.from.slice(0, 8192) : null,
    recorded_reason: typeof original.reason === 'string' ?
      original.reason.slice(0, 16384) : ''
  };
  return serializeWithinLimit({
    format: 'json-diff-view-verification-evidence',
    version: 1,
    metadata,
    verification: result
  });
}
export function parseVerificationEvidence(text) {
  if (typeof text !== 'string' || encoder.encode(text).byteLength > MAX_BYTES) {
    throw new RangeError('Evidence file exceeds 8 MiB.');
  }
  const data = JSON.parse(text);
  if (!record(data) ||
      data.format !== 'json-diff-view-verification-evidence' || data.version !== 1 ||
      !record(data.metadata)) {
    throw new TypeError('Unsupported verification evidence format or version.');
  }
  const meta = data.metadata;
  if (!['before', 'after'].includes(meta.source) ||
      !['full', 'isolated'].includes(meta.replay_mode) ||
      !validStep(meta.failed_operation_index)) {
    throw new TypeError('Invalid evidence source, mode or failing operation.');
  }
  limitedString(meta.operation_type, 1024, 'Operation type');
  limitedString(meta.operation_path, 8192, 'Operation path');
  if (meta.operation_from !== null) {
    limitedString(meta.operation_from, 8192, 'Operation from');
  }
  limitedString(meta.recorded_reason, 16384, 'Recorded failure reason');
  const result = validateVerdict(data.verification);
  if (result.expectedIndex !== meta.failed_operation_index) {
    throw new TypeError('Evidence operation index does not match its verdict.');
  }
  return { metadata: meta, result };
}
