/**
 * Offline timeline of 2-10 saved verification evidence archives.
 * Files must be passed in explicit chronological order by their filename.
 * Supports consecutive-pair or fixed-first-baseline comparisons.
 * No patches are executed and no archived verdict is reverified.
 */
import { compareVerificationArchives } from './evidence-compare.js';
import { parseVerificationEvidence } from './evidence.js';

const MAX_ARCHIVES = 10;
const MAX_BYTES = 8 * 1024 * 1024;
const encoder = new TextEncoder();

function safeName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 255) {
    throw new TypeError('Evidence filename must be 1–255 characters.');
  }
  return name;
}
function validateArchive(item) {
  if (!item || typeof item.text !== 'string' ||
      encoder.encode(item.text).byteLength > MAX_BYTES) {
    throw new RangeError('Each evidence archive must be a JSON file within 8 MiB.');
  }
  safeName(item.name);
  return parseVerificationEvidence(item.text);
}
export function buildEvidenceHistory(archives, { mode = 'adjacent' } = {}) {
  if (mode !== 'adjacent' && mode !== 'baseline') {
    throw new TypeError('History mode must be adjacent or baseline.');
  }
  if (!Array.isArray(archives) ||
      archives.length < 2 || archives.length > MAX_ARCHIVES) {
    throw new RangeError('Select 2–10 saved evidence files.');
  }
  // Callers supply filename-sorted inputs; refuse accidental out-of-order
  // files, including identical names whose order would be ambiguous.
  for (let i = 1; i < archives.length; i++) {
    if (archives[i - 1].name >= archives[i].name) {
      throw new RangeError('Evidence filenames must be unique and sorted ascending.');
    }
  }
  const parsed = archives.map(validateArchive);
  const snapshots = parsed.map((archive, i) => ({
    file: archives[i].name,
    source: archive.metadata.source,
    failed_operation_index: archive.metadata.failed_operation_index,
    operation_type: archive.metadata.operation_type,
    operation_path: archive.metadata.operation_path,
    reproduced_claim: archive.result.reproduced,
    checkpoint_difference_count: archive.result.checkpointReport.changes.length,
    checkpoint_truncated: archive.result.checkpointReport.truncated
  }));
  const transitions = [];
  const classifications = Object.create(null);
  let differentCases = 0;
  let truncatedTransitions = 0;
  for (let i = 1; i < archives.length; i++) {
    const fromIndex = mode === 'baseline' ? 0 : i - 1;
    const comparison = compareVerificationArchives(
      archives[fromIndex].text, archives[i].text);
    const assessment = comparison.assessment;
    if (!assessment.sameCase) differentCases++;
    if (assessment.truncated) truncatedTransitions++;
    const name = assessment.classification;
    classifications[name] = (classifications[name] || 0) + 1;
    transitions.push({
      from_file: archives[fromIndex].name,
      to_file: archives[i].name,
      from_reproduced_claim: comparison.baselineReproduced,
      to_reproduced_claim: comparison.candidateReproduced,
      same_failure_identity: assessment.sameCase,
      classification: name,
      explanation: assessment.headline,
      differences: comparison.report.changes.length,
      truncated: assessment.truncated,
      changed_areas: assessment.recordedChanges
    });
  }
  return {
    format: 'json-diff-view-evidence-history',
    version: 1,
    archived_not_reverified: true,
    ordering: 'filename-ascending',
    comparison_mode: mode,
    baseline_file: archives[0].name,
    summary: {
      comparison_mode: mode,
      baseline_file: archives[0].name,
      archives: archives.length,
      transitions: transitions.length,
      reproduced_claims: snapshots.filter(x => x.reproduced_claim).length,
      different_failure_identities: differentCases,
      truncated_transitions: truncatedTransitions,
      classifications
    },
    snapshots,
    transitions
  };
}
function csvCell(value) {
  const plain = String(value);
  const safe = /^[\u0000-\u0020\uFEFF]*[=+\-@]/u.test(plain) ?
    "'" + plain : plain;
  return '"' + safe.replaceAll('"','""') + '"';
}
export function serializeEvidenceHistoryCsv(history) {
  const lines = [[
    'from_file','to_file','from_reproduced','to_reproduced',
    'same_failure_identity','classification','recorded_differences',
    'report_truncated','metadata_changes','finding_changes',
    'checkpoint_changes','other_changes','archived_not_reverified',
    'comparison_mode'
  ]];
  for (const t of history.transitions) {
    lines.push([
      t.from_file,t.to_file,t.from_reproduced_claim,t.to_reproduced_claim,
      t.same_failure_identity,t.classification,t.differences,t.truncated,
      t.changed_areas.metadata,t.changed_areas.findings,
      t.changed_areas.checkpoint,t.changed_areas.other,'true',
      history.comparison_mode
    ]);
  }
  return '\uFEFF' + lines.map(cells => cells.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
export function serializeEvidenceHistoryJson(history) {
  return JSON.stringify(history, null, 2) + '\n';
}
