import { FixedStepper } from './fixedStep';
import type { SimulationController } from './controller';
import { applyDeployCommand, initialDeploymentState, stepDeployment, type DeployCommand, type DeploymentState } from './deployment';

/** Holds the Type 7950 deployment state outside React; UI subscribes, the scene reads every frame. */
export class DeploymentController implements SimulationController<DeploymentState, DeployCommand> {
  readonly id = 'deployment-state-machine';
  private state: DeploymentState = initialDeploymentState();
  private listeners = new Set<(s: DeploymentState) => void>();
  private stepper = new FixedStepper(1 / 60, 240);
  private sinceNotify = 0;
  lastError: string | null = null;
  /** Simulation speed multiplier (1× = the illustrative real-time speeds). */
  private scale = 1;

  constructor(private notifyHz = 15) {}

  getState() {
    return this.state;
  }

  dispatch(cmd: DeployCommand) {
    try {
      this.state = applyDeployCommand(this.state, cmd);
      this.lastError = null;
      if (cmd.type === 'reset') this.stepper.reset();
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
    }
    this.emit();
  }

  get timeScale() {
    return this.scale;
  }

  setTimeScale(scale: number) {
    if (![1, 5, 10, 20].includes(scale)) return;
    this.scale = scale;
    this.emit();
  }

  tick(frameSeconds: number) {
    const before = this.state;
    const n = this.stepper.advance(frameSeconds * this.scale);
    for (let i = 0; i < n; i++) this.state = stepDeployment(this.state, this.stepper.stepSeconds);
    this.sinceNotify += frameSeconds;
    const changedPhase = before.motion !== this.state.motion || before.valve !== this.state.valve || before.alarms.length !== this.state.alarms.length;
    if (this.state !== before && (changedPhase || this.sinceNotify >= 1 / this.notifyHz)) this.emit();
  }

  subscribe(listener: (s: DeploymentState) => void) {
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

/** App-wide singleton: the HPR's Type 7950 deployment machine. */
export const hprDeployment = new DeploymentController();
