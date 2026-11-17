window.reflectionModel = Object.freeze({
  endpoint: null,
  async turn(messages, {signal} = {}) {
    if (!this.endpoint) throw new Error('模型尚未接入');
    const url = new URL(this.endpoint, location.origin);
    if (url.origin !== location.origin) throw new Error('模型接口必须与网站同源');
    const response = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages}),signal});
    if (!response.ok) throw new Error('模型暂时不可用');
    const result = await response.json();
    if (typeof result.reply !== 'string' || !['exploring','completed','partial','paused','safety'].includes(result.status)) throw new Error('模型回复格式无效');
    return result;
  }
});
