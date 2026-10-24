import type { SimulationController } from './controller';

/**
 * Holds a state that the shared core (vesselCore.ts) advances, so screens can subscribe to it and send commands.
 * It does not integrate time itself: the DP controller steps the whole core and writes the result here.
 */
export class StateHub<S, C> implements SimulationController<S, C> {
  private listeners = new Set<(s: S) => void>();
  private sinceNotify = 0;
  lastError: string | null = null;

  constructor(
    readonly id: string,
    private state: S,
    private apply: (s: S, c: C) => S,
    private notifyHz = 8,
    private urgent: (a: S, b: S) => boolean = () => false,
  ) {}

  getState() {
    return this.state;
  }

  dispatch(cmd: C) {
    try {
      this.state = this.apply(this.state, cmd);
      this.lastError = null;
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
    }
    this.emit();
  }

  /** Written by the core step; listeners are told at most notifyHz times a second, or at once on urgent changes. */
  set(next: S, frameSeconds = 0) {
    const before = this.state;
    this.state = next;
    this.sinceNotify += frameSeconds;
    if (this.urgent(before, next) || this.sinceNotify >= 1 / this.notifyHz) this.emit();
  }

  /** Replace the state (reset, scenario load) and notify. */
  replace(next: S) {
    this.state = next;
    this.lastError = null;
    this.emit();
  }

  tick() {
    // Advanced by the shared core.
  }

  subscribe(listener: (s: S) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listenerCount() {
    return this.listeners.size;
  }

  private emit() {
    this.sinceNotify = 0;
    for (const l of this.listeners) l(this.state);
  }
}
