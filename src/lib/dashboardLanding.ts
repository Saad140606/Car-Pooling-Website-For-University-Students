import { collection, getDocs, limit, query, where, type Firestore } from 'firebase/firestore';

const ACTIVE_BOOKING_STATUSES = ['PENDING', 'ACCEPTED', 'CONFIRMED', 'ONGOING', 'pending', 'accepted', 'confirmed', 'ongoing'];
const ACTIVE_DRIVER_RIDE_STATUSES = ['active', 'full', 'ongoing', 'ACTIVE', 'FULL', 'ONGOING'];

export async function resolveDashboardLandingRoute(params: {
  firestore: Firestore | null | undefined;
  uid: string | null | undefined;
  university: string | null | undefined;
}): Promise<string> {
  const { firestore, uid, university } = params;

  if (!firestore || !uid || !university) {
    return '/dashboard/rides';
  }

  try {
    const driverRidesRef = collection(firestore, `universities/${university}/rides`);
    const activeDriverRideQuery = query(
      driverRidesRef,
      where('driverId', '==', uid),
      where('status', 'in', ACTIVE_DRIVER_RIDE_STATUSES),
      limit(1)
    );
    const activeDriverRideSnap = await getDocs(activeDriverRideQuery);
    if (!activeDriverRideSnap.empty) {
      return '/dashboard/my-rides';
    }
  } catch (error) {
    console.debug('[dashboardLanding] Driver ride lookup failed, falling back:', error);
  }

  try {
    const bookingsRef = collection(firestore, `universities/${university}/bookings`);
    const activeBookingQuery = query(
      bookingsRef,
      where('passengerId', '==', uid),
      where('status', 'in', ACTIVE_BOOKING_STATUSES),
      limit(1)
    );
    const activeBookingSnap = await getDocs(activeBookingQuery);
    if (!activeBookingSnap.empty) {
      return '/dashboard/my-bookings';
    }
  } catch (error) {
    console.debug('[dashboardLanding] Booking lookup failed, falling back:', error);
  }

  return '/dashboard/rides';
}
