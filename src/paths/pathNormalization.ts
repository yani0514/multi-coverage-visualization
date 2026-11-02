import * as path from 'path';

/** Canonical lexical spelling, shared by ingestion and explicit root mapping. */
export function normalizeCoveragePath(filePath: string): string {
	const slashes = filePath.replace(/\\/g, '/');
	const unc = slashes.startsWith('//');
	let normalized = path.posix.normalize(slashes.replace(/\/+/g, '/'));
	if (unc && normalized.startsWith('/')) { normalized = `/${normalized}`; }
	if (normalized !== '/' && !/^[a-z]:\/$/i.test(normalized)) {
		normalized = normalized.replace(/\/$/, '');
	}
	return normalized;
}
