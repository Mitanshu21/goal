export type ID = string;

/** Every stored record carries these so two devices can be merged safely. */
export interface Base {
  id: ID;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp, the newest version wins on merge
  deleted?: boolean; // tombstone, so deletes also sync
}

export type Repeat = 'daily' | 'weekly' | null;

export interface Task extends Base {
  title: string;
  due: string; // YYYY-MM-DD
  time: string | null; // HH:mm (24h)
  repeat: Repeat;
  goalId: ID | null;
  doneAt: string | null; // ISO timestamp
  nextId: ID | null; // the follow-up created when a repeating task is done
}

/**
 * amount: save `target` rupees between `start` and `end`
 * limit:  at most `target` per calendar month
 * freq:   `target` days per week
 * tasks:  finish linked tasks by `end`
 */
export type GoalKind = 'amount' | 'limit' | 'freq' | 'tasks';

export interface Goal extends Base {
  title: string;
  kind: GoalKind;
  target: number;
  start: string; // YYYY-MM-DD
  end: string | null; // YYYY-MM-DD
  completedAt: string | null; // ISO timestamp
}

/** One logged event for a goal: a saving (amount = rupees), a cigarette, a gym day. */
export interface Log extends Base {
  goalId: ID;
  at: string; // ISO timestamp
  amount: number;
}

export interface Data {
  version: 1;
  tasks: Task[];
  goals: Goal[];
  logs: Log[];
}
