import { StateHub } from './stateHub';
import { applyPowerCommand, initialPowerState, type PowerCommand, type PowerState } from './power';
import { applyWindCommand, initialWindState, type WindCommand, type WindState } from './wind';

/** App-wide electrical plant, PMS and UPS state (advanced by the DP controller's core step). */
export const powerSystem = new StateHub<PowerState, PowerCommand>('power-plant', initialPowerState(2), (s, c) => applyPowerCommand(s, c), 8, (a, b) => a.alarms.length !== b.alarms.length);

/** App-wide physical wind and wind sensor state (advanced by the DP controller's core step). */
export const windSystem = new StateHub<WindState, WindCommand>('wind', initialWindState(), applyWindCommand, 6, (a, b) => a.alarms.length !== b.alarms.length);
