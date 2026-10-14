import * as fs from 'fs/promises';
import { FileCoverage } from './types';

export async function parseCoverageFile(
	filePath: string
): Promise<FileCoverage> {
	const content = await fs.readFile(filePath, 'utf-8');
	const raw = JSON.parse(content);

	const result: FileCoverage = new Map();

	for (const [sourcePath, lines] of Object.entries(raw)) {
		const coveredLines = new Set<number>();

		if (typeof lines === 'object' && lines !== null) {
			for (const lineNumber of Object.keys(lines)) {
				const parsedLine = Number(lineNumber);

				if (!Number.isNaN(parsedLine)) {
					coveredLines.add(parsedLine);
				}
			}
		}

		result.set(sourcePath, coveredLines);
	}

	return result;
}