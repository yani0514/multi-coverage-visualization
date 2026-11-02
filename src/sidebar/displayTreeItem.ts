import * as vscode from 'vscode';
import { DisplayOptionKey, DISPLAY_OPTIONS } from '../editor/displayOptions';

export class DisplayTreeItem extends vscode.TreeItem {
	constructor(public readonly option: DisplayOptionKey, enabled: boolean) {
		const info = DISPLAY_OPTIONS.find(item => item.key === option)!;
		super(info.label, vscode.TreeItemCollapsibleState.None);
		this.id = option;
		this.tooltip = info.tooltip;
		this.accessibilityInformation = { label: `${info.label}. ${info.tooltip}` };
		this.checkboxState = enabled ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
		this.command = {
			command: 'multi-coverage-visualization.toggleDisplayOption',
			title: `Toggle ${info.label}`,
			arguments: [option]
		};
	}
}
