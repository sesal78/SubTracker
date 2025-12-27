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

export async function getYearlyTotal(): Promise<{ currency: string; total: number }[]> {
  const monthlyTotals = await getMonthlyTotal();
  return monthlyTotals.map(({ currency, total }) => ({ currency, total: Math.round(total * 12 * 100) / 100 }));
}
