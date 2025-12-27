import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { Subscription } from '../../src/types';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';

export default function Dashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { subscriptions, loadSubscriptions, loadCategories, isLoading } = useSubscriptionStore();
  const [monthlyTotals, setMonthlyTotals] = useState<{ currency: string; total: number }[]>([]);
  const [upcoming, setUpcoming] = useState<Subscription[]>([]);

  useEffect(() => {
    loadSubscriptions();
    loadCategories();
  }, []);

  useEffect(() => {
    async function loadStats() {
      const totals = await useSubscriptionStore.getState().getMonthlyTotal();
      const upcomingBills = await useSubscriptionStore.getState().getUpcoming(7);
      setMonthlyTotals(totals);
      setUpcoming(upcomingBills);
    }
    if (subscriptions.length > 0) loadStats();
  }, [subscriptions]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  const activeCount = subscriptions.filter((s) => s.isActive).length;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={styles.title}>Dashboard</Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Monthly Spending</Text>
          {monthlyTotals.length > 0 ? (
            monthlyTotals.map(({ currency, total }) => (
              <Text key={currency} variant="headlineLarge" style={{ color: theme.colors.primary }}>
                {currency} {total.toFixed(2)}
              </Text>
            ))
          ) : (
            <Text variant="bodyLarge" style={{ color: theme.colors.outline }}>No active subscriptions</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Active Subscriptions</Text>
          <Text variant="headlineLarge" style={{ color: theme.colors.primary }}>{activeCount}</Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Upcoming (Next 7 Days)</Text>
          {upcoming.length > 0 ? (
            upcoming.map((sub) => {
              const daysLeft = differenceInDays(parseISO(sub.nextBillingDate), startOfDay(new Date()));
              return (
                <View key={sub.id} style={styles.upcomingItem}>
                  <Text variant="bodyLarge">{sub.name}</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
                    {sub.currency} {sub.amount.toFixed(2)} - {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `in ${daysLeft} days`}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text variant="bodyLarge" style={{ color: theme.colors.outline }}>No bills due soon</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { marginBottom: 16, fontWeight: 'bold' },
  card: { marginBottom: 16 },
  upcomingItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
});
