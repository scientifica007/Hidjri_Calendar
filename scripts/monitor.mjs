import {writeFile,readFile} from 'node:fs/promises';
const SOURCES=[
 {name:'وزارة الشؤون الدينية والأوقاف الجزائرية',url:'https://marw.gov.dz/'},
 {name:'المشروع الإسلامي لرصد الأهلة',url:'https://astronomycenter.net/?l=ar'},
 {name:'وكالة الأنباء السعودية',url:'https://www.spa.gov.sa/'}
];
const keywords=/هلال|الأهلّة|الأهلة|رؤية|ترائي|غرة|غرّة|المحاق|crescent|moon.?sight|hijri|رصد|شهر (?:محرم|صفر|ربيع|جمادى|رجب|شعبان|رمضان|شوال|ذي|ذو)/i;
function decode(v){
 return v.replace(/&#(x[0-9a-f]+|\d+);?/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return Number.isFinite(code)&&code>0&&code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/&(amp|quot|apos|lt|gt|nbsp|hellip);/gi,(_,name)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',hellip:'…'}[name.toLowerCase()]||' '));
}
function extract(html,source){
 const entries=[],seen=new Set();
 const matches=html.matchAll(/<a\b([^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a\s*>/gi);
 for(const m of matches){
  const title=decode(m[3].replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
  if(title.length<12||title.length>230||!keywords.test(title))continue;
  let url;try{url=new URL(decode(m[2]),source.url);if(url.protocol!=='https:'||url.hostname!==new URL(source.url).hostname||url.username||url.password)continue;}catch{continue;}
  url.hash='';const href=url.toString();if(seen.has(href))continue;
  seen.add(href);entries.push({source:source.name,title,url:href});
  if(entries.length>=12)break;
 }
 return entries;
}
async function main(){
 let previous={entries:[]};try{previous=JSON.parse(await readFile(new URL('../data/headlines.json',import.meta.url),'utf8'));}catch{}
 const errors=[],found=[];
 for(const source of SOURCES){
  try{
   const r=await fetch(source.url,{signal:AbortSignal.timeout(16000),headers:{'User-Agent':'MiqatMoonNewsMonitor/1.0 (+https://github.com/scientifica007/Hidjri_Calendar)','Accept':'text/html'}});
   if(!r.ok)throw Error('HTTP '+r.status);
   const html=(await r.text()).slice(0,1_500_000);
   found.push(...extract(html,source));
  }catch(error){errors.push(source.name+': '+String(error.message).slice(0,100));}
 }
 const unique=[...new Map(found.map(v=>[v.url,v])).values()];
 const entries=unique.length?unique.slice(0,25):previous.entries||[];
 const result={schemaVersion:1,fetchedAt:new Date().toISOString(),entries,errors};
 await writeFile(new URL('../data/headlines.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log('مصادر الأخبار:',SOURCES.length,'عناوين:',entries.length,'تعذرات:',errors.length);
 if(errors.length)console.warn(errors.join('\n'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
