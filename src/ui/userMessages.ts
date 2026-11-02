/** Keep actionable notifications separate from technical details logged by callers. */
export function failureReason(error: unknown): string {
	const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
	if (code === 'ENOENT') { return 'the file or folder no longer exists'; }
	if (code === 'EACCES' || code === 'EPERM') { return 'access was denied; check its permissions'; }
	if (code === 'EISDIR') { return 'the selected path is a folder; choose a JSON file'; }
	if (error instanceof Error && error.message === 'The selected path is not a directory.') {
		return 'the selected path is not a folder';
	}
	if (error instanceof SyntaxError) { return 'the file is not valid JSON'; }
	if (error instanceof Error && /^(Coverage JSON must|Invalid coverage)/.test(error.message)) {
		return 'the file does not match the coverage JSON format; each source path must map to line numbers marked with 1';
	}
	return 'the operation could not be completed; check the path and access permissions';
}

export function coverageLoadFailure(name: string, error: unknown): string {
	return `Could not load "${name}": ${failureReason(error)}.`;
}
