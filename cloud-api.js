const CLOUD_ENDPOINT='https://hehzkcipnogvnvmhpxmf.supabase.co/functions/v1/invite-data';
const CLOUD_SESSION_KEY='little-feelings-cloud-session-v1';

async function fetchWithTimeoutCompat(url,options={},timeout=30000){
  if(options.signal)return fetch(url,options);
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timedOut=false,timer=null;
  if(controller)timer=setTimeout(()=>{timedOut=true;controller.abort()},timeout);
  try{return await fetch(url,{...options,...(controller?{signal:controller.signal}:{})})}
  catch(error){if(timedOut){const e=new Error('请求超时');e.name='TimeoutError';throw e}throw error}
  finally{if(timer)clearTimeout(timer)}
}
window.fetchWithTimeoutCompat=fetchWithTimeoutCompat;

const CloudAPI={
  session:null,
  loadSession(){try{const x=JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||'null');if(x?.token&&x?.inviteCode)this.session=x}catch{}return this.session},
  saveSession(x){this.session=x;localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(x))},
  clearSession(){this.session=null;localStorage.removeItem(CLOUD_SESSION_KEY)},
  get ready(){return !!this.session?.token},
  get inviteCode(){return this.session?.inviteCode||''},
  async request(action,data={},auth=true){
    const headers={'content-type':'application/json'};
    if(auth){if(!this.session?.token)throw Error('请重新登入');headers.authorization=`Bearer ${this.session.token}`}
    let res,lastError;
    const attempts=['generate_invite','logout'].includes(action)?1:2;
    for(let i=0;i<attempts;i++){
      try{res=await fetchWithTimeoutCompat(CLOUD_ENDPOINT,{method:'POST',headers,body:JSON.stringify({action,...data})},30000);break}
      catch(e){lastError=e;if(e.name==='TimeoutError')break}
    }
    if(!res){if(typeof navigator!=='undefined'&&navigator.onLine===false)throw Error('当前网络未连接');throw Error(lastError?.name==='TimeoutError'?'云端响应超时':'暂时无法连接云端')}
    let body={};try{body=await res.json()}catch{}
    if(res.status===401)this.clearSession();
    if(!res.ok)throw Error(body.error||`云端请求失败（${res.status}）`);
    return body
  },
  async generate(inviteCode,adminPassword){return this.request('generate_invite',{inviteCode,adminPassword},false)},
  async login(inviteCode){const out=await this.request('login',{inviteCode},false);this.saveSession({token:out.token,inviteCode:out.inviteCode,expiresAt:out.expiresAt});return out},
  async load(){return this.request('load')},
  async syncState(state){return this.request('sync_state',{state})},
  async logout(){try{if(this.ready)await this.request('logout')}finally{this.clearSession()}},
};
CloudAPI.loadSession();window.CloudAPI=CloudAPI;
