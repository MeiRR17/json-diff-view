import { diffJson, parseJson } from './diff.js';
import { createJsonPatch, serializeJsonPatch } from './patch.js';
import { applyJsonPatch, applyJsonPatchPrefix, JsonPatchOperationError } from './apply.js';
import { serializeReportJson, serializeReportCsv } from './export.js';
import { inspectPatchOperations } from './inspect.js';
import { comparePatchRange } from './range.js';
import { serializeCheckpointBundle, parseCheckpointBundle } from './bundle.js';
import { serializeWorkspace, parseWorkspace } from './workspace.js';
import { createSessionSnapshotStore } from './session-snapshots.js';
import {
  compareSnapshotWorkspaces, serializeSnapshotComparisonJson,
  serializeSnapshotComparisonCsv
} from './snapshot-compare.js';
import {
  inspectSnapshotHunk, serializeHunkInspectionJson, serializeHunkInspectionCsv
} from './hunk-inspect.js';
import {
  searchChangedSnapshotLines, serializeChangedLineSearchJson,
  serializeChangedLineSearchCsv
} from './hunk-search.js';
import {
  compareSnapshotJsonStructures, serializeSnapshotStructuralJson,
  serializeSnapshotStructuralCsv
} from './snapshot-semantic.js';
import {
  serializeSnapshotCollection, parseSnapshotCollection, MAX_COLLECTION_BYTES
} from './snapshot-collection.js';
import { serializeFailureBundle, parseFailureBundle, verifyFailureBundle } from './failure-bundle.js';
import { serializeVerificationEvidence, parseVerificationEvidence } from './evidence.js';
import { compareVerificationArchives, evidenceChangeScope } from './evidence-compare.js';
import {
  buildEvidenceHistory, serializeEvidenceHistoryJson, serializeEvidenceHistoryCsv,
  serializeEvidenceHotspotTimelineCsv, serializeEvidenceCasesCsv,
  serializeEvidenceCaseProgressionCsv
} from './evidence-history.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PREVIEW_CHARS = 1200;
const PAGE_SIZE = 100;
const MAX_REPORT_EXPORT_BYTES = 8 * 1024 * 1024;

const beforeEditor = document.querySelector('#before');
const workspaceSaveButton = document.querySelector('#download-workspace');
const workspaceOpenButton = document.querySelector('#import-workspace');
const workspaceFile = document.querySelector('#workspace-file');
const workspaceStatus = document.querySelector('#workspace-status');
const workspaceUndoButton = document.querySelector('#undo-workspace-restore');
const workspaceSnapshotName = document.querySelector('#workspace-snapshot-name');
const workspaceSnapshotSave = document.querySelector('#workspace-snapshot-save');
const workspaceSnapshotSelect = document.querySelector('#workspace-snapshot-select');
const workspaceSnapshotPreview = document.querySelector('#workspace-snapshot-preview');
const workspaceSnapshotDownload = document.querySelector('#workspace-snapshot-download');
const workspaceSnapshotDelete = document.querySelector('#workspace-snapshot-delete');
const workspaceSnapshotRenameName = document.querySelector('#workspace-snapshot-rename-name');
const workspaceSnapshotRename = document.querySelector('#workspace-snapshot-rename');
const workspaceSnapshotRecapture = document.querySelector('#workspace-snapshot-recapture');
const workspaceSnapshotSummary = document.querySelector('#workspace-snapshot-summary');
const snapshotCompareFrom = document.querySelector('#snapshot-compare-from');
const snapshotCompareTo = document.querySelector('#snapshot-compare-to');
const snapshotCompareRun = document.querySelector('#snapshot-compare-run');
const snapshotCompareStatus = document.querySelector('#snapshot-compare-status');
const snapshotCompareResults = document.querySelector('#snapshot-compare-results');
const snapshotCompareSummary = document.querySelector('#snapshot-compare-summary');
const snapshotCompareSections = document.querySelector('#snapshot-compare-sections');
const snapshotCompareArea = document.querySelector('#snapshot-compare-area');
const snapshotCompareChangeKind = document.querySelector('#snapshot-compare-change-kind');
const snapshotCompareHunk = document.querySelector('#snapshot-compare-hunk');
const snapshotCompareHunkSummary = document.querySelector('#snapshot-compare-hunk-summary');
const snapshotHunkEditor = document.querySelector('#snapshot-hunk-editor');
const snapshotHunkIndex = document.querySelector('#snapshot-hunk-index');
const snapshotHunkContext = document.querySelector('#snapshot-hunk-context');
const snapshotHunkPage = document.querySelector('#snapshot-hunk-page');
const snapshotHunkPagePrevious = document.querySelector('#snapshot-hunk-page-previous');
const snapshotHunkPageNext = document.querySelector('#snapshot-hunk-page-next');
const snapshotHunkPageInfo = document.querySelector('#snapshot-hunk-page-info');
const snapshotHunkPrevious = document.querySelector('#snapshot-hunk-previous');
const snapshotHunkNext = document.querySelector('#snapshot-hunk-next');
const snapshotHunkOpen = document.querySelector('#snapshot-hunk-open');
const snapshotHunkInspection = document.querySelector('#snapshot-hunk-inspection');
const snapshotHunkInspectionSummary = document.querySelector('#snapshot-hunk-inspection-summary');
const snapshotHunkInspectionRows = document.querySelector('#snapshot-hunk-inspection-rows');
const snapshotHunkDownloadJson = document.querySelector('#snapshot-hunk-download-json');
const snapshotHunkDownloadCsv = document.querySelector('#snapshot-hunk-download-csv');
const snapshotHunkSearchQuery = document.querySelector('#snapshot-hunk-search-query');
const snapshotHunkSearchEditor = document.querySelector('#snapshot-hunk-search-editor');
const snapshotHunkSearchSide = document.querySelector('#snapshot-hunk-search-side');
const snapshotHunkSearchChangeType = document.querySelector('#snapshot-hunk-search-type');
const snapshotHunkSearchTransition = document.querySelector('#snapshot-hunk-search-transition');
const snapshotHunkSearchCase = document.querySelector('#snapshot-hunk-search-case');
const snapshotHunkSearchWholeWord = document.querySelector('#snapshot-hunk-search-word');
const snapshotHunkSearchRun = document.querySelector('#snapshot-hunk-search-run');
const snapshotHunkSearchResults = document.querySelector('#snapshot-hunk-search-results');
const snapshotHunkSearchSummary = document.querySelector('#snapshot-hunk-search-summary');
const snapshotHunkSearchRows = document.querySelector('#snapshot-hunk-search-rows');
const snapshotHunkSearchJson = document.querySelector('#snapshot-hunk-search-json');
const snapshotHunkSearchCsv = document.querySelector('#snapshot-hunk-search-csv');
const snapshotHunkSearchPage = document.querySelector('#snapshot-hunk-search-page');
const snapshotHunkSearchPrevious = document.querySelector('#snapshot-hunk-search-previous');
const snapshotHunkSearchNext = document.querySelector('#snapshot-hunk-search-next');
const snapshotHunkSearchPageInfo = document.querySelector('#snapshot-hunk-search-page-info');
const snapshotCompareRows = document.querySelector('#snapshot-compare-rows');
const snapshotCompareJson = document.querySelector('#snapshot-compare-json');
const snapshotCompareCsv = document.querySelector('#snapshot-compare-csv');
const snapshotSemanticRun = document.querySelector('#snapshot-semantic-run');
const snapshotSemanticPanel = document.querySelector('#snapshot-semantic-results');
const snapshotSemanticSummary = document.querySelector('#snapshot-semantic-summary');
const snapshotSemanticSections = document.querySelector('#snapshot-semantic-sections');
const snapshotSemanticEditor = document.querySelector('#snapshot-semantic-editor');
const snapshotSemanticType = document.querySelector('#snapshot-semantic-type');
const snapshotSemanticPath = document.querySelector('#snapshot-semantic-path');
const snapshotSemanticRows = document.querySelector('#snapshot-semantic-rows');
const snapshotSemanticNav = document.querySelector('#snapshot-semantic-nav');
const snapshotSemanticPrevious = document.querySelector('#snapshot-semantic-prev');
const snapshotSemanticNext = document.querySelector('#snapshot-semantic-next');
const snapshotSemanticPageInfo = document.querySelector('#snapshot-semantic-page-info');
const snapshotSemanticJson = document.querySelector('#snapshot-semantic-json');
const snapshotSemanticCsv = document.querySelector('#snapshot-semantic-csv');
const workspaceCollectionExport = document.querySelector('#workspace-collection-export');
const workspaceCollectionImport = document.querySelector('#workspace-collection-import');
const workspaceCollectionFile = document.querySelector('#workspace-collection-file');
const workspaceCollectionMode = document.querySelector('#workspace-collection-mode');
const workspaceCollectionPreviewPanel = document.querySelector('#workspace-collection-preview');
const workspaceCollectionPreviewRows = document.querySelector('#workspace-collection-preview-rows');
const workspaceCollectionPreviewSummary = document.querySelector('#workspace-collection-preview-summary');
const workspaceCollectionSelectAll = document.querySelector('#workspace-collection-select-all');
const workspaceCollectionSelectNone = document.querySelector('#workspace-collection-select-none');
const workspaceCollectionApply = document.querySelector('#workspace-collection-apply');
const workspaceCollectionCancel = document.querySelector('#workspace-collection-cancel');
const workspacePreview = document.querySelector('#workspace-preview');
const workspacePreviewSummary = document.querySelector('#workspace-preview-summary');
const workspacePreviewRows = document.querySelector('#workspace-preview-rows');
const workspaceRestoreBefore = document.querySelector('#workspace-restore-before');
const workspaceRestoreAfter = document.querySelector('#workspace-restore-after');
const workspaceRestorePatch = document.querySelector('#workspace-restore-patch');
const workspaceRestoreOptions = document.querySelector('#workspace-restore-options');
const workspaceApplyButton = document.querySelector('#apply-workspace');
const workspaceCancelButton = document.querySelector('#cancel-workspace');
const workspaceBackupButton = document.querySelector('#download-pre-restore-workspace');
const workspaceAutoBackup = document.querySelector('#workspace-backup-before-apply');
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
const patchFailurePanel = document.querySelector('#patch-failure');
const patchFailureSummary = document.querySelector('#patch-failure-summary');
const patchFailureOperation = document.querySelector('#patch-failure-operation');
const patchFailureCheckpoint = document.querySelector('#patch-failure-checkpoint');
const patchFailureNote = document.querySelector('#patch-failure-note');
const failureCopyButton = document.querySelector('#copy-failure-checkpoint');
const failureDownloadButton = document.querySelector('#download-failure-checkpoint');
const failureOpenStepButton = document.querySelector('#open-failure-step');
const failureCopyBundleButton = document.querySelector('#copy-failure-bundle');
const failureDownloadBundleButton = document.querySelector('#download-failure-bundle');
const failureIsolateButton = document.querySelector('#isolate-failure');
const importFailureButton = document.querySelector('#import-failure-bundle');
const failureFile = document.querySelector('#failure-bundle-file');
const failureImportMode = document.querySelector('#failure-import-mode');
const verifyImportedFailureButton = document.querySelector('#verify-imported-failure');
const importedFailureStatus = document.querySelector('#imported-failure-status');
const failureVerificationPanel = document.querySelector('#failure-verification-results');
const failureVerificationSummary = document.querySelector('#failure-verification-summary');
const failureVerificationRows = document.querySelector('#failure-verification-rows');
const failureVerificationPath = document.querySelector('#failure-verification-path');
const failureVerificationType = document.querySelector('#failure-verification-type');
const failureVerificationNav = document.querySelector('#failure-verification-nav');
const failureVerificationPrevious = document.querySelector('#failure-verification-previous');
const failureVerificationNext = document.querySelector('#failure-verification-next');
const failureVerificationPageSummary = document.querySelector('#failure-verification-page-summary');
const copyFailureVerificationButton = document.querySelector('#copy-failure-verification');
const downloadFailureVerificationJsonButton = document.querySelector('#download-failure-verification-json');
const downloadFailureVerificationCsvButton = document.querySelector('#download-failure-verification-csv');
const downloadVerificationEvidenceButton = document.querySelector('#download-verification-evidence');
const importVerificationEvidenceButton = document.querySelector('#import-verification-evidence');
const verificationEvidenceFile = document.querySelector('#verification-evidence-file');
const verificationEvidenceContext = document.querySelector('#verification-evidence-context');
const evidenceBaselineFile = document.querySelector('#evidence-baseline-file');
const evidenceCandidateFile = document.querySelector('#evidence-candidate-file');
const compareEvidenceButton = document.querySelector('#compare-evidence-archives');
const evidenceCompareStatus = document.querySelector('#evidence-compare-status');
const evidenceComparePanel = document.querySelector('#evidence-comparison-results');
const evidenceCompareSummary = document.querySelector('#evidence-comparison-summary');
const evidenceCompareRows = document.querySelector('#evidence-comparison-rows');
const evidenceComparePath = document.querySelector('#evidence-comparison-path');
const evidenceCompareType = document.querySelector('#evidence-comparison-type');
const evidenceCompareScope = document.querySelector('#evidence-comparison-scope');
const evidenceAssessment = document.querySelector('#evidence-assessment');
const evidenceAssessmentDetails = document.querySelector('#evidence-assessment-details');
const evidenceCompareNav = document.querySelector('#evidence-comparison-nav');
const evidenceComparePrevious = document.querySelector('#evidence-comparison-previous');
const evidenceCompareNext = document.querySelector('#evidence-comparison-next');
const evidenceComparePageSummary = document.querySelector('#evidence-comparison-page-summary');
const copyEvidenceCompareButton = document.querySelector('#copy-evidence-comparison');
const downloadEvidenceCompareJsonButton = document.querySelector('#download-evidence-comparison-json');
const downloadEvidenceCompareCsvButton = document.querySelector('#download-evidence-comparison-csv');
const evidenceHistoryFiles = document.querySelector('#evidence-history-files');
const evidenceHistoryRunButton = document.querySelector('#run-evidence-history');
const evidenceHistoryStatus = document.querySelector('#evidence-history-status');
const evidenceHistoryPanel = document.querySelector('#evidence-history-results');
const evidenceHistorySummary = document.querySelector('#evidence-history-summary');
const evidenceHistoryRows = document.querySelector('#evidence-history-rows');
const evidenceHistoryFilter = document.querySelector('#evidence-history-filter');
const evidenceHistoryCaseFilter = document.querySelector('#evidence-history-case-filter');
const evidenceHistoryCasesPanel = document.querySelector('#evidence-history-cases');
const evidenceHistoryCasesSummary = document.querySelector('#evidence-history-cases-summary');
const evidenceHistoryCasesRows = document.querySelector('#evidence-history-cases-rows');
const evidenceHistoryCasesCsvButton = document.querySelector('#download-evidence-cases-csv');
const evidenceCaseProgressionPanel = document.querySelector('#evidence-case-progression');
const evidenceCaseProgressionSummary = document.querySelector('#evidence-case-progression-summary');
const evidenceCaseProgressionRows = document.querySelector('#evidence-case-progression-rows');
const evidenceCaseProgressionCsvButton = document.querySelector('#download-evidence-case-progression-csv');
const evidenceHistoryMode = document.querySelector('#evidence-history-mode');
const evidenceHistoryTableTitle = document.querySelector('#evidence-history-table-title');
const evidenceHistoryCustomFrom = document.querySelector('#evidence-history-custom-from');
const evidenceHistoryCustomTo = document.querySelector('#evidence-history-custom-to');
const evidenceHistoryCustomRun = document.querySelector('#compare-evidence-history-custom');
const evidenceHistoryCustomStatus = document.querySelector('#evidence-history-custom-status');
const evidenceHistoryCopyButton = document.querySelector('#copy-evidence-history');
const evidenceHistoryJsonButton = document.querySelector('#download-evidence-history-json');
const evidenceHistoryCsvButton = document.querySelector('#download-evidence-history-csv');
const evidenceHotspotsPanel = document.querySelector('#evidence-history-hotspots');
const evidenceHotspotsSummary = document.querySelector('#evidence-history-hotspots-summary');
const evidenceHotspotsRows = document.querySelector('#evidence-history-hotspots-rows');
const evidenceHotspotsScope = document.querySelector('#evidence-history-hotspots-scope');
const evidenceHotspotsPath = document.querySelector('#evidence-history-hotspots-path');
const evidenceHotspotsCsvButton = document.querySelector('#download-evidence-hotspots-csv');
const evidenceHotspotTimelinePanel = document.querySelector('#evidence-hotspot-timeline');
const evidenceHotspotTimelineSummary = document.querySelector('#evidence-hotspot-timeline-summary');
const evidenceHotspotTimelineRows = document.querySelector('#evidence-hotspot-timeline-rows');
const evidenceHotspotTimelineCsvButton = document.querySelector('#download-evidence-hotspot-timeline-csv');
const evidenceHistoryDetailPanel = document.querySelector('#evidence-history-detail');
const evidenceHistoryDetailSummary = document.querySelector('#evidence-history-detail-summary');
const evidenceHistoryDetailRows = document.querySelector('#evidence-history-detail-rows');
const evidenceHistoryDetailPath = document.querySelector('#evidence-history-detail-path');
const evidenceHistoryDetailType = document.querySelector('#evidence-history-detail-type');
const evidenceHistoryDetailScope = document.querySelector('#evidence-history-detail-scope');
const evidenceHistoryDetailNav = document.querySelector('#evidence-history-detail-nav');
const evidenceHistoryDetailPrevious = document.querySelector('#evidence-history-detail-previous');
const evidenceHistoryDetailNext = document.querySelector('#evidence-history-detail-next');
const evidenceHistoryDetailPageSummary = document.querySelector('#evidence-history-detail-page-summary');
const evidenceHistoryDetailCopyButton = document.querySelector('#copy-evidence-history-detail');
const evidenceHistoryDetailJsonButton = document.querySelector('#download-evidence-history-detail-json');
const evidenceHistoryDetailCsvButton = document.querySelector('#download-evidence-history-detail-csv');

let evidenceHistoryGeneration = 0;
let latestEvidenceHistory = null;
let selectedEvidenceCaseProgression = null;
let selectedEvidenceHotspot = null;
let latestEvidenceHistoryFiles = null;
let historyDetailRequest = 0;
let latestEvidenceHistoryDetail = null;
let evidenceHistoryDetailPage = 0;
let evidenceCompareGeneration = 0;
let latestEvidenceComparison = null;
let evidenceComparisonPage = 0;
let evidenceImportSequence = 0;
let latestImportedFailure = null;
let latestImportedVerification = null;
let failureVerificationPage = 0;
let latestFailure = null;
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
let workspaceImportSequence = 0;
const sessionSnapshots = createSessionSnapshotStore();
let collectionImportGeneration = 0;
let stagedCollection = null;
let stagedWorkspace = null;
let latestWorkspaceUndo = null;
let latestSnapshotComparison = null;
let latestHunkInspection = null;
let latestHunkSearch = null;
let activeHunkSearchHit = null;
let latestSnapshotStructuralComparison = null;
// Reserved comparison-only ID: snapshot IDs are numeric strings.
const CURRENT_WORKSPACE_ENTRY_ID = '@current';
let snapshotRawLiveBasis = null;
let snapshotStructuralLiveBasis = null;
let snapshotSemanticPage = 0;
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

// Snapshot plain text and option controls: neither saving nor importing a
// workspace parses, compares or executes its embedded editor drafts.
function currentWorkspaceValues() {
  return {
    beforeText: beforeEditor.value,
    afterText: afterEditor.value,
    patchText: patchSource.value,
    patchBase: patchBase.value,
    patchDirection: patchDirection.value,
    guardPatch: guardPatchCheckbox.checked,
    guardRangePatch: guardRangePatchCheckbox.checked,
    rangeStart: rangeStartInput.value,
    rangeEnd: rangeEndInput.value,
    stepCount: stepCountInput.value
  };
}
const workspaceSections = [
  { name: 'Before', checkbox: workspaceRestoreBefore, keys: ['beforeText'] },
  { name: 'After', checkbox: workspaceRestoreAfter, keys: ['afterText'] },
  { name: 'JSON Patch', checkbox: workspaceRestorePatch, keys: ['patchText'] },
  {
    name: 'Patch and range settings', checkbox: workspaceRestoreOptions,
    keys: [
      'patchBase', 'patchDirection', 'guardPatch', 'guardRangePatch',
      'rangeStart', 'rangeEnd', 'stepCount'
    ]
  }
];
function workspaceChanged(a, b) {
  return Object.keys(a).some(key => a[key] !== b[key]);
}
function workspaceMessage(message, error = false) {
  workspaceStatus.textContent = message;
  workspaceStatus.classList.toggle('error', error);
}
/**
 * A single, memory-only undo checkpoint. The object holds only properties
 * actually modified by the last confirmed restore. Never undo unrelated
 * fields or write over changes made after the restore.
 */
function clearWorkspaceUndo() {
  latestWorkspaceUndo = null;
  workspaceUndoButton.disabled = true;
  workspaceUndoButton.title = 'Available after a workspace restore changes editor content or settings.';
}
function invalidateWorkspaceUndoOnEdit(key) {
  if (!latestWorkspaceUndo || !latestWorkspaceUndo.keys.includes(key)) return;
  clearWorkspaceUndo();
  workspaceMessage('Undo restore is no longer available: a restored field was edited. ' +
    'Your newer work is preserved.');
}
function currentWorkspaceUndo() {
  const undo = latestWorkspaceUndo;
  if (!undo) return null;
  const current = currentWorkspaceValues();
  if (undo.keys.some(key => current[key] !== undo.after[key])) {
    clearWorkspaceUndo();
    workspaceMessage('Undo restore was canceled: restored fields changed since ' +
      'the restore. No work was overwritten.', true);
    return null;
  }
  return undo;
}
function clearWorkspaceStaging() {
  stagedWorkspace = null;
  workspacePreview.hidden = true;
  workspacePreviewSummary.textContent = '';
  workspacePreviewRows.replaceChildren();
  workspaceApplyButton.disabled = true;
  workspaceBackupButton.disabled = true;
}
function discardWorkspaceStaging(message = '') {
  workspaceImportSequence++;
  const hadPreview = stagedWorkspace !== null;
  clearWorkspaceStaging();
  if (hadPreview && message) workspaceMessage(message);
}
function workspaceSectionChanges(section, current, incoming) {
  return section.keys.filter(key => current[key] !== incoming[key]).length;
}
function rawTextSize(value) {
  return new TextEncoder().encode(value).byteLength;
}
function formatBytes(bytes) {
  return bytes.toLocaleString() + ' bytes';
}
function refreshWorkspacePreview() {
  const staged = stagedWorkspace;
  if (!staged) return;
  const { values, snapshot, name } = staged;
  const fragment = document.createDocumentFragment();
  let selected = 0, changed = 0;
  for (const section of workspaceSections) {
    const differences = workspaceSectionChanges(section, snapshot, values);
    const selectedSection = section.checkbox.checked;
    if (selectedSection) {
      selected++;
      if (differences) changed++;
    }
    const row = document.createElement('tr');
    const choice = document.createElement('td');
    const textLabel = document.createElement('label');
    textLabel.className = 'workspace-preview-choice';
    const checkbox = section.checkbox;
    // Reuse the checkbox control outside the table; this label focuses it
    // without relocating it and removing its original accessible label.
    textLabel.textContent = section.name;
    choice.append(textLabel);
    let details;
    if (section.keys.length === 1) {
      const key = section.keys[0];
      details = formatBytes(rawTextSize(snapshot[key])) + ' → ' +
        formatBytes(rawTextSize(values[key]));
    } else {
      details = section.keys.length + ' settings; ' +
        differences + ' different';
    }
    row.append(choice);
    row.append(document.createElement('td'));
    row.children[1].textContent = details;
    row.append(document.createElement('td'));
    row.children[2].textContent = differences ?
      'Will replace if selected' : 'Identical';
    fragment.append(row);
  }
  workspacePreviewRows.replaceChildren(fragment);
  workspaceApplyButton.disabled = selected === 0;
  workspaceBackupButton.disabled = false;
  workspacePreviewSummary.textContent =
    'Loaded local file “' + name + '”. ' + selected +
    ' of 4 sections selected (' + changed +
    ' contain changes). The table shows only lengths and settings counts, ' +
    'not the draft contents. No editor has been changed and no patch was run.';
}
function stageWorkspace(values, name, snapshot) {
  clearWorkspaceStaging();
  stagedWorkspace = { values, name, snapshot };
  for (const section of workspaceSections) section.checkbox.checked = true;
  workspaceAutoBackup.checked = true;
  workspacePreview.hidden = false;
  refreshWorkspacePreview();
}
for (const section of workspaceSections) {
  section.checkbox.addEventListener('change', refreshWorkspacePreview);
}
// Editing an editor or setting invalidates a staged import. It also cancels
// an in-flight file read, including edit-and-revert sequences.
for (const [field, key] of [
  [beforeEditor, 'beforeText'], [afterEditor, 'afterText'],
  [patchSource, 'patchText'], [rangeStartInput, 'rangeStart'],
  [rangeEndInput, 'rangeEnd'], [stepCountInput, 'stepCount']
]) {
  field.addEventListener('input', () => {
    discardWorkspaceStaging(
      'Workspace preview canceled because the current work changed. Open the file again.');
    invalidateWorkspaceUndoOnEdit(key);
    invalidateLiveSnapshotComparisons();
  });
}
for (const [control, key] of [
  [patchBase, 'patchBase'], [patchDirection, 'patchDirection'],
  [guardPatchCheckbox, 'guardPatch'], [guardRangePatchCheckbox, 'guardRangePatch']
]) {
  control.addEventListener('change', () => {
    discardWorkspaceStaging(
      'Workspace preview canceled because the current work changed. Open the file again.');
    invalidateWorkspaceUndoOnEdit(key);
    invalidateLiveSnapshotComparisons();
  });
}
workspaceSaveButton.addEventListener('click', () => {
  try {
    const contents = serializeWorkspace(currentWorkspaceValues());
    downloadReport(contents, 'json-diff-view-workspace.json',
      'application/json;charset=utf-8');
    workspaceMessage('Workspace saved locally with raw editor drafts and patch options.');
  } catch (error) {
    workspaceMessage('Could not save workspace: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
workspaceOpenButton.addEventListener('click', () => workspaceFile.click());
workspaceFile.addEventListener('change', event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) void importWorkspace(file);
});
workspaceCancelButton.addEventListener('click', () => {
  discardWorkspaceStaging('Workspace restore canceled. No editor was modified.');
});
// Explicit in-tab snapshots; the complete serialized workspace is retained
// only in memory. Persist selected snapshots by downloading them manually.
function selectedSessionSnapshot() {
  return sessionSnapshots.read(workspaceSnapshotSelect.value);
}
/**
 * A comparison-only entry captures current raw drafts without using a
 * session snapshot slot. It is never written to browser persistence.
 */
function comparisonWorkspaceEntry(id) {
  if (id === CURRENT_WORKSPACE_ENTRY_ID) return {
    id: CURRENT_WORKSPACE_ENTRY_ID,
    name: 'Current unsaved workspace (captured)',
    content: serializeWorkspace(currentWorkspaceValues())
  };
  return sessionSnapshots.read(id);
}
function liveBasisForPair(first, second) {
  if (first?.id === CURRENT_WORKSPACE_ENTRY_ID) return first.content;
  if (second?.id === CURRENT_WORKSPACE_ENTRY_ID) return second.content;
  return null;
}
/** Invalidate reports tied to editor state while retaining saved-only reports. */
function invalidateLiveSnapshotComparisons() {
  let cleared = false;
  if (snapshotRawLiveBasis !== null) {
    invalidateRawSnapshotComparison();
    cleared = true;
  }
  if (snapshotStructuralLiveBasis !== null) {
    invalidateSnapshotSemanticComparison();
    cleared = true;
  }
  if (cleared) snapshotCompareMessage(
    'The unsaved workspace changed. Compare again to update saved-vs-current results.');
}
/**
 * Programmatic file imports need not dispatch input/change events.
 * Guard both exports and result rendering against such stale live reports.
 */
function ensureLiveSnapshotComparisonFresh(kind) {
  const basis = kind === 'structural' ?
    snapshotStructuralLiveBasis : snapshotRawLiveBasis;
  if (basis === null) return true;
  let isCurrent = false;
  try { isCurrent = serializeWorkspace(currentWorkspaceValues()) === basis; }
  catch { isCurrent = false; }
  if (isCurrent) return true;
  if (kind === 'structural') invalidateSnapshotSemanticComparison();
  else invalidateRawSnapshotComparison();
  snapshotCompareMessage('The current workspace changed since this comparison. ' +
    'Rerun Compare to refresh before viewing or exporting.', true);
  return false;
}

const SNAPSHOT_SEMANTIC_PAGE_SIZE = 75;
function invalidateSnapshotSemanticComparison() {
  latestSnapshotStructuralComparison = null;
  snapshotStructuralLiveBasis = null;
  snapshotSemanticPage = 0;
  snapshotSemanticPanel.hidden = true;
  snapshotSemanticSummary.textContent = '';
  snapshotSemanticSections.replaceChildren();
  snapshotSemanticRows.replaceChildren();
  snapshotSemanticNav.hidden = true;
  snapshotSemanticJson.disabled = true;
  snapshotSemanticCsv.disabled = true;
}
function renderSnapshotSemanticRows() {
  const report = latestSnapshotStructuralComparison;
  if (!report || !ensureLiveSnapshotComparisonFresh('structural')) return;
  const area = snapshotSemanticEditor.value;
  const type = snapshotSemanticType.value;
  const needle = snapshotSemanticPath.value.trim().toLocaleLowerCase();
  const matching = report.details.filter(item =>
    (area === 'all' || item.section === area) &&
    (type === 'all' || item.type === type) &&
    (!needle || item.path.toLocaleLowerCase().includes(needle))
  );
  const pages = Math.max(1, Math.ceil(matching.length / SNAPSHOT_SEMANTIC_PAGE_SIZE));
  snapshotSemanticPage = Math.min(snapshotSemanticPage, pages - 1);
  const from = snapshotSemanticPage * SNAPSHOT_SEMANTIC_PAGE_SIZE;
  const visible = matching.slice(from, from + SNAPSHOT_SEMANTIC_PAGE_SIZE);
  const fragment = document.createDocumentFragment();
  if (!visible.length) {
    const row = document.createElement('tr');
    const empty = cell('td', 'No recorded structural changes match these filters.', 'empty');
    empty.colSpan = 5;
    row.append(empty);
    fragment.append(row);
  } else for (const item of visible) {
    const row = document.createElement('tr');
    for (const value of [
      item.section,
      item.type,
      item.path + (item.path_truncated ? ' [path shortened]' : ''),
      item.before_present ? item.before_preview : '(not present)',
      item.after_present ? item.after_preview : '(not present)'
    ]) row.append(cell('td', value));
    fragment.append(row);
  }
  snapshotSemanticRows.replaceChildren(fragment);
  snapshotSemanticNav.hidden = pages <= 1;
  snapshotSemanticPrevious.disabled = snapshotSemanticPage === 0;
  snapshotSemanticNext.disabled = snapshotSemanticPage + 1 >= pages;
  snapshotSemanticPageInfo.textContent = matching.length +
    ' of ' + report.details.length + ' preview rows match the filters · page ' +
    (snapshotSemanticPage + 1) + '/' + pages + '.';
}
function renderSnapshotSemanticComparison() {
  const report = latestSnapshotStructuralComparison;
  if (!report || !ensureLiveSnapshotComparisonFresh('structural')) return;
  snapshotSemanticPanel.hidden = false;
  snapshotSemanticSummary.textContent =
    'READ-ONLY STRUCTURAL JSON COMPARISON. ' +
    report.summary.editors_compared + ' of 3 editors compared; ' +
    report.summary.editors_unavailable + ' could not be compared; ' +
    report.summary.recorded_changes + ' differences recorded, ' +
    report.summary.shown_rows + ' preview rows, ' +
    report.summary.omitted_recorded_rows + ' omitted recorded rows, ' +
    report.summary.truncated_reports + ' truncated structural reports. ' +
    'Counts on truncated reports are lower bounds. JSON Patch text is treated ' +
    'only as data; no patch was executed or editor modified.';
  const fragment = document.createDocumentFragment();
  for (const section of report.sections) {
    const row = document.createElement('tr');
    let explanation = section.status === 'compared' ?
      'Earlier and later JSON valid' :
      'Earlier: ' + section.earlier_status + '; later: ' + section.later_status;
    if (section.error) explanation += ' — ' + section.error;
    else if (section.earlier_error || section.later_error) explanation +=
      ' — ' + (section.earlier_error || section.later_error);
    const counts = section.status === 'compared' ?
      section.counts.added + ' added · ' + section.counts.removed +
      ' removed · ' + section.counts.changed + ' changed' +
      (section.report_truncated ? ' (truncated)' : '') : 'Not compared';
    for (const value of [
      section.label, explanation, counts,
      section.shown_rows + (section.omitted_rows ?
        ' (+' + section.omitted_rows + ' omitted)' : '')
    ]) row.append(cell('td', String(value)));
    fragment.append(row);
  }
  snapshotSemanticSections.replaceChildren(fragment);
  snapshotSemanticPage = 0;
  renderSnapshotSemanticRows();
}
for (const control of [snapshotSemanticEditor, snapshotSemanticType]) {
  control.addEventListener('change', () => {
    snapshotSemanticPage = 0;
    renderSnapshotSemanticRows();
  });
}
snapshotSemanticPath.addEventListener('input', () => {
  snapshotSemanticPage = 0;
  renderSnapshotSemanticRows();
});
snapshotSemanticPrevious.addEventListener('click', () => {
  if (snapshotSemanticPage === 0) return;
  snapshotSemanticPage--;
  renderSnapshotSemanticRows();
});
snapshotSemanticNext.addEventListener('click', () => {
  if (!latestSnapshotStructuralComparison) return;
  snapshotSemanticPage++;
  renderSnapshotSemanticRows();
});
snapshotSemanticRun.addEventListener('click', () => {
  if (snapshotSemanticRun.disabled) return;
  try {
    const first = comparisonWorkspaceEntry(snapshotCompareFrom.value);
    const second = comparisonWorkspaceEntry(snapshotCompareTo.value);
    if (!first || !second || first.id === second.id) return;
    latestSnapshotStructuralComparison = compareSnapshotJsonStructures(first, second);
    snapshotStructuralLiveBasis = liveBasisForPair(first, second);
    renderSnapshotSemanticComparison();
    snapshotSemanticJson.disabled = false;
    snapshotSemanticCsv.disabled = false;
    snapshotCompareMessage('Structural JSON comparison ready. Invalid drafts are reported separately.');
  } catch (error) {
    invalidateSnapshotSemanticComparison();
    snapshotCompareMessage('Structural comparison failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
snapshotSemanticJson.addEventListener('click', () => {
  if (!latestSnapshotStructuralComparison || !ensureLiveSnapshotComparisonFresh('structural')) return;
  try {
    downloadReport(serializeSnapshotStructuralJson(latestSnapshotStructuralComparison),
      'snapshot-structural-comparison.json', 'application/json;charset=utf-8');
    snapshotCompareMessage('Structural comparison JSON download initiated.');
  } catch (error) {
    snapshotCompareMessage('Structural JSON export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
snapshotSemanticCsv.addEventListener('click', () => {
  if (!latestSnapshotStructuralComparison || !ensureLiveSnapshotComparisonFresh('structural')) return;
  try {
    downloadReport(serializeSnapshotStructuralCsv(latestSnapshotStructuralComparison),
      'snapshot-structural-comparison.csv', 'text/csv;charset=utf-8');
    snapshotCompareMessage('Structural comparison CSV download initiated.');
  } catch (error) {
    snapshotCompareMessage('Structural CSV export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});

function invalidateRawSnapshotComparison() {
  clearHunkSearch();
  clearHunkInspection();
  latestSnapshotComparison = null;
  snapshotRawLiveBasis = null;
  snapshotCompareResults.hidden = true;
  snapshotCompareSummary.textContent = '';
  snapshotCompareSections.replaceChildren();
  snapshotCompareRows.replaceChildren();
  snapshotCompareHunk.replaceChildren();
  snapshotCompareHunkSummary.textContent = '';
  snapshotCompareHunk.disabled = true;
  snapshotHunkOpen.disabled = true;
  snapshotHunkPrevious.disabled = true;
  snapshotHunkNext.disabled = true;
  snapshotHunkSearchRun.disabled = true;
  snapshotHunkPagePrevious.disabled = true;
  snapshotHunkPageNext.disabled = true;
  snapshotCompareJson.disabled = true;
  snapshotCompareCsv.disabled = true;
}
function invalidateSessionSnapshotComparison() {
  invalidateRawSnapshotComparison();
  invalidateSnapshotSemanticComparison();
}
function populateSnapshotCompareSelects(items) {
  const fromId = snapshotCompareFrom.value;
  const toId = snapshotCompareTo.value;
  for (const control of [snapshotCompareFrom, snapshotCompareTo]) {
    const fragment = document.createDocumentFragment();
    const current = document.createElement('option');
    current.value = CURRENT_WORKSPACE_ENTRY_ID;
    current.textContent = 'Current unsaved workspace';
    fragment.append(current);
    for (const item of items) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name + ' (#' + item.id + ')';
      fragment.append(option);
    }
    control.replaceChildren(fragment);
    control.disabled = items.length === 0;
  }
  const allowed = id =>
    id === CURRENT_WORKSPACE_ENTRY_ID || items.some(item => item.id === id);
  snapshotCompareFrom.value = allowed(fromId) ?
    fromId : (items[0]?.id || CURRENT_WORKSPACE_ENTRY_ID);
  snapshotCompareTo.value = allowed(toId) && toId !== snapshotCompareFrom.value ?
    toId : (items[1]?.id || (snapshotCompareFrom.value === CURRENT_WORKSPACE_ENTRY_ID ?
      items[0]?.id : CURRENT_WORKSPACE_ENTRY_ID));
  refreshSnapshotCompareAction();
}
function refreshSnapshotCompareAction() {
  const a = snapshotCompareFrom.value, b = snapshotCompareTo.value;
  const allowed = id => id === CURRENT_WORKSPACE_ENTRY_ID ||
    Boolean(sessionSnapshots.read(id));
  const valid = sessionSnapshots.usage().count > 0 &&
    a !== b && allowed(a) && allowed(b);
  snapshotCompareRun.disabled = !valid;
  snapshotSemanticRun.disabled = !valid;
}
function snapshotCompareMessage(message, error = false) {
  snapshotCompareStatus.textContent = message;
  snapshotCompareStatus.classList.toggle('error', error);
}
function clearHunkSearch() {
  latestHunkSearch = null;
  snapshotHunkSearchResults.hidden = true;
  snapshotHunkSearchSummary.textContent = '';
  snapshotHunkSearchRows.replaceChildren();
  snapshotHunkSearchPageInfo.textContent = '';
  snapshotHunkSearchPage.removeAttribute('max');
  snapshotHunkSearchPrevious.disabled = true;
  snapshotHunkSearchNext.disabled = true;
  snapshotHunkSearchJson.disabled = true;
  snapshotHunkSearchCsv.disabled = true;
}
function refreshHunkSearchControl() {
  const query = snapshotHunkSearchQuery.value.trim();
  const pageText = snapshotHunkSearchPage.value.trim();
  const page = Number(pageText);
  snapshotHunkSearchRun.disabled = !latestSnapshotComparison ||
    !query || query.length > 120 || !pageText ||
    !Number.isSafeInteger(page) || page < 1;
}
snapshotHunkSearchQuery.addEventListener('input', () => {
  snapshotHunkSearchPage.value = '1';
  clearHunkSearch();
  refreshHunkSearchControl();
});
for (const control of [
  snapshotHunkSearchEditor, snapshotHunkSearchSide,
  snapshotHunkSearchChangeType, snapshotHunkSearchTransition,
  snapshotHunkSearchCase, snapshotHunkSearchWholeWord
]) {
  control.addEventListener('change', () => {
    snapshotHunkSearchPage.value = '1';
    clearHunkSearch();
    refreshHunkSearchControl();
  });
}
function openHunkSearchHit(hit) {
  if (!latestHunkSearch || !latestSnapshotComparison ||
      !ensureLiveSnapshotComparisonFresh('raw')) return;
  snapshotHunkEditor.value = hit.editor;
  snapshotHunkIndex.value = String(hit.hunk_index);
  snapshotHunkPage.value = String(hit.hunk_page);
  clearHunkInspection();
  // The hunk inspection's displayed window is 180 changed rows. A hit
  // identifies the exact changed row *inside* that window.
  activeHunkSearchHit = {
    editor: hit.editor,
    hunk_index: hit.hunk_index,
    row_in_hunk: hit.row_in_hunk,
    from_line: hit.from_line,
    to_line: hit.to_line
  };
  refreshHunkInspectionControl();
  // The inspector focuses and scrolls the exact marked row itself.
  // Do not scroll back to the panel heading after focusing the match.
  openHunkInspection();
}
function runHunkSearch() {
  if (snapshotHunkSearchRun.disabled || !latestSnapshotComparison ||
      !ensureLiveSnapshotComparisonFresh('raw')) return;
  try {
    const pair = latestSnapshotComparison;
    const first = comparisonWorkspaceEntry(pair.from.id);
    const second = comparisonWorkspaceEntry(pair.to.id);
    const found = searchChangedSnapshotLines(
      first, second, snapshotHunkSearchQuery.value,
      snapshotHunkSearchEditor.value, snapshotHunkSearchSide.value,
      Number(snapshotHunkSearchPage.value), {
        changeType: snapshotHunkSearchChangeType.value,
        transition: snapshotHunkSearchTransition.value,
        caseSensitive: snapshotHunkSearchCase.checked,
        wholeWord: snapshotHunkSearchWholeWord.checked
      });
    if (!ensureLiveSnapshotComparisonFresh('raw')) return;
    clearHunkSearch();
    latestHunkSearch = found;
    const stats = found.summary;
    const window = found.window;
    snapshotHunkSearchSummary.textContent =
      stats.matching_rows_in_inspected_scope + ' matching changed rows among ' +
      stats.inspected_changed_rows + ' scanned; displaying matches ' +
      window.first_match_index + '–' + window.last_match_index +
      ' (' + stats.stored_results + ' previews in this window)' +
      (stats.matches_outside_current_page ? ', ' +
        stats.matches_outside_current_page + ' matches on other pages' : '') +
      (stats.incomplete ? '. INCOMPLETE SEARCH: ' +
        stats.uninspected_changed_rows + ' changed rows were not searched.' :
        '. All changed lines in this scope were searched.') +
      ' Phrase transitions within these filters: ' +
      stats.matching_rows_by_transition.introduced + ' introduced, ' +
      stats.matching_rows_by_transition.resolved + ' resolved, ' +
      stats.matching_rows_by_transition.persistent + ' present on both sides. ' +
      'A transition describes phrase presence on the paired changed row, ' +
      'not the entire document. Open a result to highlight its exact row.';
    const fragment = document.createDocumentFragment();
    if (!found.results.length) {
      const tr = document.createElement('tr');
      const td = cell('td','No matches in the inspected changed lines.','empty');
      td.colSpan = 10;
      tr.append(td);
      fragment.append(tr);
    } else for (const hit of found.results) {
      const tr = document.createElement('tr');
      for (const value of [
        hit.editor_label, hit.change_type, hit.match_side,
        hit.match_transition, hit.hunk_index + ' / ' + hit.hunk_page,
        hit.from_line === null ? '—' : String(hit.from_line),
        hit.from_present ? hit.from_preview : '(not present)',
        hit.to_line === null ? '—' : String(hit.to_line),
        hit.to_present ? hit.to_preview : '(not present)'
      ]) tr.append(cell('td',value));
      const action = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button subtle';
      button.textContent = 'Highlight match';
      button.setAttribute('aria-label',
        'Open ' + hit.editor_label + ', hunk ' + hit.hunk_index +
        ', changed row ' + hit.row_in_hunk);
      button.addEventListener('click', () => openHunkSearchHit(hit));
      action.append(button);
      tr.append(action);
      fragment.append(tr);
    }
    snapshotHunkSearchRows.replaceChildren(fragment);
    snapshotHunkSearchResults.hidden = false;
    snapshotHunkSearchPage.max = String(window.total_pages);
    snapshotHunkSearchPageInfo.textContent =
      'Match page ' + window.page + '/' + window.total_pages +
      ' · ' + window.first_match_index + '–' +
      window.last_match_index + ' of ' +
      stats.matching_rows_in_inspected_scope + ' scanned-scope matches';
    snapshotHunkSearchPrevious.disabled = !window.has_previous_page;
    snapshotHunkSearchNext.disabled = !window.has_next_page;
    snapshotHunkSearchJson.disabled = false;
    snapshotHunkSearchCsv.disabled = false;
    snapshotCompareMessage('Changed-line match page generated locally; other pages are not retained.');
  } catch (error) {
    clearHunkSearch();
    snapshotCompareMessage('Changed-line search failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
snapshotHunkSearchRun.addEventListener('click', runHunkSearch);
snapshotHunkSearchPage.addEventListener('change', () => {
  clearHunkSearch();
  refreshHunkSearchControl();
  if (!snapshotHunkSearchRun.disabled) runHunkSearch();
});
snapshotHunkSearchPrevious.addEventListener('click', () => {
  if (snapshotHunkSearchPrevious.disabled || !latestHunkSearch) return;
  snapshotHunkSearchPage.value = String(latestHunkSearch.window.page - 1);
  refreshHunkSearchControl();
  runHunkSearch();
});
snapshotHunkSearchNext.addEventListener('click', () => {
  if (snapshotHunkSearchNext.disabled || !latestHunkSearch) return;
  snapshotHunkSearchPage.value = String(latestHunkSearch.window.page + 1);
  refreshHunkSearchControl();
  runHunkSearch();
});
snapshotHunkSearchJson.addEventListener('click', () => {
  if (!latestHunkSearch || !ensureLiveSnapshotComparisonFresh('raw')) return;
  try {
    downloadReport(serializeChangedLineSearchJson(latestHunkSearch),
      'snapshot-changed-line-search.json','application/json;charset=utf-8');
    snapshotCompareMessage('Search JSON download initiated.');
  } catch (error) {
    snapshotCompareMessage('Search JSON export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
snapshotHunkSearchCsv.addEventListener('click', () => {
  if (!latestHunkSearch || !ensureLiveSnapshotComparisonFresh('raw')) return;
  try {
    downloadReport(serializeChangedLineSearchCsv(latestHunkSearch),
      'snapshot-changed-line-search.csv','text/csv;charset=utf-8');
    snapshotCompareMessage('Search CSV download initiated.');
  } catch (error) {
    snapshotCompareMessage('Search CSV export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});

function clearHunkInspection() {
  latestHunkInspection = null;
  activeHunkSearchHit = null;
  snapshotHunkInspection.hidden = true;
  snapshotHunkInspectionSummary.textContent = '';
  snapshotHunkInspectionRows.replaceChildren();
  snapshotHunkPageInfo.textContent = '';
  // A different hunk can contain more pages than the last inspected one.
  // The upper bound is known only after recalculating its alignment.
  snapshotHunkPage.removeAttribute('max');
  snapshotHunkPagePrevious.disabled = true;
  snapshotHunkPageNext.disabled = true;
  snapshotHunkDownloadJson.disabled = true;
  snapshotHunkDownloadCsv.disabled = true;
}
function refreshHunkInspectionControl() {
  const report = latestSnapshotComparison;
  const section = report?.sections.find(item =>
    item.id === snapshotHunkEditor.value && item.kind === 'raw-text');
  const max = section?.hunk_count || 0;
  snapshotHunkIndex.max = String(Math.max(1,max));
  const n = Number(snapshotHunkIndex.value);
  snapshotHunkOpen.disabled = !report || !max ||
    !Number.isSafeInteger(n) || n < 1 || n > max ||
    !snapshotHunkIndex.value.trim();
  snapshotHunkPrevious.disabled = snapshotHunkOpen.disabled || n <= 1;
  snapshotHunkNext.disabled = snapshotHunkOpen.disabled || n >= max;
  const page = Number(snapshotHunkPage.value);
  const pageValid = snapshotHunkPage.value.trim() &&
    Number.isSafeInteger(page) && page >= 1;
  if (!pageValid) snapshotHunkOpen.disabled = true;
  const inspected = latestHunkInspection;
  const sameHunk = inspected &&
    inspected.editor.id === snapshotHunkEditor.value &&
    inspected.summary.index === n;
  const pages = sameHunk ? inspected.window.total_pages : null;
  snapshotHunkPagePrevious.disabled = !sameHunk || !pageValid || page <= 1;
  snapshotHunkPageNext.disabled = !sameHunk || !pageValid || page >= pages;
}
snapshotHunkEditor.addEventListener('change', () => {
  clearHunkInspection();
  snapshotHunkIndex.value = '1';
  snapshotHunkPage.value = '1';
  refreshHunkInspectionControl();
});
snapshotHunkIndex.addEventListener('input', () => {
  clearHunkInspection();
  snapshotHunkPage.value = '1';
  refreshHunkInspectionControl();
});
snapshotHunkPage.addEventListener('input', () => {
  clearHunkInspection();
  refreshHunkInspectionControl();
});
snapshotHunkContext.addEventListener('change', () => {
  clearHunkInspection();
  refreshHunkInspectionControl();
});
function openHunkInspection() {
  if (snapshotHunkOpen.disabled || !latestSnapshotComparison ||
      !ensureLiveSnapshotComparisonFresh('raw')) return;
  try {
    const report = latestSnapshotComparison;
    const from = comparisonWorkspaceEntry(report.from.id);
    const to = comparisonWorkspaceEntry(report.to.id);
    if (!from || !to) {
      clearHunkInspection();
      snapshotCompareMessage('A selected snapshot is no longer available.', true);
      return;
    }
    const result = inspectSnapshotHunk(from, to, snapshotHunkEditor.value,
      Number(snapshotHunkIndex.value), Number(snapshotHunkContext.value),
      Number(snapshotHunkPage.value));
    // Revalidate against current live editors before publishing the result.
    if (!ensureLiveSnapshotComparisonFresh('raw')) return;
    latestHunkInspection = result;
    const h = result.summary;
    const range = (a,b) => a === null ? '—' :
      a === b ? String(a) : a + '–' + b;
    snapshotHunkInspectionSummary.textContent =
      result.editor.label + ', hunk ' + h.index + '/' +
      result.alignment.total_hunks + ' · ' + result.alignment.strategy +
      ' alignment · earlier lines ' + range(h.from_start,h.from_end) +
      ', later lines ' + range(h.to_start,h.to_end) + '. ' +
      h.total_rows + ' changed rows (' + h.added + ' added, ' +
      h.removed + ' removed, ' + h.changed + ' changed); ' +
      'page ' + result.window.page + '/' + result.window.total_pages +
      ' (changed rows ' + result.window.first_changed_row + '–' +
      result.window.last_changed_row + ' of ' + h.total_rows + '); ' +
      h.preview_rows + ' changed-line previews, ' + h.omitted_rows +
      ' outside this page; ' + result.context.before_lines_shown +
      ' context lines before and ' + result.context.after_lines_shown +
      ' after. Raw text only; no JSON Patch executed.';
    const fragment = document.createDocumentFragment();
    let changedRowIndex = 0;
    let highlightedRow = null;
    for (const line of result.details) {
      const tr = document.createElement('tr');
      tr.className = 'snapshot-line-' + line.change_type;
      if (line.change_type !== 'context') {
        const rowInHunk = result.window.first_changed_row + changedRowIndex++;
        const hit = activeHunkSearchHit;
        if (hit && hit.editor === result.editor.id &&
            hit.hunk_index === h.index && hit.row_in_hunk === rowInHunk &&
            hit.from_line === line.from_line && hit.to_line === line.to_line) {
          tr.classList.add('snapshot-hunk-search-hit');
          tr.setAttribute('aria-current', 'true');
          tr.tabIndex = -1;
          highlightedRow = tr;
        }
      }
      for (const value of [
        line.change_type,
        line.from_line === null ? '—' : String(line.from_line),
        line.from_present ? line.from_preview : '(not present)',
        line.to_line === null ? '—' : String(line.to_line),
        line.to_present ? line.to_preview : '(not present)'
      ]) tr.append(cell('td', value));
      fragment.append(tr);
    }
    snapshotHunkInspectionRows.replaceChildren(fragment);
    snapshotHunkInspection.hidden = false;
    if (highlightedRow) {
      highlightedRow.focus({ preventScroll: true });
      highlightedRow.scrollIntoView({ block: 'center' });
    }
    activeHunkSearchHit = null;
    snapshotHunkPage.max = String(result.window.total_pages);
    snapshotHunkPageInfo.textContent =
      'Page ' + result.window.page + ' of ' +
      result.window.total_pages + ' · ' +
      result.window.first_changed_row + '–' +
      result.window.last_changed_row + ' / ' +
      h.total_rows + ' changed rows';
    refreshHunkInspectionControl();
    snapshotHunkDownloadJson.disabled = false;
    snapshotHunkDownloadCsv.disabled = false;
    snapshotCompareMessage('Hunk inspection generated locally with bounded previews.');
  } catch (error) {
    clearHunkInspection();
    snapshotCompareMessage('Could not inspect hunk: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
snapshotHunkOpen.addEventListener('click', openHunkInspection);
snapshotHunkPrevious.addEventListener('click', () => {
  if (snapshotHunkPrevious.disabled) return;
  snapshotHunkIndex.value = String(Number(snapshotHunkIndex.value) - 1);
  snapshotHunkPage.value = '1';
  clearHunkInspection();
  refreshHunkInspectionControl();
  openHunkInspection();
});
snapshotHunkNext.addEventListener('click', () => {
  if (snapshotHunkNext.disabled) return;
  snapshotHunkIndex.value = String(Number(snapshotHunkIndex.value) + 1);
  snapshotHunkPage.value = '1';
  clearHunkInspection();
  refreshHunkInspectionControl();
  openHunkInspection();
});
snapshotHunkPagePrevious.addEventListener('click', () => {
  if (snapshotHunkPagePrevious.disabled) return;
  snapshotHunkPage.value = String(Number(snapshotHunkPage.value) - 1);
  clearHunkInspection();
  refreshHunkInspectionControl();
  openHunkInspection();
});
snapshotHunkPageNext.addEventListener('click', () => {
  if (snapshotHunkPageNext.disabled) return;
  snapshotHunkPage.value = String(Number(snapshotHunkPage.value) + 1);
  clearHunkInspection();
  refreshHunkInspectionControl();
  openHunkInspection();
});
snapshotHunkDownloadJson.addEventListener('click', () => {
  if (!latestHunkInspection || !ensureLiveSnapshotComparisonFresh('raw')) return;
  try {
    downloadReport(serializeHunkInspectionJson(latestHunkInspection),
      'snapshot-hunk-inspection.json', 'application/json;charset=utf-8');
    snapshotCompareMessage('Hunk inspection JSON download initiated.');
  } catch (error) {
    snapshotCompareMessage('Hunk inspection JSON export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
snapshotHunkDownloadCsv.addEventListener('click', () => {
  if (!latestHunkInspection || !ensureLiveSnapshotComparisonFresh('raw')) return;
  try {
    downloadReport(serializeHunkInspectionCsv(latestHunkInspection),
      'snapshot-hunk-inspection.csv', 'text/csv;charset=utf-8');
    snapshotCompareMessage('Hunk inspection CSV download initiated.');
  } catch (error) {
    snapshotCompareMessage('Hunk inspection CSV export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});

function renderSnapshotRawHunkChooser(report) {
  const options = document.createDocumentFragment();
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = 'All captured change hunks';
  options.append(all);
  let selectable = 0;
  for (const section of report.sections) {
    if (section.kind !== 'raw-text') continue;
    for (const hunk of section.hunk_summaries) {
      // Keep the chooser honest: hunks outside the bounded detail preview
      // have only metadata; selecting them would show an empty table.
      if (!hunk.preview_rows) continue;
      const option = document.createElement('option');
      option.value = section.id + ':' + hunk.index;
      const range = (a,b) => a === null ? '—' :
        a === b ? String(a) : a + '–' + b;
      option.textContent = section.label + ' · Hunk ' + hunk.index +
        ' (earlier ' + range(hunk.from_start,hunk.from_end) +
        ', later ' + range(hunk.to_start,hunk.to_end) +
        ', ' + hunk.total_rows + ' changed rows)';
      options.append(option);
      selectable++;
    }
  }
  snapshotCompareHunk.replaceChildren(options);
  snapshotCompareHunk.value = 'all';
  snapshotCompareHunk.disabled = selectable === 0;
  snapshotCompareHunkSummary.textContent =
    report.summary.total_hunks + ' change hunks detected; ' + selectable +
    ' have bounded preview rows available for direct selection. ' +
    report.summary.omitted_hunk_summaries +
    ' additional hunks have no stored metadata. Hunk boundaries come from ' +
    'the selected LCS or positional-fallback alignment, not JSON semantics.';
}
function renderSnapshotComparison() {
  const report = latestSnapshotComparison;
  if (!report || !ensureLiveSnapshotComparisonFresh('raw')) return;
  snapshotCompareResults.hidden = false;
  snapshotCompareSummary.textContent =
    'READ-ONLY RAW DRAFT COMPARISON. ' + report.from.name + ' → ' +
    report.to.name + ': ' + report.summary.changed_sections + '/' +
    report.summary.total_sections + ' sections changed; ' +
    report.summary.changed_option_fields + ' settings changed; ' +
    report.summary.recorded_preview_rows + ' preview rows; ' +
    report.summary.omitted_middle_rows + ' additional change rows omitted. ' +
    'Lines: ' + report.summary.added_lines + ' added, ' +
    report.summary.removed_lines + ' removed, ' +
    report.summary.changed_lines + ' changed. ' +
    report.summary.lcs_editors + ' editors used bounded LCS alignment; ' +
    report.summary.positional_fallback_editors + ' used positional fallback. ' +
    'This is a raw-text comparison, not JSON semantics. No patch executed.';
  const fragment = document.createDocumentFragment();
  for (const section of report.sections) {
    const row = document.createElement('tr');
    const summary = section.kind === 'raw-text' ?
      section.from_bytes.toLocaleString() + ' → ' +
      section.to_bytes.toLocaleString() + ' bytes; ' +
      section.from_lines + ' → ' + section.to_lines + ' lines; ' +
      section.alignment_strategy + ' · ' + section.hunk_count +
      ' hunks · +' + section.added_rows +
      ' / −' + section.removed_rows + ' / ~' + section.changed_rows :
      section.changed_options + ' of ' + section.option_count + ' settings changed';
    for (const v of [section.label, section.changed ? 'Changed' : 'Identical', summary,
      String(section.shown_rows) + (section.omitted_rows ?
        ' (+' + section.omitted_rows + ' omitted)' : '')]) {
      row.append(cell('td', v));
    }
    fragment.append(row);
  }
  snapshotCompareSections.replaceChildren(fragment);
  renderSnapshotRawHunkChooser(report);
  clearHunkSearch();
  refreshHunkSearchControl();
  clearHunkInspection();
  snapshotHunkIndex.value = '1';
  snapshotHunkPage.value = '1';
  refreshHunkInspectionControl();
  renderSnapshotComparisonDetails();
}
function renderSnapshotComparisonDetails() {
  const report = latestSnapshotComparison;
  if (!report || !ensureLiveSnapshotComparisonFresh('raw')) return;
  const area = snapshotCompareArea.value;
  const changeKind = snapshotCompareChangeKind.value;
  const selectedHunk = snapshotCompareHunk.value || 'all';
  const rows = report.details.filter(item =>
    (area === 'all' || item.section === area) &&
    (changeKind === 'all' || item.change_type === changeKind) &&
    (selectedHunk === 'all' ||
      item.section + ':' + item.hunk_index === selectedHunk));
  const fragment = document.createDocumentFragment();
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = cell('td', 'No differing preview rows in this section.', 'empty');
    td.colSpan = 7;
    tr.append(td);
    fragment.append(tr);
  } else for (const item of rows) {
    const tr = document.createElement('tr');
    tr.className = 'snapshot-line-' + item.change_type;
    for (const value of [
      item.hunk_index === null ? '—' : String(item.hunk_index),
      item.change_type,
      item.field,
      item.from_line === null ? '—' : String(item.from_line),
      item.from_present ? item.from_preview : '(not present)',
      item.to_line === null ? '—' : String(item.to_line),
      item.to_present ? item.to_preview : '(not present)'
    ]) tr.append(cell('td', value));
    fragment.append(tr);
  }
  snapshotCompareRows.replaceChildren(fragment);
}
for (const control of [snapshotCompareFrom, snapshotCompareTo]) {
  control.addEventListener('change', () => {
    invalidateSessionSnapshotComparison();
    refreshSnapshotCompareAction();
  });
}
snapshotCompareArea.addEventListener('change', () => {
  snapshotCompareHunk.value = 'all';
  renderSnapshotComparisonDetails();
});
snapshotCompareChangeKind.addEventListener('change', renderSnapshotComparisonDetails);
snapshotCompareHunk.addEventListener('change', () => {
  const chosen = snapshotCompareHunk.value;
  if (chosen !== 'all') {
    const [editor, index] = chosen.split(':');
    snapshotCompareArea.value = editor;
    snapshotHunkEditor.value = editor;
    snapshotHunkIndex.value = index;
    snapshotHunkPage.value = '1';
    clearHunkInspection();
    refreshHunkInspectionControl();
  }
  renderSnapshotComparisonDetails();
});
snapshotCompareRun.addEventListener('click', () => {
  if (snapshotCompareRun.disabled) return;
  try {
    const before = comparisonWorkspaceEntry(snapshotCompareFrom.value);
    const after = comparisonWorkspaceEntry(snapshotCompareTo.value);
    if (!before || !after || before.id === after.id) return;
    latestSnapshotComparison = compareSnapshotWorkspaces(before, after);
    snapshotRawLiveBasis = liveBasisForPair(before, after);
    renderSnapshotComparison();
    snapshotCompareJson.disabled = false;
    snapshotCompareCsv.disabled = false;
    snapshotCompareMessage('Snapshot comparison created locally. Exports include bounded previews, not entire drafts.');
  } catch (error) {
    invalidateSessionSnapshotComparison();
    snapshotCompareMessage('Could not compare saved snapshots: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
snapshotCompareJson.addEventListener('click', () => {
  if (!latestSnapshotComparison || !ensureLiveSnapshotComparisonFresh('raw')) return;
  try {
    downloadReport(serializeSnapshotComparisonJson(latestSnapshotComparison),
      'snapshot-raw-comparison.json', 'application/json;charset=utf-8');
    snapshotCompareMessage('Comparison JSON download initiated.');
  } catch (error) {
    snapshotCompareMessage('JSON export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
snapshotCompareCsv.addEventListener('click', () => {
  if (!latestSnapshotComparison || !ensureLiveSnapshotComparisonFresh('raw')) return;
  try {
    downloadReport(serializeSnapshotComparisonCsv(latestSnapshotComparison),
      'snapshot-raw-comparison.csv', 'text/csv;charset=utf-8');
    snapshotCompareMessage('Comparison CSV download initiated.');
  } catch (error) {
    snapshotCompareMessage('CSV export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});

function renderSessionSnapshotControls(preferredId = '') {
  invalidateSessionSnapshotComparison();
  const items = sessionSnapshots.list();
  const previousId = preferredId || workspaceSnapshotSelect.value;
  workspaceSnapshotSelect.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = items.length ? 'Choose a saved snapshot' : 'No session snapshots';
  workspaceSnapshotSelect.append(placeholder);
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name + ' (' + formatBytes(item.bytes) + ')';
    workspaceSnapshotSelect.append(option);
  }
  if (items.some(item => item.id === previousId)) {
    workspaceSnapshotSelect.value = previousId;
  }
  workspaceSnapshotSelect.disabled = items.length === 0;
  populateSnapshotCompareSelects(items);
  const selected = selectedSessionSnapshot() !== null;
  workspaceSnapshotPreview.disabled = !selected;
  workspaceSnapshotDownload.disabled = !selected;
  workspaceSnapshotDelete.disabled = !selected;
  workspaceSnapshotRename.disabled = !selected;
  workspaceSnapshotRenameName.disabled = !selected;
  workspaceSnapshotRecapture.disabled = !selected;
  workspaceSnapshotRenameName.value = selected ?
    selectedSessionSnapshot().name : '';
  const usage = sessionSnapshots.usage();
  workspaceSnapshotSave.disabled = usage.count >= usage.maxCount;
  workspaceCollectionExport.disabled = usage.count === 0;
  workspaceSnapshotSummary.textContent =
    usage.count + '/' + usage.maxCount + ' manual snapshots · ' +
    formatBytes(usage.bytes) + ' of 24 MiB in tab memory. ' +
    'Closing or refreshing this tab discards them. Download one to preserve it.';
}
workspaceSnapshotSelect.addEventListener('change', () => renderSessionSnapshotControls());
workspaceSnapshotSave.addEventListener('click', () => {
  try {
    const contents = serializeWorkspace(currentWorkspaceValues());
    const name = workspaceSnapshotName.value.trim() ||
      'Snapshot ' + (sessionSnapshots.usage().count + 1);
    const entry = sessionSnapshots.add(name, contents);
    discardCollectionPreview();
    renderSessionSnapshotControls(entry.id);
    workspaceMessage('Saved “' + entry.name +
      '” in this tab only. Download it to keep it after a reload.');
  } catch (error) {
    workspaceMessage('Could not save session snapshot: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
workspaceSnapshotRename.addEventListener('click', () => {
  const entry = selectedSessionSnapshot();
  if (!entry) return;
  const proposed = workspaceSnapshotRenameName.value.trim();
  if (proposed === entry.name) {
    workspaceMessage('Snapshot already has that name. No change made.');
    return;
  }
  if (!proposed) {
    workspaceMessage('Enter a nonempty name for the selected snapshot.', true);
    return;
  }
  if (!confirm('Rename the in-tab snapshot “' + entry.name + '” to “' +
      proposed + '”? The stored editor content will not change.')) return;
  try {
    const result = sessionSnapshots.rename(entry.id, proposed, entry.name);
    if (result.changed) {
      // Existing import previews can show original names and are no longer
      // current. A staged restore of this point also carries its old label.
      discardCollectionPreview();
      if (stagedWorkspace?.sessionSnapshotId === entry.id) {
        discardWorkspaceStaging('Saved snapshot renamed; reopen its restore preview.');
      }
      renderSessionSnapshotControls(entry.id);
    }
    workspaceMessage('Snapshot renamed to “' + result.name +
      '”. Its contents and stable in-tab identity are unchanged.');
  } catch (error) {
    workspaceMessage('Could not rename snapshot: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
workspaceSnapshotRecapture.addEventListener('click', () => {
  const entry = selectedSessionSnapshot();
  if (!entry) return;
  let contents;
  try {
    contents = serializeWorkspace(currentWorkspaceValues());
    if (contents === entry.content) {
      workspaceMessage('Selected snapshot already matches the current workspace.');
      return;
    }
    // Preflight aggregate memory before asking permission and writing data.
    const projected = sessionSnapshots.usage().bytes -
      entry.bytes + new TextEncoder().encode(contents).byteLength;
    if (projected > sessionSnapshots.usage().maxBytes) {
      throw new RangeError('Updating this snapshot would exceed 24 MiB. ' +
        'Reduce document size or delete another snapshot.');
    }
  } catch (error) {
    workspaceMessage('Could not prepare snapshot update: ' +
      (error instanceof Error ? error.message : 'invalid workspace'), true);
    return;
  }
  if (!confirm('Replace the saved contents of “' + entry.name +
      '” with the current Before, After, Patch and settings? ' +
      'This overwrites the in-tab snapshot, NOT your current editors. ' +
      'Download the old snapshot first if you need to retain it.')) return;
  try {
    // An unrelated import or programmatic change may have occurred during a
    // native confirmation; avoid overwriting with an obsolete capture.
    if (selectedSessionSnapshot()?.id !== entry.id ||
        serializeWorkspace(currentWorkspaceValues()) !== contents) {
      workspaceMessage('Current selection or editor contents changed. Update canceled.', true);
      return;
    }
    const result = sessionSnapshots.replaceContent(entry.id, contents, entry.content);
    if (result.changed) {
      discardCollectionPreview();
      if (stagedWorkspace?.sessionSnapshotId === entry.id) {
        discardWorkspaceStaging('Saved snapshot updated; reopen its restore preview.');
      }
      renderSessionSnapshotControls(entry.id);
    }
    workspaceMessage('Updated “' + result.name +
      '” from the current editor drafts. Editors unchanged; no patch executed.');
  } catch (error) {
    workspaceMessage('Could not update snapshot: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
workspaceSnapshotPreview.addEventListener('click', () => {
  const entry = selectedSessionSnapshot();
  if (!entry) return;
  try {
    // A new preview supersedes pending file imports. It does not write into
    // an editor until the user separately confirms the existing restore UI.
    discardWorkspaceStaging();
    invalidateAllEditorImports();
    patchImportSequence++;
    bundleImportSequence++;
    const values = parseWorkspace(entry.content);
    stageWorkspace(values, 'Session snapshot: ' + entry.name,
      currentWorkspaceValues());
    stagedWorkspace.sessionSnapshotId = entry.id;
    workspaceMessage('Snapshot preview ready. Select sections and apply only if desired.');
    workspacePreview.scrollIntoView({ block: 'nearest' });
  } catch (error) {
    workspaceMessage('Could not open session snapshot: ' +
      (error instanceof Error ? error.message : 'invalid workspace'), true);
  }
});
workspaceSnapshotDownload.addEventListener('click', () => {
  const entry = selectedSessionSnapshot();
  if (!entry) return;
  try {
    downloadReport(entry.content, 'json-diff-view-snapshot-' + entry.id + '.json',
      'application/json;charset=utf-8');
    workspaceMessage('Snapshot download initiated. Check your Downloads folder.');
  } catch (error) {
    workspaceMessage('Could not download snapshot: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
workspaceSnapshotDelete.addEventListener('click', () => {
  const entry = selectedSessionSnapshot();
  if (!entry) return;
  if (!confirm('Delete the in-tab snapshot “' + entry.name +
    '”? This does not change any editor, but the snapshot will be lost ' +
    'unless you have downloaded it.')) return;
  if (stagedWorkspace?.sessionSnapshotId === entry.id) {
    discardWorkspaceStaging('Deleted the snapshot that was being previewed.');
  }
  sessionSnapshots.remove(entry.id);
  discardCollectionPreview();
  renderSessionSnapshotControls();
  workspaceMessage('Session snapshot deleted. Current editors were not modified.');
});
// Session collections are explicit portable files, never automatic storage.
// A collection import changes *only* named in-tab snapshots, never editors.
workspaceCollectionExport.addEventListener('click', () => {
  try {
    const items = sessionSnapshots.list().map(item => sessionSnapshots.read(item.id));
    const content = serializeSnapshotCollection(items);
    downloadReport(content, 'json-diff-view-session-collection.json',
      'application/json;charset=utf-8', MAX_COLLECTION_BYTES);
    workspaceMessage('Collection export initiated with ' + items.length +
      ' snapshots. Check your browser Downloads folder.');
  } catch (error) {
    workspaceMessage('Could not export snapshot collection: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
function clearCollectionPreview() {
  stagedCollection = null;
  workspaceCollectionPreviewPanel.hidden = true;
  workspaceCollectionPreviewRows.replaceChildren();
  workspaceCollectionPreviewSummary.textContent = '';
  workspaceCollectionPreviewSummary.classList.remove('error');
  workspaceCollectionApply.disabled = true;
}
function discardCollectionPreview(message = '') {
  collectionImportGeneration++;
  const hadPreview = stagedCollection !== null;
  clearCollectionPreview();
  if (hadPreview && message) workspaceMessage(message);
}
function selectedCollectionEntries() {
  const staged = stagedCollection;
  if (!staged) return [];
  return staged.entries.filter((entry, index) => staged.checked[index].checked);
}
function refreshCollectionPreview() {
  if (!stagedCollection) return;
  const selected = selectedCollectionEntries();
  const existing = sessionSnapshots.list();
  const replace = workspaceCollectionMode.value === 'replace';
  const duplicateNames = new Set(existing.map(item => item.name));
  const collisions = selected.filter(item => duplicateNames.has(item.name)).length;
  let message = stagedCollection.fileName + ': ' + selected.length +
    ' of ' + stagedCollection.entries.length + ' snapshots selected. ';
  if (!selected.length) {
    message += 'Select at least one entry to import.';
    workspaceCollectionApply.disabled = true;
    workspaceCollectionPreviewSummary.classList.add('error');
  } else {
    try {
      const plan = sessionSnapshots.planImport(selected, { replace });
      message += (replace ? 'Replace ' + existing.length + ' existing snapshots; ' :
        'Keep ' + existing.length + ' existing snapshots; ') +
        'result: ' + plan.combinedCount + '/8 snapshots, ' +
        formatBytes(plan.combinedBytes) + ' of 24 MiB.';
      if (!replace && collisions) message += ' ' + collisions +
        ' selected names already exist; they will be added as separate snapshots.';
      workspaceCollectionApply.disabled = false;
      workspaceCollectionPreviewSummary.classList.remove('error');
    } catch (error) {
      message += (error instanceof Error ? error.message : 'Invalid selection');
      workspaceCollectionApply.disabled = true;
      workspaceCollectionPreviewSummary.classList.add('error');
    }
  }
  message += ' No editors will be modified.';
  workspaceCollectionPreviewSummary.textContent = message;
}
function stageCollectionPreview(items, fileName) {
  clearCollectionPreview();
  const checked = [];
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = document.createElement('tr');
    const selectCell = document.createElement('td');
    const label = document.createElement('label');
    label.className = 'workspace-collection-entry';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.setAttribute('aria-label', 'Import snapshot ' + (i + 1) + ': ' + item.name);
    checkbox.addEventListener('change', refreshCollectionPreview);
    checked.push(checkbox);
    label.append(checkbox, document.createTextNode(item.name));
    selectCell.append(label);
    const sizeCell = document.createElement('td');
    sizeCell.textContent = formatBytes(new TextEncoder().encode(item.content).byteLength);
    const statusCell = document.createElement('td');
    statusCell.textContent = sessionSnapshots.list().some(x => x.name === item.name) ?
      'Name already in tab' : 'New name';
    row.append(selectCell, sizeCell, statusCell);
    fragment.append(row);
  }
  stagedCollection = { entries: items, checked, fileName };
  workspaceCollectionPreviewRows.replaceChildren(fragment);
  workspaceCollectionPreviewPanel.hidden = false;
  refreshCollectionPreview();
}
workspaceCollectionImport.addEventListener('click', () => workspaceCollectionFile.click());
workspaceCollectionMode.addEventListener('change', () => {
  // Switching the mode while a file is reading supersedes that request.
  // Once staged, switching Append/Replace recalculates the proposed result.
  if (stagedCollection) refreshCollectionPreview();
  else collectionImportGeneration++;
});
workspaceCollectionFile.addEventListener('change', event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) void importSessionCollection(file);
});
workspaceCollectionSelectAll.addEventListener('click', () => {
  if (!stagedCollection) return;
  for (const box of stagedCollection.checked) box.checked = true;
  refreshCollectionPreview();
});
workspaceCollectionSelectNone.addEventListener('click', () => {
  if (!stagedCollection) return;
  for (const box of stagedCollection.checked) box.checked = false;
  refreshCollectionPreview();
});
workspaceCollectionCancel.addEventListener('click', () =>
  discardCollectionPreview('Collection import canceled; existing snapshots preserved.'));
async function importSessionCollection(file) {
  discardCollectionPreview();
  const request = ++collectionImportGeneration;
  const mode = workspaceCollectionMode.value;
  if (file.size > MAX_COLLECTION_BYTES) {
    workspaceMessage('Snapshot collection exceeds the 32 MiB file limit.', true);
    return;
  }
  workspaceMessage('Reading snapshot collection locally. No editors are changed.');
  try {
    const text = await file.text();
    if (request !== collectionImportGeneration || mode !== workspaceCollectionMode.value) return;
    const items = parseSnapshotCollection(text);
    if (request !== collectionImportGeneration) return;
    stageCollectionPreview(items, file.name);
    workspaceMessage('Collection ready for review. Choose snapshots to import.');
    workspaceCollectionPreviewPanel.scrollIntoView({ block: 'nearest' });
  } catch (error) {
    if (request === collectionImportGeneration) workspaceMessage(
      'Could not open snapshot collection: ' +
      (error instanceof Error ? error.message : 'invalid collection'), true);
  }
}
workspaceCollectionApply.addEventListener('click', () => {
  const staged = stagedCollection;
  if (!staged) return;
  const selected = selectedCollectionEntries();
  const replace = workspaceCollectionMode.value === 'replace';
  let plan;
  try {
    plan = sessionSnapshots.planImport(selected, { replace });
  } catch (error) {
    refreshCollectionPreview();
    workspaceMessage('Snapshot selection cannot be imported: ' +
      (error instanceof Error ? error.message : 'invalid selection'), true);
    return;
  }
  if (!confirm('Import ' + selected.length + ' of ' + staged.entries.length +
      ' snapshots from “' + staged.fileName + '”? ' +
      (replace ? 'REPLACE the existing in-tab snapshots' :
        'APPEND to the existing in-tab snapshots') + ', resulting in ' +
      plan.combinedCount + ' snapshots using ' +
      formatBytes(plan.combinedBytes) + '. ' +
      (replace ? 'Existing snapshots will be lost unless downloaded. ' : '') +
      'No editor or JSON Patch will be changed or executed.')) {
    workspaceMessage('Collection import not applied. Edit the selection or cancel.');
    return;
  }
  if (staged !== stagedCollection) return;
  try {
    // Recheck all capacity constraints immediately before the atomic
    // mutation; no editor contents or imported patch programs are touched.
    const created = sessionSnapshots.addMany(selected, { replace });
    discardCollectionPreview();
    if (replace && stagedWorkspace?.sessionSnapshotId) discardWorkspaceStaging(
      'Session collection replaced; previous snapshot preview canceled.');
    renderSessionSnapshotControls(created[0]?.id ?? '');
    workspaceMessage('Imported ' + created.length + ' selected snapshots (' +
      (replace ? 'replaced' : 'appended') + '). Editors unchanged. ' +
      'Download your collection to keep it after a reload.');
  } catch (error) {
    refreshCollectionPreview();
    workspaceMessage('Collection import failed without changing snapshots: ' +
      (error instanceof Error ? error.message : 'invalid selection'), true);
  }
});
renderSessionSnapshotControls();

function stagedWorkspaceIsCurrent(staged) {
  return !!staged && staged === stagedWorkspace &&
    !workspaceChanged(staged.snapshot, currentWorkspaceValues());
}
function downloadPreRestoreWorkspace(staged) {
  // A complete, portable v1 file: both unselected and selected editor drafts
  // are captured, so restoring it later can recover the entire prior session.
  const serialized = serializeWorkspace(staged.snapshot);
  downloadReport(serialized, 'json-diff-view-before-restore.json',
    'application/json;charset=utf-8');
}
workspaceBackupButton.addEventListener('click', () => {
  const staged = stagedWorkspace;
  if (!stagedWorkspaceIsCurrent(staged)) {
    discardWorkspaceStaging('Current contents changed. Reopen the saved workspace before backing up.');
    return;
  }
  try {
    downloadPreRestoreWorkspace(staged);
    workspaceMessage('Pre-restore workspace backup download initiated. ' +
      'Check your browser downloads before restoring.');
  } catch (error) {
    workspaceMessage('Could not prepare pre-restore backup: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
async function importWorkspace(file) {
  discardWorkspaceStaging();
  if (file.size > MAX_REPORT_EXPORT_BYTES) {
    workspaceMessage('Workspace file exceeds the 8 MiB limit.', true);
    return;
  }
  const request = ++workspaceImportSequence;
  // A newly selected file supersedes outstanding source, patch and bundle
  // imports. The preview is read-only until Apply selected is clicked.
  invalidateAllEditorImports();
  const beforeVersion = editorImportVersions.get(beforeEditor);
  const afterVersion = editorImportVersions.get(afterEditor);
  const patchVersion = ++patchImportSequence;
  const bundleVersion = ++bundleImportSequence;
  const snapshot = currentWorkspaceValues();
  const current = () => request === workspaceImportSequence &&
    beforeVersion === editorImportVersions.get(beforeEditor) &&
    afterVersion === editorImportVersions.get(afterEditor) &&
    patchVersion === patchImportSequence &&
    bundleVersion === bundleImportSequence &&
    !workspaceChanged(snapshot, currentWorkspaceValues());
  workspaceMessage('Reading workspace locally. No editor has been modified.');
  try {
    const text = await file.text();
    if (!current()) return;
    const restored = parseWorkspace(text);
    if (!current()) return;
    stageWorkspace(restored, file.name, snapshot);
    workspaceMessage('Workspace ready for review. Choose sections and Apply selected.');
  } catch (error) {
    if (current()) workspaceMessage('Could not open workspace: ' +
      (error instanceof Error ? error.message : 'invalid workspace'), true);
  }
}
workspaceApplyButton.addEventListener('click', () => {
  const staged = stagedWorkspace;
  if (!staged) return;
  const selected = workspaceSections.filter(section => section.checkbox.checked);
  if (!selected.length) {
    workspaceMessage('Select at least one workspace section to restore.', true);
    return;
  }
  // User and competing file imports may update values programmatically
  // without dispatching input/change events. Never overwrite such changes
  // using a stale preview.
  if (workspaceChanged(staged.snapshot, currentWorkspaceValues())) {
    discardWorkspaceStaging(
      'Current editor contents or settings changed. Open the workspace again.');
    return;
  }
  const changes = selected.filter(section =>
    workspaceSectionChanges(section, staged.snapshot, staged.values) > 0);
  if (!changes.length) {
    discardWorkspaceStaging('Selected sections are already identical. No changes made.');
    return;
  }
  if (!confirm('Restore ' + changes.map(section => section.name).join(', ') +
      '? Only checked sections will be replaced; unsaved changes in those ' +
      'sections will be lost.' +
      (workspaceAutoBackup.checked ?
        ' A local backup download of the current complete workspace will be initiated first.' : '') +
      ' No JSON comparison or patch execution will run.')) {
    workspaceMessage('Restore not applied. Change your selection or cancel.');
    return;
  }
  if (workspaceChanged(staged.snapshot, currentWorkspaceValues())) {
    discardWorkspaceStaging('Current values changed before restore. Open the file again.');
    return;
  }
  // Export the full pre-restore workspace BEFORE overwriting any field.
  // Failure to serialize or initiate the download aborts the operation.
  // Browser download settings ultimately control whether a file is saved.
  const backupRequested = workspaceAutoBackup.checked;
  if (backupRequested) {
    try {
      downloadPreRestoreWorkspace(staged);
    } catch (error) {
      workspaceMessage('Restore canceled: backup could not be prepared. ' +
        (error instanceof Error ? error.message : 'unknown error'), true);
      return;
    }
  }
  // Capture exact changed keys before replacing editor values. Unchecked
  // sections and identical fields must never be part of undo.
  const changedKeys = changes.flatMap(section =>
    section.keys.filter(key => staged.snapshot[key] !== staged.values[key]));
  const undo = {
    before: Object.fromEntries(changedKeys.map(key => [key, staged.snapshot[key]])),
    after: Object.fromEntries(changedKeys.map(key => [key, staged.values[key]])),
    keys: changedKeys,
    sections: changes.map(section => section.name)
  };
  // Commit selected replacements as one user-approved action. Cancel any
  // outstanding asynchronous editor/patch/bundle imports first.
  discardWorkspaceStaging();
  invalidateAllEditorImports();
  patchImportSequence++;
  bundleImportSequence++;
  const data = staged.values;
  if (workspaceRestoreBefore.checked) beforeEditor.value = data.beforeText;
  if (workspaceRestoreAfter.checked) afterEditor.value = data.afterText;
  if (workspaceRestorePatch.checked) patchSource.value = data.patchText;
  if (workspaceRestoreOptions.checked) {
    patchBase.value = data.patchBase;
    patchDirection.value = data.patchDirection;
    guardPatchCheckbox.checked = data.guardPatch;
    guardRangePatchCheckbox.checked = data.guardRangePatch;
    rangeStartInput.value = data.rangeStart;
    rangeEndInput.value = data.rangeEnd;
    stepCountInput.value = data.stepCount;
  }
  invalidateInspection();
  resetReport();
  invalidateImportedFailure('Workspace sections restored. Import a failure bundle to verify one.');
  updateResultTarget();
  setStatus('Selected workspace sections restored. Compare JSON to refresh the report.');
  patchMessage('Prior patch preview cleared. Run Preview applying patch explicitly.');
  latestWorkspaceUndo = undo;
  workspaceUndoButton.disabled = false;
  workspaceUndoButton.title = 'Revert the last restored fields only; unrelated edits are preserved.';
  workspaceMessage('Selected workspace sections restored. Other sections were preserved. ' +
    (backupRequested ? 'Pre-restore backup download initiated; verify it in your Downloads folder. ' : '') +
    'Undo restore is available until any restored field changes. ' +
    'No JSON was parsed and no patch was executed.');
});
workspaceUndoButton.addEventListener('click', () => {
  const undo = currentWorkspaceUndo();
  if (!undo) return;
  if (!confirm('Undo the last workspace restore for ' +
      undo.sections.join(', ') + '? Only the fields changed by that restore ' +
      'will be reverted. Other fields stay unchanged. No patch will run.')) return;
  // A programmatic editor update or import may not emit an input event.
  if (!currentWorkspaceUndo()) return;
  // Abort any outstanding async file imports, including an in-flight
  // workspace import. This is one explicit, user-confirmed editor action.
  discardWorkspaceStaging();
  invalidateAllEditorImports();
  patchImportSequence++;
  bundleImportSequence++;
  const old = undo.before, keys = undo.keys;
  if (keys.includes('beforeText')) beforeEditor.value = old.beforeText;
  if (keys.includes('afterText')) afterEditor.value = old.afterText;
  if (keys.includes('patchText')) patchSource.value = old.patchText;
  if (keys.includes('patchBase')) patchBase.value = old.patchBase;
  if (keys.includes('patchDirection')) patchDirection.value = old.patchDirection;
  if (keys.includes('guardPatch')) guardPatchCheckbox.checked = old.guardPatch;
  if (keys.includes('guardRangePatch')) guardRangePatchCheckbox.checked = old.guardRangePatch;
  if (keys.includes('rangeStart')) rangeStartInput.value = old.rangeStart;
  if (keys.includes('rangeEnd')) rangeEndInput.value = old.rangeEnd;
  if (keys.includes('stepCount')) stepCountInput.value = old.stepCount;
  clearWorkspaceUndo();
  invalidateInspection();
  resetReport();
  invalidateImportedFailure('Workspace restore undone. Import a failure bundle to verify one.');
  updateResultTarget();
  setStatus('Workspace restore undone. Select Compare JSON to refresh results.');
  patchMessage('Patch preview cleared after undo. Preview again to execute explicitly.');
  workspaceMessage('The last workspace restore was undone. Unrelated changes remain; ' +
    'no JSON was parsed and no patch was executed.');
});

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

// Multi-archive review is an offline, read-only workflow. The user must
// choose ordered, date-prefixed filenames; filenames—not timestamps or picker
// order—are the sole source of chronology.
function historyMessage(message, error = false) {
  evidenceHistoryStatus.textContent = message;
  evidenceHistoryStatus.classList.toggle('error', error);
}
// Individual history comparisons are inspected only on user request.
// Saved-file handles are retained for reading selected pairs (adjacent,
// first-baseline, or arbitrary older/newer selections), while history JSON/CSV
// exports stay summarized.
function invalidateHistoryDetail() {
  historyDetailRequest++;
  latestEvidenceHistoryDetail = null;
  evidenceHistoryDetailPage = 0;
  evidenceHistoryDetailPanel.hidden = true;
  evidenceHistoryDetailSummary.textContent = '';
  evidenceHistoryDetailRows.replaceChildren();
  evidenceHistoryDetailPath.value = '';
  evidenceHistoryDetailType.value = 'all';
  evidenceHistoryDetailScope.value = 'all';
  evidenceHistoryDetailNav.hidden = true;
  evidenceHistoryDetailCopyButton.disabled = true;
  evidenceHistoryDetailJsonButton.disabled = true;
  evidenceHistoryDetailCsvButton.disabled = true;
}
function currentHistoryDetail() {
  const entry = latestEvidenceHistoryDetail;
  if (!entry || entry.history !== latestEvidenceHistory ||
      entry.files !== latestEvidenceHistoryFiles) {
    invalidateHistoryDetail();
    return null;
  }
  return entry;
}
function renderHistoryDetail() {
  const entry = latestEvidenceHistoryDetail;
  if (!entry) return;
  const { comparison, from, to } = entry;
  const report = comparison.report;
  const needle = evidenceHistoryDetailPath.value.trim().toLocaleLowerCase();
  const type = evidenceHistoryDetailType.value;
  const scope = evidenceHistoryDetailScope.value;
  const matches = report.changes.filter(change =>
    (type === 'all' || change.type === type) &&
    (scope === 'all' || evidenceChangeScope(change.path) === scope) &&
    (!needle || change.path.toLocaleLowerCase().includes(needle))
  );
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  evidenceHistoryDetailPage = Math.min(evidenceHistoryDetailPage, pages - 1);
  const start = evidenceHistoryDetailPage * PAGE_SIZE;
  const rows = matches.slice(start, start + PAGE_SIZE);
  evidenceHistoryDetailPanel.hidden = false;
  evidenceHistoryDetailSummary.textContent =
    'SAVED EVIDENCE — NOT REVERIFIED. ' + from + ' → ' + to +
    '. ' + comparison.assessment.classification.replaceAll('-', ' ') +
    '. ' + comparison.assessment.headline + ' ' +
    matches.length + ' of ' + report.changes.length +
    ' recorded differences match the filters.' +
    (report.truncated ? ' Comparison truncated at 5,000 changes.' : '');
  evidenceHistoryDetailNav.hidden = matches.length <= PAGE_SIZE;
  evidenceHistoryDetailPrevious.disabled = evidenceHistoryDetailPage === 0;
  evidenceHistoryDetailNext.disabled = evidenceHistoryDetailPage >= pages - 1;
  evidenceHistoryDetailPageSummary.textContent =
    'Page ' + (evidenceHistoryDetailPage + 1) + ' of ' + pages;

  const fragment = document.createDocumentFragment();
  if (!rows.length) {
    const row = document.createElement('tr');
    const value = cell('td', report.changes.length ?
      'No transition differences match these filters.' :
      'No recorded differences between these two archived findings.', 'empty');
    value.colSpan = 3;
    row.append(value);
    fragment.append(row);
  } else for (const change of rows) {
    const row = document.createElement('tr');
    row.className = change.type;
    const pathCell = document.createElement('td');
    pathCell.append(cell('span', change.type, 'tag'));
    pathCell.append(document.createElement('br'));
    pathCell.append(cell('span', change.path, 'path'));
    const left = document.createElement('td');
    left.append(cell('pre', displayValue(change.before, change.type !== 'added')));
    const right = document.createElement('td');
    right.append(cell('pre', displayValue(change.after, change.type !== 'removed')));
    row.append(pathCell, left, right);
    fragment.append(row);
  }
  evidenceHistoryDetailRows.replaceChildren(fragment);
}
async function openHistoryPair(fromIndex, toIndex, kind = 'custom', focusPath = '') {
  const history = latestEvidenceHistory;
  const files = latestEvidenceHistoryFiles;
  if (!history || !files ||
      !Number.isSafeInteger(fromIndex) || !Number.isSafeInteger(toIndex) ||
      fromIndex < 0 || fromIndex >= toIndex || toIndex >= files.length ||
      !['custom', 'adjacent', 'baseline', 'case'].includes(kind)) {
    historyMessage('Choose two different history snapshots in chronological order.', true);
    return;
  }
  invalidateHistoryDetail();
  const request = historyDetailRequest;
  const generation = evidenceHistoryGeneration;
  const valid = () => request === historyDetailRequest &&
    generation === evidenceHistoryGeneration &&
    history === latestEvidenceHistory && files === latestEvidenceHistoryFiles;
  const from = files[fromIndex], to = files[toIndex];
  if (from.size > MAX_REPORT_EXPORT_BYTES || to.size > MAX_REPORT_EXPORT_BYTES) {
    historyMessage('Selected evidence files exceed the 8 MiB input limit.', true);
    return;
  }
  historyMessage('Reading the two selected evidence snapshots locally…');
  try {
    const [beforeText, afterText] = await Promise.all([from.text(), to.text()]);
    if (!valid()) return;
    const comparison = compareVerificationArchives(beforeText, afterText);
    if (!valid()) return;
    latestEvidenceHistoryDetail = {
      history, files, fromIndex, toIndex, from: from.name, to: to.name,
      comparison, mode: kind, index: toIndex - 1
    };
    evidenceHistoryDetailCopyButton.disabled = false;
    evidenceHistoryDetailJsonButton.disabled = false;
    evidenceHistoryDetailCsvButton.disabled = false;
    if (focusPath) evidenceHistoryDetailPath.value = focusPath;
    renderHistoryDetail();
    historyMessage('Opened archived evidence snapshot ' + (fromIndex + 1) +
      ' against ' + (toIndex + 1) + ' (' + kind +
      '). No patch was replayed.');
    evidenceHistoryDetailPanel.scrollIntoView({ block: 'nearest' });
  } catch (error) {
    if (valid()) historyMessage('Could not inspect this saved evidence pair: ' +
      (error instanceof Error ? error.message : 'invalid evidence'), true);
  }
}
function openHistoryTransition(index, focusPath = '') {
  const history = latestEvidenceHistory;
  if (!history || !Number.isSafeInteger(index) ||
      index < 0 || index >= history.transitions.length) return;
  const fromIndex = history.comparison_mode === 'baseline' ? 0 : index;
  void openHistoryPair(fromIndex, index + 1, history.comparison_mode, focusPath);
}
/** Populate selects only after the archive history is successfully loaded. */
function setupHistoryCustomPair(files) {
  evidenceHistoryCustomFrom.replaceChildren();
  evidenceHistoryCustomTo.replaceChildren();
  evidenceHistoryCustomFrom.disabled = false;
  evidenceHistoryCustomTo.disabled = false;
  for (let i = 0; i < files.length; i++) {
    for (const control of [evidenceHistoryCustomFrom, evidenceHistoryCustomTo]) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = (i + 1) + '. ' + files[i].name;
      control.append(option);
    }
  }
  evidenceHistoryCustomFrom.value = '0';
  evidenceHistoryCustomTo.value = String(files.length - 1);
  refreshHistoryCustomPair();
}
function refreshHistoryCustomPair() {
  const files = latestEvidenceHistoryFiles;
  const fromIndex = Number(evidenceHistoryCustomFrom.value);
  const toIndex = Number(evidenceHistoryCustomTo.value);
  const valid = !!files && Number.isSafeInteger(fromIndex) &&
    Number.isSafeInteger(toIndex) && fromIndex >= 0 &&
    fromIndex < toIndex && toIndex < files.length;
  // A selection change invalidates an already-open detail, and cancels any
  // pending async read before it can replace the newly selected pair.
  invalidateHistoryDetail();
  evidenceHistoryCustomRun.disabled = !valid;
  evidenceHistoryCustomStatus.textContent = !files ?
    'Analyze an archive history to select snapshots.' :
    !valid ? 'Select an earlier snapshot on the left and a later one on the right.' :
      'Ready to compare snapshot ' + (fromIndex + 1) + ' against ' +
      (toIndex + 1) + '. The history summaries will not change.';
  evidenceHistoryCustomStatus.classList.toggle('error', !!files && !valid);
}
evidenceHistoryCustomFrom.addEventListener('change', refreshHistoryCustomPair);
evidenceHistoryCustomTo.addEventListener('change', refreshHistoryCustomPair);
evidenceHistoryCustomRun.addEventListener('click', () => {
  if (!latestEvidenceHistoryFiles) return;
  const fromIndex = Number(evidenceHistoryCustomFrom.value);
  const toIndex = Number(evidenceHistoryCustomTo.value);
  void openHistoryPair(fromIndex, toIndex, 'custom');
});
function historyDetailJson(entry) {
  return JSON.stringify({
    format: 'json-diff-view-history-transition-detail',
    version: 1,
    archived_not_reverified: true,
    history_pair_index: ['custom', 'case'].includes(entry.mode) ?
      null : entry.index + 1,
    comparison_mode: entry.mode,
    baseline_snapshot_index: entry.fromIndex + 1,
    candidate_snapshot_index: entry.toIndex + 1,
    from_file: entry.from,
    to_file: entry.to,
    same_failure_identity: entry.comparison.sameCase,
    baseline: {
      metadata: entry.comparison.baseline,
      reproduced_claim: entry.comparison.baselineReproduced
    },
    candidate: {
      metadata: entry.comparison.candidate,
      reproduced_claim: entry.comparison.candidateReproduced
    },
    drift_assessment: entry.comparison.assessment,
    report: entry.comparison.report
  }, null, 2) + '\n';
}
for (const control of [evidenceHistoryDetailPath, evidenceHistoryDetailType,
  evidenceHistoryDetailScope]) {
  control.addEventListener(control === evidenceHistoryDetailPath ? 'input' : 'change',
    () => {
      if (!currentHistoryDetail()) return;
      evidenceHistoryDetailPage = 0;
      renderHistoryDetail();
    });
}
evidenceHistoryDetailPrevious.addEventListener('click', () => {
  if (!currentHistoryDetail() || evidenceHistoryDetailPage === 0) return;
  evidenceHistoryDetailPage--;
  renderHistoryDetail();
});
evidenceHistoryDetailNext.addEventListener('click', () => {
  if (!currentHistoryDetail()) return;
  evidenceHistoryDetailPage++;
  renderHistoryDetail();
});
evidenceHistoryDetailCopyButton.addEventListener('click', async () => {
  const entry = currentHistoryDetail();
  if (!entry) return;
  try {
    const content = historyDetailJson(entry);
    if (new TextEncoder().encode(content).byteLength > MAX_REPORT_EXPORT_BYTES) {
      throw new RangeError('Transition detail exceeds the 8 MiB export limit.');
    }
    await navigator.clipboard.writeText(content);
    historyMessage('Full transition detail copied; UI filters did not affect the export.');
  } catch (error) {
    historyMessage('Cannot copy transition detail: ' +
      (error instanceof Error ? error.message : 'clipboard unavailable'), true);
  }
});
function exportHistoryDetail(format) {
  const entry = currentHistoryDetail();
  if (!entry) return;
  try {
    const csv = format === 'csv';
    const pairLabel = (entry.fromIndex + 1) + '-to-' + (entry.toIndex + 1);
    const text = csv ? serializeReportCsv(entry.comparison.report, {
      source: 'Archived history pair ' + pairLabel + ' [' + entry.mode +
        '] (not reverified; ' + entry.comparison.assessment.classification + ')'
    }) : historyDetailJson(entry);
    downloadReport(text,
      'evidence-history-' + entry.mode + '-' + pairLabel + '.' + format,
      csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    historyMessage('Full history transition downloaded as ' +
      format.toUpperCase() + (entry.comparison.report.truncated ?
        ' (truncated).' : '.'));
  } catch (error) {
    historyMessage('Transition export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
evidenceHistoryDetailJsonButton.addEventListener('click',
  () => exportHistoryDetail('json'));
evidenceHistoryDetailCsvButton.addEventListener('click',
  () => exportHistoryDetail('csv'));


function selectEvidenceHotspot(item) {
  if (!latestEvidenceHistory ||
      !latestEvidenceHistory.hotspots.paths.includes(item)) return;
  selectedEvidenceHotspot = item;
  evidenceHotspotTimelinePanel.hidden = false;
  evidenceHotspotTimelineCsvButton.disabled = false;
  evidenceHotspotTimelineSummary.textContent =
    'SAVED EVIDENCE — NOT REVERIFIED. ' + item.path +
    ' · ' + item.affected_transitions + ' of ' +
    latestEvidenceHistory.transitions.length + ' comparisons affected · ' +
    item.recorded_occurrences + ' recorded occurrences.' +
    (latestEvidenceHistory.summary.truncated_transitions ?
      ' Some comparisons were truncated; the counts may be incomplete.' : '');
  const fragment = document.createDocumentFragment();
  for (const hit of item.transition_details) {
    const row = document.createElement('tr');
    row.append(cell('td', String(hit.transition_index)));
    row.append(cell('td', hit.from_file));
    row.append(cell('td', hit.to_file));
    row.append(cell('td', hit.classification.replaceAll('-', ' ')));
    row.append(cell('td', String(hit.occurrences) +
      (hit.report_truncated ? ' (truncated)' : '')));
    const actionCell = document.createElement('td');
    const button = document.createElement('button');
    button.className = 'button subtle';
    button.type = 'button';
    button.textContent = 'Inspect comparison';
    button.setAttribute('aria-label',
      'Inspect comparison ' + hit.transition_index + ' for ' + item.path);
    button.addEventListener('click', () => {
      openHistoryTransition(hit.transition_index - 1, hit.example_report_path);
    });
    actionCell.append(button);
    row.append(actionCell);
    fragment.append(row);
  }
  evidenceHotspotTimelineRows.replaceChildren(fragment);
  evidenceHotspotTimelinePanel.scrollIntoView({ block: 'nearest' });
}
evidenceHotspotTimelineCsvButton.addEventListener('click', () => {
  const history = latestEvidenceHistory;
  const item = selectedEvidenceHotspot;
  if (!history || !item) return;
  try {
    downloadReport(serializeEvidenceHotspotTimelineCsv(history, item),
      'archived-evidence-path-timeline.csv', 'text/csv;charset=utf-8');
    historyMessage('Selected archived evidence path timeline exported as CSV.');
  } catch (error) {
    historyMessage('Could not export the selected path timeline: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
function renderEvidenceHotspots() {
  const history = latestEvidenceHistory;
  if (!history || !history.hotspots) return;
  const hotspots = history.hotspots;
  const needle = evidenceHotspotsPath.value.trim().toLocaleLowerCase();
  const scope = evidenceHotspotsScope.value;
  const matching = hotspots.paths.filter(item =>
    (scope === 'all' || scope === item.scope) &&
    (!needle || item.path.toLocaleLowerCase().includes(needle))
  );
  evidenceHotspotsPanel.hidden = false;
  evidenceHotspotsSummary.textContent =
    hotspots.total_recorded_paths + ' distinct normalized evidence paths across ' +
    history.transitions.length + ' archived comparisons; ' +
    hotspots.shown_paths + ' most frequently affected paths retained, ' +
    matching.length + ' match the current filters.' +
    (hotspots.truncated ? ' The list is limited to the top 200; see truncation warning.' : '') +
    (history.summary.truncated_transitions ?
      ' Some comparisons were truncated; counts are lower bounds.' : '') +
    ' Snapshots are saved claims, not reverified.';
  const fragment = document.createDocumentFragment();
  if (!matching.length) {
    const row = document.createElement('tr');
    const empty = cell('td', hotspots.total_recorded_paths ?
      'No recorded hotspot paths match these filters.' :
      'No recorded evidence paths changed across the selected comparisons.', 'empty');
    empty.colSpan = 5;
    row.append(empty);
    fragment.append(row);
  } else for (const item of matching) {
    const row = document.createElement('tr');
    row.append(cell('td', item.path));
    row.append(cell('td', item.scope));
    row.append(cell('td', String(item.affected_transitions) +
      '/' + history.transitions.length));
    row.append(cell('td', String(item.recorded_occurrences)));
    const actionCell = document.createElement('td');
    const button = document.createElement('button');
    button.className = 'button subtle';
    button.type = 'button';
    button.textContent = 'Inspect latest change';
    button.setAttribute('aria-label', 'Inspect latest archived change for ' + item.path);
    button.addEventListener('click', () => {
      openHistoryTransition(item.last_transition - 1, item.example_report_path);
    });
    actionCell.append(button);
    const timeline = document.createElement('button');
    timeline.className = 'button subtle';
    timeline.type = 'button';
    timeline.textContent = 'View path history';
    timeline.setAttribute('aria-label', 'View archived history of ' + item.path);
    timeline.addEventListener('click', () => selectEvidenceHotspot(item));
    actionCell.append(timeline);
    row.append(actionCell);
    fragment.append(row);
  }
  evidenceHotspotsRows.replaceChildren(fragment);
}
evidenceHotspotsScope.addEventListener('change', renderEvidenceHotspots);
evidenceHotspotsPath.addEventListener('input', renderEvidenceHotspots);
evidenceHotspotsCsvButton.addEventListener('click', () => {
  if (!latestEvidenceHistory) return;
  const history = latestEvidenceHistory;
  try {
    // serializeReportCsv handles CSV quoting and spreadsheet formula injection.
    // A structured CSV row is represented as a descriptive changed object.
    const rows = history.hotspots.paths.map(item => ({
      path: item.path,
      type: 'changed',
      before: {
        scope: item.scope,
        affected_transitions: item.affected_transitions,
        recorded_occurrences: item.recorded_occurrences
      },
      after: {
        transition_indexes: item.transition_indexes,
        latest_transition: item.last_transition,
        example_report_path: item.example_report_path
      }
    }));
    downloadReport(serializeReportCsv({
      changes: rows,
      counts: { added: 0, removed: 0, changed: rows.length },
      truncated: history.hotspots.truncated ||
        history.summary.truncated_transitions > 0
    }, {
      source: 'Archived evidence hotspot frequency (mode: ' +
        history.comparison_mode + '; not reverified)'
    }), 'archived-evidence-hotspots.csv', 'text/csv;charset=utf-8');
    historyMessage('Unfiltered recorded hotspot summary downloaded as CSV.');
  } catch (error) {
    historyMessage('Could not export hotspots: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});


/** Case IDs are local to this selected, filename-ordered archive history. */
function populateHistoryCaseFilter(history) {
  evidenceHistoryCaseFilter.replaceChildren();
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = 'All failure identities';
  evidenceHistoryCaseFilter.append(all);
  for (const item of history.cases) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.id + ' — ' + item.operation_type +
      ' ' + item.operation_path;
    evidenceHistoryCaseFilter.append(option);
  }
  evidenceHistoryCaseFilter.value = 'all';
  evidenceHistoryCaseFilter.disabled = false;
}

function showCaseProgression(group) {
  const history = latestEvidenceHistory;
  const selected = history?.case_progressions.find(
    item => item.case_id === group.id);
  if (!history || !selected || !history.cases.includes(group)) return;
  selectedEvidenceCaseProgression = selected;
  evidenceCaseProgressionPanel.hidden = false;
  evidenceCaseProgressionCsvButton.disabled = selected.comparisons.length === 0;
  evidenceCaseProgressionSummary.textContent =
    'SAVED EVIDENCE — NOT REVERIFIED. ' + selected.case_id + ': ' +
    selected.snapshots + ' recorded snapshots, ' +
    selected.comparisons_count + ' same-case comparisons, ' +
    selected.separated_runs + ' separate runs, ' +
    selected.intervening_other_case_snapshots +
    ' other-case snapshots between occurrences, ' +
    selected.truncated_comparisons + ' truncated reports.' +
    ' Comparisons connect consecutive occurrences of this same recorded ' +
    'failure identity, independently of the main history mode.';
  const fragment = document.createDocumentFragment();
  if (!selected.comparisons.length) {
    const row = document.createElement('tr');
    const empty = cell('td',
      'This identity appears only once; there is no same-case comparison.', 'empty');
    empty.colSpan = 7;
    row.append(empty);
    fragment.append(row);
  } else for (const item of selected.comparisons) {
    const row = document.createElement('tr');
    const status = (item.from_reproduced_claim ? 'reproduced' : 'inconsistent') +
      ' → ' + (item.to_reproduced_claim ? 'reproduced' : 'inconsistent');
    for (const value of [
      item.from_file, item.to_file,
      String(item.intervening_other_case_snapshots),
      item.classification.replaceAll('-', ' '),
      status,
      String(item.recorded_differences) +
        (item.report_truncated ? ' (truncated)' : '')
    ]) row.append(cell('td', value));
    const actionCell = document.createElement('td');
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.className = 'button subtle';
    inspect.textContent = 'Inspect same-case change';
    inspect.setAttribute('aria-label',
      'Inspect ' + selected.case_id + ' saved snapshots ' +
      item.from_snapshot_index + ' to ' + item.to_snapshot_index);
    inspect.addEventListener('click', () => {
      void openHistoryPair(item.from_snapshot_index - 1,
        item.to_snapshot_index - 1, 'case');
    });
    actionCell.append(inspect);
    row.append(actionCell);
    fragment.append(row);
  }
  evidenceCaseProgressionRows.replaceChildren(fragment);
  evidenceCaseProgressionPanel.scrollIntoView({ block: 'nearest' });
}
evidenceCaseProgressionCsvButton.addEventListener('click', () => {
  const history = latestEvidenceHistory;
  const selected = selectedEvidenceCaseProgression;
  if (!history || !selected) return;
  try {
    const contents = serializeEvidenceCaseProgressionCsv(history, selected);
    downloadReport(contents,
      'archived-evidence-' + selected.case_id + '-progression.csv',
      'text/csv;charset=utf-8');
    historyMessage('Selected case progression downloaded as CSV without filters.');
  } catch (error) {
    historyMessage('Case progression export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});

function renderHistoryCases() {
  const history = latestEvidenceHistory;
  if (!history) return;
  evidenceHistoryCasesPanel.hidden = false;
  evidenceHistoryCasesSummary.textContent =
    history.summary.unique_failure_cases + ' distinct recorded failure identities in ' +
    history.summary.contiguous_case_runs + ' contiguous filename-ordered runs; ' +
    history.summary.reappearing_failure_cases + ' identities reappear after other cases. ' +
    'Identity is based on source, failed operation index/type/path/from, not error wording. ' +
    'These are saved claims, NOT REVERIFIED.';
  const fragment = document.createDocumentFragment();
  for (const item of history.cases) {
    const row = document.createElement('tr');
    const identity = item.source + ' · #' + item.failed_operation_index +
      ' ' + item.operation_type + ' ' + item.operation_path +
      (item.operation_from === null ? '' : ' from ' + item.operation_from);
    for (const value of [
      item.id, identity, String(item.snapshots),
      String(item.reproduced_claims), String(item.contiguous_runs),
      item.first_file + ' → ' + item.last_file
    ]) row.append(cell('td', value));
    const actions = document.createElement('td');
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.className = 'button subtle';
    focus.textContent = 'Focus history';
    focus.setAttribute('aria-label', 'Focus archive comparisons involving ' + item.id);
    focus.addEventListener('click', () => {
      evidenceHistoryCaseFilter.value = item.id;
      invalidateHistoryDetail();
      renderEvidenceHistory();
      evidenceHistoryTableTitle.scrollIntoView({ block: 'nearest' });
    });
    actions.append(focus);
    const compare = document.createElement('button');
    compare.type = 'button';
    compare.className = 'button subtle';
    compare.textContent = 'First vs last';
    compare.disabled = item.snapshots < 2;
    compare.setAttribute('aria-label', 'Inspect earliest and latest snapshots of ' + item.id);
    compare.addEventListener('click', () => {
      if (item.snapshots >= 2) {
        void openHistoryPair(item.first_snapshot_index - 1,
          item.last_snapshot_index - 1, 'custom');
      }
    });
    actions.append(compare);
    const progression = document.createElement('button');
    progression.type = 'button';
    progression.className = 'button subtle';
    progression.textContent = 'View case progression';
    progression.disabled = item.snapshots < 2;
    progression.setAttribute('aria-label',
      'View recorded progression for failure identity ' + item.id);
    progression.addEventListener('click', () => showCaseProgression(item));
    actions.append(progression);
    row.append(actions);
    fragment.append(row);
  }
  evidenceHistoryCasesRows.replaceChildren(fragment);
}
evidenceHistoryCaseFilter.addEventListener('change', () => {
  invalidateHistoryDetail();
  renderEvidenceHistory();
});
evidenceHistoryCasesCsvButton.addEventListener('click', () => {
  if (!latestEvidenceHistory) return;
  try {
    downloadReport(serializeEvidenceCasesCsv(latestEvidenceHistory),
      'archived-evidence-failure-cases.csv', 'text/csv;charset=utf-8');
    historyMessage('All recorded failure case groups exported as local CSV.');
  } catch (error) {
    historyMessage('Case inventory export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});

function invalidateEvidenceHistory() {
  invalidateHistoryDetail();
  evidenceHistoryGeneration++;
  latestEvidenceHistory = null;
  latestEvidenceHistoryFiles = null;
  evidenceHistoryPanel.hidden = true;
  evidenceHistoryCasesPanel.hidden = true;
  selectedEvidenceCaseProgression = null;
  evidenceCaseProgressionPanel.hidden = true;
  evidenceCaseProgressionSummary.textContent = '';
  evidenceCaseProgressionRows.replaceChildren();
  evidenceCaseProgressionCsvButton.disabled = true;
  evidenceHistoryCasesRows.replaceChildren();
  evidenceHistoryCasesSummary.textContent = '';
  evidenceHistoryCasesCsvButton.disabled = true;
  evidenceHistoryCaseFilter.replaceChildren();
  const allCases = document.createElement('option');
  allCases.value = 'all';
  allCases.textContent = 'All failure identities';
  evidenceHistoryCaseFilter.append(allCases);
  evidenceHistoryCaseFilter.disabled = true;
  evidenceHotspotsPanel.hidden = true;
  selectedEvidenceHotspot = null;
  evidenceHotspotTimelinePanel.hidden = true;
  evidenceHotspotTimelineSummary.textContent = '';
  evidenceHotspotTimelineRows.replaceChildren();
  evidenceHotspotTimelineCsvButton.disabled = true;
  evidenceHotspotsSummary.textContent = '';
  evidenceHotspotsRows.replaceChildren();
  evidenceHotspotsScope.value = 'all';
  evidenceHotspotsPath.value = '';
  evidenceHotspotsCsvButton.disabled = true;
  evidenceHistoryCustomFrom.replaceChildren();
  evidenceHistoryCustomTo.replaceChildren();
  evidenceHistoryCustomFrom.disabled = true;
  evidenceHistoryCustomTo.disabled = true;
  evidenceHistoryCustomRun.disabled = true;
  evidenceHistoryCustomStatus.textContent =
    'Analyze an archive history to select snapshots.';
  evidenceHistoryCustomStatus.classList.remove('error');
  evidenceHistoryTableTitle.textContent = 'Consecutive evidence transitions';
  evidenceHistoryRows.replaceChildren();
  evidenceHistorySummary.textContent = '';
  evidenceHistoryFilter.value = 'all';
  evidenceHistoryCopyButton.disabled = true;
  evidenceHistoryJsonButton.disabled = true;
  evidenceHistoryCsvButton.disabled = true;
}
function renderEvidenceHistory() {
  if (!latestEvidenceHistory) return;
  const history = latestEvidenceHistory;
  const caseId = evidenceHistoryCaseFilter.value;
  const transitions = history.transitions.filter(t =>
    (evidenceHistoryFilter.value === 'all' ||
      t.classification === evidenceHistoryFilter.value) &&
    (caseId === 'all' || t.from_case_id === caseId || t.to_case_id === caseId)
  );
  evidenceHistoryPanel.hidden = false;
  const fixedBaseline = history.comparison_mode === 'baseline';
  evidenceHistoryTableTitle.textContent = fixedBaseline ?
    'Comparison against first saved evidence' : 'Consecutive evidence transitions';
  evidenceHistorySummary.textContent =
    history.summary.archives + ' archived snapshots, ' +
    history.summary.transitions +
    (fixedBaseline ? ' comparisons to first archive (' +
      history.baseline_file + '). ' : ' consecutive transitions. ') +
    history.summary.reproduced_claims + ' archives claimed reproduction, ' +
    history.summary.different_failure_identities +
    ' comparisons crossed different failure identities, ' +
    history.summary.unique_failure_cases + ' unique failure identities, ' +
    history.summary.truncated_transitions + ' truncated transition reports. ' +
    transitions.length + ' transitions match the filter. ' +
    'Filename ascending order is used; comparison mode: ' +
    (fixedBaseline ? 'first baseline' : 'adjacent') +
    '. Case focus includes any comparison touching the selected case, ' +
    'including clearly marked cross-case boundaries. ' +
    'Saved claims are NOT reverified.';
  const fragment = document.createDocumentFragment();
  if (!transitions.length) {
    const row = document.createElement('tr');
    const empty = cell('td', 'No transitions match this classification filter.', 'empty');
    empty.colSpan = 7;
    row.append(empty);
    fragment.append(row);
  } else for (const item of transitions) {
    const row = document.createElement('tr');
    for (const value of [
      item.from_file, item.to_file, item.classification.replaceAll('-', ' '),
      (item.from_reproduced_claim ? 'reproduced' : 'inconsistent') + ' → ' +
        (item.to_reproduced_claim ? 'reproduced' : 'inconsistent'),
      item.same_failure_identity ? 'same case' : 'different case',
      String(item.differences) + (item.truncated ? ' (truncated)' : '')
    ]) row.append(cell('td', value));
    const inspectCell = document.createElement('td');
    const index = history.transitions.indexOf(item);
    const inspect = document.createElement('button');
    inspect.type = 'button';
    inspect.className = 'button subtle';
    inspect.textContent = 'Inspect transition';
    inspect.setAttribute('aria-label', 'Inspect archived transition ' + (index + 1));
    inspect.addEventListener('click', () => { void openHistoryTransition(index); });
    inspectCell.append(inspect);
    row.append(inspectCell);
    fragment.append(row);
  }
  evidenceHistoryRows.replaceChildren(fragment);
}
evidenceHistoryFiles.addEventListener('change', () => {
  invalidateEvidenceHistory();
  historyMessage('Selected evidence files changed. Analyze the timeline again.');
});
evidenceHistoryMode.addEventListener('change', () => {
  invalidateEvidenceHistory();
  historyMessage('Comparison mode changed. Analyze the selected evidence again.');
});
evidenceHistoryFilter.addEventListener('change', renderEvidenceHistory);
evidenceHistoryRunButton.addEventListener('click', async () => {
  invalidateEvidenceHistory();
  const request = evidenceHistoryGeneration;
  const selected = [...(evidenceHistoryFiles.files || [])];
  if (selected.length < 2 || selected.length > 10) {
    historyMessage('Select between 2 and 10 saved evidence JSON files.', true);
    return;
  }
  if (selected.some(file => file.size > MAX_REPORT_EXPORT_BYTES)) {
    historyMessage('Each evidence file must be no larger than 8 MiB.', true);
    return;
  }
  // Codepoint sort is deliberate and deterministic, independent of OS
  // locale and browser file-picker selection order.
  const mode = evidenceHistoryMode.value;
  selected.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  if (selected.some((file, i) => i > 0 && file.name === selected[i - 1].name)) {
    historyMessage('Duplicate filenames cannot establish a reliable timeline. Rename files first.', true);
    return;
  }
  historyMessage('Reading archived evidence files locally in filename order…');
  try {
    const archives = [];
    // Read sequentially, not all at once, to reduce temporary memory use.
    for (const file of selected) {
      const content = await file.text();
      if (request !== evidenceHistoryGeneration) return;
      archives.push({ name: file.name, text: content });
    }
    const history = buildEvidenceHistory(archives, { mode });
    if (request !== evidenceHistoryGeneration) return;
    latestEvidenceHistory = history;
    latestEvidenceHistoryFiles = selected;
    setupHistoryCustomPair(selected);
    populateHistoryCaseFilter(history);
    renderEvidenceHistory();
    renderHistoryCases();
    evidenceHistoryCasesCsvButton.disabled = false;
    renderEvidenceHotspots();
    evidenceHotspotsCsvButton.disabled = false;
    evidenceHistoryCopyButton.disabled = false;
    evidenceHistoryJsonButton.disabled = false;
    evidenceHistoryCsvButton.disabled = false;
    historyMessage('Archived evidence ' +
      (mode === 'baseline' ? 'first-baseline analysis' : 'adjacent timeline') +
      ' built. No patches executed and no editors modified.');
  } catch (error) {
    if (request === evidenceHistoryGeneration) {
      historyMessage('Could not build evidence timeline: ' +
        (error instanceof Error ? error.message : 'invalid archive'), true);
    }
  }
});
evidenceHistoryCopyButton.addEventListener('click', async () => {
  if (!latestEvidenceHistory) return;
  try {
    const text = serializeEvidenceHistoryJson(latestEvidenceHistory);
    fitInput(text, 'Evidence history');
    await navigator.clipboard.writeText(text);
    historyMessage('Full archived history copied. Classification filter did not affect the export.');
  } catch (error) {
    historyMessage('Could not copy history: ' +
      (error instanceof Error ? error.message : 'clipboard unavailable'), true);
  }
});
function exportEvidenceHistory(format) {
  if (!latestEvidenceHistory) return;
  try {
    const csv = format === 'csv';
    const text = csv ? serializeEvidenceHistoryCsv(latestEvidenceHistory) :
      serializeEvidenceHistoryJson(latestEvidenceHistory);
    downloadReport(text, 'archived-evidence-history.' + format,
      csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    historyMessage('Full evidence timeline downloaded as ' + format.toUpperCase() + '.');
  } catch (error) {
    historyMessage('Timeline export failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
evidenceHistoryJsonButton.addEventListener('click', () => exportEvidenceHistory('json'));
evidenceHistoryCsvButton.addEventListener('click', () => exportEvidenceHistory('csv'));

// Saved-evidence comparison does not touch the document and patch editors.
// It compares two untrusted archived claims, not a newly executed replay.
function evidenceCompareMessage(message, isError = false) {
  evidenceCompareStatus.textContent = message;
  evidenceCompareStatus.classList.toggle('error', isError);
}
function invalidateEvidenceComparison() {
  evidenceCompareGeneration++;
  latestEvidenceComparison = null;
  evidenceComparisonPage = 0;
  evidenceComparePanel.hidden = true;
  evidenceCompareRows.replaceChildren();
  evidenceCompareSummary.textContent = '';
  evidenceCompareNav.hidden = true;
  evidenceComparePath.value = '';
  evidenceCompareType.value = 'all';
  evidenceCompareScope.value = 'all';
  evidenceAssessment.textContent = '';
  evidenceAssessmentDetails.textContent = '';
  copyEvidenceCompareButton.disabled = true;
  downloadEvidenceCompareJsonButton.disabled = true;
  downloadEvidenceCompareCsvButton.disabled = true;
}
function renderEvidenceComparison() {
  if (!latestEvidenceComparison) return;
  const { report, sameCase, baselineReproduced, candidateReproduced } =
    latestEvidenceComparison;
  const needle = evidenceComparePath.value.trim().toLocaleLowerCase();
  const type = evidenceCompareType.value;
  const scope = evidenceCompareScope.value;
  const matching = report.changes.filter(change =>
    (type === 'all' || change.type === type) &&
    (scope === 'all' || evidenceChangeScope(change.path) === scope) &&
    (!needle || change.path.toLocaleLowerCase().includes(needle))
  );
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  evidenceComparisonPage = Math.min(evidenceComparisonPage, pages - 1);
  const offset = evidenceComparisonPage * PAGE_SIZE;
  const shown = matching.slice(offset, offset + PAGE_SIZE);
  evidenceComparePanel.hidden = false;
  const assessment = latestEvidenceComparison.assessment;
  evidenceAssessment.textContent = assessment.classification.replaceAll('-', ' ').toUpperCase() +
    ' — ' + assessment.headline;
  evidenceAssessmentDetails.textContent =
    'Recorded difference areas: metadata ' + assessment.recordedChanges.metadata +
    ', failure checks ' + assessment.recordedChanges.findings +
    ', checkpoint ' + assessment.recordedChanges.checkpoint +
    ', other ' + assessment.recordedChanges.other + '.' +
    (assessment.changedFindingPaths.length ?
      ' Changed check paths: ' + assessment.changedFindingPaths.join(', ') + '.' : '') +
    (assessment.truncated ?
      ' This assessment covers a truncated set of recorded differences.' : '') +
    ' Findings come from saved evidence; neither archive has been reverified.';
  evidenceCompareSummary.textContent =
    'ARCHIVED EVIDENCE ONLY — NOT REVERIFIED. ' +
    (sameCase ? 'Same recorded failure identity.' :
      'Different failure identities: compare with caution.') +
    ' Baseline ' + (baselineReproduced ? 'REPRODUCED' : 'INCONSISTENT') +
    ' → candidate ' + (candidateReproduced ? 'REPRODUCED' : 'INCONSISTENT') +
    '. ' + report.changes.length + ' recorded differences; ' +
    matching.length + ' match filters.' +
    (report.truncated ? ' Comparison truncated at 5,000 differences.' : '');
  evidenceCompareNav.hidden = matching.length <= PAGE_SIZE;
  evidenceComparePrevious.disabled = evidenceComparisonPage === 0;
  evidenceCompareNext.disabled = evidenceComparisonPage >= pages - 1;
  evidenceComparePageSummary.textContent =
    'Page ' + (evidenceComparisonPage + 1) + ' of ' + pages;
  const fragment = document.createDocumentFragment();
  if (!shown.length) {
    const row = document.createElement('tr');
    const empty = cell('td', report.changes.length ?
      'No evidence changes match the active filters.' :
      'The two saved evidence archives contain identical recorded findings.', 'empty');
    empty.colSpan = 3;
    row.append(empty);
    fragment.append(row);
  } else for (const change of shown) {
    const row = document.createElement('tr');
    row.className = change.type;
    const path = document.createElement('td');
    path.append(cell('span', change.type, 'tag'));
    path.append(document.createElement('br'));
    path.append(cell('span', change.path, 'path'));
    const before = document.createElement('td');
    before.append(cell('pre', displayValue(change.before, change.type !== 'added')));
    const after = document.createElement('td');
    after.append(cell('pre', displayValue(change.after, change.type !== 'removed')));
    row.append(path, before, after);
    fragment.append(row);
  }
  evidenceCompareRows.replaceChildren(fragment);
}
function currentEvidenceComparison() {
  if (!latestEvidenceComparison) return null;
  return latestEvidenceComparison;
}
function evidenceComparisonJson(snapshot) {
  return JSON.stringify({
    format: 'json-diff-view-evidence-comparison',
    version: 1,
    archived_not_reverified: true,
    same_failure_identity: snapshot.sameCase,
    drift_assessment: snapshot.assessment,
    baseline: {
      metadata: snapshot.baseline,
      reproduced_claim: snapshot.baselineReproduced
    },
    candidate: {
      metadata: snapshot.candidate,
      reproduced_claim: snapshot.candidateReproduced
    },
    report: snapshot.report
  }, null, 2) + '\n';
}
for (const field of [evidenceBaselineFile, evidenceCandidateFile]) {
  field.addEventListener('change', () => {
    invalidateEvidenceComparison();
    evidenceCompareMessage('Saved evidence selection changed. Compare the two files again.');
  });
}
compareEvidenceButton.addEventListener('click', async () => {
  invalidateEvidenceComparison();
  const request = evidenceCompareGeneration;
  const baseline = evidenceBaselineFile.files?.[0];
  const candidate = evidenceCandidateFile.files?.[0];
  if (!baseline || !candidate) {
    evidenceCompareMessage('Choose both a baseline and a candidate evidence JSON file.', true);
    return;
  }
  if (baseline.size > MAX_REPORT_EXPORT_BYTES ||
      candidate.size > MAX_REPORT_EXPORT_BYTES) {
    evidenceCompareMessage('Each saved evidence archive must be at most 8 MiB.', true);
    return;
  }
  evidenceCompareMessage('Reading both saved evidence files locally…');
  try {
    const [baselineText, candidateText] = await Promise.all([
      baseline.text(), candidate.text()
    ]);
    if (request !== evidenceCompareGeneration) return;
    const result = compareVerificationArchives(baselineText, candidateText);
    if (request !== evidenceCompareGeneration) return;
    latestEvidenceComparison = result;
    evidenceComparisonPage = 0;
    renderEvidenceComparison();
    copyEvidenceCompareButton.disabled = false;
    downloadEvidenceCompareJsonButton.disabled = false;
    downloadEvidenceCompareCsvButton.disabled = false;
    evidenceCompareMessage('Compared saved evidence files. No patch was replayed, ' +
      'and no editors were changed.' +
      (result.sameCase ? '' :
        ' The files concern different recorded failure identities.'));
  } catch (error) {
    if (request === evidenceCompareGeneration) {
      evidenceCompareMessage('Could not compare evidence: ' +
        (error instanceof Error ? error.message : 'invalid archive'), true);
    }
  }
});
evidenceComparePath.addEventListener('input', () => {
  evidenceComparisonPage = 0;
  renderEvidenceComparison();
});
evidenceCompareType.addEventListener('change', () => {
  evidenceComparisonPage = 0;
  renderEvidenceComparison();
});
evidenceCompareScope.addEventListener('change', () => {
  evidenceComparisonPage = 0;
  renderEvidenceComparison();
});
evidenceComparePrevious.addEventListener('click', () => {
  if (!currentEvidenceComparison() || evidenceComparisonPage === 0) return;
  evidenceComparisonPage--;
  renderEvidenceComparison();
});
evidenceCompareNext.addEventListener('click', () => {
  if (!currentEvidenceComparison()) return;
  evidenceComparisonPage++;
  renderEvidenceComparison();
});
copyEvidenceCompareButton.addEventListener('click', async () => {
  const result = currentEvidenceComparison();
  if (!result) return;
  try {
    const text = evidenceComparisonJson(result);
    if (new TextEncoder().encode(text).byteLength > MAX_REPORT_EXPORT_BYTES) {
      throw new RangeError('Evidence comparison exceeds 8 MiB.');
    }
    await navigator.clipboard.writeText(text);
    evidenceCompareMessage('Complete saved-evidence comparison copied, without UI filters.');
  } catch (error) {
    evidenceCompareMessage('Could not copy comparison: ' +
      (error instanceof Error ? error.message : 'clipboard unavailable'), true);
  }
});
function exportEvidenceComparison(format) {
  const result = currentEvidenceComparison();
  if (!result) return;
  try {
    const csv = format === 'csv';
    const text = csv ? serializeReportCsv(result.report, {
      source: 'Archived evidence baseline → candidate (not reverified)' +
        ' [drift: ' + result.assessment.classification + ']'
    }) : evidenceComparisonJson(result);
    downloadReport(text, 'saved-evidence-comparison.' + format,
      csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    evidenceCompareMessage('Complete saved-evidence comparison downloaded as ' +
      format.toUpperCase() +
      (result.report.truncated ? ' (truncated).' : '.'));
  } catch (error) {
    evidenceCompareMessage('Comparison download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
}
downloadEvidenceCompareJsonButton.addEventListener('click',
  () => exportEvidenceComparison('json'));
downloadEvidenceCompareCsvButton.addEventListener('click',
  () => exportEvidenceComparison('csv'));

// Failed operations may modify the internal detached working value before
// throwing (for example, a move that removes successfully but cannot add).
// Replay only the completed prefix from the pristine JSON source; never
// display or return the failed operation's partial mutation.

function invalidateFailureVerification() {
  latestImportedVerification = null;
  failureVerificationPage = 0;
  failureVerificationPanel.hidden = true;
  failureVerificationRows.replaceChildren();
  failureVerificationSummary.textContent = '';
  failureVerificationPath.value = '';
  failureVerificationType.value = 'all';
  failureVerificationNav.hidden = true;
  copyFailureVerificationButton.disabled = true;
  downloadFailureVerificationJsonButton.disabled = true;
  downloadFailureVerificationCsvButton.disabled = true;
  downloadVerificationEvidenceButton.disabled = true;
  verificationEvidenceContext.textContent = '';
}
function invalidateImportedFailure(message = 'Import a failure bundle before verifying it.') {
  invalidateFailureVerification();
  latestImportedFailure = null;
  verifyImportedFailureButton.disabled = true;
  importedFailureStatus.textContent = message;
  importedFailureStatus.classList.remove('error');
}
function importedFailureCurrent() {
  const loaded = latestImportedFailure;
  if (!loaded || failureImportMode.value !== loaded.mode ||
      patchBase.value !== loaded.source ||
      patchEditor(loaded.source).value !== loaded.documentText ||
      patchSource.value !== loaded.patchText) {
    invalidateImportedFailure('The imported reproduction was changed. Import it again to verify.');
    return null;
  }
  return loaded;
}
function currentFailureVerification() {
  // Archived evidence is independent of the editors. It is not a fresh replay.
  if (latestImportedVerification?.archived) {
    return latestImportedVerification.result;
  }
  const loaded = importedFailureCurrent();
  if (!loaded) return null;
  if (!latestImportedVerification ||
      latestImportedVerification.loaded !== loaded) {
    invalidateFailureVerification();
    return null;
  }
  return latestImportedVerification.result;
}
function failureVerificationSource(result) {
  return 'Recomputed last-good → stored last-good, operation ' + result.expectedIndex;
}
function renderFailureVerification() {
  if (!latestImportedVerification) return;
  const result = latestImportedVerification.result;
  const report = result.checkpointReport;
  const needle = failureVerificationPath.value.trim().toLocaleLowerCase();
  const type = failureVerificationType.value;
  const matches = report.changes.filter(change =>
    (type === 'all' || change.type === type) &&
    (!needle || change.path.toLocaleLowerCase().includes(needle))
  );
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  failureVerificationPage = Math.min(failureVerificationPage, pages - 1);
  const start = failureVerificationPage * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  failureVerificationPanel.hidden = false;
  failureVerificationSummary.textContent =
    (latestImportedVerification.archived ? 'SAVED EVIDENCE (NOT REVERIFIED)' : 'CURRENT REPLAY') +
    ' · ' + (result.reproduced ? 'REPRODUCED' : 'INCONSISTENT BUNDLE') +
    ' · Stored checkpoint ' + (result.checkpointMatches ? 'matches' : 'differs') +
    ' · Full prefix ' + (result.fullFailedAtExpected ? 'fails at expected step' :
      result.fullFailedAt === null ? 'does not fail' :
      'fails at step ' + result.fullFailedAt) +
    ' · Isolated operation ' + (result.isolatedFailed ? 'fails' : 'does not fail') +
    ' · Recorded error text ' + (result.recordedReasonMatches ? 'matches' : 'differs') +
    ' · ' + matches.length + '/' + report.changes.length + ' checkpoint differences visible.' +
    (report.truncated ? ' Differences truncated at 5,000.' : '');
  failureVerificationNav.hidden = matches.length <= PAGE_SIZE;
  failureVerificationPrevious.disabled = failureVerificationPage === 0;
  failureVerificationNext.disabled = failureVerificationPage >= pages - 1;
  failureVerificationPageSummary.textContent =
    'Page ' + (failureVerificationPage + 1) + ' of ' + pages;
  const fragment = document.createDocumentFragment();
  if (!visible.length) {
    const row = document.createElement('tr');
    const message = cell('td', report.changes.length ?
      'No checkpoint differences match the filters.' :
      'No structural differences between the recomputed and stored checkpoints.', 'empty');
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
    const fromCell = document.createElement('td');
    fromCell.append(cell('pre', displayValue(change.before, change.type !== 'added')));
    const toCell = document.createElement('td');
    toCell.append(cell('pre', displayValue(change.after, change.type !== 'removed')));
    row.append(pathCell, fromCell, toCell);
    fragment.append(row);
  }
  failureVerificationRows.replaceChildren(fragment);
}
function serializeFailureVerification(result) {
  return JSON.stringify({
    format: 'json-diff-view-failure-verification',
    version: 1,
    expected_operation_index: result.expectedIndex,
    reproduced: result.reproduced,
    full_prefix_failed_at_expected_index: result.fullFailedAtExpected,
    full_prefix_failed_at_index: result.fullFailedAt,
    isolated_operation_failed: result.isolatedFailed,
    recorded_reason_matches: result.recordedReasonMatches,
    checkpoint_matches: result.checkpointMatches,
    checkpoint: result.checkpointReport
  }, null, 2) + '\n';
}
failureVerificationPath.addEventListener('input', () => {
  if (!currentFailureVerification()) return;
  failureVerificationPage = 0;
  renderFailureVerification();
});
failureVerificationType.addEventListener('change', () => {
  if (!currentFailureVerification()) return;
  failureVerificationPage = 0;
  renderFailureVerification();
});
failureVerificationPrevious.addEventListener('click', () => {
  if (!currentFailureVerification() || failureVerificationPage === 0) return;
  failureVerificationPage--;
  renderFailureVerification();
});
failureVerificationNext.addEventListener('click', () => {
  if (!currentFailureVerification()) return;
  failureVerificationPage++;
  renderFailureVerification();
});
copyFailureVerificationButton.addEventListener('click', async () => {
  const result = currentFailureVerification();
  if (!result) return;
  try {
    await navigator.clipboard.writeText(serializeFailureVerification(result));
    importedFailureStatus.textContent =
      'Complete failure verification report copied; UI filters do not affect exports.';
  } catch {
    importedFailureStatus.textContent =
      'Could not copy the verification report. Check clipboard permissions.';
    importedFailureStatus.classList.add('error');
  }
});
function downloadFailureVerification(format) {
  const result = currentFailureVerification();
  if (!result) return;
  try {
    const csv = format === 'csv';
    const content = csv ?
      serializeReportCsv(result.checkpointReport, {
        source: failureVerificationSource(result)
      }) : serializeFailureVerification(result);
    downloadReport(content,
      'failure-verification-operation-' + result.expectedIndex + '.' + format,
      csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8');
    importedFailureStatus.textContent =
      (csv ? 'Complete recorded checkpoint differences' :
        'Full verification findings and checkpoint differences') +
      ' downloaded as ' + format.toUpperCase() +
      (result.checkpointReport.truncated ? ' (truncated).' : '.');
    importedFailureStatus.classList.remove('error');
  } catch (error) {
    importedFailureStatus.textContent = 'Verification report download failed: ' +
      (error instanceof Error ? error.message : 'unknown error');
    importedFailureStatus.classList.add('error');
  }
}
downloadFailureVerificationJsonButton.addEventListener('click',
  () => downloadFailureVerification('json'));
downloadFailureVerificationCsvButton.addEventListener('click',
  () => downloadFailureVerification('csv'));

downloadVerificationEvidenceButton.addEventListener('click', () => {
  const result = currentFailureVerification();
  if (!result) return;
  try {
    const state = latestImportedVerification;
    const text = state.archived ? state.text :
      serializeVerificationEvidence(state.loaded, result);
    downloadReport(text,
      'failure-evidence-operation-' + result.expectedIndex + '.json',
      'application/json;charset=utf-8');
    importedFailureStatus.textContent = state.archived ?
      'Saved evidence downloaded unchanged; no replay was run.' :
      'Verification evidence exported with findings and operation metadata.';
    importedFailureStatus.classList.remove('error');
  } catch (error) {
    importedFailureStatus.textContent = 'Evidence export failed: ' +
      (error instanceof Error ? error.message : 'unknown error');
    importedFailureStatus.classList.add('error');
  }
});
importVerificationEvidenceButton.addEventListener('click',
  () => verificationEvidenceFile.click());
verificationEvidenceFile.addEventListener('change', event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) void loadVerificationEvidence(file);
});
async function loadVerificationEvidence(file) {
  const request = ++evidenceImportSequence;
  if (file.size > MAX_REPORT_EXPORT_BYTES) {
    importedFailureStatus.textContent = 'Evidence file exceeds 8 MiB.';
    importedFailureStatus.classList.add('error');
    return;
  }
  try {
    const contents = await file.text();
    if (request !== evidenceImportSequence) return;
    const imported = parseVerificationEvidence(contents);
    // This is a report-viewing action, not a patch import or an execution.
    invalidateImportedFailure();
    latestImportedVerification = {
      archived: true, result: imported.result, text: contents,
      metadata: imported.metadata
    };
    failureVerificationPage = 0;
    copyFailureVerificationButton.disabled = false;
    downloadFailureVerificationJsonButton.disabled = false;
    downloadFailureVerificationCsvButton.disabled = false;
    downloadVerificationEvidenceButton.disabled = false;
    const meta = imported.metadata;
    verificationEvidenceContext.textContent = 'Archived finding — ' +
      meta.source + ', ' + meta.replay_mode + ' replay, operation ' +
      meta.failed_operation_index + ' (' + meta.operation_type + ') at ' +
      meta.operation_path + (meta.operation_from === null ? '' :
        ', from ' + meta.operation_from) +
      '. Recorded reason: ' + meta.recorded_reason.slice(0, 500) +
      '. These are imported claims, not freshly verified results.';
    renderFailureVerification();
    importedFailureStatus.textContent =
      'Saved evidence opened read-only. No patch was applied or replayed, and no editor changed.';
    importedFailureStatus.classList.remove('error');
  } catch (error) {
    if (request === evidenceImportSequence) {
      importedFailureStatus.textContent = 'Could not load evidence: ' +
        (error instanceof Error ? error.message : 'invalid file');
      importedFailureStatus.classList.add('error');
    }
  }
}

verifyImportedFailureButton.addEventListener('click', () => {
  const loaded = importedFailureCurrent();
  if (!loaded) return;
  invalidateFailureVerification();
  // No imported instructions are executed during file parsing or import.
  // The deliberate click runs only detached engine operations.
  try {
    const result = verifyFailureBundle(loaded.text);
    latestImportedVerification = { loaded, result };
    copyFailureVerificationButton.disabled = false;
    downloadFailureVerificationJsonButton.disabled = false;
    downloadFailureVerificationCsvButton.disabled = false;
    downloadVerificationEvidenceButton.disabled = false;
    verificationEvidenceContext.textContent =
      'Current in-browser replay of imported failure bundle, operation ' +
      result.expectedIndex + '.';
    renderFailureVerification();
    if (result.reproduced) {
      importedFailureStatus.textContent = 'REPRODUCED: failed operation ' +
        result.expectedIndex + ' fails at the recorded position; the stored last-good ' +
        'checkpoint matches a fresh replay, and the isolated operation also fails.' +
        (result.recordedReasonMatches ? ' The recorded reason also matches.' :
          ' The recorded error text differs; review the imported metadata.');
      importedFailureStatus.classList.remove('error');
    } else {
      importedFailureStatus.textContent = 'INCONSISTENT BUNDLE: checkpoint ' +
        (result.checkpointMatches ? 'matches' :
          'differs (' + result.checkpointDifferences + ' recorded differences' +
          (result.checkpointTruncated ? ', truncated' : '') + ')') +
        '; full prefix ' + (result.fullFailedAtExpected ?
          'fails at the recorded operation' :
          (result.fullFailedAt === null ? 'did not fail' :
            'fails at operation ' + result.fullFailedAt)) +
        '; isolated operation ' + (result.isolatedFailed ? 'fails' : 'did not fail') +
        '. No editor was modified.';
      importedFailureStatus.classList.add('error');
    }
  } catch (error) {
    importedFailureStatus.textContent = 'Verification unavailable: ' +
      (error instanceof Error ? error.message : 'replay error') +
      '. No editor was modified.';
    importedFailureStatus.classList.add('error');
  }
});

async function loadFailureReproduction(file) {
  if (!file) return;
  invalidateImportedFailure();
  // Newer imports, user edits, and explicit editor replacements win over any
  // pending file read or confirmation dialog.
  const request = ++bundleImportSequence;
  invalidateAllEditorImports();
  const beforeVersion = editorImportVersions.get(beforeEditor);
  const afterVersion = editorImportVersions.get(afterEditor);
  const patchVersion = ++patchImportSequence;
  const mode = failureImportMode.value;
  const initialPatchBase = patchBase.value;
  const current = () => request === bundleImportSequence &&
    beforeVersion === editorImportVersions.get(beforeEditor) &&
    afterVersion === editorImportVersions.get(afterEditor) &&
    patchVersion === patchImportSequence &&
    initialPatchBase === patchBase.value &&
    mode === failureImportMode.value;
  if (file.size > MAX_REPORT_EXPORT_BYTES) {
    patchMessage('Failure bundle exceeds the 8 MiB import limit.', true);
    return;
  }
  try {
    const contents = await file.text();
    if (!current()) return;
    const loaded = parseFailureBundle(contents, mode);
    const editor = patchEditor(loaded.source);
    const shouldConfirm =
      (editor.value.trim() && editor.value !== loaded.documentText) ||
      (patchSource.value.trim() && patchSource.value !== loaded.patchText);
    if (shouldConfirm && !confirm(
      'Import failure reproduction? This replaces the ' +
      patchSideLabel(loaded.source) + ' source and patch editors. ' +
      'The opposite editor will not change. No patch is executed.'
    )) return;
    if (!current()) return;

    invalidateEditorImport(editor);
    patchImportSequence++;
    bundleImportSequence++;
    editor.value = loaded.documentText;
    patchSource.value = loaded.patchText;
    patchBase.value = loaded.source;
    updateResultTarget();
    invalidateInspection();
    resetReport();
    latestImportedFailure = {
      text: contents, source: loaded.source, mode: loaded.mode,
      documentText: loaded.documentText, patchText: loaded.patchText
    };
    verifyImportedFailureButton.disabled = false;
    importedFailureStatus.textContent =
      'Bundle imported. Verification has not run; select Verify imported failure to replay it explicitly.';
    patchMessage('Failure bundle loaded (' +
      (loaded.mode === 'full' ? 'full operations through failure' : 'isolated failed operation') +
      ', original failed step ' + loaded.failedIndex + '). ' +
      'The reported reason is file metadata, not rechecked: ' +
      loaded.reason.slice(0, 500) + '. Select Preview applying patch to execute explicitly.');
  } catch (error) {
    if (current()) {
      patchMessage('Failure bundle import failed: ' +
        (error instanceof Error ? error.message : 'invalid file'), true);
    }
  }
}
importFailureButton.addEventListener('click', () => failureFile.click());
failureFile.addEventListener('change', event => {
  const selected = event.target.files?.[0];
  event.target.value = '';
  if (selected) void loadFailureReproduction(selected);
});
failureImportMode.addEventListener('change', () => {
  // A mode change during an asynchronous import invalidates its proposed
  // editor replacement; the file must be selected again.
  bundleImportSequence++;
  invalidateImportedFailure('Import the bundle again for the selected replay mode.');
});

function invalidatePatchFailure() {
  latestFailure = null;
  patchFailurePanel.hidden = true;
  patchFailureSummary.textContent = '';
  patchFailureOperation.textContent = '';
  patchFailureCheckpoint.value = '';
  patchFailureNote.textContent = '';
  failureCopyButton.disabled = true;
  failureDownloadButton.disabled = true;
  failureOpenStepButton.disabled = true;
  failureCopyBundleButton.disabled = true;
  failureDownloadBundleButton.disabled = true;
  failureIsolateButton.disabled = true;
}
function currentPatchFailure() {
  if (!latestFailure || patchBase.value !== latestFailure.source ||
      patchEditor(latestFailure.source).value !== latestFailure.sourceText ||
      patchSource.value !== latestFailure.patchText) {
    invalidatePatchFailure();
    patchMessage('The failed preview is stale. Preview the patch again.', true);
    return null;
  }
  return latestFailure;
}
function showPatchFailure(error, documentSource, operations, source, sourceText) {
  const index = error.operationIndex;
  if (!Array.isArray(operations) || index < 1 || index > operations.length) return;
  const operation = operations[index - 1];
  const obj = operation && typeof operation === 'object' && !Array.isArray(operation);
  const opName = obj && typeof operation.op === 'string' ? operation.op : '(invalid)';
  const path = obj && typeof operation.path === 'string' ? operation.path : '(missing)';
  const from = obj && typeof operation.from === 'string' ? operation.from : null;
  const safeSnippet = value => value.length > 500 ?
    value.slice(0, 500) + '… (shortened)' : value;

  const completed = index - 1;
  latestFailure = {
    source, sourceText, patchText: patchSource.value,
    operationIndex: index, completed, reason: error.message,
    originalDocument: documentSource,
    operationsToFailure: operations.slice(0, index),
    json: null,
    lastGood: null
  };
  patchFailurePanel.hidden = false;
  patchFailureSummary.textContent = 'Operation ' + index + ' (' + opName +
    ') failed after ' + completed + ' completed operation' +
    (completed === 1 ? '' : 's') + '. The patch was not applied to any editor.';
  patchFailureOperation.textContent = 'Path: ' + safeSnippet(path) +
    (from === null ? '' : ' · From: ' + safeSnippet(from)) +
    ' · Reason: ' + error.message;

  try {
    const stable = applyJsonPatchPrefix(documentSource, operations, completed);
    // Match the regular read-only preview size limit. If pretty-printing
    // exceeds it, compact JSON may still fit.
    let json = JSON.stringify(stable, null, 2);
    try {
      fitInput(json, 'Last successful checkpoint');
    } catch {
      json = JSON.stringify(stable);
      fitInput(json, 'Last successful checkpoint');
    }
    latestFailure.json = json;
    latestFailure.lastGood = stable;
    patchFailureCheckpoint.value = json;
    patchFailureNote.textContent =
      'This checkpoint is the document after step ' + completed +
      ', reconstructed from the original source. It excludes the failing operation.';
    failureCopyButton.disabled = false;
    failureDownloadButton.disabled = false;
    failureOpenStepButton.disabled = false;
    failureCopyBundleButton.disabled = false;
    failureDownloadBundleButton.disabled = false;
    failureIsolateButton.disabled = false;
  } catch (snapshotError) {
    patchFailureNote.textContent = 'The failure was located, but the last successful ' +
      'checkpoint cannot be shown: ' +
      (snapshotError instanceof Error ? snapshotError.message : 'snapshot unavailable') +
      '. No partial state from the failed operation is exposed.';
  }
}
failureCopyButton.addEventListener('click', async () => {
  const failure = currentPatchFailure();
  if (!failure || failure.json === null) return;
  try {
    await navigator.clipboard.writeText(failure.json + '\n');
    patchMessage('Last successful checkpoint copied (step ' + failure.completed + ').');
  } catch {
    patchMessage('Cannot copy the checkpoint. Check clipboard permissions.', true);
  }
});
failureDownloadButton.addEventListener('click', () => {
  const failure = currentPatchFailure();
  if (!failure || failure.json === null) return;
  try {
    downloadReport(failure.json + '\n',
      'patch-' + failure.source + '-last-good-step-' + failure.completed + '.json',
      'application/json;charset=utf-8');
    patchMessage('Last successful checkpoint downloaded. The failed operation was not included.');
  } catch (error) {
    patchMessage('Checkpoint download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
function failureReproduction(failure) {
  // A successful root checkpoint can legitimately be JSON null. The
  // serialized checkpoint string is the availability sentinel.
  if (failure.json === null) {
    throw new Error('Last successful checkpoint is unavailable.');
  }
  return serializeFailureBundle({
    source: failure.source,
    failedIndex: failure.operationIndex,
    reason: failure.reason,
    sourceDocument: failure.originalDocument,
    operationsToFailure: failure.operationsToFailure,
    lastGood: failure.lastGood
  });
}
failureCopyBundleButton.addEventListener('click', async () => {
  const failure = currentPatchFailure();
  if (!failure) return;
  try {
    await navigator.clipboard.writeText(failureReproduction(failure));
    patchMessage('Failure reproduction bundle copied. It contains the full original JSON and patch prefix.');
  } catch (error) {
    patchMessage('Cannot copy failure bundle: ' +
      (error instanceof Error ? error.message : 'clipboard unavailable'), true);
  }
});
failureDownloadBundleButton.addEventListener('click', () => {
  const failure = currentPatchFailure();
  if (!failure) return;
  try {
    const content = failureReproduction(failure);
    downloadReport(content,
      'patch-' + failure.source + '-failure-operation-' +
        failure.operationIndex + '-repro.json',
      'application/json;charset=utf-8');
    patchMessage('Failure reproduction bundle downloaded. No patch was executed.');
  } catch (error) {
    patchMessage('Failure bundle download failed: ' +
      (error instanceof Error ? error.message : 'unknown error'), true);
  }
});
failureIsolateButton.addEventListener('click', () => {
  const failure = currentPatchFailure();
  if (!failure || failure.json === null) return;
  const isolated = JSON.stringify(
    [failure.operationsToFailure[failure.operationIndex - 1]], null, 2);
  try {
    fitInput(isolated, 'Isolated failing instruction');
    fitInput(failure.json, 'Last successful checkpoint');
  } catch (error) {
    patchMessage(error instanceof Error ? error.message :
      'The isolated reproduction exceeds the input limit.', true);
    return;
  }
  const label = patchSideLabel(failure.source);
  if (!confirm(
    'Replace the ' + label + ' editor with the last successful JSON and replace ' +
    'the patch editor with only operation ' + failure.operationIndex + '? ' +
    'The opposite editor will remain unchanged. No patch will run automatically.'
  )) return;

  // Cancel pending file imports and discard stale previews before replacing
  // the two user-authorized editor values.
  invalidateEditorImport(patchEditor(failure.source));
  patchImportSequence++;
  bundleImportSequence++;
  patchEditor(failure.source).value = failure.json;
  patchSource.value = isolated;
  invalidateInspection();
  resetReport();
  updateResultTarget();
  patchMessage('Isolated operation ' + failure.operationIndex + ' on the last good ' +
    label + ' checkpoint. Select Preview applying patch to reproduce the failure.');
});

failureOpenStepButton.addEventListener('click', () => {
  const failure = currentPatchFailure();
  if (!failure || failure.json === null) return;
  previewPatchStep(failure.completed);
  document.querySelector('#patch-step-heading').scrollIntoView({
    behavior: 'smooth', block: 'start'
  });
});

function invalidatePatchResult() {
  invalidatePatchFailure();
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
  // Bulk/programmatic editor replacements do not necessarily dispatch input.
  // Keep saved-only reports, but discard stale live-based comparisons.
  if (snapshotRawLiveBasis !== null) ensureLiveSnapshotComparisonFresh('raw');
  if (snapshotStructuralLiveBasis !== null)
    ensureLiveSnapshotComparisonFresh('structural');
  if (latestImportedFailure) invalidateImportedFailure(
    'Editor contents changed. Import the failure bundle again before verifying.');
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

function downloadReport(text, name, mimeType, maxBytes = MAX_REPORT_EXPORT_BYTES) {
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new RangeError('Download exceeds the ' +
      (maxBytes / (1024 * 1024)) + ' MiB export limit.');
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
  let documentSource = null;
  let operations = null;
  try {
    fitInput(editor.value, sourceLabel);
    fitInput(patchSource.value, 'Patch');
    documentSource = parseJson(editor.value, sourceLabel);
    operations = parseJson(patchSource.value, 'JSON Patch');
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
    if (error instanceof JsonPatchOperationError && operations !== null) {
      showPatchFailure(error, documentSource, operations, source, editor.value);
    }
    patchMessage(error instanceof Error ? error.message : 'Unable to apply JSON Patch.', true);
  }
}
patchBase.addEventListener('change', () => {
  if (latestImportedFailure) invalidateImportedFailure(
    'Patch source changed. Import the failure bundle again before verifying.');
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
  if (latestImportedFailure) invalidateImportedFailure(
    'Patch content changed. Import the failure bundle again before verifying.');
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
