import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform, Pressable } from 'react-native';
import { TextInput, Button, SegmentedButtons, useTheme, Menu, Switch, List } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { BillingCycle } from '../../src/types';
import { format, parseISO } from 'date-fns';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function EditSubscription() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { subscriptions, categories, updateSubscription, deleteSubscription } = useSubscriptionStore();

  const existing = subscriptions.find((s) => s.id === id);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState(new Date());
  const [categoryId, setCategoryId] = useState('other');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setAmount(existing.amount.toString());
      setCurrency(existing.currency);
      setBillingCycle(existing.billingCycle);
      setNextBillingDate(parseISO(existing.nextBillingDate));
      setCategoryId(existing.categoryId);
      setNotes(existing.notes || '');
      setIsActive(existing.isActive);
    }
  }, [existing]);

  if (!existing) {
    return null;
  }

  const isValid = name.trim() && parseFloat(amount) > 0;

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setNextBillingDate(selectedDate);
    }
  };

  const handleSave = async () => {
    if (!isValid) return;
    setIsLoading(true);
    try {
      await updateSubscription(id!, {
        name: name.trim(),
        amount: parseFloat(amount),
        currency,
        billingCycle,
        nextBillingDate: format(nextBillingDate, 'yyyy-MM-dd'),
        categoryId,
        notes: notes.trim() || undefined,
        isActive,
      });
      router.back();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Subscription', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSubscription(id!);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" style={styles.input} />

      <View style={styles.row}>
        <Menu
          visible={showCurrencyMenu}
          onDismiss={() => setShowCurrencyMenu(false)}
          anchor={<Button mode="outlined" onPress={() => setShowCurrencyMenu(true)} style={styles.currencyBtn}>{currency}</Button>}
        >
          {CURRENCIES.map((c) => (
            <Menu.Item key={c} onPress={() => { setCurrency(c); setShowCurrencyMenu(false); }} title={c} />
          ))}
        </Menu>
        <TextInput label="Amount" value={amount} onChangeText={setAmount} mode="outlined" keyboardType="decimal-pad" style={[styles.input, styles.amountInput]} />
      </View>

      <SegmentedButtons value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)} buttons={BILLING_CYCLES} style={styles.segment} />

      <Pressable onPress={() => setShowDatePicker(true)}>
        <TextInput
          label="Next Billing Date"
          value={format(nextBillingDate, 'MMM dd, yyyy')}
          mode="outlined"
          style={styles.input}
          editable={false}
          right={<TextInput.Icon icon="calendar" onPress={() => setShowDatePicker(true)} />}
        />
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={nextBillingDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}

      {Platform.OS === 'ios' && showDatePicker && (
        <Button mode="text" onPress={() => setShowDatePicker(false)} style={styles.doneBtn}>
          Done
        </Button>
      )}

      <Menu
        visible={showCategoryMenu}
        onDismiss={() => setShowCategoryMenu(false)}
        anchor={<Button mode="outlined" onPress={() => setShowCategoryMenu(true)} style={styles.input}>Category: {categories.find((c) => c.id === categoryId)?.name || 'Other'}</Button>}
      >
        {categories.map((c) => (
          <Menu.Item key={c.id} onPress={() => { setCategoryId(c.id); setShowCategoryMenu(false); }} title={c.name} />
        ))}
      </Menu>

      <TextInput label="Notes (optional)" value={notes} onChangeText={setNotes} mode="outlined" style={styles.input} multiline numberOfLines={3} />

      <List.Item title="Active" description="Receive reminders for this subscription" right={() => <Switch value={isActive} onValueChange={setIsActive} />} />

      <Button mode="contained" onPress={handleSave} disabled={!isValid || isLoading} loading={isLoading} style={styles.saveBtn}>Save Changes</Button>

      <Button mode="outlined" onPress={handleDelete} textColor={theme.colors.error} style={styles.deleteBtn}>Delete Subscription</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  currencyBtn: { marginRight: 12 },
  amountInput: { flex: 1 },
  segment: { marginBottom: 16 },
  saveBtn: { marginTop: 16 },
  deleteBtn: { marginTop: 12, marginBottom: 32 },
  doneBtn: { alignSelf: 'flex-end', marginBottom: 12 },
});
