import * as Crypto from 'expo-crypto';
import { addDays, addMonths, addWeeks, addYears, parseISO, isBefore, startOfDay } from 'date-fns';
import { executeSql, runSql } from './database';
import { scheduleReminders, cancelReminders } from './notifications';
import { Subscription, SubscriptionInput, BillingCycle } from '../types';

interface DbSubscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string;
  start_date: string;
  category_id: string;
  notes: string | null;
  is_active: number;
  reminder_days: string;
  notification_ids: string;
  created_at: string;
  updated_at: string;
}

function mapFromDb(row: DbSubscription): Subscription {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    currency: row.currency,
    billingCycle: row.billing_cycle as BillingCycle,
    nextBillingDate: row.next_billing_date,
    startDate: row.start_date,
    categoryId: row.category_id,
    notes: row.notes || undefined,
    isActive: row.is_active === 1,
    reminderDays: JSON.parse(row.reminder_days),
    notificationIds: JSON.parse(row.notification_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getNextBillingDate(currentDate: Date, cycle: BillingCycle): Date {
  switch (cycle) {
    case 'weekly': return addWeeks(currentDate, 1);
    case 'monthly': return addMonths(currentDate, 1);
    case 'quarterly': return addMonths(currentDate, 3);
    case 'yearly': return addYears(currentDate, 1);
  }
}

export function advanceToFuture(dateStr: string, cycle: BillingCycle): string {
  let date = parseISO(dateStr);
  const today = startOfDay(new Date());
  while (isBefore(date, today)) {
    date = getNextBillingDate(date, cycle);
  }
  return date.toISOString().split('T')[0];
}

export function calculateMonthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly': return amount * 4.33;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / 12;
  }
}

export async function createSubscription(input: SubscriptionInput): Promise<Subscription> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const nextBillingDate = advanceToFuture(input.nextBillingDate, input.billingCycle);

  await runSql(
    `INSERT INTO subscriptions (id, name, amount, currency, billing_cycle, next_billing_date, start_date, category_id, notes, is_active, reminder_days, notification_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.amount, input.currency, input.billingCycle, nextBillingDate, input.startDate, input.categoryId, input.notes || null, input.isActive ? 1 : 0, JSON.stringify(input.reminderDays), '[]', now, now]
  );

  const subscription = await getSubscription(id);
  if (subscription && subscription.isActive) {
    const notificationIds = await scheduleReminders(subscription);
    await runSql('UPDATE subscriptions SET notification_ids = ? WHERE id = ?', [JSON.stringify(notificationIds), id]);
    subscription.notificationIds = notificationIds;
  }
  return subscription!;
}

export async function getSubscription(id: string): Promise<Subscription | null> {
  const rows = await executeSql<DbSubscription>('SELECT * FROM subscriptions WHERE id = ?', [id]);
  return rows.length > 0 ? mapFromDb(rows[0]) : null;
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const rows = await executeSql<DbSubscription>('SELECT * FROM subscriptions ORDER BY next_billing_date ASC');
  return rows.map(mapFromDb);
}

export async function getActiveSubscriptions(): Promise<Subscription[]> {
  const rows = await executeSql<DbSubscription>('SELECT * FROM subscriptions WHERE is_active = 1 ORDER BY next_billing_date ASC');
  return rows.map(mapFromDb);
}

export async function getUpcomingBills(days: number): Promise<Subscription[]> {
  const futureDate = addDays(new Date(), days).toISOString().split('T')[0];
  const rows = await executeSql<DbSubscription>(
    'SELECT * FROM subscriptions WHERE is_active = 1 AND next_billing_date <= ? ORDER BY next_billing_date ASC',
    [futureDate]
  );
  return rows.map(mapFromDb);
}

export async function updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
  const existing = await getSubscription(id);
  if (!existing) throw new Error('Subscription not found');

  await cancelReminders(existing.notificationIds);

  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount); }
  if (updates.currency !== undefined) { fields.push('currency = ?'); values.push(updates.currency); }
  if (updates.billingCycle !== undefined) { fields.push('billing_cycle = ?'); values.push(updates.billingCycle); }
  if (updates.nextBillingDate !== undefined) { fields.push('next_billing_date = ?'); values.push(updates.nextBillingDate); }
  if (updates.categoryId !== undefined) { fields.push('category_id = ?'); values.push(updates.categoryId); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes || null); }
  if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0); }
  if (updates.reminderDays !== undefined) { fields.push('reminder_days = ?'); values.push(JSON.stringify(updates.reminderDays)); }

  values.push(id);
  await runSql(`UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ?`, values);

  const updated = await getSubscription(id);
  if (updated && updated.isActive) {
    const notificationIds = await scheduleReminders(updated);
    await runSql('UPDATE subscriptions SET notification_ids = ? WHERE id = ?', [JSON.stringify(notificationIds), id]);
    updated.notificationIds = notificationIds;
  }
  return updated!;
}

export async function deleteSubscription(id: string): Promise<void> {
  const existing = await getSubscription(id);
  if (existing) {
    await cancelReminders(existing.notificationIds);
  }
  await runSql('DELETE FROM subscriptions WHERE id = ?', [id]);
}

export async function getMonthlyTotal(): Promise<{ currency: string; total: number }[]> {
  const subs = await getActiveSubscriptions();
  const totals: Record<string, number> = {};
  subs.forEach((sub) => {
    const monthly = calculateMonthlyEquivalent(sub.amount, sub.billingCycle);
    totals[sub.currency] = (totals[sub.currency] || 0) + monthly;
  });
  return Object.entries(totals).map(([currency, total]) => ({ currency, total: Math.round(total * 100) / 100 }));
}

export async function getActualMonthlySpending(year?: number, month?: number): Promise<{ currency: string; total: number; subscriptions: Subscription[] }[]> {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth();

  const startOfMonth = new Date(targetYear, targetMonth, 1);
  const endOfMonth = new Date(targetYear, targetMonth + 1, 0);

  const subs = await getActiveSubscriptions();
  const byCurrency: Record<string, { total: number; subscriptions: Subscription[] }> = {};

  subs.forEach((sub) => {
    const billingDate = parseISO(sub.nextBillingDate);
    if (billingDate >= startOfMonth && billingDate <= endOfMonth) {
      if (!byCurrency[sub.currency]) {
        byCurrency[sub.currency] = { total: 0, subscriptions: [] };
      }
      byCurrency[sub.currency].total += sub.amount;
      byCurrency[sub.currency].subscriptions.push(sub);
    }
  });

  return Object.entries(byCurrency).map(([currency, data]) => ({
    currency,
    total: Math.round(data.total * 100) / 100,
    subscriptions: data.subscriptions,
  }));
}

export async function getYearlyTotal(): Promise<{ currency: string; total: number }[]> {
  const monthlyTotals = await getMonthlyTotal();
  return monthlyTotals.map(({ currency, total }) => ({ currency, total: Math.round(total * 12 * 100) / 100 }));
}

export async function getWeeklyTotal(): Promise<{ currency: string; total: number }[]> {
  const monthlyTotals = await getMonthlyTotal();
  return monthlyTotals.map(({ currency, total }) => ({ currency, total: Math.round(total / 4.33 * 100) / 100 }));
}

export async function markAsPaid(id: string): Promise<Subscription> {
  const existing = await getSubscription(id);
  if (!existing) throw new Error('Subscription not found');

  await cancelReminders(existing.notificationIds);

  const currentBillingDate = parseISO(existing.nextBillingDate);
  const nextDate = getNextBillingDate(currentBillingDate, existing.billingCycle);
  const nextBillingDate = nextDate.toISOString().split('T')[0];

  const now = new Date().toISOString();
  await runSql(
    'UPDATE subscriptions SET next_billing_date = ?, updated_at = ?, notification_ids = ? WHERE id = ?',
    [nextBillingDate, now, '[]', id]
  );

  const updated = await getSubscription(id);
  if (updated && updated.isActive) {
    const notificationIds = await scheduleReminders(updated);
    await runSql('UPDATE subscriptions SET notification_ids = ? WHERE id = ?', [JSON.stringify(notificationIds), id]);
    updated.notificationIds = notificationIds;
  }
  return updated!;
}

export async function getSpendingByCategory(): Promise<{ categoryId: string; currency: string; monthly: number; count: number }[]> {
  const subs = await getActiveSubscriptions();
  const byCategory: Record<string, Record<string, { monthly: number; count: number }>> = {};

  subs.forEach((sub) => {
    const monthly = calculateMonthlyEquivalent(sub.amount, sub.billingCycle);
    if (!byCategory[sub.categoryId]) byCategory[sub.categoryId] = {};
    if (!byCategory[sub.categoryId][sub.currency]) {
      byCategory[sub.categoryId][sub.currency] = { monthly: 0, count: 0 };
    }
    byCategory[sub.categoryId][sub.currency].monthly += monthly;
    byCategory[sub.categoryId][sub.currency].count += 1;
  });

  const result: { categoryId: string; currency: string; monthly: number; count: number }[] = [];
  Object.entries(byCategory).forEach(([categoryId, currencies]) => {
    Object.entries(currencies).forEach(([currency, data]) => {
      result.push({
        categoryId,
        currency,
        monthly: Math.round(data.monthly * 100) / 100,
        count: data.count,
      });
    });
  });
  return result;
}

export async function getSubscriptionsByCategory(categoryId: string): Promise<Subscription[]> {
  const rows = await executeSql<DbSubscription>(
    'SELECT * FROM subscriptions WHERE category_id = ? ORDER BY next_billing_date ASC',
    [categoryId]
  );
  return rows.map(mapFromDb);
}

export async function getStats(): Promise<{
  totalActive: number;
  totalInactive: number;
  mostExpensive: Subscription | null;
  cheapest: Subscription | null;
  avgMonthly: { currency: string; avg: number }[];
}> {
  const all = await getAllSubscriptions();
  const active = all.filter(s => s.isActive);
  const inactive = all.filter(s => !s.isActive);

  const withMonthly = active.map(s => ({
    ...s,
    monthlyAmount: calculateMonthlyEquivalent(s.amount, s.billingCycle)
  }));

  const sorted = withMonthly.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  const mostExpensive = sorted.length > 0 ? sorted[0] : null;
  const cheapest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  const totals = await getMonthlyTotal();
  const avgMonthly = totals.map(({ currency, total }) => ({
    currency,
    avg: active.filter(s => s.currency === currency).length > 0
      ? Math.round(total / active.filter(s => s.currency === currency).length * 100) / 100
      : 0
  }));

  return { totalActive: active.length, totalInactive: inactive.length, mostExpensive, cheapest, avgMonthly };
}

export async function getUpcomingGrouped(): Promise<{
  overdue: Subscription[];
  today: Subscription[];
  tomorrow: Subscription[];
  thisWeek: Subscription[];
  nextWeek: Subscription[];
  later: Subscription[];
}> {
  const subs = await getActiveSubscriptions();
  const now = startOfDay(new Date());

  const overdue: Subscription[] = [];
  const today: Subscription[] = [];
  const tomorrow: Subscription[] = [];
  const thisWeek: Subscription[] = [];
  const nextWeek: Subscription[] = [];
  const later: Subscription[] = [];

  subs.forEach(sub => {
    const billingDate = parseISO(sub.nextBillingDate);
    const diff = Math.floor((billingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff < 0) overdue.push(sub);
    else if (diff === 0) today.push(sub);
    else if (diff === 1) tomorrow.push(sub);
    else if (diff <= 7) thisWeek.push(sub);
    else if (diff <= 14) nextWeek.push(sub);
    else later.push(sub);
  });

  return { overdue, today, tomorrow, thisWeek, nextWeek, later };
}
