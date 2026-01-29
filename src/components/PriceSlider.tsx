'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PriceSliderProps {
  min?: number;
  max?: number;
  step?: number;
  onChangeRange?: (min: number, max: number) => void;
  defaultMin?: number;
  defaultMax?: number;
}

export function PriceSlider({
  min = 0,
  max = 1000,
  step = 10,
  onChangeRange,
  defaultMin,
  defaultMax,
}: PriceSliderProps) {
  const [minVal, setMinVal] = useState(defaultMin ?? min);
  const [maxVal, setMaxVal] = useState(defaultMax ?? max);
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChangeRange?.(minVal, maxVal);
  }, [minVal, maxVal]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), maxVal - step);
    setMinVal(value);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), minVal + step);
    setMaxVal(value);
  };

  const minPercent = ((minVal - min) / (max - min)) * 100;
  const maxPercent = ((maxVal - min) / (max - min)) * 100;

  return (
    <div className="space-y-4">
      <div className="relative h-8">
        {/* Track background */}
        <div className="absolute w-full h-1 top-1/2 -translate-y-1/2 bg-slate-700 rounded-full" />

        {/* Active range highlight */}
        <div
          className="absolute h-1 top-1/2 -translate-y-1/2 bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-150"
          style={{
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
          }}
        />

        {/* Min slider */}
        <input
          ref={minInputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal}
          onChange={handleMinChange}
          className={cn(
            'absolute w-full h-1 top-1/2 -translate-y-1/2 appearance-none bg-transparent cursor-pointer',
            'pointer-events-none',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:shadow-lg',
            '[&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-150',
            '[&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:shadow-xl',
            '[&::-webkit-slider-thumb]:active:scale-95',
            '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:duration-150',
            '[&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:hover:shadow-xl'
          )}
          style={{ zIndex: minVal > max - (max - min) / 3 ? 5 : 3 }}
        />

        {/* Max slider */}
        <input
          ref={maxInputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          onChange={handleMaxChange}
          className={cn(
            'absolute w-full h-1 top-1/2 -translate-y-1/2 appearance-none bg-transparent cursor-pointer',
            'pointer-events-none',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:shadow-lg',
            '[&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-150',
            '[&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:hover:shadow-xl',
            '[&::-webkit-slider-thumb]:active:scale-95',
            '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0',
            '[&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:duration-150',
            '[&::-moz-range-thumb]:hover:scale-110 [&::-moz-range-thumb]:hover:shadow-xl'
          )}
          style={{ zIndex: 4 }}
        />
      </div>

      {/* Value display */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">₨</span>
          <input
            type="number"
            value={minVal}
            onChange={(e) => setMinVal(Math.min(Number(e.target.value), maxVal - step))}
            className={cn(
              'w-16 rounded px-2 py-1 bg-slate-800 border border-slate-700 text-white text-sm',
              'transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary'
            )}
          />
        </div>
        <span className="text-slate-400">—</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">₨</span>
          <input
            type="number"
            value={maxVal}
            onChange={(e) => setMaxVal(Math.max(Number(e.target.value), minVal + step))}
            className={cn(
              'w-16 rounded px-2 py-1 bg-slate-800 border border-slate-700 text-white text-sm',
              'transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary'
            )}
          />
        </div>
      </div>
    </div>
  );
}
