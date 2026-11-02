import * as vscode from 'vscode';
import { CoverageStore } from '../coverage/coverageStore';
import { CoverageTreeItem } from './coverageTreeItem';

export class CoverageTreeProvider
	implements
		vscode.TreeDataProvider<CoverageTreeItem>,
		vscode.Disposable {

	private readonly onDidChangeTreeDataEmitter =
		new vscode.EventEmitter<
			CoverageTreeItem | undefined | void
		>();

	readonly onDidChangeTreeData =
		this.onDidChangeTreeDataEmitter.event;

	constructor(
		private readonly store: CoverageStore
	) {}

	getTreeItem(
		element: CoverageTreeItem
	): vscode.TreeItem {
		return element;
	}

	getChildren(): CoverageTreeItem[] {
		return this.store
			.getAll()
			.map(
				source =>
					new CoverageTreeItem(
						source
					)
			);
	}

	refresh(): void {
		this.onDidChangeTreeDataEmitter.fire();
	}

	dispose(): void {
		this.onDidChangeTreeDataEmitter.dispose();
	}
}
