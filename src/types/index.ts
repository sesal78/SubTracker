export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  startDate: string;
  categoryId: string;
  notes?: string;
  isActive: boolean;
  reminderDays: number[];
  notificationIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Settings {
  defaultCurrency: string;
  defaultReminderDays: number[];
  notificationsEnabled: boolean;
}

export type SubscriptionInput = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'notificationIds'>;
