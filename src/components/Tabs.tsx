'use client';

import React, { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  onTabChange?: (tabId: string) => void; // compatibility alias
  activeTab?: string; // controlled value support
  variant?: 'default' | 'minimal' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      tabs,
      defaultTab,
      onChange,
      onTabChange,
      activeTab,
      variant = 'default',
      size = 'md',
      className,
    },
    ref
  ) => {
    const [internalActive, setInternalActive] = useState(defaultTab || tabs[0]?.id);

    const currentTab = activeTab ?? internalActive;

    const handleTabChange = (tabId: string) => {
      if (!tabs.find(t => t.id === tabId)?.disabled) {
        setInternalActive(tabId);
        onChange?.(tabId);
        onTabChange?.(tabId);
      }
    };

    const activeTabContent = tabs.find(t => t.id === currentTab)?.content;

    const tabSizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const tabButtonClasses = {
      default: {
        base: 'relative font-medium transition-all duration-200 flex items-center gap-2',
        inactive: 'text-muted-foreground hover:text-foreground',
        active: 'text-primary',
        indicator: 'absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t',
      },
      minimal: {
        base: 'relative font-medium transition-all duration-200 flex items-center gap-2',
        inactive: 'text-muted-foreground hover:text-foreground',
        active: 'text-foreground',
        indicator: '',
      },
      pills: {
        base: 'relative font-medium transition-all duration-200 flex items-center gap-2 rounded-lg',
        inactive: 'text-muted-foreground bg-muted/10 hover:bg-muted/20',
        active: 'text-white bg-primary hover:bg-primary/90',
        indicator: '',
      },
      underline: {
        base: 'relative font-medium transition-all duration-200 flex items-center gap-2 border-b-2',
        inactive: 'text-muted-foreground border-transparent hover:border-muted/30',
        active: 'text-foreground border-primary',
        indicator: '',
      },
    };

    const config = tabButtonClasses[variant];

    return (
      <div ref={ref} className={cn('space-y-4', className)}>
        {/* Tab List */}
        <div className={cn(
          'flex gap-1 overflow-x-auto pb-2 animate-slide-in-down',
          variant === 'default' && 'border-b-2 border-border/20 pb-0'
        )}>
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                config.base,
                tabSizeClasses[size],
                currentTab === tab.id ? config.active : config.inactive,
                tab.disabled && 'opacity-50 cursor-not-allowed',
                'animate-slide-in-down'
              )}
              style={{ animationDelay: `${idx * 50}ms` }}
              title={tab.label}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.badge && (
                <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-primary/20 text-primary rounded-full">
                  {tab.badge}
                </span>
              )}
              {config.indicator && activeTab === tab.id && (
                <div className={config.indicator} aria-hidden />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-slide-up">
          {activeTabContent}
        </div>
      </div>
    );
  }
);

Tabs.displayName = 'Tabs';

/**
 * Vertical Tabs - Side-by-side layout
 */
interface VerticalTabsProps extends Omit<TabsProps, 'variant'> {
  tabsClassName?: string;
  contentClassName?: string;
}

export const VerticalTabs = React.forwardRef<HTMLDivElement, VerticalTabsProps>(
  (
    {
      tabs,
      defaultTab,
      onChange,
      size = 'md',
      className,
      tabsClassName,
      contentClassName,
    },
    ref
  ) => {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

    const handleTabChange = (tabId: string) => {
      if (!tabs.find(t => t.id === tabId)?.disabled) {
        setActiveTab(tabId);
        onChange?.(tabId);
      }
    };

    const activeTabContent = tabs.find(t => t.id === activeTab)?.content;

    const tabSizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-6 py-4 text-lg',
    };

    return (
      <div ref={ref} className={cn('flex gap-6', className)}>
        {/* Tab List (Vertical) */}
        <div className={cn('flex flex-col gap-2 w-48 flex-shrink-0', tabsClassName)}>
          {tabs.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                'relative font-medium transition-all duration-200 flex items-center gap-2',
                'text-left rounded-lg',
                tabSizeClasses[size],
                activeTab === tab.id
                  ? 'text-white bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90'
                  : 'text-muted-foreground bg-muted/10 hover:bg-muted/20 hover:text-foreground',
                tab.disabled && 'opacity-50 cursor-not-allowed',
                'animate-slide-in-left'
              )}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span className="flex-1">{tab.label}</span>
              {tab.badge && (
                <span className={cn(
                  'px-2 py-0.5 text-xs font-bold rounded-full',
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-primary/20 text-primary'
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className={cn('flex-1 animate-fade-slide-up', contentClassName)}>
          {activeTabContent}
        </div>
      </div>
    );
  }
);

VerticalTabs.displayName = 'VerticalTabs';

/**
 * Accordion Tabs - Collapsible sections
 */
interface AccordionTab {
  id: string;
  title: string;
  icon?: ReactNode;
  content: ReactNode;
  description?: string;
}

interface AccordionProps {
  tabs: AccordionTab[];
  defaultOpen?: Set<string>;
  allowMultiple?: boolean;
  onChange?: (openTabs: Set<string>) => void;
  className?: string;
}

export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      tabs,
      defaultOpen = new Set(),
      allowMultiple = true,
      onChange,
      className,
    },
    ref
  ) => {
    const [openTabs, setOpenTabs] = useState(defaultOpen);

    const handleToggle = (tabId: string) => {
      const newOpen = new Set(openTabs);
      if (newOpen.has(tabId)) {
        newOpen.delete(tabId);
      } else {
        if (!allowMultiple) {
          newOpen.clear();
        }
        newOpen.add(tabId);
      }
      setOpenTabs(newOpen);
      onChange?.(newOpen);
    };

    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        {tabs.map((tab, idx) => {
          const isOpen = openTabs.has(tab.id);
          return (
            <div
              key={tab.id}
              className={cn(
                'rounded-xl border-2 border-border/20 overflow-hidden transition-all duration-300',
                isOpen && 'border-primary/40 bg-primary/5',
                'animate-slide-in-left'
              )}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Header */}
              <button
                onClick={() => handleToggle(tab.id)}
                className={cn(
                  'w-full px-4 py-3 flex items-center justify-between font-semibold',
                  'transition-all duration-200 hover:bg-muted/10',
                  isOpen && 'bg-primary/10'
                )}
              >
                <div className="flex items-center gap-3 text-left flex-1">
                  {tab.icon && <span className="flex-shrink-0 text-lg">{tab.icon}</span>}
                  <div>
                    <p className="font-semibold">{tab.title}</p>
                    {tab.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{tab.description}</p>
                    )}
                  </div>
                </div>
                <div className={cn(
                  'flex-shrink-0 transition-transform duration-300',
                  isOpen && 'rotate-180'
                )}>
                  ▼
                </div>
              </button>

              {/* Content */}
              {isOpen && (
                <div className="px-4 py-3 border-t border-border/20 bg-muted/5 animate-slide-in-down text-sm text-muted-foreground">
                  {tab.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);

Accordion.displayName = 'Accordion';
