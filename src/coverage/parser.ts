import * as fs from 'fs/promises';
import { FileCoverage } from './types';

export async function parseCoverageFile(
	filePath: string
): Promise<FileCoverage> {
	const content = await fs.readFile(filePath, 'utf-8');
	const raw: unknown = JSON.parse(content);
	if (!isRecord(raw)) {
		throw new Error('Coverage JSON must be an object mapping source paths to covered line objects.');
	}

	const result: FileCoverage = new Map();

	for (const [sourcePath, lines] of Object.entries(raw)) {
		const coveredLines = new Set<number>();
		if (!isRecord(lines)) {
			throw new Error(`Invalid coverage for "${sourcePath}": expected a covered line object.`);
		}
		for (const [lineNumber, marker] of Object.entries(lines)) {
			const parsedLine = Number(lineNumber);
			if (!/^\d+$/.test(lineNumber) || !Number.isSafeInteger(parsedLine) || marker !== 1) {
				throw new Error(`Invalid coverage entry for "${sourcePath}" at line "${lineNumber}": expected a non-negative integer line with marker 1.`);
			}
			coveredLines.add(parsedLine);
		}

		result.set(sourcePath, coveredLines);
	}

	return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
