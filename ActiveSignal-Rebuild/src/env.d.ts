declare module "*.css";
import type { ZaloStatus, ZaloViewBounds } from "./types/zalo";

declare global {
  interface Window {
    signalDesk?: {
      getZaloStatus: () => Promise<ZaloStatus>;
      openZalo: () => Promise<ZaloStatus>;
      focusZalo: () => Promise<ZaloStatus>;
      reloadZalo: () => Promise<ZaloStatus>;
      setZaloViewBounds: (bounds: ZaloViewBounds | null) => Promise<boolean>;
      resetZaloSession: () => Promise<{ cancelled: boolean; state?: ZaloStatus; error?: string }>;
      onZaloStatus: (callback: (state: ZaloStatus) => void) => () => void;
    };
  }
}

export {};
