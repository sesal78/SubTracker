# SubTracker - Subscription & Bills Tracker

## Metadata
- Version: 1.0
- Last Updated: 2025-01-27
- Depends On: ARCHITECTURE.md
- Breaking Changes: No

---

## Overview

A mobile-first personal subscription and bills tracker that helps you:
- Never forget a subscription renewal
- See your total recurring expenses at a glance
- Get timely reminders before billing dates

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native + Expo (SDK 50+) |
| Database | Expo SQLite |
| Notifications | expo-notifications |
| State Management | Zustand |
| UI Components | React Native Paper |
| Navigation | Expo Router |

---

## Project Structure

```
SubTracker/
├── app/                    # Expo Router screens
│   ├── (tabs)/
│   │   ├── index.tsx       # Dashboard
│   │   ├── subscriptions.tsx
│   │   └── settings.tsx
│   ├── subscription/
│   │   ├── add.tsx
│   │   └── [id].tsx        # Edit/View
│   └── _layout.tsx
├── src/
│   ├── components/         # Reusable UI components
│   ├── services/           # Business logic layer
│   │   ├── database.ts     # SQLite operations
│   │   ├── notifications.ts
│   │   └── subscriptions.ts
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Helpers (date, currency)
│   └── constants/          # Categories, defaults
├── assets/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SECURITY_REVIEW.md
│   ├── MONITORING.md
│   └── LESSONS.md
└── package.json
```

---

## Database Schema

### subscriptions

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    next_billing_date TEXT NOT NULL,
    start_date TEXT NOT NULL,
    category_id TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    reminder_days TEXT DEFAULT '[3]',
    notification_ids TEXT DEFAULT '[]',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);
```

### categories

```sql
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,
    color TEXT NOT NULL
);

-- Default categories
INSERT OR IGNORE INTO categories (id, name, icon, color) VALUES
    ('streaming', 'Streaming', 'play-circle', '#E50914'),
    ('software', 'Software', 'laptop', '#0078D4'),
    ('fitness', 'Fitness', 'dumbbell', '#4CAF50'),
    ('gaming', 'Gaming', 'gamepad-variant', '#9C27B0'),
    ('music', 'Music', 'music', '#1DB954'),
    ('news', 'News & Media', 'newspaper', '#FF9800'),
    ('storage', 'Cloud Storage', 'cloud', '#2196F3'),
    ('utilities', 'Utilities', 'flash', '#FFC107'),
    ('other', 'Other', 'dots-horizontal', '#607D8B');
```

### settings

```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('default_currency', 'USD'),
    ('default_reminder_days', '[3]'),
    ('notifications_enabled', 'true');
```

---

## Service Layer API

### SubscriptionService

```typescript
interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextBillingDate: string; // ISO date
  startDate: string;
  categoryId: string;
  notes?: string;
  isActive: boolean;
  reminderDays: number[];
  notificationIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Create
async function createSubscription(data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'notificationIds'>): Promise<Subscription>

// Read
async function getSubscription(id: string): Promise<Subscription | null>
async function getAllSubscriptions(): Promise<Subscription[]>
async function getActiveSubscriptions(): Promise<Subscription[]>
async function getUpcomingBills(days: number): Promise<Subscription[]>

// Update
async function updateSubscription(id: string, data: Partial<Subscription>): Promise<Subscription>
async function toggleSubscriptionActive(id: string): Promise<Subscription>

// Delete
async function deleteSubscription(id: string): Promise<void>

// Analytics
async function getMonthlyTotal(currency?: string): Promise<number>
async function getYearlyTotal(currency?: string): Promise<number>
async function getByCategory(): Promise<{categoryId: string, total: number}[]>
```

### NotificationService

```typescript
// Schedule reminders for a subscription
async function scheduleReminders(subscription: Subscription): Promise<string[]>

// Cancel all reminders for a subscription
async function cancelReminders(notificationIds: string[]): Promise<void>

// Reschedule after billing date passes
async function rescheduleAfterBilling(subscription: Subscription): Promise<string[]>

// Request notification permissions
async function requestPermissions(): Promise<boolean>
```

### CategoryService

```typescript
interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

async function getAllCategories(): Promise<Category[]>
async function getCategory(id: string): Promise<Category | null>
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator or Android Emulator (or physical device)

### Installation

```bash
# Clone and install
cd SubTracker
npm install

# Start development server
npx expo start

# Run on iOS
npx expo run:ios

# Run on Android
npx expo run:android
```

### Environment Variables

```bash
# .env (optional for MVP)
EXPO_PUBLIC_DEFAULT_CURRENCY=USD
```

---

## Billing Cycle Calculations

```typescript
function getNextBillingDate(currentDate: Date, cycle: BillingCycle): Date {
  switch (cycle) {
    case 'weekly':
      return addDays(currentDate, 7);
    case 'monthly':
      return addMonths(currentDate, 1);
    case 'quarterly':
      return addMonths(currentDate, 3);
    case 'yearly':
      return addYears(currentDate, 1);
  }
}

function calculateMonthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly': return amount * 4.33;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / 12;
  }
}
```

---

## API Change Management

Since this is a local-first app, "API changes" refer to:
1. **Database schema migrations** - Handled via version checks on app launch
2. **Service interface changes** - TypeScript will catch breaking changes

If schema changes:
- Affected: All services using that table
- Migration required in `database.ts` init function
