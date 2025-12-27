import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import { initDatabase } from '../src/services/database';
import { requestPermissions } from '../src/services/notifications';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      await initDatabase();
      await requestPermissions();
      setIsReady(true);
    }
    init();
  }, []);

  if (!isReady) return null;

  return (
    <PaperProvider theme={colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="subscription/add" options={{ presentation: 'modal', headerShown: true, title: 'Add Subscription' }} />
        <Stack.Screen name="subscription/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Edit Subscription' }} />
      </Stack>
    </PaperProvider>
  );
}
