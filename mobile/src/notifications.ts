import * as Notifications from "expo-notifications";
import { KanjiProgress } from "./types";

export async function requestReviewNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  await Notifications.setNotificationChannelAsync("reviews", {
    name: "Revisões",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  return true;
}

export async function scheduleReviewNotification(progress: KanjiProgress[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  const now = new Date();
  const nextDue = progress
    .map((item) => item.dueAt ? new Date(item.dueAt) : null)
    .filter((date): date is Date => date !== null && !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())[0];
  const hasDueCards = progress.length === 0 || progress.some((item) =>
    !item.dueAt || new Date(item.dueAt).getTime() <= now.getTime());
  const scheduledFor = hasDueCards
    ? new Date(now.getTime() + 60_000)
    : new Date(nextDue ?? now);
  if (!hasDueCards) {
    scheduledFor.setHours(9, 0, 0, 0);
    if (scheduledFor.getTime() <= now.getTime()) scheduledFor.setDate(scheduledFor.getDate() + 1);
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Hora de revisar seus kanjis",
      body: "Seus flashcards estão prontos. Continue sua rotina de estudos.",
      data: { screen: "study" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledFor,
      channelId: "reviews",
    },
  });
}
