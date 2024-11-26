import { createSignal, onMount } from 'solid-js';
import { StorageType } from '../types/storage';
import { StorageSchema } from '../types/storage';
import { SignalStoreEntry } from '../types/storage';

const localStorageSignals = new Map<string, SignalStoreEntry<any>>();
const sessionStorageSignals = new Map<string, SignalStoreEntry<any>>();

type StorageSignals<T extends StorageSchema> = {
  [K in keyof T]: readonly [() => T[K], (value: T[K]) => void];
};

function isQuotaExceededError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

export function createStorageSchema<T extends StorageSchema>(
  storageType: StorageType,
  initialSchema: T
) {
  const storageObject = storageType === 'local' ? localStorage : sessionStorage;
  const signalStore =
    storageType === 'local' ? localStorageSignals : sessionStorageSignals;

  function getOrCreateSignal<K extends keyof T>(key: K) {
    if (!signalStore.has(key as string)) {
      const initialStorageValue = (() => {
        try {
          const item = storageObject.getItem(key as string);
          return item ? JSON.parse(item) : initialSchema[key] ?? undefined;
        } catch (error) {
          console.warn(`Error reading ${String(key)} from storage:`, error);
          return initialSchema[key] ?? undefined;
        }
      })();

      const [value, setValue] = createSignal<T[K]>(initialStorageValue);
      signalStore.set(key as string, {
        value,
        setValue,
        subscribers: 0,
        eventListeners: new Set()
      });
    }

    return signalStore.get(key as string)!;
  }

  return function useTypedStorage(): StorageSignals<T> {
    return new Proxy({} as StorageSignals<T>, {
      get(target, prop: string) {
        const key = prop as keyof T;
        if (!(key in initialSchema)) return undefined;

        const signal = getOrCreateSignal(key);
        signal.subscribers++;

        if (storageType === 'local') {
          onMount(() => {
            const handleStorageChange = (event: StorageEvent) => {
              if (event.key === key && event.newValue !== null) {
                try {
                  signal.setValue(JSON.parse(event.newValue));
                } catch (error) {
                  console.warn(`Error parsing storage event value:`, error);
                }
              }
            };

            if (!signal.eventListeners.has(handleStorageChange)) {
              window.addEventListener('storage', handleStorageChange);
              signal.eventListeners.add(handleStorageChange);
            }

            return () => {
              signal.subscribers--;
              if (signal.subscribers === 0) {
                signal.eventListeners.forEach((listener) => {
                  window.removeEventListener('storage', listener);
                });
                signal.eventListeners.clear();
                signalStore.delete(key as string);
              }
            };
          });
        }

        const updateStorage = (newValue: T[typeof key]) => {
          try {
            storageObject.setItem(key as string, JSON.stringify(newValue));
            signal.setValue(newValue);
          } catch (error) {
            if (isQuotaExceededError(error)) {
              const totalSize = Object.keys(storageObject).reduce(
                (acc, key) => acc + (storageObject.getItem(key)?.length || 0),
                0
              );
              console.warn(
                `Storage quota exceeded. Current usage: ${totalSize} bytes. ` +
                  `Failed to save key: ${String(key)}`
              );
            } else {
              console.warn(`Error saving to storage:`, error);
            }
            signal.setValue(signal.value());
          }
        };

        return [signal.value, updateStorage] as const;
      }
    });
  };
}

export function getActiveSignals(storageType?: StorageType) {
  const signalStore =
    storageType === 'local' ? localStorageSignals : sessionStorageSignals;

  const signals = Array.from(signalStore.entries()).map(([key, value]) => ({
    key,
    type: storageType as StorageType,
    subscribers: value.subscribers,
    currentValue: value.value()
  }));

  return signals;
}
