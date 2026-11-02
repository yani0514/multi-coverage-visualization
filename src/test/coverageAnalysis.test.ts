import * as assert from 'assert';
import { analyzeCurrentFile, CurrentFileCoverage } from '../coverage/coverageAnalysis';
import { CoverageStore } from '../coverage/coverageStore';
import { CoverageQuery } from '../coverage/coverageQuery';
import { CoverageSource } from '../coverage/types';

function source(id: string, lines: number[]): CoverageSource {
	return {
		id, name: `${id}.json`, filePath: `/runs/${id}.json`, color: 'rgba(1,2,3,0.20)', enabled: true,
		coverage: new Map([['/remote/edit.php', new Set(lines)]])
	};
}

function snapshot(sources: CoverageSource[], coveragePath = '/remote/edit.php'): CurrentFileCoverage {
	const store = new CoverageStore();
	sources.forEach(item => store.add(item));
	return {
		state: 'mapped', localPath: '/local/edit.php', coveragePath, sources,
		coverage: new CoverageQuery(store).getCoverageForFile(coveragePath)
	};
}

suite('Current File statistics', () => {
	test('two sources have 4 lines each, Combined 5, Shared 3, Exclusive 2', () => {
		const stats = analyzeCurrentFile(snapshot([source('A', [1, 2, 3, 5]), source('B', [2, 3, 4, 5])]));
		assert.strictEqual(stats.state, 'mapped');
		if (stats.state !== 'mapped') { return; }
		assert.deepStrictEqual(stats.sources.map(item => item.count), [4, 4]);
		assert.deepStrictEqual([stats.combined, stats.shared, stats.exclusive], [5, 3, 2]);
	});

	test('three sources use at least two for Shared rather than all sources', () => {
		const stats = analyzeCurrentFile(snapshot([
			source('A', [1, 2, 3, 4]), source('B', [2, 3, 4, 5]), source('C', [3, 4, 5, 6])
		]));
		assert.strictEqual(stats.state, 'mapped');
		if (stats.state !== 'mapped') { return; }
		assert.deepStrictEqual(stats.sources.map(item => item.count), [4, 4, 4]);
		assert.deepStrictEqual([stats.combined, stats.shared, stats.exclusive], [6, 4, 2]);
	});

	test('disabled sources are absent from rows and aggregate counts', () => {
		const a = source('A', [1, 2, 3, 5]);
		const b = source('B', [2, 3, 4, 5]);
		b.enabled = false;
		const stats = analyzeCurrentFile(snapshot([a, b]));
		assert.strictEqual(stats.state, 'mapped');
		if (stats.state !== 'mapped') { return; }
		assert.deepStrictEqual(stats.sources.map(item => item.id), ['A']);
		assert.deepStrictEqual([stats.combined, stats.shared, stats.exclusive], [4, 0, 4]);
	});

	test('counts positive data lines beyond editor bounds and ignores zero and invalid numbers', () => {
		const a = source('A', [0, 1, 2, 999, -1, 1.5, NaN, Infinity]);
		const stats = analyzeCurrentFile(snapshot([a]));
		assert.strictEqual(stats.state, 'mapped');
		if (stats.state !== 'mapped') { return; }
		assert.strictEqual(stats.sources[0].count, 3);
		assert.deepStrictEqual([stats.combined, stats.shared, stats.exclusive], [3, 0, 3]);
		assert.strictEqual(a.coverage.get('/remote/edit.php')!.size, 8);
	});

	test('enabled runs missing the file show zero lines', () => {
		const a = source('A', [1, 2]);
		const b = source('B', []);
		b.coverage.clear();
		const stats = analyzeCurrentFile(snapshot([a, b]));
		assert.strictEqual(stats.state, 'mapped');
		if (stats.state !== 'mapped') { return; }
		assert.deepStrictEqual(stats.sources.map(item => item.count), [2, 0]);
		assert.deepStrictEqual([stats.combined, stats.shared, stats.exclusive], [2, 0, 2]);
	});

	test('zero enabled sources produce empty rows and zero totals', () => {
		const a = source('A', [1, 2]);
		a.enabled = false;
		const stats = analyzeCurrentFile(snapshot([a]));
		assert.strictEqual(stats.state, 'mapped');
		if (stats.state !== 'mapped') { return; }
		assert.deepStrictEqual(stats.sources, []);
		assert.deepStrictEqual([stats.combined, stats.shared, stats.exclusive], [0, 0, 0]);
	});

	test('no-editor and unmapped states contain no previous counts', () => {
		assert.deepStrictEqual(analyzeCurrentFile({ state: 'no-editor' }), { state: 'no-editor' });
		assert.deepStrictEqual(analyzeCurrentFile({ state: 'unmapped', localPath: '/other.php' }), {
			state: 'unmapped', localPath: '/other.php'
		});
	});

	test('switching mapped files recomputes statistics independently', () => {
		const a = source('A', [1, 2]);
		a.coverage.set('/remote/birthdays.php', new Set([7]));
		const first = analyzeCurrentFile(snapshot([a]));
		const second = analyzeCurrentFile(snapshot([a], '/remote/birthdays.php'));
		assert.strictEqual(first.state, 'mapped');
		assert.strictEqual(second.state, 'mapped');
		if (first.state !== 'mapped' || second.state !== 'mapped') { return; }
		assert.strictEqual(first.combined, 2);
		assert.strictEqual(second.combined, 1);
		assert.strictEqual(second.coveragePath, '/remote/birthdays.php');
	});
});
