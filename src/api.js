import {normalize} from './core.js';
export function createTelemetryClient(config, fetchImpl = fetch) {
  let filterLocal=false, limitLocal=false;
  async function request(runId,withRun,withLimit) {
    const query=new URLSearchParams();
    if(withLimit)query.set('limit',String(config.LIMIT));
    if(withRun&&runId)query.set('run_id',runId);
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),config.REQUEST_TIMEOUT_MS);
    try {
      const response=await fetchImpl(`${config.API_BASE}/telemetry?${query}`,{signal:controller.signal,cache:'no-store'});
      const text=await response.text();
      if(!response.ok){const error=new Error(`HTTP ${response.status}`);error.status=response.status;error.body=text;throw error;}
      return normalize(JSON.parse(text));
    } finally {clearTimeout(timeout);}
  }
  return {async query(runId) {
    let rows;
    try {rows=await request(runId,!filterLocal,!limitLocal);}
    catch(error) {
      if(![400,422].includes(error.status))throw error;
      if(!filterLocal&&runId&&(!error.body||/run_id/i.test(error.body))) {rows=await request(runId,false,!limitLocal);filterLocal=true;}
      else if(!limitLocal&&/limit/i.test(error.body)){rows=await request(runId,!filterLocal,false);limitLocal=true;}
      else throw error;
    }
    // Keep this valid response and apply the local filter; omit run_id on subsequent polls.
    if(runId&&rows.some(r=>r.run_id!==runId))filterLocal=true;
    return {rows:runId?rows.filter(r=>r.run_id===runId):rows,filterLocal,limitLocal};
  }};
}
