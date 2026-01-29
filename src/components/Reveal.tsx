"use client";

import React, { useEffect, useRef, useState, CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
  style?: CSSProperties;
};

/**
 * Lightweight intersection observer wrapper that adds a reveal-visible class
 * when the element enters the viewport. Keeps animations subtle and reusable.
 */
export function Reveal({ children, className, delay = 0, as: Component = 'div', style }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const customStyle: CSSProperties = {
    ...style,
    ['--reveal-delay' as any]: `${delay}ms`,
  };

  return React.createElement(
    Component as any,
    {
      ref: ref as any,
      className: cn('reveal', visible && 'reveal-visible', className),
      style: customStyle,
    },
    children
  );
}
