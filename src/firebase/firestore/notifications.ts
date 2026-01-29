import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  writeBatch,
  serverTimestamp,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { Notification, NotificationType } from '@/types/notification';

export async function createNotification(
  firestore: any,
  university: string,
  userId: string,
  type: NotificationType,
  data: {
    relatedRideId: string;
    relatedChatId?: string;
    relatedBookingId?: string;
    title: string;
    message: string;
    metadata?: any;
  }
) {
  const notificationsRef = collection(firestore, 'universities', university, 'notifications');
  
  await addDoc(notificationsRef, {
    userId,
    type,
    relatedRideId: data.relatedRideId,
    relatedChatId: data.relatedChatId || null,
    relatedBookingId: data.relatedBookingId || null,
    title: data.title,
    message: data.message,
    isRead: false,
    createdAt: serverTimestamp(),
    metadata: data.metadata || {}
  });
}

export async function markNotificationAsRead(
  firestore: any,
  university: string,
  notificationId: string
) {
  const notificationRef = doc(firestore, 'universities', university, 'notifications', notificationId);
  await updateDoc(notificationRef, {
    isRead: true
  });
}

export async function markAllNotificationsAsRead(
  firestore: any,
  university: string,
  userId: string
) {
  const notificationsRef = collection(firestore, 'universities', university, 'notifications');
  const q = query(notificationsRef, where('userId', '==', userId), where('isRead', '==', false));
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(firestore);
  
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { isRead: true });
  });
  
  await batch.commit();
}

export async function markChatNotificationsAsRead(
  firestore: any,
  university: string,
  userId: string,
  chatId: string
) {
  const notificationsRef = collection(firestore, 'universities', university, 'notifications');
  const q = query(
    notificationsRef, 
    where('userId', '==', userId), 
    where('type', '==', 'chat'),
    where('relatedChatId', '==', chatId),
    where('isRead', '==', false)
  );
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(firestore);
  
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { isRead: true });
  });
  
  await batch.commit();
}

export async function markRideNotificationsAsRead(
  firestore: any,
  university: string,
  userId: string,
  rideId: string
) {
  const notificationsRef = collection(firestore, 'universities', university, 'notifications');
  const q = query(
    notificationsRef, 
    where('userId', '==', userId), 
    where('relatedRideId', '==', rideId),
    where('isRead', '==', false)
  );
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(firestore);
  
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { isRead: true });
  });
  
  await batch.commit();
}

export function subscribeToNotifications(
  firestore: any,
  university: string,
  userId: string,
  callback: (notifications: Notification[]) => void
) {
  const notificationsRef = collection(firestore, 'universities', university, 'notifications');
  const q = query(
    notificationsRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(
    q,
    (snapshot) => {
      const notifications: Notification[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      
      callback(notifications);
    },
    (error) => {
      // Gracefully handle permission denied errors
      if (error.code === 'permission-denied') {
        console.warn('[NotificationFirestore] Permission denied for notifications query. User may not have full permissions yet.');
        // Return empty notifications instead of crashing
        callback([]);
      } else {
        console.error('[NotificationFirestore] Error subscribing to notifications:', error);
      }
    }
  );
}
