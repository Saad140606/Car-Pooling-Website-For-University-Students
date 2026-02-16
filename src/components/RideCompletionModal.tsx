'use client';

/**
 * Ride Completion Workflow Modal
 * 
 * Full-screen blocking modal that handles:
 * - Provider flow: summary → decision → attendance → feedback → submit
 * - Passenger flow: summary → decision → rating → submit
 * 
 * Production-grade UI with:
 * - Premium dark design
 * - Smooth transitions
 * - Warning banner
 * - Mobile-first responsive layout
 * - No loading spinners (cached data shown instantly)
 * - Persistent across reloads
 */

import React, { useState, useMemo } from 'react';
import { useRideCompletion } from '@/contexts/RideCompletionContext';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Star,
  MapPin,
  Clock,
  Users,
  Car,
  Shield,
  ArrowLeft,
  ArrowRight,
  Loader2,
  UserCheck,
  UserX,
  Bike,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PendingCompletionWorkflow,
  ProviderNotCompletedReason,
  PassengerNotCompletedReason,
  PassengerNotArrivedReason,
  ConfirmedPassengerInfo,
} from '@/types/rideCompletion';

// ============================================================================
// MAIN MODAL
// ============================================================================

export function RideCompletionModal() {
  const { hasActiveWorkflow, currentWorkflow, state } = useRideCompletion();

  if (!hasActiveWorkflow || !currentWorkflow) return null;

  const isProvider = currentWorkflow.userRole === 'provider';
  const step = state.currentStep;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden flex flex-col">
      {/* Header */}
      <ModalHeader step={step} isProvider={isProvider} submitting={state.submitting} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center px-3 sm:px-6 py-4 sm:py-8">
          <div className="w-full max-w-2xl">
            {/* Warning Banner */}
            {step !== 'complete' && step !== 'submitting' && <WarningBanner />}

            {/* Error */}
            {state.error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Something went wrong</p>
                  <p className="text-xs text-red-400 mt-1">{state.error}</p>
                </div>
              </div>
            )}

            {/* Step Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {isProvider ? <ProviderFlow /> : <PassengerFlow />}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      {step !== 'complete' && step !== 'submitting' && (
        <ModalFooter step={step} isProvider={isProvider} />
      )}
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================

function ModalHeader({ step, isProvider, submitting }: { step: string; isProvider: boolean; submitting: boolean }) {
  const stepLabels: Record<string, string> = {
    summary: 'Ride Summary',
    decision: 'Completion Status',
    not_completed_reason: 'Provide Reason',
    passenger_attendance: 'Passenger Attendance',
    passenger_feedback: 'Rate Passengers',
    not_arrived_reasons: 'Passenger Reasons',
    provider_rating: 'Rate Provider',
    submitting: 'Submitting...',
    complete: 'Complete',
  };

  const progress = useMemo(() => {
    if (isProvider) {
      const steps = ['summary', 'decision', 'passenger_attendance', 'passenger_feedback', 'complete'];
      const idx = steps.indexOf(step);
      return Math.max(((idx + 1) / steps.length) * 100, 10);
    } else {
      const steps = ['summary', 'decision', 'provider_rating', 'complete'];
      const idx = steps.indexOf(step);
      return Math.max(((idx + 1) / steps.length) * 100, 10);
    }
  }, [step, isProvider]);

  return (
    <div className="relative flex-shrink-0">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
      <div className="relative border-b border-white/[0.06] px-4 sm:px-6 py-4 sm:py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-[0.15em]">
              Required Workflow
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {submitting ? 'Submitting...' : (stepLabels[step] || 'Complete Your Ride')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {isProvider ? 'Ride Provider' : 'Passenger'} • Cannot be skipped
          </p>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// WARNING BANNER
// ============================================================================

function WarningBanner() {
  return (
    <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl">
      <div className="flex items-start gap-2.5">
        <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] sm:text-xs text-amber-300/90 leading-relaxed">
          <span className="font-semibold text-amber-300">Important:</span>{' '}
          If you provide false information, your account may be suspended or banned.
          Please submit accurate ride details.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// FOOTER
// ============================================================================

function ModalFooter({ step, isProvider }: { step: string; isProvider: boolean }) {
  const { goBack } = useRideCompletion();
  const canGoBack = step !== 'summary';

  return (
    <div className="flex-shrink-0 border-t border-white/[0.06] bg-slate-950/80 backdrop-blur-sm px-4 sm:px-6 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        {canGoBack ? (
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
        ) : (
          <div />
        )}
        <p className="text-[10px] sm:text-xs text-slate-500">
          {isProvider ? 'Provider Workflow' : 'Passenger Workflow'}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// PROVIDER FLOW
// ============================================================================

function ProviderFlow() {
  const { state } = useRideCompletion();

  switch (state.currentStep) {
    case 'summary':
      return <SummaryStep />;
    case 'decision':
      return <ProviderDecisionStep />;
    case 'not_completed_reason':
      return <ProviderNotCompletedReasonStep />;
    case 'passenger_attendance':
      return <PassengerAttendanceStep />;
    case 'passenger_feedback':
      return <PassengerFeedbackStep />;
    case 'not_arrived_reasons':
      return <NotArrivedReasonsStep />;
    case 'submitting':
      return <SubmittingStep />;
    case 'complete':
      return <CompleteStep />;
    default:
      return <SummaryStep />;
  }
}

// ============================================================================
// PASSENGER FLOW
// ============================================================================

function PassengerFlow() {
  const { state } = useRideCompletion();

  switch (state.currentStep) {
    case 'summary':
      return <SummaryStep />;
    case 'decision':
      return <PassengerDecisionStep />;
    case 'not_completed_reason':
      return <PassengerNotCompletedReasonStep />;
    case 'provider_rating':
      return <ProviderRatingStep />;
    case 'submitting':
      return <SubmittingStep />;
    case 'complete':
      return <CompleteStep />;
    default:
      return <SummaryStep />;
  }
}

// ============================================================================
// SHARED: SUMMARY STEP
// ============================================================================

function SummaryStep() {
  const { currentWorkflow, goToStep } = useRideCompletion();
  if (!currentWorkflow) return null;

  const { rideSummary, confirmedPassengers, userRole } = currentWorkflow;
  const isProvider = userRole === 'provider';

  return (
    <div className="space-y-4">
      {/* Ride Summary Card */}
      <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* Card Header */}
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              {rideSummary.transportMode === 'car' ? (
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Car className="w-4.5 h-4.5 text-primary" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <Bike className="w-4.5 h-4.5 text-blue-400" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-white">{rideSummary.providerName}</h3>
                <p className="text-[11px] text-slate-400">Ride Provider</p>
              </div>
            </div>
            {rideSummary.rideStatusLabel && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/15 text-green-400 border border-green-500/20">
                {rideSummary.rideStatusLabel}
              </span>
            )}
          </div>
        </div>

        {/* Route */}
        <div className="px-5 sm:px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 pt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 ring-2 ring-green-400/20" />
              <div className="w-px h-6 bg-gradient-to-b from-green-400/40 to-red-400/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-red-400 ring-2 ring-red-400/20" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">From</p>
                <p className="text-sm font-medium text-white">{rideSummary.from}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">To</p>
                <p className="text-sm font-medium text-white">{rideSummary.to}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{rideSummary.totalSeats}</p>
              <p className="text-[10px] text-slate-500">Total Seats</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <UserCheck className="w-4 h-4 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{rideSummary.totalBookings}</p>
              <p className="text-[10px] text-slate-500">Bookings</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
              <Clock className="w-4 h-4 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">
                {rideSummary.departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-[10px] text-slate-500">Departure</p>
            </div>
          </div>
        </div>
      </div>

      {/* Passengers list (provider only) */}
      {isProvider && confirmedPassengers.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">
            Confirmed Passengers ({confirmedPassengers.length})
          </p>
          <div className="space-y-2">
            {confirmedPassengers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.02]">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.name}</p>
                  {p.pickupLocation && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3" /> {p.pickupLocation}
                    </p>
                  )}
                </div>
                <p className="text-xs font-semibold text-primary">Rs. {p.price}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={() => goToStep('decision')}
        className="w-full py-3.5 rounded-xl bg-primary text-white font-semibold text-sm
          hover:bg-primary/90 active:scale-[0.98] transition-all duration-200
          shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================================================
// PROVIDER: DECISION STEP
// ============================================================================

function ProviderDecisionStep() {
  const { setProviderDecision, state } = useRideCompletion();

  return (
    <div className="space-y-4">
      <StepCard
        icon={<CheckCircle2 className="w-5 h-5 text-primary" />}
        title="Did you complete this ride?"
        subtitle="Select the outcome of your ride"
      >
        <div className="space-y-3 mt-6">
          <ChoiceButton
            selected={state.providerForm.rideCompleted === true}
            onClick={() => setProviderDecision(true)}
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Ride Completed"
            description="The ride was completed successfully"
            color="green"
          />
          <ChoiceButton
            selected={state.providerForm.rideCompleted === false}
            onClick={() => setProviderDecision(false)}
            icon={<XCircle className="w-5 h-5" />}
            label="Ride Not Completed"
            description="The ride could not be completed"
            color="red"
          />
        </div>
      </StepCard>
    </div>
  );
}

// ============================================================================
// PROVIDER: NOT COMPLETED REASON
// ============================================================================

function ProviderNotCompletedReasonStep() {
  const { state, setProviderNotCompletedReason, submitWorkflow } = useRideCompletion();
  const [customReason, setCustomReason] = useState(state.providerForm.notCompletedReasonCustom || '');

  const reasons: { id: ProviderNotCompletedReason; label: string; icon: string }[] = [
    { id: 'vehicle_issue', label: 'Vehicle Issue', icon: '🚗' },
    { id: 'emergency', label: 'Emergency', icon: '🚨' },
    { id: 'late_arrival', label: 'Late Arrival', icon: '⏰' },
    { id: 'route_problem', label: 'Route Problem', icon: '🗺️' },
    { id: 'custom', label: 'Other Reason', icon: '✏️' },
  ];

  const selected = state.providerForm.notCompletedReason;
  const canSubmit = selected && (selected !== 'custom' || customReason.trim().length > 0);

  return (
    <div className="space-y-4">
      <StepCard
        icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
        title="Why wasn't the ride completed?"
        subtitle="Select the most accurate reason"
      >
        <div className="space-y-2.5 mt-5">
          {reasons.map((r) => (
            <button
              key={r.id}
              onClick={() => setProviderNotCompletedReason(r.id, r.id === 'custom' ? customReason : undefined)}
              className={cn(
                'w-full p-3.5 rounded-xl text-left transition-all duration-200 border',
                selected === r.id
                  ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/10'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{r.icon}</span>
                <span className={cn('text-sm font-medium', selected === r.id ? 'text-white' : 'text-slate-300')}>
                  {r.label}
                </span>
                <div className={cn(
                  'ml-auto w-4 h-4 rounded-full border-2 transition-all',
                  selected === r.id ? 'bg-primary border-primary' : 'border-slate-600'
                )} />
              </div>
            </button>
          ))}
        </div>

        {selected === 'custom' && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <textarea
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                setProviderNotCompletedReason('custom', e.target.value);
              }}
              placeholder="Describe what happened..."
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl
                text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/40
                transition-colors resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-[10px] text-slate-600 mt-1 text-right">{customReason.length}/500</p>
          </div>
        )}

        <button
          onClick={submitWorkflow}
          disabled={!canSubmit || state.submitting}
          className={cn(
            'w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
            canSubmit
              ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          )}
        >
          Submit & Complete
        </button>
      </StepCard>
    </div>
  );
}

// ============================================================================
// PROVIDER: PASSENGER ATTENDANCE
// ============================================================================

function PassengerAttendanceStep() {
  const { currentWorkflow, state, setPassengerAttendance, goToStep } = useRideCompletion();
  if (!currentWorkflow) return null;

  const passengers = currentWorkflow.confirmedPassengers;
  const attendance = state.providerForm.attendanceRecords;
  const allMarked = passengers.length > 0 && passengers.every(p => attendance[p.id]);

  const handleContinue = () => {
    const arrived = Object.values(attendance).filter(r => r.arrivalStatus === 'arrived');
    const notArrived = Object.values(attendance).filter(r => r.arrivalStatus === 'did_not_arrive');

    if (arrived.length > 0) {
      goToStep('passenger_feedback');
    } else if (notArrived.length > 0) {
      goToStep('not_arrived_reasons');
    } else {
      goToStep('passenger_feedback');
    }
  };

  return (
    <div className="space-y-4">
      <StepCard
        icon={<Users className="w-5 h-5 text-primary" />}
        title="Passenger Attendance"
        subtitle="Mark which passengers showed up for the ride"
      >
        <div className="space-y-3 mt-5">
          {passengers.map((p) => {
            const record = attendance[p.id];
            return (
              <div
                key={p.id}
                className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    {p.pickupLocation && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" /> {p.pickupLocation}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPassengerAttendance(p.id, 'arrived')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 border',
                      record?.arrivalStatus === 'arrived'
                        ? 'bg-green-500/20 border-green-500/40 text-green-300 shadow-lg shadow-green-500/10'
                        : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.04]'
                    )}
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Arrived
                  </button>
                  <button
                    onClick={() => setPassengerAttendance(p.id, 'did_not_arrive')}
                    className={cn(
                      'flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 border',
                      record?.arrivalStatus === 'did_not_arrive'
                        ? 'bg-red-500/20 border-red-500/40 text-red-300 shadow-lg shadow-red-500/10'
                        : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/[0.04]'
                    )}
                  >
                    <UserX className="w-3.5 h-3.5" /> Did Not Arrive
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleContinue}
          disabled={!allMarked}
          className={cn(
            'w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2',
            allMarked
              ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          )}
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </StepCard>
    </div>
  );
}

// ============================================================================
// PROVIDER: PASSENGER FEEDBACK (rate arrived passengers)
// ============================================================================

function PassengerFeedbackStep() {
  const {
    currentWorkflow,
    state,
    setPassengerRating,
    setPassengerReview,
    goToStep,
    getArrivedPassengers,
    getNotArrivedPassengers,
    submitWorkflow,
  } = useRideCompletion();

  if (!currentWorkflow) return null;

  const arrivedIds = getArrivedPassengers();
  const notArrivedIds = getNotArrivedPassengers();
  const arrivedPassengers = currentWorkflow.confirmedPassengers.filter(p => arrivedIds.includes(p.id));

  // If no arrived passengers, skip to not-arrived reasons or submit
  if (arrivedPassengers.length === 0) {
    if (notArrivedIds.length > 0) {
      return <NotArrivedReasonsStep />;
    }
    return <SubmittingStep />;
  }

  const allRated = arrivedPassengers.every(p => state.providerForm.passengerRatings[p.id] > 0);

  const handleContinue = () => {
    if (notArrivedIds.length > 0) {
      goToStep('not_arrived_reasons');
    } else {
      submitWorkflow();
    }
  };

  return (
    <div className="space-y-4">
      <StepCard
        icon={<Star className="w-5 h-5 text-yellow-400" />}
        title="Rate Passengers"
        subtitle="How was each passenger?"
      >
        <div className="space-y-5 mt-5">
          {arrivedPassengers.map((p) => (
            <PassengerRatingCard
              key={p.id}
              passenger={p}
              rating={state.providerForm.passengerRatings[p.id] || 0}
              review={state.providerForm.passengerReviews[p.id] || ''}
              onRating={(r) => setPassengerRating(p.id, r)}
              onReview={(r) => setPassengerReview(p.id, r)}
            />
          ))}
        </div>

        <button
          onClick={handleContinue}
          disabled={!allRated}
          className={cn(
            'w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2',
            allRated
              ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          )}
        >
          {notArrivedIds.length > 0 ? 'Continue' : 'Submit & Complete'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </StepCard>
    </div>
  );
}

function PassengerRatingCard({
  passenger,
  rating,
  review,
  onRating,
  onReview,
}: {
  passenger: ConfirmedPassengerInfo;
  rating: number;
  review: string;
  onRating: (r: number) => void;
  onReview: (r: string) => void;
}) {
  const [showReview, setShowReview] = useState(false);

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center text-xs font-bold text-green-400">
          {passenger.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{passenger.name}</p>
          <p className="text-[10px] text-green-400 font-medium">✓ Arrived</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-2.5">How was this passenger?</p>
      <div className="flex gap-2 justify-center mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onRating(star)}
            className="transition-transform duration-150 hover:scale-110 active:scale-95"
          >
            <Star
              className={cn(
                'w-8 h-8 transition-colors duration-200',
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-slate-700 hover:text-slate-500'
              )}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <p className="text-center text-[11px] text-primary font-medium mb-2">
          {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
        </p>
      )}

      {rating > 0 && (
        <div className="animate-in fade-in duration-200">
          {!showReview ? (
            <button
              onClick={() => setShowReview(true)}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              + Add review (optional)
            </button>
          ) : (
            <textarea
              value={review}
              onChange={(e) => onReview(e.target.value)}
              placeholder="Write a review..."
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg
                text-xs text-white placeholder-slate-600 focus:outline-none focus:border-primary/30
                transition-colors resize-none"
              rows={2}
              maxLength={300}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PROVIDER: NOT ARRIVED REASONS
// ============================================================================

function NotArrivedReasonsStep() {
  const {
    currentWorkflow,
    state,
    setNotArrivedReason,
    getNotArrivedPassengers,
    submitWorkflow,
  } = useRideCompletion();

  if (!currentWorkflow) return null;

  const notArrivedIds = getNotArrivedPassengers();
  const notArrivedPassengers = currentWorkflow.confirmedPassengers.filter(p => notArrivedIds.includes(p.id));

  if (notArrivedPassengers.length === 0) {
    // This shouldn't happen, but safeguard
    submitWorkflow();
    return <SubmittingStep />;
  }

  const reasons: { id: PassengerNotArrivedReason; label: string }[] = [
    { id: 'passenger_late', label: 'Passenger was late' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'no_show', label: 'No show' },
    { id: 'other', label: 'Other reason' },
  ];

  const allReasoned = notArrivedPassengers.every(
    p => state.providerForm.notArrivedReasons[p.id]
  );

  return (
    <div className="space-y-4">
      <StepCard
        icon={<UserX className="w-5 h-5 text-red-400" />}
        title="Why didn't they arrive?"
        subtitle="Select a reason for each passenger"
      >
        <div className="space-y-5 mt-5">
          {notArrivedPassengers.map((p) => (
            <NotArrivedReasonCard
              key={p.id}
              passenger={p}
              selectedReason={state.providerForm.notArrivedReasons[p.id]}
              customReason={state.providerForm.notArrivedReasonsCustom[p.id] || ''}
              reasons={reasons}
              onSelect={(reason, custom) => setNotArrivedReason(p.id, reason, custom)}
            />
          ))}
        </div>

        <button
          onClick={submitWorkflow}
          disabled={!allReasoned || state.submitting}
          className={cn(
            'w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
            allReasoned
              ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          )}
        >
          Submit & Complete
        </button>
      </StepCard>
    </div>
  );
}

function NotArrivedReasonCard({
  passenger,
  selectedReason,
  customReason,
  reasons,
  onSelect,
}: {
  passenger: ConfirmedPassengerInfo;
  selectedReason?: PassengerNotArrivedReason;
  customReason: string;
  reasons: { id: PassengerNotArrivedReason; label: string }[];
  onSelect: (reason: PassengerNotArrivedReason, custom?: string) => void;
}) {
  const [custom, setCustom] = useState(customReason);

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center text-xs font-bold text-red-400">
          {passenger.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{passenger.name}</p>
          <p className="text-[10px] text-red-400 font-medium">✗ Did not arrive</p>
        </div>
      </div>

      <div className="space-y-2">
        {reasons.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id, r.id === 'other' ? custom : undefined)}
            className={cn(
              'w-full p-2.5 rounded-lg text-left text-xs transition-all duration-200 border',
              selectedReason === r.id
                ? 'bg-primary/10 border-primary/30 text-white'
                : 'bg-white/[0.01] border-white/[0.04] text-slate-400 hover:bg-white/[0.03]'
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-3 h-3 rounded-full border transition-all',
                selectedReason === r.id ? 'bg-primary border-primary' : 'border-slate-600'
              )} />
              <span>{r.label}</span>
            </div>
          </button>
        ))}
      </div>

      {selectedReason === 'other' && (
        <div className="mt-2 animate-in fade-in duration-200">
          <textarea
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              onSelect('other', e.target.value);
            }}
            placeholder="Describe..."
            className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg
              text-xs text-white placeholder-slate-600 focus:outline-none focus:border-primary/30
              transition-colors resize-none"
            rows={2}
            maxLength={300}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PASSENGER: DECISION STEP
// ============================================================================

function PassengerDecisionStep() {
  const { setPassengerDecision, state } = useRideCompletion();

  return (
    <div className="space-y-4">
      <StepCard
        icon={<CheckCircle2 className="w-5 h-5 text-primary" />}
        title="Did you complete the ride?"
        subtitle="Select the outcome of your ride"
      >
        <div className="space-y-3 mt-6">
          <ChoiceButton
            selected={state.passengerForm.rideCompleted === true}
            onClick={() => setPassengerDecision(true)}
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Ride Completed"
            description="I finished the ride successfully"
            color="green"
          />
          <ChoiceButton
            selected={state.passengerForm.rideCompleted === false}
            onClick={() => setPassengerDecision(false)}
            icon={<XCircle className="w-5 h-5" />}
            label="Ride Not Completed"
            description="Something went wrong"
            color="red"
          />
        </div>
      </StepCard>
    </div>
  );
}

// ============================================================================
// PASSENGER: NOT COMPLETED REASON
// ============================================================================

function PassengerNotCompletedReasonStep() {
  const { state, setPassengerNotCompletedReason, submitWorkflow } = useRideCompletion();
  const [customReason, setCustomReason] = useState(state.passengerForm.notCompletedReasonCustom || '');

  const reasons: { id: PassengerNotCompletedReason; label: string; icon: string }[] = [
    { id: 'provider_didnt_arrive', label: "Provider didn't arrive", icon: '🚫' },
    { id: 'passenger_emergency', label: 'Passenger emergency', icon: '🚨' },
    { id: 'route_issue', label: 'Route issue', icon: '🗺️' },
    { id: 'custom', label: 'Other reason', icon: '✏️' },
  ];

  const selected = state.passengerForm.notCompletedReason;
  const canSubmit = selected && (selected !== 'custom' || customReason.trim().length > 0);

  return (
    <div className="space-y-4">
      <StepCard
        icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
        title="Why wasn't the ride completed?"
        subtitle="Help us understand what happened"
      >
        <div className="space-y-2.5 mt-5">
          {reasons.map((r) => (
            <button
              key={r.id}
              onClick={() => setPassengerNotCompletedReason(r.id, r.id === 'custom' ? customReason : undefined)}
              className={cn(
                'w-full p-3.5 rounded-xl text-left transition-all duration-200 border',
                selected === r.id
                  ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/10'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{r.icon}</span>
                <span className={cn('text-sm font-medium', selected === r.id ? 'text-white' : 'text-slate-300')}>
                  {r.label}
                </span>
                <div className={cn(
                  'ml-auto w-4 h-4 rounded-full border-2 transition-all',
                  selected === r.id ? 'bg-primary border-primary' : 'border-slate-600'
                )} />
              </div>
            </button>
          ))}
        </div>

        {selected === 'custom' && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <textarea
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                setPassengerNotCompletedReason('custom', e.target.value);
              }}
              placeholder="Describe what happened..."
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl
                text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/40
                transition-colors resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-[10px] text-slate-600 mt-1 text-right">{customReason.length}/500</p>
          </div>
        )}

        <button
          onClick={submitWorkflow}
          disabled={!canSubmit || state.submitting}
          className={cn(
            'w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
            canSubmit
              ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          )}
        >
          Submit & Complete
        </button>
      </StepCard>
    </div>
  );
}

// ============================================================================
// PASSENGER: PROVIDER RATING
// ============================================================================

function ProviderRatingStep() {
  const { currentWorkflow, state, setProviderRating, setProviderReview, submitWorkflow } = useRideCompletion();
  if (!currentWorkflow) return null;

  const rating = state.passengerForm.providerRating || 0;
  const review = state.passengerForm.providerReview || '';

  return (
    <div className="space-y-4">
      <StepCard
        icon={<Star className="w-5 h-5 text-yellow-400" />}
        title="Rate Your Provider"
        subtitle={`How was your ride with ${currentWorkflow.rideSummary.providerName}?`}
      >
        <div className="py-6 flex flex-col items-center">
          <div className="flex gap-3 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setProviderRating(star)}
                className="transition-transform duration-150 hover:scale-110 active:scale-95"
              >
                <Star
                  className={cn(
                    'w-10 h-10 sm:w-12 sm:h-12 transition-colors duration-200',
                    star <= rating
                      ? 'fill-yellow-400 text-yellow-400 drop-shadow-lg'
                      : 'text-slate-700 hover:text-slate-500'
                  )}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-primary font-semibold animate-in fade-in duration-200">
              {['', 'Poor', 'Needs Improvement', 'Good', 'Very Good', 'Excellent'][rating]}
            </p>
          )}
        </div>

        {rating > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <p className="text-xs font-semibold text-slate-300 mb-2">Add a review (optional)</p>
            <textarea
              value={review}
              onChange={(e) => setProviderReview(e.target.value)}
              placeholder="Share your experience..."
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl
                text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/30
                transition-colors resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-[10px] text-slate-600 mt-1 text-right">{review.length}/500</p>
          </div>
        )}

        <button
          onClick={submitWorkflow}
          disabled={rating === 0 || state.submitting}
          className={cn(
            'w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200',
            rating > 0
              ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.98]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          )}
        >
          {rating > 0 ? 'Submit & Complete' : 'Select a rating to continue'}
        </button>
      </StepCard>
    </div>
  );
}

// ============================================================================
// SUBMITTING STEP
// ============================================================================

function SubmittingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Submitting your response</h2>
      <p className="text-sm text-slate-400">Syncing data and updating analytics...</p>
    </div>
  );
}

// ============================================================================
// COMPLETE STEP
// ============================================================================

function CompleteStep() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center animate-in zoom-in duration-300">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2 animate-in fade-in duration-300 delay-100">
        Workflow Complete!
      </h2>
      <p className="text-sm text-slate-400 text-center max-w-xs animate-in fade-in duration-300 delay-200">
        Thank you for completing the ride workflow. Your feedback and analytics have been updated.
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 animate-in fade-in duration-300 delay-300">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Redirecting shortly...
      </div>
    </div>
  );
}

// ============================================================================
// SHARED UI COMPONENTS
// ============================================================================

function StepCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] rounded-2xl p-5 sm:p-7 shadow-xl shadow-black/20">
      <div className="flex items-start gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  icon,
  label,
  description,
  color,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: 'green' | 'red';
}) {
  const colors = {
    green: {
      active: 'bg-green-500/15 border-green-500/40 shadow-green-500/10',
      icon: 'bg-green-500 shadow-green-500/40',
      iconIdle: 'bg-green-500/15',
      radio: 'bg-green-500 border-green-500',
    },
    red: {
      active: 'bg-red-500/15 border-red-500/40 shadow-red-500/10',
      icon: 'bg-red-500 shadow-red-500/40',
      iconIdle: 'bg-red-500/15',
      radio: 'bg-red-500 border-red-500',
    },
  };

  const c = colors[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 sm:p-5 rounded-xl transition-all duration-200 text-left border-2 group',
        selected
          ? `${c.active} shadow-lg`
          : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
          selected ? `${c.icon} shadow-lg text-white` : `${c.iconIdle} text-slate-300`
        )}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white text-sm sm:text-base">{label}</p>
          <p className="text-slate-400 text-xs sm:text-sm">{description}</p>
        </div>
        <div className={cn(
          'w-5 h-5 rounded-full border-2 transition-all duration-200',
          selected ? c.radio : 'border-slate-600'
        )} />
      </div>
    </button>
  );
}
