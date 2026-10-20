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

		this.description =
			source.enabled
				? 'Enabled'
				: 'Disabled';

		this.tooltip =
			`${source.name}\n${source.filePath}`;

		this.contextValue = 'coverageSource';

		this.iconPath = new vscode.ThemeIcon(
			source.enabled
				? 'circle-filled'
				: 'circle-outline'
		);

		this.command = {
			command:
				'multi-coverage-visualization.toggleCoverageSource',
			title: 'Toggle Coverage Source',
			arguments: [source.id]
		};
	}
}