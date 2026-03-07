'use client';

// src/components/analytics/DriverEarningsCard.tsx
// Display driver earnings and ratings analytics

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, 
  Star, 
  TrendingUp, 
  Users, 
  Car, 
  Calendar,
  ChevronRight,
  Loader2,
  RefreshCw,
  Award,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';

interface EarningsPerRide {
  rideId: string;
  earnings: number;
  date: string;
  from: string;
  to: string;
  bookedSeats: number;
  pricePerSeat: number;
}

interface RatingsPerRide {
  rideId: string;
  rating: number;
  date: string;
}

interface DriverAnalytics {
  totalEarnings: number;
  totalRidesCompleted: number;
  totalPassengersServed: number;
  averageRating: number;
  totalRatingsCount: number;
  earningsPerRide: EarningsPerRide[];
  ratingsPerRide: RatingsPerRide[];
  monthlyEarnings: { [key: string]: number };
  ratingDistribution: { [key: number]: number };
  lastUpdated: string;
}

interface DriverEarningsCardProps {
  compact?: boolean;
  onViewDetails?: () => void;
}

export default function DriverEarningsCard({ compact = false, onViewDetails }: DriverEarningsCardProps) {
  const { user, data: userData } = useUser();
  const auth = useAuth();
  const [analytics, setAnalytics] = useState<DriverAnalytics | null>(null);
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
      
      const token = await user.getIdToken();
      if (!token) return;
      
      const response = await fetch(
        `/api/analytics/driver?university=${encodeURIComponent(userData.university)}`,
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
      console.error('[DriverEarnings] Error:', error);
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
      
      const token = await user.getIdToken();
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
        console.log('[DriverEarnings] Processed:', data);
        // Refresh analytics after processing
        await fetchAnalytics();
      }
    } catch (error: any) {
      console.error('[DriverEarnings] Process error:', error);
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
  
  // Render stars
  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const starSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
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
            className="border-emerald-500 text-emerald-400"
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
      <Card className="bg-gradient-to-br from-emerald-900/30 to-gray-800/50 border-emerald-700/30 hover:border-emerald-600/50 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Earnings Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Total Earnings */}
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-400">
                {formatCurrency(analytics.totalEarnings)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Total Earnings</p>
            </div>
            
            {/* Average Rating */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-3xl font-bold text-yellow-400">
                  {analytics.averageRating.toFixed(1)}
                </p>
                <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                from {analytics.totalRatingsCount} ratings
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Car className="w-4 h-4" />
                {analytics.totalRidesCompleted} rides
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {analytics.totalPassengersServed} passengers
              </span>
            </div>
            
            {onViewDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewDetails}
                className="text-emerald-400 hover:text-emerald-300"
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
    ? analytics.earningsPerRide 
    : analytics.earningsPerRide.slice(0, 5);
  
  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Earnings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-emerald-900/40 to-gray-800/50 border-emerald-700/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span className="text-xs sm:text-sm text-gray-400">Total Earnings</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-emerald-400 break-words">
                {formatCurrency(analytics.totalEarnings)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Average Rating */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-yellow-900/40 to-gray-800/50 border-yellow-700/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-400" />
                <span className="text-xs sm:text-sm text-gray-400">Average Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xl sm:text-2xl font-bold text-yellow-400">
                  {analytics.averageRating.toFixed(1)}
                </p>
                {renderStars(Math.round(analytics.averageRating))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.totalRatingsCount} ratings
              </p>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Rides Completed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-blue-900/40 to-gray-800/50 border-blue-700/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <Car className="w-5 h-5 text-blue-400" />
                <span className="text-xs sm:text-sm text-gray-400">Rides Completed</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-blue-400">
                {analytics.totalRidesCompleted}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Passengers Served */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-purple-900/40 to-gray-800/50 border-purple-700/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span className="text-xs sm:text-sm text-gray-400">Passengers</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-purple-400">
                {analytics.totalPassengersServed}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      
      {/* Rating Distribution */}
      <Card className="bg-gray-800/50 border-gray-700 min-w-0 overflow-hidden">
        <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-yellow-400" />
            Rating Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = analytics.ratingDistribution[star] || 0;
              const percentage = analytics.totalRatingsCount > 0 
                ? (count / analytics.totalRatingsCount) * 100 
                : 0;
              
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 min-w-[44px] flex-shrink-0">
                    <span className="text-sm text-gray-400">{star}</span>
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  </div>
                  <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, delay: (5 - star) * 0.1 }}
                      className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400"
                    />
                  </div>
                  <span className="text-xs sm:text-sm text-gray-400 min-w-[24px] sm:min-w-[28px] text-right flex-shrink-0">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Recent Rides */}
      <Card className="bg-gray-800/50 border-gray-700 min-w-0 overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Recent Rides
            </CardTitle>
            <CardDescription>
              Your completed rides with earnings
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
            className="text-gray-400 hover:text-white self-start sm:self-auto"
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
                Earnings are calculated 4-5 hours after rides complete
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {displayedRides.map((ride, index) => (
                  <motion.div
                    key={ride.rideId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {ride.from} → {ride.to}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
                        <span>{formatDate(ride.date)}</span>
                        <span>•</span>
                        <span>{ride.bookedSeats} passenger{ride.bookedSeats !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-emerald-400 font-semibold">
                        {formatCurrency(ride.earnings)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {ride.bookedSeats} × {formatCurrency(ride.pricePerSeat)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {analytics.earningsPerRide.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full text-emerald-400 hover:text-emerald-300"
                  onClick={() => setShowAllRides(!showAllRides)}
                >
                  {showAllRides ? 'Show Less' : `Show All (${analytics.earningsPerRide.length})`}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
