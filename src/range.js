/**
 * Read-only comparison between two checkpoints in a JSON Patch execution.
 *
 * Step N means the state AFTER the first N RFC 6902 operations. To compare
 * steps A and B, replay the same source from scratch for both endpoints:
 * operations 1..A must have succeeded even when only A+1..B is displayed.
 * No source or patch objects are mutated.
 */
import { applyJsonPatchPrefix } from './apply.js';
import { diffJson } from './diff.js';

export function comparePatchRange(document, patch, start, end) {
  if (!Array.isArray(patch) || patch.length > 5000) {
    throw new RangeError('Expected a JSON Patch array with at most 5,000 operations.');
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || start > end || end > patch.length) {
    throw new RangeError('Choose integer steps from 0 to the patch length, with start ≤ end.');
  }
  // Replaying prefixes independently preserves source-anchored move/copy/test
  // semantics and the patch engine's safety and complexity constraints.
  const before = applyJsonPatchPrefix(document, patch, start);
  const after = applyJsonPatchPrefix(document, patch, end);
  return { before, after, report: diffJson(before, after) };
}
