import { motion } from 'framer-motion';

export function DropIndicator() {
  return (
    <motion.div
      layoutId="drop-indicator"
      className="h-1 w-full bg-emerald-400 rounded-full my-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.2 } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    />
  );
}
