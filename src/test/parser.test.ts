import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { parseCoverageFile } from '../coverage/parser';
import { CoverageStore } from '../coverage/coverageStore';
import { CoverageQuery } from '../coverage/coverageQuery';
import { buildVisibleCoverage } from '../coverage/comparisonFilter';

suite('Coverage loading robustness', () => {
	let directory: string;
	setup(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-parser-')); });
	teardown(async () => { await fs.rm(directory, { recursive: true, force: true }); });

	test('missing files and malformed JSON reject cleanly', async () => {
		const filename = path.join(directory, 'run.json');
		await assert.rejects(parseCoverageFile(filename), /ENOENT/);
		await fs.writeFile(filename, '{broken');
		await assert.rejects(parseCoverageFile(filename), SyntaxError);
	});

	test('invalid coverage shapes and invalid line entries are rejected', async () => {
		const filename = path.join(directory, 'run.json');
		for (const invalid of [null, [], 'text', 42, { '/remote/a.php': null },
			{ '/remote/a.php': [] }, { '/remote/a.php': { '1': 0 } },
			{ '/remote/a.php': { '1.5': 1 } }, { '/remote/a.php': { '-1': 1 } },
			{ '/remote/a.php': { abc: 1 } }, { '/remote/a.php': { Infinity: 1 } },
			{ '/remote/a.php': { '9007199254740992': 1 } },
			{ '/remote/a.php': { '1e3': 1 } }, { '/remote/a.php': { '': 1 } }]) {
			await fs.writeFile(filename, JSON.stringify(invalid));
			await assert.rejects(parseCoverageFile(filename), /Coverage JSON|Invalid coverage/);
		}
	});

	test('empty text is rejected while empty data and empty source sets are valid', async () => {
		const filename = path.join(directory, 'empty.json');
		await fs.writeFile(filename, '');
		await assert.rejects(parseCoverageFile(filename), SyntaxError);
		await fs.writeFile(filename, '{}');
		assert.strictEqual((await parseCoverageFile(filename)).size, 0);
		await fs.writeFile(filename, JSON.stringify({ '/remote/empty.php': {} }));
		const coverage = await parseCoverageFile(filename);
		assert.ok(coverage.has('/remote/empty.php'));
		assert.strictEqual(coverage.get('/remote/empty.php')!.size, 0);
	});

	test('Unicode filenames and thousands of coverage paths are parsed completely', async () => {
		const filename = path.join(directory, 'épreuve-測試.json');
		const entries = Array.from({ length: 1200 }, (_, index) => [
			`/remote/測試/épreuve-${index}.inc`, { '0': 1, '1': 1, '9007199254740991': 1 }
		]);
		await fs.writeFile(filename, JSON.stringify(Object.fromEntries(entries)));
		const coverage = await parseCoverageFile(filename);
		assert.strictEqual(coverage.size, 1200);
		assert.deepStrictEqual([...coverage.get('/remote/測試/épreuve-1199.inc')!], [0, 1, Number.MAX_SAFE_INTEGER]);
	});

	test('slash and dot aliases merge line sets inside a coverage file', async () => {
		const filename = path.join(directory, 'aliases.json');
		await fs.writeFile(filename, JSON.stringify({
			'/remote/edit.php': { '1': 1 },
			'/remote/./edit.php': { '2': 1 },
			'\\remote\\edit.php': { '3': 1 },
			'/remote/include/../edit.php': { '2': 1, '4': 1 }
		}));
		const coverage = await parseCoverageFile(filename);
		assert.strictEqual(coverage.size, 1);
		assert.deepStrictEqual([...coverage.get('/remote/edit.php')!].sort((a, b) => a - b), [1, 2, 3, 4]);
	});

	test('different path spellings across runs participate in the same file comparison', async () => {
		const store = new CoverageStore();
		for (const [id, sourcePath, lines] of [
			['A', '/remote/./edit.php', { '1': 1, '2': 1 }],
			['B', '\\remote\\edit.php', { '2': 1, '3': 1 }]
		] as const) {
			const filename = path.join(directory, `${id}.json`);
			await fs.writeFile(filename, JSON.stringify({ [sourcePath]: lines }));
			store.add({ id, name: `${id}.json`, filePath: filename, color: 'red', enabled: true, coverage: await parseCoverageFile(filename) });
		}
		const coverage = new CoverageQuery(store).getCoverageForFile('/remote/edit.php');
		assert.deepStrictEqual([...buildVisibleCoverage(coverage, 'combined').keys()].sort(), [1, 2, 3]);
		assert.deepStrictEqual([...buildVisibleCoverage(coverage, 'shared').keys()], [2]);
		assert.deepStrictEqual(coverage.get(2)?.map(source => source.id), ['A', 'B']);
	});

	test('all paths are parsed without requiring local source files; reloading replaces the source', async () => {
		const filename = path.join(directory, 'run.json');
		await fs.writeFile(filename, JSON.stringify({
			'/remote/missing.php': { '0': 1, '1': 1 }, '/remote/helper.inc': { '3': 1 }
		}));
		const coverage = await parseCoverageFile(filename);
		assert.deepStrictEqual([...coverage.get('/remote/missing.php')!], [0, 1]);
		assert.deepStrictEqual([...coverage.get('/remote/helper.inc')!], [3]);
		const store = new CoverageStore();
		const source = { id: filename, name: 'run.json', filePath: filename, color: 'red', enabled: false, coverage };
		store.add(source);
		await fs.writeFile(filename, JSON.stringify({ '/remote/missing.php': { '2': 1 } }));
		store.add({ ...source, coverage: await parseCoverageFile(filename) });
		assert.strictEqual(store.size, 1);
		assert.strictEqual(store.get(filename)?.enabled, false);
		assert.deepStrictEqual([...store.get(filename)!.coverage.get('/remote/missing.php')!], [2]);
	});
});
