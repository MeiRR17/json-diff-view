import { diffJson, parseJson } from './diff.js';
import { createJsonPatch, serializeJsonPatch } from './patch.js';
import { applyJsonPatch } from './apply.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PREVIEW_CHARS = 1200;
const PAGE_SIZE = 100;

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

let latestReport = null;
let currentPage = 0;
let latestPatch = null;
let latestComparison = null;
let lastApplied = null;
let latestImpact = null;
let impactPage = 0;
let patchImportSequence = 0;
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

function invalidatePatchResult() {
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
}
function resetReport() {
  invalidatePatchResult();
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

copyButton.addEventListener('click', async () => {
  if (!latestReport) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify({
      format: 'json-diff-view-report',
      counts: latestReport.counts,
      truncated: latestReport.truncated,
      changes: latestReport.changes
    }, null, 2));
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
copyImpactButton.addEventListener('click', async () => {
  if (!latestImpact || !previewIsCurrent()) {
    invalidatePatchResult();
    patchMessage('Preview is stale. Apply the patch again before copying impact.', true);
    return;
  }
  const { source, report } = latestImpact;
  try {
    await navigator.clipboard.writeText(JSON.stringify({
      format: 'json-diff-view-patch-impact',
      source: patchSideLabel(source),
      counts: report.counts,
      truncated: report.truncated,
      changes: report.changes
    }, null, 2));
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
