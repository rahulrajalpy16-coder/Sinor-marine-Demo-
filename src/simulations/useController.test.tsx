import { act, render } from '@testing-library/react';
import { ThrusterController } from './controller';
import { useControllerState } from './useController';

function Readout({ c }: { c: ThrusterController }) {
  const s = useControllerState(c);
  return <span data-testid="status">{s.status}</span>;
}

describe('UI subscriptions', () => {
  it('re-render on commands and unsubscribe on unmount', () => {
    const c = new ThrusterController();
    const { getByTestId, unmount } = render(<Readout c={c} />);
    expect(c.listenerCount()).toBe(1);
    act(() => c.dispatch({ type: 'start' }));
    expect(getByTestId('status').textContent).toBe('starting');
    unmount();
    expect(c.listenerCount()).toBe(0);
  });
});
