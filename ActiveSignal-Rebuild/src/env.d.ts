declare module "*.css";
import type { ZaloStatus } from "./types/zalo";

declare global {
  interface Window {
    signalDesk?: {
      getZaloStatus: () => Promise<ZaloStatus>;
      openZalo: () => Promise<ZaloStatus>;
      focusZalo: () => Promise<ZaloStatus>;
      reloadZalo: () => Promise<ZaloStatus>;
      resetZaloSession: () => Promise<{ cancelled: boolean; state?: ZaloStatus; error?: string }>;
      onZaloStatus: (callback: (state: ZaloStatus) => void) => () => void;
    };
  }
}

export {};
