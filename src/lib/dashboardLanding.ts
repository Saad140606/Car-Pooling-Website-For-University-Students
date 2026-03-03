import { collection, getDocs, limit, query, where, type Firestore } from 'firebase/firestore';
import { parseTimestampToMs } from '@/lib/timestampUtils';

const ACTIVE_BOOKING_STATUSES = ['PENDING', 'ACCEPTED', 'CONFIRMED', 'ONGOING', 'pending', 'accepted', 'confirmed', 'ongoing'];
const ACTIVE_DRIVER_RIDE_STATUSES = ['active', 'full', 'ongoing', 'ACTIVE', 'FULL', 'ONGOING'];
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function isVisibleByDeparture(departureCandidate: any): boolean {
  const departureMs = parseTimestampToMs(departureCandidate, { silent: true });
  if (departureMs === null) return true;
  return Date.now() - departureMs <= FOUR_HOURS_MS;
}

export async function resolveDashboardLandingRoute(params: {
  firestore: Firestore | null | undefined;
  uid: string | null | undefined;
  university: string | null | undefined;
}): Promise<string> {
  const { firestore, uid, university } = params;
  const normalizedUniversity = String(university || '').trim().toLowerCase();

  if (!firestore || !uid || !normalizedUniversity) {
    return '/dashboard/rides';
  }

  try {
    const driverRidesRef = collection(firestore, `universities/${normalizedUniversity}/rides`);
    const activeDriverRideQuery = query(
      driverRidesRef,
      where('driverId', '==', uid),
      where('status', 'in', ACTIVE_DRIVER_RIDE_STATUSES),
      limit(25)
    );
    const activeDriverRideSnap = await getDocs(activeDriverRideQuery);
    const hasVisibleRideCard = activeDriverRideSnap.docs.some((rideDoc) => {
      const ride = rideDoc.data() as any;
      return isVisibleByDeparture(ride?.departureTime);
    });
    if (hasVisibleRideCard) {
      return '/dashboard/my-rides';
    }
  } catch (error) {
    console.debug('[dashboardLanding] Driver ride lookup failed, falling back:', error);
  }

  try {
    const bookingsRef = collection(firestore, `universities/${normalizedUniversity}/bookings`);
    const activeBookingQuery = query(
      bookingsRef,
      where('passengerId', '==', uid),
      where('status', 'in', ACTIVE_BOOKING_STATUSES),
      limit(25)
    );
    const activeBookingSnap = await getDocs(activeBookingQuery);
    const hasVisibleBookingCard = activeBookingSnap.docs.some((bookingDoc) => {
      const booking = bookingDoc.data() as any;
      const departureCandidate = booking?.departureTime ?? booking?.ride?.departureTime;
      return isVisibleByDeparture(departureCandidate);
    });
    if (hasVisibleBookingCard) {
      return '/dashboard/my-bookings';
    }
  } catch (error) {
    console.debug('[dashboardLanding] Booking lookup failed, falling back:', error);
  }

  return '/dashboard/rides';
}
