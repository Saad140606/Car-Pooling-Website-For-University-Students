'use client';

import React, { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Star, Heart, ThumbsUp } from 'lucide-react';

/**
 * Star Rating - Interactive star rating component
 */
interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
  showLabel?: boolean;
  className?: string;
}

const SizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export const StarRating = React.forwardRef<HTMLDivElement, StarRatingProps>(
  (
    {
      value,
      onChange,
      max = 5,
      size = 'md',
      readonly = false,
      showLabel = true,
      className,
    },
    ref
  ) => {
    const [hoverValue, setHoverValue] = useState<number | null>(null);

    const displayValue = hoverValue ?? value;

    return (
      <div ref={ref} className={cn('flex items-center gap-2', className)}>
        <div className="flex items-center gap-1">
          {Array.from({ length: max }).map((_, idx) => {
            const starValue = idx + 1;
            const isFilled = starValue <= displayValue;

            return (
              <button
                key={idx}
                onMouseEnter={() => !readonly && setHoverValue(starValue)}
                onMouseLeave={() => setHoverValue(null)}
                onClick={() => !readonly && onChange?.(starValue)}
                disabled={readonly}
                className={cn(
                  'transition-all duration-200 relative',
                  !readonly && 'cursor-pointer hover:scale-110 active:scale-95',
                  readonly && 'cursor-default'
                )}
              >
                <Star
                  className={cn(
                    SizeClasses[size],
                    'transition-all duration-200',
                    isFilled
                      ? 'fill-amber-400 text-amber-400 animate-scale-up'
                      : 'text-muted-foreground/30'
                  )}
                />
              </button>
            );
          })}
        </div>

        {showLabel && (
          <span className="text-sm font-medium text-muted-foreground">
            {displayValue.toFixed(1)}/{max}
          </span>
        )}
      </div>
    );
  }
);

StarRating.displayName = 'StarRating';

/**
 * Review Card - Display a user review
 */
interface ReviewCardProps {
  author: {
    name: string;
    avatar?: string;
    initials?: string;
    badge?: string;
  };
  rating: number;
  title?: string;
  content: string;
  date: string;
  helpful?: boolean;
  onHelpful?: (helpful: boolean) => void;
  verified?: boolean;
  className?: string;
}

export const ReviewCard = React.forwardRef<HTMLDivElement, ReviewCardProps>(
  (
    {
      author,
      rating,
      title,
      content,
      date,
      helpful,
      onHelpful,
      verified,
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border-2 border-border/20 bg-card/50 backdrop-blur-sm p-4 space-y-3',
          'hover:border-primary/30 transition-all duration-300 animate-slide-in-left',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {author.avatar ? (
              <img
                src={author.avatar}
                alt={author.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center font-semibold text-sm">
                {author.initials || author.name[0]}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-foreground">{author.name}</h4>
                {author.badge && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {author.badge}
                  </span>
                )}
                {verified && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
            </div>
          </div>

          <StarRating value={rating} readonly size="sm" showLabel={false} />
        </div>

        {/* Content */}
        {title && (
          <h5 className="font-semibold text-foreground">{title}</h5>
        )}
        <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>

        {/* Footer - Helpful */}
        {onHelpful && (
          <div className="pt-2 border-t border-border/10 flex items-center gap-4">
            <span className="text-xs text-muted-foreground">Was this helpful?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onHelpful(true)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  helpful === true
                    ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                    : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                )}
              >
                👍 Yes
              </button>
              <button
                onClick={() => onHelpful(false)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  helpful === false
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
                )}
              >
                👎 No
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ReviewCard.displayName = 'ReviewCard';

/**
 * Review List - Display multiple reviews with sorting
 */
interface ReviewListProps {
  reviews: ReviewCardProps[];
  sortBy?: 'recent' | 'helpful' | 'rating-high' | 'rating-low';
  onSortChange?: (sort: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export const ReviewList = React.forwardRef<HTMLDivElement, ReviewListProps>(
  (
    {
      reviews,
      sortBy = 'recent',
      onSortChange,
      isLoading,
      emptyMessage = 'No reviews yet',
      className,
    },
    ref
  ) => {
    const sortOptions = [
      { value: 'recent', label: 'Most Recent' },
      { value: 'helpful', label: 'Most Helpful' },
      { value: 'rating-high', label: 'Highest Rating' },
      { value: 'rating-low', label: 'Lowest Rating' },
    ];

    return (
      <div ref={ref} className={cn('space-y-4', className)}>
        {/* Sort Controls */}
        {reviews.length > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/20 bg-muted/5">
            <span className="text-sm font-medium text-muted-foreground">
              {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
            </span>
            <select
              value={sortBy}
              onChange={(e) => onSortChange?.(e.target.value)}
              className={cn(
                'text-sm rounded-lg border border-border/30 bg-card px-3 py-1.5',
                'text-foreground transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reviews */}
        {isLoading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-32 bg-gradient-to-r from-muted/20 to-muted/10 rounded-2xl animate-shimmer"
            />
          ))
        ) : reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((review, idx) => (
              <ReviewCard
                key={idx}
                {...review}
                className={`animate-slide-in-left`}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Star className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        )}
      </div>
    );
  }
);

ReviewList.displayName = 'ReviewList';

/**
 * Reaction - Quick reaction buttons
 */
interface ReactionProps {
  onReact: (reaction: string) => void;
  size?: 'sm' | 'md' | 'lg';
  reactions?: Array<{ emoji: string; label: string }>;
  className?: string;
}

const DEFAULT_REACTIONS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Funny' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😠', label: 'Angry' },
];

const ReactionSizes = {
  sm: 'h-8 w-8 text-lg',
  md: 'h-10 w-10 text-xl',
  lg: 'h-12 w-12 text-2xl',
};

export const Reaction = React.forwardRef<HTMLDivElement, ReactionProps>(
  (
    {
      onReact,
      size = 'md',
      reactions = DEFAULT_REACTIONS,
      className,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-2 p-2 bg-card border-2 border-border/20 rounded-2xl',
          'animate-bounce-in',
          className
        )}
      >
        {reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            onClick={() => onReact(reaction.emoji)}
            title={reaction.label}
            className={cn(
              ReactionSizes[size],
              'rounded-lg flex items-center justify-center',
              'transition-all duration-200',
              'hover:bg-primary/20 hover:scale-125',
              'active:scale-95'
            )}
          >
            {reaction.emoji}
          </button>
        ))}
      </div>
    );
  }
);

Reaction.displayName = 'Reaction';
