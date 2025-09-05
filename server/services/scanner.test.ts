import assert from 'node:assert';
import test from 'node:test';
import fs from 'fs/promises';
import PDFDocument from 'pdfkit';
import { generateReport } from './scanner.ts';

const BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/ivv0wAAAABJRU5ErkJggg==';

function createResults(screenshot: string) {
  return {
    violations: [],
    passes: [],
    incomplete: [],
    screenshot
  };
}

async function runWithScreenshot(screenshot: string) {
  let received: unknown;
  const original = PDFDocument.prototype.image;
  PDFDocument.prototype.image = function (src: any, ...rest: any[]) {
    received = src;
    return this as any;
  };
  try {
    const reportPath = await generateReport('http://example.com', createResults(screenshot));
    assert.ok(Buffer.isBuffer(received));
    await fs.unlink(reportPath);
  } finally {
    PDFDocument.prototype.image = original;
  }
}

test('generateReport handles screenshot without prefix', async () => {
  await runWithScreenshot(BASE64_PNG);
});

test('generateReport handles screenshot with data URL prefix', async () => {
  await runWithScreenshot(`data:image/png;base64,${BASE64_PNG}`);
});
