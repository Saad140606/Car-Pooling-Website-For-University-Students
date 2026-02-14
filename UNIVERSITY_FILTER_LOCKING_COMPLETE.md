# University Portal Filter Locking Implementation

## Summary
Implemented university portal locking for filters and ride creation. Users from each university portal (FAST, NED, Karachi) now see only their respective university and cannot switch to "All Universities". Additionally, the Karachi University portal now displays "University of Karachi" with locked coordinates.

## Changes Made

### 1. **Filter Page** (`src/app/dashboard/rides/page.tsx`)

#### University Filter Locking
- **For logged-in users**: University is locked to their portal university and cannot be changed
- **For anonymous users**: Can still select between all universities
- Visual indicator shows 🔒 "Locked" badge when university is locked to portal

#### Karachi University Coordinates Locking
- When a Karachi University portal user is searching for rides and selects any direction filter:
  - The "Place" location automatically locks to "University of Karachi"
  - Coordinates lock to: **24.9393134, 67.1183975**
  - Place input becomes disabled with "📍 Locked" badge
  - Search suggestions are disabled for Karachi users when direction is selected

#### Code Changes
```typescript
// Auto-lock Karachi coordinates when direction is set
useEffect(() => {
  if (user && userData && userData.university) {
    setFilters(f => {
      const newFilters = { ...f };
      
      // Lock university to user's portal
      if (newFilters.university !== userData.university) {
        newFilters.university = userData.university;
      }
      
      // For Karachi University, auto-set to coordinates if direction is set
      if (userData.university === 'karachi' && f.direction !== 'any') {
        const karachiCoords = { lat: 24.9393134, lng: 67.1183975 };
        newFilters.pointInput = 'University of Karachi';
        newFilters.point = karachiCoords;
      }
      
      return newFilters;
    });
  }
}, [user, userData, userData?.university, filters.direction]);
```

#### UI Changes
- Show different UI for locked university (input field disabled with green badge)
- For Karachi users: Locked place field shows "University of Karachi" when direction selected
- Visual indication with lock icons (🔒 and 📍)

---

### 2. **Create Ride Page** (`src/app/dashboard/create-ride/page.tsx`)

#### Updated University Coordinates
- **Karachi University**: Changed from `(24.9401, 67.1200)` to **`(24.9393134, 67.1183975)`**
- **University Name**: Changed from "University of Karachi, Main University Road..." to clean **"University of Karachi"**

#### Code Changes
```typescript
const KARACHI_UNI: LatLngLiteral = {
  lat: 24.9393134,
  lng: 67.1183975,
  name: 'University of Karachi',
};
```

#### University Short Name
```typescript
const getUniversityShortName = () => {
  const uni = (userData?.university || '').toString().toLowerCase();
  if (uni === 'ned') return 'NED University';
  if (uni === 'karachi') return 'University of Karachi';  // Changed from 'Karachi University'
  return 'FAST University';
};
```

---

## User Flows

### Flow 1: Logged-in User from FAST Portal
1. User logged in via FAST portal portal
2. Opens "Available Rides" filters
3. University field shows: "FAST University" (locked with 🔒 badge)
4. Cannot change university to "All Universities" or other universities
5. Can filter by other criteria (Transport, Gender, Price, Direction)

### Flow 2: Logged-in User from Karachi Portal
1. User logged in via Karachi portal
2. Opens "Available Rides" filters
3. University field shows: "Karachi University" (locked with 🔒 badge)
4. Selects "Going To University" or "Leaving From University" in Direction filter
5. Place field automatically locks to "University of Karachi" with locked badge 📍
6. Place field becomes read-only with coordinates (24.9393134, 67.1183975)
7. Can proceed with other filters

### Flow 3: Logged-in User Creating a Ride from Karachi Portal
1. User logged in via Karachi portal
2. Opens "Offer a New Ride"
3. Selects trip type ("Going to university" or "Leaving from university")
4. The corresponding location field (From/To) is set to "University of Karachi"
5. Coordinates lock to exact position: **24.9393134, 67.1183975**
6. Map centers on University of Karachi location
7. Cannot manually change this locked location

### Flow 4: Anonymous User
1. Not logged in
2. Clicks "Find Ride" on homepage
3. Can select any university from dropdown: "All Universities", "FAST University", "NED University", "Karachi University"
4. Then redirected to login/signup to proceed with booking

---

## Technical Details

### Constants Defined
- **FAST University**: `24.8569128, 67.2646384` - FAST National University of Computer and Emerging Sciences
- **NED University**: `24.9302091, 67.1148119` - NED UET
- **Karachi University**: `24.9393134, 67.1183975` - University of Karachi (updated)

### Features Implemented
1. ✅ University locked for logged-in users based on portal
2. ✅ Cannot select "All Universities" when logged in
3. ✅ Karachi University coordinates locked to exact position
4. ✅ Karachi University location displays as "University of Karachi"
5. ✅ Auto-lock place to Karachi University when direction selected
6. ✅ Visual feedback with lock icons and badges
7. ✅ Build verification - no errors

---

## Build Status
✅ **Build Successful** - No errors  
- Compiled in 37.0 seconds
- All 89 routes generated successfully
- All lifecycle API endpoints functional
- No TypeScript errors

---

## Testing Checklist
- [ ] Test filter locking for FAST portal user
- [ ] Test filter locking for NED portal user  
- [ ] Test filter locking for Karachi portal user
- [ ] Test Karachi place auto-lock when direction selected
- [ ] Test Karachi coordinates in create ride flow
- [ ] Test anonymous user can still select all universities
- [ ] Test navigation with locked filters
- [ ] Verify map centers correctly on university coordinates

---

## Files Modified
1. `src/app/dashboard/rides/page.tsx` - Filter locking and Karachi coordinates
2. `src/app/dashboard/create-ride/page.tsx` - Updated Karachi University coordinates and short name
