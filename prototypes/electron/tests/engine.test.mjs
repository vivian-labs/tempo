import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Instrument, parseDuration, formatDuration, nextAlarmAt } from '../app/engine.mjs';

test('duration input rejects ambiguity and supports mm:ss and hh:mm:ss', () => {
 assert.equal(parseDuration('25'), 1500000);
 assert.equal(parseDuration('1:30'), 90000);
 assert.equal(parseDuration('1:02:03'), 3723000);
 for (const invalid of ['', '0','-1','abc','2:80','1:90:00','1e3','9999999']) assert.equal(parseDuration(invalid), null, invalid);
 assert.equal(formatDuration(59999), '01:00');
});
test('deadline based countdown stays accurate after callbacks are delayed', () => {
 const t = new Instrument(); t.setDuration(60000); t.start(1000);
 assert.equal(t.remaining(45000),16000);
 assert.equal(t.remaining(90000),0);
 assert.deepEqual(t.update(90000).map(e=>e.type),['timer']);
 assert.deepEqual(t.update(90001),[]);
 assert.equal(t.state.timer.status,'finished');
});
test('pausing freezes remaining time and resuming does not reset the session', () => {
 const t=new Instrument(); t.setDuration(60000); t.start(1000); t.pause(11000);
 assert.equal(t.remaining(50000),50000);
 t.start(100000); assert.equal(t.remaining(110000),40000);
 t.reset(); assert.equal(t.remaining(120000),60000);
});
test('running timer survives restart, including restart after deadline', () => {
 const t=new Instrument(); t.setDuration(60000); t.start(1000);
 const restored = new Instrument(JSON.parse(JSON.stringify(t.state)));
 assert.equal(restored.remaining(31000),30000);
 assert.equal(restored.update(90000)[0].type,'timer');
 assert.equal(restored.update(90001).length,0);
});
test('alarm scheduled for today or tomorrow and survives local date changes', () => {
 const n=new Date(2026,9,16,8,30).getTime();
 assert.equal(new Date(nextAlarmAt('09:00',n)).getDate(),16);
 assert.equal(new Date(nextAlarmAt('08:00',n)).getDate(),17);
 const t = new Instrument(); t.setAlarm('09:00',true,n);
 assert.equal(t.update(new Date(2026,9,16,9,0).getTime())[0].type,'alarm');
 assert.equal(t.update(new Date(2026,9,16,9,1).getTime()).length,0);
 assert.equal(new Date(t.state.alarm.nextAt).getDate(),17);
});
test('snooze rings once, then returns to the daily alarm', () => {
 const now=new Date(2026,9,16,8,30).getTime(); const t=new Instrument();
 t.setAlarm('09:00',true,now); t.snooze(now);
 assert.equal(t.update(now+300000)[0].type,'snooze');
 assert.equal(t.update(now+300001).length,0);
 assert.equal(t.state.alarm.enabled,true);
});
test('corrupt persisted settings cannot create invalid timing or loud sound', () => {
 const t=new Instrument({timer:{duration:-1,status:'running',deadline:'bad'},settings:{volume:999,sound:true},alarm:{time:'99:99',enabled:true}});
 assert.equal(t.state.timer.status,'idle');
 assert.equal(t.state.settings.sound,false);
 assert.ok(t.state.settings.volume<=1);
 assert.equal(t.state.alarm.enabled,false);
});
