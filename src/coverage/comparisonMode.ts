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
	mode: ComparisonMode,
	focused = false
): ComparisonModeInfo {
	return (
		getComparisonModes(focused).find(
			info => info.mode === mode
		) ?? COMPARISON_MODES[0]
	);
}

const FOCUSED_COMPARISON_MODES: readonly ComparisonModeInfo[] = [
	{ mode: 'combined', label: 'Covered by Focus', description: 'Show every line covered by the focus source, including shared lines.' },
	{ mode: 'exclusive', label: 'Exclusive to Focus', description: 'Show lines covered by the focus source and no other enabled source.' },
	{ mode: 'shared', label: 'Shared with Focus', description: 'Show lines covered by the focus source and at least one other enabled source.' }
];

/** The mode describes multiplicity; focus adds a source-membership constraint. */
export function getComparisonModes(focused: boolean): readonly ComparisonModeInfo[] {
	return focused ? FOCUSED_COMPARISON_MODES : COMPARISON_MODES;
}

export function isComparisonMode(
	value: unknown
): value is ComparisonMode {
	return COMPARISON_MODES.some(
		info => info.mode === value
	);
}
