/** Presentation only: these options never change coverage selection or statistics. */
export interface DisplayOptions {
	backgroundHighlights: boolean;
	coverageMarkers: boolean;
}

export type DisplayOptionKey = keyof DisplayOptions;

export const DEFAULT_DISPLAY_OPTIONS: Readonly<DisplayOptions> = Object.freeze({
	backgroundHighlights: true,
	coverageMarkers: true
});

export const DISPLAY_OPTIONS: readonly {
	key: DisplayOptionKey; label: string; tooltip: string;
}[] = [
	{ key: 'backgroundHighlights', label: 'Background Highlights', tooltip: 'Show source-colored backgrounds on selected coverage lines.' },
	{ key: 'coverageMarkers', label: 'Coverage Markers', tooltip: 'Show colored end-of-line markers for lines covered by multiple enabled sources.' }
];

export function isDisplayOptionKey(value: unknown): value is DisplayOptionKey {
	return DISPLAY_OPTIONS.some(option => option.key === value);
}

/** Validate each preference independently, so a valid false is never lost. */
export function restoreDisplayOptions(value: unknown): DisplayOptions {
	const stored = typeof value === 'object' && value !== null && !Array.isArray(value)
		? value as Record<string, unknown> : {};
	return {
		backgroundHighlights: typeof stored.backgroundHighlights === 'boolean'
			? stored.backgroundHighlights : DEFAULT_DISPLAY_OPTIONS.backgroundHighlights,
		coverageMarkers: typeof stored.coverageMarkers === 'boolean'
			? stored.coverageMarkers : DEFAULT_DISPLAY_OPTIONS.coverageMarkers
	};
}
