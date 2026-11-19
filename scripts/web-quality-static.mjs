import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const webRoot = join(root, 'apps', 'web');
const sourceRoots = [
  join(webRoot, 'app'),
  join(webRoot, 'components'),
];

const validRoutePrefixes = [
  '/',
  '/admin',
  '/annonces',
  '/espace',
  '/moderation',
];

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collect(full));
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

const findings = [];
const files = [];
for (const sourceRoot of sourceRoots) {
  files.push(...await collect(sourceRoot));
}

for (const file of files) {
  const content = await readFile(file, 'utf8');
  const short = relative(root, file);

  for (const match of content.matchAll(/<img\b[\s\S]*?>/g)) {
    const tag = match[0];
    if (!/\balt\s*=/.test(tag)) {
      findings.push(`${short}: <img> without alt attribute`);
    }
  }

  for (const match of content.matchAll(/\bhref\s*=\s*["']([^"']+)["']/g)) {
    const href = match[1];

    if (
      href.startsWith('#') ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    ) {
      continue;
    }

    if (!href.startsWith('/')) {
      findings.push(`${short}: non-absolute internal href "${href}"`);
      continue;
    }

    const path = href.split(/[?#]/, 1)[0] || '/';
    const valid = validRoutePrefixes.some((prefix) =>
      prefix === '/'
        ? path === '/'
        : path === prefix || path.startsWith(`${prefix}/`),
    );

    if (!valid) {
      findings.push(`${short}: unknown internal route "${href}"`);
    }
  }
}

if (findings.length > 0) {
  console.error('Web static quality audit: FAIL');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  `Web static quality audit: PASS — ${files.length} source files checked for image alt attributes and literal internal routes.`,
);
