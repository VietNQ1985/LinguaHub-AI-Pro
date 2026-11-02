let fallbackCounter = 0;

export function makeId(prefix: string, cryptoProvider: Crypto | undefined = globalThis.crypto): string {
  if (cryptoProvider && typeof cryptoProvider.randomUUID === "function") {
    return `${prefix}-${cryptoProvider.randomUUID()}`;
  }

  fallbackCounter += 1;
  const bytes = new Uint8Array(16);
  if (cryptoProvider && typeof cryptoProvider.getRandomValues === "function") {
    cryptoProvider.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
    return `${prefix}-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
