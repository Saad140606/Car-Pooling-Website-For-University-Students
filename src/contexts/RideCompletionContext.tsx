'use client';

/**
 * Ride Completion Workflow Context
 * 
 * Manages the full ride completion workflow state:
 * - Detects pending workflows via RideCompletionManager
 * - Multi-step navigation for provider and passenger flows
 * - Form state management with local draft persistence
 * - Submission handling with analytics sync
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { rideCompletionManager } from '@/lib/rideCompletionManager';
import type {
  PendingCompletionWorkflow,
  CompletionWorkflowState,
  WorkflowStep,
  ProviderFormData,
  PassengerFormData,
  PassengerAttendanceRecord,
  PassengerArrivalStatus,
  PassengerNotArrivedReason,
  ProviderNotCompletedReason,
  PassengerNotCompletedReason,
} from '@/types/rideCompletion';
import { createDefaultProviderForm, createDefaultPassengerForm } from '@/types/rideCompletion';

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface RideCompletionContextType {
  // State
  state: CompletionWorkflowState;
  hasActiveWorkflow: boolean;
  currentWorkflow: PendingCompletionWorkflow | null;

  // Navigation
  goToStep: (step: WorkflowStep) => void;
  goBack: () => void;

  // Provider form actions
  setProviderDecision: (completed: boolean) => void;
  setProviderNotCompletedReason: (reason: ProviderNotCompletedReason, custom?: string) => void;
  setPassengerAttendance: (passengerId: string, status: PassengerArrivalStatus) => void;
  setPassengerRating: (passengerId: string, rating: number) => void;
  setPassengerReview: (passengerId: string, review: string) => void;
  setNotArrivedReason: (passengerId: string, reason: PassengerNotArrivedReason, custom?: string) => void;
  getArrivedPassengers: () => string[];
  getNotArrivedPassengers: () => string[];
  setCurrentPassengerIndex: (index: number) => void;

  // Passenger form actions
  setPassengerDecision: (completed: boolean) => void;
  setPassengerNotCompletedReason: (reason: PassengerNotCompletedReason, custom?: string) => void;
  setProviderRating: (rating: number) => void;
  setProviderReview: (review: string) => void;

  // Submission
  submitWorkflow: () => Promise<void>;
  clearError: () => void;
}

const RideCompletionContext = createContext<RideCompletionContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function RideCompletionProvider({ children }: { children: React.ReactNode }) {
  const { user, initialized, data: userData } = useUser();
  const firestore = useFirestore();
  const initRef = useRef(false);

  const [state, setState] = useState<CompletionWorkflowState>({
    currentWorkflow: null,
    allPendingWorkflows: [],
    currentStep: 'summary',
    providerForm: createDefaultProviderForm(),
    passengerForm: createDefaultPassengerForm(),
    loading: false,
    submitting: false,
    error: null,
    currentPassengerIndex: 0,
  });

  // Initialize manager
  useEffect(() => {
    if (!initialized || !firestore || !user?.uid) return;
    const university = user.university || userData?.university;
    if (!university) return;

    // Prevent double init
    if (initRef.current) return;
    initRef.current = true;

    rideCompletionManager.initialize(firestore, user.uid, university);

    const unsubscribe = rideCompletionManager.subscribe((workflows) => {
      setState(prev => {
        // If we already have a current workflow, keep it unless it's been removed
        const currentStillExists = prev.currentWorkflow
          ? workflows.some(w => w.oderId === prev.currentWorkflow?.oderId)
          : false;

        const newCurrent = currentStillExists
          ? prev.currentWorkflow
          : workflows[0] || null;

        // Restore form draft if switching to a new workflow
        let providerForm = prev.providerForm;
        let passengerForm = prev.passengerForm;

        if (newCurrent && newCurrent.oderId !== prev.currentWorkflow?.oderId) {
          const draft = rideCompletionManager.loadFormDraft(
            newCurrent.rideId,
            newCurrent.userRole
          );
          if (draft) {
            if (newCurrent.userRole === 'provider') {
              providerForm = draft as ProviderFormData;
            } else {
              passengerForm = draft as PassengerFormData;
            }
          } else {
            providerForm = createDefaultProviderForm();
            passengerForm = createDefaultPassengerForm();
          }
        }

        return {
          ...prev,
          allPendingWorkflows: workflows,
          currentWorkflow: newCurrent,
          providerForm,
          passengerForm,
          currentStep: newCurrent && newCurrent.oderId !== prev.currentWorkflow?.oderId ? 'summary' : prev.currentStep,
          currentPassengerIndex: 0,
        };
      });
    });

    // Get initial workflows
    const initial = rideCompletionManager.getPendingWorkflows();
    if (initial.length > 0) {
      setState(prev => ({
        ...prev,
        allPendingWorkflows: initial,
        currentWorkflow: initial[0],
        currentStep: 'summary',
      }));
    }

    return () => {
      unsubscribe();
      initRef.current = false;
    };
  }, [user?.uid, user?.university, userData?.university, initialized, firestore]);

  // Cleanup on logout
  useEffect(() => {
    return () => {
      if (!user?.uid) {
        rideCompletionManager.cleanup();
      }
    };
  }, [user?.uid]);

  // ============================================================================
  // NAVIGATION
  // ============================================================================

  const goToStep = useCallback((step: WorkflowStep) => {
    setState(prev => ({ ...prev, currentStep: step, error: null }));
  }, []);

  const goBack = useCallback(() => {
    setState(prev => {
      const workflow = prev.currentWorkflow;
      if (!workflow) return prev;

      const isProvider = workflow.userRole === 'provider';
      const step = prev.currentStep;

      let prevStep: WorkflowStep = 'summary';

      if (isProvider) {
        const flow: WorkflowStep[] = ['summary', 'decision'];
        if (prev.providerForm.rideCompleted === false) {
          flow.push('not_completed_reason');
        } else if (prev.providerForm.rideCompleted === true) {
          flow.push('passenger_attendance', 'passenger_feedback', 'not_arrived_reasons');
        }

        const idx = flow.indexOf(step);
        prevStep = idx > 0 ? flow[idx - 1] : flow[0];
      } else {
        const flow: WorkflowStep[] = ['summary', 'decision'];
        if (prev.passengerForm.rideCompleted === false) {
          flow.push('not_completed_reason');
        } else if (prev.passengerForm.rideCompleted === true) {
          flow.push('provider_rating');
        }

        const idx = flow.indexOf(step);
        prevStep = idx > 0 ? flow[idx - 1] : flow[0];
      }

      return { ...prev, currentStep: prevStep, error: null };
    });
  }, []);

  // ============================================================================
  // PROVIDER FORM ACTIONS
  // ============================================================================

  const setProviderDecision = useCallback((completed: boolean) => {
    setState(prev => {
      const form = { ...prev.providerForm, rideCompleted: completed };
      if (prev.currentWorkflow) {
        rideCompletionManager.saveFormDraft(prev.currentWorkflow.rideId, 'provider', form);
      }
      return {
        ...prev,
        providerForm: form,
        currentStep: completed ? 'passenger_attendance' : 'not_completed_reason',
      };
    });
  }, []);

  const setProviderNotCompletedReason = useCallback((reason: ProviderNotCompletedReason, custom?: string) => {
    setState(prev => {
      const form = {
        ...prev.providerForm,
        notCompletedReason: reason,
        notCompletedReasonCustom: custom || '',
      };
      if (prev.currentWorkflow) {
        rideCompletionManager.saveFormDraft(prev.currentWorkflow.rideId, 'provider', form);
      }
      return { ...prev, providerForm: form };
    });
  }, []);

  const setPassengerAttendance = useCallback((passengerId: string, status: PassengerArrivalStatus) => {
    setState(prev => {
      const workflow = prev.currentWorkflow;
      if (!workflow) return prev;

      const passenger = workflow.confirmedPassengers.find(p => p.id === passengerId);
      if (!passenger) return prev;

      const record: PassengerAttendanceRecord = {
        passengerId,
        passengerName: passenger.name,
        pickupLocation: passenger.pickupLocation,
        arrivalStatus: status,
      };

      const form = {
        ...prev.providerForm,
        attendanceRecords: {
          ...prev.providerForm.attendanceRecords,
          [passengerId]: record,
        },
      };

      rideCompletionManager.saveFormDraft(workflow.rideId, 'provider', form);
      return { ...prev, providerForm: form };
    });
  }, []);

  const setPassengerRating = useCallback((passengerId: string, rating: number) => {
    setState(prev => {
      const form = {
        ...prev.providerForm,
        passengerRatings: { ...prev.providerForm.passengerRatings, [passengerId]: rating },
      };
      if (prev.currentWorkflow) {
        rideCompletionManager.saveFormDraft(prev.currentWorkflow.rideId, 'provider', form);
      }
      return { ...prev, providerForm: form };
    });
  }, []);

  const setPassengerReview = useCallback((passengerId: string, review: string) => {
    setState(prev => {
      const form = {
        ...prev.providerForm,
        passengerReviews: { ...prev.providerForm.passengerReviews, [passengerId]: review },
      };
      if (prev.currentWorkflow) {
        rideCompletionManager.saveFormDraft(prev.currentWorkflow.rideId, 'provider', form);
      }
      return { ...prev, providerForm: form };
    });
  }, []);

  const setNotArrivedReason = useCallback((passengerId: string, reason: PassengerNotArrivedReason, custom?: string) => {
    setState(prev => {
      const form = {
        ...prev.providerForm,
        notArrivedReasons: { ...prev.providerForm.notArrivedReasons, [passengerId]: reason },
        notArrivedReasonsCustom: { ...prev.providerForm.notArrivedReasonsCustom, [passengerId]: custom || '' },
      };
      if (prev.currentWorkflow) {
        rideCompletionManager.saveFormDraft(prev.currentWorkflow.rideId, 'provider', form);
      }
      return { ...prev, providerForm: form };
    });
  }, []);

  const getArrivedPassengers = useCallback((): string[] => {
    return Object.entries(state.providerForm.attendanceRecords)
      .filter(([, r]) => r.arrivalStatus === 'arrived')
      .map(([id]) => id);
  }, [state.providerForm.attendanceRecords]);

  const getNotArrivedPassengers = useCallback((): string[] => {
    return Object.entries(state.providerForm.attendanceRecords)
      .filter(([, r]) => r.arrivalStatus === 'did_not_arrive')
      .map(([id]) => id);
  }, [state.providerForm.attendanceRecords]);

  const setCurrentPassengerIndex = useCallback((index: number) => {
    setState(prev => ({ ...prev, currentPassengerIndex: index }));
  }, []);

  // ============================================================================
  // PASSENGER FORM ACTIONS
  // ============================================================================

  const setPassengerDecision = useCallback((completed: boolean) => {
    setState(prev => {
      const form = { ...prev.passengerForm, rideCompleted: completed };
      if (prev.currentWorkflow) {
        rideCompletionManager.saveFormDraft(prev.currentWorkflow.rideId, 'passenger', form);
      }
      return {
        ...prev,
        passengerForm: form,
        currentStep: completed ? 'provider_rating' : 'not_completed_reason',
      };
    });
  }, []);

  const setPassengerNotCompletedReason = useCallback((reason: PassengerNotCompletedReason, custom?: string) => {
    setState(prev => {
      const form = {
        ...prev.passengerForm,
        notCompletedReason: reason,
        notCompletedReasonCustom: custom || '',
      };
      if (prev.currentWorkflow) {
        rideCompletionManager.saveFormDraft(prev.currentWorkflow.rideId, 'passenger', form);
      }
      return { ...prev, passengerForm: form };
    });
  }, []);

  const setProviderRating = useCallback((rating: number) => {
    setState(prev => {
      const form = { ...prev.passengerForm, providerRating: rating };
      if (prev.currentWorkflow) {
        rideCompletionManager.saveFormDraft(prev.currentWorkflow.rideId, 'passenger', form);
      }
      return { ...prev, passengerForm: form };
    });
  }, []);

  const setProviderReview = useCallback((review: string) => {
    setState(prev => {
      const form = { ...prev.passengerForm, providerReview: review };
      if (prev.currentWorkflow) {
        rideCompletionManager.saveFormDraft(prev.currentWorkflow.rideId, 'passenger', form);
      }
      return { ...prev, passengerForm: form };
    });
  }, []);

  // ============================================================================
  // SUBMISSION
  // ============================================================================

  const submitWorkflow = useCallback(async () => {
    const workflow = state.currentWorkflow;
    if (!workflow) return;

    setState(prev => ({ ...prev, submitting: true, error: null, currentStep: 'submitting' }));

    try {
      if (workflow.userRole === 'provider') {
        await rideCompletionManager.submitProviderWorkflow(workflow.rideId, state.providerForm);
      } else {
        await rideCompletionManager.submitPassengerWorkflow(workflow.rideId, state.passengerForm);
      }

      setState(prev => ({
        ...prev,
        submitting: false,
        currentStep: 'complete',
      }));

      // Auto-advance to next workflow after brief delay
      setTimeout(() => {
        setState(prev => {
          const remaining = rideCompletionManager.getPendingWorkflows();
          if (remaining.length > 0) {
            return {
              ...prev,
              currentWorkflow: remaining[0],
              allPendingWorkflows: remaining,
              currentStep: 'summary',
              providerForm: createDefaultProviderForm(),
              passengerForm: createDefaultPassengerForm(),
              currentPassengerIndex: 0,
            };
          }
          return {
            ...prev,
            currentWorkflow: null,
            allPendingWorkflows: [],
            providerForm: createDefaultProviderForm(),
            passengerForm: createDefaultPassengerForm(),
          };
        });
      }, 2000);
    } catch (error) {
      console.error('[RideCompletionContext] Submission error:', error);
      setState(prev => ({
        ...prev,
        submitting: false,
        currentStep: prev.currentWorkflow?.userRole === 'provider' ? 'decision' : 'decision',
        error: error instanceof Error ? error.message : 'Failed to submit. Please try again.',
      }));
    }
  }, [state.currentWorkflow, state.providerForm, state.passengerForm]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: RideCompletionContextType = {
    state,
    hasActiveWorkflow: state.currentWorkflow !== null,
    currentWorkflow: state.currentWorkflow,
    goToStep,
    goBack,
    setProviderDecision,
    setProviderNotCompletedReason,
    setPassengerAttendance,
    setPassengerRating,
    setPassengerReview,
    setNotArrivedReason,
    getArrivedPassengers,
    getNotArrivedPassengers,
    setCurrentPassengerIndex,
    setPassengerDecision,
    setPassengerNotCompletedReason,
    setProviderRating,
    setProviderReview,
    submitWorkflow,
    clearError,
  };

  return (
    <RideCompletionContext.Provider value={value}>
      {children}
    </RideCompletionContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useRideCompletion() {
  const context = useContext(RideCompletionContext);
  if (!context) {
    throw new Error('useRideCompletion must be used within RideCompletionProvider');
  }
  return context;
}
