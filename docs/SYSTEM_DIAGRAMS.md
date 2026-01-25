# Campus Ride - Stops System Architecture Diagrams

## 1. System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMPUS RIDE - STOPS SYSTEM                   │
└─────────────────────────────────────────────────────────────────┘

                              RIDE CREATION FLOW
                              ═════════════════

1. ROUTE SELECTION
   Driver selects route A → B
   │
   └──> Route data: polyline, distance, from, to

2. AUTO-GENERATE STOPS
   POST /api/rides/generate-stops
   │
   ├──> Decode polyline to coordinates
   ├──> Calculate stop spacing (distance/5000)
   ├──> Sample points along route
   ├──> Query Nominatim API (300m radius)
   ├──> Filter by importance (>= 0.6)
   ├──> Deduplicate (200m proximity)
   └──> Return ~3-5 major stops

3. REVIEW & CUSTOMIZE
   StopsViewer Component
   │
   ├──> View stops on map
   ├──> Rename stops
   ├──> Reorder (drag-drop)
   ├──> Add custom stops
   └──> Delete unwanted stops

4. SAVE RIDE
   Save to Firestore with stops array
   │
   └──> PUT /api/rides/[rideId]/stops


                             RIDE BOOKING FLOW
                             ════════════════

1. SEARCH RIDES
   Passenger views ride list

2. VIEW STOPS
   StopsViewer Component (read-only)
   │
   ├──> Click "View Stops"
   ├──> See all stops with map
   └──> Understand pickup options

3. BOOK RIDE
   Click "Book" button
   │
   └──> Opens booking modal

4. SELECT PICKUP STOP
   StopSelector Component
   │
   ├──> Radio button list of stops
   ├──> Each shows: name + distance
   └──> Select one

5. CONFIRM BOOKING
   Save booking with selectedStopId
   │
   └──> POST /bookings with selectedStopId


                           STOP GENERATION ALGORITHM
                           ═════════════════════════

INPUT: routePolyline, routeDistance, from, to

                    ┌─────────────────────┐
                    │ Decode Polyline     │
                    │ (lat/lng array)     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Calculate Spacing   │
                    │ 5km=2500m, 10km=4km │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Sample N Points     │
                    │ (evenly spaced)     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Query Nominatim     │
                    │ (300m radius)       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Filter by Type      │
                    │ (importance >= 0.6) │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Deduplicate         │
                    │ (200m proximity)    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Sort & Order        │
                    │ (by distance)       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ Return Stops        │
                    │ [{id, name, ...}]   │
                    └─────────────────────┘

OUTPUT: Array of 3-8 stops with metadata
```

---

## 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENTS                          │
└─────────────────────────────────────────────────────────────────┘

                         CREATE RIDE PAGE
                         ═══════════════
                              │
                    ┌─────────┴─────────┐
                    │                   │
              RouteSelector     StopsViewer
              (user picks         (creator
               A→B)               edits stops)
                    │                   │
                    └─────────┬─────────┘
                              │
                         CreateRideForm
                         (with stops)
                              │
                    ┌─────────▼─────────┐
                    │ POST Ride + Stops  │
                    │ to Firestore       │
                    └────────────────────┘


                        RIDE LIST (PUBLIC)
                        ════════════════════
                              │
                    ┌─────────┴─────────┐
                    │                   │
                 RideCard1          RideCard2
                 (compact            (compact
                  view)              view)
                    │                   │
         ┌──────────┴──────────┐  ┌────▼─────────────┐
         │ "View Stops" Button │  │ "View Stops"     │
         └──────────┬──────────┘  │ Button           │
                    │             └────┬─────────────┘
         ┌──────────▼──────────┐       │
         │ StopsViewer Modal   │◄──────┘
         │ (read-only)         │
         │ - Show all stops    │
         │ - Map preview       │
         │ - "Book" button     │
         └──────────┬──────────┘
                    │
              Click "Book"
                    │
              ┌─────▼──────────┐
              │ BookingModal   │
              │ ┌────────────┐ │
              │ │StopSelector│ │
              │ │(required)  │ │
              │ └────┬───────┘ │
              │      │         │
              │   Select Stop  │
              │      │         │
              │ Confirm Button │
              └─────────────────┘


                          MY RIDES (CREATOR)
                          ═════════════════════
                              │
                         ┌────▼─────┐
                         │ My Ride 1 │
                         └────┬─────┘
                              │
                     ┌────────┴────────┐
                     │                 │
                StopsViewer       Show Bookings
                (editable)        (with selected
                - Reorder         stops)
                - Rename
                - Add/Remove
                - Save
```

---

## 3. Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLOW DIAGRAM                            │
└─────────────────────────────────────────────────────────────────┘

RIDE CREATION
═════════════

User Input                  Backend Processing              Firestore
    │                              │                            │
Route A→B      ──────POST──────>   │                            │
(polyline,      /generate-stops     │                            │
distance)           │              │                            │
    │          ┌────▼─────┐        │                            │
    │          │ Nominatim│        │                            │
    │          │   Query  │        │                            │
    │          └────┬─────┘        │                            │
    │               │              │                            │
    ◄─────────────────────────────│  [{stops...}]   ──PUT──>   stops
                                   │             /stops
    │                              │                            │
Edit/Customize                      │                       [Updated
Stops                               │                         Stops]
    │                              │
    └──────────────────PUT─────────>
                  /rides/[id]/stops
                                   │
                              Validate
                              & Save
                                   │
                                   └──────────────────────>
                                        Firestore Updated


RIDE BOOKING
════════════

User Views Ride            View Stops              Select Stop       Book
    │                         │                         │             │
    ├──"View Stops"──>      │  │                         │             │
    │               StopsViewer │                         │             │
    │               (shows map) │                         │             │
    │                         │                         │             │
    ├──"Book"───────────────────┼────"Book"──────────────►│             │
    │                           │         │ (modal)       │             │
    │                           │         │ StopSelector  │             │
    │                           │         │               │             │
    │                           │         └──Select Stop──►│             │
    │                           │                         │             │
    │                           │                         └─"Confirm"──►│
    │                           │                                  Booking
    │                           │                                  Saved
    │                           │                                 (with
    │                           │                                selectedStop
    │                           │                                   ID)
    │                           │                                   │
    ◄──────────────────────────────────────────────────────────────┘
         "Booking confirmed at [Stop Name]"
```

---

## 4. Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIRESTORE STRUCTURE                          │
└─────────────────────────────────────────────────────────────────┘

universities/
├── fast/
│   ├── rides/
│   │   └── ride_123/
│   │       ├── createdBy: "uid_user1"
│   │       ├── from: "FAST Main Gate"
│   │       ├── to: "DHA Lahore"
│   │       ├── departureTime: Timestamp
│   │       ├── price: 200
│   │       ├── availableSeats: 4
│   │       ├── routePolyline: "abcd...xyz"
│   │       ├── routeDistance: 8000
│   │       ├── status: "active"
│   │       │
│   │       ├── stops: [
│   │       │   {
│   │       │     id: "stop_001",
│   │       │     name: "Main Gate FAST",
│   │       │     lat: 24.8607,
│   │       │     lng: 67.0011,
│   │       │     distanceFromStart: 200,    ◄─ meters from start
│   │       │     type: "landmark",
│   │       │     placeId: "osm:12345",
│   │       │     isAutoGenerated: true,     ◄─ system generated
│   │       │     isCustom: false,
│   │       │     order: 0,                   ◄─ sequence
│   │       │     createdAt: Timestamp,
│   │       │     modifiedAt: Timestamp
│   │       │   },
│   │       │   {
│   │       │     id: "stop_002",
│   │       │     name: "Cricket Ground",
│   │       │     lat: 24.8620,
│   │       │     lng: 67.0050,
│   │       │     distanceFromStart: 3500,
│   │       │     type: "landmark",
│   │       │     placeId: "osm:67890",
│   │       │     isAutoGenerated: true,
│   │       │     isCustom: false,
│   │       │     order: 1,
│   │       │     createdAt: Timestamp,
│   │       │     modifiedAt: Timestamp
│   │       │   },
│   │       │   {
│   │       │     id: "stop_custom_001",
│   │       │     name: "Coffee Shop",
│   │       │     lat: 24.8630,
│   │       │     lng: 67.0070,
│   │       │     distanceFromStart: 6000,
│   │       │     type: "custom",
│   │       │     placeId: null,
│   │       │     isAutoGenerated: false,    ◄─ user added
│   │       │     isCustom: true,
│   │       │     order: 2,
│   │       │     createdAt: Timestamp,
│   │       │     modifiedAt: Timestamp
│   │       │   }
│   │       ]
│   │       │
│   │       └── stopsLastUpdated: Timestamp  ◄─ track changes
│   │
│   └── bookings/
│       └── booking_456/
│           ├── rideId: "ride_123"
│           ├── passengerId: "uid_user2"
│           ├── driverId: "uid_user1"
│           ├── selectedStopId: "stop_002"    ◄─ passenger's choice
│           ├── pickupPointName: "Cricket Ground"
│           ├── status: "pending"
│           ├── createdAt: Timestamp
│           └── updatedAt: Timestamp
│
└── ned/
    ├── rides/
    └── bookings/
```

---

## 5. API Endpoint Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS                                │
└─────────────────────────────────────────────────────────────────┘

GENERATE STOPS
══════════════

  POST /api/rides/generate-stops
  Body: {
    routePolyline: string,
    routeDistance: number,
    from: string,
    to: string
  }
  
  Response (200):
  {
    success: true,
    stops: [...],
    count: 5
  }


GET STOPS
═════════

  GET /api/rides/{rideId}/stops?university=fast
  Auth: None
  
  Response (200):
  {
    success: true,
    stops: [...]
  }


UPDATE STOPS
════════════

  PUT /api/rides/{rideId}/stops
  Auth: Bearer {token}
  Body: {
    stops: [...],
    university: "fast"
  }
  
  Response (200):
  {
    success: true,
    message: "Stops updated",
    stops: [...]
  }


ADD STOP
════════

  POST /api/rides/{rideId}/stops
  Auth: Bearer {token}
  Body: {
    stop: {
      name: string,
      lat: number,
      lng: number,
      distanceFromStart: number
    },
    university: "fast"
  }
  
  Response (200):
  {
    success: true,
    stop: {...}
  }


DELETE STOP
═══════════

  DELETE /api/rides/{rideId}/stops?stopId={id}&university=fast
  Auth: Bearer {token}
  
  Response (200):
  {
    success: true,
    message: "Stop deleted"
  }
```

---

## 6. Stop Importance Scoring

```
┌─────────────────────────────────────────────────────────────────┐
│            STOP TYPE IMPORTANCE MATRIX                          │
└─────────────────────────────────────────────────────────────────┘

HIGH PRIORITY (0.85 - 0.9)
═══════════════════════════
  🏫 University/College      0.9  ◄─ KEEP
  🏢 Landmark                0.9  ◄─ KEEP
  🏥 Hospital                0.85 ◄─ KEEP
  🚌 Bus Stop                0.85 ◄─ KEEP
  🛒 Shopping Center         0.85 ◄─ KEEP
  🏛️  Government Building    0.8  ◄─ KEEP


MEDIUM PRIORITY (0.65 - 0.8)
════════════════════════════
  ⛽ Fuel Station            0.75 ◄─ KEEP
  🏫 School                  0.75 ◄─ KEEP
  🕌 Mosque/Temple/Church   0.8  ◄─ KEEP
  🏨 Hotel                   0.7  ◄─ KEEP
  🏦 Bank                    0.7  ◄─ KEEP
  🅿️  Parking               0.8  ◄─ KEEP


LOWER PRIORITY (0.4 - 0.65)
═════════════════════════════
  🍔 Restaurant              0.65 ◄─ MAYBE
  ☕ Cafe                    0.6  ◄─ MAYBE
  🏢 Office                  0.4  ◄─ SKIP


NOT INCLUDED (< 0.4)
═════════════════════════════
  🏠 Residential Building    0.1  ✗ SKIP
  🏡 House                   0.05 ✗ SKIP
  🛣️  Minor Road             0.3  ✗ SKIP
  🌳 Tree                    0.0  ✗ SKIP

THRESHOLD: >= 0.6
```

---

## 7. Component State Management

```
┌─────────────────────────────────────────────────────────────────┐
│            COMPONENT STATE FLOW                                 │
└─────────────────────────────────────────────────────────────────┘

StopsViewer (Creator Mode)
══════════════════════════

Initial State:
{
  stops: Stop[],
  draggedIndex: null,
  editingId: null,
  editingName: "",
  showAddStop: false,
  newStopName: "",
  newStopLat: "",
  newStopLng: "",
  isSaving: false
}

User Actions:
  │
  ├─ Drag Stop
  │   └─> setDraggedIndex(index)
  │       └─> updateStopsOrder()
  │
  ├─ Rename Stop
  │   └─> setEditingId(id)
  │       └─> setEditingName(name)
  │           └─> handleRenameStop()
  │
  ├─ Add Stop
  │   └─> setShowAddStop(true)
  │       └─> handleAddStop()
  │           └─> setStops([...stops, newStop])
  │
  ├─ Delete Stop
  │   └─> handleRemoveStop(id)
  │       └─> setStops(filtered)
  │
  └─ Save
      └─> setIsSaving(true)
          └─> onUpdateStops()
              └─> setIsSaving(false)


StopSelector (Passenger Mode)
═════════════════════════════

Initial State:
{
  selected: "",
  open: false
}

User Actions:
  │
  ├─ Open Dialog
  │   └─> setOpen(true)
  │
  ├─ Select Stop (Radio)
  │   └─> setSelected(stopId)
  │
  └─ Confirm
      └─> onSelectStop(selected, stopName)
          └─> setOpen(false)
```

---

## 8. Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                ERROR HANDLING                                   │
└─────────────────────────────────────────────────────────────────┘

Generate Stops Error
════════════════════

  Try: POST /api/rides/generate-stops
    │
    ├─ Invalid polyline ────> Error: "Invalid route data"
    ├─ Missing distance ────> Error: "Missing routeDistance"
    ├─ Nominatim timeout ──> Error: "API timeout"
    ├─ No places found ────> Returns: empty array
    └─ Network error ──────> Error: "Network error"


Update Stops Error
══════════════════

  Try: PUT /api/rides/[rideId]/stops
    │
    ├─ No auth token ──────> Error: "Unauthorized" (401)
    ├─ Invalid token ──────> Error: "Invalid token" (401)
    ├─ Not ride creator ───> Error: "Permission denied" (403)
    ├─ Ride not found ─────> Error: "Ride not found" (404)
    ├─ Firestore error ────> Error: "Database error" (500)
    └─ Validation error ───> Error: "Invalid stop data" (400)


User Feedback
═════════════

  Success:
    ✓ "Stops generated successfully"
    ✓ "Stops updated"
    ✓ "Stop added"

  Error:
    ✗ "Failed to generate stops"
    ✗ "Permission denied"
    ✗ "Network error - try again"

  Loading:
    ⟳ "Generating stops..."
    ⟳ "Saving..."
```

---

**These diagrams provide a complete visual reference for the Campus Ride Stops System architecture, data flow, and component interactions.**
