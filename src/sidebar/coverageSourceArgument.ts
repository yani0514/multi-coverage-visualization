/** Source row context commands and direct ID calls share the same validation. */
export function getCoverageSourceId(value: unknown): string | undefined {
	if (typeof value === 'string') { return value; }
	if (typeof value !== 'object' || value === null || !('source' in value)) { return undefined; }
	const source = value.source;
	return typeof source === 'object' && source !== null && 'id' in source && typeof source.id === 'string'
		? source.id : undefined;
}
