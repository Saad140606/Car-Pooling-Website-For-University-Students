/**
 * INTEGRATION EXAMPLE: How to use the Stops System in your app
 * 
 * This file shows concrete examples of integrating the stops system
 * into your Campus Ride app.
 */

// ============================================
// 1. CREATE RIDE PAGE - Generate & Manage Stops
// ============================================

import StopsViewer from '@/components/StopsViewer';
import { useStops } from '@/lib/useStops';
import { useState } from 'react';

export function CreateRideExample() {
  const { generateStops, updateStops } = useStops();
  const [stops, setStops] = useState([]);
  const [route, setRoute] = useState(null);

  // Step 1: User selects route
  const handleRouteSelected = async (selectedRoute) => {
    setRoute(selectedRoute);

    // Step 2: Auto-generate stops
    const generatedStops = await generateStops(
      selectedRoute.polyline,
      selectedRoute.distance,
      selectedRoute.from,
      selectedRoute.to
    );

    if (generatedStops) {
      setStops(generatedStops);
    }
  };

  // Step 3: User customizes stops and saves ride
  const handleCreateRide = async (rideFormData) => {
    // 3a. Create ride in Firestore
    const rideRef = await addDoc(
      collection(db, 'universities', userData.university, 'rides'),
      {
        createdBy: user.uid,
        driverId: user.uid,
        from: route.from,
        to: route.to,
        departureTime: Timestamp.fromDate(rideFormData.departureTime),
        routePolyline: route.polyline,
        routeDistance: route.distance,
        price: rideFormData.price,
        availableSeats: rideFormData.seats,
        status: 'active',
        createdAt: Timestamp.now(),
      }
    );

    // 3b. Save the customized stops
    await updateStops(rideRef.id, stops, userData.university);

    // 3c. Show success
    toast({ title: 'Ride created with stops!' });
  };

  return (
    <div>
      {/* Route selection UI */}
      <Button onClick={() => openRouteSelector(handleRouteSelected)}>
        Select Route
      </Button>

      {/* Show stops if available */}
      {stops.length > 0 && (
        <>
          <h3>Route Stops</h3>
          <StopsViewer
            stops={stops}
            routePolyline={route?.polyline}
            isCreator={true}
            onUpdateStops={(newStops) => setStops(newStops)}
            triggerText="Edit Stops"
          />
        </>
      )}

      {/* Create ride button */}
      <Button onClick={handleCreateRide} disabled={!route || stops.length === 0}>
        Create Ride
      </Button>
    </div>
  );
}

// ============================================
// 2. RIDE CARD - Show "View Stops" Button
// ============================================

import { StopsViewer } from '@/components/StopsViewer';
import { useStops } from '@/lib/useStops';
import { useEffect } from 'react';

export function RideCardWithStops({ ride }) {
  const { getStops } = useStops();
  const [stops, setStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);

  // Load stops when component mounts
  useEffect(() => {
    const loadStops = async () => {
      setLoadingStops(true);
      const fetchedStops = await getStops(ride.id, ride.university);
      setStops(fetchedStops || []);
      setLoadingStops(false);
    };

    loadStops();
  }, [ride.id, ride.university]);

  return (
    <Card>
      {/* Price and basic info */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3>{ride.from} → {ride.to}</h3>
          <Badge>PKR {ride.price}</Badge>
        </div>

        {/* View Stops Button - NEW */}
        {stops.length > 0 && (
          <StopsViewer
            stops={stops}
            isCreator={false}
            triggerText={`View ${stops.length} Stops`}
          />
        )}

        {/* Booking button */}
        <Button className="w-full mt-4" onClick={handleBook}>
          Book Ride
        </Button>
      </div>
    </Card>
  );
}

// ============================================
// 3. BOOKING MODAL - Select Pickup Stop
// ============================================

import StopSelector from '@/components/StopSelector';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useState } from 'react';

export function BookingModal({ ride, onClose }) {
  const [selectedStopId, setSelectedStopId] = useState('');
  const [selectedStopName, setSelectedStopName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectStop = (stopId, stopName) => {
    setSelectedStopId(stopId);
    setSelectedStopName(stopName);
  };

  const handleConfirmBooking = async () => {
    if (!selectedStopId) {
      toast({ variant: 'destructive', title: 'Please select a pickup stop' });
      return;
    }

    setLoading(true);

    try {
      // Save booking with selected stop
      const bookingRef = await addDoc(
        collection(db, 'universities', userData.university, 'bookings'),
        {
          rideId: ride.id,
          passengerId: user.uid,
          driverId: ride.driverId,
          selectedStopId, // <-- THE SELECTED STOP
          pickupPointName: selectedStopName,
          status: 'pending',
          createdAt: Timestamp.now(),
        }
      );

      toast({
        title: 'Booking confirmed!',
        description: `Pickup at: ${selectedStopName}`,
      });

      onClose();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Booking failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <h2>Book Ride: {ride.from} → {ride.to}</h2>

        <div className="my-4">
          <h3 className="font-semibold mb-3">Select Your Pickup Stop</h3>

          {ride.stops && ride.stops.length > 0 ? (
            <StopSelector
              stops={ride.stops}
              onSelectStop={handleSelectStop}
              selectedStopId={selectedStopId}
            />
          ) : (
            <p className="text-muted-foreground">
              This ride does not have defined stops.
            </p>
          )}
        </div>

        {selectedStopName && (
          <div className="p-3 bg-blue-50 rounded-lg text-sm">
            <strong>Selected Pickup:</strong> {selectedStopName}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmBooking}
            disabled={!selectedStopId || loading}
          >
            {loading ? 'Confirming...' : 'Confirm Booking'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// 4. MY RIDES PAGE - Creator Managing Stops
// ============================================

export function MyRidesPage() {
  const { getStops, updateStops } = useStops();
  const [rides, setRides] = useState([]);

  const handleUpdateStops = async (rideId, newStops) => {
    const success = await updateStops(rideId, newStops, userData.university);
    if (success) {
      toast({ title: 'Stops updated!' });
    }
  };

  return (
    <div>
      <h1>My Rides</h1>

      {rides.map((ride) => (
        <Card key={ride.id}>
          <div className="p-4">
            <h3>{ride.from} → {ride.to}</h3>

            {/* Creator can manage stops */}
            <StopsViewer
              stops={ride.stops || []}
              routePolyline={ride.routePolyline}
              isCreator={true}
              onUpdateStops={(newStops) =>
                handleUpdateStops(ride.id, newStops)
              }
              triggerText="Manage Stops"
            />

            {/* Show passengers who booked */}
            <div className="mt-4">
              <h4>Bookings:</h4>
              {ride.bookings?.map((booking) => (
                <div key={booking.id} className="text-sm">
                  {booking.passengerName} - Pickup at:{' '}
                  <strong>
                    {
                      ride.stops?.find((s) => s.id === booking.selectedStopId)
                        ?.name
                    }
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// 5. ROUTE VIEWER - Show Stops on Map
// ============================================

import RouteMapModal from '@/components/RouteMapModal';
import { MapContainer, TileLayer, Marker, Polyline } from '@/components/map';
import L from 'leaflet';

export function RouteViewerWithStops({ ride, stops }) {
  // Decode polyline if needed
  const coordinates = decodePolyline(ride.routePolyline);

  // Create stop markers with different colors
  const getStopIcon = (isAutoGenerated) => {
    return L.divIcon({
      html: `
        <div style="
          background: ${isAutoGenerated ? '#3b82f6' : '#22c55e'};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          border: 2px solid white;
        ">
          ${isAutoGenerated ? '◉' : '●'}
        </div>
      `,
      iconSize: [32, 32],
      className: 'stop-marker',
    });
  };

  return (
    <div style={{ height: '500px' }}>
      <MapContainer
        bounds={L.latLngBounds(coordinates.map((c) => [c.lat, c.lng]))}
        style={{ height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />

        {/* Route polyline */}
        <Polyline
          positions={coordinates.map((c) => [c.lat, c.lng])}
          color="#3b82f6"
          weight={3}
        />

        {/* Stop markers */}
        {stops?.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={getStopIcon(stop.isAutoGenerated)}
          >
            <Popup>{stop.name}</Popup>
          </Marker>
        ))}

        {/* Start marker (green) */}
        <Marker position={[coordinates[0].lat, coordinates[0].lng]}>
          <Popup>Start: {ride.from}</Popup>
        </Marker>

        {/* End marker (red) */}
        <Marker position={[coordinates[coordinates.length - 1].lat, coordinates[coordinates.length - 1].lng]}>
          <Popup>End: {ride.to}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

// ============================================
// 6. HELPER: Decode Polyline
// ============================================

function decodePolyline(encoded) {
  let index = 0,
    lat = 0,
    lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let result = 0,
      shift = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return coordinates;
}

// ============================================
// EXPORT ALL EXAMPLES
// ============================================

export {
  CreateRideExample,
  RideCardWithStops,
  BookingModal,
  MyRidesPage,
  RouteViewerWithStops,
};
