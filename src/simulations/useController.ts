import { useEffect, useState } from 'react';
import type { SimulationController } from './controller';

/** Subscribe a component to a controller. The subscription is removed on unmount. */
export function useControllerState<S, C>(controller: SimulationController<S, C>): S {
  const [state, setState] = useState(() => controller.getState());
  useEffect(() => {
    setState(controller.getState());
    return controller.subscribe(setState);
  }, [controller]);
  return state;
}
