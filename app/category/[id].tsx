import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Card, Text, useTheme, ActivityIndicator, Chip, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { Subscription } from '../../src/types';
import { format, parseISO } from 'date-fns';
import * as subscriptionService from '../../src/services/subscriptions';

export default function CategoryDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categories } = useSubscriptionStore();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [yearlyTotal, setYearlyTotal] = useState(0);

  const category = categories.find(c => c.id === id);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setIsLoading(true);
      const subs = await subscriptionService.getSubscriptionsByCategory(id);
      setSubscriptions(subs);
      
      const monthly = subs
        .filter(s => s.isActive)
        .reduce((sum, s) => sum + subscriptionService.calculateMonthlyEquivalent(s.amount, s.billingCycle), 0);
      setMonthlyTotal(Math.round(monthly * 100) / 100);
      setYearlyTotal(Math.round(monthly * 12 * 100) / 100);
      setIsLoading(false);
    }
    load();
  }, [id]);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  const activeCount = subscriptions.filter(s => s.isActive).length;
  const inactiveCount = subscriptions.length - activeCount;

  return (
    <>
      <Stack.Screen options={{ title: category?.name || 'Category' }} />
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Summary Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
              {category?.name || 'Category'}
            </Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text variant="headlineSmall">{subscriptions.length}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Total</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text variant="headlineSmall" style={{ color: theme.colors.primary }}>{activeCount}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Active</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text variant="headlineSmall" style={{ color: theme.colors.outline }}>{inactiveCount}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>Paused</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Spending Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>Spending in this Category</Text>
            <View style={styles.spendingRow}>
              <View style={styles.spendingItem}>
                <Text variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                  ${monthlyTotal.toFixed(2)}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>per month</Text>
              </View>
              <View style={styles.spendingItem}>
                <Text variant="headlineMedium" style={{ color: theme.colors.secondary }}>
                  ${yearlyTotal.toFixed(2)}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>per year</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Subscriptions List */}
        <Card style={[styles.card, { marginBottom: 32 }]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>Subscriptions</Text>
            {subscriptions.length > 0 ? (
              subscriptions.map((sub, index) => (
                <View key={sub.id}>
                  <Pressable onPress={() => router.push(`/subscription/${sub.id}`)}>
                    <View style={styles.subscriptionItem}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.subHeader}>
                          <Text variant="titleSmall">{sub.name}</Text>
                          {!sub.isActive && (
                            <Chip compact style={{ marginLeft: 8, backgroundColor: theme.colors.surfaceVariant }}>
                              Paused
                            </Chip>
                          )}
                        </View>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                          {sub.currency} {sub.amount} / {sub.billingCycle}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                          Next: {format(parseISO(sub.nextBillingDate), 'MMM d, yyyy')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
                          ${subscriptionService.calculateMonthlyEquivalent(sub.amount, sub.billingCycle).toFixed(2)}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>/month</Text>
                      </View>
                    </View>
                  </Pressable>
                  {index < subscriptions.length - 1 && <Divider style={{ marginVertical: 8 }} />}
                </View>
              ))
            ) : (
              <Text variant="bodyLarge" style={{ color: theme.colors.outline, textAlign: 'center', paddingVertical: 24 }}>
                No subscriptions in this category
              </Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginBottom: 12, borderRadius: 12 },
  cardTitle: { fontWeight: 'bold', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  summaryItem: { alignItems: 'center' },
  spendingRow: { flexDirection: 'row', justifyContent: 'space-around' },
  spendingItem: { alignItems: 'center' },
  subscriptionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  subHeader: { flexDirection: 'row', alignItems: 'center' },
});
