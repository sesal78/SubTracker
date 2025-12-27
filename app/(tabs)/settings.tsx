import { View, StyleSheet } from 'react-native';
import { List, Text, Switch, useTheme } from 'react-native-paper';
import { useState } from 'react';

export default function Settings() {
  const theme = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showAmountInNotification, setShowAmountInNotification] = useState(true);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={styles.title}>Settings</Text>

      <List.Section>
        <List.Subheader>Notifications</List.Subheader>
        <List.Item
          title="Enable Reminders"
          description="Get notified before subscription renewals"
          right={() => <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />}
        />
        <List.Item
          title="Show Amount"
          description="Include amount in notification text"
          right={() => <Switch value={showAmountInNotification} onValueChange={setShowAmountInNotification} />}
        />
      </List.Section>

      <List.Section>
        <List.Subheader>About</List.Subheader>
        <List.Item title="Version" description="1.0.0" />
        <List.Item title="Data Storage" description="All data stored locally on device" />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { marginBottom: 16, fontWeight: 'bold' },
});
