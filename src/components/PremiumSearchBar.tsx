'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, MapPin, Clock, X } from 'lucide-react';
import { animationClasses } from '@/components/animations';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'location' | 'recent' | 'university';
  icon?: React.ReactNode;
}

interface PremiumSearchProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  onSelect: (suggestion: SearchSuggestion) => void;
  suggestions?: SearchSuggestion[];
  loading?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function PremiumSearchBar({
  placeholder = 'Search locations...',
  onSearch,
  onSelect,
  suggestions = [],
  loading = false,
  onFocus,
  onBlur,
}: PremiumSearchProps) {
  const [value, setValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setSelectedIndex(-1);
    if (newValue.trim()) {
      onSearch(newValue);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (suggestion: SearchSuggestion) => {
    setValue(suggestion.text);
    onSelect(suggestion);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    setValue('');
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsOpen(value.length > 0);
            onFocus?.();
          }}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 150);
            onBlur?.();
          }}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-10 text-white placeholder:text-slate-400',
            'transition-all duration-200 ease-out',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-950',
            'hover:border-slate-600 hover:bg-slate-850'
          )}
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className={cn(
            'absolute top-full left-0 right-0 z-50 mt-2 rounded-lg border border-slate-700 bg-slate-900 shadow-xl',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200',
            'max-h-80 overflow-y-auto'
          )}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => handleSelect(suggestion)}
              className={cn(
                'w-full text-left px-4 py-3 transition-colors duration-150 ease-out',
                'flex items-center gap-3 border-b border-slate-800 last:border-b-0',
                index === selectedIndex
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              )}
            >
              {suggestion.type === 'location' && (
                <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
              )}
              {suggestion.type === 'recent' && (
                <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
              )}
              {suggestion.icon && <span className="text-slate-400">{suggestion.icon}</span>}
              <span className="flex-1 truncate">{suggestion.text}</span>
            </button>
          ))}
        </div>
      )}

      {loading && value && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-lg border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm text-slate-400">Searching...</span>
          </div>
        </div>
      )}
    </div>
  );
}
