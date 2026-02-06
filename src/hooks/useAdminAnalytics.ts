"use client";

import { useState, useEffect } from "react";
import { getFirestore, collection, query, where, onSnapshot, Timestamp, doc, getDoc } from "firebase/firestore";
import { getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export interface UniversityStats {
  users: {
    total: number;
    verified: number;
    unverified: number;
    active: number;
  };
  rides: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  bookings: {
    total: number;
    confirmed: number;
    cancelled: number;
    pending: number;
    seatsBooked: number;
  };
  messages: {
    total: number;
    voice: number;
    files: number;
  };
  earnings: {
    total: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface AdminAnalytics {
  loading: boolean;
  error: string | null;
  fast: UniversityStats;
  ned: UniversityStats;
  karachi: UniversityStats;
  combined: UniversityStats;
  reports: {
    total: number;
    pending: number;
    resolved: number;
    inProgress: number;
    types: Record<string, number>;
  };
  trends: {
    usersGrowth: { date: string; fast: number; ned: number; karachi: number }[];
    ridesPerDay: { date: string; fast: number; ned: number; karachi: number }[];
    bookingsPerDay: { date: string; fast: number; ned: number; karachi: number }[];
    earningsPerDay: { date: string; fast: number; ned: number; karachi: number }[];
  };
}

const emptyStats: UniversityStats = {
  users: { total: 0, verified: 0, unverified: 0, active: 0 },
  rides: { total: 0, active: 0, completed: 0, cancelled: 0 },
  bookings: { total: 0, confirmed: 0, cancelled: 0, pending: 0, seatsBooked: 0 },
  messages: { total: 0, voice: 0, files: 0 },
  earnings: { total: 0, daily: 0, weekly: 0, monthly: 0 },
};

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function useAdminAnalytics(): AdminAnalytics {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fast, setFast] = useState<UniversityStats>({ ...emptyStats });
  const [ned, setNed] = useState<UniversityStats>({ ...emptyStats });
  const [karachi, setKarachi] = useState<UniversityStats>({ ...emptyStats });
  const [reports, setReports] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    inProgress: 0,
    types: {} as Record<string, number>,
  });
  const [trends, setTrends] = useState<AdminAnalytics["trends"]>({
    usersGrowth: [],
    ridesPerDay: [],
    bookingsPerDay: [],
    earningsPerDay: [],
  });

  useEffect(() => {
    let unsubscribes: (() => void)[] = [];

    const setupListeners = async () => {
      try {
        const app = getApp();
        const db = getFirestore(app);
        const auth = getAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setError("Admin not authenticated. Please log in again.");
          setLoading(false);
          return;
        }

        const adminDocRef = doc(db, "admins", uid);
        const adminSnap = await getDoc(adminDocRef);
        if (!adminSnap.exists()) {
          setError("Admin access is not configured for this user. Add your UID to the /admins collection.");
          setLoading(false);
          return;
        }

        const last7Days = getLast7Days();

        // Initialize trends
        const initTrends = () => {
          const empty = last7Days.map((date) => ({ date, fast: 0, ned: 0, karachi: 0 }));
          setTrends({
            usersGrowth: [...empty],
            ridesPerDay: [...empty],
            bookingsPerDay: [...empty],
            earningsPerDay: [...empty],
          });
        };
        initTrends();

        // ===== FAST USERS =====
        const fastUsersRef = collection(db, "universities", "fast", "users");
        const unsubFastUsers = onSnapshot(fastUsersRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const verified = docs.filter((d) => d.data().universityEmailVerified === true || d.data().emailVerified === true).length;
          const unverified = total - verified;
          const active = docs.filter((d) => d.data().status === "active" || !d.data().status).length;

          setFast((prev) => ({
            ...prev,
            users: { total, verified, unverified, active },
          }));

          // Update user growth trend
          const usersByDay: Record<string, number> = {};
          last7Days.forEach((d) => (usersByDay[d] = 0));
          docs.forEach((doc) => {
            const createdAt = toDate(doc.data().createdAt);
            if (createdAt) {
              const dateStr = createdAt.toISOString().split("T")[0];
              if (usersByDay[dateStr] !== undefined) {
                usersByDay[dateStr]++;
              }
            }
          });

          setTrends((prev) => ({
            ...prev,
            usersGrowth: prev.usersGrowth.map((item) => ({
              ...item,
              fast: usersByDay[item.date] || item.fast,
            })),
          }));

          console.log("[AdminAnalytics] FAST users:", total);
        });
        unsubscribes.push(unsubFastUsers);

        // ===== NED USERS =====
        const nedUsersRef = collection(db, "universities", "ned", "users");
        const unsubNedUsers = onSnapshot(nedUsersRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const verified = docs.filter((d) => d.data().universityEmailVerified === true || d.data().emailVerified === true).length;
          const unverified = total - verified;
          const active = docs.filter((d) => d.data().status === "active" || !d.data().status).length;

          setNed((prev) => ({
            ...prev,
            users: { total, verified, unverified, active },
          }));

          // Update user growth trend
          const usersByDay: Record<string, number> = {};
          last7Days.forEach((d) => (usersByDay[d] = 0));
          docs.forEach((doc) => {
            const createdAt = toDate(doc.data().createdAt);
            if (createdAt) {
              const dateStr = createdAt.toISOString().split("T")[0];
              if (usersByDay[dateStr] !== undefined) {
                usersByDay[dateStr]++;
              }
            }
          });

          setTrends((prev) => ({
            ...prev,
            usersGrowth: prev.usersGrowth.map((item) => ({
              ...item,
              ned: usersByDay[item.date] || item.ned,
            })),
          }));

          console.log("[AdminAnalytics] NED users:", total);
        });
        unsubscribes.push(unsubNedUsers);

        // ===== KARACHI USERS =====
        const karachiUsersRef = collection(db, "universities", "karachi", "users");
        const unsubKarachiUsers = onSnapshot(karachiUsersRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const verified = docs.filter((d) => d.data().universityEmailVerified === true || d.data().emailVerified === true).length;
          const unverified = total - verified;
          const active = docs.filter((d) => d.data().status === "active" || !d.data().status).length;

          setKarachi((prev) => ({
            ...prev,
            users: { total, verified, unverified, active },
          }));

          // Update user growth trend
          const usersByDay: Record<string, number> = {};
          last7Days.forEach((d) => (usersByDay[d] = 0));
          docs.forEach((doc) => {
            const createdAt = toDate(doc.data().createdAt);
            if (createdAt) {
              const dateStr = createdAt.toISOString().split("T")[0];
              if (usersByDay[dateStr] !== undefined) {
                usersByDay[dateStr]++;
              }
            }
          });

          setTrends((prev) => ({
            ...prev,
            usersGrowth: prev.usersGrowth.map((item) => ({
              ...item,
              karachi: usersByDay[item.date] || item.karachi,
            })),
          }));

          console.log("[AdminAnalytics] KARACHI users:", total);
        });
        unsubscribes.push(unsubKarachiUsers);

        // ===== FAST RIDES =====
        const fastRidesRef = collection(db, "universities", "fast", "rides");
        const unsubFastRides = onSnapshot(fastRidesRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const active = docs.filter((d) => ["active", "in_progress", "scheduled"].includes(d.data().status)).length;
          const completed = docs.filter((d) => d.data().status === "completed").length;
          const cancelled = docs.filter((d) => d.data().status === "cancelled").length;

          // Calculate earnings
          let totalEarnings = 0;
          docs.forEach((doc) => {
            const price = doc.data().pricePerSeat || doc.data().price || 0;
            const seats = doc.data().seatsBooked || doc.data().bookedSeats || 0;
            totalEarnings += price * seats;
          });

          setFast((prev) => ({
            ...prev,
            rides: { total, active, completed, cancelled },
            earnings: { ...prev.earnings, total: totalEarnings },
          }));

          // Update rides per day trend
          const ridesByDay: Record<string, number> = {};
          last7Days.forEach((d) => (ridesByDay[d] = 0));
          docs.forEach((doc) => {
            const createdAt = toDate(doc.data().createdAt || doc.data().departureTime);
            if (createdAt) {
              const dateStr = createdAt.toISOString().split("T")[0];
              if (ridesByDay[dateStr] !== undefined) {
                ridesByDay[dateStr]++;
              }
            }
          });

          setTrends((prev) => ({
            ...prev,
            ridesPerDay: prev.ridesPerDay.map((item) => ({
              ...item,
              fast: ridesByDay[item.date] || item.fast,
            })),
          }));

          console.log("[AdminAnalytics] FAST rides:", total);
        });
        unsubscribes.push(unsubFastRides);

        // ===== NED RIDES =====
        const nedRidesRef = collection(db, "universities", "ned", "rides");
        const unsubNedRides = onSnapshot(nedRidesRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const active = docs.filter((d) => ["active", "in_progress", "scheduled"].includes(d.data().status)).length;
          const completed = docs.filter((d) => d.data().status === "completed").length;
          const cancelled = docs.filter((d) => d.data().status === "cancelled").length;

          // Calculate earnings
          let totalEarnings = 0;
          docs.forEach((doc) => {
            const price = doc.data().pricePerSeat || doc.data().price || 0;
            const seats = doc.data().seatsBooked || doc.data().bookedSeats || 0;
            totalEarnings += price * seats;
          });

          setNed((prev) => ({
            ...prev,
            rides: { total, active, completed, cancelled },
            earnings: { ...prev.earnings, total: totalEarnings },
          }));

          // Update rides per day trend
          const ridesByDay: Record<string, number> = {};
          last7Days.forEach((d) => (ridesByDay[d] = 0));
          docs.forEach((doc) => {
            const createdAt = toDate(doc.data().createdAt || doc.data().departureTime);
            if (createdAt) {
              const dateStr = createdAt.toISOString().split("T")[0];
              if (ridesByDay[dateStr] !== undefined) {
                ridesByDay[dateStr]++;
              }
            }
          });

          setTrends((prev) => ({
            ...prev,
            ridesPerDay: prev.ridesPerDay.map((item) => ({
              ...item,
              ned: ridesByDay[item.date] || item.ned,
            })),
          }));

          console.log("[AdminAnalytics] NED rides:", total);
        });
        unsubscribes.push(unsubNedRides);

        // ===== KARACHI RIDES =====
        const karachiRidesRef = collection(db, "universities", "karachi", "rides");
        const unsubKarachiRides = onSnapshot(karachiRidesRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const active = docs.filter((d) => ["active", "in_progress", "scheduled"].includes(d.data().status)).length;
          const completed = docs.filter((d) => d.data().status === "completed").length;
          const cancelled = docs.filter((d) => d.data().status === "cancelled").length;

          // Calculate earnings
          let totalEarnings = 0;
          docs.forEach((doc) => {
            const price = doc.data().pricePerSeat || doc.data().price || 0;
            const seats = doc.data().seatsBooked || doc.data().bookedSeats || 0;
            totalEarnings += price * seats;
          });

          setKarachi((prev) => ({
            ...prev,
            rides: { total, active, completed, cancelled },
            earnings: { ...prev.earnings, total: totalEarnings },
          }));

          // Update rides per day trend
          const ridesByDay: Record<string, number> = {};
          last7Days.forEach((d) => (ridesByDay[d] = 0));
          docs.forEach((doc) => {
            const createdAt = toDate(doc.data().createdAt || doc.data().departureTime);
            if (createdAt) {
              const dateStr = createdAt.toISOString().split("T")[0];
              if (ridesByDay[dateStr] !== undefined) {
                ridesByDay[dateStr]++;
              }
            }
          });

          setTrends((prev) => ({
            ...prev,
            ridesPerDay: prev.ridesPerDay.map((item) => ({
              ...item,
              karachi: ridesByDay[item.date] || item.karachi,
            })),
          }));

          console.log("[AdminAnalytics] KARACHI rides:", total);
        });
        unsubscribes.push(unsubKarachiRides);

        // ===== FAST BOOKINGS =====
        const fastBookingsRef = collection(db, "universities", "fast", "bookings");
        const unsubFastBookings = onSnapshot(fastBookingsRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const confirmed = docs.filter((d) => d.data().status === "confirmed" || d.data().status === "accepted").length;
          const cancelled = docs.filter((d) => d.data().status === "cancelled").length;
          const pending = docs.filter((d) => d.data().status === "pending").length;
          const seatsBooked = docs.reduce((sum, d) => sum + (d.data().seats || d.data().seatsBooked || 1), 0);

          setFast((prev) => ({
            ...prev,
            bookings: { total, confirmed, cancelled, pending, seatsBooked },
          }));

          // Update bookings per day trend
          const bookingsByDay: Record<string, number> = {};
          last7Days.forEach((d) => (bookingsByDay[d] = 0));
          docs.forEach((doc) => {
            const createdAt = toDate(doc.data().createdAt);
            if (createdAt) {
              const dateStr = createdAt.toISOString().split("T")[0];
              if (bookingsByDay[dateStr] !== undefined) {
                bookingsByDay[dateStr]++;
              }
            }
          });

          setTrends((prev) => ({
            ...prev,
            bookingsPerDay: prev.bookingsPerDay.map((item) => ({
              ...item,
              fast: bookingsByDay[item.date] || item.fast,
            })),
          }));

          console.log("[AdminAnalytics] FAST bookings:", total);
        });
        unsubscribes.push(unsubFastBookings);

        // ===== NED BOOKINGS =====
        const nedBookingsRef = collection(db, "universities", "ned", "bookings");
        const unsubNedBookings = onSnapshot(nedBookingsRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const confirmed = docs.filter((d) => d.data().status === "confirmed" || d.data().status === "accepted").length;
          const cancelled = docs.filter((d) => d.data().status === "cancelled").length;
          const pending = docs.filter((d) => d.data().status === "pending").length;
          const seatsBooked = docs.reduce((sum, d) => sum + (d.data().seats || d.data().seatsBooked || 1), 0);

          setNed((prev) => ({
            ...prev,
            bookings: { total, confirmed, cancelled, pending, seatsBooked },
          }));

          // Update bookings per day trend
          const bookingsByDay: Record<string, number> = {};
          last7Days.forEach((d) => (bookingsByDay[d] = 0));
          docs.forEach((doc) => {
            const createdAt = toDate(doc.data().createdAt);
            if (createdAt) {
              const dateStr = createdAt.toISOString().split("T")[0];
              if (bookingsByDay[dateStr] !== undefined) {
                bookingsByDay[dateStr]++;
              }
            }
          });

          setTrends((prev) => ({
            ...prev,
            bookingsPerDay: prev.bookingsPerDay.map((item) => ({
              ...item,
              ned: bookingsByDay[item.date] || item.ned,
            })),
          }));

          console.log("[AdminAnalytics] NED bookings:", total);
        });
        unsubscribes.push(unsubNedBookings);

        // ===== KARACHI BOOKINGS =====
        const karachiBookingsRef = collection(db, "universities", "karachi", "bookings");
        const unsubKarachiBookings = onSnapshot(karachiBookingsRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const confirmed = docs.filter((d) => d.data().status === "confirmed" || d.data().status === "accepted").length;
          const cancelled = docs.filter((d) => d.data().status === "cancelled").length;
          const pending = docs.filter((d) => d.data().status === "pending").length;
          const seatsBooked = docs.reduce((sum, d) => sum + (d.data().seats || d.data().seatsBooked || 1), 0);

          setKarachi((prev) => ({
            ...prev,
            bookings: { total, confirmed, cancelled, pending, seatsBooked },
          }));

          // Update bookings per day trend
          const bookingsByDay: Record<string, number> = {};
          last7Days.forEach((d) => (bookingsByDay[d] = 0));
          docs.forEach((doc) => {
            const createdAt = toDate(doc.data().createdAt);
            if (createdAt) {
              const dateStr = createdAt.toISOString().split("T")[0];
              if (bookingsByDay[dateStr] !== undefined) {
                bookingsByDay[dateStr]++;
              }
            }
          });

          setTrends((prev) => ({
            ...prev,
            bookingsPerDay: prev.bookingsPerDay.map((item) => ({
              ...item,
              karachi: bookingsByDay[item.date] || item.karachi,
            })),
          }));

          console.log("[AdminAnalytics] KARACHI bookings:", total);
        });
        unsubscribes.push(unsubKarachiBookings);

        // ===== REPORTS (Global) =====
        const reportsRef = collection(db, "reports");
        const unsubReports = onSnapshot(reportsRef, (snapshot) => {
          const docs = snapshot.docs;
          const total = docs.length;
          const pending = docs.filter((d) => d.data().status === "pending").length;
          const resolved = docs.filter((d) => d.data().status === "resolved").length;
          const inProgress = docs.filter((d) => d.data().status === "in_progress").length;

          const types: Record<string, number> = {};
          docs.forEach((doc) => {
            const type = doc.data().type || doc.data().category || "other";
            types[type] = (types[type] || 0) + 1;
          });

          setReports({ total, pending, resolved, inProgress, types });
          console.log("[AdminAnalytics] Reports:", total);
        });
        unsubscribes.push(unsubReports);

        // ===== MESSAGES (per-university chats) =====
        const attachChatsListener = (
          univ: "fast" | "ned" | "karachi",
          setUniv: (value: UniversityStats | ((prev: UniversityStats) => UniversityStats)) => void
        ) => {
          const chatsRef = collection(db, "universities", univ, "chats");
          return onSnapshot(
            chatsRef,
            (snapshot) => {
              let total = 0;
              let voice = 0;
              let files = 0;

              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                total += data.messageCount || 1;
                voice += data.voiceCount || 0;
                files += data.fileCount || 0;
              });

              setUniv((prev) => ({
                ...prev,
                messages: { total, voice, files },
              }));

              console.log(`[AdminAnalytics] Messages - ${univ.toUpperCase()}:`, total);
            },
            (err) => {
              console.warn(`[AdminAnalytics] ${univ.toUpperCase()} chats listener error:`, err);
            }
          );
        };

        const unsubFastChats = attachChatsListener("fast", setFast);
        const unsubNedChats = attachChatsListener("ned", setNed);
        const unsubKarachiChats = attachChatsListener("karachi", setKarachi);
        unsubscribes.push(unsubFastChats, unsubNedChats, unsubKarachiChats);

        setLoading(false);
      } catch (err: any) {
        console.error("[AdminAnalytics] Setup error:", err);
        setError(err.message || "Failed to load analytics");
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, []);

  // Combine FAST + NED + KARACHI stats
  const combined: UniversityStats = {
    users: {
      total: fast.users.total + ned.users.total + karachi.users.total,
      verified: fast.users.verified + ned.users.verified + karachi.users.verified,
      unverified: fast.users.unverified + ned.users.unverified + karachi.users.unverified,
      active: fast.users.active + ned.users.active + karachi.users.active,
    },
    rides: {
      total: fast.rides.total + ned.rides.total + karachi.rides.total,
      active: fast.rides.active + ned.rides.active + karachi.rides.active,
      completed: fast.rides.completed + ned.rides.completed + karachi.rides.completed,
      cancelled: fast.rides.cancelled + ned.rides.cancelled + karachi.rides.cancelled,
    },
    bookings: {
      total: fast.bookings.total + ned.bookings.total + karachi.bookings.total,
      confirmed: fast.bookings.confirmed + ned.bookings.confirmed + karachi.bookings.confirmed,
      cancelled: fast.bookings.cancelled + ned.bookings.cancelled + karachi.bookings.cancelled,
      pending: fast.bookings.pending + ned.bookings.pending + karachi.bookings.pending,
      seatsBooked: fast.bookings.seatsBooked + ned.bookings.seatsBooked + karachi.bookings.seatsBooked,
    },
    messages: {
      total: fast.messages.total + ned.messages.total + karachi.messages.total,
      voice: fast.messages.voice + ned.messages.voice + karachi.messages.voice,
      files: fast.messages.files + ned.messages.files + karachi.messages.files,
    },
    earnings: {
      total: fast.earnings.total + ned.earnings.total + karachi.earnings.total,
      daily: fast.earnings.daily + ned.earnings.daily + karachi.earnings.daily,
      weekly: fast.earnings.weekly + ned.earnings.weekly + karachi.earnings.weekly,
      monthly: fast.earnings.monthly + ned.earnings.monthly + karachi.earnings.monthly,
    },
  };

  return {
    loading,
    error,
    fast,
    ned,
    karachi,
    combined,
    reports,
    trends,
  };
}
