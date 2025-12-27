# SubTracker - Security Review

## Metadata
- Version: 1.0
- Last Updated: 2025-01-27
- Depends On: ARCHITECTURE.md, README.md
- Breaking Changes: No

---

## Security Model Overview

SubTracker is a **local-first, single-user** mobile application. All data is stored on-device in SQLite. There is no backend server, no user authentication, and no network transmission of user data (except push notification tokens to Expo).

---

## Authentication & Authorization Review

| Aspect | Status | Notes |
|--------|--------|-------|
| User Authentication | N/A | Single-user app, no login required |
| API Authentication | N/A | No backend APIs |
| Session Management | N/A | No sessions |
| Device Authentication | OPTIONAL | Can add biometric lock in v2 |

**Recommendation for v2:** Add optional biometric/PIN lock for app access.

---

## Input Validation Risks

| Input | Risk | Mitigation |
|-------|------|------------|
| Subscription name | XSS if rendered unsafely | React Native auto-escapes; validate max length (100 chars) |
| Amount | Negative/invalid numbers | Validate: positive number, max 2 decimal places, max 999,999.99 |
| Currency code | Invalid codes | Validate against ISO 4217 whitelist |
| Billing cycle | Invalid enum | Validate against allowed values only |
| Next billing date | Past dates | Warn but allow (for historical tracking) |
| Notes | Large text injection | Limit to 500 characters |
| Category ID | Invalid reference | Validate exists in categories table |

### Validation Implementation

```typescript
const subscriptionSchema = {
  name: { required: true, maxLength: 100 },
  amount: { required: true, min: 0.01, max: 999999.99 },
  currency: { required: true, enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'] },
  billingCycle: { required: true, enum: ['weekly', 'monthly', 'quarterly', 'yearly'] },
  nextBillingDate: { required: true, type: 'date' },
  notes: { maxLength: 500 }
};
```

---

## Data Exposure Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Device theft = data access | MEDIUM | Data is not sensitive (no passwords/payment info); add biometric lock in v2 |
| SQLite file readable on rooted device | LOW | Accept for MVP; could encrypt DB in v2 |
| Backup includes subscription data | LOW | User-controlled; acceptable |
| Screen capture of financial data | LOW | No prevention in MVP; could add secure view flag in v2 |

**Accepted MVP Risks:**
- Data visible if device is unlocked
- No encryption at rest for SQLite database

---

## Integration & Webhook Security

| Integration | Risk | Mitigation |
|-------------|------|------------|
| Expo Push Notifications | Token exposure | Token only sent to Expo servers over HTTPS |
| No third-party APIs | N/A | No external data transmission |

### Push Notification Security

```
- Push tokens are device-specific, not user-identifiable
- Expo handles token securely via their infrastructure
- No sensitive data is sent in notification payloads
- Notification content: "Netflix renewal in 3 days - $15.99"
  (amount optional, can be disabled in settings)
```

---

## Data Privacy Assessment

| Data Type | Stored | Transmitted | Risk Level |
|-----------|--------|-------------|------------|
| Subscription names | Local SQLite | Never | LOW |
| Amounts | Local SQLite | Never | LOW |
| Billing dates | Local SQLite | Never | LOW |
| Push token | Local + Expo | HTTPS to Expo | LOW |
| Notes | Local SQLite | Never | LOW |

**GDPR/Privacy Considerations:**
- No PII collected beyond subscription names (user-entered)
- No analytics or tracking in MVP
- No account creation = no email/password stored
- All data deletable via app uninstall

---

## Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Malicious app on device reads SQLite | LOW | MEDIUM | OS sandboxing; encrypt DB in v2 |
| Man-in-middle on push notification | VERY LOW | LOW | Expo uses HTTPS/certificate pinning |
| Physical device access | MEDIUM | LOW | Biometric lock in v2 |
| Malicious Expo SDK update | VERY LOW | HIGH | Pin Expo SDK version; review changelogs |

---

## Recommended Security Enhancements (v2)

1. **Biometric/PIN Lock** - Optional app-level authentication
2. **SQLite Encryption** - Use `expo-sqlite` with SQLCipher
3. **Secure Display Flag** - Prevent screenshots of sensitive screens
4. **Data Export Encryption** - Password-protect exported data

---

## Security Checklist

| Item | Status |
|------|--------|
| Input validation on all fields | REQUIRED |
| No sensitive data in logs | REQUIRED |
| No sensitive data in notifications (configurable) | REQUIRED |
| HTTPS for all network calls | REQUIRED |
| Dependency audit (`npm audit`) | REQUIRED |
| No hardcoded secrets | N/A (no secrets) |

---

## Residual Risks Accepted for MVP

1. **No encryption at rest** - SQLite database is unencrypted
2. **No app lock** - Anyone with device access can open app
3. **Data loss on uninstall** - No cloud backup
4. **Amount visible in notifications** - Configurable, default ON

These are acceptable for a personal-use MVP with no truly sensitive financial data (no account numbers, no passwords).
