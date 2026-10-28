import test from 'node:test'; import assert from 'node:assert/strict'; import { VALID_TRANSITIONS, serviceDateFor, estimateWaitingMinutes } from '../services/businessRules.js';
test('completed and cancelled tokens cannot transition back into active states',()=>{assert.deepEqual(VALID_TRANSITIONS.COMPLETED,[]);assert.deepEqual(VALID_TRANSITIONS.CANCELLED,[]);});
test('queue status transitions are explicit',()=>{assert.ok(VALID_TRANSITIONS.WAITING.includes('CALLED'));assert.ok(VALID_TRANSITIONS.IN_CONSULTATION.includes('COMPLETED'));assert.ok(!VALID_TRANSITIONS.IN_CONSULTATION.includes('WAITING'));});
test('service date is YYYY-MM-DD local date',()=>{assert.equal(serviceDateFor(new Date(2026,9,13,12)),'2026-10-13');});
test('waiting estimates cannot be negative',()=>{assert.equal(estimateWaitingMinutes(-2,10),0);assert.equal(estimateWaitingMinutes(3,10),30);assert.equal(estimateWaitingMinutes(3,-4),0);});
