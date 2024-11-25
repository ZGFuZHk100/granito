import { createSignal, onMount } from 'solid-js';
import { StorageType } from '../types/storage';
import { SchemaKeys, StorageSchema } from '../types/storage';
import { SignalStoreEntry } from '../types/storage';

// Separate stores for local and session storage
const localStorageSignals = new Map<string, SignalStoreEntry<any>>();
const sessionStorageSignals = new Map<string, SignalStoreEntry<any>>();

type StorageProps<
  TSchema extends StorageSchema,
  TKey extends SchemaKeys<TSchema>
> = {
  key: TKey;
  initialValue: TSchema[TKey];
};

export function createStorageSchema<T extends StorageSchema>(
  storageType: StorageType
) {
  const storageObject = storageType === 'local' ? localStorage : sessionStorage;
  const signalStore =
    storageType === 'local' ? localStorageSignals : sessionStorageSignals;

  return function useTypedStorage<TKey extends SchemaKeys<T>>({
    key,
    initialValue
  }: StorageProps<T, TKey>): readonly [
    () => T[TKey],
    (value: T[TKey]) => void
  ] {
    // Check if a signal already exists for this key
    if (!signalStore.has(key)) {
      const initialStorageValue = (() => {
        try {
          const item = storageObject.getItem(key);
          return item ? JSON.parse(item) : initialValue;
        } catch (error) {
          console.warn(
            `Error reading ${key} from ${storageType}Storage:`,
            error
          );
          return initialValue;
        }
      })();

      const [value, setValue] = createSignal<T[TKey]>(initialStorageValue);
      signalStore.set(key, {
        value,
        setValue,
        subscribers: 0
      });
    }

    const signal = signalStore.get(key)!;
    signal.subscribers++;

    const updateStorage = (newValue: T[TKey]) => {
      try {
        storageObject.setItem(key, JSON.stringify(newValue));
        signal.setValue(newValue);
      } catch (error) {
        console.warn(`Error saving ${key} to ${storageType}Storage:`, error);
        signal.setValue(signal.value());
      }
    };

    onMount(() => {
      if (storageType === 'local') {
        const handleStorageChange = (event: StorageEvent) => {
          if (event.key === key && event.newValue !== null) {
            signal.setValue(JSON.parse(event.newValue));
          }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
          window.removeEventListener('storage', handleStorageChange);
          signal.subscribers--;
          if (signal.subscribers === 0) {
            signalStore.delete(key);
          }
        };
      }
    });

    return [signal.value, updateStorage] as const;
  };
}

// Updated debug utility to handle both stores
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

// Example usage with static schema
type ExampleSchema = {
  theme: 'light' | 'dark';
  userId: number;
  preferences: {
    notifications: boolean;
    language: string;
  };
};

// Create typed storage hooks for different storage types
export const useLocalStorage = createStorageSchema<ExampleSchema>('local');
export const useSessionStorage = createStorageSchema<ExampleSchema>('session');
