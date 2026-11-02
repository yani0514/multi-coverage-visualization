import { ComparisonMode } from './comparisonMode';
import { CoverageSource } from './types';

/**
 * Coverage for a single source file, keyed by 1-based line number.
 * Each line maps to every coverage source that covers it.
 */
export type LineCoverage = Map<number, CoverageSource[]>;

/**
 * Remove disabled coverage sources without mutating the
 * coverage returned by CoverageQuery.
 */
export function filterEnabledSources(
	fileCoverage: LineCoverage
): LineCoverage {
	const enabledCoverage: LineCoverage =
		new Map();

	for (
		const [line, sources]
		of fileCoverage
	) {
		const enabledSources =
			sources.filter(
				source => source.enabled
			);

		if (enabledSources.length > 0) {
			enabledCoverage.set(
				line,
				enabledSources
			);
		}
	}

	return enabledCoverage;
}

/**
 * Keep only the lines that match the selected comparison mode.
 * The source lists on the remaining lines are left intact so
 * backgrounds and markers can still identify each contributor.
 */
export function applyComparisonMode(
	fileCoverage: LineCoverage,
	mode: ComparisonMode,
	focusSourceId?: string
): LineCoverage {
	const filteredCoverage: LineCoverage =
		new Map();

	for (
		const [line, sources]
		of fileCoverage
	) {
		if (focusSourceId !== undefined && !sources.some(source => source.id === focusSourceId)) {
			continue;
		}
		if (
			isLineVisible(
				sources.length,
				mode
			)
		) {
			filteredCoverage.set(
				line,
				sources
			);
		}
	}

	return filteredCoverage;
}

/**
 * Combined: at least one source covers the line.
 * Shared: at least two sources cover the line.
 * Exclusive: exactly one source covers the line.
 */
export function isLineVisible(
	sourceCount: number,
	mode: ComparisonMode
): boolean {
	switch (mode) {
		case 'combined':
			return sourceCount > 0;

		case 'shared':
			return sourceCount >= 2;

		case 'exclusive':
			return sourceCount === 1;
	}
}

/**
 * Full rendering pipeline:
 * all coverage -> enabled coverage -> comparison-filtered coverage.
 */
export function buildVisibleCoverage(
	fileCoverage: LineCoverage,
	mode: ComparisonMode,
	focusSourceId?: string
): LineCoverage {
	return applyComparisonMode(
		filterEnabledSources(fileCoverage),
		mode,
		focusSourceId
	);
}
