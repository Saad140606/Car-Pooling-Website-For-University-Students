# **App Name**: Campus Cruiser

## Core Features:

- University Authentication: Firebase Authentication with email verification, restricting login/registration to specified university domains (@neduet.edu.pk, @nu.edu.pk). University stored in custom claims.
- Ride Creation: Drivers can create rides, setting route (via map integration), seats, price, and gender preference.
- Ride Listing and Filtering: Passengers can view rides within their university, filtered by destination, time, price, and gender.
- Ride Request and Booking: Passengers can request a seat; bookings managed via Firestore updates.  No automatic booking.
- Real-time Location Sharing: Drivers share their live location with booked passengers during the ride using Firestore real-time updates; stops automatically after ride.
- Safety Features: Gender-based ride visibility, emergency button to share live location, user reporting and blocking.
- Admin Dashboard: Basic admin functionality to view users, rides, reports, and block users per university.

## Style Guidelines:

- Primary color: Deep indigo (#3F51B5), inspired by the traditional colors often associated with academic institutions, to evoke trust and stability.
- Background color: Very dark desaturated indigo (#21243D) to complement the dark theme.
- Accent color: Muted violet (#9575CD) to add a touch of modernity without disrupting the dark theme.
- Body font: 'Inter', sans-serif, known for its legibility and clean interface.
- Headline font: 'Space Grotesk', sans-serif, which complements Inter and gives a modern tech-focused twist.
- Simple, geometric icons to maintain a clean and modern aesthetic.
- Mobile-first, card-based layout with bottom-friendly buttons and large tap targets, designed for accessibility and ease of use on smaller screens. Incorporate glassmorphism for cards.
- Smooth, subtle animations using Framer Motion for transitions and interactions.