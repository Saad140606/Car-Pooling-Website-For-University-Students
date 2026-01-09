"use client";

import React from 'react';
import MapLeaflet from './MapLeaflet';

type Props = {
  ride: any | null;
  onClose: () => void;
};

export default function RideDetailModal({ ride, onClose }: Props) {
  if (!ride) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl h-[80vh] bg-white rounded shadow-lg overflow-auto">
        <div className="flex items-center justify-between p-3 border-b">
          <div>
            <div className="font-semibold">Ride Details</div>
            <div className="text-sm text-muted-foreground">{ride.startLocation} → {ride.endLocation}</div>
          </div>
          <div>
            <button className="px-3 py-1 rounded bg-gray-200" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="h-64 bg-slate-100 rounded overflow-hidden">
              <MapLeaflet route={ride.route || []} className="w-full h-full" />
            </div>
            <div className="mt-3 space-y-2">
              <div><strong>Date:</strong> {ride.createdAt?.toDate ? ride.createdAt.toDate().toLocaleString() : (ride.createdAt?.seconds ? new Date(ride.createdAt.seconds*1000).toLocaleString() : '—')}</div>
              <div><strong>Fare:</strong> {ride.fare ? `PKR ${ride.fare}` : '—'}</div>
              <div><strong>Status:</strong> {ride.status || '—'}</div>
              <div><strong>Driver:</strong> {ride.driverName || ride.riderId || '—'}</div>
            </div>
          </div>

          <div>
            <div className="p-3 border rounded mb-3">
              <div className="font-semibold">Passengers</div>
              <ul className="mt-2 text-sm space-y-1">
                {(ride.passengerIds || []).length === 0 ? <li className="text-muted-foreground">No passengers</li> : (
                  (ride.passengerIds || []).map((p: string) => <li key={p}>{p}</li>)
                )}
              </ul>
            </div>

            <div className="p-3 border rounded">
              <div className="font-semibold">Receipts</div>
              <div className="mt-2 text-sm text-muted-foreground">No receipt available</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
