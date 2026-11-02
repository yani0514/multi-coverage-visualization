import * as vscode from 'vscode';

/** Original source-colored indicator: filled when enabled, outlined when disabled. */
export function createSourceColorIcon(color: string, enabled: boolean): vscode.Uri {
	const solidColor = color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
		<circle cx="8" cy="8" r="5" fill="${enabled ? solidColor : 'none'}"${enabled ? '' : ` stroke="${solidColor}" stroke-width="2"`}/>
	</svg>`;
	return vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svg)}`);
}
