export const COVERAGE_COLORS = [
	'rgba(230, 57, 70, 0.20)',
	'rgba(29, 78, 216, 0.20)',
	'rgba(234, 179, 8, 0.20)',
	'rgba(5, 150, 105, 0.20)',
	'rgba(126, 34, 206, 0.20)',
	'rgba(249, 115, 22, 0.20)',
	'rgba(14, 165, 233, 0.20)',
	'rgba(190, 24, 93, 0.20)',
	'rgba(22, 163, 74, 0.20)',
	'rgba(109, 40, 217, 0.20)',
	'rgba(202, 138, 4, 0.20)',
	'rgba(8, 145, 178, 0.20)',
	'rgba(220, 38, 38, 0.20)',
	'rgba(37, 99, 235, 0.20)',
	'rgba(124, 58, 237, 0.20)',
	'rgba(217, 119, 6, 0.20)'
];

function hashString(value: string) : number {
    let hash = 0;

    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }

    return hash >>> 0 ;
}


export function getCoverageColor(sourceID: string) : string {
    const hash = hashString(sourceID);

    return COVERAGE_COLORS[hash % COVERAGE_COLORS.length];
}