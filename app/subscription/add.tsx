import { useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Platform, Pressable } from 'react-native';
import { TextInput, Button, SegmentedButtons, useTheme, Menu, List, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { BillingCycle } from '../../src/types';
import { format } from 'date-fns';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const POPULAR_SUBSCRIPTIONS = [
  'Amazon Prime',
  'Amazon Prime Video',
  'Apple Music',
  'Car insurance',
  'Disney+',
  'Electricity',
  'Gas',
  'Google One',
  'Health insurance',
  'Home & contents insurance',
  'Home internet (NBN / fibre / cable)',
  'Kayo Sports',
  'Mobile phone plans (SIM-only or bundled)',
  'Netflix',
  'Spotify',
  'Stan',
  'Water',
  'YouTube Premium',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function AddSubscription() {
  const theme = useTheme();
  const router = useRouter();
  const { addSubscription, categories } = useSubscriptionStore();

  const [name, setName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState(new Date());
  const [categoryId, setCategoryId] = useState('other');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const suggestions = useMemo(() => {
    if (!name.trim()) return POPULAR_SUBSCRIPTIONS;
    const query = name.toLowerCase();
    return POPULAR_SUBSCRIPTIONS.filter(sub => sub.toLowerCase().includes(query));
  }, [name]);

  const isValid = name.trim() && parseFloat(amount) > 0;

  const handleSelectSuggestion = (suggestion: string) => {
    setName(suggestion);
    setShowSuggestions(false);
  };

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
      const dateStr = format(nextBillingDate, 'yyyy-MM-dd');
      await addSubscription({
        name: name.trim(),
        amount: parseFloat(amount),
        currency,
        billingCycle,
        nextBillingDate: dateStr,
        startDate: dateStr,
        categoryId,
        notes: notes.trim() || undefined,
        isActive: true,
        reminderDays: [3, 1],
      });
      router.back();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} keyboardShouldPersistTaps="handled">
      <View style={styles.autocompleteContainer}>
        <TextInput
          label="Subscription Name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          mode="outlined"
          style={styles.input}
          placeholder="Type to search or enter custom"
        />
        {showSuggestions && suggestions.length > 0 && (
          <Surface style={[styles.suggestionsContainer, { backgroundColor: theme.colors.surface }]} elevation={3}>
            <ScrollView style={styles.suggestionsList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {suggestions.map((item) => (
                <List.Item
                  key={item}
                  title={item}
                  onPress={() => handleSelectSuggestion(item)}
                  style={styles.suggestionItem}
                />
              ))}
            </ScrollView>
          </Surface>
        )}
      </View>

      <View style={styles.row}>
        <Menu
          visible={showCurrencyMenu}
          onDismiss={() => setShowCurrencyMenu(false)}
          anchor={
            <Button mode="outlined" onPress={() => setShowCurrencyMenu(true)} style={styles.currencyBtn}>
              {currency}
            </Button>
          }
        >
          {CURRENCIES.map((c) => (
            <Menu.Item key={c} onPress={() => { setCurrency(c); setShowCurrencyMenu(false); }} title={c} />
          ))}
        </Menu>
        <TextInput
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          onFocus={() => setShowSuggestions(false)}
          mode="outlined"
          keyboardType="decimal-pad"
          style={[styles.input, styles.amountInput]}
        />
      </View>

      <SegmentedButtons
        value={billingCycle}
        onValueChange={(v) => setBillingCycle(v as BillingCycle)}
        buttons={BILLING_CYCLES}
        style={styles.segment}
      />

      <Pressable onPress={() => { setShowSuggestions(false); setShowDatePicker(true); }}>
        <TextInput
          label="Next Billing Date"
          value={format(nextBillingDate, 'MMM dd, yyyy')}
          mode="outlined"
          style={styles.input}
          editable={false}
          right={<TextInput.Icon icon="calendar" onPress={() => { setShowSuggestions(false); setShowDatePicker(true); }} />}
        />
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={nextBillingDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
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
        anchor={
          <Button mode="outlined" onPress={() => { setShowSuggestions(false); setShowCategoryMenu(true); }} style={styles.input}>
            Category: {categories.find((c) => c.id === categoryId)?.name || 'Other'}
          </Button>
        }
      >
        {categories.map((c) => (
          <Menu.Item key={c.id} onPress={() => { setCategoryId(c.id); setShowCategoryMenu(false); }} title={c.name} />
        ))}
      </Menu>

      <TextInput
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        onFocus={() => setShowSuggestions(false)}
        mode="outlined"
        style={styles.input}
        multiline
        numberOfLines={3}
      />

      <Button
        mode="contained"
        onPress={handleSave}
        disabled={!isValid || isLoading}
        loading={isLoading}
        style={styles.saveBtn}
      >
        Add Subscription
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: { marginBottom: 12 },
  autocompleteContainer: { position: 'relative', zIndex: 10 },
  suggestionsContainer: { position: 'absolute', top: 64, left: 0, right: 0, borderRadius: 8, maxHeight: 200, zIndex: 20 },
  suggestionsList: { maxHeight: 200 },
  suggestionItem: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  currencyBtn: { marginRight: 12 },
  amountInput: { flex: 1 },
  segment: { marginBottom: 16 },
  saveBtn: { marginTop: 16, marginBottom: 32 },
  doneBtn: { alignSelf: 'flex-end', marginBottom: 12 },
});
