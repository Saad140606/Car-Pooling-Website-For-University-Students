
'use client';

import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addMinutes, setHours, setMinutes } from 'date-fns';

interface LeavingTimePickerProps {
  selected: Date | undefined;
  onChange: (date: Date) => void;
  className?: string;
}

export const LeavingTimePicker: React.FC<LeavingTimePickerProps> = ({
  selected,
  onChange,
  className,
}) => {
  const minTime = setMinutes(setHours(new Date(), new Date().getHours()), Math.ceil(new Date().getMinutes() / 15) * 15);

  return (
    <div className="relative w-full">
      <DatePicker
        selected={selected}
        onChange={onChange}
        showTimeSelect
        timeIntervals={15}
        dateFormat="MMMM d, yyyy h:mm aa"
        minDate={new Date()}
        minTime={selected && selected.getDate() === new Date().getDate() ? minTime : undefined}
        maxTime={selected && selected.getDate() === new Date().getDate() ? setHours(setMinutes(new Date(), 45), 23) : undefined}
        filterDate={(date) => date.getTime() >= new Date().setHours(0, 0, 0, 0)}
        placeholderText="Select departure date and time"
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        wrapperClassName="w-full"
        calendarClassName="bg-card border-border"
        popperClassName="z-50"
        popperPlacement="bottom-start"
        timeClassName={(time) => 'text-foreground'}
        dayClassName={(date) =>
          cn(
            'text-foreground hover:bg-secondary',
            'react-datepicker__day'
          )
        }
        timeInputLabel="Time:"
      />
      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <style jsx global>{`
        .react-datepicker-popper {
          z-index: 50 !important;
        }
        .react-datepicker {
          font-family: inherit;
          border-color: hsl(var(--border));
          background-color: hsl(var(--card));
        }
        .react-datepicker__header {
          background-color: hsl(var(--secondary));
          border-bottom-color: hsl(var(--border));
        }
        .react-datepicker__current-month,
        .react-datepicker-time__header,
        .react-datepicker-year-header {
          color: hsl(var(--card-foreground));
        }
        .react-datepicker__day-name,
        .react-datepicker__day,
        .react-datepicker__time-name {
          color: hsl(var(--foreground));
        }
        .react-datepicker__day:hover,
        .react-datepicker__month-text:hover,
        .react-datepicker__quarter-text:hover,
        .react-datepicker__year-text:hover {
            background-color: hsl(var(--secondary));
        }
        .react-datepicker__day--selected,
        .react-datepicker__day--in-selecting-range,
        .react-datepicker__day--in-range,
        .react-datepicker__month-text--selected,
        .react-datepicker__month-text--in-selecting-range,
        .react-datepicker__month-text--in-range,
        .react-datepicker__quarter-text--selected,
        .react-datepicker__quarter-text--in-selecting-range,
        .react-datepicker__quarter-text--in-range,
        .react-datepicker__year-text--selected,
        .react-datepicker__year-text--in-selecting-range,
        .react-datepicker__year-text--in-range {
          background-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
        }
        .react-datepicker__day--keyboard-selected,
        .react-datepicker__month-text--keyboard-selected,
        .react-datepicker__quarter-text--keyboard-selected,
        .react-datepicker__year-text--keyboard-selected {
          background-color: hsl(var(--accent));
          color: hsl(var(--accent-foreground));
        }
        .react-datepicker__day--disabled {
            color: hsl(var(--muted-foreground));
            opacity: 0.5;
        }
        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item {
            background-color: hsl(var(--card));
            color: hsl(var(--card-foreground));
        }
        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item:hover {
            background-color: hsl(var(--secondary)) !important;
        }
        .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item--selected {
            background-color: hsl(var(--primary)) !important;
            color: hsl(var(--primary-foreground)) !important;
        }
        .react-datepicker__input-time-container {
            text-align: center;
        }
        .react-datepicker-time__input {
            background-color: hsl(var(--input));
            color: hsl(var(--foreground));
            border-color: hsl(var(--border));
            border-radius: var(--radius);
        }
        .react-datepicker__triangle::before, .react-datepicker__triangle::after {
            display: none;
        }
      `}</style>
    </div>
  );
};
