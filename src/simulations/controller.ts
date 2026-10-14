import { FixedStepper } from './fixedStep';
import {
  applyThrusterCommand,
  DEFAULT_THRUSTER_PARAMS,
  initialThrusterState,
  stepThruster,
  type ThrusterCommand,
  type ThrusterParams,
  type ThrusterState,
} from './thruster';

/** Generic contract every simulation exposes to the UI and render layers. */
export interface SimulationController<S, C> {
  readonly id: string;
  getState(): S;
  dispatch(cmd: C): void;
  /** Advance by a frame's wall-clock time; internally integrates at a fixed step. */
  tick(frameSeconds: number): void;
  subscribe(listener: (s: S) => void): () => void;
  listenerCount(): number;
}

/**
 * Holds thruster state outside React render frames. Render code reads getState() every frame;
 * UI subscribes and is notified at most `notifyHz` times per second plus on every command.
 */
export class ThrusterController implements SimulationController<ThrusterState, ThrusterCommand> {
  readonly id = 'tunnel-thruster';
  private state: ThrusterState = initialThrusterState();
  private listeners = new Set<(s: ThrusterState) => void>();
  // Up to 2 s of simulated time per frame so the thruster keeps pace with a fast-forwarded DP run.
  private stepper = new FixedStepper(1 / 120, 240);
  private sinceNotify = 0;
  lastError: string | null = null;

  constructor(
    private params: ThrusterParams = DEFAULT_THRUSTER_PARAMS,
    private notifyHz = 15,
  ) {}

  getState() {
    return this.state;
  }

  dispatch(cmd: ThrusterCommand) {
    try {
      this.state = applyThrusterCommand(this.state, cmd);
      this.lastError = null;
      if (cmd.type === 'reset') this.stepper.reset();
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
    }
    this.emit();
  }

  tick(frameSeconds: number) {
    const before = this.state;
    const n = this.stepper.advance(frameSeconds);
    for (let i = 0; i < n; i++) this.state = stepThruster(this.state, this.stepper.stepSeconds, this.params);
    this.sinceNotify += frameSeconds;
    const statusChanged = before.status !== this.state.status;
    if (statusChanged || (this.state !== before && this.sinceNotify >= 1 / this.notifyHz)) this.emit();
  }

  subscribe(listener: (s: ThrusterState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  listenerCount() {
    return this.listeners.size;
  }

  /** DP sets the pitch setpoint directly while it has command; silent (the UI picks it up on the next tick notify). */
  setDpPitch(pitch: number) {
    if (this.state.station !== 'DP') return;
    const v = Math.max(-1, Math.min(1, pitch));
    if (v !== this.state.command) this.state = { ...this.state, command: v };
  }

  private emit() {
    this.sinceNotify = 0;
    for (const l of this.listeners) l(this.state);
  }
}

/** App-wide singleton: one bow thruster on the representative vessel. */
export const bowThruster = new ThrusterController();
