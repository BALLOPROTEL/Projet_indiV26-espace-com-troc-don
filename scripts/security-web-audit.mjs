import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const targets = [
  join(root, 'apps', 'web'),
  join(root, 'compose.yaml'),
];

const allowedPublicEnv = new Set([
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_KEYCLOAK_URL',
  'NEXT_PUBLIC_KEYCLOAK_REALM',
  'NEXT_PUBLIC_KEYCLOAK_CLIENT_ID',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_LEGAL_CONTROLLER_NAME',
  'NEXT_PUBLIC_LEGAL_CONTACT_EMAIL',
  'NEXT_PUBLIC_LEGAL_HOST_NAME',
]);

const sensitivePublicName =
  /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PASS|PRIVATE|API_KEY|APIKEY|CREDENTIAL|ACCESS_KEY)[A-Z0-9_]*/gi;

const literalSecretPatterns = [
  { name: 'PEM private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'GitHub token', regex: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: 'AWS access key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'credential-bearing URL', regex: /https?:\/\/[^\s/:]+:[^\s/@]+@[^\s]+/g },
];

const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json',
  '.yaml', '.yml', '.env', '.example', '.md', '.html', '.css',
]);

const findings = [];

async function collect(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (
      textExtensions.has(extname(entry.name)) ||
      entry.name === 'Dockerfile' ||
      entry.name.startsWith('.env')
    ) files.push(full);
  }
  return files;
}

const files = [];
for (const target of targets) {
  try {
    const stat = await import('node:fs/promises').then(({ stat }) => stat(target));
    if (stat.isDirectory()) files.push(...await collect(target));
    else files.push(target);
  } catch {
    // Optional target absent.
  }
}

for (const file of files) {
  const content = await readFile(file, 'utf8');
  const short = relative(root, file);

  const publicNames = content.match(/NEXT_PUBLIC_[A-Z0-9_]+/g) ?? [];
  for (const name of new Set(publicNames)) {
    if (!allowedPublicEnv.has(name)) {
      findings.push(`${short}: unreviewed public env variable ${name}`);
    }
  }

  for (const match of content.matchAll(sensitivePublicName)) {
    findings.push(`${short}: sensitive public env name ${match[0]}`);
  }

  for (const pattern of literalSecretPatterns) {
    if (pattern.regex.test(content)) {
      findings.push(`${short}: possible ${pattern.name}`);
    }
    pattern.regex.lastIndex = 0;
  }
}

if (findings.length > 0) {
  console.error('Frontend public-configuration audit: FAIL');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  'Frontend public-configuration audit: PASS — only reviewed NEXT_PUBLIC variables and no secret signatures detected.',
);
