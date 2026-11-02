import * as vscode from 'vscode';
import { CoverageSource } from '../coverage/types';
import { FocusSourceTreeItem } from './focusSourceTreeItem';

export class FocusSourceTreeProvider implements vscode.TreeDataProvider<FocusSourceTreeItem>, vscode.Disposable {
	private sources: readonly CoverageSource[] = [];
	private selectedId: string | undefined;
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	update(sources: readonly CoverageSource[], selectedId: string | undefined): void {
		this.sources = sources.filter(source => source.enabled);
		this.selectedId = this.sources.some(source => source.id === selectedId) ? selectedId : undefined;
		this.changed.fire();
	}

	getTreeItem(item: FocusSourceTreeItem): vscode.TreeItem { return item; }
	getChildren(parent?: FocusSourceTreeItem): FocusSourceTreeItem[] {
		if (parent) { return []; }
		return [
			new FocusSourceTreeItem(undefined, this.selectedId === undefined),
			...this.sources.map(source => new FocusSourceTreeItem(source, source.id === this.selectedId))
		];
	}
	dispose(): void { this.changed.dispose(); }
}
