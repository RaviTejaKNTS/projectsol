import { getDueDateStatus } from './helpers';

export interface TaskStatsData {
  overdueTasks: number;
  overdueLabels: string[];
  totalTasks: number;
  completedToday: number;
  completedThisWeek: number;
  nextDeadlineHours: number | null;
  newTasksToday: number;
  oldestTaskDays: number | null;
  tasksScheduledToday: number;
  tasksDueTomorrow: number;
  consecutiveDaysStreak: number;
  mostUsedLabelThisMonth: string | null;
  tasksWithoutDueDate: number;
  daysSinceLastTask: number | null;
  sprintCompletionPercentage: number;
  hoursSinceLastOverdueCleared: number | null;
}

export function calculateTaskStats(state: any): TaskStatsData {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const weekStart = new Date(today.getTime() - (today.getDay() * 86400000));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const allTasks = Object.values(state.tasks) as any[];
  const activeTasks = allTasks.filter((task: any) => !task.completed);
  const completedTasks = allTasks.filter((task: any) => task.completed);

  // Overdue tasks
  const overdueTasks = activeTasks.filter((task: any) => getDueDateStatus(task.dueDate) === 'past');
  const overdueLabels = [...new Set(overdueTasks.flatMap((task: any) => task.labels || []))];

  // Tasks completed today
  const completedToday = completedTasks.filter((task: any) => {
    const timestamp = task.completedAt || task.updatedAt;
    const completedDate = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    return completedDate >= today;
  }).length;

  // Tasks completed this week
  const completedThisWeek = completedTasks.filter((task: any) => {
    const timestamp = task.completedAt || task.updatedAt;
    const completedDate = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    return completedDate >= weekStart;
  }).length;

  // Next deadline in hours
  const tasksWithDueDates = activeTasks.filter((task: any) => task.dueDate);
  const nextDeadline = tasksWithDueDates
    .map((task: any) => new Date(task.dueDate))
    .filter(date => date > now)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const nextDeadlineHours = nextDeadline ? Math.ceil((nextDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)) : null;

  // New tasks added today
  const newTasksToday = allTasks.filter((task: any) => {
    const createdDate = new Date(task.createdAt * 1000);
    return createdDate >= today;
  }).length;

  // Oldest open task
  const oldestTask = activeTasks
    .filter((task: any) => task.createdAt)
    .sort((a: any, b: any) => a.createdAt - b.createdAt)[0];
  const oldestTaskDays = oldestTask ? Math.floor((now.getTime() - (oldestTask.createdAt * 1000)) / (1000 * 60 * 60 * 24)) : null;

  // Tasks scheduled for today
  const tasksScheduledToday = activeTasks.filter((task: any) => getDueDateStatus(task.dueDate) === 'today').length;

  // Tasks due tomorrow
  const tasksDueTomorrow = activeTasks.filter((task: any) => {
    if (!task.dueDate) return false;
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === tomorrow.getTime();
  }).length;

  // Consecutive days streak (simplified - based on completed tasks)
  let consecutiveDaysStreak = 0;
  const checkDate = new Date(today);
  while (consecutiveDaysStreak < 30) { // Check last 30 days max
    const dayStart = new Date(checkDate);
    const dayEnd = new Date(checkDate.getTime() + 86400000);
    
    const completedOnDay = completedTasks.some((task: any) => {
      const timestamp = task.completedAt || task.updatedAt;
      const completedDate = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
      return completedDate >= dayStart && completedDate < dayEnd;
    });
    
    if (!completedOnDay) break;
    consecutiveDaysStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Most used label this month
  const thisMonthTasks = allTasks.filter((task: any) => {
    const createdDate = new Date(task.createdAt * 1000);
    return createdDate >= monthStart;
  });
  const labelCounts: Record<string, number> = {};
  thisMonthTasks.forEach((task: any) => {
    (task.labels || []).forEach((label: string) => {
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    });
  });
  const mostUsedLabelThisMonth = Object.keys(labelCounts).length > 0 
    ? Object.entries(labelCounts).sort(([,a], [,b]) => b - a)[0][0] 
    : null;

  // Tasks without due date
  const tasksWithoutDueDate = activeTasks.filter((task: any) => !task.dueDate).length;

  // Days since last task created
  const lastCreatedTask = allTasks
    .filter((task: any) => task.createdAt)
    .sort((a: any, b: any) => b.createdAt - a.createdAt)[0];
  const daysSinceLastTask = lastCreatedTask 
    ? Math.floor((now.getTime() - (lastCreatedTask.createdAt * 1000)) / (1000 * 60 * 60 * 24))
    : null;

  // Sprint completion percentage (simplified - based on current active vs completed ratio)
  const totalSprintTasks = allTasks.length;
  const sprintCompletionPercentage = totalSprintTasks > 0 
    ? Math.round((completedTasks.length / totalSprintTasks) * 100)
    : 0;

  // Hours since last overdue task was cleared (simplified)
  const recentlyCompletedOverdue = completedTasks
    .filter((task: any) => getDueDateStatus(task.dueDate) === 'past')
    .sort((a: any, b: any) => (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt))[0];
  const hoursSinceLastOverdueCleared = recentlyCompletedOverdue
    ? (() => {
        const timestamp = recentlyCompletedOverdue.completedAt || recentlyCompletedOverdue.updatedAt;
        const completedTime = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
        return Math.floor((now.getTime() - completedTime) / (1000 * 60 * 60));
      })()
    : null;

  return {
    overdueTasks: overdueTasks.length,
    overdueLabels,
    totalTasks: activeTasks.length,
    completedToday,
    completedThisWeek,
    nextDeadlineHours,
    newTasksToday,
    oldestTaskDays,
    tasksScheduledToday,
    tasksDueTomorrow,
    consecutiveDaysStreak,
    mostUsedLabelThisMonth,
    tasksWithoutDueDate,
    daysSinceLastTask,
    sprintCompletionPercentage,
    hoursSinceLastOverdueCleared,
  };
}

export function generateTaskReport(stats: TaskStatsData): string {
  const reports = [];

  // Overdue tasks
  if (stats.overdueTasks > 0) {
    if (stats.overdueLabels.length === 1) {
      reports.push(`${stats.overdueTasks} tasks are currently overdue`);
      reports.push(`All your overdue tasks are with the ${stats.overdueLabels[0]} label`);
    } else {
      reports.push(`${stats.overdueTasks} tasks are currently overdue`);
    }
  }

  // No tasks
  if (stats.totalTasks === 0) {
    reports.push("Create your first task");
  }

  // Completed today
  if (stats.completedToday > 0) {
    reports.push(`You have completed ${stats.completedToday} tasks today already, congrats.`);
  }

  // Completed this week
  if (stats.completedThisWeek > 0) {
    reports.push(`You've completed ${stats.completedThisWeek} tasks this week, keep the streak alive.`);
  }

  // Next deadline
  if (stats.nextDeadlineHours !== null) {
    reports.push(`Your next task deadline is in ${stats.nextDeadlineHours} hours.`);
  }

  // New tasks today
  if (stats.newTasksToday > 0) {
    reports.push(`You've added ${stats.newTasksToday} new tasks today.`);
  }

  // Oldest task
  if (stats.oldestTaskDays !== null && stats.oldestTaskDays > 0) {
    reports.push(`The oldest open task was created ${stats.oldestTaskDays} days ago.`);
  }

  // No tasks scheduled today
  if (stats.tasksScheduledToday === 0 && stats.totalTasks > 0) {
    reports.push("You have no tasks scheduled for today — free time ahead.");
  }

  // Tasks due tomorrow
  if (stats.tasksDueTomorrow > 0) {
    reports.push(`${stats.tasksDueTomorrow} tasks are due tomorrow, plan accordingly.`);
  }

  // Consecutive days streak
  if (stats.consecutiveDaysStreak > 1) {
    reports.push(`You're on a streak: ${stats.consecutiveDaysStreak} consecutive days completing tasks.`);
  }

  // Most used label
  if (stats.mostUsedLabelThisMonth) {
    reports.push(`Your most used label this month is "${stats.mostUsedLabelThisMonth}".`);
  }

  // Tasks without due date
  if (stats.tasksWithoutDueDate > 0) {
    reports.push(`${stats.tasksWithoutDueDate} tasks have no due date — want to set some?`);
  }

  // Days since last task
  if (stats.daysSinceLastTask !== null && stats.daysSinceLastTask > 0) {
    reports.push(`The last task you created was ${stats.daysSinceLastTask} days ago.`);
  }

  // Sprint completion
  if (stats.sprintCompletionPercentage > 0) {
    reports.push(`You've completed ${stats.sprintCompletionPercentage}% of tasks in this sprint.`);
  }

  // Last overdue cleared
  if (stats.hoursSinceLastOverdueCleared !== null) {
    reports.push(`You cleared your last overdue task ${stats.hoursSinceLastOverdueCleared} hours ago.`);
  }

  // Return a random report or the most relevant one
  if (reports.length === 0) {
    return "All caught up! No active tasks to report.";
  }

  // Prioritize certain reports
  const priorityReports = reports.filter(report => 
    report.includes('overdue') || 
    report.includes('completed') || 
    report.includes('Create your first task')
  );

  if (priorityReports.length > 0) {
    return priorityReports[Math.floor(Math.random() * priorityReports.length)];
  }

  return reports[Math.floor(Math.random() * reports.length)];
}
