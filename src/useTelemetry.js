import {useEffect,useState} from 'react';
import fixture from '../fixtures/telemetry-INTEGRACION-001.json';
import {initial,normalize,success,failure} from './core.js';
import {createTelemetryClient} from './api.js';
import {CONFIG} from './config.js';
export function useTelemetry({simulation,runId,replay}) {
  const [state,setState]=useState(()=>({...initial(simulation),filterLocal:simulation,limitLocal:false,step:0}));
  useEffect(()=>{
    let stopped=false,timer; const client=createTelemetryClient(CONFIG);
    setState({...initial(simulation),filterLocal:simulation,limitLocal:false,step:0});
    function accept(rows,meta={}){if(!stopped)setState(old=>({...success(old,rows,Date.now(),simulation,CONFIG.LIMIT),...meta}));}
    if(simulation){
      const records=normalize(fixture).sort((a,b)=>a.seq-b.seq),filter=rows=>runId?rows.filter(r=>r.run_id===runId):rows;
      accept(filter([records[0]]),{step:1,filterLocal:true});
      timer=setTimeout(()=>accept(filter(records),{step:2,filterLocal:true}),5000);
    }else{
      async function tick(){
        try{const result=await client.query(runId);accept(result.rows,{filterLocal:result.filterLocal,limitLocal:result.limitLocal});}
        catch(error){if(!stopped){console.error('Consulta de telemetría:',error);setState(old=>failure(old,error.name==='AbortError'?'Tiempo de espera agotado (3 s).':'No se recibió una respuesta válida.'));}}
        finally{if(!stopped)timer=setTimeout(tick,CONFIG.POLL_MS);}
      }
      tick();
    }
    return ()=>{stopped=true;clearTimeout(timer);};
  },[simulation,runId,replay]);
  return state;
}
