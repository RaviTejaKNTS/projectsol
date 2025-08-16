import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown } from 'lucide-react';

export function CustomDatePicker({ 
  value, 
  onChange, 
  className = "",
  theme,
  compact = false
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  theme?: any;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [currentDate, setCurrentDate] = useState(() => {
    if (value) {
      const date = new Date(value);
      return { year: date.getFullYear(), month: date.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return "No due date";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateSelect = (day: number) => {
    // Create date string directly to avoid timezone issues
    const year = currentDate.year;
    const month = String(currentDate.month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateString = `${year}-${month}-${dayStr}`;
    onChange(dateString);
    setIsOpen(false);
  };

  const clearDate = () => {
    onChange("");
    setIsOpen(false);
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(prev => {
      let newMonth = prev.month + direction;
      let newYear = prev.year;
      
      if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      } else if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      }
      
      return { year: newYear, month: newMonth };
    });
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = getDaysInMonth(currentDate.year, currentDate.month);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate.year, currentDate.month);
  const today = new Date();
  const selectedDate = value ? new Date(value) : null;

  return (
    <div className={`relative ${className}`} ref={datePickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-xl border ${theme.border} ${theme.surface} px-3 py-2 text-sm text-left ${theme.subtle} transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
      >
        <span className={value ? "" : theme.muted}>
          {formatDate(value)}
        </span>
        <Calendar className={`h-4 w-4 ${theme.muted}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border ${theme.border} ${theme.surface} shadow-lg p-3 ${
              compact ? 'min-w-[240px]' : 'min-w-[280px]'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => navigateMonth(-1)}
                className={`p-1 rounded-md ${theme.subtle}`}
              >
                <ChevronDown className="h-4 w-4 rotate-90" />
              </button>
              <span className="text-sm font-medium">
                {monthNames[currentDate.month]} {currentDate.year}
              </span>
              <button
                type="button"
                onClick={() => navigateMonth(1)}
                className={`p-1 rounded-md ${theme.subtle}`}
              >
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className={`text-xs text-center ${theme.muted} py-1`}>
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }, (_, i) => (
                <div key={`empty-${i}`} className={compact ? "h-6" : "h-8"} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const date = new Date(currentDate.year, currentDate.month, day);
                const isToday = date.toDateString() === today.toDateString();
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

                const getDayClassName = () => {
                  const baseClasses = `${compact ? 'h-6 text-xs' : 'h-8 text-sm'} rounded-md transition-colors`;
                  if (isToday) {
                    return `${baseClasses} bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300`;
                  }
                  if (isSelected) {
                    return `${baseClasses} bg-primary text-white`;
                  }
                  return `${baseClasses} ${theme.subtle}`;
                };
                
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={getDayClassName()}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className={`flex items-center justify-between mt-3 pt-3 border-t ${theme.border}`}>
              <button
                type="button"
                onClick={clearDate}
                className={`text-xs ${theme.muted} hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors`}
              >
                Clear date
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`text-xs ${theme.muted} hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors`}
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}