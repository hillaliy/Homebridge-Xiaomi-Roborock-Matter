const assert = require('node:assert/strict');
const { test } = require('node:test');
const { RoborockClient } = require('../dist/roborockClient');
const { MatterVacuumBridge } = require('../dist/matterBridge');

const log = { info() {}, debug() {}, warn() {}, error() {} };

function createClient(model, call) {
  const client = new RoborockClient('192.0.2.1', 'test-token', log);
  client.model = model;
  client.device = { call };
  return client;
}

test('v1 waits for pause acknowledgement before requesting the dock', async () => {
  const commands = [];
  let acknowledgePause;
  const client = createClient('rockrobo.vacuum.v1', async (command, args) => {
    commands.push(command);
    assert.deepEqual(args, []);
    if (command === 'app_pause') {
      await new Promise(resolve => { acknowledgePause = resolve; });
    }
    return ['ok'];
  });
  const pending = client.returnToDock();
  assert.deepEqual(commands, ['app_pause']);
  acknowledgePause();
  await pending;
  assert.deepEqual(commands, ['app_pause', 'app_charge']);
});

test('other models keep the direct dock command', async () => {
  const commands = [];
  const client = createClient('roborock.vacuum.s5', async command => {
    commands.push(command);
  });
  await client.returnToDock();
  assert.deepEqual(commands, ['app_charge']);
});

test('pause failure rejects the operation without claiming dock success', async () => {
  const commands = [];
  const client = createClient('rockrobo.vacuum.v1', async command => {
    commands.push(command);
    throw new Error('miio timeout');
  });
  await assert.rejects(client.returnToDock(), /miio timeout/);
  assert.deepEqual(commands, ['app_pause']);
});

for (const action of ['goHome', 'stop']) {
  test(`Matter ${action} routes to the v1 docking sequence while cleaning`, async () => {
    const commands = [];
    const client = createClient('rockrobo.vacuum.v1', async command => {
      commands.push(command);
      return ['ok'];
    });
    let accessory;
    const api = { matter: {
      uuid: { generate: () => 'test-vacuum' },
      deviceTypes: { RoboticVacuumCleaner: {} },
      registerPlatformAccessories: async (_plugin, _platform, accessories) => {
        accessory = accessories[0];
      },
    } };
    const bridge = new MatterVacuumBridge(
      { name: 'Test', ip: '192.0.2.1' }, client, api, log, new Map(),
    );
    await bridge.start();
    bridge.lastState = { status: 'cleaning', batteryLevel: 80, fanSpeed: 50,
      errorCode: 0, cleanTime: 10, cleanArea: 100 };
    if (action === 'goHome') {
      await accessory.handlers.rvcOperationalState.goHome();
    } else {
      await accessory.handlers.rvcRunMode.changeToMode({ newMode: 0 });
    }
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(commands, ['app_pause', 'app_charge']);
  });
}
