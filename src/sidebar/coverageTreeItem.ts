import * as vscode from 'vscode';
import { CoverageSource } from '../coverage/types';

export class CoverageTreeItem extends vscode.TreeItem {
	constructor(
		public readonly source: CoverageSource
	) {
		super(
			source.name,
			vscode.TreeItemCollapsibleState.None
		);

		this.id = source.id;
		this.tooltip = `${source.name}\nStatus: ${source.enabled ? 'Enabled' : 'Disabled'}\nPath: ${source.filePath}`;

		this.contextValue = 'coverageSource';

		this.iconPath =
			this.createColorIcon(
				source.color,
				source.enabled
			);

		this.command = {
			command:
				'multi-coverage-visualization.toggleCoverageSource',
			title: source.enabled
				? 'Disable Coverage Source'
				: 'Enable Coverage Source',
			arguments: [source.id]
		};
	}

	private createColorIcon(
		color: string,
		enabled: boolean
	): vscode.Uri {
		const solidColor =
			this.toSolidColor(color);

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

	private toSolidColor(
		color: string
	): string {
		return color.replace(
			/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/,
			'rgb($1,$2,$3)'
		);
	}
}
