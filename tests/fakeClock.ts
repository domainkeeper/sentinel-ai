import type { Clock } from "../src/util/clock.js";

/**
 * A controllable clock for deterministic scheduler tests.
 * Start at a fixed ISO time and advance it explicitly — no real-time delays.
 */
export class FakeClock implements Clock {
  private current: Date;

  constructor(startIso = "2026-08-08T00:00:00.000Z") {
    this.current = new Date(startIso);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  /** Advance the clock by a number of milliseconds. */
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  /** Advance the clock by a number of seconds. */
  advanceSeconds(seconds: number): void {
    this.advance(seconds * 1000);
  }
}