'use client';

import React, { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { getDocs, updateDoc, doc, query, collection } from 'firebase/firestore';
import { safeCollection } from '@/firebase/helpers';
import { Car, MapPin, Clock, XCircle, Eye } from 'lucide-react';

interface Ride {
  id: string;
  driverName: string;
  driverEmail: string;
  from: string;
  to: string;
  departureTime?: any;
  status: string;
  passengers: number;
  seats: number;
  price: number;
  createdAt?: any;
}

export default function RidesSection({ universityType }: { universityType: string }) {
  const firestore = useFirestore();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    if (!firestore) return;

    (async () => {
      try {
        const ridesCol = safeCollection(firestore, 'rides');
        const ridesSnap = await getDocs(ridesCol);
        
        let ridesList: Ride[] = ridesSnap.docs.map(doc => ({
          id: doc.id,
          driverName: doc.data().driverName || 'Unknown',
          driverEmail: doc.data().driverEmail || '',
          from: doc.data().from || '',
          to: doc.data().to || '',
          departureTime: doc.data().departureTime,
          status: doc.data().status || 'active',
          passengers: doc.data().confirmedBookings?.length || 0,
          seats: doc.data().seats || 0,
          price: doc.data().price || 0,
          createdAt: doc.data().createdAt,
        }));

        setRides(ridesList);
      } catch (err) {
        console.error('Failed to fetch rides:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [firestore]);

  const handleCancelRide = async (rideId: string) => {
    if (!firestore || !confirm('Force cancel this ride?')) return;
    try {
      const rideRef = doc(firestore, 'rides', rideId);
      await updateDoc(rideRef, { status: 'cancelled' });
      setRides(rides.map(r => r.id === rideId ? { ...r, status: 'cancelled' } : r));
    } catch (err) {
      console.error('Failed to cancel ride:', err);
    }
  };

  let filteredRides = rides.filter(ride => {
    let matches = true;
    
    if (filterStatus !== 'all') {
      matches = matches && ride.status === filterStatus;
    }
    
    if (searchQuery) {
      matches = matches && (
        ride.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ride.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ride.driverName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return matches;
  });

  const totalPages = Math.ceil(filteredRides.length / itemsPerPage);
  const paginatedRides = filteredRides.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-900/30 text-green-300';
      case 'cancelled':
        return 'bg-red-900/30 text-red-300';
      case 'in-progress':
        return 'bg-blue-900/30 text-blue-300';
      default:
        return 'bg-amber-900/30 text-amber-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Search rides by location or driver..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />

        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'completed', 'cancelled'] as const).map((status) => (
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
            </button>
          ))}
        </div>
      </div>

      {/* Rides Cards Grid */}
      <div className="grid gap-4 animate-in fade-in">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-800/30 rounded-2xl animate-pulse" />
          ))
        ) : paginatedRides.length === 0 ? (
          <div className="text-center py-12 text-slate-400 col-span-full">
            <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No rides found</p>
          </div>
        ) : (
          paginatedRides.map((ride) => (
            <div
              key={ride.id}
              className="rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-md border border-slate-700/50 hover:border-slate-600/50 p-4 transition-all cursor-pointer hover:shadow-lg hover:shadow-primary/10"
              onClick={() => setExpandedId(expandedId === ride.id ? null : ride.id)}
            >
              {/* Ride Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-white">
                      {ride.from} <span className="text-slate-400">→</span> {ride.to}
                    </p>
                  </div>
                  <p className="text-sm text-slate-400">{ride.driverName}</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-medium ${getStatusColor(ride.status)} capitalize`}>
                  {ride.status}
                </span>
              </div>

              {/* Ride Details Grid */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Passengers</p>
                  <p className="font-semibold text-white">{ride.passengers}/{ride.seats}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Price</p>
                  <p className="font-semibold text-white">${ride.price}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">Departure</p>
                  <p className="font-semibold text-white text-xs">
                    {ride.departureTime?.toDate?.()?.toLocaleTimeString?.() || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === ride.id && (
                <div className="border-t border-slate-700/30 pt-4 space-y-3 animate-in slide-in-from-top-2">
                  <div className="bg-slate-800/30 rounded-lg p-3 space-y-2 text-sm">
                    <p><span className="text-slate-400">Ride ID:</span> <span className="text-slate-300 font-mono text-xs">{ride.id}</span></p>
                    <p><span className="text-slate-400">Ride Provider Email:</span> <span className="text-slate-300">{ride.driverEmail}</span></p>
                    <p><span className="text-slate-400">Created:</span> <span className="text-slate-300">{ride.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A'}</span></p>
                  </div>

                  {/* Actions */}
                  {ride.status !== 'cancelled' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelRide(ride.id);
                      }}
                      className="w-full px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Force Cancel
                    </button>
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
