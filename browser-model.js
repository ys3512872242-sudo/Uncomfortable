const MODEL_KEY='little-feelings-providers-v1';
const DEFAULT_PROXY='https://hehzkcipnogvnvmhpxmf.supabase.co/functions/v1/emotion-chat';
const MODEL_INVITE_CODE='BLOOM2026';
const SYSTEM_PROMPT=`你是《我不舒服！》的情绪复盘对谈者。用自然的中文对谈，帮助用户形成自己的理解。不要诊断、机械附和、推断人格童年或替第三方揣测动机，不强迫积极、原谅、释怀或行动。
七个内部阶段按需跳转：还原事件；辨认情绪与自动想法；探索最介意的细节；核对需要与边界；区分事实、解释和未知；探索用户愿意做的具体行动（可暂不行动）；总结交给用户确认。每轮根据上一句追一个最有价值的问题，不重复已确认信息。表达困难时先简短整理，可给2–5个多选辅助方向，包含其他并接受自由回答。用户纠正时明确修正假设。情绪波动时降低提问强度，不无限追问。
内部区分完整、阶段性、主动暂停和安全转介。用户想停就停止追问；尊重不确定。若出现自伤、自杀、暴力或严重危机，停止普通复盘，优先了解即时安全，建议联系可信任的人、当地紧急或专业支持，不编造号码。
输出 JSON：reply 为简短自然回复；status 为 exploring、completed、partial、paused、safety；review 可为 null，或包含 title、event、emotions、thoughts、needs、facts、unknowns、newUnderstanding、action、openQuestions。只写用户表达或确认的信息，未知留空。植物建议只依据用户确认的情绪或纪念意义，可选或更改，不对情绪评分；不能声称已保存。不要索要与复盘无关的隐私，不读取历史档案，历史分析需用户另行同意。不要使用 Markdown 星号。`;
function normalizeUrl(raw){const u=new URL(raw.trim());if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('API 地址必须是 HTTPS，且不能包含 Key');u.search='';u.pathname=u.pathname.replace(/\/+$/,'');if(!u.pathname.endsWith('/chat/completions'))u.pathname+='/chat/completions';return u.href}
function extractLooseReply(text){const m=/["']reply["']\s*:\s*"/.exec(text);if(!m)return'';let i=m.index+m[0].length,out='',escaped=false;for(;i<text.length;i++){const c=text[i];if(escaped){if(c==='n')out+='\n';else if(c==='r')out+='\r';else if(c==='t')out+='\t';else if(c==='u'&&/^[0-9a-f]{4}$/i.test(text.slice(i+1,i+5))){out+=String.fromCharCode(parseInt(text.slice(i+1,i+5),16));i+=4}else out+=c;escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c==='"'){let j=i+1;while(/\s/.test(text[j]||''))j++;if(j>=text.length||text[j]===','||text[j]==='}')return out.trim();out+='"';continue}out+=c}return out.trim()}
function contentText(content){
 if(typeof content==='string')return content;
 if(Array.isArray(content))return content.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');
 if(content&&typeof content==='object')return content.text||content.content||JSON.stringify(content);
 return ''
}
function parseContent(content){
 const raw=contentText(content).trim();
 if(!raw)throw Error('模型返回了空内容');
 let text=raw.replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
 const tries=[text];
 const a=text.indexOf('{'),b=text.lastIndexOf('}');
 if(a>=0&&b>a)tries.push(text.slice(a,b+1));
 for(const t of tries){
  try{
   const x=JSON.parse(t);
   if(x&&typeof x==='object'){
    const hasReview=x.review&&typeof x.review==='object';
    const reply=typeof x.reply==='string'?x.reply.trim():'';
    if(reply||hasReview)return {...x,reply:reply||(hasReview?'这次的对谈已经整理好了。':''),status:x.status||(hasReview?'completed':'exploring'),raw}
   }
  }catch{}
 }
 const reply=extractLooseReply(text);
 if(reply)return{reply,status:'exploring',review:null,raw};
 if(/^\s*\{/.test(text)||/["'](?:reply|review)["']\s*:/.test(text))throw Error('已收到模型回复，但卡片格式没有整理完整，请点击重新整理');
 return{reply:text.replace(/^\s*```\w*\s*/,'').replace(/\s*```\s*$/,'').trim(),status:'exploring',review:null,raw}
}
const ModelAPI={
 providers:[],activeId:null,config:null,
 cleanReply(content){try{return parseContent(content).reply}catch{return String(content||'').trim()}},
 load(){try{const saved=JSON.parse(localStorage.getItem(MODEL_KEY)||'null');if(Array.isArray(saved?.providers)){this.providers=saved.providers.filter(x=>x?.id&&x?.url&&x?.model&&x?.key);this.activeId=saved.activeId||null}else{const old=JSON.parse(localStorage.getItem('little-feelings-model-v3')||localStorage.getItem('little-feelings-model-v2')||'null');if(old?.url&&old?.model&&old?.key){const p={id:crypto.randomUUID(),name:'我的模型',url:old.url,model:old.model,key:old.key};this.providers=[p];this.activeId=p.id;this.persist()}}}catch{}this.config=this.providers.find(x=>x.id===this.activeId)||null;return this.config},
 persist(){localStorage.setItem(MODEL_KEY,JSON.stringify({providers:this.providers,activeId:this.activeId}))},
 save({name,api,model,key,id}){const c={id:id||crypto.randomUUID(),name:(name||model||'我的模型').trim(),url:normalizeUrl(api),model:model.trim(),key:key.trim()};if(!c.model||!c.key)throw Error('请填写模型名称和 API Key');const i=this.providers.findIndex(x=>x.id===c.id);if(i>=0)this.providers[i]=c;else this.providers.push(c);this.activeId=c.id;this.config=c;this.persist();return c},
 select(id){this.activeId=id||null;this.config=this.providers.find(x=>x.id===id)||null;this.persist();return this.config},
 remove(id){this.providers=this.providers.filter(x=>x.id!==id);if(this.activeId===id){this.activeId=null;this.config=null}this.persist()},
 clear(){this.select(null)},
 get ready(){return true},
 async chat(messages,{summary=false,signal,nickname=''}={}){const extra=summary?`\n现在结束提问，只返回一个可被 JSON.parse 直接解析的 JSON 对象。不要使用 Markdown 代码块，不要在 JSON 前后增加解释。结构为：{"reply":"一句收束语","review":{"title":"12字内标题","event":"事件概括","emotions":"已表达的情绪","needs":"在意、期待或边界","facts":"确定发生的事实","unknowns":"仍不确定之处","newUnderstanding":"更公平客观的理解","action":"可选下一步或暂不行动","category":"学习工作/人际关系/自我感受/日常生活/其他","mood":"cosmos/corydalis/hollyhock/daylily/chamomile/iris"}}。必须使用自己的概括，不能照抄用户整句；没有依据的字段留空。`:'';const call=String(nickname||'').trim();const naming=call?`\n用户希望被称为“${call.slice(0,18)}”。只在自然且有必要时使用这个称呼，不要每句话都重复。`:'';const summaryTurn=summary?[{role:'user',content:'请结束提问，根据上面已经发生的完整对话，现在生成这次的复盘卡片草稿。'}]:[];const payload=[{role:'system',content:SYSTEM_PROMPT+naming+extra},...messages,...summaryTurn];let res;if(this.config){try{res=await fetch(this.config.url,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${this.config.key}`},body:JSON.stringify({model:this.config.model,messages:payload}),signal:signal||AbortSignal.timeout(90000)});const direct=await res.json().catch(()=>({}));if(!res.ok)throw Error(direct.error?.message||`服务商返回错误（${res.status}）`);return parseContent(direct.choices?.[0]?.message?.content??direct.content??direct.output_text)}catch(e){throw Error(e.name==='TimeoutError'?'模型响应超时':e.message||'个人模型网络请求没有完成')}}try{res=await fetch(DEFAULT_PROXY,{method:'POST',headers:{'content-type':'application/json','x-invite-code':MODEL_INVITE_CODE},body:JSON.stringify({messages:payload}),signal:signal||AbortSignal.timeout(90000)})}catch(e){throw Error(e.name==='TimeoutError'?'模型响应超时':'默认模型网络请求没有完成')};let data={};try{data=await res.json()}catch{}if(!res.ok)throw Error(data.error||`调用失败（${res.status}）`);return parseContent(data.content??data.output_text??data)}
};ModelAPI.load();window.ModelAPI=ModelAPI;
