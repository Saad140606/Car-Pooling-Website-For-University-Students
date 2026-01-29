# 🚀 Admin Panel Quick Start Guide

## Access the Admin Panel

### URL
```
/dashboard/admin/support
```

### Requirements
1. Must be logged in
2. User ID must exist in Firestore `admins` collection
3. `universityType` field must be set (FAST or NED)

### If You Get Redirected
- **Issue**: "Not an admin"
- **Solution**: Add your user to `admins` collection:
  ```firestore
  /admins/{your-uid}
  {
    email: "your.email@example.com",
    fullName: "Your Name",
    universityType: "FAST" // or "NED"
  }
  ```

---

## Navigation Guide

### Tab 1: 📈 Overview
**Best for:** Quick status check
- View 6 key metrics at a glance
- See real-time counts
- Check trend indicators

**Metrics:**
- Total Users
- Total Rides
- Completed Rides
- Confirmed Bookings
- Active Today
- Cancelled Rides

### Tab 2: 📊 Analytics
**Best for:** Trend analysis
- View 30-day ride trends
- See user role distribution
- Switch between 7-day and 30-day views
- Understand patterns

**Charts:**
- Rides trend (line)
- User distribution (pie)
- Summary statistics

### Tab 3: 📋 Reports
**Best for:** Handling complaints
- View all user reports
- Filter by status
- Mark resolved
- See report category

**Actions:**
- View details
- Mark as resolved
- Delete old reports

### Tab 4: 💬 Messages
**Best for:** Customer support
- Read messages from users
- Check unread count
- Expand for full message
- Mark as read

**Features:**
- Read/unread indicator
- Sort by newest
- Filter by status
- Attachment links

### Tab 5: 👥 Users
**Best for:** User management
- Search all users
- Filter by role
- Suspend users
- Delete accounts
- View user details

**Actions:**
- Expand row for details
- Suspend toggle
- Delete permanently
- See join date & university

### Tab 6: 🚗 Rides
**Best for:** Ride oversight
- Search by location
- Filter by status
- Force cancel rides
- View ride details

**Information:**
- Route (From → To)
- Driver info
- Passenger count
- Price & timing

### Tab 7: 📚 Bookings
**Best for:** Booking management
- Find bookings by student/location
- Filter by status
- Approve pending
- Cancel if needed

**Actions:**
- Expand for details
- Approve (pending only)
- Cancel (pending only)
- See all booking info

---

## Common Tasks

### Task 1: Find a Specific User
1. Go to **Users** tab
2. Type name or email in search
3. Results update instantly
4. Click expand to see details

### Task 2: Cancel a Ride
1. Go to **Rides** tab
2. Search or filter to find ride
3. Click to expand ride card
4. Click "Force Cancel" button
5. Status updates to "Cancelled"

### Task 3: Approve a Booking
1. Go to **Bookings** tab
2. Filter by "Pending" status
3. Click to expand booking
4. Click "Confirm" button
5. Status changes to "Confirmed"

### Task 4: Suspend a User
1. Go to **Users** tab
2. Find user in table
3. Click suspend button (ban icon)
4. User status becomes "Suspended"
5. Click again to unsuspend

### Task 5: Check Unread Messages
1. Go to **Messages** tab
2. Click "Unread" filter button
3. See count of unread messages
4. Click to expand message
5. Click "Mark as Read" button

### Task 6: View Reports
1. Go to **Reports** tab
2. Filter by "Pending" or "Resolved"
3. See report category and message
4. Click expand to view full details
5. Mark as resolved when done

### Task 7: Analyze Trends
1. Go to **Analytics** tab
2. View the LineChart for rides
3. Switch between 7-day/30-day
4. Check PieChart for user roles
5. Read summary statistics

---

## Tips & Tricks

### 🔍 Searching
- Search updates results instantly
- Works across name, email, location
- Case-insensitive
- Partial matches work

### 🔤 Filtering
- Multiple filter options per section
- Filters show item counts
- Apply filters before searching
- Click same filter again to clear

### 📄 Pagination
- Pages show 10 (table) or 8 (grid) items
- Click page numbers to jump
- Use Prev/Next to browse
- Current page is highlighted

### 📈 Charts
- Hover over lines/bars to see values
- Click legend items to toggle
- Time range filter on analytics
- Charts are fully responsive

### ⌨️ Keyboard Shortcuts
- Tab through navigation
- Enter to activate buttons
- Escape to close modals (when added)
- Ctrl+F for page search

---

## Troubleshooting

### Problem: Can't access admin panel
**Solutions:**
1. Check if logged in
2. Verify entry in `admins` collection
3. Check `universityType` field is set
4. Clear browser cache and refresh

### Problem: Data not updating
**Solutions:**
1. Check Firestore security rules
2. Verify internet connection
3. Refresh the page
4. Check browser developer tools for errors

### Problem: Search not working
**Solutions:**
1. Check spelling
2. Try shorter search terms
3. Clear filter to see all items
4. Check data exists in Firestore

### Problem: Button not responding
**Solutions:**
1. Wait for page to fully load
2. Check if data is still loading (skeleton)
3. Verify you have permission
4. Refresh and try again

### Problem: Charts not showing
**Solutions:**
1. Wait for data to load
2. Check if Firestore has data
3. Verify query in console
4. Refresh page

---

## Settings & Configuration

### User Settings
```
/dashboard/account
- Update profile
- Change password
- Manage preferences
```

### Admin Settings
- University type: FAST or NED
- Permissions configured in Firestore
- Role: admin or super_admin

### Firestore Collections
```
/admins/{uid}
/users/{uid}
/rides/{rideId}
/bookings/{bookingId}
/reports/{reportId}
/contactMessages/{messageId}
```

---

## Data Retention Policy

### Recommended Timeframes
- **Messages**: Keep 6 months, archive older
- **Reports**: Keep 1 year, mark resolved after 30 days
- **Deleted Users**: Archive after 30 days
- **Cancelled Rides**: Keep 90 days
- **Completed Bookings**: Keep 1 year

### Actions
- **Delete**: Permanent removal
- **Archive**: Move to archive collection
- **Mark Resolved**: Change status, keep record

---

## Performance Tips

### For Better Performance
1. **Close unused tabs** in browser
2. **Disable browser extensions** if slow
3. **Clear browser cache** regularly
4. **Use Chrome/Edge** for best performance
5. **Avoid large data filters** if slow

### For Large Datasets
1. Use pagination to limit results
2. Apply filters before searching
3. Search for specific items
4. Use date ranges to narrow results

---

## Privacy & Security

### What You Can Do
- ✅ View user data
- ✅ Manage rides & bookings
- ✅ Resolve reports
- ✅ Suspend/delete users (with confirmation)
- ✅ View analytics

### What You CAN'T Do
- ❌ Access user passwords
- ❌ See payment information
- ❌ Access location history
- ❌ Modify ride prices arbitrarily
- ❌ Access other admin's credentials

### Data Protection
- All actions logged in Firestore
- Deletions are permanent
- Suspension is reversible
- Audit trail maintained
- Security rules enforced

---

## Contact & Support

### For Issues
1. Check troubleshooting section
2. Review browser console for errors
3. Contact development team
4. Provide screenshot of issue

### For Features
1. Document request
2. Explain use case
3. Provide example data
4. Contact product team

### For Emergencies
1. **Service Down**: Try refreshing
2. **Critical Bug**: Contact admin team
3. **Security Issue**: Report immediately
4. **Data Issue**: Contact database admin

---

## Keyboard Shortcuts (When Expanded)

| Key | Action |
|-----|--------|
| Tab | Navigate elements |
| Enter | Select/Confirm |
| Escape | Close (future) |
| Ctrl+F | Browser search |
| Ctrl+A | Select all |

---

## Browser Compatibility

### Recommended
- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

### Minimum
- Chrome 85+
- Edge 85+
- Firefox 83+
- Safari 12+

---

## Quick Reference

### Most Used Actions
1. **Search user**: Users tab → search name
2. **Cancel ride**: Rides tab → filter/search → expand → cancel
3. **Approve booking**: Bookings tab → filter pending → expand → confirm
4. **Suspend user**: Users tab → find → click ban → confirm
5. **Mark message read**: Messages tab → filter unread → expand → mark read

### Most Viewed Sections
1. **Overview**: Daily quick check
2. **Users**: User management
3. **Bookings**: Approval workflow
4. **Rides**: Ride oversight
5. **Analytics**: Weekly trends

### Key Metrics to Monitor
- Total Users (growth)
- Active Today (daily)
- Completed Rides (success)
- Confirmed Bookings (revenue)
- Cancelled (issues)
- Unread Messages (support)

---

## FAQ

**Q: How do I become an admin?**
A: Ask a current super_admin to add your user ID to the admins collection.

**Q: Can I undo a user deletion?**
A: No, deletions are permanent. Archive instead of delete for important users.

**Q: How often does data update?**
A: Real-time. Changes in Firestore appear instantly in the dashboard.

**Q: What if I make a mistake?**
A: Most actions are reversible. Deletions are not - be careful.

**Q: Can I export data?**
A: Not yet. Contact development team for export features.

**Q: How many users can I manage?**
A: Unlimited. Performance stays good with pagination.

**Q: Is there an audit log?**
A: Yes, all admin actions are logged in Firestore.

**Q: Can other admins see my actions?**
A: Yes, if they have access to audit logs.

---

## Before You Start

### Checklist
- [ ] I'm logged in
- [ ] I'm in the admins collection
- [ ] universityType is set
- [ ] Page fully loaded
- [ ] No console errors
- [ ] I know what I want to do

### Quick Test
1. Go to Overview tab
2. See 6 stat cards load
3. Stat numbers should appear
4. Try clicking Users tab
5. Users table should show

**If all steps work: You're ready to go! 🎉**

---

**Last Updated**: Admin Panel v1.0
**Status**: Production Ready
**Support**: Contact admin team for issues
