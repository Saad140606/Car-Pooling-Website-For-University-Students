# Critical Firestore Indexes for Performance

This document lists the required Firestore indexes for queries that cannot be fulfilled by the default indexes.

## How to Create Indexes

You can create indexes via:
1. **Firebase Console**: When you run a query that needs an index, the console will provide a link to create it
2. **Firestore Indexes File**: Add to `firestore.indexes.json` and deploy via `firebase deploy --only firestore:indexes`
3. **Cloud Console**: Navigate to Firestore → Indexes

## Required Indexes

### 1. Rides Queries (CRITICAL)
```json
{
  "collectionGroup": "rides",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "departureTime",
      "order": "ASCENDING"
    }
  ]
}
```

**Used by**: Find Rides page, Dashboard rides listing  
**Impact**: HIGH - This is the most frequently used query

### 2. Bookings by Passenger + Status
```json
{
  "collectionGroup": "bookings",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "passengerId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    }
  ]
}
```

**Used by**: Passenger bookings, My Bookings page  
**Impact**: HIGH

### 3. Rides by Driver + Creation Time
```json
{
  "collectionGroup": "rides",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "driverId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "createdAt",
      "order": "DESCENDING"
    }
  ]
}
```

**Used by**: My Rides dashboard, Driver analytics  
**Impact**: MEDIUM

### 4. Requests by Ride + Status
```json
{
  "collectionGroup": "requests",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "rideId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "status",
      "order": "ASCENDING"
    }
  ]
}
```

**Used by**: Ride requests, Driver notifications  
**Impact**: MEDIUM

### 5. Ratings by Booking
```json
{
  "collectionGroup": "ratings",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "bookingId",
      "order": "ASCENDING"
    }
  ]
}
```

**Used by**: Rating lookup, Post-ride ratings  
**Impact**: LOW-MEDIUM

## How to Deploy Indexes

### Option 1: Automatic via Console (Recommended for testing)
1. Run a query that needs an index
2. Firebase will show a message with a link
3. Click to create the index

### Option 2: Via firestore.indexes.json

1. Edit `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "rides",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "departureTime", "order": "ASCENDING"}
      ]
    }
  ]
}
```

2. Deploy:
```bash
firebase deploy --only firestore:indexes
```

## Performance Impact

- **Without proper indexes**: Queries can take 5-30+ seconds
- **With proper indexes**: Same queries complete in 100-500ms
- **Estimated improvement**: 10-100x faster

## Troubleshooting

If queries are still slow:
1. Check index status in Firebase Console
2. Wait 1-2 minutes for index to build
3. Verify index fields match your query filters exactly
4. Consider adding composite indexes if queries use multiple fields

## Query Optimization Best Practices

1. ✅ Always filter by status first (usually most selective)
2. ✅ Use orderBy for sorting vs. doing in-memory sort
3. ✅ Add pagination/limits to avoid fetching entire collection
4. ✅ Use `!=` filters sparingly (requires full collection scan)
5. ❌ Don't use `where` with multiple OR conditions (use `in` instead)
6. ❌ Don't do JOIN operations client-side (denormalize data instead)

## Monitoring

Monitor query performance in:
- **Chrome DevTools Network tab**: Look for Firestore API calls
- **Firebase Console > Firestore > Requests**: View query statistics
- **Lighthouse performance audit**: Check page load impact
