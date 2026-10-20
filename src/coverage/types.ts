export type FileCoverage = Map<string, Set<number>>;

export interface CoverageSource {
	id: string;
	name: string;
	filePath: string;
	color: string;
	coverage: FileCoverage;
	enabled:boolean
}