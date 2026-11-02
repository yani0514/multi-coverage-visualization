import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension activation and commands', () => {
	let extension: vscode.Extension<unknown>;
	suiteSetup(async function () {
		this.timeout(10000);
		const found = vscode.extensions.all.find(item => item.packageJSON.name === 'multi-coverage-visualization');
		assert.ok(found, 'The development extension must be discoverable by VS Code');
		extension = found;
		await extension.activate();
	});

	test('every contributed command is registered after activation', async () => {
		const metadata = extension.packageJSON as { contributes: { commands: Array<{ command: string }> } };
		const declared = metadata.contributes.commands.map(item => item.command);
		assert.strictEqual(new Set(declared).size, declared.length, 'Contributed command IDs must be unique');
		const registered = new Set(await vscode.commands.getCommands(true));
		for (const command of declared) {
			assert.ok(registered.has(command), `Contributed command is not registered: ${command}`);
		}
	});

	test('source actions ignore absent, malformed and stale arguments without throwing', async () => {
		for (const command of ['toggleCoverageSource', 'removeCoverageSource', 'showOnlyCoverageSource', 'focusCoverageSource']) {
			for (const argument of [undefined, null, {}, { source: null }, { source: {} }, { source: { id: 42 } }, 42, 'not-a-loaded-source']) {
				await assert.doesNotReject(async () => {
					await vscode.commands.executeCommand(`multi-coverage-visualization.${command}`, argument);
				}, `${command} must ignore ${JSON.stringify(argument)}`);
			}
		}
	});
});
