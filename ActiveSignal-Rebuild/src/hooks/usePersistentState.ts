import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { loadPersistedValue, savePersistedValue, type Decoder, type StoragePort } from "../lib/persistence";

function getLocalStorage(): StoragePort | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function usePersistentState<T>(
  key: string,
  fallback: T,
  decoder: Decoder<T>,
): [T, Dispatch<SetStateAction<T>>, string | null] {
  const [initial] = useState(() => {
    const storage = getLocalStorage();
    return { storage, loaded: loadPersistedValue(storage, key, fallback, decoder) };
  });
  const [value, setValue] = useState(initial.loaded.value);
  const [warning, setWarning] = useState<string | null>(initial.loaded.warning ?? null);
  const lastValue = useRef(value);
  const migrationHandled = useRef(false);
  const rawToPreserve = useRef(initial.loaded.rawToPreserve);

  useEffect(() => {
    if (lastValue.current !== value) {
      lastValue.current = value;
      const result = savePersistedValue(initial.storage, key, value, rawToPreserve.current);
      if (result.ok) {
        rawToPreserve.current = undefined;
        setWarning(null);
      } else {
        setWarning(result.message);
      }
      return;
    }

    if (initial.loaded.needsMigration && !migrationHandled.current) {
      migrationHandled.current = true;
      const result = savePersistedValue(initial.storage, key, value);
      setWarning(result.ok ? initial.loaded.warning ?? null : result.message);
    }
  }, [initial, key, value]);

  return [value, setValue, warning];
}
