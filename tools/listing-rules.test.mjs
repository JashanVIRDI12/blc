import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlate, plateDigits, plateLabel, shownRegistration, suggestPlate } from '../src/listing-rules.js';

test('every one- and two-digit number is VIP, including leading zeros', () => {
  for (let value = 1; value <= 99; value++) {
    const number = String(value).padStart(4, '0');
    for (const input of [String(value), number, `HR51CM${number}`, `hr 51 cm ${number}`]) {
      assert.deepEqual(suggestPlate(input), { tag: 'vip', number }, input);
    }
  }
  assert.notEqual(suggestPlate('0100')?.tag, 'vip');
});

test('existing VIP and Fancy patterns keep their categories', () => {
  for (const number of ['1111', '7777', '9999', '1000', '5000']) assert.deepEqual(suggestPlate(number), { tag: 'vip', number });
  for (const number of ['7272', '8822', '1221', '0202', '9990', '1234', '4321', '0786']) assert.deepEqual(suggestPlate(number), { tag: 'fancy', number });
  for (const number of ['1357', '4836', '9908']) assert.equal(suggestPlate(number), null);
});

test('blank, zero, malformed and unfinished registrations do not create tags', () => {
  for (const input of ['', null, undefined, '0', '0000', 'HR', 'HR51', 'HR51CM', 'DL3', 'CH01', '12345', 'HR51CM12345']) assert.equal(suggestPlate(input), null, String(input));
  assert.equal(plateDigits(''), '');
  assert.equal(plateDigits('HR51'), '');
  assert.equal(plateDigits('DL3'), '');
  assert.equal(plateDigits('HR51CM20'), '0020');
  assert.equal(plateDigits('CH010020'), '0020');
  assert.equal(plateDigits('DL30001'), '0001');
  assert.equal(shownRegistration('HR51CM0020'), 'HR51');
});

test('older Fancy tags for low numbers are corrected across labels and records', () => {
  for (const number of ['1', '0001', '20', '0020', '0099']) {
    const padded = number.padStart(4, '0');
    assert.deepEqual(normalizePlate({ plateTag: 'fancy', plateNumber: number }), { plateTag: 'vip', plateNumber: padded });
    assert.equal(plateLabel({ plateTag: 'fancy', plateNumber: number }), `VIP No. ${padded}`);
  }
  assert.equal(plateLabel({ plateTag: 'fancy', plateNumber: '0020' }, { vipLabel: 'VIP Number' }), 'VIP Number 0020');
});

test('None stays untagged and other manual selections remain available', () => {
  assert.deepEqual(normalizePlate({ plateTag: '', plateNumber: '0020' }), { plateTag: '', plateNumber: '' });
  assert.deepEqual(normalizePlate({ plateTag: 'fancy', plateNumber: '4836' }), { plateTag: 'fancy', plateNumber: '4836' });
  assert.deepEqual(normalizePlate({ plateTag: 'vip', plateNumber: '0786' }), { plateTag: 'vip', plateNumber: '0786' });
  for (const car of [null, {}, { plateTag: 'vip', plateNumber: '' }, { plateTag: 'fancy', plateNumber: '0000' }]) assert.equal(plateLabel(car), '');
});
