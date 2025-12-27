import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { Card, Text, useTheme, ActivityIndicator, Chip, ProgressBar, Divider, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { Subscription, Category } from '../../src/types';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';
import * as subscriptionService from '../../src/services/subscriptions';

type Period = 'weekly' | 'monthly' | 'yearly';

interface CategorySpending {
  categoryId: string;
  currency: string;
  monthly: number;
  count: number;
}

interface GroupedUpcoming {
  overdue: Subscription[];
  today: Subscription[];
  tomorrow: Subscription[];
  thisWeek: Subscription[];
  nextWeek: Subscription[];
  later: Subscription[];
}

interface Stats {
  totalActive: number;
  totalInactive: number;
  mostExpensive: Subscription | null;
  cheapest: Subscription | null;
  avgMonthly: { currency: string; avg: number }[];
}

export default function Dashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { subscriptions, categories, loadSubscriptions, loadCategories, isLoading } = useSubscriptionStore();

  const [period, setPeriod] = useState<Period>('monthly');
  const [totals, setTotals] = useState<{ currency: string; total: number }[]>([]);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [groupedUpcoming, setGroupedUpcoming] = useState<GroupedUpcoming | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('upcoming');

  const loadData = useCallback(async () => {
    await loadSubscriptions();
    await loadCategories();
  }, []);

  const loadAnalytics = useCallback(async () => {
    const [spending, grouped, statsData] = await Promise.all([
      subscriptionService.getSpendingByCategory(),
      subscriptionService.getUpcomingGrouped(),
      subscriptionService.getStats(),
    ]);
    setCategorySpending(spending);
    setGroupedUpcoming(grouped);
    setStats(statsData);
  }, []);

  const loadTotals = useCallback(async () => {
    let data: { currency: string; total: number }[];
    switch (period) {
      case 'weekly':
        data = await subscriptionService.getWeeklyTotal();
        break;
      case 'yearly':
        data = await subscriptionService.getYearlyTotal();
        break;
      default:
        data = await subscriptionService.getMonthlyTotal();
    }
    setTotals(data);
  }, [period]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (subscriptions.length > 0) { loadAnalytics(); loadTotals(); } }, [subscriptions, period]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Other';
  const getCategoryIcon = (id: string) => categories.find(c => c.id === id)?.icon || 'help-circle';

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const navigateToCategory = (categoryId: string) => {
    router.push(`/category/${categoryId}`);
  };

  const navigateToSubscription = (id: string) => {
    router.push(`/subscription/${id}`);
  };

  if (isLoading && !refreshing) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  const activeCount = subscriptions.filter(s => s.isActive).length;
  const totalSpending = totals.reduce((sum, t) => sum + t.total, 0);

  const renderUpcomingGroup = (title: string, items: Subscription[], color: string, icon: string) => {
    if (items.length === 0) return null;
    const groupTotal = items.reduce((sum, s) => sum + s.amount, 0);
    return (
      <View key={title} style={styles.upcomingGroup}>
        <View style={styles.groupHeader}>
          <View style={[styles.urgencyDot, { backgroundColor: color }]} />
          <Text variant="titleSmall" style={{ flex: 1 }}>{title}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
            {items.length} bill{items.length > 1 ? 's' : ''} · ${groupTotal.toFixed(2)}
          </Text>
        </View>
        {items.map(sub => (
          <Pressable key={sub.id} onPress={() => navigateToSubscription(sub.id)}>
            <View style={styles.upcomingItem}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{sub.name}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                  {format(parseISO(sub.nextBillingDate), 'MMM d')}
                </Text>
              </View>
              <Text variant="titleSmall" style={{ color: theme.colors.primary }}>
                {sub.currency} {sub.amount.toFixed(2)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['weekly', 'monthly', 'yearly'] as Period[]).map(p => (
          <Chip
            key={p}
            selected={period === p}
            onPress={() => setPeriod(p)}
            style={[styles.periodChip, period === p && { backgroundColor: theme.colors.primaryContainer }]}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Chip>
        ))}
      </View>

      {/* Spending Overview */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            {period.charAt(0).toUpperCase() + period.slice(1)} Spending
          </Text>
          {totals.length > 0 ? (
            totals.map(({ currency, total }) => (
              <Text key={currency} variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                {currency} {total.toFixed(2)}
              </Text>
            ))
          ) : (
            <Text variant="bodyLarge" style={{ color: theme.colors.outline }}>No active subscriptions</Text>
          )}
          {stats && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={{ color: theme.colors.secondary }}>{stats.totalActive}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Active</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineSmall" style={{ color: theme.colors.outline }}>{stats.totalInactive}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Paused</Text>
              </View>
              {stats.avgMonthly.length > 0 && (
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: theme.colors.tertiary }}>
                    ${stats.avgMonthly[0]?.avg.toFixed(0) || 0}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Avg/sub</Text>
                </View>
              )}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Quick Insights */}
      {stats?.mostExpensive && (
        <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Card.Content>
            <Text variant="titleSmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>Quick Insights</Text>
            <Pressable onPress={() => navigateToSubscription(stats.mostExpensive!.id)}>
              <View style={styles.insightRow}>
                <Text variant="bodyMedium">Most expensive: </Text>
                <Text variant="bodyMedium" style={{ fontWeight: 'bold', color: theme.colors.error }}>
                  {stats.mostExpensive.name} ({stats.mostExpensive.currency} {stats.mostExpensive.amount}/{stats.mostExpensive.billingCycle.slice(0, 2)})
                </Text>
              </View>
            </Pressable>
            {stats.cheapest && stats.cheapest.id !== stats.mostExpensive.id && (
              <Pressable onPress={() => navigateToSubscription(stats.cheapest!.id)}>
                <View style={styles.insightRow}>
                  <Text variant="bodyMedium">Cheapest: </Text>
                  <Text variant="bodyMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                    {stats.cheapest.name} ({stats.cheapest.currency} {stats.cheapest.amount}/{stats.cheapest.billingCycle.slice(0, 2)})
                  </Text>
                </View>
              </Pressable>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Upcoming Bills - Expandable */}
      <Card style={styles.card}>
        <Pressable onPress={() => toggleSection('upcoming')}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.cardTitle}>Upcoming Bills</Text>
              <IconButton 
                icon={expandedSection === 'upcoming' ? 'chevron-up' : 'chevron-down'} 
                size={20}
              />
            </View>
          </Card.Content>
        </Pressable>
        {expandedSection === 'upcoming' && groupedUpcoming && (
          <Card.Content>
            {groupedUpcoming.overdue.length === 0 && 
             groupedUpcoming.today.length === 0 && 
             groupedUpcoming.tomorrow.length === 0 && 
             groupedUpcoming.thisWeek.length === 0 && 
             groupedUpcoming.nextWeek.length === 0 ? (
              <Text variant="bodyLarge" style={{ color: theme.colors.outline, textAlign: 'center', paddingVertical: 16 }}>
                No upcoming bills in the next 2 weeks
              </Text>
            ) : (
              <>
                {renderUpcomingGroup('Overdue', groupedUpcoming.overdue, theme.colors.error, 'alert-circle')}
                {renderUpcomingGroup('Today', groupedUpcoming.today, theme.colors.error, 'clock')}
                {renderUpcomingGroup('Tomorrow', groupedUpcoming.tomorrow, '#FF9800', 'clock-outline')}
                {renderUpcomingGroup('This Week', groupedUpcoming.thisWeek, '#FFC107', 'calendar-week')}
                {renderUpcomingGroup('Next Week', groupedUpcoming.nextWeek, theme.colors.primary, 'calendar')}
              </>
            )}
          </Card.Content>
        )}
      </Card>

      {/* Category Breakdown - Expandable */}
      <Card style={styles.card}>
        <Pressable onPress={() => toggleSection('categories')}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.cardTitle}>Spending by Category</Text>
              <IconButton 
                icon={expandedSection === 'categories' ? 'chevron-up' : 'chevron-down'} 
                size={20}
              />
            </View>
          </Card.Content>
        </Pressable>
        {expandedSection === 'categories' && (
          <Card.Content>
            {categorySpending.length > 0 ? (
              categorySpending
                .sort((a, b) => b.monthly - a.monthly)
                .map(({ categoryId, currency, monthly, count }) => {
                  const percentage = totalSpending > 0 ? (monthly / totalSpending) * 100 : 0;
                  return (
                    <Pressable key={`${categoryId}-${currency}`} onPress={() => navigateToCategory(categoryId)}>
                      <View style={styles.categoryItem}>
                        <View style={styles.categoryHeader}>
                          <Text variant="bodyLarge" style={{ flex: 1 }}>{getCategoryName(categoryId)}</Text>
                          <Text variant="bodySmall" style={{ color: theme.colors.outline }}>{count} sub{count > 1 ? 's' : ''}</Text>
                          <Text variant="titleSmall" style={{ marginLeft: 8 }}>{currency} {monthly.toFixed(2)}/mo</Text>
                        </View>
                        <ProgressBar 
                          progress={percentage / 100} 
                          color={theme.colors.primary}
                          style={styles.progressBar}
                        />
                        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 2 }}>
                          {percentage.toFixed(0)}% of total
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
            ) : (
              <Text variant="bodyLarge" style={{ color: theme.colors.outline, textAlign: 'center', paddingVertical: 16 }}>
                No subscriptions yet
              </Text>
            )}
          </Card.Content>
        )}
      </Card>

      {/* All Subscriptions Summary */}
      <Card style={[styles.card, { marginBottom: 32 }]}>
        <Pressable onPress={() => router.push('/(tabs)/subscriptions')}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.cardTitle}>All Subscriptions</Text>
              <IconButton icon="chevron-right" size={20} />
            </View>
            <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
              {activeCount} active · {subscriptions.length - activeCount} paused
            </Text>
          </Card.Content>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  periodSelector: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  periodChip: { flex: 1 },
  card: { marginBottom: 12, borderRadius: 12 },
  cardTitle: { fontWeight: 'bold', marginBottom: 8 },
  statsRow: { flexDirection: 'row', marginTop: 16, justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  insightRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -8 },
  upcomingGroup: { marginBottom: 16 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  urgencyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  upcomingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: '#e0e0e0', marginLeft: 3 },
  categoryItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  progressBar: { height: 6, borderRadius: 3 },
});
