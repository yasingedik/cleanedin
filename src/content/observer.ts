import { findNearestPostRoot, findPostRoots, isPostRootNode } from './feed-root';

type ObserverOptions = {
  getRoot: () => HTMLElement | null;
  onPosts: (roots: HTMLElement[]) => void;
  debounceMs?: number;
};

export class FeedObserver {
  private readonly getRoot: () => HTMLElement | null;

  private readonly onPosts: (roots: HTMLElement[]) => void;

  private readonly debounceMs: number;

  private observer: MutationObserver | null = null;

  private rootLifecycleObserver: MutationObserver | null = null;

  private currentRoot: HTMLElement | null = null;

  private active = false;

  private queue = new Set<HTMLElement>();

  private timer: number | null = null;

  constructor(options: ObserverOptions) {
    this.getRoot = options.getRoot;
    this.onPosts = options.onPosts;
    this.debounceMs = options.debounceMs ?? 80;
  }

  start(): void {
    if (this.active) {
      this.ensureRootAttachment();
      return;
    }

    this.active = true;
    this.observeRootLifecycle();
    this.ensureRootAttachment();
  }

  restart(): void {
    if (!this.active) {
      this.start();
      return;
    }

    this.ensureRootAttachment();
  }

  stop(): void {
    this.active = false;

    this.disconnectObserver();
    this.rootLifecycleObserver?.disconnect();
    this.rootLifecycleObserver = null;
    this.currentRoot = null;

    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    this.queue.clear();
  }

  private observeRootLifecycle(): void {
    if (this.rootLifecycleObserver) {
      return;
    }

    const target = document.documentElement ?? document.body;
    if (!target) {
      return;
    }

    this.rootLifecycleObserver = new MutationObserver(() => {
      if (!this.active) {
        return;
      }

      if (this.currentRoot && !this.currentRoot.isConnected) {
        this.disconnectObserver();
        this.currentRoot = null;
      }

      this.ensureRootAttachment();
    });

    this.rootLifecycleObserver.observe(target, {
      childList: true,
      subtree: true
    });
  }

  private ensureRootAttachment(): void {
    const nextRoot = this.getRoot();
    if (!nextRoot) {
      return;
    }

    if (this.currentRoot === nextRoot && this.observer) {
      return;
    }

    this.disconnectObserver();
    this.currentRoot = nextRoot;
    this.observer = new MutationObserver((records) => this.handleMutations(records));
    this.observer.observe(nextRoot, {
      subtree: true,
      childList: true,
      attributes: false
    });

    this.enqueue(findPostRoots(nextRoot));
  }

  private disconnectObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private handleMutations(records: MutationRecord[]): void {
    const next: HTMLElement[] = [];

    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue;
        }

        next.push(node);
      }
    }

    this.enqueue(next);
  }

  private enqueue(nodes: HTMLElement[]): void {
    for (const node of nodes) {
      if (isPostRootNode(node)) {
        this.queue.add(node);
      }

      const closest = findNearestPostRoot(node);
      if (closest) {
        this.queue.add(closest);
      }

      for (const root of findPostRoots(node)) {
        this.queue.add(root);
      }
    }

    if (this.timer === null) {
      this.timer = window.setTimeout(() => this.flush(), this.debounceMs);
    }
  }

  private flush(): void {
    this.timer = null;

    if (this.queue.size === 0) {
      return;
    }

    const payload = [...this.queue].filter((node) => node.isConnected);
    this.queue.clear();

    if (payload.length > 0) {
      this.onPosts(payload);
    }
  }
}
