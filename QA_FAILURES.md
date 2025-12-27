# SubTracker - QA & Failure Mode Analysis

## Metadata
- Version: 1.0
- Last Updated: 2025-01-27
- Depends On: ARCHITECTURE.md, README.md, SECURITY_REVIEW.md
- Breaking Changes: No

---

## Agent 4: Workflow Automation Engineer - SKIPPED

**Reason:** This is a local-first mobile application with no backend workflows, n8n integrations, or event-driven automations. All "workflows" are handled within the app's business logic layer.

---

## Agent 5: AI Agent / Prompt Engineer - SKIPPED

**Reason:** SubTracker MVP contains no AI-driven logic. It is a pure CRUD + notification scheduling application with deterministic behavior.

---

## Agent 6: QA / Failure Mode Analysis

### Failure Mode Table

| # | Failure | Severity | Test Case | Mitigation |
|---|---------|----------|-----------|------------|
| 1 | Database initialization fails on first launch | CRITICAL | 1. Fresh install 2. Launch app 3. Check for crash | Wrap init in try-catch, show user-friendly error, log to error table in fallback mode |
| 2 | Notification permission denied | HIGH | 1. Launch app 2. Deny notification permission 3. Add subscription | Show persistent banner, disable reminder scheduling, allow re-prompt from settings |
| 3 | Past billing date entered, notification scheduled for past | MEDIUM | 1. Add subscription with nextBillingDate = yesterday 2. Check notification list | Validate date on save, auto-advance to next cycle if past, warn user |
| 4 | App killed by OS, notification still fires | MEDIUM | 1. Add subscription 2. Force close app 3. Wait for reminder time | Use Expo scheduled notifications (OS-level), not app-level timers |
| 5 | Duplicate subscription names cause confusion | LOW | 1. Add "Netflix" 2. Add another "Netflix" | Allow duplicates (user may have multiple accounts), show dates to differentiate |
| 6 | Invalid amount entered (negative, NaN) | HIGH | 1. Enter amount = -50 2. Enter amount = "abc" | Input validation: positive numbers only, 2 decimal places max |
| 7 | Currency mismatch in monthly total | MEDIUM | 1. Add USD subscription 2. Add EUR subscription 3. View monthly total | Show totals per currency, or show warning about mixed currencies |
| 8 | Notification fires but app crashes on open | HIGH | 1. Schedule notification 2. Corrupt database 3. Tap notification | Graceful error handling on launch, recovery mode, database integrity check |
| 9 | Timezone change causes wrong notification time | MEDIUM | 1. Add subscription in EST 2. Travel to PST 3. Check notification time | Store dates in UTC, recalculate notification times on timezone change |
| 10 | Rapid add/delete causes race condition | MEDIUM | 1. Add subscription 2. Immediately delete before save completes | Disable UI during async operations, queue database operations |
| 11 | App update resets database | CRITICAL | 1. Add subscriptions 2. Update app 3. Check data | Use persistent SQLite storage path, never drop tables on update |
| 12 | 1000+ subscriptions causes performance issues | LOW | 1. Add 1000 subscriptions programmatically 2. Navigate app | Pagination, virtualized lists, indexed database queries |
| 13 | Notification content reveals sensitive data | MEDIUM | 1. Configure notification 2. View on lock screen | Setting to hide amounts in notifications, use generic text |
| 14 | Category deleted while subscriptions reference it | LOW | N/A - MVP has fixed categories | MVP: Categories are read-only. v2: Cascade to "Other" category |
| 15 | Leap year/month end billing date edge case | MEDIUM | 1. Add subscription on Jan 31 with monthly cycle 2. Check Feb billing date | Use date-fns/luxon for date math, handle month-end correctly |

---

## Test Case Details

### TC-1: Database Initialization Failure

```typescript
// Test: Mock SQLite.openDatabase to throw
jest.mock('expo-sqlite', () => ({
  openDatabase: () => { throw new Error('Database locked'); }
}));

// Expected: App shows error screen, not crash
// Expected: User can retry or reinstall
```

### TC-3: Past Billing Date Handling

```typescript
// Test: Create subscription with past date
const sub = await createSubscription({
  name: 'Test',
  nextBillingDate: '2024-01-01', // Past date
  billingCycle: 'monthly',
  // ...
});

// Expected: nextBillingDate auto-advanced to future
// Expected: Warning shown to user
expect(new Date(sub.nextBillingDate) > new Date()).toBe(true);
```

### TC-9: Timezone Change

```typescript
// Test: Simulate timezone change
const sub = await createSubscription({
  nextBillingDate: '2025-02-15T09:00:00Z', // UTC
  reminderDays: [1],
});

// Mock timezone change
jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone: 'America/Los_Angeles' }) });

// Trigger recalculation
await recalculateNotifications();

// Expected: Notification fires at correct local time
```

---

## Recommended Fixes from Analysis

1. **Add input validation layer** - Zod schema for all subscription fields
2. **Add database integrity check on launch** - Quick SELECT to verify tables exist
3. **Add timezone change listener** - Reschedule notifications when TZ changes
4. **Add loading states** - Disable buttons during async operations
5. **Add date normalization** - Always advance past dates to next cycle

---

## Issues to Log in LESSONS.md

None yet - this is pre-implementation analysis.
