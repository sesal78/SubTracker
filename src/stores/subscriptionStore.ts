import { create } from 'zustand';
import { Subscription, Category } from '../types';
import * as subscriptionService from '../services/subscriptions';
import * as categoryService from '../services/categories';

interface SubscriptionState {
  subscriptions: Subscription[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  loadSubscriptions: () => Promise<void>;
  loadCategories: () => Promise<void>;
  addSubscription: (data: Parameters<typeof subscriptionService.createSubscription>[0]) => Promise<Subscription>;
  updateSubscription: (id: string, data: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  getMonthlyTotal: () => Promise<{ currency: string; total: number }[]>;
  getUpcoming: (days: number) => Promise<Subscription[]>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscriptions: [],
  categories: [],
  isLoading: false,
  error: null,

  loadSubscriptions: async () => {
    set({ isLoading: true, error: null });
    try {
      const subscriptions = await subscriptionService.getAllSubscriptions();
      set({ subscriptions, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await categoryService.getAllCategories();
      set({ categories });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  addSubscription: async (data) => {
    const subscription = await subscriptionService.createSubscription(data);
    set((state) => ({ subscriptions: [...state.subscriptions, subscription].sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate)) }));
    return subscription;
  },

  updateSubscription: async (id, data) => {
    const updated = await subscriptionService.updateSubscription(id, data);
    set((state) => ({
      subscriptions: state.subscriptions.map((s) => (s.id === id ? updated : s)).sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate)),
    }));
  },

  deleteSubscription: async (id) => {
    await subscriptionService.deleteSubscription(id);
    set((state) => ({ subscriptions: state.subscriptions.filter((s) => s.id !== id) }));
  },

  getMonthlyTotal: () => subscriptionService.getMonthlyTotal(),
  getUpcoming: (days) => subscriptionService.getUpcomingBills(days),
}));
