/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as assert from 'assert';
import { createMockVscode } from './helpers';

const proxyquire = require('proxyquire').noCallThru();

// Both modules import 'vscode' at top-level — proxyquire keeps tests
// out of the VS Code runtime.
const mockVscode = createMockVscode();
const { sanitizeKeyterms } = proxyquire('../elevenLabsService', {
    vscode: mockVscode,
    ws: class {},
}) as { sanitizeKeyterms: (terms: any[]) => string[] };
const { parseKeytermOutput } = proxyquire('../claudeKeyterms', {
    vscode: mockVscode,
    './elevenLabsService': { sanitizeKeyterms },
}) as { parseKeytermOutput: (stdout: string) => { kept: string[]; rejected: string[] } };

describe('sanitizeKeyterms', () => {
    it('trims whitespace and drops empties', () => {
        const out = sanitizeKeyterms(['  numpy ', '', '   ', 'pandas']);
        assert.deepStrictEqual(out, ['numpy', 'pandas']);
    });

    it('drops terms longer than 20 chars', () => {
        const out = sanitizeKeyterms([
            'short',
            'twenty-chars-exactly',  // 20 chars — keep
            'twenty-one-chars-here',  // 21 chars — drop
        ]);
        assert.strictEqual(out.length, 2);
        assert.ok(out.includes('short'));
        assert.ok(out.includes('twenty-chars-exactly'));
    });

    it('deduplicates case-insensitively, preserving first form', () => {
        const out = sanitizeKeyterms(['useState', 'usestate', 'UseState']);
        assert.deepStrictEqual(out, ['useState']);
    });

    it('caps at 50 entries', () => {
        const many = Array.from({ length: 100 }, (_, i) => `t${i}`);
        const out = sanitizeKeyterms(many);
        assert.strictEqual(out.length, 50);
        assert.strictEqual(out[0], 't0');
        assert.strictEqual(out[49], 't49');
    });

    it('handles non-string inputs defensively', () => {
        // Despite typing as string[], deserialized JSON could carry nulls or numbers
        const messy = [null, undefined, 123, 'ok', { word: 'no' }] as unknown as string[];
        const out = sanitizeKeyterms(messy);
        // 'ok' kept; [object Object] is 15 chars but legitimately weird — we accept it
        // because string coercion may produce truthy non-empty strings; the explicit
        // contract is "trimmed string ≤ 20 chars, non-empty".
        assert.ok(out.includes('ok'));
        assert.ok(out.includes('123'));
    });
});

describe('parseKeytermOutput', () => {
    it('extracts plain one-per-line terms', () => {
        const raw = 'numpy\npandas\nfastapi';
        const { kept } = parseKeytermOutput(raw);
        assert.deepStrictEqual(kept, ['numpy', 'pandas', 'fastapi']);
    });

    it('strips markdown bullets', () => {
        const raw = '- numpy\n* pandas\n+ fastapi';
        const { kept } = parseKeytermOutput(raw);
        assert.deepStrictEqual(kept, ['numpy', 'pandas', 'fastapi']);
    });

    it('strips numbering', () => {
        const raw = '1. numpy\n2) pandas\n3 fastapi';
        const { kept } = parseKeytermOutput(raw);
        assert.deepStrictEqual(kept, ['numpy', 'pandas', 'fastapi']);
    });

    it('strips wrapping quotes', () => {
        const raw = '"numpy"\n`pandas`\n\'fastapi\'';
        const { kept } = parseKeytermOutput(raw);
        assert.deepStrictEqual(kept, ['numpy', 'pandas', 'fastapi']);
    });

    it('reports rejected terms (> 20 chars)', () => {
        const raw = 'numpy\nthis-line-is-way-over-twenty-chars-long\npandas';
        const { kept, rejected } = parseKeytermOutput(raw);
        assert.deepStrictEqual(kept, ['numpy', 'pandas']);
        assert.ok(rejected.includes('this-line-is-way-over-twenty-chars-long'));
    });

    it('returns empty arrays for empty input', () => {
        const { kept, rejected } = parseKeytermOutput('');
        assert.deepStrictEqual(kept, []);
        assert.deepStrictEqual(rejected, []);
    });
});
