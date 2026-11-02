import * as assert from 'assert';
import { AdvancedComparison, AdvancedSelection, PairwiseOperation } from '../coverage/advancedComparison';
import { buildVisibleCoverage } from '../coverage/comparisonFilter';
import { CoverageStore } from '../coverage/coverageStore';
import { CoverageQuery } from '../coverage/coverageQuery';
import { CoverageSource } from '../coverage/types';

function fixture(): CoverageStore {
	const store = new CoverageStore();
	for (const [id, lines] of [['A', [1, 2, 3, 5]], ['B', [2, 3, 4, 5]], ['C', [3, 4, 6]]] as [string, number[]][]) {
		const source: CoverageSource = { id, name: `${id}.json`, filePath: `/${id}.json`, enabled: true, color: 'red', coverage: new Map([['/file.php', new Set(lines)]]) };
		store.add(source);
	}
	return store;
}
function lines(store: CoverageStore, selection: AdvancedSelection): number[] {
	return [...buildVisibleCoverage(new CoverageQuery(store).getCoverageForFile('/file.php'), 'exclusive', 'C', selection).keys()].sort((a, b) => a - b);
}

suite('Advanced comparison', () => {
	for (const [operation, expected] of [
		['both', [2, 3, 5]], ['only-a', [1]], ['only-b', [4]], ['either', [1, 2, 3, 4, 5]]
	] as [PairwiseOperation, number[]][]) {
		test(`pairwise ${operation} uses only A and B, independent of focus and third run`, () => {
			assert.deepStrictEqual(lines(fixture(), { kind: 'pairwise', sourceA: 'A', sourceB: 'B', operation }), expected);
		});
	}
	test('pairwise projection excludes third-run colors and preserves raw data', () => {
		const store = fixture();
		const raw = new CoverageQuery(store).getCoverageForFile('/file.php');
		const view = buildVisibleCoverage(raw, 'combined', undefined, { kind: 'pairwise', sourceA: 'A', sourceB: 'B', operation: 'both' });
		assert.deepStrictEqual(view.get(3)?.map(source => source.id), ['A', 'B']);
		assert.deepStrictEqual(raw.get(3)?.map(source => source.id), ['A', 'B', 'C']);
	});
	test('at least N and exactly N count all enabled runs', () => {
		const store = fixture();
		assert.deepStrictEqual(lines(store, { kind: 'multiplicity', rule: 'at-least', count: 2 }), [2, 3, 4, 5]);
		assert.deepStrictEqual(lines(store, { kind: 'multiplicity', rule: 'exactly', count: 2 }), [2, 4, 5]);
		assert.deepStrictEqual(lines(store, { kind: 'multiplicity', rule: 'at-least', count: 3 }), [3]);
		assert.deepStrictEqual(lines(store, { kind: 'multiplicity', rule: 'exactly', count: 1 }), [1, 6]);
		store.toggle('C');
		assert.deepStrictEqual(lines(store, { kind: 'multiplicity', rule: 'exactly', count: 2 }), [2, 3, 5]);
	});
	test('disabled or removed pair resets to standard and does not revive after enabling', () => {
		const store = fixture();
		const analysis = new AdvancedComparison(store);
		assert.ok(analysis.setPairwise('A', 'B'));
		store.toggle('B');
		assert.deepStrictEqual(analysis.getSelection(), { kind: 'standard' });
		store.toggle('B');
		assert.strictEqual(analysis.getSelection().kind, 'standard');
		analysis.setPairwise('A', 'B');
		store.remove('A');
		assert.strictEqual(analysis.getSelection().kind, 'standard');
	});
	test('cannot select duplicate, disabled, or missing sources', () => {
		const store = fixture();
		const analysis = new AdvancedComparison(store);
		assert.strictEqual(analysis.setPairwise('A', 'A'), false);
		assert.strictEqual(analysis.setPairwise('A', 'missing'), false);
		store.toggle('B');
		assert.strictEqual(analysis.setPairwise('A', 'B'), false);
		assert.strictEqual(analysis.getSelection().kind, 'standard');
	});
	test('invalid N is rejected; a threshold exceeding the new enabled count resets safely', () => {
		const store = fixture();
		const analysis = new AdvancedComparison(store);
		for (const count of [0, -1, 1.5, 4, NaN, Infinity]) {
			assert.strictEqual(analysis.setMultiplicity('exactly', count), false);
		}
		analysis.setMultiplicity('at-least', 3);
		store.toggle('C');
		assert.strictEqual(analysis.getSelection().kind, 'standard');
		assert.ok(analysis.setMultiplicity('exactly', 1));
		store.setAllEnabled(false);
		assert.strictEqual(analysis.getSelection().kind, 'standard');
		assert.strictEqual(analysis.setMultiplicity('exactly', 1), false);
	});
	test('one enabled run supports N=1 but cannot form a pair', () => {
		const store = fixture();
		store.enableOnly('A');
		const analysis = new AdvancedComparison(store);
		assert.strictEqual(analysis.setPairwise('A', 'B'), false);
		assert.ok(analysis.setMultiplicity('exactly', 1));
		assert.deepStrictEqual(lines(store, analysis.getSelection()), [1, 2, 3, 5]);
	});
	test('pair missing a file behaves as empty coverage without changing selection', () => {
		const store = fixture();
		store.get('B')!.coverage.clear();
		const analysis = new AdvancedComparison(store);
		analysis.setPairwise('A', 'B', 'both');
		assert.deepStrictEqual(lines(store, analysis.getSelection()), []);
		analysis.setPairwiseOperation('only-a');
		assert.deepStrictEqual(lines(store, analysis.getSelection()), [1, 2, 3, 5]);
		assert.strictEqual(analysis.getSelection().kind, 'pairwise');
	});
	test('standard selection still honors focus; reset and fresh sessions use standard', () => {
		const store = fixture();
		const analysis = new AdvancedComparison(store);
		assert.deepStrictEqual(lines(store, analysis.getSelection()), [6]);
		analysis.setPairwise('A', 'B');
		analysis.reset();
		assert.deepStrictEqual(lines(store, analysis.getSelection()), [6]);
		assert.deepStrictEqual(new AdvancedComparison(store).getSelection(), { kind: 'standard' });
	});
});
