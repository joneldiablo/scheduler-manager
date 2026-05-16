export interface Task {
  id?: number;
  name: string;
  label: string;
  description: string;
  schedule_datetime: string | null;
  recursive_timestamp: number | null;
  expiration_datetime: string | null;
  times_total: number;
  times_called: number;
  last_ejecution_datetime: string | null;
  script: string;
  active: boolean;
  updated_at: string;
  created_at: string;
}

export interface ExecutionBuffer {
  id?: number;
  task_id: number;
  planned_at: string;
  status: 'pending' | 'fired' | 'cancelled';
  created_at: string;
}

export interface TaskWithBuffer extends Task {
  next_executions?: ExecutionBuffer[];
}

export interface WsEvent {
  type: 'task_fired' | 'buffer_updated' | 'task_updated';
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  error: boolean;
  status: number;
  code: number;
  description: string;
  data?: T;
}

export interface AuthPayload {
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface PlannerResult {
  inserted: number;
  cleaned: number;
  window_start: string;
  window_end: string;
}

export interface ExecutionHistory {
  id?: number;
  task_id: number;
  task_name?: string;
  script: string;
  executed_at: string;
  duration: number;
  response: string;
  created_at: string;
}

export interface TriggerResult {
  task_id: number;
  execution_id: number;
  planned_at: string;
  fired_at: string;
}
