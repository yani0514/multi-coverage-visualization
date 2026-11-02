import * as vscode from 'vscode';
import { DisplayOptionKey, DisplayOptions, DISPLAY_OPTIONS, DEFAULT_DISPLAY_OPTIONS } from '../editor/displayOptions';
import { DisplayTreeItem } from './displayTreeItem';

export class DisplayTreeProvider implements vscode.TreeDataProvider<DisplayTreeItem>, vscode.Disposable {
	private options: DisplayOptions;
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	constructor(initial: DisplayOptions = DEFAULT_DISPLAY_OPTIONS) {
		this.options = { ...initial };
	}

	getOptions(): DisplayOptions { return { ...this.options }; }

	setOption(key: DisplayOptionKey, enabled: boolean): void {
		if (this.options[key] !== enabled) {
			this.options = { ...this.options, [key]: enabled };
			this.changed.fire();
		}
	}

	getTreeItem(item: DisplayTreeItem): vscode.TreeItem { return item; }
	getChildren(parent?: DisplayTreeItem): DisplayTreeItem[] {
		return parent ? [] : DISPLAY_OPTIONS.map(info => new DisplayTreeItem(info.key, this.options[info.key]));
	}
	dispose(): void { this.changed.dispose(); }
}
