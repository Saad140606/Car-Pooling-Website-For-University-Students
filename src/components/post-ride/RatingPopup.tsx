'use client';

// src/components/post-ride/RatingPopup.tsx
// A popup component that shows when a passenger needs to rate a completed ride

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, Car, MapPin, Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';

interface PendingRating {
  rideId: string;
  ratedUserId: string;
  targetName: string;
  role: 'driver' | 'passenger';
  from: string;
  to: string;
  departureTime: string;
  price: number;
}

interface RatingPopupProps {
  onRatingComplete?: () => void;
}

export default function RatingPopup({ onRatingComplete }: RatingPopupProps) {
  const { user, data: userData } = useUser();
  const auth = useAuth();
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);
  const [currentRating, setCurrentRating] = useState<PendingRating | null>(null);
  const [selectedStars, setSelectedStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch pending ratings
  const fetchPendingRatings = useCallback(async () => {
    if (!user || !userData?.university) return;
    
    try {
      setIsLoading(true);
      const token = await user.getIdToken(true);
      
      if (!token) return;
      
      const response = await fetch(`/api/ride-lifecycle/pending-ratings?university=${encodeURIComponent(userData.university)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      
      if (data.success && data.pendingRatings.length > 0) {
        setPendingRatings(data.pendingRatings);
        setCurrentRating(data.pendingRatings[0]);
        setIsOpen(true);
      } else {
        setPendingRatings([]);
        setCurrentRating(null);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('[RatingPopup] Error fetching pending ratings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, userData?.university]);
  
  useEffect(() => {
    fetchPendingRatings();
  }, [fetchPendingRatings]);
  
  // Submit rating
  const handleSubmitRating = async () => {
    if (!currentRating || selectedStars === 0 || !userData?.university || !user) return;
    
    try {
      setIsSubmitting(true);
      setSubmitStatus('idle');
      setErrorMessage('');
      
      const token = await user.getIdToken(true);
      
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch('/api/ride-lifecycle/rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rideId: currentRating.rideId,
          ratedUserId: currentRating.ratedUserId,
          rating: selectedStars,
          university: userData.university,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSubmitStatus('success');
        
        // Wait for animation, then move to next rating or close
        setTimeout(() => {
          const remainingRatings = pendingRatings.filter(r => r.ratedUserId !== currentRating.ratedUserId || r.rideId !== currentRating.rideId);
          setPendingRatings(remainingRatings);
          
          if (remainingRatings.length > 0) {
            setCurrentRating(remainingRatings[0]);
            setSelectedStars(0);
            setSubmitStatus('idle');
          } else {
            setIsOpen(false);
            setCurrentRating(null);
            onRatingComplete?.();
          }
        }, 1500);
      } else {
        setSubmitStatus('error');
        setErrorMessage(data.error || 'Failed to submit rating');
      }
    } catch (error: any) {
      console.error('[RatingPopup] Error submitting rating:', error);
      setSubmitStatus('error');
      setErrorMessage(error.message || 'Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };
  
  // Render star rating
  const renderStars = () => {
    return (
      <div className="flex gap-2 justify-center py-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            type="button"
            className="p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-full"
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            onClick={() => setSelectedStars(star)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            disabled={isSubmitting || submitStatus === 'success'}
          >
            <Star
              className={`w-10 h-10 transition-all duration-200 ${
                star <= (hoveredStar || selectedStars)
                  ? 'text-yellow-400 fill-yellow-400 drop-shadow-lg'
                  : 'text-gray-500'
              }`}
            />
          </motion.button>
        ))}
      </div>
    );
  };
  
  // Rating label based on stars
  const getRatingLabel = () => {
    const star = hoveredStar || selectedStars;
    switch (star) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return 'Tap a star to rate';
    }
  };
  
  if (!currentRating || !isOpen) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="bg-gray-900 border-gray-700 text-white max-w-md mx-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            {currentRating.role === 'driver' ? 'Rate Your Passenger' : 'Rate Your Driver'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            How was your experience with this ride?
          </DialogDescription>
        </DialogHeader>
        
        <AnimatePresence mode="wait">
          {submitStatus === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 300 }}
              >
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              </motion.div>
              <h3 className="text-xl font-semibold text-white mb-2">Thank You!</h3>
              <p className="text-gray-400">Your rating has been submitted</p>
              {pendingRatings.length > 1 && (
                <p className="text-sm text-emerald-400 mt-2">
                  Loading next ride to rate...
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="rating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Ride Details */}
              <div className="bg-gray-800/50 rounded-lg p-4 mb-4 border border-gray-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Car className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="font-medium text-white">
                    {currentRating.targetName}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-gray-300">{currentRating.from}</div>
                      <div className="text-gray-500 text-xs">→</div>
                      <div className="text-gray-300">{currentRating.to}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>{formatDate(currentRating.departureTime)}</span>
                  </div>
                </div>
              </div>
              
              {/* Star Rating */}
              <div className="text-center">
                {renderStars()}
                <p className={`text-sm font-medium transition-colors ${
                  selectedStars > 0 ? 'text-yellow-400' : 'text-gray-500'
                }`}>
                  {getRatingLabel()}
                </p>
              </div>
              
              {/* Error Message */}
              {submitStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-3 mt-4"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
              
              {/* Submit Button */}
              <DialogFooter className="mt-6">
                <Button
                  onClick={handleSubmitRating}
                  disabled={selectedStars === 0 || isSubmitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Rating
                      {selectedStars > 0 && (
                        <span className="ml-2 text-yellow-400">
                          {'★'.repeat(selectedStars)}
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </DialogFooter>
              
              {/* Pending count */}
              {pendingRatings.length > 1 && (
                <p className="text-center text-xs text-gray-500 mt-3">
                  {pendingRatings.length - 1} more ride{pendingRatings.length > 2 ? 's' : ''} to rate
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
