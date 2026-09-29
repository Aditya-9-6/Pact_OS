import assert from 'node:assert';
import {
  TestClock,
  isValidIanaTimezone,
  localToUtc,
  utcToLocal,
  isDeadlineReached,
  compareInstants,
  getDeadlineStatus,
  utcToDatetimeLocalInput,
  getDefaultLocalDeadline,
  getDaysRemaining,
} from '../src/lib/time';

function runTemporalEngineTestSuite() {
  console.log('================================================================');
  console.log('  PACT Phase 2E — Deadline & Timezone Engine Unit Test Suite');
  console.log('================================================================\n');

  // ----------------------------------------------------------------
  // 1. IANA TIMEZONE VALIDATION TESTS
  // ----------------------------------------------------------------
  console.log('1. Testing IANA Timezone Validation...');
  assert.strictEqual(isValidIanaTimezone('Asia/Kolkata'), true);
  assert.strictEqual(isValidIanaTimezone('America/New_York'), true);
  assert.strictEqual(isValidIanaTimezone('Europe/London'), true);
  assert.strictEqual(isValidIanaTimezone('Australia/Sydney'), true);
  assert.strictEqual(isValidIanaTimezone('UTC'), true);

  // Vague / Invalid abbreviations must be rejected
  assert.strictEqual(isValidIanaTimezone('IST'), false, 'IST must be rejected as non-canonical');
  assert.strictEqual(isValidIanaTimezone('PST'), false, 'PST must be rejected as non-canonical');
  assert.strictEqual(isValidIanaTimezone('GMT+5:30'), false, 'GMT offsets must be rejected');
  assert.strictEqual(isValidIanaTimezone('invalid_tz_string'), false);
  assert.strictEqual(isValidIanaTimezone(''), false);
  console.log('✅ IANA Timezone Validation tests passed cleanly.\n');

  // ----------------------------------------------------------------
  // 2. TIMEZONE CONVERSION TESTS (Asia/Kolkata, America/New_York, Europe/London)
  // ----------------------------------------------------------------
  console.log('2. Testing Local <-> UTC Timezone Conversions...');

  // 2.1 Asia/Kolkata (UTC+5:30)
  const kolkataLocal = '2026-10-15T18:30:00';
  const kolkataRes = localToUtc(kolkataLocal, 'Asia/Kolkata');
  assert.strictEqual(kolkataRes.error, null);
  assert.strictEqual(kolkataRes.utcIso, '2026-10-15T13:00:00.000Z');
  console.log('✅ Asia/Kolkata local -> UTC conversion verified (18:30 IST -> 13:00 UTC).');

  // Reverse display
  const kolkataDisplay = utcToLocal('2026-10-15T13:00:00.000Z', 'Asia/Kolkata');
  assert.ok(kolkataDisplay.includes('6:30 PM') || kolkataDisplay.includes('18:30'));
  console.log(`✅ UTC -> Asia/Kolkata display verified ("${kolkataDisplay}").`);

  // 2.2 America/New_York (EDT UTC-4 during Oct)
  const nyLocal = '2026-10-15T18:30:00';
  const nyRes = localToUtc(nyLocal, 'America/New_York');
  assert.strictEqual(nyRes.error, null);
  assert.strictEqual(nyRes.utcIso, '2026-10-15T22:30:00.000Z');
  console.log('✅ America/New_York local -> UTC conversion verified (18:30 EDT -> 22:30 UTC).');

  // 2.3 Europe/London (BST UTC+1 during Oct)
  const londonLocal = '2026-10-15T18:30:00';
  const londonRes = localToUtc(londonLocal, 'Europe/London');
  assert.strictEqual(londonRes.error, null);
  assert.strictEqual(londonRes.utcIso, '2026-10-15T17:30:00.000Z');
  console.log('✅ Europe/London local -> UTC conversion verified (18:30 BST -> 17:30 UTC).\n');

  // ----------------------------------------------------------------
  // 3. ONE-SECOND BOUNDARY & DETERMINISTIC CLOCK TESTS
  // ----------------------------------------------------------------
  console.log('3. Testing One-Second Boundary Logic & Injected TestClock...');

  const targetDeadline = new Date('2026-10-15T18:30:00.000Z');
  const targetMs = targetDeadline.getTime();

  // 3.1 One second BEFORE deadline
  const clockBefore = new TestClock(targetMs - 1000); // 18:29:59.000Z
  assert.strictEqual(isDeadlineReached(targetDeadline, clockBefore), false);
  assert.strictEqual(getDeadlineStatus(targetDeadline, clockBefore), 'FUTURE');
  console.log('✅ Deadline - 1s: NOT EXPIRED (FUTURE).');

  // 3.2 EXACT second of deadline
  const clockExact = new TestClock(targetMs); // 18:30:00.000Z
  assert.strictEqual(isDeadlineReached(targetDeadline, clockExact), true);
  assert.strictEqual(getDeadlineStatus(targetDeadline, clockExact), 'EXPIRED');
  console.log('✅ Deadline EXACT: EXPIRED.');

  // 3.3 One second AFTER deadline
  const clockAfter = new TestClock(targetMs + 1000); // 18:30:01.000Z
  assert.strictEqual(isDeadlineReached(targetDeadline, clockAfter), true);
  assert.strictEqual(getDeadlineStatus(targetDeadline, clockAfter), 'EXPIRED');
  console.log('✅ Deadline + 1s: EXPIRED.\n');

  // ----------------------------------------------------------------
  // 4. MIDNIGHT LOCAL DAY TRANSITION TESTS
  // ----------------------------------------------------------------
  console.log('4. Testing Midnight Local Day Transitions...');
  const midnightBeforeLocal = '2026-10-15T23:59:59';
  const midnightBeforeRes = localToUtc(midnightBeforeLocal, 'Asia/Kolkata');
  assert.strictEqual(midnightBeforeRes.utcIso, '2026-10-15T18:29:59.000Z');

  const midnightAfterLocal = '2026-10-16T00:00:00';
  const midnightAfterRes = localToUtc(midnightAfterLocal, 'Asia/Kolkata');
  assert.strictEqual(midnightAfterRes.utcIso, '2026-10-15T18:30:00.000Z');

  const diffMs = new Date(midnightAfterRes.utcIso!).getTime() - new Date(midnightBeforeRes.utcIso!).getTime();
  assert.strictEqual(diffMs, 1000, 'Midnight local transition must differ by exactly 1 second (1000ms)');
  console.log('✅ Local midnight day transition verified (23:59:59 -> 00:00:00 differs by 1000ms).\n');

  // ----------------------------------------------------------------
  // 5. DAYLIGHT SAVING TIME (DST) SPRING-FORWARD & FALL-BACK TESTS
  // ----------------------------------------------------------------
  console.log('5. Testing DST Spring-Forward & Fall-Back Boundaries...');

  // 5.1 Spring-Forward Nonexistent Local Time (Clocks jump 02:00 -> 03:00 on March 8, 2026 in NY)
  const springForwardNonexistent = '2026-03-08T02:30:00';
  const springRes = localToUtc(springForwardNonexistent, 'America/New_York');
  assert.strictEqual(springRes.isNonexistent, true);
  assert.ok(springRes.error?.includes('DST spring-forward'));
  console.log(`✅ Nonexistent spring-forward time rejected correctly (${springRes.error}).`);

  // 5.2 Fall-Back Ambiguous Local Time (Clocks fall back 02:00 -> 01:00 on November 1, 2026 in NY)
  const fallBackAmbiguous = '2026-11-01T01:30:00';
  const fallRes = localToUtc(fallBackAmbiguous, 'America/New_York');
  assert.strictEqual(fallRes.isAmbiguous, true);
  assert.strictEqual(fallRes.error, null);
  assert.ok(fallRes.utcIso);
  console.log('✅ Ambiguous fall-back time detected correctly.\n');

  // ----------------------------------------------------------------
  // 6. TIMEZONE CHANGE INVARIANCE TESTS
  // ----------------------------------------------------------------
  console.log('6. Testing Timezone Change Invariance (Stored UTC Instant Preserved)...');

  // User A creates task in Asia/Kolkata with deadline 2026-10-15 18:30 local
  const createdInKolkata = localToUtc('2026-10-15T18:30:00', 'Asia/Kolkata');
  const storedUtcIso = createdInKolkata.utcIso!;
  assert.strictEqual(storedUtcIso, '2026-10-15T13:00:00.000Z');

  // Profile timezone updated to America/New_York
  const displayInNy = utcToLocal(storedUtcIso, 'America/New_York');

  // Verify stored UTC instant NEVER changes
  assert.strictEqual(storedUtcIso, '2026-10-15T13:00:00.000Z');
  // Verify display converted to NY time (9:00 AM EDT)
  assert.ok(displayInNy.includes('9:00 AM') || displayInNy.includes('09:00'));
  console.log(`✅ Timezone change invariance verified (Stored UTC: ${storedUtcIso}, NY Display: "${displayInNy}").\n`);

  // ----------------------------------------------------------------
  // 7. PRECISION & COMPARISON UTILITIES
  // ----------------------------------------------------------------
  console.log('7. Testing Instant Comparison Utilities...');
  const dateEarly = '2026-10-15T10:00:00.000Z';
  const dateLate = '2026-10-15T12:00:00.000Z';

  assert.ok(compareInstants(dateEarly, dateLate) < 0);
  assert.ok(compareInstants(dateLate, dateEarly) > 0);
  assert.strictEqual(compareInstants(dateEarly, dateEarly), 0);
  console.log('✅ Instant comparison utilities verified.\n');

  // ----------------------------------------------------------------
  // 8. SECTION 12 TEST MATRIX — USER DEADLINE & FORM CONVERSION INVARIANTS
  // ----------------------------------------------------------------
  console.log('8. Testing Section 12 Test Matrix Invariants...');

  // CASE 1 — India (Asia/Kolkata) 22:25
  const case1 = localToUtc('2026-09-18T22:25', 'Asia/Kolkata');
  assert.strictEqual(case1.utcIso, '2026-09-18T16:55:00.000Z');
  assert.strictEqual(utcToDatetimeLocalInput(case1.utcIso!, 'Asia/Kolkata'), '2026-09-18T22:25');
  assert.strictEqual(utcToLocal(case1.utcIso!, 'Asia/Kolkata'), 'Sep 18, 2026, 10:25 PM');
  console.log('✅ Case 1: India 22:25 -> 16:55 UTC -> 10:25 PM / 22:25 verified.');

  // CASE 2 — Morning 08:30
  const case2 = localToUtc('2026-09-18T08:30', 'Asia/Kolkata');
  assert.strictEqual(case2.utcIso, '2026-09-18T03:00:00.000Z');
  assert.strictEqual(utcToDatetimeLocalInput(case2.utcIso!, 'Asia/Kolkata'), '2026-09-18T08:30');
  assert.strictEqual(utcToLocal(case2.utcIso!, 'Asia/Kolkata'), 'Sep 18, 2026, 8:30 AM');
  console.log('✅ Case 2: Morning 08:30 -> 03:00 UTC -> 08:30 verified.');

  // CASE 3 — Midnight 00:15
  const case3 = localToUtc('2026-09-18T00:15', 'Asia/Kolkata');
  assert.strictEqual(case3.utcIso, '2026-09-17T18:45:00.000Z');
  assert.strictEqual(utcToDatetimeLocalInput(case3.utcIso!, 'Asia/Kolkata'), '2026-09-18T00:15');
  assert.strictEqual(utcToLocal(case3.utcIso!, 'Asia/Kolkata'), 'Sep 18, 2026, 12:15 AM');
  console.log('✅ Case 3: Midnight 00:15 on 2026-09-18 verified on correct local date.');

  // CASE 4 — Date boundary 23:55
  const case4 = localToUtc('2026-09-18T23:55', 'Asia/Kolkata');
  assert.strictEqual(case4.utcIso, '2026-09-18T18:25:00.000Z');
  assert.strictEqual(utcToDatetimeLocalInput(case4.utcIso!, 'Asia/Kolkata'), '2026-09-18T23:55');
  assert.strictEqual(utcToLocal(case4.utcIso!, 'Asia/Kolkata'), 'Sep 18, 2026, 11:55 PM');
  console.log('✅ Case 4: Date boundary 23:55 preserved on correct local date.');

  // CASE 5 — Round trip across various wall-clock dates
  const sampleTimes = ['2026-01-01T00:00', '2026-04-10T09:15', '2026-07-22T15:45', '2026-12-31T23:59'];
  for (const st of sampleTimes) {
    const u = localToUtc(st, 'Asia/Kolkata').utcIso!;
    const b = utcToDatetimeLocalInput(u, 'Asia/Kolkata');
    assert.strictEqual(b, st);
  }
  console.log('✅ Case 5: Lossless round-trip verified for all sample times.');

  // CASE 6 — Different timezone (America/New_York, Asia/Tokyo, Europe/London)
  const case6Ny = localToUtc('2026-09-18T14:00', 'America/New_York');
  assert.strictEqual(case6Ny.utcIso, '2026-09-18T18:00:00.000Z');
  assert.strictEqual(utcToDatetimeLocalInput(case6Ny.utcIso!, 'America/New_York'), '2026-09-18T14:00');

  const case6Tokyo = localToUtc('2026-09-18T14:00', 'Asia/Tokyo');
  assert.strictEqual(case6Tokyo.utcIso, '2026-09-18T05:00:00.000Z');
  assert.strictEqual(utcToDatetimeLocalInput(case6Tokyo.utcIso!, 'Asia/Tokyo'), '2026-09-18T14:00');
  console.log('✅ Case 6: Non-India timezones verified generically.');

  // CASE 7 — Deadline comparison using UTC instant
  const dlUtc = new Date('2026-09-18T16:55:00.000Z');
  const clockBeforeCase7 = new TestClock('2026-09-18T16:54:59.000Z');
  const clockAfterCase7 = new TestClock('2026-09-18T16:55:00.000Z');
  assert.strictEqual(isDeadlineReached(dlUtc, clockBeforeCase7), false);
  assert.strictEqual(isDeadlineReached(dlUtc, clockAfterCase7), true);
  console.log('✅ Case 7: Authoritative UTC deadline comparison verified.');

  // CASE 8 — Default local deadline helper
  const fixedNow = new TestClock('2026-09-18T10:00:00.000Z'); // 15:30 IST
  const defaultDl = getDefaultLocalDeadline('Asia/Kolkata', fixedNow);
  assert.strictEqual(defaultDl, '2026-09-19T23:59');
  console.log('✅ Case 8: Default local deadline generator verified (tomorrow at 23:59 in local tz).');

  // CASE 9 — Existing task from database: "2026-09-18 16:55:00+00"
  const existingDbUtc = '2026-09-18 16:55:00+00';
  assert.strictEqual(utcToDatetimeLocalInput(existingDbUtc, 'Asia/Kolkata'), '2026-09-18T22:25');
  assert.strictEqual(utcToLocal(existingDbUtc, 'Asia/Kolkata'), 'Sep 18, 2026, 10:25 PM');
  // CASE 10 — getDaysRemaining helper function (#169, #177)
  const baseClock = new TestClock('2026-09-18T12:00:00.000Z');

  // Future date: exactly 5 days ahead
  const futureDate = new Date('2026-09-23T12:00:00.000Z');
  assert.strictEqual(getDaysRemaining(futureDate, baseClock), 5, 'Future date 5 days ahead must return 5');
  assert.strictEqual(getDaysRemaining('2026-09-23T12:00:00.000Z', baseClock), 5, 'String future date must return 5');

  // Past date: returns 0
  const pastDate = new Date('2026-09-17T12:00:00.000Z');
  assert.strictEqual(getDaysRemaining(pastDate, baseClock), 0, 'Past date must return 0');
  assert.strictEqual(getDaysRemaining('2026-09-10T00:00:00.000Z', baseClock), 0, 'Past string date must return 0');

  // Today's date: same calendar day returns 0
  const sameDayLater = new Date('2026-09-18T18:00:00.000Z');
  assert.strictEqual(getDaysRemaining(sameDayLater, baseClock), 0, "Today's date must return 0");

  // Invalid date: returns 0 safely
  assert.strictEqual(getDaysRemaining('invalid-date', baseClock), 0, 'Invalid date must return 0');
  console.log('✅ Case 10: getDaysRemaining helper verified for future, past, today, and invalid inputs.\n');

  console.log('================================================================');
  console.log('🎉 ALL TEMPORAL ENGINE & TIMEZONE UNIT TESTS PASSED CLEANLY');
  console.log('================================================================\n');
}

runTemporalEngineTestSuite();
