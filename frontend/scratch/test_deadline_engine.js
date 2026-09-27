import {
  extractSingleAnnouncementClient,
  detectDeadlineClusters,
  analyzeDeadlineAmbiguity,
  parseRelativeDate,
} from '../src/utils/deadlineEngine.js';

console.log('==================================================');
console.log('RUNNING DEADLINE PILE-UP AUTOMATED TEST SUITE');
console.log('==================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${message}`);
  }
}

// Test Case 1: Normal explicit date
const tc1Text = "DBMS Assignment due October 15, 2026.";
const tc1 = extractSingleAnnouncementClient(tc1Text, 0);
assert(tc1.title === "DBMS Assignment", "TC1 Title extracted correctly");
assert(tc1.status === "verified", "TC1 Explicit date is verified");
assert(tc1.deadlineDate === "2026-10-15", "TC1 Date parsed as 2026-10-15");
assert(tc1.supportingSource.includes("DBMS Assignment"), "TC1 Supporting source text is present");

// Test Case 2: Missing year
const tc2Text = "OS Lab Report due October 18.";
const tc2 = extractSingleAnnouncementClient(tc2Text, 1);
assert(tc2.status === "needs_verification", "TC2 Missing year marked as needs_verification");
assert(tc2.ambiguityType === "missing_year", "TC2 Ambiguity type is missing_year");
assert(tc2.message.includes("Year missing from source"), "TC2 Flagged with missing year message");

// Test Case 3: Relative date
const tc3Text = "AI assignment due next Friday.";
const tc3 = extractSingleAnnouncementClient(tc3Text, 2);
assert(tc3.status === "needs_verification", "TC3 Relative date marked as needs_verification");
assert(tc3.ambiguityType === "relative_date", "TC3 Ambiguity type is relative_date");
assert(tc3.detectedPhrase.toLowerCase().includes("next friday"), "TC3 Detected phrase is 'next Friday'");
assert(tc3.suggestedDate !== null, "TC3 Provides a suggested date interpretation");

// Test Case 4: Ambiguous numeric date
const tc4Text = "Networks assignment due 10/11.";
const tc4 = extractSingleAnnouncementClient(tc4Text, 3);
assert(tc4.status === "needs_verification", "TC4 Ambiguous numeric date marked as needs_verification");
assert(tc4.ambiguityType === "ambiguous_numeric_date", "TC4 Ambiguity type is ambiguous_numeric_date");
assert(tc4.ambiguousOptions && tc4.ambiguousOptions.length === 2, "TC4 Offers 2 options for MM/DD vs DD/MM");

// Test Case 5: Conflicting dates
const tc5Text = "Final submission is October 20. The announcement later says October 22.";
const tc5 = extractSingleAnnouncementClient(tc5Text, 4);
assert(tc5.status === "conflicting", "TC5 Conflicting dates marked as conflicting");
assert(tc5.ambiguityType === "conflicting_dates", "TC5 Ambiguity type is conflicting_dates");
assert(tc5.conflictingDates && tc5.conflictingDates.length >= 2, "TC5 Detects multiple conflicting dates");

// Test Case 6: Exact 48-Hour Cluster (Must be flagged)
const exact48hItems = [
  { id: '1', title: 'Task 1', subject: 'CS1', deadlineDate: '2026-10-10', deadlineTime: '10:00', hasExplicitTime: true, status: 'verified' },
  { id: '2', title: 'Task 2', subject: 'CS2', deadlineDate: '2026-10-11', deadlineTime: '10:00', hasExplicitTime: true, status: 'verified' },
  { id: '3', title: 'Task 3', subject: 'CS3', deadlineDate: '2026-10-12', deadlineTime: '10:00', hasExplicitTime: true, status: 'verified' },
];
const cluster48 = detectDeadlineClusters(exact48hItems);
assert(cluster48.hasClusters === true, "TC6 Exact 48-hour span (Oct 10 10:00 to Oct 12 10:00) IS FLAGGED as cluster");
assert(cluster48.clusters.length === 1, "TC6 Detects 1 cluster");
assert(cluster48.clusters[0].count === 3, "TC6 Cluster includes all 3 submissions");

// Test Case 7: 49-Hour Case (Must NOT be flagged)
const exact49hItems = [
  { id: '1', title: 'Task 1', subject: 'CS1', deadlineDate: '2026-10-10', deadlineTime: '10:00', hasExplicitTime: true, status: 'verified' },
  { id: '2', title: 'Task 2', subject: 'CS2', deadlineDate: '2026-10-11', deadlineTime: '10:00', hasExplicitTime: true, status: 'verified' },
  { id: '3', title: 'Task 3', subject: 'CS3', deadlineDate: '2026-10-12', deadlineTime: '11:00', hasExplicitTime: true, status: 'verified' },
];
const cluster49 = detectDeadlineClusters(exact49hItems);
assert(cluster49.hasClusters === false, "TC7 49-hour span (Oct 10 10:00 to Oct 12 11:00) IS NOT FLAGGED as cluster");

// Test Case 8: Six deadlines with no cluster
const noCluster6Items = [
  { id: '1', title: 'T1', subject: 'S1', deadlineDate: '2026-10-01', status: 'verified' },
  { id: '2', title: 'T2', subject: 'S2', deadlineDate: '2026-10-08', status: 'verified' },
  { id: '3', title: 'T3', subject: 'S3', deadlineDate: '2026-10-15', status: 'verified' },
  { id: '4', title: 'T4', subject: 'S4', deadlineDate: '2026-10-22', status: 'verified' },
  { id: '5', title: 'T5', subject: 'S5', deadlineDate: '2026-11-01', status: 'verified' },
  { id: '6', title: 'T6', subject: 'S6', deadlineDate: '2026-11-10', status: 'verified' },
];
const clusterNoCluster6 = detectDeadlineClusters(noCluster6Items);
assert(clusterNoCluster6.hasClusters === false, "TC8 Six spaced deadlines result in NO cluster detected");

// Test Case 9: Unverified items excluded from clustering
const unverifiedMixItems = [
  { id: '1', title: 'Task 1', subject: 'CS1', deadlineDate: '2026-10-10', deadlineTime: '10:00', hasExplicitTime: true, status: 'verified' },
  { id: '2', title: 'Task 2', subject: 'CS2', deadlineDate: '2026-10-11', deadlineTime: '10:00', hasExplicitTime: true, status: 'needs_verification' },
  { id: '3', title: 'Task 3', subject: 'CS3', deadlineDate: '2026-10-12', deadlineTime: '10:00', hasExplicitTime: true, status: 'verified' },
];
const clusterUnverified = detectDeadlineClusters(unverifiedMixItems);
assert(clusterUnverified.hasClusters === false, "TC9 Unverified items are excluded from cluster detection");

// Test Case 10: Out of order chronological sorting by code
const unorderedItems = [
  { id: '1', title: 'Oct 20', subject: 'S', deadlineDate: '2026-10-20', status: 'verified' },
  { id: '2', title: 'Oct 10', subject: 'S', deadlineDate: '2026-10-10', status: 'verified' },
  { id: '3', title: 'Oct 12', subject: 'S', deadlineDate: '2026-10-12', status: 'verified' },
  { id: '4', title: 'Oct 11', subject: 'S', deadlineDate: '2026-10-11', status: 'verified' },
];
const sortedRes = detectDeadlineClusters(unorderedItems);
assert(sortedRes.sortedVerifiedItems[0].title === 'Oct 10', "TC10 Application code sorts deadlines chronologically");
assert(sortedRes.sortedVerifiedItems[1].title === 'Oct 11', "TC10 Second sorted item is Oct 11");
assert(sortedRes.sortedVerifiedItems[2].title === 'Oct 12', "TC10 Third sorted item is Oct 12");
assert(sortedRes.sortedVerifiedItems[3].title === 'Oct 20', "TC10 Fourth sorted item is Oct 20");

console.log('\n==================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('==================================================');
