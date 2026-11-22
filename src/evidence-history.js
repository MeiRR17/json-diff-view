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
const MAX_HOTSPOTS = 200;

/**
 * Group repeated evidence changes across transitions by normalized evidence
 * path. Checkpoint row subfield changes (before/after and array indices)
 * belong to the same source-path/type evidence entry, not separate hotspots.
 * These are reported archive paths, not proof of a live source mutation.
 */
function hotspotIdentity(path) {
  const prefix = '$.checkpoint.differences_by_path_and_type[';
  if (path.startsWith(prefix)) {
    const quoted = /^("(?:\\.|[^"\\])*")\]/u.exec(path.slice(prefix.length));
    if (quoted) {
      try {
        const checkpointKey = JSON.parse(quoted[1]);
        return { path: 'checkpoint row: ' + checkpointKey, scope: 'checkpoint' };
      } catch {
        // Fall through to the full normalized evidence report path.
      }
    }
  }
  let scope = 'other';
  if (path === '$.metadata' || path.startsWith('$.metadata.')) scope = 'metadata';
  if (path === '$.findings' || path.startsWith('$.findings.')) scope = 'findings';
  if (path === '$.checkpoint' || path.startsWith('$.checkpoint.')) scope = 'checkpoint';
  return { path, scope };
}
function recordHotspots(byPath, changes, transitionIndex, transition) {
  const seen = new Map();
  for (const change of changes) {
    const identity = hotspotIdentity(change.path);
    const key = identity.scope + ':' + identity.path;
    let entry = byPath.get(key);
    if (!entry) {
      entry = {
        path: identity.path,
        scope: identity.scope,
        affected_transitions: 0,
        recorded_occurrences: 0,
        first_transition: transitionIndex,
        last_transition: transitionIndex,
        example_report_path: change.path,
        transition_indexes: [],
        transition_details: []
      };
      byPath.set(key, entry);
    }
    entry.recorded_occurrences++;
    entry.last_transition = transitionIndex;
    entry.example_report_path = change.path;
    let hit = seen.get(key);
    if (!hit) {
      hit = {
        transition_index: transitionIndex,
        from_file: transition.from_file,
        to_file: transition.to_file,
        classification: transition.classification,
        same_failure_identity: transition.same_failure_identity,
        report_truncated: transition.report_truncated,
        occurrences: 0,
        example_report_path: change.path
      };
      seen.set(key, hit);
      entry.transition_details.push(hit);
      entry.affected_transitions++;
      entry.transition_indexes.push(transitionIndex);
    }
    hit.occurrences++;
    hit.example_report_path = change.path;
  }
}
function summarizeHotspots(byPath) {
  const all = [...byPath.values()].sort((a, b) =>
    b.affected_transitions - a.affected_transitions ||
    b.recorded_occurrences - a.recorded_occurrences ||
    (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  );
  return {
    total_recorded_paths: all.length,
    shown_paths: Math.min(MAX_HOTSPOTS, all.length),
    truncated: all.length > MAX_HOTSPOTS,
    paths: all.slice(0, MAX_HOTSPOTS)
  };
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
  const hotspotAccumulator = new Map();
  for (let i = 1; i < archives.length; i++) {
    const fromIndex = mode === 'baseline' ? 0 : i - 1;
    const comparison = compareVerificationArchives(
      archives[fromIndex].text, archives[i].text);
    const assessment = comparison.assessment;
    recordHotspots(hotspotAccumulator, comparison.report.changes, i, {
      from_file: archives[fromIndex].name,
      to_file: archives[i].name,
      classification: assessment.classification,
      same_failure_identity: assessment.sameCase,
      report_truncated: assessment.truncated
    });
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
    transitions,
    hotspots: summarizeHotspots(hotspotAccumulator)
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

/**
 * Portable timeline of one selected hotspot. Its rows represent recorded
 * archived comparisons only; it never materializes or executes JSON Patch.
 */
export function serializeEvidenceHotspotTimelineCsv(history, selected) {
  if (!history || !selected ||
      !history.hotspots?.paths.includes(selected)) {
    throw new TypeError('Select a hotspot in the current evidence history.');
  }
  const lines = [[
    'normalized_evidence_path', 'evidence_area', 'transition_number',
    'from_file', 'to_file', 'classification',
    'same_failure_identity', 'recorded_occurrences',
    'report_truncated', 'example_report_path',
    'comparison_mode', 'archived_not_reverified'
  ]];
  for (const detail of selected.transition_details) {
    lines.push([
      selected.path, selected.scope, detail.transition_index,
      detail.from_file, detail.to_file, detail.classification,
      detail.same_failure_identity, detail.occurrences,
      detail.report_truncated, detail.example_report_path,
      history.comparison_mode, 'true'
    ]);
  }
  return '\uFEFF' + lines.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
