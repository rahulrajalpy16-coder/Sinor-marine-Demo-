/** Fixed-timestep accumulator so simulation results do not depend on display frame rate. */
export class FixedStepper {
  private acc = 0;
  constructor(
    readonly stepSeconds = 1 / 120,
    readonly maxStepsPerFrame = 24,
  ) {}

  /** Returns how many fixed steps to run for this frame's elapsed time. Large gaps are dropped, not replayed. */
  advance(frameSeconds: number): number {
    if (!(frameSeconds > 0)) return 0;
    this.acc += Math.min(frameSeconds, this.stepSeconds * this.maxStepsPerFrame);
    const n = Math.floor(this.acc / this.stepSeconds + 1e-9);
    this.acc -= n * this.stepSeconds;
    return n;
  }

  reset() {
    this.acc = 0;
  }
}
