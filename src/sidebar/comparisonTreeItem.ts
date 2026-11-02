import * as vscode from 'vscode';

import {
	ComparisonMode,
	getComparisonModeInfo
} from '../coverage/comparisonMode';

export class ComparisonTreeItem extends vscode.TreeItem {
	constructor(
		public readonly mode: ComparisonMode,
		selected: boolean
	) {
		const info =
			getComparisonModeInfo(mode);

		super(
			info.label,
			vscode.TreeItemCollapsibleState.None
		);

		this.id = mode;
		this.iconPath = new vscode.ThemeIcon(
			selected
				? 'circle-filled'
				: 'circle-outline'
		);

		this.tooltip = info.description;

		this.contextValue =
			'coverageComparisonMode';

		this.command = {
			command:
				'multi-coverage-visualization.setComparisonMode',
			title: `Use ${info.label} Comparison`,
			arguments: [mode]
		};
	}
}
