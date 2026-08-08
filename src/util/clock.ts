/**
 * Clock abstraction so the scheduler can be tested deterministically.
 *
 * Production uses `SystemClock` (real time). Tests inject a fake clock that
 * can be advanced manually, avoiding flaky real-time delays.
 */
export interface Clock {
  /** Current time. */
  now(): Date;
}

/** Real-time clock backed by `new Date()`. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}