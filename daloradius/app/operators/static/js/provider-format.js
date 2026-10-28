/* Preserve database wall-clock times: do not reinterpret them in the browser timezone. */
(function(root){
 'use strict';
 const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 function dateTime(value){
  const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?$/.exec(String(value||''));
  if(!m||Number(m[1])<1970)return null;
  const [,y,mo,d,h,mi,s]=m,dt=new Date(Date.UTC(+y,+mo-1,+d,+h,+mi,+s));
  if(dt.getUTCFullYear()!==+y||dt.getUTCMonth()!==+mo-1||dt.getUTCDate()!==+d||+h>23||+mi>59||+s>59)return null;
  return {date:`${d} ${months[+mo-1]} ${y}`,time:`${h}:${mi}:${s}`};
 }
 function dateTimeText(value){const p=dateTime(value);return p?`${p.date} · ${p.time}`:'—';}
 function duration(value){
  if(value===null||value===undefined||value===''||!Number.isFinite(Number(value))||Number(value)<0)return '—';
  const n=Math.floor(Number(value)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
  return [h?`${h}h`:'',m?`${m}m`:'',s||(!h&&!m)?`${s}s`:''].filter(Boolean).join(' ');
 }
 function timeoutSeconds(value,unit){
  if(!['1','60','3600'].includes(String(unit)))throw new Error('Choose a timeout unit.');
  if(value==='')return '';
  const n=Number(value)*Number(unit);
  if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(n)||n<1||n>31536000)throw new Error('Session timeout must be a whole number, up to 8,760 hours.');
  return String(n);
 }
 function details(value){try{return JSON.stringify(JSON.parse(value),null,2);}catch{return String(value||'No additional details.');}}
 const format={dateTime,dateTimeText,duration,timeoutSeconds,details};
 if(typeof module==='object'&&module.exports)module.exports=format;else root.ProviderFormat=format;
})(typeof window==='undefined'?globalThis:window);
