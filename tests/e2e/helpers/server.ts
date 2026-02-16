import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FEED_FIXTURE = readFileSync(resolve('tests/e2e/fixtures/feed.html'), 'utf8');

export interface FixtureServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end('missing URL');
      return;
    }

    if (req.url === '/feed' || req.url === '/feed/' || req.url === '/feed.html') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(FEED_FIXTURE);
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('ok');
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve fixture server address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }

          resolvePromise();
        });
      });
    }
  };
}
