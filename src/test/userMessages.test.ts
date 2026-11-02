import * as assert from 'assert';
import { coverageLoadFailure, failureReason } from '../ui/userMessages';

suite('User-facing failure messages', () => {
	test('missing files identify the selected filename without raw filesystem details', () => {
		assert.strictEqual(coverageLoadFailure('épreuve.json', { code: 'ENOENT', message: 'private/path/stack' }),
			'Could not load "épreuve.json": the file or folder no longer exists.');
	});
	test('syntax and schema failures explain how the input is invalid', () => {
		assert.match(coverageLoadFailure('run.json', new SyntaxError('Unexpected token at position 12')), /not valid JSON/);
		assert.match(failureReason(new Error('Invalid coverage entry for /remote.php')), /coverage JSON format/);
	});
	test('permission and folder failures offer an actionable reason', () => {
		assert.match(failureReason({ code: 'EACCES' }), /permissions/);
		assert.match(failureReason({ code: 'EPERM' }), /permissions/);
		assert.match(failureReason({ code: 'EISDIR' }), /choose a JSON file/);
		assert.strictEqual(failureReason(new Error('The selected path is not a directory.')), 'the selected path is not a folder');
	});
	test('unexpected failures and non-error values use a concise fallback', () => {
		for (const error of [undefined, null, 42, new Error('Internal stack or secret path')]) {
			const message = failureReason(error);
			assert.match(message, /check the path/);
			assert.ok(!message.includes('stack') && !message.includes('secret'));
		}
	});
});
