import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const sourceRoots = [
  join(root, 'apps', 'web', 'app'),
  join(root, 'apps', 'web', 'components'),
];

const staticRoutes = new Set([
  '/',
  '/admin',
  '/espace',
  '/moderation',
]);

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

function jsxTagName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return node.getText();
}

function getAttribute(attributes, name) {
  return attributes.properties.find(
    (property) =>
      ts.isJsxAttribute(property) &&
      property.name.getText() === name,
  );
}

function literalAttributeValue(attribute) {
  if (!attribute || !ts.isJsxAttribute(attribute)) return null;
  const initializer = attribute.initializer;

  if (!initializer) return '';

  if (ts.isStringLiteral(initializer)) {
    return initializer.text;
  }

  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression &&
    (
      ts.isStringLiteral(initializer.expression) ||
      ts.isNoSubstitutionTemplateLiteral(initializer.expression)
    )
  ) {
    return initializer.expression.text;
  }

  return null;
}

function isKnownInternalRoute(href) {
  if (
    href.startsWith('#') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return true;
  }

  if (!href.startsWith('/')) {
    return false;
  }

  const path = href.split(/[?#]/, 1)[0] || '/';

  if (staticRoutes.has(path)) {
    return true;
  }

  return /^\/annonces\/[^/]+$/.test(path);
}

const findings = [];
const files = [];

for (const sourceRoot of sourceRoots) {
  files.push(...await collect(sourceRoot));
}

for (const file of files) {
  const content = await readFile(file, 'utf8');
  const short = relative(root, file);
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxOpeningElement(node)
    ) {
      const tag = jsxTagName(node.tagName);

      if (tag === 'img') {
        const alt = getAttribute(node.attributes, 'alt');
        if (!alt) {
          findings.push(
            `${short}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}: <img> without alt attribute`,
          );
        }
      }

      if (tag === 'a' || tag === 'Link') {
        const hrefAttribute = getAttribute(node.attributes, 'href');
        const href = literalAttributeValue(hrefAttribute);

        if (href !== null && !isKnownInternalRoute(href)) {
          findings.push(
            `${short}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}: invalid literal href "${href}"`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (findings.length > 0) {
  console.error('Web static quality audit: FAIL');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  `Web static quality audit: PASS — ${files.length} TypeScript/TSX files checked with the TypeScript AST.`,
);
