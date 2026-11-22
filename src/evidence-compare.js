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

/** Logical categories of differences in the normalized saved evidence. */
export function evidenceChangeScope(path) {
  if (path === '$.metadata' || path.startsWith('$.metadata.')) return 'metadata';
  if (path === '$.findings' || path.startsWith('$.findings.')) return 'findings';
  if (path === '$.checkpoint' || path.startsWith('$.checkpoint.')) return 'checkpoint';
  return 'other';
}

/**
 * Changes in recorded failure reproduction are descriptive, not proof of
 * either a regression or a fix. Different failure identities are never
 * treated as a comparable before/after history.
 */
function assessEvidenceDrift(baseline, candidate, sameCase, report) {
  const recordedChanges = { metadata: 0, findings: 0, checkpoint: 0, other: 0 };
  const changedFindingPaths = [];
  for (const change of report.changes) {
    const scope = evidenceChangeScope(change.path);
    recordedChanges[scope]++;
    if (scope === 'findings' && changedFindingPaths.length < 24) {
      changedFindingPaths.push(change.path);
    }
  }
  const beforeReproduced = baseline.result.reproduced;
  const afterReproduced = candidate.result.reproduced;
  let classification;
  let headline;
  if (!sameCase) {
    classification = 'different-failure-case';
    headline = 'Different failure identities; no direct regression conclusion.';
  } else if (!beforeReproduced && afterReproduced) {
    classification = 'newly-reproduced';
    headline = 'Candidate claims the failure now reproduces; review as a potential regression.';
  } else if (beforeReproduced && !afterReproduced) {
    classification = 'no-longer-reproduced';
    headline = 'Candidate no longer reproduces the failure; review as a potential fix.';
  } else if (recordedChanges.findings > 0) {
    classification = 'behavioral-drift';
    headline = 'The recorded failure checks changed without changing the overall reproduced status.';
  } else if (recordedChanges.checkpoint > 0) {
    classification = 'checkpoint-drift';
    headline = 'The checkpoint evidence changed while recorded failure outcomes stayed consistent.';
  } else if (recordedChanges.metadata > 0 || recordedChanges.other > 0) {
    classification = 'metadata-only';
    headline = 'Only descriptive metadata differs in the saved evidence.';
  } else {
    classification = 'unchanged';
    headline = 'No recorded evidence differences in the compared archives.';
  }
  return {
    classification,
    headline,
    beforeReproduced,
    afterReproduced,
    sameCase,
    recordedChanges,
    changedFindingPaths,
    truncated: report.truncated,
    archivedNotReverified: true
  };
}

export function compareVerificationArchives(baselineText, candidateText) {
  const baseline = parseVerificationEvidence(baselineText);
  const candidate = parseVerificationEvidence(candidateText);
  const report = diffJson(normalizedEvidence(baseline), normalizedEvidence(candidate));
  const sameCase = sameFailureCase(baseline.metadata, candidate.metadata);
  return {
    baseline: baseline.metadata,
    candidate: candidate.metadata,
    baselineReproduced: baseline.result.reproduced,
    candidateReproduced: candidate.result.reproduced,
    sameCase,
    assessment: assessEvidenceDrift(baseline, candidate, sameCase, report),
    report
  };
}
