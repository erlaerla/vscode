/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import uri from 'vs/base/common/uri';
import platform = require('vs/base/common/platform');
import { TPromise } from 'vs/base/common/winjs.base';
import { IConfigurationService, getConfigurationValue, IConfigurationOverrides } from 'vs/platform/configuration/common/configuration';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';
import { ConfigurationResolverService } from 'vs/workbench/services/configurationResolver/node/configurationResolverService';
import { IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { TestEnvironmentService, TestEditorService } from 'vs/workbench/test/workbenchTestServices';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';

suite('Configuration Resolver Service', () => {
	let configurationResolverService: IConfigurationResolverService;
	let envVariables: { [key: string]: string } = { key1: 'Value for Key1', key2: 'Value for Key2' };
	let mockCommandService: MockCommandService;
	let editorService: TestEditorService;
	let workspace: IWorkspaceFolder;


	setup(() => {
		mockCommandService = new MockCommandService();
		editorService = new TestEditorService();
		workspace = {
			uri: uri.parse('file:///VSCode/workspaceLocation'),
			name: 'hey',
			index: 0,
			toResource: () => null
		};
		configurationResolverService = new ConfigurationResolverService(envVariables, editorService, TestEnvironmentService, new TestConfigurationService(), mockCommandService);
	});

	teardown(() => {
		configurationResolverService = null;
	});


	test('substitute one', () => {
		if (platform.isWindows) {
			assert.strictEqual(configurationResolverService.resolve(workspace, 'abc ${workspaceFolder} xyz'), 'abc \\VSCode\\workspaceLocation xyz');
		} else {
			assert.strictEqual(configurationResolverService.resolve(workspace, 'abc ${workspaceFolder} xyz'), 'abc /VSCode/workspaceLocation xyz');
		}
	});

	test('workspace root folder name', () => {
		assert.strictEqual(configurationResolverService.resolve(workspace, 'abc ${workspaceRootFolderName} xyz'), 'abc workspaceLocation xyz');
	});

	test('current selected line number', () => {
		assert.strictEqual(configurationResolverService.resolve(workspace, 'abc ${lineNumber} xyz'), `abc ${editorService.mockLineNumber} xyz`);
	});

	test('substitute many', () => {
		if (platform.isWindows) {
			assert.strictEqual(configurationResolverService.resolve(workspace, '${workspaceFolder} - ${workspaceFolder}'), '\\VSCode\\workspaceLocation - \\VSCode\\workspaceLocation');
		} else {
			assert.strictEqual(configurationResolverService.resolve(workspace, '${workspaceFolder} - ${workspaceFolder}'), '/VSCode/workspaceLocation - /VSCode/workspaceLocation');
		}
	});

	test('substitute one env variable', () => {
		if (platform.isWindows) {
			assert.strictEqual(configurationResolverService.resolve(workspace, 'abc ${workspaceFolder} ${env:key1} xyz'), 'abc \\VSCode\\workspaceLocation Value for Key1 xyz');
		} else {
			assert.strictEqual(configurationResolverService.resolve(workspace, 'abc ${workspaceFolder} ${env:key1} xyz'), 'abc /VSCode/workspaceLocation Value for Key1 xyz');
		}
	});

	test('substitute many env variable', () => {
		if (platform.isWindows) {
			assert.strictEqual(configurationResolverService.resolve(workspace, '${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}'), '\\VSCode\\workspaceLocation - \\VSCode\\workspaceLocation Value for Key1 - Value for Key2');
		} else {
			assert.strictEqual(configurationResolverService.resolve(workspace, '${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}'), '/VSCode/workspaceLocation - /VSCode/workspaceLocation Value for Key1 - Value for Key2');
		}
	});

	test('substitute one configuration variable', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {
				fontFamily: 'foo'
			},
			terminal: {
				integrated: {
					fontFamily: 'bar'
				}
			}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.fontFamily} xyz'), 'abc foo xyz');
	});

	test('substitute many configuration variables', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {
				fontFamily: 'foo'
			},
			terminal: {
				integrated: {
					fontFamily: 'bar'
				}
			}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} xyz'), 'abc foo bar xyz');
	});

	test('substitute nested configuration variables', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {
				fontFamily: 'foo ${workspaceFolder} ${config:terminal.integrated.fontFamily}'
			},
			terminal: {
				integrated: {
					fontFamily: 'bar'
				}
			}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		if (platform.isWindows) {
			assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} xyz'), 'abc foo \\VSCode\\workspaceLocation bar bar xyz');
		} else {
			assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} xyz'), 'abc foo /VSCode/workspaceLocation bar bar xyz');
		}
	});

	test('substitute accidental self referenced configuration variables', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {
				fontFamily: 'foo ${workspaceFolder} ${config:terminal.integrated.fontFamily} ${config:editor.fontFamily}'
			},
			terminal: {
				integrated: {
					fontFamily: 'bar'
				}
			}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		if (platform.isWindows) {
			assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} xyz'), 'abc foo \\VSCode\\workspaceLocation bar  bar xyz');
		} else {
			assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} xyz'), 'abc foo /VSCode/workspaceLocation bar  bar xyz');
		}
	});

	test('substitute one env variable and a configuration variable', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {
				fontFamily: 'foo'
			},
			terminal: {
				integrated: {
					fontFamily: 'bar'
				}
			}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		if (platform.isWindows) {
			assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.fontFamily} ${workspaceFolder} ${env:key1} xyz'), 'abc foo \\VSCode\\workspaceLocation Value for Key1 xyz');
		} else {
			assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.fontFamily} ${workspaceFolder} ${env:key1} xyz'), 'abc foo /VSCode/workspaceLocation Value for Key1 xyz');
		}
	});

	test('substitute many env variable and a configuration variable', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {
				fontFamily: 'foo'
			},
			terminal: {
				integrated: {
					fontFamily: 'bar'
				}
			}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		if (platform.isWindows) {
			assert.strictEqual(service.resolve(workspace, '${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} ${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}'), 'foo bar \\VSCode\\workspaceLocation - \\VSCode\\workspaceLocation Value for Key1 - Value for Key2');
		} else {
			assert.strictEqual(service.resolve(workspace, '${config:editor.fontFamily} ${config:terminal.integrated.fontFamily} ${workspaceFolder} - ${workspaceFolder} ${env:key1} - ${env:key2}'), 'foo bar /VSCode/workspaceLocation - /VSCode/workspaceLocation Value for Key1 - Value for Key2');
		}
	});

	test('mixed types of configuration variables', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {
				fontFamily: 'foo',
				lineNumbers: 123,
				insertSpaces: false
			},
			terminal: {
				integrated: {
					fontFamily: 'bar'
				}
			},
			json: {
				schemas: [
					{
						fileMatch: [
							'/myfile',
							'/myOtherfile'
						],
						url: 'schemaURL'
					}
				]
			}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.fontFamily} ${config:editor.lineNumbers} ${config:editor.insertSpaces} xyz'), 'abc foo 123 false xyz');
	});

	test('configuration should not evaluate Javascript', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {
				abc: 'foo'
			}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor[\'abc\'.substr(0)]} xyz'), 'abc  xyz');
	});

	test('uses empty string as fallback', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.abc} xyz'), 'abc  xyz');
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.abc.def} xyz'), 'abc  xyz');
		assert.strictEqual(service.resolve(workspace, 'abc ${config:panel} xyz'), 'abc  xyz');
		assert.strictEqual(service.resolve(workspace, 'abc ${config:panel.abc} xyz'), 'abc  xyz');
	});

	test('is restricted to own properties', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.__proto__} xyz'), 'abc  xyz');
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.toString} xyz'), 'abc  xyz');
	});

	test('configuration variables with invalid accessor', () => {
		let configurationService: IConfigurationService;
		configurationService = new MockConfigurationService({
			editor: {
				fontFamily: 'foo'
			}
		});

		let service = new ConfigurationResolverService(envVariables, new TestEditorService(), TestEnvironmentService, configurationService, mockCommandService);
		assert.strictEqual(service.resolve(workspace, 'abc ${config:} xyz'), 'abc ${config:} xyz');
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor..fontFamily} xyz'), 'abc  xyz');
		assert.strictEqual(service.resolve(workspace, 'abc ${config:editor.none.none2} xyz'), 'abc  xyz');
	});

	test('interactive variable simple', () => {
		const configuration = {
			'name': 'Attach to Process',
			'type': 'node',
			'request': 'attach',
			'processId': '${command:interactiveVariable1}',
			'port': 5858,
			'sourceMaps': false,
			'outDir': null
		};
		const interactiveVariables = Object.create(null);
		interactiveVariables['interactiveVariable1'] = 'command1';
		interactiveVariables['interactiveVariable2'] = 'command2';

		configurationResolverService.resolveInteractiveVariables(configuration, interactiveVariables).then(resolved => {
			assert.deepEqual(resolved, {
				'name': 'Attach to Process',
				'type': 'node',
				'request': 'attach',
				'processId': 'command1',
				'port': 5858,
				'sourceMaps': false,
				'outDir': null
			});

			assert.equal(1, mockCommandService.callCount);
		});
	});

	test('interactive variable complex', () => {
		const configuration = {
			'name': 'Attach to Process',
			'type': 'node',
			'request': 'attach',
			'processId': '${command:interactiveVariable1}',
			'port': '${command:interactiveVariable2}',
			'sourceMaps': false,
			'outDir': 'src/${command:interactiveVariable2}',
			'env': {
				'processId': '__${command:interactiveVariable2}__',
			}
		};
		const interactiveVariables = Object.create(null);
		interactiveVariables['interactiveVariable1'] = 'command1';
		interactiveVariables['interactiveVariable2'] = 'command2';

		configurationResolverService.resolveInteractiveVariables(configuration, interactiveVariables).then(resolved => {
			assert.deepEqual(resolved, {
				'name': 'Attach to Process',
				'type': 'node',
				'request': 'attach',
				'processId': 'command1',
				'port': 'command2',
				'sourceMaps': false,
				'outDir': 'src/command2',
				'env': {
					'processId': '__command2__',
				}
			});

			assert.equal(2, mockCommandService.callCount);
		});
	});
});


class MockConfigurationService implements IConfigurationService {
	public _serviceBrand: any;
	public serviceId = IConfigurationService;
	public constructor(private configuration: any = {}) { }
	public inspect<T>(key: string, overrides?: IConfigurationOverrides): any { return { value: getConfigurationValue<T>(this.getConfiguration(), key), default: getConfigurationValue<T>(this.getConfiguration(), key), user: getConfigurationValue<T>(this.getConfiguration(), key), workspaceFolder: void 0, folder: void 0 }; }
	public keys() { return { default: [], user: [], workspace: [], workspaceFolder: [] }; }
	public getConfiguration(): any { return this.configuration; }
	public getValue(key: string): any { return getConfigurationValue<any>(this.getConfiguration(), key); }
	public updateValue(): TPromise<void> { return null; }
	public getConfigurationData(): any { return null; }
	public onDidChangeConfiguration() { return { dispose() { } }; }
	public reloadConfiguration() { return null; }
}

class MockCommandService implements ICommandService {

	public _serviceBrand: any;
	public callCount = 0;

	onWillExecuteCommand = () => ({ dispose: () => { } });
	public executeCommand(commandId: string, ...args: any[]): TPromise<any> {
		this.callCount++;
		return TPromise.as(commandId);
	}
}
