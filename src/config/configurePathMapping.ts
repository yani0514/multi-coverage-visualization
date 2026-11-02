import * as vscode from 'vscode';
import { PathMapping } from '../paths/pathMapping';
import { isAbsoluteCoverageRoot } from './workspaceConfig';

export interface PathMappingPrompts {
	input(options: vscode.InputBoxOptions): Thenable<string | undefined>;
	folder(options: vscode.OpenDialogOptions): Thenable<vscode.Uri[] | undefined>;
	stat(uri: vscode.Uri): Thenable<vscode.FileStat>;
	error(message: string): void;
}

const defaultPrompts: PathMappingPrompts = {
	input: options => vscode.window.showInputBox(options),
	folder: options => vscode.window.showOpenDialog(options),
	stat: uri => vscode.workspace.fs.stat(uri),
	error: message => { void vscode.window.showErrorMessage(message); }
};

/** Cancellation at either step leaves the existing configuration untouched. */
export async function askForPathMapping(
	current?: PathMapping,
	prompts: PathMappingPrompts = defaultPrompts
): Promise<PathMapping | undefined> {
	const coverageRoot = await prompts.input({
		title: 'Coverage Root',
		prompt: 'Enter the absolute root path used inside the coverage JSON.',
		placeHolder: '/var/www/html/addressbook',
		value: current?.coverageRoot,
		ignoreFocusOut: true,
		validateInput: value => isAbsoluteCoverageRoot(value.trim())
			? undefined : 'Enter an absolute coverage root, for example /var/www/html/addressbook.'
	});
	if (coverageRoot === undefined) {
		return undefined;
	}
	if (!isAbsoluteCoverageRoot(coverageRoot.trim())) {
		prompts.error('Enter an absolute coverage root.');
		return undefined;
	}
	const folders = await prompts.folder({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: 'Select Local Project Root',
		title: 'Select the local project root',
		defaultUri: current ? vscode.Uri.file(current.localRoot) : vscode.workspace.workspaceFolders?.[0]?.uri
	});
	if (!folders?.length) {
		return undefined;
	}
	const folder = folders[0];
	try {
		const stat = await prompts.stat(folder);
		if (!(stat.type & vscode.FileType.Directory)) {
			throw new Error('The selected path is not a directory.');
		}
	} catch (error) {
		prompts.error(`Cannot use local project root "${folder.fsPath}": ${error}`);
		return undefined;
	}
	return { coverageRoot: coverageRoot.trim(), localRoot: folder.fsPath };
}
