import * as Notifications from 'expo-notifications';
import { parseISO, subDays } from 'date-fns';
import { Subscription } from '../types';

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
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export async function scheduleReminders(subscription: Subscription): Promise<string[]> {
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
}

export async function cancelReminders(notificationIds: string[]): Promise<void> {
  for (const id of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}
