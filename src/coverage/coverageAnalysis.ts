import { applyComparisonMode, filterEnabledSources, LineCoverage } from './comparisonFilter';
import { CoverageSource } from './types';

/** The renderer resolves this once; editor decorations and statistics share it. */
export type CurrentFileCoverage =
	| { state: 'no-editor' }
	| { state: 'unmapped'; localPath: string }
	| {
		state: 'mapped'; localPath: string; coveragePath: string;
		coverage: LineCoverage; sources: readonly CoverageSource[];
	};

export interface SourceLineCount {
	id: string;
	name: string;
	filePath: string;
	color: string;
	count: number;
}

export type CurrentFileStats =
	| { state: 'no-editor' }
	| { state: 'unmapped'; localPath: string }
	| {
		state: 'mapped'; localPath: string; coveragePath: string;
		sources: SourceLineCount[];
		combined: number; shared: number; exclusive: number;
	};

/** Count data lines, independently of editor length and the selected comparison. */
export function analyzeCurrentFile(snapshot: CurrentFileCoverage): CurrentFileStats {
	if (snapshot.state !== 'mapped') {
		return snapshot;
	}
	const coverage = filterEnabledSources(new Map(
		[...snapshot.coverage].filter(([line]) => Number.isSafeInteger(line) && line > 0)
	));
	const counts = new Map<string, number>();
	for (const sources of coverage.values()) {
		for (const source of sources) {
			counts.set(source.id, (counts.get(source.id) ?? 0) + 1);
		}
	}
	return {
		state: 'mapped', localPath: snapshot.localPath, coveragePath: snapshot.coveragePath,
		sources: snapshot.sources.filter(source => source.enabled).map(source => ({
			id: source.id, name: source.name, filePath: source.filePath,
			color: source.color, count: counts.get(source.id) ?? 0
		})),
		combined: applyComparisonMode(coverage, 'combined').size,
		shared: applyComparisonMode(coverage, 'shared').size,
		exclusive: applyComparisonMode(coverage, 'exclusive').size
	};
}
