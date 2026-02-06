'use client';

// src/components/analytics/PassengerSpendingCard.tsx
// Display passenger spending analytics

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  TrendingDown, 
  Car, 
  Calendar,
  ChevronRight,
  Loader2,
  RefreshCw,
  MapPin,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';

interface SpendingPerRide {
  rideId: string;
  bookingId: string;
  amount: number;
  date: string;
  from: string;
  to: string;
  driverId: string;
}

interface TopRoute {
  route: string;
  count: number;
  total: number;
}

interface PassengerAnalytics {
  totalSpent: number;
  totalRidesTaken: number;
  averageSpentPerRide: number;
  spendingPerRide: SpendingPerRide[];
  monthlySpending: { [key: string]: number };
  topRoutes: TopRoute[];
  lastUpdated: string;
}

interface PassengerSpendingCardProps {
  compact?: boolean;
  onViewDetails?: () => void;
}

export default function PassengerSpendingCard({ compact = false, onViewDetails }: PassengerSpendingCardProps) {
  const { user, data: userData } = useUser();
  const auth = useAuth();
  const [analytics, setAnalytics] = useState<PassengerAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllRides, setShowAllRides] = useState(false);
  
  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    if (!user || !userData?.university) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const token = await user.getIdToken(true);
      if (!token) return;
      
      const response = await fetch(
        `/api/analytics/passenger?university=${encodeURIComponent(userData.university)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setAnalytics(data.analytics);
      } else {
        setError(data.error || 'Failed to load analytics');
      }
    } catch (error: any) {
      console.error('[PassengerSpending] Error:', error);
      setError(error.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [user, userData?.university]);
  
  // Process completed rides
  const processCompletedRides = useCallback(async () => {
    if (!user || !userData?.university) return;
    
    try {
      setIsProcessing(true);
      
      const token = await user.getIdToken(true);
      if (!token) return;
      
      const response = await fetch('/api/analytics/process-completed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ university: userData.university }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[PassengerSpending] Processed:', data);
        // Refresh analytics after processing
        await fetchAnalytics();
      }
    } catch (error: any) {
      console.error('[PassengerSpending] Process error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [user, userData?.university, fetchAnalytics]);
  
  useEffect(() => {
    // First process any completed rides, then fetch analytics
    processCompletedRides();
  }, [processCompletedRides]);
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return `PKR ${amount.toLocaleString()}`;
  };
  
  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };
  
  // Get month name
  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };
  
  if (isLoading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="py-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Button 
            onClick={fetchAnalytics}
            variant="outline"
            className="border-blue-500 text-blue-400"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (!analytics) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="py-8 text-center text-gray-400">
          No analytics data available
        </CardContent>
      </Card>
    );
  }
  
  // Compact view for dashboard
  if (compact) {
    return (
      <Card className="bg-gradient-to-br from-blue-900/30 to-gray-800/50 border-blue-700/30 hover:border-blue-600/50 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-400" />
            Spending Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Total Spent */}
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-400">
                {formatCurrency(analytics.totalSpent)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Total Spent</p>
            </div>
            
            {/* Average Per Ride */}
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-400">
                {formatCurrency(Math.round(analytics.averageSpentPerRide))}
              </p>
              <p className="text-xs text-gray-400 mt-1">Avg per Ride</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Car className="w-4 h-4" />
                {analytics.totalRidesTaken} rides taken
              </span>
            </div>
            
            {onViewDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewDetails}
                className="text-blue-400 hover:text-blue-300"
              >
                Details
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Full view
  const displayedRides = showAllRides 
    ? analytics.spendingPerRide 
    : analytics.spendingPerRide.slice(0, 5);
  
  // Get sorted monthly spending for chart
  const sortedMonths = Object.entries(analytics.monthlySpending)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6); // Last 6 months
  
  const maxMonthlySpending = Math.max(...sortedMonths.map(([, amount]) => amount), 1);
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Total Spent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-blue-900/40 to-gray-800/50 border-blue-700/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-gray-400">Total Spent</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(analytics.totalSpent)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Rides Taken */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-purple-900/40 to-gray-800/50 border-purple-700/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Car className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-gray-400">Rides Taken</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">
                {analytics.totalRidesTaken}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Average Per Ride */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-cyan-900/40 to-gray-800/50 border-cyan-700/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-cyan-400" />
                <span className="text-sm text-gray-400">Avg per Ride</span>
              </div>
              <p className="text-2xl font-bold text-cyan-400">
                {formatCurrency(Math.round(analytics.averageSpentPerRide))}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      
      {/* Monthly Spending Chart */}
      {sortedMonths.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Monthly Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {sortedMonths.map(([month, amount], index) => {
                const height = (amount / maxMonthlySpending) * 100;
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-2">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg min-h-[4px]"
                    />
                    <div className="text-center">
                      <p className="text-xs text-gray-400">{getMonthName(month)}</p>
                      <p className="text-xs text-blue-400 font-medium">
                        {amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : amount}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Top Routes */}
      {analytics.topRoutes.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" />
              Frequent Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topRoutes.map((route, index) => (
                <motion.div
                  key={route.route}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm text-white">{route.route}</p>
                      <p className="text-xs text-gray-400">
                        {route.count} ride{route.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <p className="text-blue-400 font-medium">
                    {formatCurrency(route.total)}
                  </p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Recent Rides */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Recent Rides
            </CardTitle>
            <CardDescription>
              Your completed rides with spending
            </CardDescription>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsProcessing(true);
              processCompletedRides();
            }}
            disabled={isProcessing}
            className="text-gray-400 hover:text-white"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {displayedRides.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No completed rides yet</p>
              <p className="text-sm mt-1">
                Spending is tracked after rides are completed
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {displayedRides.map((ride, index) => (
                  <motion.div
                    key={ride.bookingId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {ride.from} → {ride.to}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(ride.date)}
                      </p>
                    </div>
                    <p className="text-blue-400 font-semibold">
                      {formatCurrency(ride.amount)}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {analytics.spendingPerRide.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full text-blue-400 hover:text-blue-300"
                  onClick={() => setShowAllRides(!showAllRides)}
                >
                  {showAllRides ? 'Show Less' : `Show All (${analytics.spendingPerRide.length})`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
