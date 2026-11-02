import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { parseCoverageFile } from '../coverage/parser';
import { CoverageStore } from '../coverage/coverageStore';

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
			{ '/remote/a.php': { '1.5': 1 } }, { '/remote/a.php': { '-1': 1 } }]) {
			await fs.writeFile(filename, JSON.stringify(invalid));
			await assert.rejects(parseCoverageFile(filename), /Coverage JSON|Invalid coverage/);
		}
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
