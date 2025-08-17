import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, Target, Calendar, CheckCircle2 } from 'lucide-react';
import { calculateTaskStats, generateTaskReport } from '../utils/taskStats';

interface TaskReportsProps {
  state: any;
  onOpenCompletedTasks: () => void;
  theme: {
    surface: string;
    border: string;
    muted: string;
    subtle: string;
  };
}

export function TaskReports({ state, onOpenCompletedTasks, theme }: TaskReportsProps) {
  const stats = useMemo(() => calculateTaskStats(state), [state]);
  const report = useMemo(() => generateTaskReport(stats), [stats]);

  // Get completed tasks count
  const allTasks = Object.values(state.tasks) as any[];
  const completedTasksCount = allTasks.filter((task: any) => task.completed).length;

  // Get appropriate icon based on report content
  const getReportIcon = (reportText: string) => {
    if (reportText.includes('overdue') || reportText.includes('deadline')) {
      return <Clock className="h-4 w-4 text-amber-500" />;
    }
    if (reportText.includes('completed') || reportText.includes('congrats') || reportText.includes('streak')) {
      return <Target className="h-4 w-4 text-emerald-500" />;
    }
    if (reportText.includes('tomorrow') || reportText.includes('scheduled') || reportText.includes('due date')) {
      return <Calendar className="h-4 w-4 text-sky-500" />;
    }
    return <TrendingUp className="h-4 w-4 text-zinc-500" />;
  };

  // Get appropriate styling based on report type
  const getReportStyling = (reportText: string) => {
    if (reportText.includes('overdue')) {
      return {
        bg: 'bg-amber-500/10 border-amber-500/20',
        text: 'text-amber-700 dark:text-amber-300'
      };
    }
    if (reportText.includes('completed') || reportText.includes('congrats') || reportText.includes('streak')) {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        text: 'text-emerald-700 dark:text-emerald-300'
      };
    }
    if (reportText.includes('Create your first task')) {
      return {
        bg: 'bg-sky-500/10 border-sky-500/20',
        text: 'text-sky-700 dark:text-sky-300'
      };
    }
    return {
      bg: `${theme.surface} ${theme.border}`,
      text: theme.muted
    };
  };

  const styling = getReportStyling(report);
  const icon = getReportIcon(report);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="w-full mt-4"
    >
      <div className="flex items-center gap-3">
        {/* Task Report */}
        <div className={`
          flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 flex-1
          ${styling.bg} ${styling.text}
          hover:scale-[1.01] hover:shadow-sm
        `}>
          <div className="flex-shrink-0">
            {icon}
          </div>
          <p className="text-sm font-medium flex-1 min-w-0">
            {report}
          </p>
          {stats.overdueTasks > 0 && (
            <div className="flex-shrink-0">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400">
                {stats.overdueTasks} overdue
              </span>
            </div>
          )}
          {stats.completedToday > 0 && !report.includes('completed') && (
            <div className="flex-shrink-0">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                {stats.completedToday} done today
              </span>
            </div>
          )}
        </div>

        {/* Completed Tasks Button */}
        <motion.button
          onClick={onOpenCompletedTasks}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`
            flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all duration-200
            ${theme.surface} ${theme.border} hover:shadow-md hover:border-emerald-500/30
            text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/5
          `}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm font-medium">
            {completedTasksCount} Completed
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
}
