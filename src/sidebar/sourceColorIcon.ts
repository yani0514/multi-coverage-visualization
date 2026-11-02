import * as vscode from 'vscode';

/** Dual outlines keep source hue visible on light, dark, and high-contrast surfaces. */
export function createSourceColorIcon(color: string, enabled: boolean): vscode.Uri {
	const solidColor = color.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
		<circle cx="8" cy="8" r="6" fill="none" stroke="#ffffff" stroke-width="1"/>
		<circle cx="8" cy="8" r="5.2" fill="none" stroke="#202020" stroke-width="1"/>
		<circle cx="8" cy="8" r="4.4" fill="${enabled ? solidColor : 'none'}" stroke="${solidColor}" stroke-width="1.6"/>
	</svg>`;
	return vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svg)}`);
}
