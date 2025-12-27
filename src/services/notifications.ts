import * as Notifications from 'expo-notifications';
import { parseISO, subDays } from 'date-fns';
import { Subscription } from '../types';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'android' && isExpoGo) {
    console.log('Push notifications not supported in Expo Go on Android (SDK 53+)');
    return false;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (e) {
    console.log('Notifications not available:', e);
    return false;
  }
}

export async function scheduleReminders(subscription: Subscription): Promise<string[]> {
  if (Platform.OS === 'android' && isExpoGo) {
    return [];
  }
  try {
    const notificationIds: string[] = [];
    const billingDate = parseISO(subscription.nextBillingDate);

    for (const daysBefore of subscription.reminderDays) {
      const triggerDate = subDays(billingDate, daysBefore);
      if (triggerDate > new Date()) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${subscription.name} renewal coming up`,
            body: `Your ${subscription.name} subscription (${subscription.currency} ${subscription.amount.toFixed(2)}) renews in ${daysBefore} day${daysBefore > 1 ? 's' : ''}.`,
            data: { subscriptionId: subscription.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });
        notificationIds.push(id);
      }
    }

    return notificationIds;
  } catch (e) {
    console.log('Failed to schedule notifications:', e);
    return [];
  }
}

export async function cancelReminders(notificationIds: string[]): Promise<void> {
  if (Platform.OS === 'android' && isExpoGo) {
    return;
  }
  try {
    for (const id of notificationIds) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  } catch (e) {
    console.log('Failed to cancel notifications:', e);
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === 'android' && isExpoGo) {
    return;
  }
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.log('Failed to cancel all notifications:', e);
  }
}

export async function getScheduledNotifications() {
  if (Platform.OS === 'android' && isExpoGo) {
    return [];
  }
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (e) {
    console.log('Failed to get notifications:', e);
    return [];
  }
}
