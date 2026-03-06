'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const POSTER_SESSION_KEY = 'campus_rides_poster_shown_session';

export default function MonthlyRewardPosterPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Only run on client side after mount
    setIsMounted(true);

    // Check if poster was already shown in this session
    const posterShown = sessionStorage.getItem(POSTER_SESSION_KEY);
    
    if (!posterShown) {
      // Mark poster as shown in this session
      sessionStorage.setItem(POSTER_SESSION_KEY, 'true');
      setIsVisible(true);
    }
  }, []);

  const closePoster = () => setIsVisible(false);

  // Handle backdrop click - only close if clicking on backdrop itself
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closePoster();
    }
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      {/* Backdrop - only closes when clicked directly */}
      <motion.div
        key="poster-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-[195] bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Centered Poster Container */}
      <motion.div
        key="monthly-reward-poster"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-3 xs:p-4 sm:p-5"
        aria-live="polite"
        style={{ pointerEvents: 'none' }}
      >
        <div className="relative w-full max-w-sm" style={{ pointerEvents: 'auto' }}>
          {/* Close Button */}
          <button
            type="button"
            onClick={closePoster}
            className="absolute -right-3 -top-3 xs:-right-2 xs:-top-2 sm:-right-4 sm:-top-4 z-10 inline-flex h-8 w-8 xs:h-9 xs:w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition hover:scale-105 hover:bg-black/90"
            aria-label="Close monthly reward poster"
          >
            <X className="h-4 w-4 xs:h-4.5 xs:w-4.5 sm:h-5 sm:w-5" />
          </button>

          {/* Poster Image Container */}
          <button
            type="button"
            onClick={closePoster}
            className="block w-full overflow-hidden rounded-xl xs:rounded-2xl sm:rounded-3xl border border-white/15 bg-slate-900/90 shadow-2xl ring-1 ring-black/30 transition hover:ring-white/20"
            aria-label="Close poster"
          >
            <div className="relative w-full bg-slate-950" style={{ aspectRatio: '3/4' }}>
              <Image
                src="/Monthly_Reward_Poster.png"
                alt="Monthly reward poster - top 5 ride providers and passengers with prizes"
                fill
                priority
                sizes="(max-width: 480px) 90vw, (max-width: 640px) 85vw, 420px"
                className="object-cover object-center"
                quality={95}
              />
            </div>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
