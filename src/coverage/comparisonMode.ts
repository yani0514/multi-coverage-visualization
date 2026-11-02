export type ComparisonMode =
	| 'combined'
	| 'shared'
	| 'exclusive';

export const DEFAULT_COMPARISON_MODE: ComparisonMode =
	'combined';

export interface ComparisonModeInfo {
	readonly mode: ComparisonMode;
	readonly label: string;
	readonly description: string;
}

export const COMPARISON_MODES: readonly ComparisonModeInfo[] = [
	{
		mode: 'combined',
		label: 'Combined',
		description:
			'Show lines covered by at least one enabled coverage source.'
	},
	{
		mode: 'shared',
		label: 'Shared',
		description:
			'Show lines covered by two or more enabled coverage sources.'
	},
	{
		mode: 'exclusive',
		label: 'Exclusive',
		description:
			'Show lines covered by exactly one enabled coverage source.'
	}
];

export function getComparisonModeInfo(
	mode: ComparisonMode
): ComparisonModeInfo {
	return (
		COMPARISON_MODES.find(
			info => info.mode === mode
		) ?? COMPARISON_MODES[0]
	);
}

export function isComparisonMode(
	value: unknown
): value is ComparisonMode {
	return COMPARISON_MODES.some(
		info => info.mode === value
	);
}
