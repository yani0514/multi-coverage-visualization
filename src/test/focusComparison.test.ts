import * as assert from 'assert';
import { CoverageStore } from '../coverage/coverageStore';
import { CoverageQuery } from '../coverage/coverageQuery';
import { CoverageSource } from '../coverage/types';
import { FocusSourceSelection } from '../coverage/focusSourceSelection';
import { buildVisibleCoverage } from '../coverage/comparisonFilter';
import { ComparisonMode } from '../coverage/comparisonMode';
import { analyzeCurrentFile } from '../coverage/coverageAnalysis';

export function focusFixture(three = false): CoverageStore {
	const store = new CoverageStore();
	const entries: Array<[string, number[]]> = three
		? [['A', [1, 2, 3, 4]], ['B', [2, 3, 4, 5]], ['C', [3, 4, 5, 6]]]
		: [['A', [1, 2, 3, 5]], ['B', [2, 3, 4, 5]]];
	for (const [id, lines] of entries) {
		const source: CoverageSource = {
			id, name: `${id}.json`, filePath: `/runs/${id}.json`, color: 'rgba(1,2,3,0.20)',
			enabled: true, coverage: new Map([['/remote/edit.php', new Set(lines)]])
		};
		store.add(source);
	}
	return store;
}

function lines(store: CoverageStore, mode: ComparisonMode, focus?: string): number[] {
	return [...buildVisibleCoverage(new CoverageQuery(store).getCoverageForFile('/remote/edit.php'), mode, focus).keys()]
		.sort((a, b) => a - b);
}

suite('Focus comparison and selection', () => {
	test('None retains global comparison semantics', () => {
		const store = focusFixture();
		assert.deepStrictEqual(lines(store, 'combined'), [1, 2, 3, 4, 5]);
		assert.deepStrictEqual(lines(store, 'exclusive'), [1, 4]);
		assert.deepStrictEqual(lines(store, 'shared'), [2, 3, 5]);
	});
	test('focus A shows its coverage, its exclusive lines and its shared lines', () => {
		const store = focusFixture();
		assert.deepStrictEqual(lines(store, 'combined', 'A'), [1, 2, 3, 5]);
		assert.deepStrictEqual(lines(store, 'exclusive', 'A'), [1]);
		assert.deepStrictEqual(lines(store, 'shared', 'A'), [2, 3, 5]);
	});
	test('focus B changes membership while preserving multiplicity rules', () => {
		const store = focusFixture();
		assert.deepStrictEqual(lines(store, 'combined', 'B'), [2, 3, 4, 5]);
		assert.deepStrictEqual(lines(store, 'exclusive', 'B'), [4]);
		assert.deepStrictEqual(lines(store, 'shared', 'B'), [2, 3, 5]);
	});
	test('three sources include pairwise and three-way coverage shared with focus', () => {
		const store = focusFixture(true);
		assert.deepStrictEqual(lines(store, 'combined', 'A'), [1, 2, 3, 4]);
		assert.deepStrictEqual(lines(store, 'exclusive', 'A'), [1]);
		assert.deepStrictEqual(lines(store, 'shared', 'A'), [2, 3, 4]);
		store.toggle('B');
		assert.deepStrictEqual(lines(store, 'combined', 'A'), [1, 2, 3, 4]);
		assert.deepStrictEqual(lines(store, 'exclusive', 'A'), [1, 2]);
		assert.deepStrictEqual(lines(store, 'shared', 'A'), [3, 4]);
	});
	test('a sole enabled focus has all its lines exclusive and none shared', () => {
		const store = focusFixture();
		store.toggle('B');
		assert.deepStrictEqual(lines(store, 'combined', 'A'), [1, 2, 3, 5]);
		assert.deepStrictEqual(lines(store, 'exclusive', 'A'), [1, 2, 3, 5]);
		assert.deepStrictEqual(lines(store, 'shared', 'A'), []);
	});
	test('focus cannot select disabled or absent runs and resets on disable/remove', () => {
		const store = focusFixture();
		const focus = new FocusSourceSelection(store);
		assert.strictEqual(focus.getSourceId(), undefined);
		focus.select('A');
		focus.select('missing');
		assert.strictEqual(focus.getSourceId(), 'A');
		store.toggle('B');
		focus.select('B');
		assert.strictEqual(focus.getSourceId(), 'A');
		store.toggle('A');
		assert.strictEqual(focus.getSourceId(), undefined);
		store.toggle('A');
		assert.strictEqual(focus.getSourceId(), undefined);
		focus.select('A');
		store.remove('A');
		assert.strictEqual(focus.getSourceId(), undefined);
	});
	test('disable all clears focus; fresh sessions start with None', () => {
		const store = focusFixture();
		const focus = new FocusSourceSelection(store);
		focus.select('A');
		store.setAllEnabled(false);
		assert.strictEqual(focus.getSourceId(), undefined);
		assert.deepStrictEqual(lines(store, 'combined'), []);
		store.setAllEnabled(true);
		focus.select('A');
		assert.strictEqual(new FocusSourceSelection(store).getSourceId(), undefined);
	});
	test('Show Only B changes enabled states without implicitly choosing focus', () => {
		const store = focusFixture(true);
		const focus = new FocusSourceSelection(store);
		store.enableOnly('B');
		assert.deepStrictEqual(store.getAll().map(source => source.enabled), [false, true, false]);
		assert.strictEqual(focus.getSourceId(), undefined);
		focus.select('B');
		store.enableOnly('B');
		assert.strictEqual(focus.getSourceId(), 'B');
		store.enableOnly('A');
		assert.strictEqual(focus.getSourceId(), undefined);
		store.enableOnly('missing');
		assert.deepStrictEqual(store.getAll().map(source => source.enabled), [true, false, false]);
	});
	test('focus missing the current file has no visible lines and stays selected', () => {
		const store = focusFixture();
		store.get('A')!.coverage.clear();
		const focus = new FocusSourceSelection(store);
		focus.select('A');
		assert.deepStrictEqual(lines(store, 'combined', focus.getSourceId()), []);
		assert.strictEqual(focus.getSourceId(), 'A');
	});
	test('focus filtering preserves contributors, raw maps, and Current File global totals', () => {
		const store = focusFixture();
		const raw = new CoverageQuery(store).getCoverageForFile('/remote/edit.php');
		const view = buildVisibleCoverage(raw, 'shared', 'A');
		assert.deepStrictEqual(view.get(2)?.map(source => source.id), ['A', 'B']);
		assert.strictEqual(raw.size, 5);
		assert.strictEqual(store.get('A')!.coverage.get('/remote/edit.php')!.size, 4);
		const stats = analyzeCurrentFile({ state: 'mapped', localPath: '/local/edit.php', coveragePath: '/remote/edit.php', coverage: raw, sources: store.getAll() });
		if (stats.state !== 'mapped') { assert.fail('Expected mapped statistics'); }
		assert.deepStrictEqual([stats.combined, stats.shared, stats.exclusive], [5, 3, 2]);
	});
});
