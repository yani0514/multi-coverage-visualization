import { CoverageStore } from "./coverageStore";
import { CoverageSource } from "./types";

export class CoverageQuery {
    constructor(private readonly store: CoverageStore) {}

    getSourceCoveringLine(
        sourcePath: string,
        lineNumber: number
    ): CoverageSource[] {
        const matchingSources: CoverageSource[] = [];

        for(const source of this.store.getAll()) {
            const coveredLines = source.coverage.get(sourcePath);

            if(coveredLines?.has(lineNumber)) {
                matchingSources.push(source);
            }
        }

        return matchingSources;
    }

    getCoverageForFile(
        sourcePath: string
    ): Map<number, CoverageSource[]> {
        const result = new Map<number, CoverageSource[]>();

        for (const source of this.store.getAll()) {
            const coveredLines = source.coverage.get(sourcePath);

            if(!coveredLines) {
                continue;
            }

            for (const lineNumber of coveredLines) {
                const existingSources = result.get(lineNumber) ?? [];

                existingSources.push(source);

                result.set(lineNumber, existingSources);
            }
        }

        return result;
    }
}

