import { diffJson, parseJson } from './diff.js';
import { createJsonPatch, serializeJsonPatch } from './patch.js';
import { applyJsonPatch, applyJsonPatchPrefix } from './apply.js';
import { serializeReportJson, serializeReportCsv } from './export.js';
import { inspectPatchOperations } from './inspect.js';
import { comparePatchRange } from './range.js';
import { serializeCheckpointBundle, parseCheckpointBundle } from './bundle.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PREVIEW_CHARS = 1200;
const PAGE_SIZE = 100;
const MAX_REPORT_EXPORT_BYTES = 8 * 1024 * 1024;

const beforeEditor = document.querySelector('#before');
const afterEditor = document.querySelector('#after');
const status = document.querySelector('#status');
const summary = document.querySelector('#summary');
const changeRows = document.querySelector('#changes');
const filterPath = document.querySelector('#filter-path');
const filterType = document.querySelector('#filter-type');
const clearFiltersButton = document.querySelector('#clear-filters');
const filterSummary = document.querySelector('#filter-summary');
const pageNavigation = document.querySelector('#results-nav');
const previousPageButton = document.querySelector('#page-previous');
const nextPageButton = document.querySelector('#page-next');
const pageSummary = document.querySelector('#page-summary');
const copyButton = document.querySelector('#copy');
const downloadReportJsonButton = document.querySelector('#download-report-json');
const downloadReportCsvButton = document.querySelector('#download-report-csv');
const copyPatchButton = document.querySelector('#copy-patch');
const downloadPatchButton = document.querySelector('#download-patch');
const guardPatchCheckbox = document.querySelector('#guard-patch');
const patchDirection = document.querySelector('#patch-direction');
const patchBase = document.querySelector('#patch-base');
const patchSource = document.querySelector('#patch-source');
const patchResult = document.querySelector('#patch-result');
const patchStatus = document.querySelector('#patch-status');
const useGeneratedButton = document.querySelector('#use-generated');
const importPatchButton = document.querySelector('#import-patch');
const patchFile = document.querySelector('#patch-file');
const sendResultButton = document.querySelector('#send-result');
const downloadResultButton = document.querySelector('#download-result');
const impactPanel = document.querySelector('#patch-impact');
const impactSummary = document.querySelector('#impact-summary');
const impactRows = document.querySelector('#impact-rows');
const impactFilterPath = document.querySelector('#impact-filter-path');
const impactFilterType = document.querySelector('#impact-filter-type');
const impactNav = document.querySelector('#impact-nav');
const impactPrevious = document.querySelector('#impact-previous');
const impactNext = document.querySelector('#impact-next');
const impactPageSummary = document.querySelector('#impact-page-summary');
const copyImpactButton = document.querySelector('#copy-impact');
const downloadImpactJsonButton = document.querySelector('#download-impact-json');
const downloadImpactCsvButton = document.querySelector('#download-impact-csv');
const inspectPatchButton = document.querySelector('#inspect-patch');
const inspectionPanel = document.querySelector('#patch-inspection');
const inspectionSummary = document.querySelector('#inspection-summary');
const inspectionRows = document.querySelector('#inspection-rows');
const inspectionType = document.querySelector('#inspection-type');
const inspectionPath = document.querySelector('#inspection-path');
const inspectionNav = document.querySelector('#inspection-nav');
const inspectionPrevious = document.querySelector('#inspection-previous');
const inspectionNext = document.querySelector('#inspection-next');
const inspectionPageSummary = document.querySelector('#inspection-page-summary');
const stepCountInput = document.querySelector('#patch-step-count');
const stepPreviewButton = document.querySelector('#patch-step-preview');
const stepPreviousButton = document.querySelector('#patch-step-previous');
const stepNextButton = document.querySelector('#patch-step-next');
const stepResultEditor = document.querySelector('#patch-step-result');
const stepStatus = document.querySelector('#patch-step-status');
const stepImpactPanel = document.querySelector('#patch-step-impact');
const stepImpactSummary = document.querySelector('#patch-step-impact-summary');
const stepImpactRows = document.querySelector('#patch-step-impact-rows');
const stepImpactNav = document.querySelector('#patch-step-impact-nav');
const stepImpactPrevious = document.querySelector('#patch-step-impact-previous');
const stepImpactNext = document.querySelector('#patch-step-impact-next');
const stepImpactPageSummary = document.querySelector('#patch-step-impact-page-summary');
const copyStepButton = document.querySelector('#copy-patch-step');
const downloadStepButton = document.querySelector('#download-patch-step');
const copyStepImpactButton = document.querySelector('#copy-step-impact');
const downloadStepImpactJsonButton = document.querySelector('#download-step-impact-json');
const downloadStepImpactCsvButton = document.querySelector('#download-step-impact-csv');
const rangeStartInput = document.querySelector('#range-start');
const rangeEndInput = document.querySelector('#range-end');
const rangePreviewButton = document.querySelector('#range-preview');
const rangeStatus = document.querySelector('#range-status');
const rangePanel = document.querySelector('#range-results');
const rangeSummary = document.querySelector('#range-summary');
const rangeRows = document.querySelector('#range-rows');
const rangeFilterPath = document.querySelector('#range-filter-path');
const rangeFilterType = document.querySelector('#range-filter-type');
const rangeNav = document.querySelector('#range-nav');
const rangePrevious = document.querySelector('#range-previous');
const rangeNext = document.querySelector('#range-next');
const rangePageSummary = document.querySelector('#range-page-summary');
const copyRangeButton = document.querySelector('#copy-range');
const downloadRangeJsonButton = document.querySelector('#download-range-json');
const downloadRangeCsvButton = document.querySelector('#download-range-csv');
const guardRangePatchCheckbox = document.querySelector('#range-guard-patch');
const rangePatchStatus = document.querySelector('#range-patch-status');
const copyRangePatchButton = document.querySelector('#copy-range-patch');
const downloadRangePatchButton = document.querySelector('#download-range-patch');
const copyRangeStartButton = document.querySelector('#copy-range-start');
const downloadRangeStartButton = document.querySelector('#download-range-start');
const copyRangeEndButton = document.querySelector('#copy-range-end');
const downloadRangeEndButton = document.querySelector('#download-range-end');
const downloadRangeBundleButton = document.querySelector('#download-range-bundle');
const importBundleButton = document.querySelector('#import-checkpoint-bundle');
const bundleFile = document.querySelector('#checkpoint-bundle-file');
const verifyExpectedButton = document.querySelector('#verify-expected');
const expectedPanel = document.querySelector('#expected-results');
const expectedStatus = document.querySelector('#expected-status');
const expectedSummary = document.querySelector('#expected-summary');
const expectedRows = document.querySelector('#expected-rows');
const expectedFilterPath = document.querySelector('#expected-filter-path');
const expectedFilterType = document.querySelector('#expected-filter-type');
const expectedNav = document.querySelector('#expected-nav');
const expectedPrevious = document.querySelector('#expected-previous');
const expectedNext = document.querySelector('#expected-next');
const expectedPageSummary = document.querySelector('#expected-page-summary');
const copyExpectedButton = document.querySelector('#copy-expected');
const downloadExpectedJsonButton = document.querySelector('#download-expected-json');
const downloadExpectedCsvButton = document.querySelector('#download-expected-csv');

let latestVerification = null;
let expectedPage = 0;
let latestReport = null;
let currentPage = 0;
let latestPatch = null;
let latestComparison = null;
let lastApplied = null;
let latestImpact = null;
let impactPage = 0;
let patchImportSequence = 0;
let bundleImportSequence = 0;
let latestInspection = null;
let inspectionPage = 0;
let latestStep = null;
let latestStepImpact = null;
let stepImpactPage = 0;
let latestRange = null;
let rangePage = 0;
const editorImportVersions = new WeakMap([[beforeEditor, 0], [afterEditor, 0]]);
function invalidateEditorImport(editor) {
  editorImportVersions.set(editor, editorImportVersions.get(editor) + 1);
}
function invalidateAllEditorImports() {
  invalidateEditorImport(beforeEditor);
  invalidateEditorImport(afterEditor);
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function fitInput(source, label) {
  const size = new TextEncoder().encode(source).byteLength;
  if (size > MAX_BYTES) {
    throw new RangeError(label + ' exceeds 2 MiB. Use a smaller document.');
  }
}

function displayValue(value, exists) {
  if (!exists) return '— not present —';
  const json = JSON.stringify(value, null, 2);
  if (json.length <= MAX_PREVIEW_CHARS) return json;
  return json.slice(0, MAX_PREVIEW_CHARS) + '\n… (preview shortened; copy report for full value)';
}

function cell(tag, text, className = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function renderChangeRows() {
  if (!latestReport) return;

  const pathNeedle = filterPath.value.trim().toLocaleLowerCase();
  const type = filterType.value;
  const allChanges = latestReport.changes;
  const matches = allChanges.filter(change =>
    (type === 'all' || change.type === type) &&
    (!pathNeedle || change.path.toLocaleLowerCase().includes(pathNeedle))
  );

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);

  clearFiltersButton.disabled = !filterPath.value && type === 'all';
  filterSummary.textContent = matches.length + ' of ' + allChanges.length +
    ' reported changes match the filters.' +
    (latestReport.truncated ? ' Report truncated at 5,000 changes.' : '');

  pageNavigation.hidden = matches.length <= PAGE_SIZE;
  previousPageButton.disabled = currentPage === 0;
  nextPageButton.disabled = currentPage >= pageCount - 1;
  pageSummary.textContent = 'Page ' + (currentPage + 1) + ' of ' + pageCount +
    ' (' + (matches.length ? start + 1 : 0) + '–' + (start + visible.length) +
    ' of ' + matches.length + ' matches)';

  if (!visible.length) {
    const row = document.createElement('tr');
    const message = cell('td', allChanges.length ?
      'No differences match your filters.' :
      'No differences. Both JSON documents contain the same values.', 'empty');
    message.colSpan = 3;
    row.append(message);
    changeRows.replaceChildren(row);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const change of visible) {
    const row = document.createElement('tr');
    row.className = change.type;

    const pathCell = document.createElement('td');
    pathCell.append(cell('span', change.type, 'tag'));
    pathCell.append(document.createElement('br'));
    pathCell.append(cell('span', change.path, 'path'));
    row.append(pathCell);

    const before = document.createElement('td');
    before.append(cell('pre', displayValue(change.before, change.type !== 'added')));
    const after = document.createElement('td');
    after.append(cell('pre', displayValue(change.after, change.type !== 'removed')));
    row.append(before, after);
    fragment.append(row);
  }
  changeRows.replaceChildren(fragment);
}

function renderReport(report) {
  summary.replaceChildren();
  summary.hidden = false;
  filterPath.disabled = false;
  filterType.disabled = false;

  for (const [label, n, cssClass] of [
    ['Added', report.counts.added, 'added'],
    ['Removed', report.counts.removed, 'removed'],
    ['Changed', report.counts.changed, 'changed']
  ]) {
    summary.append(cell('span', label + ': ' + n, 'pill ' + cssClass));
  }

  if (report.truncated) {
    summary.append(cell('span', 'Showing first 5,000 changes', 'pill'));
  }
  renderChangeRows();
}

// Two arbitrary sequential checkpoints (0..N), distinct from the
// one-operation step effect and full patch impact. Never mutates inputs.
function invalidateRange(message = 'Choose two steps to compare their cumulative effect.') {
  latestRange = null;
  rangePage = 0;
  rangePanel.hidden = true;
  rangeRows.replaceChildren();
  rangeSummary.textContent = '';
  rangeNav.hidden = true;
  rangeFilterPath.value = '';
  rangeFilterType.value = 'all';
  copyRangeButton.disabled = true;
  downloadRangeJsonButton.disabled = true;
  downloadRangeCsvButton.disabled = true;
  copyRangePatchButton.disabled = true;
  downloadRangePatchButton.disabled = true;
  copyRangeStartButton.disabled = true;
  downloadRangeStartButton.disabled = true;
  copyRangeEndButton.disabled = true;
  downloadRangeEndButton.disabled = true;
  downloadRangeBundleButton.disabled = true;
  rangePatchStatus.textContent = '';
  rangeMessage(message);
}
function rangeMessage(message, isError = false) {
  rangeStatus.textContent = message;
  rangeStatus.classList.toggle('error', isError);
}
function currentRange() {
  if (!latestRange || patchBase.value !== latestRange.source ||
      patchEditor(latestRange.source).value !== latestRange.sourceText ||
      patchSource.value !== latestRange.patchText ||
      String(rangeStartInput.value) !== String(latestRange.start) ||
      String(rangeEndInput.value) !== String(latestRange.end)) {
    invalidateRange();
    rangeMessage('Step-range comparison is stale. Compare the selected steps again.', true);
    return null;
  }
  return latestRange;
}
function rangeSource(snapshot) {
  return patchSideLabel(snapshot.source) + ': step ' +
    snapshot.start + ' → step ' + snapshot.end;
}
function serializeRangeCheckpoint(snapshot, endpoint) {
  const value = endpoint === 'start' ? snapshot.before : snapshot.after;
  const pretty = JSON.stringify(value, null, 2);
  try {
    fitInput(pretty, 'Checkpoint JSON');
    return pretty;
  } catch (error) {
    // Pretty printing can expand otherwise valid JSON beyond the 2 MiB
    // editor/import cap. Fall back to compact JSON rather than exporting an
    // unusable document.
    const compact = JSON.stringify(value);
    fitInput(compact, 'Checkpoint JSON');
    return compact;
  }
}
function rangeCheckpointFilename(snapshot, endpoint) {
  const number = endpoint === 'start' ? snapshot.start : snapshot.end;
  return 'patch-' + snapshot.source + '-checkpoint-step-' + number + '.json';
}
function enableRangeCheckpoints(enabled) {
  copyRangeStartButton.disabled = !enabled;
  downloadRangeStartButton.disabled = !enabled;
  copyRangeEndButton.disabled = !enabled;
  downloadRangeEndButton.disabled = !enabled;
}
async function copyRangeCheckpoint(endpoint) {
  const snapshot = currentRange();
  if (!snapshot) return;
  try {
    await navigator.clipboard.writeText(serializeRangeCheckpoint(snapshot, endpoint));
    rangeMessage('Checkpoint step ' +
      (endpoint === 'start' ? snapshot.start : snapshot.end) +
      ' copied as standalone JSON. No editor content changed.');
  } catch (error) {
    rangeMessage('Unable to copy checkpoint JSON: ' +
      (error instanceof Error ? error.message : 'clipboard unavailable'), true);
  }
}
function downloadRangeCheckpoint(endpoint) {
  const snapshot = currentRange();
  if (!snapshot) return;
  try {
    downloadReport(serializeRangeCheckpoint(snapshot, endpoint),
      rangeCheckpointFilename(snapshot, endpoint),
      'application/json;charset=utf-8');
    rangeMessage('Checkpoint step ' +
      (endpoint === 'start' ? snapshot.start : snapshot.end) +
      ' downloaded. Use the starting checkpoint as the base for a range patch.');
  } catch (error) {
    rangeMessage('Checkpoint download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
copyRangeStartButton.addEventListener('click', () => { void copyRangeCheckpoint('start'); });
downloadRangeStartButton.addEventListener('click', () => downloadRangeCheckpoint('start'));
copyRangeEndButton.addEventListener('click', () => { void copyRangeCheckpoint('end'); });
downloadRangeEndButton.addEventListener('click', () => downloadRangeCheckpoint('end'));

function refreshRangePatch() {
  copyRangePatchButton.disabled = true;
  downloadRangePatchButton.disabled = true;
  downloadRangeBundleButton.disabled = true;
  if (!latestRange) {
    rangePatchStatus.textContent = '';
    return;
  }
  latestRange.patch = null;
  try {
    // The patch is derived from endpoint values, not by slicing the input
    // instruction list. Intermediate changes that canceled out disappear.
    const generated = createJsonPatch(latestRange.before, latestRange.after, {
      guardChanges: guardRangePatchCheckbox.checked
    });
    const serialized = serializeJsonPatch(generated);
    fitInput(serialized, 'Generated checkpoint-range JSON Patch');
    latestRange.patch = serialized;
    copyRangePatchButton.disabled = false;
    downloadRangePatchButton.disabled = false;
    downloadRangeBundleButton.disabled = false;
    rangePatchStatus.textContent = (guardRangePatchCheckbox.checked ? 'Guarded' : 'Standard') +
      ' checkpoint patch available: ' + generated.length +
      ' operations. Apply it to the document at step ' + latestRange.start +
      ', not directly to the original source when the start is later than step 0.';
  } catch (error) {
    rangePatchStatus.textContent = 'Checkpoint patch unavailable: ' +
      (error instanceof Error ? error.message : 'could not generate patch') +
      '. The step-range difference report is still available.';
  }
}
guardRangePatchCheckbox.addEventListener('change', () => {
  if (!latestRange) return;
  if (!currentRange()) return;
  refreshRangePatch();
});
copyRangePatchButton.addEventListener('click', async () => {
  const snapshot = currentRange();
  if (!snapshot || !snapshot.patch) return;
  try {
    await navigator.clipboard.writeText(snapshot.patch);
    rangeMessage('Checkpoint-range JSON Patch copied. Its base is step ' +
      snapshot.start + ', not necessarily the original document.');
  } catch {
    rangeMessage('Unable to copy checkpoint-range patch. Check clipboard permissions.', true);
  }
});
downloadRangePatchButton.addEventListener('click', () => {
  const snapshot = currentRange();
  if (!snapshot || !snapshot.patch) return;
  try {
    downloadReport(snapshot.patch, 'patch-' + snapshot.source +
      '-range-' + snapshot.start + '-to-' + snapshot.end +
      (guardRangePatchCheckbox.checked ? '-guarded' : '') + '.jsonpatch',
    'application/json;charset=utf-8');
    rangeMessage('Checkpoint-range JSON Patch downloaded; apply to the step ' +
      snapshot.start + ' document.');
  } catch (error) {
    rangeMessage('Checkpoint patch download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
downloadRangeBundleButton.addEventListener('click', () => {
  const snapshot = currentRange();
  if (!snapshot || !snapshot.patch) return;
  try {
    const content = serializeCheckpointBundle(snapshot);
    downloadReport(content,
      'patch-' + snapshot.source + '-range-' +
        snapshot.start + '-to-' + snapshot.end + '-bundle.json',
      'application/json;charset=utf-8');
    rangeMessage('Checkpoint bundle downloaded with start JSON, end JSON and patch.');
  } catch (error) {
    rangeMessage('Bundle download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});

async function loadCheckpointBundle(file) {
  if (!file) return;
  // Competing document/patch imports or edits must invalidate this async
  // request; a newer bundle import supersedes an older one.
  const bundleRequest = ++bundleImportSequence;
  invalidateAllEditorImports();
  const beforeRequest = editorImportVersions.get(beforeEditor);
  const afterRequest = editorImportVersions.get(afterEditor);
  const patchRequest = ++patchImportSequence;
  const current = () => bundleRequest === bundleImportSequence &&
    beforeRequest === editorImportVersions.get(beforeEditor) &&
    afterRequest === editorImportVersions.get(afterEditor) &&
    patchRequest === patchImportSequence;
  if (file.size > MAX_REPORT_EXPORT_BYTES) {
    patchMessage('Checkpoint bundle exceeds the 8 MiB import limit.', true);
    return;
  }
  try {
    const contents = await file.text();
    if (!current()) return;
    const loaded = parseCheckpointBundle(contents);
    const overwrite = [
      [beforeEditor.value, loaded.beforeText],
      [afterEditor.value, loaded.afterText],
      [patchSource.value, loaded.patchText]
    ].some(([existing, incoming]) => existing.trim() && existing !== incoming);
    if (overwrite && !confirm(
      'Replace the Before, After and patch editors with the checkpoint bundle? ' +
      'No patch will be applied automatically.'
    )) return;
    if (!current()) return;
    // Commit all three editor assignments as one approved user action.
    invalidateAllEditorImports();
    patchImportSequence++;
    beforeEditor.value = loaded.beforeText;
    afterEditor.value = loaded.afterText;
    patchSource.value = loaded.patchText;
    patchBase.value = 'before';
    updateResultTarget();
    invalidateInspection();
    resetReport();
    compare();
    patchMessage('Checkpoint bundle loaded (original ' +
      patchSideLabel(loaded.source) + ', steps ' + loaded.start + '–' +
      loaded.end + '). Before is the patch base; After is the expected result. ' +
      'Choose Preview applying patch to run it explicitly.');
  } catch (error) {
    if (current()) {
      patchMessage('Checkpoint bundle import failed: ' +
        (error instanceof Error ? error.message : 'invalid bundle'), true);
    }
  }
}
importBundleButton.addEventListener('click', () => bundleFile.click());
bundleFile.addEventListener('change', event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) void loadCheckpointBundle(file);
});

function renderRange() {
  if (!latestRange) return;
  const { report, start, end } = latestRange;
  const type = rangeFilterType.value;
  const needle = rangeFilterPath.value.trim().toLocaleLowerCase();
  const matches = report.changes.filter(change =>
    (type === 'all' || change.type === type) &&
    (!needle || change.path.toLocaleLowerCase().includes(needle))
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  rangePage = Math.min(rangePage, pageCount - 1);
  const offset = rangePage * PAGE_SIZE;
  const visible = matches.slice(offset, offset + PAGE_SIZE);
  const counts = report.counts;
  rangePanel.hidden = false;
  rangeSummary.textContent = 'Step ' + start + ' → step ' + end + ': ' +
    counts.added + ' added, ' + counts.removed + ' removed, ' +
    counts.changed + ' changed. ' + matches.length + ' of ' +
    report.changes.length + ' recorded differences match.' +
    (report.truncated ? ' Report truncated at 5,000 differences.' : '');
  copyRangeButton.disabled = false;
  downloadRangeJsonButton.disabled = false;
  downloadRangeCsvButton.disabled = false;
  rangeNav.hidden = matches.length <= PAGE_SIZE;
  rangePrevious.disabled = rangePage === 0;
  rangeNext.disabled = rangePage >= pageCount - 1;
  rangePageSummary.textContent = 'Page ' + (rangePage + 1) + ' of ' + pageCount;

  const fragment = document.createDocumentFragment();
  if (!visible.length) {
    const row = document.createElement('tr');
    const item = cell('td', report.changes.length ?
      'No differences match the selected filters.' :
      'No net structural change between the selected steps.', 'empty');
    item.colSpan = 3;
    row.append(item);
    fragment.append(row);
  } else for (const change of visible) {
    const row = document.createElement('tr');
    row.className = change.type;
    const pathCell = document.createElement('td');
    pathCell.append(cell('span', change.type, 'tag'));
    pathCell.append(document.createElement('br'));
    pathCell.append(cell('span', change.path, 'path'));
    const fromCell = document.createElement('td');
    fromCell.append(cell('pre', displayValue(change.before, change.type !== 'added')));
    const toCell = document.createElement('td');
    toCell.append(cell('pre', displayValue(change.after, change.type !== 'removed')));
    row.append(pathCell, fromCell, toCell);
    fragment.append(row);
  }
  rangeRows.replaceChildren(fragment);
}
function previewRange() {
  invalidateRange();
  const source = patchBase.value;
  const sourceText = patchEditor(source).value;
  const patchText = patchSource.value;
  try {
    fitInput(sourceText, patchSideLabel(source));
    fitInput(patchText, 'Patch');
    if (rangeStartInput.value.trim() === '' || rangeEndInput.value.trim() === '') {
      throw new RangeError('Both step numbers are required.');
    }
    const start = Number(rangeStartInput.value);
    const end = Number(rangeEndInput.value);
    const document = parseJson(sourceText, patchSideLabel(source));
    const patch = parseJson(patchText, 'JSON Patch');
    const result = comparePatchRange(document, patch, start, end);
    // Both endpoints should fit within the application's document-size cap,
    // even when the recorded structural difference is much smaller.
    fitInput(JSON.stringify(result.before), 'Starting checkpoint');
    fitInput(JSON.stringify(result.after), 'Ending checkpoint');
    latestRange = {
      source, sourceText, patchText, start, end,
      before: result.before, after: result.after,
      report: result.report, patch: null
    };
    renderRange();
    enableRangeCheckpoints(true);
    refreshRangePatch();
    rangeMessage('Compared step ' + start + ' with step ' + end +
      ' on a detached copy of ' + patchSideLabel(source) +
      '. No editor content changed.' +
      (result.report.truncated ? ' Results are truncated.' : ''));
  } catch (error) {
    rangeMessage('Could not compare steps: ' +
      (error instanceof Error ? error.message : 'invalid patch'), true);
  }
}
rangePreviewButton.addEventListener('click', previewRange);
rangeStartInput.addEventListener('input', () => invalidateRange('Step range changed; compare again.'));
rangeEndInput.addEventListener('input', () => invalidateRange('Step range changed; compare again.'));
rangeFilterPath.addEventListener('input', () => { rangePage = 0; renderRange(); });
rangeFilterType.addEventListener('change', () => { rangePage = 0; renderRange(); });
rangePrevious.addEventListener('click', () => {
  if (!currentRange() || rangePage === 0) return;
  rangePage--;
  renderRange();
});
rangeNext.addEventListener('click', () => {
  if (!currentRange()) return;
  rangePage++;
  renderRange();
});
copyRangeButton.addEventListener('click', async () => {
  const snapshot = currentRange();
  if (!snapshot) return;
  try {
    await navigator.clipboard.writeText(serializeReportJson(snapshot.report, {
      format: 'json-diff-view-step-range',
      source: rangeSource(snapshot)
    }));
    rangeMessage('Full step-range report copied; filters do not affect the export.');
  } catch {
    rangeMessage('Could not copy step-range report. Check clipboard permissions.', true);
  }
});
function downloadRange(format) {
  const snapshot = currentRange();
  if (!snapshot) return;
  try {
    const csv = format === 'csv';
    const content = csv ?
      serializeReportCsv(snapshot.report, { source: rangeSource(snapshot) }) :
      serializeReportJson(snapshot.report, {
        format: 'json-diff-view-step-range',
        source: rangeSource(snapshot)
      });
    downloadReport(content,
      'patch-' + snapshot.source + '-range-' +
        snapshot.start + '-to-' + snapshot.end + '.' + format,
      csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    rangeMessage('Full step-range report downloaded as ' + format.toUpperCase() +
      (snapshot.report.truncated ? ' (truncated).' : '.'));
  } catch (error) {
    rangeMessage('Step-range download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
downloadRangeJsonButton.addEventListener('click', () => downloadRange('json'));
downloadRangeCsvButton.addEventListener('click', () => downloadRange('csv'));

function invalidateStepPreview(message = 'Select a step and preview the detached document.') {
  latestStep = null;
  copyStepButton.disabled = true;
  downloadStepButton.disabled = true;
  copyStepImpactButton.disabled = true;
  downloadStepImpactJsonButton.disabled = true;
  downloadStepImpactCsvButton.disabled = true;
  stepResultEditor.value = '';
  stepStatus.textContent = message;
  stepStatus.classList.remove('error');
  stepPreviousButton.disabled = true;
  stepNextButton.disabled = true;
  latestStepImpact = null;
  stepImpactPage = 0;
  stepImpactPanel.hidden = true;
  stepImpactRows.replaceChildren();
  stepImpactSummary.textContent = '';
  stepImpactNav.hidden = true;
}

function renderStepImpact() {
  if (!latestStepImpact) return;
  const { report, count } = latestStepImpact;
  const pages = Math.max(1, Math.ceil(report.changes.length / PAGE_SIZE));
  stepImpactPage = Math.min(stepImpactPage, pages - 1);
  const start = stepImpactPage * PAGE_SIZE;
  const visible = report.changes.slice(start, start + PAGE_SIZE);
  const counts = report.counts;

  stepImpactPanel.hidden = false;
  copyStepImpactButton.disabled = false;
  downloadStepImpactJsonButton.disabled = false;
  downloadStepImpactCsvButton.disabled = false;
  stepImpactSummary.textContent = count === 0 ?
    'Step 0: no operation executed, so there is no change.' :
    'Effect of operation ' + count + ': ' + counts.added + ' added, ' +
    counts.removed + ' removed, ' + counts.changed + ' changed.' +
    (report.truncated ? ' Showing only the first 5,000 differences.' : '');
  stepImpactNav.hidden = report.changes.length <= PAGE_SIZE;
  stepImpactPrevious.disabled = stepImpactPage === 0;
  stepImpactNext.disabled = stepImpactPage >= pages - 1;
  stepImpactPageSummary.textContent = 'Page ' + (stepImpactPage + 1) + ' of ' + pages;

  const fragment = document.createDocumentFragment();
  if (!visible.length) {
    const row = document.createElement('tr');
    const message = cell('td', 'No structural difference in this operation (for example a successful test).', 'empty');
    message.colSpan = 3;
    row.append(message);
    fragment.append(row);
  } else for (const change of visible) {
    const row = document.createElement('tr');
    row.className = change.type;
    const pathCell = document.createElement('td');
    pathCell.append(cell('span', change.type, 'tag'));
    pathCell.append(document.createElement('br'));
    pathCell.append(cell('span', change.path, 'path'));
    const beforeCell = document.createElement('td');
    beforeCell.append(cell('pre', displayValue(change.before, change.type !== 'added')));
    const afterCell = document.createElement('td');
    afterCell.append(cell('pre', displayValue(change.after, change.type !== 'removed')));
    row.append(pathCell, beforeCell, afterCell);
    fragment.append(row);
  }
  stepImpactRows.replaceChildren(fragment);
}
stepImpactPrevious.addEventListener('click', () => {
  if (!latestStepImpact || stepImpactPage === 0) return;
  stepImpactPage--;
  renderStepImpact();
});
stepImpactNext.addEventListener('click', () => {
  if (!latestStepImpact) return;
  stepImpactPage++;
  renderStepImpact();
});

function stepMessage(message, isError = false) {
  stepStatus.textContent = message;
  stepStatus.classList.toggle('error', isError);
}

function previewPatchStep(selectedCount) {
  // No state is committed to either JSON editor. A failed prefix never
  // displays a partially applied document.
  invalidateStepPreview();
  const source = patchBase.value;
  const sourceLabel = patchSideLabel(source);
  try {
    const sourceText = patchEditor(source).value;
    fitInput(sourceText, sourceLabel);
    fitInput(patchSource.value, 'Patch');
    const document = parseJson(sourceText, sourceLabel);
    const patch = parseJson(patchSource.value, 'JSON Patch');
    if (!Array.isArray(patch) || patch.length > 5000) {
      throw new RangeError('Expected a JSON Patch array with at most 5,000 operations.');
    }
    const inputValue = selectedCount === undefined ? stepCountInput.value : String(selectedCount);
    if (inputValue.trim() === '') {
      throw new RangeError('Specify the number of patch operations to preview.');
    }
    const count = Number(inputValue);
    if (!Number.isSafeInteger(count) || count < 0 || count > patch.length) {
      throw new RangeError('Choose an integer step from 0 to ' + patch.length + '.');
    }
    const outcome = applyJsonPatchPrefix(document, patch, count);
    const formatted = JSON.stringify(outcome, null, 2);
    fitInput(formatted, 'Step result');
    stepCountInput.max = String(patch.length);
    stepCountInput.value = String(count);
    stepResultEditor.value = formatted;
    latestStep = { source, sourceText, patchText: patchSource.value, count, json: formatted };
    copyStepButton.disabled = false;
    downloadStepButton.disabled = false;
    stepPreviousButton.disabled = count === 0;
    stepNextButton.disabled = count >= patch.length;
    const current = count === 0 ? 'Original document (no operations)' :
      'Step ' + count + ': ' + patch[count - 1].op +
      ' ' + (patch[count - 1].path || '(root)');

    // Compare the snapshots immediately before and after this one operation.
    // A complex structural comparison can be unavailable without losing the
    // valid intermediate document shown above.
    let impactNotice = '';
    try {
      const previous = count ? applyJsonPatchPrefix(document, patch, count - 1) : document;
      latestStepImpact = { report: diffJson(previous, outcome), count };
      renderStepImpact();
    } catch (impactError) {
      latestStepImpact = null;
      copyStepImpactButton.disabled = true;
      downloadStepImpactJsonButton.disabled = true;
      downloadStepImpactCsvButton.disabled = true;
      stepImpactPanel.hidden = false;
      stepImpactRows.replaceChildren();
      stepImpactNav.hidden = true;
      stepImpactSummary.textContent = 'Step effect unavailable: ' +
        (impactError instanceof Error ? impactError.message : 'comparison limit exceeded');
      impactNotice = ' Step effect details unavailable.';
    }
    stepMessage(current + '. Applied ' + count + ' of ' + patch.length +
      ' operations to a detached copy of ' + sourceLabel +
      '. No JSON editor was modified.' + impactNotice);
  } catch (error) {
    stepMessage('Cannot preview step: ' +
      (error instanceof Error ? error.message : 'invalid patch'), true);
  }
}

function currentStep() {
  if (!latestStep || patchBase.value !== latestStep.source ||
      patchEditor(latestStep.source).value !== latestStep.sourceText ||
      patchSource.value !== latestStep.patchText ||
      String(stepCountInput.value) !== String(latestStep.count)) {
    invalidateStepPreview();
    stepMessage('Step preview is stale. Preview the selected step again before exporting.', true);
    return null;
  }
  return latestStep;
}
function currentStepImpact() {
  const step = currentStep();
  if (!step) return null;
  if (!latestStepImpact || latestStepImpact.count !== step.count) {
    stepMessage('Step effect report is unavailable for this preview.', true);
    return null;
  }
  return { step, report: latestStepImpact.report };
}
function stepImpactSource(step) {
  const from = step.count === 0 ? 'initial source' : 'step ' + (step.count - 1);
  return patchSideLabel(step.source) + ': ' + from + ' → step ' + step.count;
}
copyStepButton.addEventListener('click', async () => {
  const step = currentStep();
  if (!step) return;
  try {
    await navigator.clipboard.writeText(step.json + '\n');
    stepMessage('Intermediate JSON after step ' + step.count + ' copied to clipboard.');
  } catch {
    stepMessage('Could not copy intermediate JSON. Check clipboard permissions.', true);
  }
});
downloadStepButton.addEventListener('click', () => {
  const step = currentStep();
  if (!step) return;
  try {
    downloadReport(step.json + '\n',
      'patch-' + step.source + '-step-' + step.count + '.json',
      'application/json;charset=utf-8');
    stepMessage('Intermediate JSON after step ' + step.count + ' downloaded.');
  } catch (error) {
    stepMessage('Step download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
copyStepImpactButton.addEventListener('click', async () => {
  const impact = currentStepImpact();
  if (!impact) return;
  try {
    await navigator.clipboard.writeText(serializeReportJson(impact.report, {
      format: 'json-diff-view-step-impact',
      source: stepImpactSource(impact.step)
    }));
    stepMessage('Complete effect of step ' + impact.step.count + ' copied.');
  } catch {
    stepMessage('Could not copy step effect. Check clipboard permissions.', true);
  }
});
function downloadStepImpact(format) {
  const impact = currentStepImpact();
  if (!impact) return;
  const { step, report } = impact;
  try {
    const csv = format === 'csv';
    const serialized = csv ?
      serializeReportCsv(report, { source: stepImpactSource(step) }) :
      serializeReportJson(report, {
        format: 'json-diff-view-step-impact',
        source: stepImpactSource(step)
      });
    downloadReport(serialized,
      'patch-' + step.source + '-step-' + step.count + '-impact.' + format,
      csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    stepMessage('Full effect of step ' + step.count + ' downloaded as ' +
      format.toUpperCase() + (report.truncated ? ' (report truncated).' : '.'));
  } catch (error) {
    stepMessage('Step impact download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
downloadStepImpactJsonButton.addEventListener('click', () => downloadStepImpact('json'));
downloadStepImpactCsvButton.addEventListener('click', () => downloadStepImpact('csv'));

stepPreviewButton.addEventListener('click', () => previewPatchStep());
stepPreviousButton.addEventListener('click', () => {
  const count = Number(stepCountInput.value);
  if (Number.isSafeInteger(count) && count > 0) previewPatchStep(count - 1);
});
stepNextButton.addEventListener('click', () => {
  const count = Number(stepCountInput.value);
  if (Number.isSafeInteger(count)) previewPatchStep(count + 1);
});
stepCountInput.addEventListener('input', () => invalidateStepPreview(
  'Step selection changed. Preview the selected prefix.'));

function invalidateInspection() {
  latestInspection = null;
  inspectionPage = 0;
  inspectionPanel.hidden = true;
  inspectionRows.replaceChildren();
  inspectionSummary.textContent = '';
  inspectionType.value = 'all';
  inspectionPath.value = '';
  inspectionNav.hidden = true;
}

function renderInspection() {
  if (!latestInspection) return;
  const { rows, counts, byOp } = latestInspection;
  const type = inspectionType.value;
  const needle = inspectionPath.value.trim().toLocaleLowerCase();
  const matches = rows.filter(row =>
    (type === 'all' || row.op === type) &&
    (!needle || row.path.toLocaleLowerCase().includes(needle) ||
      row.from.toLocaleLowerCase().includes(needle))
  );
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  inspectionPage = Math.min(inspectionPage, pages - 1);
  const start = inspectionPage * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  const operationTypes = Object.entries(byOp).map(([op, count]) => op + ': ' + count);
  inspectionPanel.hidden = false;
  inspectionSummary.textContent = counts.total + ' operations; ' +
    counts.warnings + ' basic-shape warnings. ' +
    matches.length + ' match the filters. ' + operationTypes.join(' · ') +
    '. No operations have been applied.';
  inspectionNav.hidden = matches.length <= PAGE_SIZE;
  inspectionPrevious.disabled = inspectionPage === 0;
  inspectionNext.disabled = inspectionPage >= pages - 1;
  inspectionPageSummary.textContent = 'Page ' + (inspectionPage + 1) + ' of ' + pages;

  const fragment = document.createDocumentFragment();
  if (!visible.length) {
    const row = document.createElement('tr');
    const message = cell('td', rows.length ?
      'No patch operations match your filters.' : 'The patch has no operations.', 'empty');
    message.colSpan = 7;
    row.append(message);
    fragment.append(row);
  } else for (const operation of visible) {
    const row = document.createElement('tr');
    if (operation.issues) row.className = 'inspection-warning';
    for (const value of [
      String(operation.index), operation.op, operation.path, operation.from || '—',
      operation.value, operation.issues || '—'
    ]) {
      row.append(cell('td', value));
    }
    const actionCell = document.createElement('td');
    const action = cell('button', 'View step', 'button subtle inspection-step-button');
    action.type = 'button';
    action.setAttribute('aria-label', 'Preview document after operation ' + operation.index);
    action.addEventListener('click', () => {
      previewPatchStep(operation.index);
      document.querySelector('#patch-step-heading').scrollIntoView({
        behavior: 'smooth', block: 'start'
      });
    });
    actionCell.append(action);
    row.append(actionCell);
    fragment.append(row);
  }
  inspectionRows.replaceChildren(fragment);
}
function refreshInspectionFilters() {
  inspectionPage = 0;
  renderInspection();
}
inspectionType.addEventListener('change', refreshInspectionFilters);
inspectionPath.addEventListener('input', refreshInspectionFilters);
inspectionPrevious.addEventListener('click', () => {
  if (!latestInspection || inspectionPage === 0) return;
  inspectionPage--;
  renderInspection();
});
inspectionNext.addEventListener('click', () => {
  if (!latestInspection) return;
  inspectionPage++;
  renderInspection();
});
inspectPatchButton.addEventListener('click', () => {
  invalidateInspection();
  try {
    fitInput(patchSource.value, 'Patch');
    const instructions = parseJson(patchSource.value, 'JSON Patch');
    latestInspection = inspectPatchOperations(instructions);
    renderInspection();
    patchMessage('Patch operations inspected without applying them. This is not an execution check.');
  } catch (error) {
    patchMessage('Cannot inspect patch: ' +
      (error instanceof Error ? error.message : 'invalid patch'), true);
  }
});

// This review is only available after the user explicitly creates a detached
// patch preview. It never applies an imported patch or writes to either editor.
function invalidateExpectedReview() {
  latestVerification = null;
  expectedPage = 0;
  verifyExpectedButton.disabled = true;
  expectedPanel.hidden = true;
  expectedStatus.textContent = 'Preview the patch before comparing its result with the opposite editor.';
  expectedStatus.classList.remove('error');
  expectedSummary.textContent = '';
  expectedRows.replaceChildren();
  expectedNav.hidden = true;
  expectedFilterPath.value = '';
  expectedFilterType.value = 'all';
  copyExpectedButton.disabled = true;
  downloadExpectedJsonButton.disabled = true;
  downloadExpectedCsvButton.disabled = true;
}
function expectedMessage(message, isError = false) {
  expectedStatus.textContent = message;
  expectedStatus.classList.toggle('error', isError);
}
function expectedTarget(source) {
  return source === 'before' ? 'after' : 'before';
}
function currentExpectedReview() {
  if (!latestVerification || !previewIsCurrent() ||
      patchEditor(expectedTarget(latestVerification.source)).value !==
        latestVerification.expectedText ||
      lastApplied.json !== latestVerification.resultText) {
    latestVerification = null;
    expectedPanel.hidden = true;
    copyExpectedButton.disabled = true;
    downloadExpectedJsonButton.disabled = true;
    downloadExpectedCsvButton.disabled = true;
    expectedMessage('The source, patch, or expected document has changed. Compare again.', true);
    return null;
  }
  return latestVerification;
}
function expectedReportSource(review) {
  return 'Patch result from ' + patchSideLabel(review.source) +
    ' → expected ' + patchSideLabel(expectedTarget(review.source));
}
function renderExpectedReview() {
  if (!latestVerification) return;
  const { report, source } = latestVerification;
  const needle = expectedFilterPath.value.trim().toLocaleLowerCase();
  const type = expectedFilterType.value;
  const matches = report.changes.filter(change =>
    (type === 'all' || change.type === type) &&
    (!needle || change.path.toLocaleLowerCase().includes(needle))
  );
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  expectedPage = Math.min(expectedPage, pages - 1);
  const start = expectedPage * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  const counts = report.counts;
  expectedPanel.hidden = false;
  const matchesExpected = report.changes.length === 0 && !report.truncated;
  expectedSummary.textContent = matchesExpected ?
    'MATCH: The detached patch result equals the ' +
      patchSideLabel(expectedTarget(source)) + ' document structurally.' :
    'MISMATCH: ' + counts.added + ' expected additions, ' +
      counts.removed + ' unexpected result values, ' +
      counts.changed + ' different values. ' +
      matches.length + ' of ' + report.changes.length +
      ' recorded differences match the filters.' +
      (report.truncated ? ' Report truncated at 5,000 differences.' : '');
  copyExpectedButton.disabled = false;
  downloadExpectedJsonButton.disabled = false;
  downloadExpectedCsvButton.disabled = false;
  expectedNav.hidden = matches.length <= PAGE_SIZE;
  expectedPrevious.disabled = expectedPage === 0;
  expectedNext.disabled = expectedPage >= pages - 1;
  expectedPageSummary.textContent = 'Page ' + (expectedPage + 1) + ' of ' + pages;
  const fragment = document.createDocumentFragment();
  if (!visible.length) {
    const row = document.createElement('tr');
    const message = cell('td', report.changes.length ?
      'No recorded differences match these filters.' :
      'No structural differences: the patch result matches the expected document.', 'empty');
    message.colSpan = 3;
    row.append(message);
    fragment.append(row);
  } else for (const change of visible) {
    const row = document.createElement('tr');
    row.className = change.type;
    const pathCell = document.createElement('td');
    pathCell.append(cell('span', change.type, 'tag'));
    pathCell.append(document.createElement('br'));
    pathCell.append(cell('span', change.path, 'path'));
    const actualCell = document.createElement('td');
    actualCell.append(cell('pre', displayValue(change.before, change.type !== 'added')));
    const expectedCell = document.createElement('td');
    expectedCell.append(cell('pre', displayValue(change.after, change.type !== 'removed')));
    row.append(pathCell, actualCell, expectedCell);
    fragment.append(row);
  }
  expectedRows.replaceChildren(fragment);
}
verifyExpectedButton.addEventListener('click', () => {
  latestVerification = null;
  expectedPanel.hidden = true;
  copyExpectedButton.disabled = true;
  downloadExpectedJsonButton.disabled = true;
  downloadExpectedCsvButton.disabled = true;
  if (!previewIsCurrent()) {
    invalidatePatchResult();
    expectedMessage('Preview is stale. Apply the patch to a detached copy again.', true);
    return;
  }
  const source = lastApplied.source;
  const target = expectedTarget(source);
  const expectedText = patchEditor(target).value;
  try {
    fitInput(expectedText, patchSideLabel(target));
    const expectedValue = parseJson(expectedText, patchSideLabel(target));
    const actualValue = parseJson(lastApplied.json, 'Detached patch result');
    const report = diffJson(actualValue, expectedValue);
    latestVerification = {
      source,
      expectedText,
      resultText: lastApplied.json,
      report
    };
    expectedPage = 0;
    expectedFilterPath.value = '';
    expectedFilterType.value = 'all';
    renderExpectedReview();
    expectedMessage(report.changes.length === 0 && !report.truncated ?
      'The patch result matches the opposite editor. No editor was changed.' :
      'The patch result differs from the opposite editor. Inspect the recorded differences below.');
  } catch (error) {
    expectedMessage('Could not compare expected result: ' +
      (error instanceof Error ? error.message : 'comparison unavailable'), true);
  }
});
expectedFilterPath.addEventListener('input', () => {
  expectedPage = 0;
  if (currentExpectedReview()) renderExpectedReview();
});
expectedFilterType.addEventListener('change', () => {
  expectedPage = 0;
  if (currentExpectedReview()) renderExpectedReview();
});
expectedPrevious.addEventListener('click', () => {
  if (!currentExpectedReview() || expectedPage === 0) return;
  expectedPage--;
  renderExpectedReview();
});
expectedNext.addEventListener('click', () => {
  if (!currentExpectedReview()) return;
  expectedPage++;
  renderExpectedReview();
});
copyExpectedButton.addEventListener('click', async () => {
  const review = currentExpectedReview();
  if (!review) return;
  try {
    await navigator.clipboard.writeText(serializeReportJson(review.report, {
      format: 'json-diff-view-expected-result',
      source: expectedReportSource(review)
    }));
    expectedMessage('Full expected-result comparison copied; filters do not affect exports.');
  } catch {
    expectedMessage('Clipboard access failed. Use a JSON or CSV download.', true);
  }
});
function downloadExpectedReport(format) {
  const review = currentExpectedReview();
  if (!review) return;
  try {
    const csv = format === 'csv';
    const content = csv ?
      serializeReportCsv(review.report, { source: expectedReportSource(review) }) :
      serializeReportJson(review.report, {
        format: 'json-diff-view-expected-result',
        source: expectedReportSource(review)
      });
    downloadReport(content,
      'patch-' + review.source + '-expected-result.' + format,
      csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    expectedMessage('Full expected-result comparison downloaded as ' +
      format.toUpperCase() +
      (review.report.truncated ? ' (truncated at 5,000 differences).' : '.'));
  } catch (error) {
    expectedMessage('Expected-result report download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
downloadExpectedJsonButton.addEventListener('click', () => downloadExpectedReport('json'));
downloadExpectedCsvButton.addEventListener('click', () => downloadExpectedReport('csv'));

function invalidatePatchResult() {
  invalidateExpectedReview();
  lastApplied = null;
  patchResult.value = '';
  sendResultButton.disabled = true;
  downloadResultButton.disabled = true;
  latestImpact = null;
  impactPage = 0;
  impactPanel.hidden = true;
  impactRows.replaceChildren();
  impactSummary.textContent = '';
  impactFilterPath.value = '';
  impactFilterType.value = 'all';
  impactNav.hidden = true;
  copyImpactButton.disabled = true;
  downloadImpactJsonButton.disabled = true;
  downloadImpactCsvButton.disabled = true;
}
function resetReport() {
  invalidatePatchResult();
  invalidateStepPreview();
  invalidateRange();
  currentPage = 0;
  filterPath.value = '';
  filterType.value = 'all';
  filterPath.disabled = true;
  filterType.disabled = true;
  clearFiltersButton.disabled = true;
  filterSummary.textContent = 'Compare documents to filter changes.';
  pageNavigation.hidden = true;
  useGeneratedButton.disabled = true;
  latestReport = null;
  latestPatch = null;
  latestComparison = null;
  copyButton.disabled = true;
  downloadReportJsonButton.disabled = true;
  downloadReportCsvButton.disabled = true;
  copyPatchButton.disabled = downloadPatchButton.disabled = true;
  summary.hidden = true;
  summary.replaceChildren();
  const row = document.createElement('tr');
  const message = cell('td', 'Differences will appear here.', 'empty');
  message.colSpan = 3;
  row.append(message);
  changeRows.replaceChildren(row);
}

function refreshGeneratedPatch() {
  latestPatch = null;
  copyPatchButton.disabled = true;
  downloadPatchButton.disabled = true;
  useGeneratedButton.disabled = true;
  summary.querySelector('#patch-count')?.remove();
  if (!latestComparison) return '';

  const indicator = cell('span', '', 'pill');
  indicator.id = 'patch-count';
  summary.append(indicator);
  try {
    const guarded = guardPatchCheckbox.checked;
    const reverse = patchDirection.value === 'reverse';
    // Generate reverse operations from the two actual documents, rather than
    // trying to invert operations that may have lost their previous values.
    const operations = createJsonPatch(
      reverse ? latestComparison.after : latestComparison.before,
      reverse ? latestComparison.before : latestComparison.after,
      { guardChanges: guarded }
    );
    // Keep generated downloads compatible with the editor's 2 MiB import
    // limit, including guard values that might make the output much larger.
    fitInput(serializeJsonPatch(operations), 'Generated JSON Patch');
    latestPatch = operations;
    copyPatchButton.disabled = false;
    downloadPatchButton.disabled = false;
    useGeneratedButton.disabled = false;
    indicator.textContent = (guarded ? 'Guarded' : 'Standard') +
      ' ' + (reverse ? 'After → Before' : 'Before → After') +
      ' JSON Patch: ' + operations.length + ' operations';
    return '';
  } catch (error) {
    indicator.textContent = 'JSON Patch unavailable';
    return ' Patch unavailable: ' +
      (error instanceof Error ? error.message : 'could not generate patch');
  }
}

function compare() {
  invalidatePatchResult();
  invalidateStepPreview();
  invalidateRange();
  useGeneratedButton.disabled = true;
  try {
    fitInput(beforeEditor.value, 'Before');
    fitInput(afterEditor.value, 'After');
    const left = parseJson(beforeEditor.value, 'Before');
    const right = parseJson(afterEditor.value, 'After');
    const report = diffJson(left, right);
    latestReport = report;
    renderReport(report);
    copyButton.disabled = false;
    downloadReportJsonButton.disabled = false;
    downloadReportCsvButton.disabled = false;

    latestComparison = { before: left, after: right };
    const patchStatus = refreshGeneratedPatch();
    const count = report.changes.length;
    setStatus(
      (count === 0 ? 'Comparison complete: no differences.' :
      'Comparison complete: ' + count + ' difference' + (count === 1 ? '' : 's') +
      (report.truncated ? ' shown (report truncated).' : '.')) + patchStatus
    );
  } catch (error) {
    resetReport();
    setStatus(error instanceof Error ? error.message : 'Could not compare JSON.', true);
  }
}

async function importFile(file, editor, label) {
  if (!file) return;
  invalidateEditorImport(editor);
  const request = editorImportVersions.get(editor);
  const previousValue = editor.value;
  if (file.size > MAX_BYTES) {
    setStatus(label + ' file exceeds 2 MiB.', true);
    return;
  }
  try {
    const contents = await file.text();
    // Another import or an intervening editor change wins.
    if (editorImportVersions.get(editor) !== request) return;
    fitInput(contents, label + ' file');
    parseJson(contents, label + ' file');
    if (previousValue.trim() && previousValue !== contents &&
        !confirm('Replace the existing ' + label + ' document with the imported file?')) return;
    if (editorImportVersions.get(editor) !== request) return;
    editor.value = contents;
    invalidateEditorImport(editor);
    resetReport();
    setStatus(label + ' file loaded locally. Select Compare JSON to see differences.');
  } catch (error) {
    if (editorImportVersions.get(editor) === request) {
      setStatus(label + ' import failed: ' + (error instanceof Error ? error.message : 'File could not be read.'), true);
    }
  }
}

const sampleBefore = {
  project: 'JSON Diff View',
  version: 1,
  settings: { locale: 'en', theme: 'light', telemetry: false },
  users: [{ id: 1, role: 'viewer' }, { id: 2, role: 'editor' }],
  deprecated: true
};
const sampleAfter = {
  project: 'JSON Diff View',
  version: 2,
  settings: { locale: 'he', theme: 'light', telemetry: false },
  users: [{ id: 1, role: 'editor' }, { id: 2, role: 'editor' }, { id: 3, role: 'viewer' }],
  documentation: 'ready'
};

function refreshFilters() {
  currentPage = 0;
  renderChangeRows();
}

filterPath.addEventListener('input', refreshFilters);
filterType.addEventListener('change', refreshFilters);
clearFiltersButton.addEventListener('click', () => {
  filterPath.value = '';
  filterType.value = 'all';
  refreshFilters();
  filterPath.focus();
});
previousPageButton.addEventListener('click', () => {
  if (!latestReport || currentPage === 0) return;
  currentPage--;
  renderChangeRows();
});
nextPageButton.addEventListener('click', () => {
  if (!latestReport) return;
  currentPage++;
  renderChangeRows();
});

function regenerateFromOptions() {
  if (!latestComparison) return;
  const message = refreshGeneratedPatch();
  setStatus(message ? message.trim() :
    'Generated patch updated. The visual comparison and patch editor are unchanged.',
    Boolean(message));
}
guardPatchCheckbox.addEventListener('change', regenerateFromOptions);
patchDirection.addEventListener('change', regenerateFromOptions);

document.querySelector('#compare').addEventListener('click', compare);
document.querySelector('#swap').addEventListener('click', () => {
  invalidateAllEditorImports();
  [beforeEditor.value, afterEditor.value] = [afterEditor.value, beforeEditor.value];
  resetReport();
  setStatus('Sides swapped. Select Compare JSON to refresh the report.');
});
document.querySelector('#clear').addEventListener('click', () => {
  invalidateAllEditorImports();
  beforeEditor.value = '';
  afterEditor.value = '';
  patchSource.value = '';
  patchImportSequence++;
  invalidateStepPreview();
  invalidateInspection();
  resetReport();
  setStatus('Editors cleared.');
  beforeEditor.focus();
});
document.querySelector('#load-sample').addEventListener('click', () => {
  invalidateAllEditorImports();
  beforeEditor.value = JSON.stringify(sampleBefore, null, 2);
  afterEditor.value = JSON.stringify(sampleAfter, null, 2);
  compare();
});
document.querySelector('#before-file').addEventListener('change', event => {
  void importFile(event.target.files?.[0], beforeEditor, 'Before');
  event.target.value = '';
});
document.querySelector('#after-file').addEventListener('change', event => {
  void importFile(event.target.files?.[0], afterEditor, 'After');
  event.target.value = '';
});

for (const editor of [beforeEditor, afterEditor]) {
  editor.addEventListener('input', () => {
    invalidateEditorImport(editor);
    resetReport();
    setStatus('Document edited. Select Compare JSON to refresh the report.');
  });
}

document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    compare();
  }
});

function downloadReport(text, name, mimeType) {
  if (new TextEncoder().encode(text).byteLength > MAX_REPORT_EXPORT_BYTES) {
    throw new RangeError('Full report exceeds 8 MiB. Narrow the input documents and compare again.');
  }
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportComparison(format) {
  if (!latestReport) return;
  try {
    const csv = format === 'csv';
    const text = csv ? serializeReportCsv(latestReport) :
      serializeReportJson(latestReport);
    downloadReport(text,
      csv ? 'json-differences.csv' : 'json-differences.json',
      csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    setStatus('Full comparison report downloaded as ' + format.toUpperCase() +
      (latestReport.truncated ? ' (truncated at 5,000 changes).' : '.'));
  } catch (error) {
    setStatus('Report download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
downloadReportJsonButton.addEventListener('click', () => exportComparison('json'));
downloadReportCsvButton.addEventListener('click', () => exportComparison('csv'));

copyButton.addEventListener('click', async () => {
  if (!latestReport) return;
  try {
    await navigator.clipboard.writeText(serializeReportJson(latestReport).trimEnd());
    setStatus('Change report copied to clipboard.');
  } catch {
    setStatus('Clipboard access failed. Try using HTTPS or a local web server.', true);
  }
});

copyPatchButton.addEventListener('click', async () => {
  if (!latestPatch) return;
  try {
    await navigator.clipboard.writeText(serializeJsonPatch(latestPatch));
    setStatus((patchDirection.value === 'reverse' ? 'After → Before' : 'Before → After') +
      ' RFC 6902 JSON Patch copied to clipboard.');
  } catch {
    setStatus('Clipboard access failed. Use Download .jsonpatch instead.', true);
  }
});

downloadPatchButton.addEventListener('click', () => {
  if (!latestPatch) return;
  const blob = new Blob([serializeJsonPatch(latestPatch)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = patchDirection.value === 'reverse' ?
    'changes-after-to-before.jsonpatch' : 'changes-before-to-after.jsonpatch';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});


// Impact is descriptive: it compares the chosen source with the detached
// preview result. It never changes the main comparison or either editor.
function renderPatchImpact() {
  if (!latestImpact) return;
  const { report, source } = latestImpact;
  const needle = impactFilterPath.value.trim().toLocaleLowerCase();
  const type = impactFilterType.value;
  const matches = report.changes.filter(change =>
    (type === 'all' || change.type === type) &&
    (!needle || change.path.toLocaleLowerCase().includes(needle))
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  impactPage = Math.min(impactPage, pageCount - 1);
  const start = impactPage * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  const counts = report.counts;
  impactPanel.hidden = false;
  impactSummary.textContent = patchSideLabel(source) + ' → preview: ' +
    counts.added + ' added, ' + counts.removed + ' removed, ' +
    counts.changed + ' changed. ' + matches.length + ' of ' +
    report.changes.length + ' recorded changes match.' +
    (report.truncated ? ' Impact report truncated after 5,000 changes.' : '');
  copyImpactButton.disabled = false;
  downloadImpactJsonButton.disabled = false;
  downloadImpactCsvButton.disabled = false;
  impactNav.hidden = matches.length <= PAGE_SIZE;
  impactPrevious.disabled = impactPage === 0;
  impactNext.disabled = impactPage >= pageCount - 1;
  impactPageSummary.textContent = 'Page ' + (impactPage + 1) + ' of ' + pageCount;

  if (!visible.length) {
    const row = document.createElement('tr');
    const empty = cell('td', report.changes.length ?
      'No impact paths match the filters.' : 'The patch makes no structural changes.', 'empty');
    empty.colSpan = 3;
    row.append(empty);
    impactRows.replaceChildren(row);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const change of visible) {
    const row = document.createElement('tr');
    row.className = change.type;
    const pathCell = document.createElement('td');
    pathCell.append(cell('span', change.type, 'tag'));
    pathCell.append(document.createElement('br'));
    pathCell.append(cell('span', change.path, 'path'));
    const leftCell = document.createElement('td');
    leftCell.append(cell('pre', displayValue(change.before, change.type !== 'added')));
    const rightCell = document.createElement('td');
    rightCell.append(cell('pre', displayValue(change.after, change.type !== 'removed')));
    row.append(pathCell, leftCell, rightCell);
    fragment.append(row);
  }
  impactRows.replaceChildren(fragment);
}
function refreshImpactFilter() {
  impactPage = 0;
  renderPatchImpact();
}
impactFilterPath.addEventListener('input', refreshImpactFilter);
impactFilterType.addEventListener('change', refreshImpactFilter);
impactPrevious.addEventListener('click', () => {
  if (!latestImpact || impactPage === 0) return;
  impactPage--;
  renderPatchImpact();
});
impactNext.addEventListener('click', () => {
  if (!latestImpact) return;
  impactPage++;
  renderPatchImpact();
});
function currentImpact() {
  if (!latestImpact || !previewIsCurrent()) {
    invalidatePatchResult();
    patchMessage('Preview is stale. Apply the patch again before exporting impact.', true);
    return null;
  }
  return latestImpact;
}

function exportImpact(format) {
  const impact = currentImpact();
  if (!impact) return;
  const { source, report } = impact;
  const sourceName = patchSideLabel(source);
  try {
    const csv = format === 'csv';
    const data = csv ?
      serializeReportCsv(report, { source: sourceName + ' → preview' }) :
      serializeReportJson(report, {
        format: 'json-diff-view-patch-impact',
        source: sourceName
      });
    downloadReport(data,
      'patch-impact-' + source + '-to-preview.' + format,
      csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    patchMessage('Full patch-impact report downloaded as ' + format.toUpperCase() +
      (report.truncated ? ' (truncated at 5,000 changes).' : '.'));
  } catch (error) {
    patchMessage('Impact report download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
downloadImpactJsonButton.addEventListener('click', () => exportImpact('json'));
downloadImpactCsvButton.addEventListener('click', () => exportImpact('csv'));

copyImpactButton.addEventListener('click', async () => {
  const impact = currentImpact();
  if (!impact) return;
  const { source, report } = impact;
  try {
    await navigator.clipboard.writeText(serializeReportJson(report, {
      format: 'json-diff-view-patch-impact',
      source: patchSideLabel(source)
    }).trimEnd());
    patchMessage('Full impact report copied; on-screen filters do not affect the export.');
  } catch {
    patchMessage('Could not copy impact report. Check clipboard permissions.', true);
  }
});

function patchMessage(message, isError = false) {
  patchStatus.textContent = message;
  patchStatus.classList.toggle('error', isError);
}
function patchEditor(side) {
  return side === 'after' ? afterEditor : beforeEditor;
}
function patchSideLabel(side) {
  return side === 'after' ? 'After' : 'Before';
}
function updateResultTarget() {
  sendResultButton.textContent = patchBase.value === 'after' ?
    'Send result to Before' : 'Send result to After';
}
function previewIsCurrent() {
  if (!lastApplied) return false;
  return patchBase.value === lastApplied.source &&
    patchEditor(lastApplied.source).value === lastApplied.sourceText &&
    patchSource.value === lastApplied.patchText;
}
function previewPatch() {
  invalidatePatchResult();
  const source = patchBase.value;
  const sourceLabel = patchSideLabel(source);
  const editor = patchEditor(source);
  try {
    fitInput(editor.value, sourceLabel);
    fitInput(patchSource.value, 'Patch');
    const documentSource = parseJson(editor.value, sourceLabel);
    const operations = parseJson(patchSource.value, 'JSON Patch');
    const transformed = applyJsonPatch(documentSource, operations);
    const json = JSON.stringify(transformed, null, 2);
    fitInput(json, 'Resulting document');
    lastApplied = {
      source,
      sourceText: editor.value,
      patchText: patchSource.value,
      json
    };
    patchResult.value = json;
    sendResultButton.disabled = false;
    downloadResultButton.disabled = false;
    verifyExpectedButton.disabled = false;
    expectedMessage('Detached patch result ready. Compare it to the opposite editor when needed.');
    let impactWarning = '';
    try {
      // The impact report observes the final result, including move/copy.
      // A large/deep diff may fail without invalidating a valid patch result.
      latestImpact = { source, report: diffJson(documentSource, transformed) };
      renderPatchImpact();
    } catch (impactError) {
      latestImpact = null;
      impactPanel.hidden = false;
      copyImpactButton.disabled = true;
      downloadImpactJsonButton.disabled = true;
      downloadImpactCsvButton.disabled = true;
      impactNav.hidden = true;
      impactRows.replaceChildren();
      impactSummary.textContent = 'Impact report unavailable: ' +
        (impactError instanceof Error ? impactError.message : 'comparison limit exceeded');
      impactWarning = ' Impact report unavailable; the detached result is still available.';
    }
    patchMessage('Patch preview created on a detached copy of ' + sourceLabel +
      '. No editor content changed.' + impactWarning);
  } catch (error) {
    patchMessage(error instanceof Error ? error.message : 'Unable to apply JSON Patch.', true);
  }
}
patchBase.addEventListener('change', () => {
  updateResultTarget();
  invalidateStepPreview();
  invalidateRange();
  invalidatePatchResult();
  patchMessage('Patch source changed to ' + patchSideLabel(patchBase.value) +
    '. Preview again before using the result.');
});
updateResultTarget();

importPatchButton.addEventListener('click', () => patchFile.click());
patchFile.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const request = ++patchImportSequence;
  if (file.size > MAX_BYTES) {
    patchMessage('Patch file exceeds the 2 MiB import limit.', true);
    return;
  }
  try {
    const contents = await file.text();
    if (request !== patchImportSequence) return;
    fitInput(contents, 'JSON Patch file');
    const operations = parseJson(contents, 'JSON Patch file');
    if (!Array.isArray(operations)) {
      throw new TypeError('JSON Patch file must contain an array of operations.');
    }
    if (operations.length > 5000) {
      throw new RangeError('Patch exceeds the 5,000 operation limit.');
    }
    // Never replace user-edited patch text without explicit confirmation.
    if (patchSource.value.trim() && patchSource.value !== contents &&
        !confirm('Replace the patch currently in the editor with the imported file?')) return;
    if (request !== patchImportSequence) return;
    patchSource.value = contents;
    invalidateInspection();
    invalidateStepPreview();
    invalidateRange();
    invalidatePatchResult();
    patchMessage('Local patch file loaded. Select Preview applying patch to inspect the result.');
  } catch (error) {
    if (request === patchImportSequence) {
      patchMessage(error instanceof Error ? error.message : 'Could not read JSON Patch file.', true);
    }
  }
});

document.querySelector('#preview-patch').addEventListener('click', previewPatch);
patchSource.addEventListener('input', () => {
  patchImportSequence++;
  invalidateInspection();
  invalidateStepPreview();
  invalidateRange();
  invalidatePatchResult();
  patchMessage('Patch text changed. Preview again before using the result.');
});
useGeneratedButton.addEventListener('click', () => {
  if (!latestPatch) return;
  const generatedText = serializeJsonPatch(latestPatch);
  if (patchSource.value.trim() && patchSource.value !== generatedText &&
      !confirm('Replace the current patch editor with the generated patch?')) return;
  patchImportSequence++;
  patchSource.value = generatedText;
  invalidateInspection();
  invalidateStepPreview();
  invalidateRange();
  patchBase.value = patchDirection.value === 'reverse' ? 'after' : 'before';
  updateResultTarget();
  invalidatePatchResult();
  patchMessage('Generated patch copied into the editor. Source set to ' +
    patchSideLabel(patchBase.value) + '. Select Preview applying patch.');
});
sendResultButton.addEventListener('click', () => {
  if (!lastApplied) return;
  if (!previewIsCurrent()) {
    invalidatePatchResult();
    patchMessage('Patch or selected source changed. Recalculate the preview before using it.', true);
    return;
  }
  const target = lastApplied.source === 'after' ? 'before' : 'after';
  const targetEditor = patchEditor(target);
  const targetLabel = patchSideLabel(target);
  if (targetEditor.value.trim() && targetEditor.value !== lastApplied.json &&
      !confirm('Replace the current ' + targetLabel + ' editor with the patch result?')) return;
  invalidateEditorImport(targetEditor);
  targetEditor.value = lastApplied.json;
  resetReport();
  compare();
  patchMessage('Patch result copied into ' + targetLabel + ' and both documents compared.');
});
downloadResultButton.addEventListener('click', () => {
  if (!lastApplied) return;
  if (!previewIsCurrent()) {
    invalidatePatchResult();
    patchMessage('Patch or selected source changed. Recalculate the preview before downloading.', true);
    return;
  }
  const blob = new Blob([lastApplied.json + '\n'], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'patched-result.json';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
