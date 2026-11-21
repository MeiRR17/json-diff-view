/**
 * Compare two saved verification evidence archives without executing a patch.
 *
 * Checkpoint changes are normalized by JSON path and change type, not array
 * position, so a newly recorded path does not make every following row look
 * modified. Repeated path/type rows are retained as arrays rather than lost.
 */
import { parseVerificationEvidence } from './evidence.js';
import { diffJson } from './diff.js';

function checkpointEntries(changes) {
  const byPath = Object.create(null);
  for (const row of changes) {
    // JSON paths can contain arbitrary property names; prefixing by type is
    // unambiguous because the type is restricted by the evidence parser.
    const key = row.type + ' @ ' + row.path;
    if (!Object.hasOwn(byPath, key)) byPath[key] = [];
    const value = {};
    if (Object.hasOwn(row, 'before')) value.before = row.before;
    if (Object.hasOwn(row, 'after')) value.after = row.after;
    byPath[key].push(value);
  }
  return byPath;
}
function normalizedEvidence(evidence) {
  const result = evidence.result;
  return {
    metadata: evidence.metadata,
    findings: {
      expected_operation_index: result.expectedIndex,
      full_prefix_failed_at_index: result.fullFailedAt,
      full_prefix_failed_at_expected: result.fullFailedAtExpected,
      isolated_operation_failed: result.isolatedFailed,
      recorded_reason_matches: result.recordedReasonMatches,
      checkpoint_matches: result.checkpointMatches,
      reproduced: result.reproduced
    },
    checkpoint: {
      counts: result.checkpointReport.counts,
      truncated: result.checkpointReport.truncated,
      differences_by_path_and_type: checkpointEntries(result.checkpointReport.changes)
    }
  };
}
function sameFailureCase(a, b) {
  return a.source === b.source &&
    a.failed_operation_index === b.failed_operation_index &&
    a.operation_type === b.operation_type &&
    a.operation_path === b.operation_path &&
    a.operation_from === b.operation_from;
}

export function compareVerificationArchives(baselineText, candidateText) {
  const baseline = parseVerificationEvidence(baselineText);
  const candidate = parseVerificationEvidence(candidateText);
  const report = diffJson(normalizedEvidence(baseline), normalizedEvidence(candidate));
  return {
    baseline: baseline.metadata,
    candidate: candidate.metadata,
    baselineReproduced: baseline.result.reproduced,
    candidateReproduced: candidate.result.reproduced,
    sameCase: sameFailureCase(baseline.metadata, candidate.metadata),
    report
  };
}
