import type { DecodeResult } from "./validation";

export const STORAGE_SCHEMA_VERSION = 2;
const CURRENT_PREFIX = `signaldesk.v${STORAGE_SCHEMA_VERSION}.`;
const LEGACY_PREFIX = "signaldesk.";

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LoadedValue<T> {
  value: T;
  source: "current" | "legacy" | "default" | "invalid" | "unavailable";
  warning?: string;
  needsMigration?: boolean;
  rawToPreserve?: string;
}

export type Decoder<T> = (raw: unknown) => DecodeResult<T> | null;

function validationWarning(result: DecodeResult<unknown>): string | undefined {
  if (result.dropped === 0 && result.repaired === 0) return undefined;
  const details: string[] = [];
  if (result.dropped > 0) details.push(`${result.dropped} mục lỗi được bỏ qua`);
  if (result.repaired > 0) details.push(`${result.repaired} mục được sửa để tương thích`);
  return `Một phần dữ liệu cần khôi phục: ${details.join(", ")}. Bản dữ liệu gốc vẫn được giữ.`;
}

function parseAndDecode<T>(raw: string, decoder: Decoder<T>): DecodeResult<T> | null {
  try {
    return decoder(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function loadPersistedValue<T>(
  storage: StoragePort | null,
  key: string,
  fallback: T,
  decoder: Decoder<T>,
): LoadedValue<T> {
  if (!storage) {
    return { value: fallback, source: "unavailable", warning: "Không thể mở bộ nhớ cục bộ. Thay đổi chưa được lưu." };
  }

  const currentKey = `${CURRENT_PREFIX}${key}`;
  let currentRaw: string | null;
  try {
    currentRaw = storage.getItem(currentKey);
  } catch {
    return { value: fallback, source: "unavailable", warning: "Không thể đọc dữ liệu cục bộ. Dữ liệu hiện có chưa bị thay đổi." };
  }

  if (currentRaw !== null) {
    let envelope: unknown;
    try {
      envelope = JSON.parse(currentRaw) as unknown;
    } catch {
      return { value: fallback, source: "invalid", rawToPreserve: currentRaw, warning: "Dữ liệu lưu hiện tại không đọc được. Bản gốc được giữ nguyên; hãy sao lưu trước khi sửa tiếp." };
    }
    if (typeof envelope !== "object" || envelope === null || !("schemaVersion" in envelope) || !("data" in envelope)) {
      return { value: fallback, source: "invalid", rawToPreserve: currentRaw, warning: "Dữ liệu lưu hiện tại không đúng định dạng. Bản gốc được giữ nguyên." };
    }
    const record = envelope as { schemaVersion: unknown; data: unknown };
    if (record.schemaVersion !== STORAGE_SCHEMA_VERSION) {
      return { value: fallback, source: "invalid", rawToPreserve: currentRaw, warning: "Phiên bản dữ liệu chưa tương thích. Bản gốc được giữ nguyên để tránh mất dữ liệu." };
    }
    const decoded = decoder(record.data);
    if (!decoded) {
      return { value: fallback, source: "invalid", rawToPreserve: currentRaw, warning: "Dữ liệu lưu hiện tại có cấu trúc không hợp lệ. Bản gốc được giữ nguyên." };
    }
    return {
      value: decoded.value,
      source: "current",
      warning: validationWarning(decoded),
      rawToPreserve: decoded.dropped > 0 || decoded.repaired > 0 ? currentRaw : undefined,
    };
  }

  const legacyKey = `${LEGACY_PREFIX}${key}`;
  let legacyRaw: string | null;
  try {
    legacyRaw = storage.getItem(legacyKey);
  } catch {
    return { value: fallback, source: "unavailable", warning: "Không thể đọc dữ liệu cục bộ. Dữ liệu hiện có chưa bị thay đổi." };
  }
  if (legacyRaw === null) return { value: fallback, source: "default" };

  const decoded = parseAndDecode(legacyRaw, decoder);
  if (!decoded) {
    return { value: fallback, source: "invalid", rawToPreserve: legacyRaw, warning: "Dữ liệu cũ không đọc được. Bản gốc được giữ nguyên và chưa bị ghi đè." };
  }
  return { value: decoded.value, source: "legacy", needsMigration: true, warning: validationWarning(decoded) };
}

export type SaveResult = { ok: true } | { ok: false; message: string };

export function savePersistedValue<T>(storage: StoragePort | null, key: string, value: T, rawToPreserve?: string): SaveResult {
  if (!storage) return { ok: false, message: "Bộ nhớ cục bộ chưa sẵn sàng. Thay đổi này chưa được lưu." };
  let serialized: string;
  try {
    serialized = JSON.stringify({ schemaVersion: STORAGE_SCHEMA_VERSION, data: value });
  } catch {
    return { ok: false, message: "Không thể chuẩn bị dữ liệu để lưu. Thay đổi này chưa được lưu." };
  }
  if (serialized === undefined) return { ok: false, message: "Dữ liệu không thể lưu ở định dạng hiện tại." };

  if (rawToPreserve !== undefined) {
    const recoveryKey = `signaldesk.recovery.${key}`;
    try {
      if (storage.getItem(recoveryKey) === null) storage.setItem(recoveryKey, rawToPreserve);
    } catch {
      return { ok: false, message: "Không thể giữ bản dữ liệu lỗi trước khi lưu. Dữ liệu cũ chưa bị thay đổi." };
    }
  }

  try {
    storage.setItem(`${CURRENT_PREFIX}${key}`, serialized);
    return { ok: true };
  } catch {
    return { ok: false, message: "Không đủ chỗ trong bộ nhớ để lưu. Hãy giải phóng dung lượng rồi thử lại." };
  }
}
