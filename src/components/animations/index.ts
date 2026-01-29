/**
 * Premium Animation System
 * Provides smooth, reusable motion and micro-interaction utilities
 */

export const animationVariants = {
  // Page transitions
  pageEnter: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  
  // Smooth fade
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.3 },
  },
  
  fadeOut: {
    initial: { opacity: 1 },
    animate: { opacity: 0 },
    transition: { duration: 0.3 },
  },

  // Slide in from sides
  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },

  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },

  slideInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },

  // Smooth scale
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Stagger children
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  },

  staggerItem: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  },

  // Modal animations
  modalEnter: {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },

  // Dropdown animations
  dropdownEnter: {
    initial: { opacity: 0, y: -10, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.95 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },

  // Loading animations
  shimmer: {
    initial: { backgroundPosition: '-1000px 0' },
    animate: { backgroundPosition: '1000px 0' },
    transition: { duration: 2, repeat: Infinity, ease: 'linear' },
  },

  pulse: {
    initial: { opacity: 0.6 },
    animate: { opacity: 1 },
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
  },
};

// CSS animation classes for Tailwind
export const animationClasses = {
  // Smooth transitions
  smoothTransition: 'transition-all duration-300 ease-out',
  fastTransition: 'transition-all duration-150 ease-out',
  slowTransition: 'transition-all duration-500 ease-out',

  // Hover effects
  liftHover: 'hover:scale-105 hover:shadow-lg transition-all duration-300',
  shadowHover: 'hover:shadow-xl transition-shadow duration-300',
  brightHover: 'hover:brightness-110 transition-all duration-300',

  // Focus states
  focusRing: 'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
  
  // Active states
  activePress: 'active:scale-95 active:shadow-md',

  // Disabled states
  disabledOpacity: 'disabled:opacity-50 disabled:cursor-not-allowed',
};

// Spring animations for organic motion
export const springConfig = {
  gentle: { type: 'spring', damping: 20, stiffness: 100, mass: 1 },
  bouncy: { type: 'spring', damping: 12, stiffness: 100, mass: 1 },
  smooth: { type: 'spring', damping: 25, stiffness: 120, mass: 1 },
};

// Easing functions
export const easeConfig = {
  easeOut: [0.0, 0.0, 0.2, 1],
  easeInOut: [0.4, 0.0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
};
