const assert = require('node:assert/strict');
const { test } = require('node:test');
const miio = require('miio');
const { RoborockClient } = require('../dist/roborockClient');
const { MatterVacuumBridge } = require('../dist/matterBridge');

const log = { info() {}, debug() {}, warn() {}, error() {} };

function clientFor(call, model = 'xiaomi.vacuum.b108gl') {
  const client = new RoborockClient('192.0.2.1', 'test-token', log);
  client.model = model;
  client.device = { call };
  return client;
}

const properties = [
  { siid: 3, piid: 1, value: 72 }, // Battery (different service, same piid as status)
  { siid: 2, piid: 1, value: 6 },
  { siid: 2, piid: 2, value: 0 },
  { siid: 2, piid: 8, value: 3 },
  { siid: 2, piid: 5, value: 125 },
  { siid: 2, piid: 6, value: 83 },
].map(row => ({ ...row, code: 0, did: '123456789' }));

test('connection selects MIoT when miio identifies the S20+', async t => {
  const call = t.mock.fn(async () => properties);
  t.mock.method(miio, 'device', async () => ({ miioModel: 'xiaomi.vacuum.b108gl', call }));
  const client = new RoborockClient('192.0.2.1', 'test-token', log);
  await client.connect();
  assert.equal(client.getModel(), 'xiaomi.vacuum.b108gl');
  assert.equal((await client.getState()).status, 'returning');
  assert.equal(call.mock.calls[0].arguments[0], 'get_properties');
});

test('S20+ reads MIoT status by service and property IDs, regardless of reply order or did', async () => {
  const client = clientFor(async (method, params) => {
    assert.equal(method, 'get_properties');
    assert.deepEqual(params.map(({ siid, piid }) => [siid, piid]), [
      [2, 1], [3, 1], [2, 2], [2, 8], [2, 5], [2, 6],
    ]);
    return properties;
  });
  assert.deepEqual(await client.getState(), {
    status: 'returning', batteryLevel: 72, fanSpeed: 75,
    errorCode: 0, cleanArea: 12500, cleanTime: 83,
  });
});

test('S20+ does not report fabricated state when a required property fails', async () => {
  const client = clientFor(async () => [
    { ...properties[0], code: -4004 },
    ...properties.slice(1),
  ]);
  await assert.rejects(client.getState(), /missing or invalid.*battery/);
});

test('S20+ uses the model-specific MIoT actions and all four suction levels', async () => {
  const calls = [];
  const client = clientFor(async (method, params) => {
    calls.push([method, params]);
    return method === 'action' ? { code: 0 } : [{ code: 0 }];
  });
  await client.startCleaning();
  await client.pauseCleaning();
  await client.resumeCleaning();
  await client.returnToDock();
  for (const speed of [25, 50, 75, 100]) await client.setFanSpeed(speed);

  assert.deepEqual(calls, [
    ...[[2, 1], [2, 6], [6, 1], [3, 1]].map(([siid, aiid]) =>
      ['action', { did: `call-${siid}-${aiid}`, siid, aiid, in: [] }]),
    ...[1, 2, 3, 4].map(value =>
      ['set_properties', [{ did: '2:8', siid: 2, piid: 8, value }]]),
  ]);
});

test('S20+ treats nonzero MIoT result codes as command failures', async () => {
  const client = clientFor(async method =>
    method === 'action' ? { code: -4004 } : [{ code: -4004 }]);
  await assert.rejects(client.returnToDock(), /action 3\/1 rejected \(code -4004\)/);
  await assert.rejects(client.setFanSpeed(50), /set suction rejected \(code -4004\)/);
});

test('Matter resumes a paused S20+ and does not advertise unsupported room cleaning', async () => {
  const calls = [];
  const client = clientFor(async (method, params) => {
    calls.push([method, params]);
    return { code: 0 };
  });
  let accessory;
  const api = { matter: {
    uuid: { generate: () => 'test-s20-plus' },
    deviceTypes: { RoboticVacuumCleaner: {} },
    registerPlatformAccessories: async (_plugin, _platform, accessories) => {
      accessory = accessories[0];
    },
  } };
  const bridge = new MatterVacuumBridge({
    name: 'S20+', ip: '192.0.2.1', rooms: [{ name: 'Kitchen', segmentId: 1 }],
  }, client, api, log, new Map());

  await bridge.start();
  assert.equal(accessory.clusters.serviceArea, undefined);
  assert.equal(accessory.handlers.serviceArea, undefined);
  assert.deepEqual(await client.getRoomMapping(), []);
  await assert.rejects(client.cleanSegments([1]), /Room cleaning is not supported/);
  await accessory.handlers.rvcOperationalState.resume();
  assert.deepEqual(calls, [['action', { did: 'call-6-1', siid: 6, aiid: 1, in: [] }]]);
});

test('Roborock S5 still uses the legacy resume and room cleaning commands', async () => {
  const calls = [];
  const client = clientFor(async (...args) => calls.push(args), 'roborock.vacuum.s5');
  await client.resumeCleaning();
  await client.cleanSegments([16, 18]);
  assert.deepEqual(calls, [['app_start', []], ['app_segment_clean', [16, 18]]]);
});
