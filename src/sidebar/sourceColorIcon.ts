import * as vscode from 'vscode';

export function createSourceColorIcon(
	color: string,
	enabled: boolean
): vscode.Uri {
	const solidColor =
		toSolidColor(color);

	const svg = enabled
		? `
			<svg xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 16 16">
				<circle
					cx="8"
					cy="8"
					r="5"
					fill="${solidColor}"
				/>
			</svg>
		`
		: `
			<svg xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 16 16">
				<circle
					cx="8"
					cy="8"
					r="5"
					fill="none"
					stroke="${solidColor}"
					stroke-width="2"
				/>
			</svg>
		`;

	return vscode.Uri.parse(
		`data:image/svg+xml,${encodeURIComponent(
			svg
		)}`
	);
}

function toSolidColor(
	color: string
): string {
	return color.replace(
		/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/,
		'rgb($1,$2,$3)'
	);
}
