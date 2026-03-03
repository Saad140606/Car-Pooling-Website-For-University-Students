'use client';

import React from 'react';
import { useToast } from '@/hooks/use-toast';

type ToastVariant = 'default' | 'destructive';

export function useActionFeedback() {
  const { toast } = useToast();
  const activeToastRef = React.useRef<{
    dismiss: () => void;
    update: (props: any) => void;
  } | null>(null);

  const start = React.useCallback((description: string, title = 'Please wait...') => {
    if (activeToastRef.current) {
      activeToastRef.current.update({
        title,
        description,
        variant: 'default',
        open: true,
      });
      return;
    }

    activeToastRef.current = toast({
      title,
      description,
      variant: 'default',
      open: true,
    });
  }, [toast]);

  const update = React.useCallback((description: string, title = 'Please wait...', variant: ToastVariant = 'default') => {
    if (!activeToastRef.current) {
      activeToastRef.current = toast({ title, description, variant, open: true });
      return;
    }

    activeToastRef.current.update({
      title,
      description,
      variant,
      open: true,
    });
  }, [toast]);

  const clear = React.useCallback(() => {
    if (activeToastRef.current) {
      activeToastRef.current.dismiss();
      activeToastRef.current = null;
    }
  }, []);

  return {
    start,
    update,
    clear,
  };
}
