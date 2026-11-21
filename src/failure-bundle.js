/**
 * Self-contained, private JSON Patch failure reproduction bundle.
 *
 * The source plus all operations through the first failing instruction
 * reproduce its original context. The last completed checkpoint plus the
 * single failed operation provide a smaller isolated reproduction.
 * This module only serializes data: it never executes any patch.
 */
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
