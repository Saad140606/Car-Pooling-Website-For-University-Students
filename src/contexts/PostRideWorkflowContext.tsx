'use client';

/**
 * Post-Ride Workflow Context
 * 
 * Manages post-ride workflow state throughout the app.
 * Provides:
 * - Current pending workflow display
 * - Workflow step navigation
 * - Form data management
 * - Completion actions
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { postRideManager } from '@/lib/postRideManager';
import type { PostRideWorkflowState, PendingPostRideWorkflow } from '@/types/postRideWorkflow';

interface PostRideContextType {
  // State
  state: PostRideWorkflowState;
  
  // Current workflow
  currentWorkflow: PendingPostRideWorkflow | null;
  hasPendingWorkflow: boolean;
  
  // Navigation
  goToStep: (step: 'outcome' | 'rating' | 'reason' | 'complete') => void;
  nextStep: () => void;
  previousStep: () => void;
  
  // Form data
  setFormData: (data: Partial<PostRideWorkflowState['formData']>) => void;
  updateFormData: (updates: Partial<PostRideWorkflowState['formData']>) => void;
  
  // Submission
  submitWorkflow: (workflowData: any) => Promise<void>;
  
  // Error handling
  clearError: () => void;
}

const PostRideContext = createContext<PostRideContextType | undefined>(undefined);

export function PostRideProvider({ children }: { children: React.ReactNode }) {
  const { user, initialized, data: userData } = useUser();
  const firestore = useFirestore();
  const [state, setState] = useState<PostRideWorkflowState>({
    currentWorkflow: null,
    pendingWorkflows: [],
    currentStep: 'outcome',
    formData: {},
    loading: false,
    submitting: false,
    error: null,
  });

  // Initialize post-ride manager
  useEffect(() => {
    if (!initialized || !firestore || !user?.uid) return;

    const university = user.university || userData?.university;
    if (!university) return;

    console.log('[PostRideContext] Initializing post-ride manager');
    postRideManager.initialize(firestore, user.uid, university);

    // Subscribe to workflow changes
    const unsubscribe = postRideManager.subscribe((workflows) => {
      console.log('[PostRideContext] Workflows updated:', workflows.length);
      setState((prev) => ({
        ...prev,
        pendingWorkflows: workflows,
        currentWorkflow: workflows[0] || null,
        currentStep: 'outcome', // Reset step when new workflow appears
        formData: {}, // Reset form data
        error: null,
      }));
    });

    // Get initial workflows
    const initialWorkflows = postRideManager.getPendingWorkflows();
    if (initialWorkflows.length > 0) {
      setState((prev) => ({
        ...prev,
        pendingWorkflows: initialWorkflows,
        currentWorkflow: initialWorkflows[0],
      }));
    }

    return () => {
      unsubscribe();
    };
  }, [user?.uid, user?.university, userData?.university, initialized, firestore]);

  // Cleanup on unmount or logout
  useEffect(() => {
    return () => {
      if (!user?.uid) {
        postRideManager.cleanup();
      }
    };
  }, [user?.uid]);

  const goToStep = useCallback((step: 'outcome' | 'rating' | 'reason' | 'complete') => {
    setState((prev) => ({
      ...prev,
      currentStep: step,
      error: null,
    }));
    console.log('[PostRideContext] Go to step:', step);
  }, []);

  const nextStep = useCallback(() => {
    const stepSequence: Array<'outcome' | 'rating' | 'reason' | 'complete'> = ['outcome', 'rating', 'reason', 'complete'];
    const currentIndex = stepSequence.indexOf(state.currentStep);
    
    if (currentIndex < stepSequence.length - 1) {
      goToStep(stepSequence[currentIndex + 1]);
    }
  }, [state.currentStep, goToStep]);

  const previousStep = useCallback(() => {
    const stepSequence: Array<'outcome' | 'rating' | 'reason' | 'complete'> = ['outcome', 'rating', 'reason', 'complete'];
    const currentIndex = stepSequence.indexOf(state.currentStep);
    
    if (currentIndex > 0) {
      goToStep(stepSequence[currentIndex - 1]);
    }
  }, [state.currentStep, goToStep]);

  const setFormData = useCallback((data: Partial<PostRideWorkflowState['formData']>) => {
    setState((prev) => ({
      ...prev,
      formData: data,
    }));
  }, []);

  const updateFormData = useCallback((updates: Partial<PostRideWorkflowState['formData']>) => {
    setState((prev) => ({
      ...prev,
      formData: {
        ...prev.formData,
        ...updates,
      },
    }));
  }, []);

  const submitWorkflow = useCallback(
    async (workflowData: any) => {
      if (!state.currentWorkflow) return;

      setState((prev) => ({
        ...prev,
        submitting: true,
        error: null,
      }));

      try {
        console.log('[PostRideContext] Submitting workflow:', {
          rideId: state.currentWorkflow.rideId,
          role: state.currentWorkflow.userRole,
        });

        await postRideManager.completeWorkflow(
          state.currentWorkflow.rideId,
          state.currentWorkflow.userRole,
          workflowData
        );

        console.log('[PostRideContext] Workflow submitted successfully');

        setState((prev) => ({
          ...prev,
          submitting: false,
          currentStep: 'complete',
        }));

        // Move to next workflow if available
        setTimeout(() => {
          const remaining = postRideManager.getPendingWorkflows();
          if (remaining.length > 0) {
            setState((prev) => ({
              ...prev,
              currentWorkflow: remaining[0],
              currentStep: 'outcome',
              formData: {},
            }));
          } else {
            // No more workflows
            setState((prev) => ({
              ...prev,
              currentWorkflow: null,
              formData: {},
            }));
          }
        }, 1500); // Show completion message briefly
      } catch (error) {
        console.error('[PostRideContext] Workflow submission failed:', error);
        setState((prev) => ({
          ...prev,
          submitting: false,
          error: error instanceof Error ? error.message : 'Failed to submit workflow',
        }));
        throw error;
      }
    },
    [state.currentWorkflow]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  const value: PostRideContextType = {
    state,
    currentWorkflow: state.currentWorkflow,
    hasPendingWorkflow: state.currentWorkflow !== null,
    goToStep,
    nextStep,
    previousStep,
    setFormData,
    updateFormData,
    submitWorkflow,
    clearError,
  };

  return (
    <PostRideContext.Provider value={value}>
      {children}
    </PostRideContext.Provider>
  );
}

/**
 * Hook to use post-ride context
 */
export function usePostRideWorkflow() {
  const context = useContext(PostRideContext);
  if (!context) {
    throw new Error(
      'usePostRideWorkflow must be used within PostRideProvider'
    );
  }
  return context;
}
