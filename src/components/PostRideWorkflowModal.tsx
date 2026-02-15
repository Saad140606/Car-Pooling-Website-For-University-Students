'use client';

/**
 * Post-Ride Workflow Modal
 * 
 * BLOCKING FULL-SCREEN WORKFLOW
 * 
 * This is a critical lifecycle component:
 * - Covers full screen
 * - Prevents background interaction
 * - Cannot be dismissed
 * - Forces completion
 * 
 * Contains:
 * - Outcome step (passenger: completed/not, driver: show/no-show)
 * - Rating step (1-5 stars)
 * - Reason step (why didn't complete)
 * - Completion state
 */

import React, { useState } from 'react';
import { usePostRideWorkflow } from '@/contexts/PostRideWorkflowContext';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, MapPin, Star, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PostRideWorkflowModal() {
  const { currentWorkflow, state, goToStep, nextStep, previousStep, updateFormData, submitWorkflow } = usePostRideWorkflow();
  
  if (!currentWorkflow) {
    return null;
  }

  const isPassenger = currentWorkflow.userRole === 'passenger';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md overflow-hidden flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-primary/5 to-slate-900"></div>
        <div className="relative border-b border-primary/20 px-6 py-6 shadow-xl">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Required Workflow</p>
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">Complete Your Ride</h1>
            <p className="text-slate-300">
              {state.submitting ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                  Submitting your feedback...
                </span>
              ) : (
                'Please complete this workflow to continue using the app'
              )}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div className={cn(
            'h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500',
            state.currentStep === 'outcome' && 'w-[25%]',
            state.currentStep === 'rating' && 'w-[50%]',
            state.currentStep === 'reason' && 'w-[75%]',
            state.currentStep === 'complete' && 'w-full'
          )}></div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl">
            <div className="animate-fadeIn">
              {state.currentStep === 'outcome' && (
                <OutcomeStep 
                  isPassenger={isPassenger}
                  workflow={currentWorkflow}
                  formData={state.formData}
                  updateFormData={updateFormData}
                  nextStep={nextStep}
                  onSelect={(outcome) => {
                    updateFormData({ outcome });
                    nextStep();
                  }}
                />
              )}

              {state.currentStep === 'rating' && (
                <RatingStep
                  isPassenger={isPassenger}
                  workflow={currentWorkflow}
                  formData={state.formData}
                  onRating={(rating, review) => {
                    updateFormData({ rating, review });
                    nextStep();
                  }}
                />
              )}

              {state.currentStep === 'reason' && (
                <ReasonStep
                  isPassenger={isPassenger}
                  formData={state.formData}
                  onSubmit={(reason) => {
                    updateFormData({ reason });
                    submitWorkflow({
                      ...state.formData,
                      reason,
                    });
                  }}
                  submitting={state.submitting}
                />
              )}

              {state.currentStep === 'complete' && (
                <CompleteStep
                  isPassenger={isPassenger}
                />
              )}

              {state.error && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 animate-fadeIn">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Error</p>
                    <p className="text-sm text-red-300 mt-1">{state.error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Step indicators */}
        <div className="border-t border-slate-800 bg-slate-900/30 backdrop-blur-sm px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 flex-1">
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300',
                  state.currentStep === 'outcome' 
                    ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/50' 
                    : 'bg-slate-700 text-slate-400'
                )}>
                  {['rating', 'reason', 'complete'].includes(state.currentStep) ? '✓' : '1'}
                </div>
                <div className={cn(
                  'flex-1 h-1 rounded transition-all duration-300',
                  ['rating', 'reason', 'complete'].includes(state.currentStep) 
                    ? 'bg-primary' 
                    : 'bg-slate-700'
                )}></div>
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300',
                  state.currentStep === 'rating' 
                    ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/50'
                    : ['reason', 'complete'].includes(state.currentStep)
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                )}>
                  {['reason', 'complete'].includes(state.currentStep) ? '✓' : '2'}
                </div>
                <div className={cn(
                  'flex-1 h-1 rounded transition-all duration-300',
                  ['reason', 'complete'].includes(state.currentStep) 
                    ? 'bg-primary' 
                    : 'bg-slate-700'
                )}></div>
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300',
                  state.currentStep === 'reason' 
                    ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/50'
                    : state.currentStep === 'complete'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                )}>
                  {state.currentStep === 'complete' ? '✓' : '3'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">
                {state.currentStep === 'outcome' && 'Step 1 of 3'}
                {state.currentStep === 'rating' && 'Step 2 of 3'}
                {state.currentStep === 'reason' && 'Step 3 of 3'}
                {state.currentStep === 'complete' && 'Complete'}
              </span>
              <span className="text-slate-600">•</span>
              <span>
                {state.currentStep === 'outcome' && 'Confirm outcome'}
                {state.currentStep === 'rating' && 'Rate experience'}
                {state.currentStep === 'reason' && 'Provide details'}
                {state.currentStep === 'complete' && 'Workflow complete'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * STEP 1: Outcome Selection
 */
function OutcomeStep({ isPassenger, workflow, formData, onSelect, updateFormData, nextStep }: any) {
  if (isPassenger) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-xl">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">Did you complete the ride?</h2>
              <p className="text-slate-400 text-sm">
                Departure: <span className="text-slate-300 font-medium">{new Date(workflow.rideData.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onSelect('completed')}
              className={cn(
                'w-full p-5 rounded-xl transition-all duration-300 text-left border-2 group',
                formData.outcome === 'completed'
                  ? 'bg-green-500/20 border-green-500 shadow-lg shadow-green-500/20'
                  : 'bg-slate-700/20 border-transparent hover:bg-slate-700/30'
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                  formData.outcome === 'completed'
                    ? 'bg-green-500 shadow-lg shadow-green-500/50'
                    : 'bg-green-500/20 group-hover:bg-green-500/30'
                )}>
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-lg">Ride Completed</p>
                  <p className="text-slate-400 text-sm transition-colors duration-300">I finished the ride successfully</p>
                </div>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 transition-all duration-300',
                  formData.outcome === 'completed'
                    ? 'bg-green-500 border-green-500'
                    : 'border-slate-600 group-hover:border-slate-500'
                )}></div>
              </div>
            </button>

            <button
              onClick={() => onSelect('not_completed')}
              className={cn(
                'w-full p-5 rounded-xl transition-all duration-300 text-left border-2 group',
                formData.outcome === 'not_completed'
                  ? 'bg-red-500/20 border-red-500 shadow-lg shadow-red-500/20'
                  : 'bg-slate-700/20 border-transparent hover:bg-slate-700/30'
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                  formData.outcome === 'not_completed'
                    ? 'bg-red-500 shadow-lg shadow-red-500/50'
                    : 'bg-red-500/20 group-hover:bg-red-500/30'
                )}>
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white text-lg">Ride Not Completed</p>
                  <p className="text-slate-400 text-sm transition-colors duration-300">Something went wrong</p>
                </div>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 transition-all duration-300',
                  formData.outcome === 'not_completed'
                    ? 'bg-red-500 border-red-500'
                    : 'border-slate-600 group-hover:border-slate-500'
                )}></div>
              </div>
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
          <p className="text-xs text-slate-400">Your response helps us maintain service quality and improve the platform.</p>
        </div>
      </div>
    );
  }

  // Driver flow
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-xl">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Confirm Passenger Arrivals</h2>
            <p className="text-slate-400 text-sm">Mark which passengers showed up for the ride</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {workflow.rideData.confirmedPassengers?.map((passenger: any) => (
            <div key={passenger.id} className="bg-slate-700/20 border border-slate-700/50 rounded-xl p-4 transition-all duration-300 hover:bg-slate-700/30">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-white">{passenger.name}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{passenger.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const confirmations = formData.passengerConfirmations || {};
                      updateFormData({
                        passengerConfirmations: {
                          ...confirmations,
                          [passenger.id]: 'show',
                        }
                      });
                    }}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 border-2',
                      formData.passengerConfirmations?.[passenger.id] === 'show'
                        ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/30'
                        : 'bg-transparent border-slate-600 text-slate-300 hover:border-slate-500'
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Showed
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const confirmations = formData.passengerConfirmations || {};
                      updateFormData({
                        passengerConfirmations: {
                          ...confirmations,
                          [passenger.id]: 'no_show',
                        }
                      });
                    }}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 border-2',
                      formData.passengerConfirmations?.[passenger.id] === 'no_show'
                        ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/30'
                        : 'bg-transparent border-slate-600 text-slate-300 hover:border-slate-500'
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> No show
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => nextStep()}
          className={cn(
            'w-full px-6 py-3 font-semibold rounded-lg transition-all duration-300 border-2',
            formData.passengerConfirmations && Object.keys(formData.passengerConfirmations).length > 0
              ? 'bg-primary border-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30'
              : 'bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed'
          )}
          disabled={!formData.passengerConfirmations || Object.keys(formData.passengerConfirmations).length === 0}
        >
          Continue to Ratings
        </button>
      </div>

      {/* Info box */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
        <p className="text-xs text-slate-400">Confirm all passengers before proceeding to the next step.</p>
      </div>
    </div>
  );
}

/**
 * STEP 2: Rating
 */
function RatingStep({ isPassenger, workflow, formData, onRating }: any) {
  const [rating, setRating] = useState(formData.rating || 0);
  const [review, setReview] = useState(formData.review || '');

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-xl">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Star className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {isPassenger ? 'Rate Your Driver' : 'Rate the Passengers'}
            </h2>
            <p className="text-slate-400 text-sm">Your feedback helps us maintain quality</p>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold text-slate-300 mb-5">How would you rate this experience?</p>
          <div className="flex gap-4 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={cn(
                  'transition-all duration-300 transform',
                  star <= rating ? 'scale-110' : 'scale-100 hover:scale-105'
                )}
              >
                <Star
                  className={cn(
                    'w-10 h-10 transition-all duration-300',
                    star <= rating
                      ? 'fill-yellow-400 text-yellow-400 drop-shadow-lg'
                      : 'text-slate-600 hover:text-slate-500'
                  )}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-primary font-medium mt-4 animate-fadeIn">
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Needs improvement'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very good'}
              {rating === 5 && 'Excellent'}
            </p>
          )}
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold text-slate-300 mb-3">Add a review (optional)</p>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Share your experience..."
            className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-colors duration-300 text-sm resize-none"
            rows={3}
          />
          <p className="text-xs text-slate-500 mt-2">{review.length} / 500</p>
        </div>

        <button
          onClick={() => onRating(rating, review)}
          disabled={rating === 0}
          className={cn(
            'w-full px-6 py-3 font-semibold rounded-lg transition-all duration-300 border-2',
            rating > 0
              ? 'bg-primary border-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30'
              : 'bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed'
          )}
        >
          {rating > 0 ? 'Continue' : 'Select a rating to continue'}
        </button>
      </div>

      {/* Info box */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
        <p className="text-xs text-slate-400">Your honest feedback helps improve the platform for everyone.</p>
      </div>
    </div>
  );
}

/**
 * STEP 3: Reason (if applicable)
 */
function ReasonStep({ isPassenger, formData, onSubmit, submitting }: any) {
  const [reason, setReason] = useState(formData.reason || '');

  const reasons = isPassenger
    ? ['Driver did not arrive', 'Late arrival', 'Cancellation issue', 'Other']
    : ['No show', 'Pickup issue', 'Route changed', 'Other'];

  const handleSubmit = () => {
    if (isPassenger && formData.outcome === 'not_completed' && !reason) {
      return;
    }
    onSubmit(reason);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-xl">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Additional Details</h2>
            <p className="text-slate-400 text-sm">Help us understand what happened</p>
          </div>
        </div>

        <p className="text-sm font-semibold text-slate-300 mb-4">Select a reason:</p>
        <div className="space-y-3 mb-6">
          {reasons.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                'w-full p-4 text-left rounded-xl transition-all duration-300 border-2',
                reason === r
                  ? 'bg-primary/20 border-primary text-white shadow-lg shadow-primary/20'
                  : 'bg-slate-700/20 border-slate-700/50 text-slate-300 hover:bg-slate-700/30'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 transition-all duration-300',
                  reason === r ? 'bg-primary border-primary' : 'border-slate-600'
                )}></div>
                <span className="font-medium">{r}</span>
              </div>
            </button>
          ))}
        </div>

        {reason === 'Other' && (
          <div className="mb-6 animate-fadeIn">
            <textarea
              value={formData.reason === 'Other' ? '' : formData.reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please describe what happened..."
              className="w-full px-4 py-3 bg-slate-700/30 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-primary text-sm resize-none"
              rows={3}
            />
            <p className="text-xs text-slate-500 mt-2">{(formData.reason === 'Other' ? '' : formData.reason).length} / 500</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !reason}
          className={cn(
            'w-full px-6 py-3 font-semibold rounded-lg transition-all duration-300 border-2',
            submitting || !reason
              ? 'bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-primary border-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30'
          )}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              Submitting...
            </span>
          ) : (
            'Complete Workflow'
          )}
        </button>
      </div>

      {/* Info box */}
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
        <p className="text-xs text-slate-400">Your feedback is important to us and helps improve our service.</p>
      </div>
    </div>
  );
}

/**
 * STEP 4: Completion
 */
function CompleteStep({ isPassenger }: any) {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm border border-green-500/40 rounded-2xl p-8 text-center shadow-xl">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-green-500/30 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-16 h-16 bg-green-500/50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 animate-bounce" />
            </div>
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-white mb-3">Workflow Complete!</h2>
        <p className="text-slate-300 mb-4 text-lg">
          Thank you for completing your ride workflow.
        </p>
        <p className="text-slate-400 text-sm">
          Your feedback helps us maintain quality and improve the platform.
        </p>

        <div className="mt-8 pt-8 border-t border-green-500/20">
          <p className="text-sm text-slate-400">
            <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse mr-2"></span>
            Redirecting you shortly...
          </p>
        </div>
      </div>
    </div>
  );
}
