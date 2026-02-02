'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { getDocs, updateDoc, doc, query, collection } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { BookOpen, MapPin, User, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface Booking {
  id: string;
  studentName: string;
  studentEmail: string;
  rideFrom: string;
  rideTo: string;
  driverName: string;
  departureTime?: any;
  status: string;
  seats: number;
  price: number;
  createdAt?: any;
  universityType?: string;
  rideId?: string;
}

export default function BookingsSection({ universityType }: { universityType: string }) {
  const firestore = useFirestore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    if (!firestore) return;

    setLoading(true);
    setError(null);

    // Fetch bookings from BOTH universities for complete admin view
    const fetchAllBookings = async () => {
      try {
        const universities = ['NED', 'FAST'];
        let allBookings: Booking[] = [];

        for (const univId of universities) {
          // First, try to get bookings from university-level bookings collection
          try {
            const bookingsCol = collection(firestore, `universities/${univId}/bookings`);
            const bookingsSnap = await getDocs(bookingsCol);
            
            console.log(`[BookingsSection] Fetched ${bookingsSnap.size} bookings from ${univId}/bookings`);
            
            const univBookings: Booking[] = bookingsSnap.docs.map(doc => ({
              id: doc.id,
              studentName: doc.data().studentName || doc.data().passengerName || 'Unknown',
              studentEmail: doc.data().studentEmail || doc.data().passengerEmail || '',
              rideFrom: doc.data().rideFrom || doc.data().from || doc.data().origin || '',
              rideTo: doc.data().rideTo || doc.data().to || doc.data().destination || '',
              driverName: doc.data().driverName || '',
              departureTime: doc.data().departureTime,
              status: doc.data().status || 'pending',
              seats: doc.data().seats || doc.data().seatsBooked || 1,
              price: doc.data().price || doc.data().fare || 0,
              createdAt: doc.data().createdAt,
              universityType: univId,
              rideId: doc.data().rideId,
            }));
            
            allBookings = [...allBookings, ...univBookings];
          } catch (e) {
            console.log(`[BookingsSection] No university-level bookings for ${univId}`);
          }

          // Also check ride-level requests/bookings
          try {
            const ridesCol = collection(firestore, `universities/${univId}/rides`);
            const ridesSnap = await getDocs(ridesCol);
            
            for (const rideDoc of ridesSnap.docs) {
              try {
                const requestsCol = collection(firestore, `universities/${univId}/rides/${rideDoc.id}/requests`);
                const requestsSnap = await getDocs(requestsCol);
                
                const rideData = rideDoc.data();
                const rideBookings: Booking[] = requestsSnap.docs.map(reqDoc => ({
                  id: reqDoc.id,
                  studentName: reqDoc.data().passengerName || reqDoc.data().name || 'Unknown',
                  studentEmail: reqDoc.data().passengerEmail || reqDoc.data().email || '',
                  rideFrom: rideData.from || rideData.origin || '',
                  rideTo: rideData.to || rideData.destination || '',
                  driverName: rideData.driverName || rideData.driver?.name || '',
                  departureTime: rideData.departureTime,
                  status: reqDoc.data().status || 'pending',
                  seats: reqDoc.data().seatsRequested || reqDoc.data().seats || 1,
                  price: rideData.price || rideData.fare || 0,
                  createdAt: reqDoc.data().createdAt,
                  universityType: univId,
                  rideId: rideDoc.id,
                }));
                
                allBookings = [...allBookings, ...rideBookings];
              } catch (e) {
                // Skip if can't read requests for this ride
              }
            }
          } catch (e) {
            console.log(`[BookingsSection] Could not fetch ride requests for ${univId}`);
          }
        }

        console.log(`[BookingsSection] Total bookings loaded: ${allBookings.length}`);
        setBookings(allBookings);
        setLoading(false);
        setError(null);
      } catch (err: any) {
        console.error('[BookingsSection] Failed to fetch bookings:', err);
        setError(`Failed to load bookings: ${err.message}`);
        setLoading(false);
      }
    };

    fetchAllBookings();
  }, [firestore]);

  const handleStatusChange = async (bookingId: string, newStatus: string, bookingUniversity?: string, rideId?: string) => {
    if (!firestore) return;
    try {
      // Determine the correct path based on where the booking is stored
      let bookingRef;
      if (rideId && bookingUniversity) {
        // If it's a ride request
        bookingRef = doc(firestore, `universities/${bookingUniversity}/rides/${rideId}/requests`, bookingId);
      } else if (bookingUniversity) {
        // If it's in university bookings collection
        bookingRef = doc(firestore, `universities/${bookingUniversity}/bookings`, bookingId);
      } else {
        throw new Error('Cannot determine booking location');
      }
      
      await updateDoc(bookingRef, { status: newStatus });
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    } catch (err: any) {
      console.error('[BookingsSection] Failed to update booking:', err);
      alert(`Failed to update booking: ${err.message}`);
    }
  };

  // Error state UI
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  let filteredBookings = bookings.filter(booking => {
    let matches = true;
    
    if (filterStatus !== 'all') {
      matches = matches && booking.status === filterStatus;
    }
    
    if (searchQuery) {
      matches = matches && (
        booking.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.studentEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.rideFrom.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return matches;
  });

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-900/30 text-green-300';
      case 'completed':
        return 'bg-blue-900/30 text-blue-300';
      case 'cancelled':
        return 'bg-red-900/30 text-red-300';
      case 'pending':
      default:
        return 'bg-amber-900/30 text-amber-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Search bookings by student name, email, or location..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />

        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilterStatus(status);
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                filterStatus === status
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {status}
              {status !== 'all' && ` (${bookings.filter(b => b.status === status).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Grid */}
      <div className="grid gap-4 animate-in fade-in">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-800/30 rounded-2xl animate-pulse" />
          ))
        ) : paginatedBookings.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No bookings found</p>
          </div>
        ) : (
          paginatedBookings.map((booking) => (
            <div
              key={booking.id}
              className="rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-slate-600/50 p-4 transition-all cursor-pointer hover:shadow-lg hover:shadow-primary/10"
              onClick={() => setExpandedId(expandedId === booking.id ? null : booking.id)}
            >
              {/* Booking Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-white">
                      {booking.rideFrom} <span className="text-slate-400">→</span> {booking.rideTo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <User className="h-4 w-4" />
                    <span>{booking.studentName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(booking.status)}
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium ${getStatusColor(booking.status)} capitalize`}>
                    {booking.status}
                  </span>
                </div>
              </div>

              {/* Booking Details */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Seats</p>
                  <p className="font-semibold text-white">{booking.seats}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Price</p>
                  <p className="font-semibold text-white">${booking.price}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Driver</p>
                  <p className="font-semibold text-white text-xs truncate">{booking.driverName}</p>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === booking.id && (
                <div className="border-t border-slate-700/30 pt-4 space-y-3 animate-in slide-in-from-top-2">
                  <div className="bg-slate-800/30 rounded-lg p-3 space-y-2 text-sm">
                    <p><span className="text-slate-400">Student Email:</span> <span className="text-slate-300">{booking.studentEmail}</span></p>
                    <p><span className="text-slate-400">Booking ID:</span> <span className="text-slate-300 font-mono text-xs">{booking.id}</span></p>
                    <p><span className="text-slate-400">Departure:</span> <span className="text-slate-300">{booking.departureTime?.toDate?.()?.toLocaleString?.() || 'N/A'}</span></p>
                    <p><span className="text-slate-400">Booked:</span> <span className="text-slate-300">{booking.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A'}</span></p>
                    <p><span className="text-slate-400">University:</span> <span className="text-slate-300">{booking.universityType || 'N/A'}</span></p>
                  </div>

                  {/* Status Actions */}
                  {booking.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(booking.id, 'confirmed', booking.universityType, booking.rideId);
                        }}
                        className="px-3 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-300 rounded-lg text-sm font-medium transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(booking.id, 'cancelled', booking.universityType, booking.rideId);
                        }}
                        className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg bg-slate-800/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/50 transition-colors"
          >
            Prev
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-2 rounded-lg transition-all ${
                currentPage === i + 1
                  ? 'bg-primary text-white shadow-lg shadow-primary/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg bg-slate-800/50 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700/50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
