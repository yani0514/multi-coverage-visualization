import * as assert from 'assert';

import {
	applyComparisonMode,
	buildVisibleCoverage,
	filterEnabledSources,
	LineCoverage
} from '../coverage/comparisonFilter';
import { ComparisonMode } from '../coverage/comparisonMode';
import { CoverageSource } from '../coverage/types';

function createSource(
	id: string,
	enabled = true
): CoverageSource {
	return {
		id,
		name: `${id}.json`,
		filePath: `C:\\coverage\\${id}.json`,
		color: 'rgba(0, 0, 0, 0.20)',
		enabled,
		coverage: new Map()
	};
}

function createFileCoverage(
	entries: Array<
		[number, CoverageSource[]]
	>
): LineCoverage {
	return new Map(entries);
}

function coveredLines(
	fileCoverage: LineCoverage
): number[] {
	return Array.from(
		fileCoverage.keys()
	).sort((a, b) => a - b);
}

function linesForMode(
	fileCoverage: LineCoverage,
	mode: ComparisonMode
): number[] {
	return coveredLines(
		applyComparisonMode(
			filterEnabledSources(
				fileCoverage
			),
			mode
		)
	);
}

suite('Comparison filtering', () => {
	test('filtering leaves the original maps and source lists intact', () => {
		const sourceA = createSource('a');
		const sourceB = createSource('b', false);
		sourceA.coverage.set('/remote/edit.php', new Set([1, 2]));
		const sources = [sourceA, sourceB];
		const raw = createFileCoverage([[1, sources]]);
		assert.strictEqual(buildVisibleCoverage(raw, 'shared').size, 0);
		const visible = buildVisibleCoverage(raw, 'exclusive');
		assert.deepStrictEqual(visible.get(1), [sourceA]);
		assert.strictEqual(raw.get(1), sources);
		assert.deepStrictEqual(sources, [sourceA, sourceB]);
		assert.deepStrictEqual([...sourceA.coverage.get('/remote/edit.php')!], [1, 2]);
		sourceB.enabled = true;
		assert.deepStrictEqual(buildVisibleCoverage(raw, 'shared').get(1), sources);
		for (const mode of ['combined', 'shared', 'exclusive'] as const) {
			assert.strictEqual(buildVisibleCoverage(new Map(), mode).size, 0);
		}
	});
	test('two enabled sources produce combined, shared and exclusive views', () => {
		const sourceA = createSource('source-a');
		const sourceB = createSource('source-b');

		const fileCoverage =
			createFileCoverage([
				[1, [sourceA]],
				[2, [sourceA, sourceB]],
				[3, [sourceA, sourceB]],
				[4, [sourceB]],
				[5, [sourceA, sourceB]]
			]);

		assert.deepStrictEqual(
			linesForMode(
				fileCoverage,
				'combined'
			),
			[1, 2, 3, 4, 5]
		);

		assert.deepStrictEqual(
			linesForMode(
				fileCoverage,
				'shared'
			),
			[2, 3, 5]
		);

		assert.deepStrictEqual(
			linesForMode(
				fileCoverage,
				'exclusive'
			),
			[1, 4]
		);
	});

	test('disabling a source removes it from every comparison mode', () => {
		const sourceA = createSource('source-a');
		const sourceB = createSource(
			'source-b',
			false
		);

		const fileCoverage =
			createFileCoverage([
				[1, [sourceA]],
				[2, [sourceA, sourceB]],
				[3, [sourceA, sourceB]],
				[4, [sourceB]],
				[5, [sourceA, sourceB]]
			]);

		assert.deepStrictEqual(
			coveredLines(
				buildVisibleCoverage(
					fileCoverage,
					'combined'
				)
			),
			[1, 2, 3, 5]
		);

		assert.deepStrictEqual(
			coveredLines(
				buildVisibleCoverage(
					fileCoverage,
					'shared'
				)
			),
			[]
		);

		assert.deepStrictEqual(
			coveredLines(
				buildVisibleCoverage(
					fileCoverage,
					'exclusive'
				)
			),
			[1, 2, 3, 5]
		);
	});

	test('shared means at least two sources, not every enabled source', () => {
		const sourceA = createSource('source-a');
		const sourceB = createSource('source-b');
		const sourceC = createSource('source-c');

		const fileCoverage =
			createFileCoverage([
				[1, [sourceA]],
				[2, [sourceA, sourceB]],
				[
					3,
					[
						sourceA,
						sourceB,
						sourceC
					]
				],
				[
					4,
					[
						sourceA,
						sourceB,
						sourceC
					]
				],
				[5, [sourceB, sourceC]],
				[6, [sourceC]]
			]);

		assert.deepStrictEqual(
			linesForMode(
				fileCoverage,
				'combined'
			),
			[1, 2, 3, 4, 5, 6]
		);

		assert.deepStrictEqual(
			linesForMode(
				fileCoverage,
				'shared'
			),
			[2, 3, 4, 5]
		);

		assert.deepStrictEqual(
			linesForMode(
				fileCoverage,
				'exclusive'
			),
			[1, 6]
		);
	});

	test('zero enabled sources produce no visible coverage', () => {
		const sourceA = createSource(
			'source-a',
			false
		);
		const sourceB = createSource(
			'source-b',
			false
		);

		const fileCoverage =
			createFileCoverage([
				[1, [sourceA]],
				[2, [sourceA, sourceB]],
				[3, [sourceB]]
			]);

		for (const mode of [
			'combined',
			'shared',
			'exclusive'
		] as const) {
			assert.deepStrictEqual(
				coveredLines(
					buildVisibleCoverage(
						fileCoverage,
						mode
					)
				),
				[]
			);
		}
	});
});
