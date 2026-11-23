/**
 * Self-contained, private JSON Patch failure reproduction bundle.
 *
 * The source plus all operations through the first failing instruction
 * reproduce its original context. The last completed checkpoint plus the
 * single failed operation provide a smaller isolated reproduction.
 * This module only serializes data: it never executes any patch.
 */
import { applyJsonPatch, applyJsonPatchPrefix, JsonPatchOperationError } from './apply.js';
import { diffJson } from './diff.js';

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 8 * 1024 * 1024;
const MAX_OPERATIONS = 5000;
const encoder = new TextEncoder();

function jsonWithinLimit(value, label) {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') {
    throw new TypeError(label + ' is not a JSON value.');
  }
  if (encoder.encode(serialized).byteLength > MAX_INPUT_BYTES) {
    throw new RangeError(label + ' exceeds the 2 MiB editor limit.');
  }
  return serialized;
}

export function serializeFailureBundle({
  source, failedIndex, reason, sourceDocument, operationsToFailure, lastGood
}) {
  if (source !== 'before' && source !== 'after') {
    throw new TypeError('Unknown patch source.');
  }
  if (!Array.isArray(operationsToFailure) || operationsToFailure.length > MAX_OPERATIONS ||
      !Number.isSafeInteger(failedIndex) || failedIndex < 1 ||
      operationsToFailure.length !== failedIndex) {
    throw new RangeError('The bundle must contain exactly the operations through the failure.');
  }
  if (typeof reason !== 'string' || reason.length > 16_384) {
    throw new TypeError('A bounded failure explanation is required.');
  }

  jsonWithinLimit(sourceDocument, 'Original document');
  jsonWithinLimit(lastGood, 'Last successful checkpoint');
  jsonWithinLimit(operationsToFailure, 'Patch prefix');

  const data = {
    format: 'json-diff-view-failure-bundle',
    version: 1,
    source,
    failed_operation_index: failedIndex,
    completed_operations: failedIndex - 1,
    reason,
    original_document: sourceDocument,
    patch_through_failure: operationsToFailure,
    last_good_document: lastGood,
    isolated_patch: [operationsToFailure[failedIndex - 1]]
  };

  let result = JSON.stringify(data, null, 2) + '\n';
  if (encoder.encode(result).byteLength > MAX_BUNDLE_BYTES) {
    result = JSON.stringify(data) + '\n';
  }
  if (encoder.encode(result).byteLength > MAX_BUNDLE_BYTES) {
    throw new RangeError('Failure reproduction bundle exceeds 8 MiB.');
  }
  return result;
}

/**
 * Prepare a previously exported reproduction for manual, explicit preview.
 * Parsing and shape checks never replay operations or attest the failure
 * actually occurs; imported metadata and last-good JSON are untrusted.
 *
 * `full`: original JSON + operations 1..failedIndex.
 * `isolated`: last-good JSON + the single failed operation.
 */
export function parseFailureBundle(text, mode = 'isolated') {
  if (mode !== 'full' && mode !== 'isolated') {
    throw new TypeError('Select full-prefix or isolated-operation import.');
  }
  if (typeof text !== 'string' || encoder.encode(text).byteLength > MAX_BUNDLE_BYTES) {
    throw new RangeError('Failure bundle must be a JSON file under 8 MiB.');
  }
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.format !== 'json-diff-view-failure-bundle' || data.version !== 1) {
    throw new TypeError('Unsupported failure bundle format or version.');
  }
  if (data.source !== 'before' && data.source !== 'after') {
    throw new TypeError('Failure bundle source must be Before or After.');
  }
  const index = data.failed_operation_index;
  if (!Number.isSafeInteger(index) || index < 1 || index > MAX_OPERATIONS ||
      data.completed_operations !== index - 1) {
    throw new RangeError('Invalid failure index or completed-operation count.');
  }
  if (typeof data.reason !== 'string' || data.reason.length > 16_384) {
    throw new TypeError('Failure reason is missing or too long.');
  }
  if (!Object.hasOwn(data, 'original_document') ||
      !Object.hasOwn(data, 'last_good_document') ||
      !Array.isArray(data.patch_through_failure) ||
      data.patch_through_failure.length !== index ||
      !Array.isArray(data.isolated_patch) ||
      data.isolated_patch.length !== 1) {
    throw new TypeError('Failure bundle has missing or inconsistent reproduction data.');
  }
  const prefix = data.patch_through_failure;
  if (JSON.stringify(prefix[index - 1]) !== JSON.stringify(data.isolated_patch[0])) {
    throw new TypeError('Isolated operation differs from the final prefix operation.');
  }
  // Enforce import limits on the full recorded reproduction, even when the
  // user chooses the shorter isolated view.
  jsonWithinLimit(data.original_document, 'Original document');
  jsonWithinLimit(data.last_good_document, 'Last successful checkpoint');
  jsonWithinLimit(prefix, 'Patch prefix');
  jsonWithinLimit(data.isolated_patch, 'Isolated operation');

  const selectedDocument = mode === 'full' ?
    data.original_document : data.last_good_document;
  const selectedPatch = mode === 'full' ? prefix : data.isolated_patch;
  function readable(value, label) {
    const pretty = JSON.stringify(value, null, 2);
    if (encoder.encode(pretty).byteLength <= MAX_INPUT_BYTES) return pretty;
    return jsonWithinLimit(value, label);
  }
  return {
    source: data.source,
    mode,
    failedIndex: index,
    completed: index - 1,
    reason: data.reason,
    documentText: readable(selectedDocument, 'Imported source'),
    patchText: readable(selectedPatch, 'Imported patch')
  };
}

/**
 * Explicit, detached reproduction inspection for a previously imported
 * failure bundle. Unlike parseFailureBundle, this executes the recorded
 * prefix on a fresh copy. Call only from an intentional Verify user action.
 *
 * The stored explanation is informational; an exact message match is
 * reported separately from the semantic failure index and checkpoint state.
 */
export function verifyFailureBundle(text) {
  // Reject malformed/oversized imports before evaluating untrusted values.
  parseFailureBundle(text, 'full');
  const data = JSON.parse(text);
  const prefix = data.patch_through_failure;
  const index = data.failed_operation_index;

  // Reconstruct the last successful state from the ORIGINAL source rather
  // than trusting the checkpoint supplied in the imported file.
  const actualLastGood = applyJsonPatchPrefix(data.original_document, prefix, index - 1);
  const checkpointDiff = diffJson(actualLastGood, data.last_good_document);
  const checkpointMatches = checkpointDiff.changes.length === 0 &&
    !checkpointDiff.truncated;

  function attempt(document, operations) {
    try {
      applyJsonPatch(document, operations);
      return { failed: false, index: null, reason: null };
    } catch (error) {
      if (!(error instanceof JsonPatchOperationError)) {
        throw error; // Engine/resource errors are not successful verification.
      }
      return { failed: true, index: error.operationIndex, reason: error.message };
    }
  }

  const full = attempt(data.original_document, prefix);
  // Isolated replay deliberately uses the independently reconstructed
  // checkpoint. A tampered last_good_document cannot make it appear valid.
  const isolated = attempt(actualLastGood, [prefix[index - 1]]);
  const fullFailedAtExpected = full.failed && full.index === index;
  const isolatedFailed = isolated.failed && isolated.index === 1;
  const recordedReasonMatches = fullFailedAtExpected &&
    full.reason === data.reason;

  return {
    expectedIndex: index,
    checkpointMatches,
    checkpointDifferences: checkpointDiff.changes.length,
    checkpointTruncated: checkpointDiff.truncated,
    checkpointReport: checkpointDiff,
    fullFailedAtExpected,
    fullFailedAt: full.index,
    isolatedFailed,
    recordedReasonMatches,
    reproduced: checkpointMatches && fullFailedAtExpected && isolatedFailed
  };
}
