#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src', 'app');
const OUTPUT = path.join(__dirname, '..', 'reports', 'i18n-hardcoded-audit.md');
const INCLUDED_EXTENSIONS = new Set(['.html', '.ts']);
const SKIP_PATTERNS = [
  /[\\/]demo[\\/]/,
  /\.spec\.ts$/,
  /CASE_DETAILS_STYLING\.md$/,
  /[\\/]icons[\\/]/
];

const HTML_ATTRIBUTE_REGEX = /\b(?:placeholder|title|aria-label|matTooltip|label)\s*=\s*"([^"]*[A-Za-zÀ-ÿ\u0600-\u06FF][^"]*)"/g;
const HTML_TEXT_REGEX = />([^<{}]*[A-Za-zÀ-ÿ\u0600-\u06FF][^<{}]*)</g;
const STRING_LITERAL_REGEX = /(['"`])((?:\\.|(?!\1).)*)\1/g;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (!INCLUDED_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    if (SKIP_PATTERNS.some((pattern) => pattern.test(fullPath))) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function countLineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function shouldIgnoreCandidate(text, line, filePath) {
  if (!text) return true;
  const trimmedLine = line.trim();
  if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) return true;
  if (!/[A-Za-zÀ-ÿ\u0600-\u06FF]/.test(text)) return true;
  if (/^common\.|^nav\.|^header\.|^field\.|^routes\.|^caseDetail\.|^cases\./.test(text)) return true;
  if (/^(cil[A-Za-z]+|ROLE_[A-Z_]+|[A-Z0-9_]{3,})$/.test(text)) return true;
  if (/^(\/|\.\/|\.\.\/|assets\/|https?:\/\/|app-|bg-|text-|border-|col-|row$|true$|false$)/.test(text)) return true;
  if (/[\\/]/.test(text) || /\$\{/.test(text) || /\.component$|\.routes$|\.json$/.test(text)) return true;
  if (/^(&amp;|&lt;|&gt;|&quot;|&copy;)$/i.test(text)) return true;
  if (/^#?[A-F0-9]{6}$/i.test(text) || /^\[[^\]]+\]$/.test(text)) return true;
  if (/^(dd|MM|MMM|yyyy|HH|mm)([\s:/-]+(dd|MM|MMM|yyyy|HH|mm))*$/i.test(text)) return true;
  if (text.length <= 1) return true;
  if (/^[0-9\s.,:%/+-]+$/.test(text)) return true;
  if (/^\{\{.*\}\}$/.test(text)) return true;
  if (/^(?:[a-z0-9_:-]+(?:\s+[a-z0-9_:-]+)+)$/i.test(text) && /class=|\[ngClass\]|styles:\s*\[/.test(line)) return true;
  if (/^(?:noopener|noreferrer|document:click|\$event|https:|wss?:)$/i.test(text)) return true;
  if (/^(?:[a-z0-9_.-]+(?:\s+[a-z0-9_.-]+)*)$/i.test(text) && !/\s[A-Z]/.test(text) && /class=|selector:|styles:|template:|icon:/.test(line)) return true;
  if (/; else |\|\||&&|=>/.test(text)) return true;
  if (/from\s+['"`]/.test(line) || /import\s+/.test(line)) return true;
  if (/translate\(|transloco/.test(line)) return true;
  if (/routerLink|iconComponent|styleUrl|templateUrl|selector|eventType|entityType|status:|color:|icon:|url:|path:|loadComponent|loadChildren|api\/v\d|baseUrl|analyticsUrl|importUrl|console\./.test(line)) return true;
  if (filePath.endsWith('.ts') && /^[a-z0-9_.-]+$/i.test(text) && !/\s/.test(text)) return true;
  return false;
}

function proposeKey(filePath, text) {
  const rel = path.relative(ROOT, filePath)
    .replace(/\.[^.]+$/, '')
    .split(path.sep)
    .map((segment) => segment.replace(/[^a-zA-Z0-9]+/g, ''))
    .filter(Boolean)
    .map((segment) => segment[0].toLowerCase() + segment.slice(1));

  const slug = normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('.');

  return [...rel, slug || 'label'].join('.');
}

function collectFromHtml(filePath, content) {
  const findings = [];

  for (const regex of [HTML_ATTRIBUTE_REGEX, HTML_TEXT_REGEX]) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const raw = normalizeText(match[1]);
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);

      if (shouldIgnoreCandidate(raw, line, filePath)) {
        continue;
      }

      findings.push({
        file: filePath,
        line: countLineNumber(content, match.index),
        text: raw,
        shouldTranslate: 'yes',
        proposedKey: proposeKey(filePath, raw)
      });
    }
  }

  return findings;
}

function collectFromTs(filePath, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    STRING_LITERAL_REGEX.lastIndex = 0;
    let match;

    while ((match = STRING_LITERAL_REGEX.exec(line)) !== null) {
      const raw = normalizeText(match[2]);

      if (shouldIgnoreCandidate(raw, line, filePath)) {
        continue;
      }

      findings.push({
        file: filePath,
        line: index + 1,
        text: raw,
        shouldTranslate: 'yes',
        proposedKey: proposeKey(filePath, raw)
      });
    }
  });

  return findings;
}

function uniqueFindings(findings) {
  const seen = new Set();
  return findings.filter((item) => {
    const key = `${item.file}:${item.line}:${item.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function toMarkdown(findings) {
  const lines = [
    '# Hardcoded UI String Audit',
    '',
    '| File | Line | Remaining text | Should translate | Proposed translation key |',
    '| --- | ---: | --- | --- | --- |'
  ];

  for (const item of findings) {
    const rel = path.relative(path.join(__dirname, '..'), item.file).replace(/\\/g, '/');
    const escapedText = item.text.replace(/\|/g, '\\|');
    lines.push(`| ${rel} | ${item.line} | ${escapedText} | ${item.shouldTranslate} | ${item.proposedKey} |`);
  }

  return `${lines.join('\n')}\n`;
}

const findings = uniqueFindings(
  walk(ROOT).flatMap((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    return path.extname(filePath) === '.html'
      ? collectFromHtml(filePath, content)
      : collectFromTs(filePath, content);
  })
).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.text.localeCompare(b.text));

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, toMarkdown(findings), 'utf8');

console.log(`[i18n-audit] Wrote ${findings.length} findings to ${path.relative(path.join(__dirname, '..'), OUTPUT)}`);
