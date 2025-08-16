import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export function CustomDropdown({ 
  value, 
  onChange, 
  options, 
  placeholder = "Select option",
  className = "",
  theme = { surface: "bg-white dark:bg-zinc-900", border: "border-zinc-200 dark:border-zinc-800", muted: "text-zinc-500 dark:text-zinc-400" },
  trigger
}: {
  value?: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  theme?: any;
  trigger?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={trigger ? `p-1.5 rounded-lg ${theme.subtle} hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40` : `w-full flex items-center justify-between rounded-2xl border ${theme.border} ${theme.surface} px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40`}
      >
        {trigger ? (
          <>{trigger}</>
        ) : (
          <>
            <span className={selectedOption ? "text-zinc-900 dark:text-zinc-100" : theme.muted}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${theme.muted}`} />
          </>
        )}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute ${trigger ? 'top-full right-0 mt-1 min-w-[120px]' : 'top-full left-0 right-0 mt-1'} z-50 rounded-xl border ${theme.border} ${theme.surface} shadow-xl backdrop-blur-sm max-h-60 overflow-auto`}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                  option.value === value 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' 
                    : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
