import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  university: 'ned' | 'fast';
  gender: 'male' | 'female';
  contactNumber?: string;
  transport?: 'car' | 'bike';
  createdAt: Timestamp;
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

    