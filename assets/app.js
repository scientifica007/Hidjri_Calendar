import {MONTHS,WEEKDAYS,COUNTRIES,localToday,plusDays,dayDifference,validISO,rawHijri,gregorianToHijri,hijriToGregorian,monthSpan,nextMonth,monthId,monthLabel,hijriLabel,niceGregorian,shortGregorian,safeText,expandEvents,validateEvent,validateRecord} from './calendar.js';
const $=id=>document.getElementById(id);
const KEY='miqat:workspace:v1';
const defaultState={events:[],overrides:[],country:'DZ',showGregorian:true,weekends:true,theme:'light'};
let state=loadState(),seed=[],feed={entries:[],fetchedAt:null},selectedDate=localToday(),view='calendar',shown={year:1448,month:5};
const sources=[
 {name:'وزارة الشؤون الدينية والأوقاف',category:'الجزائر · المصدر الوطني',desc:'المرجع الأول لبيانات الأهلة والقرارات الصادرة في الجزائر.',url:'https://marw.gov.dz/'},
 {name:'المشروع الإسلامي لرصد الأهلة',category:'دولي · رصد ومقارنة',desc:'خرائط الرؤية، تقارير الراصدين وبدايات الأشهر المعلنة لدى الدول. لا يحل محل البيان الوطني.',url:'https://astronomycenter.net/?l=ar'},
 {name:'تقويم أم القرى',category:'السعودية · مرجع حسابي',desc:'مرجع حسابي رسمي سعودي؛ لا يُثبت بمفرده بدء شهر شرعي في الجزائر.',url:'https://www.ummulqura.org.sa/en'},
 {name:'وكالة الأنباء السعودية',category:'السعودية · إعلان المحكمة',desc:'تُنشر من خلالها بيانات المحكمة العليا بشأن ثبوت الأهلة عند صدورها.',url:'https://www.spa.gov.sa/'}
];
function loadState(){try{const o=JSON.parse(localStorage.getItem(KEY)||'null');return o&&typeof o==='object'?{...defaultState,...o,events:Array.isArray(o.events)?o.events.filter(validateEvent).slice(0,2000):[],overrides:Array.isArray(o.overrides)?o.overrides.filter(validateRecord).slice(0,600):[]}:structuredClone(defaultState);}catch{return structuredClone(defaultState);}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('storage-status').textContent='تم حفظ '+state.events.length+' موعد في هذا المتصفح.';return true;}catch{toast('تعذر الحفظ المحلي. صدّر نسخة احتياطية من البيانات.');return false;}}
function records(){return [...state.overrides,...seed];}
function country(){return Object.hasOwn(COUNTRIES,state.country)?state.country:'DZ';}
function currentH(){return gregorianToHijri(selectedDate,country(),records());}
function shownSpan(){return monthSpan(shown.year,shown.month,country(),records());}
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),4200);}
function renderAll(){renderCalendar();renderDay();renderAgenda();renderObservations();renderSidebar();renderSettings();}
function switchView(next){
 if(!['calendar','agenda','sources','settings'].includes(next))return;
 view=next;for(const s of ['calendar','agenda','sources','settings'])$('view-'+s).hidden=s!==next;
 for(const btn of document.querySelectorAll('.nav-item')){const active=btn.dataset.view===next;btn.classList.toggle('active',active);if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');}
 $('view-label').textContent={calendar:'التقويم',agenda:'جدول الأعمال',sources:'مطالع الأهلة',settings:'الإعدادات'}[next];
 closeMenu();window.scrollTo({top:0,behavior:'smooth'});
 if(next==='agenda')renderAgenda();if(next==='sources'){renderObservations();renderFeed();}
}
function setShown(year,month){shown={year,month};selectedDate=shownSpan().start;renderAll();}
function goToday(){selectedDate=localToday();const h=currentH();shown={year:h.year,month:h.month};switchView('calendar');renderAll();}
function calcStatus(span){
 if(span.record){
  const type=span.record.quality==='reported'?'بداية منشورة في تجميع أو تغطية إخبارية؛ راجع البيان الوطني':'بداية شهر موثقة بمصدر أدخلته';
  return {label:'◉ '+type,verified:true};
 }
 return {label:'◌ بداية حسابية تقديرية، وليست إعلانًا رسميًا في '+COUNTRIES[country()],verified:false};
}
function renderCalendar(){
 let span;try{span=shownSpan();}catch(error){toast(error.message);return;}
 $('month-title').textContent=monthLabel(shown.year,shown.month);
 $('month-subtitle').textContent=shortGregorian(span.start)+' — '+shortGregorian(plusDays(span.end,-1));
 const st=calcStatus(span),badge=$('month-status');badge.classList.toggle('verified',st.verified);
 badge.replaceChildren(document.createTextNode(st.label));
 if(span.record){const a=document.createElement('a');a.href=span.record.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=' · فتح المصدر ↗';badge.append(a);}
 if(!span.consistent)badge.append(document.createTextNode(' · تنبيه: التعارض بين البدايات الموثقة والتقديرية أعطى شهرًا بطول '+span.length+' يومًا. راجع توثيق الشهر التالي.'));
 const now=localToday(),startDow=new Date(span.start+'T12:00:00Z').getUTCDay();
 $('weekdays').innerHTML=WEEKDAYS.map(w=>'<span>'+w+'</span>').join('');
 const grid=$('days-grid');grid.innerHTML='';
 const days=Math.ceil((startDow+span.length)/7)*7;
 const from=plusDays(span.start,-startDow),to=plusDays(from,days-1);
 const byDate=new Map();for(const o of expandEvents(state.events,from,to,country(),records())){if(!byDate.has(o.date))byDate.set(o.date,[]);byDate.get(o.date).push(o);}
 for(let i=0;i<days;i++){
  const iso=plusDays(from,i),within=iso>=span.start&&iso<span.end,h=gregorianToHijri(iso,country(),records()),gregDay=Number(iso.slice(8,10)),dow=new Date(iso+'T12:00:00Z').getUTCDay(),ev=byDate.get(iso)||[];
  const button=document.createElement('button');button.type='button';button.className='day-cell'+(!within?' outside':'')+(iso===selectedDate?' selected':'')+(iso===now?' today':'')+(state.weekends&&(dow===5||dow===6)?' weekend':'');
  button.dataset.date=iso;button.setAttribute('aria-label',hijriLabel(h)+' الموافق '+niceGregorian(iso)+(ev.length?'، '+ev.length+' مواعيد':''));
  const hnum=within?h.day:(h.day>30?'—':h.day);
  button.innerHTML='<span class="day-number">'+hnum+'</span>'+(state.showGregorian?'<span class="greg-number">'+gregDay+' م</span>':'')+(ev.length?'<span class="event-dots">'+ev.slice(0,3).map(o=>'<i class="'+(o.event.priority==='high'?'high':'')+'"></i>').join('')+'</span>':'');
  grid.append(button);
 }
 const todayH=gregorianToHijri(now,country(),records());
 $('hero-hijri').textContent=hijriLabel(todayH);
 $('hero-gregorian').textContent=shortGregorian(now);
}
function renderDay(){
 const h=currentH();$('selected-hijri').textContent=hijriLabel(h);$('selected-gregorian').textContent=niceGregorian(selectedDate);
 const sp=monthSpan(h.year,h.month,country(),records());$('selected-status').textContent=sp.record?'بداية الشهر موثقة بمصدر: '+sp.record.authority:'بداية شهر تقديرية حتى صدور بيان معتمد';
 const occurrences=expandEvents(state.events,selectedDate,selectedDate,country(),records());
 $('day-events').innerHTML=occurrences.length?occurrences.map(o=>'<div class="event-row"><span class="event-color '+(o.event.priority==='high'?'high':'')+'"></span><div class="event-main"><b class="'+(o.done?'done':'')+'">'+safeText(o.event.title)+'</b><small>'+(o.event.time||'طوال اليوم')+(o.event.repeat!=='none'?' · موعد متكرر':'')+'</small></div><div class="event-actions"><button class="mini-btn" data-complete="'+safeText(o.event.id)+'" data-occ="'+o.date+'" title="'+(o.done?'تراجع عن الإنجاز':'تعليم كمنجز')+'">'+(o.done?'↺':'✓')+'</button><button class="mini-btn" data-edit="'+safeText(o.event.id)+'" title="تعديل">✎</button></div></div>').join(''):'<div class="empty"><span class="empty-icon">✧</span>يوم خالٍ من المواعيد.<br>يمكنك تخصيصه لمهمة جديدة.</div>';
}
function renderAgenda(){
 const from=plusDays(localToday(),-45),to=plusDays(localToday(),400),filter=$('agenda-filter').value;
 const occurrences=expandEvents(state.events,from,to,country(),records()).filter(o=>filter==='all'||(filter==='done'?o.done:!o.done));
 $('agenda-count').textContent=occurrences.length+' موعد معروض';
 $('agenda-list').innerHTML=occurrences.length?occurrences.map(o=>{
  const h=gregorianToHijri(o.date,country(),records());
  return '<article class="agenda-item"><div class="agenda-date"><b>'+h.day+' '+MONTHS[h.month-1]+'</b><small>'+o.date.split('-').reverse().join('/')+'</small></div><div class="agenda-details"><b'+(o.done?' style="text-decoration:line-through;opacity:.6"':'')+'>'+safeText(o.event.title)+'</b><p>'+(o.event.time?'الساعة '+o.event.time+' · ':'')+safeText(o.event.notes||'')+'</p></div><span class="chip '+(o.done?'complete':'')+'">'+(o.done?'منجز':o.event.repeat==='none'?'موعد':'متكرر')+'</span><div class="agenda-buttons"><button class="small-btn" data-complete="'+safeText(o.event.id)+'" data-occ="'+o.date+'">'+(o.done?'إعادة فتح':'إنجاز')+'</button><button class="small-btn" data-edit="'+safeText(o.event.id)+'">تعديل</button><button class="mini-btn" data-delete="'+safeText(o.event.id)+'" aria-label="حذف الموعد">×</button></div></article>';
 }).join(''):'<div class="empty">لا توجد مواعيد مطابقة في المدة المعروضة (من 45 يومًا مضت إلى 400 يوم قادم).</div>';
}
function renderSidebar(){
 const now=localToday(),occ=expandEvents(state.events,now,plusDays(now,370),country(),records()).find(x=>!x.done);
 $('sidebar-next').innerHTML=occ?'<b>'+safeText(occ.event.title)+'</b><span>'+hijriLabel(gregorianToHijri(occ.date,country(),records()))+'</span><br><small>'+niceGregorian(occ.date)+(occ.event.time?' · '+occ.event.time:'')+'</small>':'لم تُضف مواعيد مستقبلية غير منجزة بعد.';
}
function renderSettings(){
 $('country').value=country();$('gregorian-secondary').checked=state.showGregorian;$('weekend-highlight').checked=state.weekends;
 $('storage-status').textContent='عدد المواعيد: '+state.events.length+' · عدد التصحيحات المحلية: '+state.overrides.length;
 const n=$('notification-state');n.textContent=!('Notification'in window)?'هذا المتصفح لا يدعم تنبيهات النظام.':'حالة الإذن: '+({granted:'مفعّل',denied:'مرفوض',default:'لم يُمنح بعد'}[Notification.permission]||'غير معروف');
 $('ask-notifications').disabled=!(window.isSecureContext&&'Notification'in window);
}
function renderSources(){
 $('source-cards').innerHTML=sources.map(s=>'<article class="source-card"><span class="source-tag">'+safeText(s.category)+'</span><b>'+safeText(s.name)+'</b><p>'+safeText(s.desc)+'</p><a href="'+s.url+'" target="_blank" rel="noopener noreferrer">زيارة المصدر ↗</a></article>').join('');
}
function renderFeed(){
 const el=$('headline-list');$('feed-updated').textContent=feed.fetchedAt?'آخر فحص: '+safeText(feed.fetchedAt.slice(0,16).replace('T',' '))+' UTC':'لا توجد نتيجة رصد آلية متاحة';
 const arr=Array.isArray(feed.entries)?feed.entries:[];
 el.innerHTML=arr.length?arr.slice(0,25).map(e=>'<a target="_blank" rel="noopener noreferrer" href="'+safeText(e.url)+'"><span>'+safeText(e.title)+'</span><small>'+safeText(e.source)+' ↗</small></a>').join(''):'<p class="minor">لم تتوفر عناوين مراقبة بعد. استعمل روابط الجهات أعلاه للتحقق مباشرة. بيانات التقويم لا تتغير تلقائيًا بناءً على هذه العناوين.</p>';
 if(feed.errors?.length)el.insertAdjacentHTML('beforeend','<p class="minor">تعذر فحص بعض المصادر في آخر محاولة.</p>');
}
async function refreshFeed(){
 try{const r=await fetch('./data/headlines.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Unavailable');const d=await r.json();feed={fetchedAt:d.fetchedAt||null,entries:(d.entries||[]).filter(e=>e&&typeof e.url==='string'&&/^https:\/\//.test(e.url)&&typeof e.title==='string'),errors:d.errors||[]};}catch{feed={entries:[],fetchedAt:null};}
 renderFeed();
}
function renderObservations(){
 const all=records().filter(r=>r.country===country()).sort((a,b)=>b.year-a.year||b.month-a.month);
 $('observation-list').innerHTML=all.length?all.map(r=>'<div class="ob-row"><div><b>'+monthLabel(r.year,r.month)+' — '+r.date.split('-').reverse().join('/')+'</b><small>'+safeText(r.authority)+' · '+(state.overrides.includes(r)?'توثيق محلي':'سجل مرجعي منشور')+'</small></div><div><a class="text-btn" target="_blank" rel="noopener noreferrer" href="'+safeText(r.url)+'">المصدر ↗</a> '+(state.overrides.includes(r)?'<button class="mini-btn" data-delrecord="'+r.year+'-'+r.month+'-'+r.country+'" title="حذف التصحيح المحلي">×</button>':'')+'</div></div>').join(''):'<p class="minor">لا توجد بدايات أشهر موثّقة لهذا البلد في البيانات الحالية، وتظل بقية الأشهر تقديرية.</p>';
}
function fillMonthSelect(id){$(id).innerHTML=MONTHS.map((name,i)=>'<option value="'+(i+1)+'">'+name+'</option>').join('');}
function openEvent(event=null,date=selectedDate){
 const f=$('event-form');f.reset();$('event-error').textContent='';$('event-id').value=event?.id||'';$('event-dialog-title').textContent=event?'تعديل موعد':'موعد جديد';
 $('event-title').value=event?.title||'';$('event-type').value=event?.type||'task';$('event-priority').value=event?.priority||'normal';
 const h=gregorianToHijri(date,country(),records());$('date-system').value=event?.anchor||'hijri';
 $('hday').value=event?.day||h.day;$('hmonth').value=event?.month||h.month;$('hyear').value=event?.year||h.year;
 $('gdate').value=event?.date||date;$('event-time').value=event?.time||'';$('event-remind').value=String(event?.remind??'-1');
 $('event-repeat').value=event?.repeat||'none';$('event-notes').value=event?.notes||'';syncDateFields();$('event-dialog').showModal();$('event-title').focus();
}
function syncDateFields(){
 const h=$('date-system').value==='hijri';$('hijri-fields').hidden=!h;$('gregorian-fields').hidden=h;
}
function saveEvent(e){
 e.preventDefault();$('event-error').textContent='';
 const id=$('event-id').value,anchor=$('date-system').value,repeat=$('event-repeat').value;
 const data={id:id||crypto.randomUUID(),title:$('event-title').value.trim(),anchor,repeat,type:$('event-type').value,priority:$('event-priority').value,time:$('event-time').value,remind:$('event-remind').value,notes:$('event-notes').value.trim(),done:false,doneDates:[],year:Number($('hyear').value),month:Number($('hmonth').value),day:Number($('hday').value),date:$('gdate').value};
 if(repeat==='hijri-month'||repeat==='hijri-year'){if(anchor!=='hijri')return $('event-error').textContent='التكرار الهجري يتطلب اختيار تاريخ هجري.';}
 if(repeat==='gregorian-year'&&anchor!=='gregorian')return $('event-error').textContent='التكرار الميلادي يتطلب اختيار تاريخ ميلادي.';
 if(!validateEvent(data))return $('event-error').textContent='تحقق من العنوان والتاريخ والتوقيت المدخل.';
 let target;try{target=anchor==='hijri'?hijriToGregorian(data.year,data.month,data.day,country(),records()):data.date;}catch{target=null;}
 if(!target)return $('event-error').textContent='هذا اليوم غير موجود في الشهر الهجري المختار، أو تاريخ خارج المجال المدعوم.';
 const previous=state.events.find(x=>x.id===id);data.createdAnchorDate=previous?.createdAnchorDate||target;data.done=previous?.done||false;data.doneDates=previous?.doneDates||[];
 if(id)state.events=state.events.map(x=>x.id===id?data:x);else state.events.push(data);
 save();$('event-dialog').close();selectedDate=target;const h=gregorianToHijri(target,country(),records());shown={year:h.year,month:h.month};renderAll();toast(id?'تم تعديل الموعد.':'حُفظ الموعد.');
}
function toggleDone(id,date){
 const e=state.events.find(x=>x.id===id);if(!e)return;
 if(e.repeat==='none')e.done=!e.done;else{e.doneDates=Array.isArray(e.doneDates)?e.doneDates:[];if(e.doneDates.includes(date))e.doneDates=e.doneDates.filter(d=>d!==date);else e.doneDates.push(date);}
 save();renderAll();
}
function openObservation(){
 $('observation-form').reset();$('ob-error').textContent='';$('ob-country').value=country();$('ob-year').value=shown.year;$('ob-month').value=shown.month;$('ob-date').value=shownSpan().start;$('observation-dialog').showModal();
}
function saveObservation(e){
 e.preventDefault();const r={country:$('ob-country').value,year:Number($('ob-year').value),month:Number($('ob-month').value),date:$('ob-date').value,authority:$('ob-authority').value.trim(),url:$('ob-url').value.trim(),quality:'direct'};
 if(!validateRecord(r))return $('ob-error').textContent='تحقق من جميع الحقول. يلزم رابط HTTPS صالح، وتاريخ لا يبتعد أكثر من 3 أيام عن التقدير الحسابي.';
 state.overrides=state.overrides.filter(x=>!(x.country===r.country&&x.year===r.year&&x.month===r.month));state.overrides.unshift(r);save();$('observation-dialog').close();renderAll();toast('حُفظ التاريخ الذي وثقته، وسيُستعمل في حساب المواعيد الهجرية.');
}
function download(name,body,type='application/json'){
 const url=URL.createObjectURL(new Blob([body],{type:type+';charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function exportJSON(){
 download('miqat-backup-'+localToday()+'.json',JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),...state},null,2));
 toast('نُزّلت نسخة احتياطية.');
}
async function importJSON(file){
 if(!file||file.size>2_000_000)return toast('الملف غير صالح أو أكبر من 2 ميغابايت.');
 try{
  const data=JSON.parse(await file.text());
  if(data.schemaVersion!==1||!Array.isArray(data.events)||data.events.length>2000||!data.events.every(validateEvent)||!Array.isArray(data.overrides)||data.overrides.length>600||!data.overrides.every(validateRecord))throw Error('بنية ملف النسخة الاحتياطية غير صالحة.');
  if(!confirm('سيُستبدل جدولك الحالي ببيانات الملف المختار. هل تريد المتابعة؟'))return;
  state={...defaultState,events:data.events.map(x=>({...x,notes:String(x.notes||'').slice(0,1000),doneDates:Array.isArray(x.doneDates)?x.doneDates.filter(validISO).slice(0,300):[]})),overrides:data.overrides,country:Object.hasOwn(COUNTRIES,data.country)?data.country:'DZ',showGregorian:data.showGregorian!==false,weekends:data.weekends!==false,theme:data.theme==='dark'?'dark':'light'};
  save();applyTheme();goToday();toast('تم استيراد البيانات.');
 }catch(error){toast('تعذر الاستيراد: '+error.message);}
 $('import-file').value='';
}
function icsEscape(x){return String(x||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
function icsDate(date,time){const t=time||'09:00';return new Date(date+'T'+t+':00+01:00').toISOString().replace(/[-:]/g,'').replace('.000','');}
function exportICS(){
 const from=localToday(),occ=expandEvents(state.events,from,plusDays(from,370),country(),records());
 const now=new Date().toISOString().replace(/[-:]/g,'').replace('.000','');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MIQAT//Arabic Hijri Calendar//AR','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:مِيقات'];
 for(const o of occ){
  const e=o.event,stamp=e.time?icsDate(o.date,e.time):null;
  const endsNextDay=e.time&&Number(e.time.slice(0,2))===23;
  const end=e.time?icsDate(endsNextDay?plusDays(o.date,1):o.date,plusTime(e.time)):null;
  lines.push('BEGIN:VEVENT','UID:'+e.id+'-'+o.date+'@miqat.local','DTSTAMP:'+now,e.time?'DTSTART:'+stamp:'DTSTART;VALUE=DATE:'+o.date.replaceAll('-',''),e.time?'DTEND:'+end:'DTEND;VALUE=DATE:'+plusDays(o.date,1).replaceAll('-',''),'SUMMARY:'+icsEscape(e.title),'DESCRIPTION:'+icsEscape(e.notes||'')+(e.anchor==='hijri'?'\\nمرتبط بتاريخ هجري تقديري أو موثق عند التصدير':''),'STATUS:'+(o.done?'COMPLETED':'CONFIRMED'));
  if(e.time&&Number(e.remind)>=0)lines.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEscape(e.title),'TRIGGER:-PT'+e.remind+'M','END:VALARM');
  lines.push('END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 download('miqat-events-'+from+'.ics',lines.join('\r\n'),'text/calendar');toast('تم تصدير '+occ.length+' موعد.');
}
function plusTime(time){const minutes=Number(time.slice(0,2))*60+Number(time.slice(3))+60;return String(Math.floor(minutes/60)%24).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
function applyTheme(){document.body.classList.toggle('dark',state.theme==='dark');}
async function askNotification(){
 if(!('Notification'in window)||!window.isSecureContext)return toast('التنبيهات غير مدعومة هنا.');
 const result=await Notification.requestPermission();renderSettings();toast(result==='granted'?'تم تفعيل إذن التنبيهات.':'لم يُفعّل إذن التنبيهات.');
}
function checkReminders(){
 if(!('Notification'in window)||Notification.permission!=='granted')return;
 const now=new Date(),nowMs=now.getTime(),start=plusDays(localToday(),-2),end=plusDays(localToday(),2);
 const doneKey='miqat:notifications:v1';let notified={};try{notified=JSON.parse(localStorage.getItem(doneKey)||'{}')||{};}catch{}
 for(const o of expandEvents(state.events,start,end,country(),records())){
  const e=o.event;if(o.done||!e.time||Number(e.remind)<0)continue;
  const ms=new Date(o.date+'T'+e.time+':00+01:00').getTime()-Number(e.remind)*60000;
  if(!Number.isFinite(ms)||nowMs<ms||nowMs-ms>70000||notified[o.key])continue;
  try{new Notification('مِيقَات | '+e.title,{body:'موعدك: '+niceGregorian(o.date)+' · '+e.time,tag:o.key});notified[o.key]=Date.now();}catch{}
 }
 for(const k of Object.keys(notified))if(Date.now()-notified[k]>30*86400000)delete notified[k];
 try{localStorage.setItem(doneKey,JSON.stringify(notified));}catch{}
}
function closeMenu(){$('sidebar').classList.remove('open');$('overlay').hidden=true;}
function initHandlers(){
 document.addEventListener('click',e=>{
  const switcher=e.target.closest('[data-view]');if(switcher){switchView(switcher.dataset.view);return;}
  const day=e.target.closest('[data-date]');if(day){selectedDate=day.dataset.date;const h=currentH();if(h.year!==shown.year||h.month!==shown.month)shown={year:h.year,month:h.month};renderCalendar();renderDay();return;}
  const done=e.target.closest('[data-complete]');if(done){toggleDone(done.dataset.complete,done.dataset.occ);return;}
  const edit=e.target.closest('[data-edit]');if(edit){const item=state.events.find(v=>v.id===edit.dataset.edit);if(item)openEvent(item);return;}
  const del=e.target.closest('[data-delete]');if(del){if(confirm('حذف هذا الموعد وكل تكراراته؟')){state.events=state.events.filter(v=>v.id!==del.dataset.delete);save();renderAll();toast('تم حذف الموعد.');}return;}
  const delrec=e.target.closest('[data-delrecord]');if(delrec){const [year,month,c]=delrec.dataset.delrecord.split('-');if(confirm('حذف هذه البداية الموثقة محليًا والعودة إلى المرجع السابق؟')){state.overrides=state.overrides.filter(v=>!(v.year===Number(year)&&v.month===Number(month)&&v.country===c));save();renderAll();}return;}
 });
 $('prev-month').onclick=()=>{const m=nextMonth(shown.year,shown.month,-1);setShown(m.year,m.month);};
 $('next-month').onclick=()=>{const m=nextMonth(shown.year,shown.month,1);setShown(m.year,m.month);};
 $('go-today').onclick=goToday;$('go-today-top').onclick=goToday;
 for(const id of ['new-event','agenda-new','add-to-day'])$(id).onclick=()=>openEvent();
 $('event-form').onsubmit=saveEvent;$('date-system').onchange=syncDateFields;
 for(const x of document.querySelectorAll('.close-dialog'))x.onclick=()=>x.closest('dialog').close();
 $('agenda-filter').onchange=renderAgenda;
 $('country').onchange=e=>{state.country=e.target.value;save();goToday();renderObservations();};
 $('gregorian-secondary').onchange=e=>{state.showGregorian=e.target.checked;save();renderCalendar();};
 $('weekend-highlight').onchange=e=>{state.weekends=e.target.checked;save();renderCalendar();};
 $('theme-switch').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';save();applyTheme();};
 $('ask-notifications').onclick=askNotification;$('export-ics').onclick=exportICS;
 $('export-json').onclick=exportJSON;$('import-json').onclick=()=>$('import-file').click();$('import-file').onchange=e=>importJSON(e.target.files[0]);
 $('add-observation').onclick=openObservation;$('observation-form').onsubmit=saveObservation;
 $('refresh-headlines').onclick=async()=>{await refreshFeed();toast('تم تحديث قائمة الأخبار المتاحة في النسخة المنشورة.');};
 $('menu').onclick=()=>{$('sidebar').classList.add('open');$('overlay').hidden=false;};$('overlay').onclick=closeMenu;
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
}
async function init(){
 fillMonthSelect('hmonth');fillMonthSelect('ob-month');
 try{const response=await fetch('./data/months.json',{cache:'no-store'});if(response.ok){const loaded=await response.json();seed=(loaded.records||[]).filter(validateRecord);}}catch{}
 const h=currentH();shown={year:h.year,month:h.month};renderSources();applyTheme();initHandlers();renderAll();await refreshFeed();
 const tick=()=>{$('live-clock').textContent=new Intl.DateTimeFormat('ar-DZ',{timeZone:'Africa/Algiers',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())+' · توقيت الجزائر';checkReminders();};tick();setInterval(tick,45000);
 if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init().catch(error=>{console.error(error);toast('تعذر تشغيل التقويم: '+error.message);});