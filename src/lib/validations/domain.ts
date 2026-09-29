import { z } from 'zod';
import { isValidIanaTimezone } from '../time';

/**
 * Validation schema for canonical IANA timezone identifiers.
 *
 * Field Constraints:
 * - Must be a non-empty trimmed string.
 * - Must pass `isValidIanaTimezone` verification (e.g. 'Asia/Kolkata', 'America/New_York', 'UTC').
 * - Non-canonical abbreviations (e.g. 'IST', 'PST') are rejected.
 *
 * @example
 * ianaTimezoneSchema.parse('Asia/Kolkata'); // returns 'Asia/Kolkata'
 * ianaTimezoneSchema.safeParse('Invalid/Zone'); // { success: false, error: ... }
 */
export const ianaTimezoneSchema = z
  .string()
  .trim()
  .refine((tz) => isValidIanaTimezone(tz), {
    message: 'Must be a valid canonical IANA timezone identifier (e.g. Asia/Kolkata, America/New_York).',
  });

/**
 * Validation schema for permissible Goal lifecycle statuses.
 * - `active`: Currently tracked goal.
 * - `completed`: Successfully achieved goal.
 * - `archived`: Retired or inactive goal.
 *
 * @example
 * goalStatusSchema.parse('active'); // 'active'
 */
export const goalStatusSchema = z.enum(['active', 'completed', 'archived']);

/**
 * Validation schema for permissible Project lifecycle statuses.
 * - `active`: Active initiative.
 * - `completed`: Fully delivered.
 * - `paused`: Temporarily on hold.
 * - `archived`: Inactive / archived.
 *
 * @example
 * projectStatusSchema.parse('paused'); // 'paused'
 */
export const projectStatusSchema = z.enum(['active', 'completed', 'paused', 'archived']);

/**
 * Validation schema for Task priority levels.
 * - `low`: Non-urgent back-burner item.
 * - `medium`: Default priority level.
 * - `high`: High-impact objective.
 * - `urgent`: Immediate priority commitment.
 *
 * @example
 * taskPrioritySchema.parse('urgent'); // 'urgent'
 */
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Validation schema for Task execution lifecycle statuses.
 * - `pending`: Scheduled and waiting for execution.
 * - `in_progress`: Currently active work session.
 * - `completed`: Successfully completed before deadline.
 * - `missed`: Failed to complete before deadline.
 * - `archived`: Dismissed or retired.
 *
 * @example
 * taskStatusSchema.parse('completed'); // 'completed'
 */
export const taskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'missed', 'archived']);

// Goal Validation Schemas

/**
 * Validation schema for creating a new long-term Goal.
 *
 * Field Constraints:
 * - `title`: Required non-empty string, trimmed, 1-255 characters.
 * - `description`: Optional text, trimmed, max 2000 characters, nullable.
 * - `target_date`: Optional ISO 8601 UTC datetime string, nullable.
 *
 * @example
 * createGoalSchema.parse({
 *   title: 'Master System Security Architecture',
 *   description: 'Establish foundational database RLS boundaries.',
 *   target_date: '2026-12-31T23:59:59.000Z'
 * });
 */
export const createGoalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Goal title is required.')
    .max(255, 'Goal title must not exceed 255 characters.'),
  description: z.string().trim().max(2000, 'Description must not exceed 2000 characters.').nullable().optional(),
  target_date: z
    .string()
    .datetime({ message: 'Target date must be a valid ISO 8601 timestamp string.' })
    .nullable()
    .optional(),
});

/**
 * Validation schema for updating an existing Goal.
 * Extends partial fields of `createGoalSchema` with an optional `status`.
 *
 * Field Constraints:
 * - `title`: Optional 1-255 characters string.
 * - `description`: Optional string, max 2000 characters, nullable.
 * - `target_date`: Optional ISO 8601 timestamp string, nullable.
 * - `status`: Optional `GoalStatus` ('active' | 'completed' | 'archived').
 *
 * @example
 * updateGoalSchema.parse({
 *   status: 'completed'
 * });
 */
export const updateGoalSchema = createGoalSchema.partial().extend({
  status: goalStatusSchema.optional(),
});

// Project Validation Schemas

/**
 * Validation schema for creating a new Project.
 *
 * Field Constraints:
 * - `title`: Required non-empty string, trimmed, 1-255 characters.
 * - `goal_id`: Optional parent Goal UUID format, nullable.
 * - `description`: Optional string, trimmed, max 2000 characters, nullable.
 * - `color_accent`: Optional 3 or 6 hex digits color string (e.g. '#D4AF37'), nullable.
 *
 * @example
 * createProjectSchema.parse({
 *   title: 'Phase 2A Core Domain Migration',
 *   goal_id: '123e4567-e89b-12d3-a456-426614174000',
 *   color_accent: '#D4AF37'
 * });
 */
export const createProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Project title is required.')
    .max(255, 'Project title must not exceed 255 characters.'),
  goal_id: z.string().uuid('Invalid Goal UUID format.').nullable().optional(),
  description: z.string().trim().max(2000, 'Description must not exceed 2000 characters.').nullable().optional(),
  color_accent: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color accent must be a valid hex color code.')
    .nullable()
    .optional(),
});

/**
 * Validation schema for updating an existing Project.
 * Extends partial fields of `createProjectSchema` with an optional `status`.
 *
 * Field Constraints:
 * - `title`: Optional 1-255 characters string.
 * - `goal_id`: Optional Goal UUID format, nullable.
 * - `description`: Optional string, max 2000 characters, nullable.
 * - `color_accent`: Optional hex color string, nullable.
 * - `status`: Optional `ProjectStatus` ('active' | 'completed' | 'paused' | 'archived').
 *
 * @example
 * updateProjectSchema.parse({
 *   status: 'paused'
 * });
 */
export const updateProjectSchema = createProjectSchema.partial().extend({
  status: projectStatusSchema.optional(),
});

// Task / Commitment Validation Schemas

/**
 * Validation schema for creating a new Task / Commitment.
 *
 * Field Constraints:
 * - `title`: Required non-empty string, trimmed, 1-255 characters.
 * - `deadline_at`: Required ISO 8601 UTC timestamp string.
 * - `project_id`: Optional parent Project UUID format, nullable.
 * - `goal_id`: Optional parent Goal UUID format, nullable.
 * - `description`: Optional string, trimmed, max 2000 characters, nullable.
 * - `priority`: TaskPriority level ('low' | 'medium' | 'high' | 'urgent'), default 'medium'.
 * - `accountability_mode`: Optional mode ('default' | 'explicit' | 'none').
 * - `consequence_id`: Optional Consequence UUID format, nullable.
 *
 * @example
 * createTaskSchema.parse({
 *   title: 'Harden PostgreSQL trigger functions',
 *   deadline_at: '2026-09-10T18:00:00.000Z',
 *   priority: 'high'
 * });
 */
export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Task title is required.')
    .max(255, 'Task title must not exceed 255 characters.'),
  deadline_at: z.string().datetime({ message: 'Deadline must be a valid ISO 8601 timestamp string.' }),
  project_id: z.string().uuid('Invalid Project UUID format.').nullable().optional(),
  goal_id: z.string().uuid('Invalid Goal UUID format.').nullable().optional(),
  description: z.string().trim().max(2000, 'Description must not exceed 2000 characters.').nullable().optional(),
  priority: taskPrioritySchema.default('medium'),
  accountability_mode: z.enum(['default', 'explicit', 'none']).optional(),
  consequence_id: z.string().uuid('Invalid Consequence UUID format.').nullable().optional(),
});

/**
 * Validation schema for updating an existing Task.
 * Extends partial fields of `createTaskSchema` with an optional `status`.
 *
 * Field Constraints:
 * - `title`: Optional 1-255 characters string.
 * - `deadline_at`: Optional ISO 8601 timestamp string.
 * - `project_id`: Optional Project UUID format, nullable.
 * - `goal_id`: Optional Goal UUID format, nullable.
 * - `description`: Optional string, max 2000 characters, nullable.
 * - `priority`: Optional TaskPriority ('low' | 'medium' | 'high' | 'urgent').
 * - `accountability_mode`: Optional accountability mode.
 * - `consequence_id`: Optional Consequence UUID format, nullable.
 * - `status`: Optional TaskStatus ('pending' | 'in_progress' | 'completed' | 'missed' | 'archived').
 *
 * @example
 * updateTaskSchema.parse({
 *   status: 'completed'
 * });
 */
export const updateTaskSchema = createTaskSchema.partial().extend({
  status: taskStatusSchema.optional(),
});

// Inferred TypeScript Types
export type IanaTimezoneInput = z.infer<typeof ianaTimezoneSchema>;
export type GoalStatusInput = z.infer<typeof goalStatusSchema>;
export type ProjectStatusInput = z.infer<typeof projectStatusSchema>;
export type TaskPriorityInput = z.infer<typeof taskPrioritySchema>;
export type TaskStatusInput = z.infer<typeof taskStatusSchema>;

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
