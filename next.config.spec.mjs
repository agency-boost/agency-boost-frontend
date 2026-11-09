import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import nextConfig, {
  contentSecurityPolicy, GUIDES_DIRECTORY, guideHeaders, guidePolicy, inlineCodeOf, storageBucketFor,
} from './next.config.mjs';

/**
 * P18.4-T5: the noindex header. Inverted, it would take production out of search and leave staging — the
 * one with the seeded accounts on its sign-in screen — in it, so the direction is pinned here.
 *
 * P19.6-T2 (ADR-0217 §6): the app's Content-Security-Policy, on every path of every deployment.
 */
const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;
const ORIGINAL_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET;

async function headersFor(appEnv, bucket) {
  if (appEnv === undefined) delete process.env.NEXT_PUBLIC_APP_ENV;
  else process.env.NEXT_PUBLIC_APP_ENV = appEnv;
  if (bucket === undefined) delete process.env.NEXT_PUBLIC_STORAGE_BUCKET;
  else process.env.NEXT_PUBLIC_STORAGE_BUCKET = bucket;
  return nextConfig.headers();
}

/** The value of one header on every path, or `undefined`. */
const header = (entries, key) => entries.find((e) => e.source === '/:path*')?.headers.find((h) => h.key === key)?.value;

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
  if (ORIGINAL_BUCKET === undefined) delete process.env.NEXT_PUBLIC_STORAGE_BUCKET;
  else process.env.NEXT_PUBLIC_STORAGE_BUCKET = ORIGINAL_BUCKET;
});

describe('next.config — X-Robots-Tag', () => {
  it('P18.4-T5 asks every path of every non-production deployment not to be indexed', async () => {
    for (const appEnv of ['staging', 'development', 'demo']) {
      const entries = await headersFor(appEnv);
      // P19.6-T5 (ADR-0219 §3): the every-path entry first; after it only the guides' own policies, which set no robots
      // header of their own, so this one still reaches them.
      expect(entries[0].source).toBe('/:path*');
      expect(entries.slice(1).every((e) => e.headers.every((h) => h.key === 'Content-Security-Policy'))).toBe(true);
      expect(header(entries, 'X-Robots-Tag')).toBe('noindex');
    }
  });

  it('P18.4-T5 fails closed: unset or misspelled is noindex too', async () => {
    for (const appEnv of [undefined, '', 'Production', 'prod']) {
      expect(header(await headersFor(appEnv), 'X-Robots-Tag')).toBe('noindex');
    }
  });

  it('P18.4-T5 sends no robots header from production', async () => {
    expect(header(await headersFor('production'), 'X-Robots-Tag')).toBeUndefined();
  });

  it('P18.4-T5 keeps the settings it had', () => {
    expect(nextConfig).toMatchObject({
      reactStrictMode: true,
      poweredByHeader: false,
      eslint: { ignoreDuringBuilds: false },
      typescript: { ignoreBuildErrors: false },
    });
  });
});

describe('next.config — the Content-Security-Policy (P19.6-T2, ADR-0217 §6)', () => {
  it('P19.6-T2 AC-5 frames production’s bucket alone, by its path, on every path of production', async () => {
    expect(header(await headersFor('production'), 'Content-Security-Policy')).toBe(
      "frame-src https://storage.googleapis.com/agencyboost-prod-assets/; object-src 'none'; base-uri 'self'",
    );
  });

  it('P19.6-T2 AC-5 frames staging’s bucket alone on staging, whatever a stray variable says', async () => {
    expect(header(await headersFor('staging', 'somebody-elses-bucket'), 'Content-Security-Policy')).toBe(
      "frame-src https://storage.googleapis.com/agencyboost-staging-assets/; object-src 'none'; base-uri 'self'",
    );
  });

  it('P19.6-T2 AC-5 frames nothing without a bucket — local development without storage, CI, a misspelled name', async () => {
    for (const appEnv of ['development', 'test', 'demo', undefined, 'prod']) {
      expect(header(await headersFor(appEnv), 'Content-Security-Policy'))
        .toBe("frame-src 'none'; object-src 'none'; base-uri 'self'");
    }
  });

  it('P19.6-T2 AC-5 frames a developer’s own bucket, and refuses a value that is no bucket’s name', async () => {
    expect(header(await headersFor('development', 'dev-zul-assets'), 'Content-Security-Policy'))
      .toBe("frame-src https://storage.googleapis.com/dev-zul-assets/; object-src 'none'; base-uri 'self'");
    for (const bad of ['', ' ', 'x; script-src *', 'UPPER', "a' 'unsafe-inline"]) {
      expect(storageBucketFor({ NEXT_PUBLIC_APP_ENV: 'development', NEXT_PUBLIC_STORAGE_BUCKET: bad })).toBeNull();
    }
  });

  it('P19.6-T2 AC-5 never names unsafe-inline, a bare host, a script or a style source', async () => {
    for (const bucket of [null, 'agencyboost-prod-assets']) {
      const policy = contentSecurityPolicy(bucket);
      expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|script-src|style-src|default-src/);
      expect(policy).not.toMatch(/storage\.googleapis\.com(?!\/)/);
      expect(policy.split('; ').map((d) => d.split(' ')[0])).toEqual(['frame-src', 'object-src', 'base-uri']);
    }
  });
});

describe('next.config — the guides’ own policy on /panduan/*.html (P19.6-T5 AC-5, ADR-0219 §3)', () => {
  const GUIDES = readdirSync(GUIDES_DIRECTORY).filter((name) => name.endsWith('.html')).sort();
  const policyOf = async (name) => (await headersFor('production'))
    .find((e) => e.source === `/panduan/${name}`)?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
  const directives = (policy) => new Map(policy.split('; ').map((d) => {
    const [name, ...values] = d.split(' ');
    return [name, values];
  }));
  /** The hash a browser computes for one piece of inline code, recomputed here apart from `next.config.mjs`. */
  const hashOf = (code) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`;

  it('P19.6-T5 AC-5 finds the two public guides, so an empty folder cannot pass', () => {
    expect(GUIDES).toEqual(['agent-leader.html', 'kpm-owner-admin.html']);
  });

  it('P19.6-T5 AC-5 sends each guide’s policy after the every-path one, on its own path and nowhere else', async () => {
    const entries = await headersFor('production');
    expect(entries.map((e) => e.source)).toEqual(['/:path*', '/panduan/agent-leader.html', '/panduan/kpm-owner-admin.html']);
    // Not the PDFs, not the Super Admin's page, not the folder: the every-path policy stands there.
    expect(entries.slice(1).map((e) => e.source).filter((s) => /\.pdf$|^\/admin|:/.test(s))).toEqual([]);
    expect(header(entries, 'Content-Security-Policy')).toBe(
      "frame-src https://storage.googleapis.com/agencyboost-prod-assets/; object-src 'none'; base-uri 'self'",
    );
  });

  it.each(GUIDES)('Panduan-AC5 P19.6-T5 AC-5 %s: a sandbox, no unsafe-inline, Google Fonts, and nothing else reachable', async (name) => {
    const policy = await policyOf(name);
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    const d = directives(policy);
    expect([...d.keys()]).toEqual([
      'sandbox', 'default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'connect-src', 'base-uri', 'form-action',
      'frame-ancestors',
    ]);
    expect(d.get('sandbox')).toEqual(['allow-scripts', 'allow-modals']);
    expect(d.get('default-src')).toEqual(["'none'"]);
    expect(d.get('font-src')).toEqual(['https://fonts.gstatic.com']);
    expect(d.get('img-src')).toEqual(['data:']);
    for (const none of ['connect-src', 'base-uri', 'form-action', 'frame-ancestors']) expect([none, d.get(none)]).toEqual([none, ["'none'"]]);
    // Scripts by hash alone; styles by hash and Google's stylesheet host alone.
    expect(d.get('script-src').filter((s) => !s.startsWith("'sha256-"))).toEqual(["'unsafe-hashes'"]);
    expect(d.get('style-src').filter((s) => !s.startsWith("'sha256-"))).toEqual(["'unsafe-hashes'", 'https://fonts.googleapis.com']);
  });

  it.each(GUIDES)('Panduan-AC5 P19.6-T5 AC-5 %s: every inline block, handler and style attribute the browser parses has its hash', async (name) => {
    const html = readFileSync(join(GUIDES_DIRECTORY, name), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const d = directives(await policyOf(name));
    const scripts = [...doc.querySelectorAll('script')];
    const styles = [...doc.querySelectorAll('style')];
    const elements = [...doc.querySelectorAll('*')];
    const handlers = elements.flatMap((el) => [...el.attributes].filter((a) => /^on/i.test(a.name)).map((a) => a.value));
    const styleAttributes = elements.flatMap((el) => (el.hasAttribute('style') ? [el.getAttribute('style')] : []));

    // What the guides deliver (ADR-0219, *Context*): four scripts, two style blocks, one handler, one style attribute.
    expect([scripts.length, styles.length, handlers, styleAttributes]).toEqual([4, 2, ['window.print()'], ['margin-top:28px']]);
    expect(scripts.filter((s) => s.hasAttribute('src'))).toEqual([]);
    const wanted = {
      script: [...scripts.map((s) => s.textContent), ...handlers].map(hashOf),
      style: [...styles.map((s) => s.textContent), ...styleAttributes].map(hashOf),
    };
    expect(wanted.script.filter((h) => !d.get('script-src').includes(h))).toEqual([]);
    expect(wanted.style.filter((h) => !d.get('style-src').includes(h))).toEqual([]);
    // And no hash of anything the file does not carry.
    expect(d.get('script-src').filter((h) => h.startsWith("'sha256-") && !wanted.script.includes(h))).toEqual([]);
    expect(d.get('style-src').filter((h) => h.startsWith("'sha256-") && !wanted.style.includes(h))).toEqual([]);
    // Its one stylesheet is Google's, which the policy admits; no other outside address.
    expect([...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => new URL(l.getAttribute('href')).origin))
      .toEqual(['https://fonts.googleapis.com']);
  });

  it('P19.6-T5 AC-5 follows the file: a block added to a guide is admitted by its own hash, and only then', () => {
    const before = '<html><head><style>a{}</style></head><body><script>go()</script></body></html>';
    const after = before.replace('</body>', '<script>more()</script><p style="x:y" onclick="z()"></p></body>');
    expect(guidePolicy(before)).not.toContain(hashOf('more()'));
    expect(guidePolicy(before)).not.toContain("'unsafe-hashes'");
    const policy = directives(guidePolicy(after));
    expect(policy.get('script-src')).toEqual([hashOf('go()'), hashOf('more()'), "'unsafe-hashes'", hashOf('z()')]);
    expect(policy.get('style-src')).toEqual([hashOf('a{}'), "'unsafe-hashes'", hashOf('x:y'), 'https://fonts.googleapis.com']);
  });

  it('P19.6-T5 AC-5 reads an attribute as the browser does, and never a string inside a script for one', () => {
    const code = inlineCodeOf('<b onclick="a(&quot;x&quot;)\r\n"></b><script>el.innerHTML = \'<i style="no" onclick="no()">\'</script>');
    expect(code.handlers).toEqual(['a("x")\n']);
    expect(code.styleAttributes).toEqual([]);
    expect(code.scripts).toEqual(['el.innerHTML = \'<i style="no" onclick="no()">\'']);
  });

  it('P19.6-T5 AC-5 sends no guide entry from a checkout without the guides', () => {
    expect(guideHeaders(join(GUIDES_DIRECTORY, 'no-such-folder'))).toEqual([]);
  });
});
