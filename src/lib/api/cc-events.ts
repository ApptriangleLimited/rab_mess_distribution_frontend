type Listener = () => void;

const listeners = new Set<Listener>();

export function onCcDataChange(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyCcDataChange() {
  for (const fn of listeners) fn();
}
