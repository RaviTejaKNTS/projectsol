import { motion, AnimatePresence } from 'framer-motion';

// Subtle drop indicator that shows exactly where the drop will happen
export function DropIndicator({ index }: { index?: number }) {
  return (
    <motion.div
      key={`drop-indicator-${index}`}
      className="h-0.5 w-full bg-emerald-400 rounded-full mx-2 my-1 shadow-sm"
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ 
        opacity: 0.8, 
        scaleX: 1,
        transition: { 
          duration: 0.12,
          type: "spring",
          stiffness: 400,
          damping: 25
        } 
      }}
      exit={{ 
        opacity: 0, 
        scaleX: 0,
        transition: { duration: 0.08 } 
      }}
      style={{ originX: 0.5 }}
    />
  );
}

// Precise drop indicator for exact positioning between tasks
export function PreciseDropIndicator({ 
  visible, 
  insertionIndex, 
  className = "" 
}: { 
  visible: boolean; 
  insertionIndex: number | null;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {visible && insertionIndex !== null && (
        <motion.div
          key={`precise-drop-${insertionIndex}`}
          initial={{ opacity: 0, scaleX: 0, height: 0 }}
          animate={{ 
            opacity: 0.9, 
            scaleX: 1,
            height: 2,
            transition: { 
              duration: 0.15,
              type: "spring",
              stiffness: 350,
              damping: 28
            } 
          }}
          exit={{ 
            opacity: 0, 
            scaleX: 0,
            height: 0,
            transition: { duration: 0.1 } 
          }}
          className={`bg-emerald-400 rounded-full shadow-lg mx-3 ${className}`}
          style={{ originX: 0.5 }}
        />
      )}
    </AnimatePresence>
  );
}
