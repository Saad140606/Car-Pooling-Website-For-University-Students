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

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const closePoster = () => setIsVisible(false);

    // Close the popup when user clicks anywhere on the site.
    window.addEventListener('pointerdown', closePoster, true);
    return () => {
      window.removeEventListener('pointerdown', closePoster, true);
    };
  }, [isVisible]);

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="poster-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
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
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 lg:p-8"
        aria-live="polite"
      >
        <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-2xl">
          {/* Close Button */}
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="absolute -right-3 -top-3 sm:-right-4 sm:-top-4 z-10 inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition hover:scale-105 hover:bg-black/90"
            aria-label="Close monthly reward poster"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          {/* Poster Image */}
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            className="block w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-white/15 bg-slate-900/90 shadow-2xl ring-1 ring-black/30 transition hover:ring-white/20"
            aria-label="Close poster"
          >
            <div className="relative w-full aspect-[3/4]">
              <Image
                src="/Monthly_Reward_Poster.png"
                alt="Monthly reward poster"
                fill
                priority
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 100vw"
                className="object-cover"
              />
            </div>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
