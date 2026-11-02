import * as vscode from 'vscode';
import { CoverageSource } from '../coverage/types';
import { createSourceColorIcon } from './sourceColorIcon';

export class FocusSourceTreeItem extends vscode.TreeItem {
	constructor(source: CoverageSource | undefined, selected: boolean) {
		super(source?.name ?? 'None', vscode.TreeItemCollapsibleState.None);
		this.id = source ? `source:${source.id}` : 'none';
		this.iconPath = source
			? createSourceColorIcon(source.color, selected)
			: new vscode.ThemeIcon(selected ? 'circle-filled' : 'circle-outline');
		this.tooltip = source
			? `Focus on ${source.name}\n${source.filePath}`
			: 'Compare all enabled sources without a focus.';
		this.command = {
			command: 'multi-coverage-visualization.setFocusSource',
			title: source ? `Focus on ${source.name}` : 'Clear Focus Source',
			// Explicit null survives VS Code's command argument serialization.
			arguments: [source?.id ?? null]
		};
	}
}
