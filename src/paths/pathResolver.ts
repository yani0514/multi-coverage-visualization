import * as path from 'path';
import { PathMapping } from './pathMapping';
import { normalizeCoveragePath } from './pathNormalization';

export class PathResolver {
	resolveLocalPath(
		coveragePath: string,
		mapping: PathMapping
	): string | undefined {
		const normalizedCoveragePath = this.normalize(coveragePath);
		const normalizedCoverageRoot = this.normalize(mapping.coverageRoot);

		if (!this.isWithinRoot(normalizedCoveragePath, normalizedCoverageRoot)) {
			return undefined;
		}

		const relativePath = normalizedCoveragePath
			.slice(normalizedCoverageRoot.length)
			.replace(/^\/+/, '');

		return path.join(
			mapping.localRoot,
			...relativePath.split('/')
		);
	}

	resolveCoveragePath(
		localFilePath: string,
		coveragePaths: string[],
		mapping: PathMapping
	): string | undefined {
		const normalizedLocal = this.normalize(localFilePath);
		const normalizedLocalRoot = this.normalize(mapping.localRoot);

		// Windows local paths are case-insensitive; VS Code normalizes drive letters.
		const windowsPath = /^[a-z]:\//i.test(normalizedLocalRoot) || normalizedLocalRoot.startsWith('//');
		const comparableLocal = windowsPath ? normalizedLocal.toLowerCase() : normalizedLocal;
		const comparableRoot = windowsPath ? normalizedLocalRoot.toLowerCase() : normalizedLocalRoot;
		if (!this.isWithinRoot(comparableLocal, comparableRoot)) {
			return undefined;
		}

		const relativePath = normalizedLocal
			.slice(normalizedLocalRoot.length)
			.replace(/^\/+/, '');

		const coverageRoot = this.normalize(mapping.coverageRoot);
		const expectedCoveragePath = this.normalize(
			`${coverageRoot}${coverageRoot.endsWith('/') ? '' : '/'}${relativePath}`
		);

		let match: string | undefined;
		for (const coveragePath of coveragePaths) {
			const candidate = this.normalize(coveragePath);
			// Keep the generated coverage root case-sensitive. Only the local
			// relative path is case-insensitive on Windows, including UNC paths.
			const matches = candidate === expectedCoveragePath || (windowsPath &&
				this.isWithinRoot(candidate, coverageRoot) &&
				candidate.slice(coverageRoot.length).replace(/^\/+/, '').toLowerCase() === relativePath.toLowerCase());
			if (matches) {
				// A Windows checkout cannot distinguish two POSIX files differing
				// only by case. Do not pick a coverage file arbitrarily.
				if (match !== undefined && this.normalize(match) !== candidate) { return undefined; }
				match = coveragePath;
			}
		}

		return match;
	}

	private isWithinRoot(filePath: string, root: string): boolean {
		return filePath === root || filePath.startsWith(root.endsWith('/') ? root : `${root}/`);
	}

	private normalize(filePath: string): string {
		return normalizeCoveragePath(filePath);
	}
}
