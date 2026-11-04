import * as vscode from "vscode";

import {
  ComparisonMode,
  getComparisonModes,
  DEFAULT_COMPARISON_MODE,
} from "../coverage/comparisonMode";

import { ComparisonTreeItem } from "./comparisonTreeItem";

export class ComparisonTreeProvider
  implements vscode.TreeDataProvider<ComparisonTreeItem>, vscode.Disposable
{
  private currentMode: ComparisonMode = DEFAULT_COMPARISON_MODE;
  private focusSourceId: string | undefined;

  constructor(initialMode: ComparisonMode = DEFAULT_COMPARISON_MODE) {
    this.currentMode = initialMode;
  }

  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    ComparisonTreeItem | undefined | void
  >();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  getTreeItem(element: ComparisonTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ComparisonTreeItem[] {
    return getComparisonModes(this.focusSourceId !== undefined).map(
      (info) =>
        new ComparisonTreeItem(
          info.mode,
          info.mode === this.currentMode,
          this.focusSourceId !== undefined,
        ),
    );
  }

  getMode(): ComparisonMode {
    return this.currentMode;
  }

  setFocusSource(sourceId: string | undefined): void {
    if (this.focusSourceId !== sourceId) {
      this.focusSourceId = sourceId;
      this.refresh();
    }
  }

  setMode(mode: ComparisonMode): void {
    if (mode === this.currentMode) {
      return;
    }

    this.currentMode = mode;
    this.refresh();
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }
}
