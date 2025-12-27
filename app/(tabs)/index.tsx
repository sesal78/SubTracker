import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl, Alert } from 'react-native';
import { Card, Text, useTheme, ActivityIndicator, Chip, ProgressBar, IconButton, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { Subscription } from '../../src/types';
import { format, parseISO } from 'date-fns';
import * as subscriptionService from '../../src/services/subscriptions';

type Period = 'monthly' | 'recurring' | 'yearly';

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

interface ActualMonthlyData {
  currency: string;
  total: number;
  subscriptions: Subscription[];
}

export default function Dashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { subscriptions, categories, loadSubscriptions, loadCategories, isLoading } = useSubscriptionStore();

  const [period, setPeriod] = useState<Period>('monthly');
  const [totals, setTotals] = useState<{ currency: string; total: number }[]>([]);
  const [actualMonthly, setActualMonthly] = useState<ActualMonthlyData[]>([]);
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
    const [spending, grouped, statsData, actualData] = await Promise.all([
      subscriptionService.getSpendingByCategory(),
      subscriptionService.getUpcomingGrouped(),
      subscriptionService.getStats(),
      subscriptionService.getActualMonthlySpending(),
    ]);
    setCategorySpending(spending);
    setGroupedUpcoming(grouped);
    setStats(statsData);
    setActualMonthly(actualData);
  }, []);

  const loadTotals = useCallback(async () => {
    let data: { currency: string; total: number }[];
    switch (period) {
      case 'recurring':
        data = await subscriptionService.getMonthlyTotal();
        break;
      case 'yearly':
        data = await subscriptionService.getYearlyTotal();
        break;
      default:
        data = actualMonthly.map(d => ({ currency: d.currency, total: d.total }));
    }
    setTotals(data);
  }, [period, actualMonthly]);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (subscriptions.length > 0) loadAnalytics(); }, [subscriptions]);
  useEffect(() => { loadTotals(); }, [period, actualMonthly]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Other';

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const navigateToCategory = (categoryId: string) => {
    router.push(`/category/${categoryId}`);
  };

  const navigateToSubscription = (id: string) => {
    router.push(`/subscription/${id}`);
  };

  const handleMarkAsPaid = async (sub: Subscription) => {
    Alert.alert(
      'Mark as Paid',
      `Mark ${sub.name} as paid and move to next billing cycle?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              await subscriptionService.markAsPaid(sub.id);
              await loadData();
            } catch (e) {
              Alert.alert('Error', 'Failed to mark as paid');
            }
          },
        },
      ]
    );
  };

  if (isLoading && !refreshing) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  const activeCount = subscriptions.filter(s => s.isActive).length;
  const totalSpending = totals.reduce((sum, t) => sum + t.total, 0);
  const currentMonth = format(new Date(), 'MMMM yyyy');

  const renderUpcomingGroup = (title: string, items: Subscription[], color: string) => {
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
          <View key={sub.id} style={styles.upcomingItemContainer}>
            <Pressable style={{ flex: 1 }} onPress={() => navigateToSubscription(sub.id)}>
              <View style={[styles.upcomingItem, { borderLeftColor: color }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{sub.name}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {format(parseISO(sub.nextBillingDate), 'MMM d')} · {sub.billingCycle}
                  </Text>
                </View>
                <Text variant="titleSmall" style={{ color: theme.colors.primary, marginRight: 8 }}>
                  {sub.currency} {sub.amount.toFixed(2)}
                </Text>
              </View>
            </Pressable>
            <IconButton
              icon="check-circle-outline"
              size={24}
              iconColor={theme.colors.primary}
              onPress={() => handleMarkAsPaid(sub)}
              style={styles.paidButton}
            />
          </View>
        ))}
      </View>
    );
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'monthly': return `${currentMonth} Bills`;
      case 'recurring': return 'Monthly Average';
      case 'yearly': return 'Yearly Total';
    }
  };

  const getPeriodSubtext = () => {
    switch (period) {
      case 'monthly': 
        const billCount = actualMonthly.reduce((sum, d) => sum + d.subscriptions.length, 0);
        return `${billCount} bill${billCount !== 1 ? 's' : ''} due this month`;
      case 'recurring': return 'Average monthly spending across all cycles';
      case 'yearly': return 'Projected annual spending';
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <Chip
          selected={period === 'monthly'}
          onPress={() => setPeriod('monthly')}
          style={[styles.periodChip, period === 'monthly' && { backgroundColor: theme.colors.primaryContainer }]}
        >
          This Month
        </Chip>
        <Chip
          selected={period === 'recurring'}
          onPress={() => setPeriod('recurring')}
          style={[styles.periodChip, period === 'recurring' && { backgroundColor: theme.colors.primaryContainer }]}
        >
          Recurring
        </Chip>
        <Chip
          selected={period === 'yearly'}
          onPress={() => setPeriod('yearly')}
          style={[styles.periodChip, period === 'yearly' && { backgroundColor: theme.colors.primaryContainer }]}
        >
          Yearly
        </Chip>
      </View>

      {/* Spending Overview */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>{getPeriodLabel()}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>{getPeriodSubtext()}</Text>
          {totals.length > 0 ? (
            totals.map(({ currency, total }) => (
              <Text key={currency} variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                {currency} {total.toFixed(2)}
              </Text>
            ))
          ) : (
            <Text variant="bodyLarge" style={{ color: theme.colors.outline }}>
              {period === 'monthly' ? 'No bills due this month' : 'No active subscriptions'}
            </Text>
          )}
          
          {/* Show bills due this month when in monthly view */}
          {period === 'monthly' && actualMonthly.length > 0 && (
            <View style={styles.monthlyBillsList}>
              {actualMonthly.flatMap(d => d.subscriptions).map(sub => (
                <Pressable key={sub.id} onPress={() => navigateToSubscription(sub.id)}>
                  <View style={styles.monthlyBillItem}>
                    <Text variant="bodyMedium" style={{ flex: 1 }}>{sub.name}</Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginRight: 8 }}>
                      {format(parseISO(sub.nextBillingDate), 'MMM d')}
                    </Text>
                    <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                      {sub.currency} {sub.amount.toFixed(2)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {stats && period !== 'monthly' && (
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

      {/* Upcoming Bills - Expandable */}
      <Card style={styles.card}>
        <Pressable onPress={() => toggleSection('upcoming')}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <View>
                <Text variant="titleMedium" style={styles.cardTitle}>Upcoming Bills</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Tap check to mark as paid</Text>
              </View>
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
                {renderUpcomingGroup('Overdue', groupedUpcoming.overdue, theme.colors.error)}
                {renderUpcomingGroup('Today', groupedUpcoming.today, theme.colors.error)}
                {renderUpcomingGroup('Tomorrow', groupedUpcoming.tomorrow, '#FF9800')}
                {renderUpcomingGroup('This Week', groupedUpcoming.thisWeek, '#FFC107')}
                {renderUpcomingGroup('Next Week', groupedUpcoming.nextWeek, theme.colors.primary)}
              </>
            )}
          </Card.Content>
        )}
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
  cardTitle: { fontWeight: 'bold', marginBottom: 4 },
  statsRow: { flexDirection: 'row', marginTop: 16, justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  insightRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -8 },
  upcomingGroup: { marginBottom: 16 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  urgencyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  upcomingItemContainer: { flexDirection: 'row', alignItems: 'center' },
  upcomingItem: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 16, borderLeftWidth: 3, marginLeft: 3 },
  paidButton: { margin: 0 },
  monthlyBillsList: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 12 },
  monthlyBillItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  categoryItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  progressBar: { height: 6, borderRadius: 3 },
});
