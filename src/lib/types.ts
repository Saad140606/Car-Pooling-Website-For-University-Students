import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  university: 'ned' | 'fast';
  gender: 'male' | 'female';
  contactNumber?: string;
  transport?: 'car' | 'bike';
  createdAt: Timestamp;
  // University email verification
  universityEmail?: string; // @nu.edu.pk or @neduet.edu.pk
  universityEmailVerified?: boolean;
  universityEmailVerifiedAt?: Timestamp;
}

// Canonical user profile used for new hierarchical storage under
// `universities/{univ}/users/{uid}`. We keep optional legacy fields
// to avoid breaking UI that still reads them, but the minimal required
// shape is defined here.
export interface CanonicalUserProfile {
  uid: string;
  name: string; // display name / short name
  email: string | null;
  university: 'ned' | 'fast';
  role: 'driver' | 'passenger';
  createdAt: Timestamp;
  // Optional legacy-compatible fields
  fullName?: string;
  gender?: 'male' | 'female';
  contactNumber?: string;
  transport?: 'car' | 'bike';
  // University email verification
  universityEmail?: string;
  universityEmailVerified?: boolean;
  universityEmailVerifiedAt?: Timestamp;
}

export interface Ride {
  id: string;
  driverId: string;
  from: string;
  to: string;
  departureTime: Timestamp;
  transportMode: 'car' | 'bike';
  price: number;
  totalSeats: number;
  availableSeats: number;
  genderAllowed: 'male' | 'female' | 'both';
  status: 'active' | 'full' | 'completed' | 'cancelled';
  route: { lat: number, lng: number }[];
  createdAt: Timestamp;
  driverInfo: {
    fullName: string;
    gender: 'male' | 'female';
    contactNumber?: string;
    transport?: 'car' | 'bike';
  };
}

export interface Booking {
  id: string;
  rideId: string;
  driverId: string;
  passengerId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
  ride?: Ride; // Denormalized data for easier access
  passengerDetails?: UserProfile;
  driverDetails?: UserProfile;
  pickupPoint?: { lat: number, lng: number };
}

    