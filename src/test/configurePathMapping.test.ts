import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { askForPathMapping, PathMappingPrompts } from '../config/configurePathMapping';

suite('Path mapping configuration prompts', () => {
	const current = { coverageRoot: '/old', localRoot: path.resolve('old-project') };
	const folder = vscode.Uri.file(path.resolve('new-project'));
	function prompts(): PathMappingPrompts {
		return {
			input: async () => ' /new ',
			folder: async () => [folder],
			stat: async () => ({ type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 }),
			error: message => assert.fail(message)
		};
	}

	test('prefills current values and returns a replacement without mutating the old mapping', async () => {
		const ui = prompts();
		ui.input = async options => {
			assert.strictEqual(options.value, '/old');
			assert.ok(options.validateInput?.('relative'));
			assert.strictEqual(options.validateInput?.('/new'), undefined);
			return ' /new ';
		};
		ui.folder = async options => {
			assert.strictEqual(options.defaultUri?.fsPath, vscode.Uri.file(current.localRoot).fsPath);
			return [folder];
		};
		assert.deepStrictEqual(await askForPathMapping(current, ui), { coverageRoot: '/new', localRoot: folder.fsPath });
		assert.strictEqual(current.coverageRoot, '/old');
	});

	test('cancelling either prompt returns no replacement', async () => {
		const ui = prompts();
		ui.input = async () => undefined;
		ui.folder = async () => assert.fail('Folder dialog must not follow cancellation');
		assert.strictEqual(await askForPathMapping(current, ui), undefined);
		const second = prompts();
		second.folder = async () => undefined;
		assert.strictEqual(await askForPathMapping(current, second), undefined);
		assert.strictEqual(current.coverageRoot, '/old');
	});

	test('missing or non-directory local roots report errors and preserve the mapping', async () => {
		for (const inaccessible of [false, true]) {
			const ui = prompts();
			let error = '';
			ui.error = message => { error = message; };
			ui.stat = async () => {
				if (inaccessible) {
					throw new Error('Unavailable');
				}
				return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
			};
			assert.strictEqual(await askForPathMapping(current, ui), undefined);
			assert.match(error, /Cannot use local project root/);
			assert.strictEqual(current.coverageRoot, '/old');
		}
	});
});
