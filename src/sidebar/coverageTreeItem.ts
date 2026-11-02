import * as vscode from 'vscode';
import { CoverageSource } from '../coverage/types';
import { createSourceColorIcon } from './sourceColorIcon';

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
			createSourceColorIcon(
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

}
