'use client';

import React from 'react';
import { Star, Loader2, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

type PromptType = 'first_ride' | 'app';

interface PromptPayload {
  firstRide: {
    shouldShow: boolean;
  };
  appFeedback: {
    shouldShow: boolean;
  };
}

const FIRST_RIDE_CATEGORIES = ['Safety', 'Punctuality', 'Ride Comfort', 'Driver/Passenger Behavior', 'Other'];
const APP_FEEDBACK_CATEGORIES = ['App UI', 'Performance', 'Bugs', 'Feature Request', 'Other'];

export default function FeedbackPromptsManager() {
  const { user, data: userData } = useUser();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [activePrompt, setActivePrompt] = React.useState<PromptType | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [hoveredRating, setHoveredRating] = React.useState(0);
  const [category, setCategory] = React.useState('');
  const [comment, setComment] = React.useState('');

  const firstRideDismissedKey = React.useMemo(() => {
    if (!user?.uid || !userData?.university) return null;
    return `feedback:first_ride:dismissed:${user.uid}:${userData.university}`;
  }, [user?.uid, userData?.university]);

  const isFirstRideDismissedLocally = React.useCallback(() => {
    if (typeof window === 'undefined' || !firstRideDismissedKey) return false;
    return localStorage.getItem(firstRideDismissedKey) === '1';
  }, [firstRideDismissedKey]);

  const markFirstRideDismissedLocally = React.useCallback(() => {
    if (typeof window === 'undefined' || !firstRideDismissedKey) return;
    localStorage.setItem(firstRideDismissedKey, '1');
  }, [firstRideDismissedKey]);

  const fetchPrompts = React.useCallback(async () => {
    if (!user || !userData?.university) return;

    try {
      setIsLoading(true);
      const token = await user.getIdToken(true);
      if (!token) return;

      const response = await fetch(`/api/feedback/prompts?university=${encodeURIComponent(userData.university)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!data?.success) {
        setOpen(false);
        setActivePrompt(null);
        return;
      }

      const prompts = data.prompts as PromptPayload;
      if (prompts.firstRide.shouldShow) {
        if (isFirstRideDismissedLocally()) {
          setOpen(false);
          setActivePrompt(null);
          return;
        }
        setActivePrompt('first_ride');
        setOpen(true);
        return;
      }

      if (prompts.appFeedback.shouldShow) {
        setActivePrompt('app');
        setOpen(true);

        await fetch('/api/feedback/mark-shown', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ university: userData.university }),
        });
        return;
      }

      setOpen(false);
      setActivePrompt(null);
    } catch (error) {
      console.error('[FeedbackPromptsManager] Failed to fetch prompts:', error);
      setOpen(false);
      setActivePrompt(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, userData?.university, isFirstRideDismissedLocally]);

  React.useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const currentCategories = activePrompt === 'first_ride' ? FIRST_RIDE_CATEGORIES : APP_FEEDBACK_CATEGORIES;

  const resetForm = () => {
    setRating(0);
    setHoveredRating(0);
    setCategory('');
    setComment('');
  };

  const handleSubmit = async () => {
    if (!user || !userData?.university || !activePrompt) return;
    if (rating < 1 || !category) {
      toast({
        variant: 'destructive',
        title: 'Missing feedback details',
        description: 'Please select a rating and category before submitting.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const token = await user.getIdToken(true);
      if (!token) throw new Error('Authentication required');

      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: activePrompt,
          university: userData.university,
          rating,
          category,
          comment,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to submit feedback');
      }

      toast({
        title: 'Feedback submitted',
        description: 'Thank you for helping improve Campus Ride.',
      });

      if (activePrompt === 'first_ride') {
        markFirstRideDismissedLocally();
      }

      resetForm();
      setOpen(false);
      setActivePrompt(null);
    } catch (error: any) {
      console.error('[FeedbackPromptsManager] Submit failed:', error);
      toast({
        variant: 'destructive',
        title: 'Submit failed',
        description: error?.message || 'Could not submit feedback right now.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async (options?: { silent?: boolean }) => {
    if (!user || !userData?.university || !activePrompt) return;

    try {
      setIsSubmitting(true);
      const token = await user.getIdToken(true);
      if (!token) throw new Error('Authentication required');

      const response = await fetch('/api/feedback/skip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: activePrompt,
          university: userData.university,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to skip prompt');
      }

      if (activePrompt === 'first_ride') {
        markFirstRideDismissedLocally();
      }

      resetForm();
      setOpen(false);
      setActivePrompt(null);
    } catch (error: any) {
      console.error('[FeedbackPromptsManager] Skip failed:', error);
      if (!options?.silent) {
        toast({
          variant: 'destructive',
          title: 'Action failed',
          description: error?.message || 'Could not process your action right now.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogOpenChange = React.useCallback(async (nextOpen: boolean) => {
    if (nextOpen || isSubmitting || !activePrompt) return;

    if (activePrompt === 'first_ride') {
      await handleSkip({ silent: true });
      return;
    }

    resetForm();
    setOpen(false);
    setActivePrompt(null);
  }, [isSubmitting, activePrompt]);

  if (isLoading || !activePrompt || !open) return null;

  const title = activePrompt === 'first_ride' ? 'Tell us about your first completed ride' : 'How is your app experience so far?';
  const description =
    activePrompt === 'first_ride'
      ? 'This one-time feedback helps us improve first-ride quality and trust.'
      : 'Quick app feedback appears every few days until submitted, so we can continuously improve.';

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="bg-slate-950 border-slate-800 text-white max-w-lg"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MessageSquare className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-300 mb-2">Rating</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((starValue) => (
                <button
                  key={starValue}
                  type="button"
                  className="p-1 rounded-md"
                  onMouseEnter={() => setHoveredRating(starValue)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(starValue)}
                  disabled={isSubmitting}
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      starValue <= (hoveredRating || rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-300 mb-2">Category</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentCategories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  disabled={isSubmitting}
                  className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                    category === item
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-slate-300 mb-2">Comments (optional)</p>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              placeholder="Share your feedback..."
              className="bg-slate-900 border-slate-700 text-white"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => void handleSkip()} disabled={isSubmitting}>
            {activePrompt === 'first_ride' ? 'Skip' : 'Remind Me Later'}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || rating < 1 || !category}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Feedback'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
