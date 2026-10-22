import test from 'node:test';
import assert from 'node:assert/strict';
import {MONTHS,baseStart,rawHijri,monthSpan,plusDays,gregorianToHijri,hijriToGregorian,expandEvents,validateRecord,validateEvent} from '../assets/calendar.js';
test('12 Arabic Hijri months',()=>{assert.equal(MONTHS.length,12);assert.equal(MONTHS[8],'رمضان');});
test('calculated monthly first day is 1 Hijri',()=>{for(const [y,m] of [[1448,1],[1448,5],[1449,9]]){const h=rawHijri(baseStart(y,m));assert.deepEqual([h.year,h.month,h.day],[y,m,1]);}});
test('month length normally 29 or 30 days',()=>{const s=monthSpan(1448,4,'DZ');assert.ok([29,30].includes(s.length));});
test('round trip within Hijri month',()=>{for(let day=1;day<=28;day++){const iso=hijriToGregorian(1448,5,day,'DZ');const h=gregorianToHijri(iso,'DZ');assert.deepEqual([h.year,h.month,h.day],[1448,5,day]);}});
test('country override changes month anchor and day mapping',()=>{
 const s=baseStart(1448,5),record={year:1448,month:5,country:'DZ',date:plusDays(s,1),authority:'جهة رسمية',url:'https://example.org/notice'};
 assert.ok(validateRecord(record));assert.equal(hijriToGregorian(1448,5,1,'DZ',[record]),record.date);assert.equal(hijriToGregorian(1448,5,1,'SA',[record]),s);
});
test('Hijri dates float with beginning-of-month override',()=>{
 const start=baseStart(1448,5),event={id:'test-id',title:'موعد',anchor:'hijri',year:1448,month:5,day:3,repeat:'none',time:'09:00',remind:'15'};
 assert.ok(validateEvent(event));const normal=expandEvents([event],start,plusDays(start,12),'DZ');
 const change=expandEvents([event],start,plusDays(start,12),'DZ',[{year:1448,month:5,country:'DZ',date:plusDays(start,1),authority:'بيان رسمي',url:'https://example.com'}]);assert.equal(normal.length,1);assert.equal(change.length,1);assert.equal(change[0].date,plusDays(normal[0].date,1));
});
test('Gregorian anchored event stays unchanged',()=>{
 const e={id:'test-fixed',title:'يوم محدد',anchor:'gregorian',date:'2026-10-22',repeat:'none',remind:'-1'};
 const arr=expandEvents([e],'2026-10-20','2026-10-30','DZ');assert.equal(arr[0].date,'2026-10-22');
});
test('malformed imported data is rejected',()=>{
 assert.equal(validateRecord({country:'DZ',year:1448,month:1,date:'2026-06-16',authority:'مصدر',url:'javascript:alert(1)'}),false);
 assert.equal(Boolean(validateEvent({id:'x',title:'',anchor:'hijri',repeat:'none'})),false);
});
