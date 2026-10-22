export const MONTHS=['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
export const WEEKDAYS=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
export const COUNTRIES={DZ:'الجزائر',SA:'السعودية',MA:'المغرب',TN:'تونس',OTHER:'بلد آخر'};
const DAY=86400000;
const hijriFormatter=new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
const gregFormatter=new Intl.DateTimeFormat('ar-DZ',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const startCache=new Map();
export const pad=n=>String(n).padStart(2,'0');
export const dateMs=iso=>Date.parse(iso+'T00:00:00Z');
export const isoAt=ms=>new Date(ms).toISOString().slice(0,10);
export const plusDays=(iso,days)=>isoAt(dateMs(iso)+DAY*days);
export const dayDifference=(a,b)=>Math.round((dateMs(a)-dateMs(b))/DAY);
export const validISO=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(dateMs(v))&&isoAt(dateMs(v))===v;
export function localToday(){
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Algiers',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const g=t=>p.find(x=>x.type===t)?.value;
 return g('year')+'-'+g('month')+'-'+g('day');
}
export const niceGregorian=iso=>gregFormatter.format(new Date(iso+'T12:00:00Z'));
export const shortGregorian=iso=>new Intl.DateTimeFormat('ar-DZ',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
export function rawHijri(iso){
 const p=hijriFormatter.formatToParts(new Date(iso+'T12:00:00Z'));
 const get=t=>Number(p.find(x=>x.type===t)?.value);
 return {year:get('year'),month:get('month'),day:get('day')};
}
export const monthId=(year,month)=>year*12+month-1;
export const idToMonth=id=>({year:Math.floor(id/12),month:(id%12+12)%12+1});
export function baseStart(year,month){
 const k=year+'-'+month;if(startCache.has(k))return startCache.get(k);
 const index=monthId(year,month)-monthId(1448,1);
 const guess=dateMs('2026-06-16')+Math.round(index*29.530589*DAY);
 for(let i=-24;i<=24;i++){
  const iso=isoAt(guess+i*DAY),h=rawHijri(iso);
  if(h.year===year&&h.month===month&&h.day===1){startCache.set(k,iso);return iso;}
 }
 throw Error('تعذر احتساب هذا التاريخ الهجري. يرجى استخدام سنة بين 1400 و1550 هـ.');
}
export function getRecord(year,month,country,records=[]){
 return records.find(r=>r.year===year&&r.month===month&&r.country===country)||null;
}
export function effectiveStart(year,month,country,records=[]){
 return getRecord(year,month,country,records)?.date||baseStart(year,month);
}
export function nextMonth(year,month,delta=1){return idToMonth(monthId(year,month)+delta);}
export function monthSpan(year,month,country,records=[]){
 const start=effectiveStart(year,month,country,records);
 const n=nextMonth(year,month);
 const end=effectiveStart(n.year,n.month,country,records);
 const length=dayDifference(end,start);
 return {start,end,length,consistent:length===29||length===30,record:getRecord(year,month,country,records)};
}
export function hijriToGregorian(year,month,day,country,records=[]){
 if(!Number.isInteger(day)||day<1||day>30)return null;
 const span=monthSpan(year,month,country,records);
 return day<=span.length?plusDays(span.start,day-1):null;
}
export function gregorianToHijri(iso,country,records=[]){
 if(!validISO(iso))throw Error('التاريخ الميلادي غير صالح.');
 const approx=rawHijri(iso),mid=monthId(approx.year,approx.month);
 let best=null;
 for(let i=-3;i<=3;i++){
  const m=idToMonth(mid+i), start=effectiveStart(m.year,m.month,country,records);
  if(start<=iso&&(!best||start>best.start))best={...m,start};
 }
 if(!best)throw Error('تعذر إيجاد الشهر الموافق.');
 return {...best,day:dayDifference(iso,best.start)+1,iso};
}
export const hijriLabel=h=>h.day+' '+MONTHS[h.month-1]+' '+h.year+' هـ';
export const monthLabel=(y,m)=>MONTHS[m-1]+' '+y+' هـ';
export const safeText=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function expandEvents(events,from,to,country,records=[]){
 const out=[];
 const startH=gregorianToHijri(from,country,records),endH=gregorianToHijri(to,country,records);
 const push=(e,date)=>{if(date&&date>=from&&date<=to&&date>=(e.createdAnchorDate||'1000-01-01'))out.push({event:e,date,key:e.id+'@'+date,done:e.repeat==='none'?!!e.done:(e.doneDates||[]).includes(date)});};
 for(const e of events){
  if(e.repeat==='none'){
   push(e,e.anchor==='hijri'?hijriToGregorian(e.year,e.month,e.day,country,records):e.date);continue;
  }
  if(e.repeat==='hijri-month'){
   const first=monthId(startH.year,startH.month)-1,last=monthId(endH.year,endH.month)+1;
   for(let k=first;k<=last;k++){const m=idToMonth(k);push(e,hijriToGregorian(m.year,m.month,e.day,country,records));}
  }else if(e.repeat==='hijri-year'){
   for(let y=startH.year-1;y<=endH.year+1;y++)push(e,hijriToGregorian(y,e.month,e.day,country,records));
  }else if(e.repeat==='gregorian-year'){
   const mo=e.anchor==='gregorian'?e.date.slice(5,10):hijriToGregorian(e.year,e.month,e.day,country,records)?.slice(5,10);
   if(mo)for(let y=Number(from.slice(0,4))-1;y<=Number(to.slice(0,4))+1;y++){const iso=y+'-'+mo;push(e,validISO(iso)?iso:null);}
  }
 }
 return out.sort((a,b)=>a.date.localeCompare(b.date)||(a.event.time||'23:59').localeCompare(b.event.time||'23:59')||a.event.title.localeCompare(b.event.title,'ar'));
}
export function validateRecord(r){
 if(!r||!Object.hasOwn(COUNTRIES,r.country)||!Number.isInteger(r.year)||r.year<1400||r.year>1550||!Number.isInteger(r.month)||r.month<1||r.month>12||!validISO(r.date)||typeof r.authority!=='string'||r.authority.trim().length<3||typeof r.url!=='string')return false;
 try{const url=new URL(r.url);return url.protocol==='https:'&&!url.username&&!url.password&&Math.abs(dayDifference(r.date,baseStart(r.year,r.month)))<=3;}catch{return false;}
}
export function validateEvent(e){
 return e&&typeof e.id==='string'&&/^[a-zA-Z0-9-]{4,70}$/.test(e.id)&&typeof e.title==='string'&&e.title.trim().length>0&&e.title.length<=140&&['hijri','gregorian'].includes(e.anchor)&&['none','hijri-month','hijri-year','gregorian-year'].includes(e.repeat)&&(!e.time||/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time))&&['-1','0','15','60','1440'].includes(String(e.remind))&&(e.anchor==='gregorian'?validISO(e.date):Number.isInteger(e.year)&&e.year>=1400&&e.year<=1550&&Number.isInteger(e.month)&&e.month>=1&&e.month<=12&&Number.isInteger(e.day)&&e.day>=1&&e.day<=30);
}
