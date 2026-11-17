const CLOUD_ENDPOINT='https://hehzkcipnogvnvmhpxmf.supabase.co/functions/v1/invite-data';
const CLOUD_SESSION_KEY='little-feelings-cloud-session-v1';

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
    let res;
    try{res=await fetch(CLOUD_ENDPOINT,{method:'POST',headers,body:JSON.stringify({action,...data}),signal:AbortSignal.timeout(30000)})}
    catch(e){throw Error(e.name==='TimeoutError'?'云端响应超时':'暂时无法连接云端')}
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
