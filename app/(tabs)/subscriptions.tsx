import { useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { FAB, List, Text, useTheme, ActivityIndicator, Chip, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { format, parseISO } from 'date-fns';

export default function Subscriptions() {
  const theme = useTheme();
  const router = useRouter();
  const { subscriptions, categories, loadSubscriptions, loadCategories, isLoading } = useSubscriptionStore();

  useEffect(() => {
    loadSubscriptions();
    loadCategories();
  }, []);

  const getCategoryColor = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.color || '#607D8B';
  };

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name || 'Other';
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={styles.title}>Subscriptions</Text>

      {subscriptions.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyLarge" style={{ color: theme.colors.outline }}>No subscriptions yet</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>Tap + to add your first subscription</Text>
        </View>
      ) : (
        <FlatList
          data={subscriptions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <List.Item
              title={item.name}
              description={`${item.currency} ${item.amount.toFixed(2)} / ${item.billingCycle}\nNext: ${format(parseISO(item.nextBillingDate), 'MMM d, yyyy')}`}
              left={() => (
                <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(item.categoryId) }]} />
              )}
              right={() => (
                <Chip compact style={{ opacity: item.isActive ? 1 : 0.5 }}>
                  {item.isActive ? 'Active' : 'Paused'}
                </Chip>
              )}
              onPress={() => router.push(`/subscription/${item.id}`)}
              style={styles.listItem}
            />
          )}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/subscription/add')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { marginBottom: 16, fontWeight: 'bold' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listItem: { marginBottom: 8 },
  categoryDot: { width: 12, height: 12, borderRadius: 6, alignSelf: 'center', marginRight: 8 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
});
