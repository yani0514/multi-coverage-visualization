import * as vscode from 'vscode';

/** Informational rows deliberately have no commands. */
export class CurrentFileTreeItem extends vscode.TreeItem {
	constructor(id: string, label: string, description?: string) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.id = id;
		this.description = description;
		this.accessibilityInformation = { label: description ? `${label}, ${description}` : label };
	}
}
