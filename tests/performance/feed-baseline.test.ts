import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { expect, it, vi } from 'vitest';
import {
  findNearestPostTarget,
  findPostTargets
} from '../../src/content/feed-root';
import { FeedObserver } from '../../src/content/observer';
import { decidePostVisibility } from '../../src/content/decision';
import {
  applyPostRendering,
  clearTemporaryReveals
} from '../../src/content/render';
import { features, settings } from '../fixtures/baseline/helpers';
import type { FilterSettings } from '../../src/shared/types';

const SIZES = [25, 50, 100];
const REPETITIONS = 3;
const BURST_SIZE = 100;
const TOUCHED_POSTS = 10;
const SETTINGS_PASSES = 4;

type Sample = {
  scenario: string;
  posts: number;
  elapsedMs: number;
  evaluations: number;
  hidden: number;
  badges: number;
  callbacks?: number;
};

function createPost(index: number): HTMLElement {
  const root = document.createElement('article');
  root.setAttribute('data-urn', `urn:li:activity:${8000 + index}`);
  root.innerHTML = `<header data-view-name="feed-actor"><a href="https://www.linkedin.com/in/fixture-${index}">Fixture Person ${index}</a> • 1st <time>2d</time></header><p data-view-name="feed-commentary">Cloud fixture ${index}</p><button>Like</button><button>Comment</button>`;
  if (index % 2 === 0) root.setAttribute('data-sponsored-update', 'true');
  return root;
}

function evaluate(root: HTMLElement, config: FilterSettings): void {
  const target = findNearestPostTarget(root);
  if (!target) throw new Error('Benchmark fixture was not recognized');
  const post = features(target.renderRoot, target.featureRoot);
  applyPostRendering(post, decidePostVisibility(post, config), config);
}

function outcome(
  scenario: string,
  posts: number,
  started: number,
  evaluations: number
): Sample {
  return {
    scenario,
    posts,
    elapsedMs: Math.round((performance.now() - started) * 1000) / 1000,
    evaluations,
    hidden: document.querySelectorAll('article.cleanedin-hidden').length,
    badges: document.querySelectorAll('.cleanedin-badge').length
  };
}

async function workload(): Promise<Sample[]> {
  document.body.innerHTML = '<main></main>';
  clearTemporaryReveals();
  const feed = document.querySelector('main')!;
  const config = settings();
  const samples: Sample[] = [];
  const seen = new Set<HTMLElement>();
  let count = 0;
  for (const size of SIZES) {
    const started = performance.now();
    for (; count < size; count += 1) feed.append(createPost(count));
    const added = findPostTargets(feed).filter(
      (target) => !seen.has(target.renderRoot)
    );
    for (const target of added) {
      seen.add(target.renderRoot);
      evaluate(target.renderRoot, config);
    }
    const sample = outcome('growing-feed', size, started, added.length);
    expect(sample.hidden).toBe(Math.ceil(size / 2));
    expect(sample.badges).toBe(sample.hidden);
    expect(seen.size).toBe(size);
    samples.push(sample);
  }

  const started = performance.now();
  for (let pass = 0; pass < SETTINGS_PASSES; pass += 1) {
    config.enabled = pass % 2 !== 0;
    for (const root of seen) evaluate(root, config);
    expect(document.querySelectorAll('article.cleanedin-hidden')).toHaveLength(
      config.enabled ? 50 : 0
    );
  }
  samples.push(
    outcome('settings-reevaluation', count, started, count * SETTINGS_PASSES)
  );

  let callbacks = 0;
  let evaluations = 0;
  const observer = new FeedObserver({
    getRoot: () => feed,
    onPosts: (roots) => {
      callbacks += 1;
      for (const root of roots) {
        evaluate(root, config);
        evaluations += 1;
      }
    }
  });
  try {
    observer.start();
    await vi.advanceTimersByTimeAsync(240);
    callbacks = 0;
    evaluations = 0;
    const roots = [...seen].slice(0, TOUCHED_POSTS);
    const mutationStarted = performance.now();
    for (let i = 0; i < BURST_SIZE; i += 1) {
      const span = document.createElement('span');
      span.textContent = 'Fixture mutation';
      roots[i % roots.length].append(span);
    }
    await vi.advanceTimersByTimeAsync(240);
    expect(evaluations).toBe(TOUCHED_POSTS);
    expect(callbacks).toBe(1);
    const sample = outcome(
      'repeated-element-mutations',
      count,
      mutationStarted,
      evaluations
    );
    samples.push({ ...sample, callbacks });
  } finally {
    observer.stop();
  }
  document.body.innerHTML = '';
  clearTemporaryReveals();
  return samples;
}

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    })
    .sort();
}

function fingerprint(paths: string[]): string {
  const hash = createHash('sha256');
  for (const path of paths)
    hash.update(path).update('\0').update(readFileSync(path)).update('\0');
  return hash.digest('hex');
}

it('records repeatable component workloads with counters and environment', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  try {
    await workload(); // One unrecorded warmup, identical workload.
    const samples: Sample[][] = [];
    for (let repetition = 0; repetition < REPETITIONS; repetition += 1)
      samples.push(await workload());
    const summary = samples[0].map((sample, index) => {
      const times = samples
        .map((run) => run[index].elapsedMs)
        .sort((a, b) => a - b);
      return {
        ...sample,
        elapsedMs: undefined,
        medianMs: times[1],
        minMs: times[0],
        maxMs: times[2]
      };
    });
    const pkg = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const result = {
      schemaVersion: 1,
      measuredAt: new Date().toISOString(),
      source: {
        head: execFileSync('git', ['rev-parse', 'HEAD'], {
          encoding: 'utf8'
        }).trim(),
        dirty: Boolean(
          execFileSync('git', ['status', '--porcelain'], {
            encoding: 'utf8'
          }).trim()
        ),
        runtimeSha256: fingerprint(filesUnder('src')),
        lockfileSha256: fingerprint(['package-lock.json']),
        workloadSha256: fingerprint([
          'tests/performance/feed-baseline.test.ts',
          'tests/fixtures/baseline/helpers.ts'
        ])
      },
      environment: {
        node: process.versions.node,
        os: platform(),
        osRelease: release(),
        arch: arch(),
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length,
        vitest: pkg.packages['node_modules/vitest'].version,
        jsdom: pkg.packages['node_modules/jsdom'].version
      },
      method: {
        sizes: SIZES,
        repetitions: REPETITIONS,
        warmups: 1,
        settingsPasses: SETTINGS_PASSES,
        burstSize: BURST_SIZE,
        touchedPosts: TOUCHED_POSTS,
        debounceMs: 80,
        advancedTimersMs: 240,
        scope:
          'jsdom component pipeline; virtual debounce timers; real wall time; excludes layout, extension APIs and content-controller startup'
      },
      summary,
      samples
    };
    mkdirSync('.ai/reports', { recursive: true });
    writeFileSync(
      '.ai/reports/performance.json',
      `${JSON.stringify(result, null, 2)}\n`
    );
    console.log(
      JSON.stringify({ report: '.ai/reports/performance.json', summary })
    );
  } finally {
    vi.useRealTimers();
    document.body.innerHTML = '';
    clearTemporaryReveals();
  }
}, 60_000);
