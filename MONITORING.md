# SubTracker - Monitoring & Observability

## Metadata
- Version: 1.0
- Last Updated: 2025-01-27
- Depends On: ARCHITECTURE.md, README.md
- Breaking Changes: No

---

## Overview

As a local-first mobile application, SubTracker has limited observability requirements compared to server-side applications. Focus is on:
- Local error tracking
- Notification delivery verification
- User-facing health indicators

---

## Logging Strategy

### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| ERROR | Unrecoverable failures | Database init failed, notification scheduling failed |
| WARN | Recoverable issues | Past billing date detected, permission denied |
| INFO | Key user actions | Subscription created, reminder triggered |
| DEBUG | Development only | SQL queries, state changes |

### Logging Implementation

```typescript
// src/utils/logger.ts
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

function log(level: keyof typeof LOG_LEVELS, message: string, data?: object) {
  if (__DEV__ || level === 'ERROR') {
    console.log(`[${level}] ${new Date().toISOString()} - ${message}`, data || '');
  }
  
  // In production, only ERROR logs are persisted
  if (level === 'ERROR' && !__DEV__) {
    persistErrorLog({ level, message, data, timestamp: Date.now() });
  }
}
```

### What to Log

| Event | Level | Data |
|-------|-------|------|
| App launch | INFO | App version, device info |
| Database initialized | INFO | Schema version |
| Subscription created | INFO | Subscription ID (not name/amount) |
| Notification scheduled | INFO | Subscription ID, trigger date |
| Notification permission denied | WARN | - |
| Database query failed | ERROR | Query type, error message |
| Notification scheduling failed | ERROR | Subscription ID, error |

### What NOT to Log

- Subscription names
- Amounts
- User notes
- Any PII

---

## Key Metrics

### MVP Metrics (Local Only)

| Metric | Type | Description |
|--------|------|-------------|
| `subscriptions.total` | Gauge | Total subscription count |
| `subscriptions.active` | Gauge | Active subscription count |
| `monthly_spend` | Gauge | Calculated monthly total |
| `notifications.scheduled` | Counter | Notifications created |
| `notifications.triggered` | Counter | Notifications delivered |
| `errors.count` | Counter | Error occurrences |

### Implementation

```typescript
// src/utils/metrics.ts
class LocalMetrics {
  private metrics: Map<string, number> = new Map();
  
  increment(name: string, value = 1) {
    this.metrics.set(name, (this.metrics.get(name) || 0) + value);
  }
  
  set(name: string, value: number) {
    this.metrics.set(name, value);
  }
  
  getAll(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
}
```

---

## Health Checks

### App Health Indicators

| Check | Description | Recovery |
|-------|-------------|----------|
| Database accessible | SQLite connection works | Show error, prompt reinstall |
| Notifications permitted | OS permission granted | Prompt to enable |
| Storage available | Sufficient disk space | Warn user |

### Health Check Screen

Settings > App Health shows:
- Database status: OK / Error
- Notifications: Enabled / Disabled
- Storage used: X MB
- Last backup: Never / Date
- App version: X.X.X

---

## Alert Conditions

Since this is a local app, "alerts" are user-facing messages:

| Condition | User Alert |
|-----------|------------|
| Notification permission revoked | Banner: "Enable notifications to receive reminders" |
| Database error | Modal: "Data error - please restart app" |
| 10+ subscriptions with past billing dates | Dashboard warning: "X subscriptions need attention" |
| No subscriptions added after 7 days | Onboarding prompt |

---

## Error Persistence

Errors are stored locally for debugging:

```sql
CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    timestamp INTEGER NOT NULL,
    app_version TEXT,
    resolved INTEGER DEFAULT 0
);

-- Auto-cleanup: keep last 100 errors
DELETE FROM error_logs WHERE id NOT IN (
    SELECT id FROM error_logs ORDER BY timestamp DESC LIMIT 100
);
```

---

## Observability Gaps (MVP vs Future)

| Capability | MVP | v2 Improvement |
|------------|-----|----------------|
| Crash reporting | None | Sentry/Bugsnag integration |
| Analytics | None | Privacy-respecting analytics (Plausible) |
| Remote logging | None | Opt-in error reporting |
| Performance monitoring | None | React Native Performance API |
| Notification delivery tracking | Local only | Expo notification receipts |

---

## Debug Tools (Development)

### Dev Menu Options

- Export error logs
- View all scheduled notifications
- Clear all data
- Force notification test
- View metrics dashboard

### Debug Commands

```typescript
// Available in __DEV__ mode
window.DEBUG = {
  exportLogs: () => exportErrorLogs(),
  listNotifications: () => Notifications.getAllScheduledNotificationsAsync(),
  clearData: () => database.reset(),
  triggerTestNotification: () => sendTestNotification(),
  metrics: () => localMetrics.getAll()
};
```

---

## Recommended Future Observability

1. **Sentry Integration** - Crash and error reporting
2. **Expo Updates Analytics** - Track OTA update adoption
3. **Custom Events** - Opt-in usage analytics
4. **Notification Receipt Tracking** - Verify delivery via Expo API
