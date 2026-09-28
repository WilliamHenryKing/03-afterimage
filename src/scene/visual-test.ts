// Capture hook for visual review (dev server and ?e2e builds only): a harness can wait for the
// scene, jump to a named camera bookmark, freeze time and let a few frames settle before capturing.
import { BOOKMARKS, type Bookmark, type BookmarkName } from "./bookmarks";

export interface VisualTestHost {
  ready: Promise<void>;
  apply: (bookmark: Bookmark) => void;
  freeze: (frozen: boolean) => void;
  frames: (count: number) => Promise<void>;
  info: () => Record<string, string | number>;
}

export interface VisualTestApi {
  ready: Promise<void>;
  bookmarks: BookmarkName[];
  setBookmark: (name: BookmarkName) => void;
  freeze: (frozen?: boolean) => void;
  settle: (frames?: number) => Promise<void>;
  info: () => Record<string, string | number>;
}

declare global {
  interface Window {
    __VISUAL_TEST__?: VisualTestApi;
  }
}

export function visualTestEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has("e2e");
  } catch {
    return false;
  }
}

export function installVisualTest(host: VisualTestHost): () => void {
  window.__VISUAL_TEST__ = {
    ready: host.ready,
    bookmarks: Object.keys(BOOKMARKS) as BookmarkName[],
    setBookmark(name) {
      const bookmark = BOOKMARKS[name];
      if (!bookmark) throw new Error(`Unknown bookmark ${name}`);
      host.apply(bookmark);
    },
    freeze: (frozen = true) => host.freeze(frozen),
    settle: (frames = 4) => host.frames(frames),
    info: host.info,
  };
  return () => {
    delete window.__VISUAL_TEST__;
  };
}
