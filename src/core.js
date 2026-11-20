export const TAGS = ['piston1_act', 'piston2_act', 'piston3_act'];
export const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
export const key = r => JSON.stringify([r.run_id, r.source, r.seq]);
export const compare = (a, b) => (date(a.timestamp) ?? -Infinity) - (date(b.timestamp) ?? -Infinity) || a.seq - b.seq || key(a).localeCompare(key(b));
export function normalize(body) {
    if (!Array.isArray(body)) throw new Error('Error de contrato: se esperaba un arreglo.');
    const rows = body.filter(r => r && typeof r.run_id === 'string' && r.run_id.trim() && typeof r.source === 'string' && r.source.trim() && Number.isSafeInteger(r.seq) && r.seq >= 0 && r.variables && typeof r.variables === 'object' && !Array.isArray(r.variables));
    if (body.length && !rows.length) throw new Error('Error de contrato: ningún registro válido.');
    return rows.map(r => ({id: Number.isSafeInteger(r.id) ? r.id : null, run_id: r.run_id, source: r.source, seq: r.seq,
      timestamp: date(r.timestamp) !== null ? r.timestamp : null,
      received_at: date(r.received_at) !== null ? r.received_at : null,
      variables: Object.fromEntries(TAGS.map(tag => [tag, typeof r.variables[tag] === 'boolean' ? r.variables[tag] : null]))}));
  }
export function merge(previous, incoming, limit = 50) {
    const map = new Map();
    // Incoming wins against old cache on equal reception time; first incoming wins ties.
    for (const r of [...incoming, ...previous]) {
      const old = map.get(key(r));
      if (!old || (date(r.received_at) ?? -Infinity) > (date(old.received_at) ?? -Infinity)) map.set(key(r), r);
    }
    return [...map.values()].sort(compare).slice(-limit);
  }
export function initial(sim = false) { return {rows: [], status: sim ? 'SIMULACION' : 'CARGANDO', lastQuery: null, error: ''}; }
export function success(state, incoming, now, sim = false, limit = 50) {
    return {...state, rows: merge(state.rows, incoming, limit), status: sim ? 'SIMULACION' : incoming.length ? 'EN_LINEA' : state.rows.length ? 'SIN_DATOS_NUEVOS' : 'ESPERANDO', lastQuery: now, error: ''};
  }
export const failure = (state, error) => ({...state, status: 'INTERRUMPIDA', error: String(error)});
export const label = v => v === true ? 'Señal activa' : v === false ? 'Señal inactiva' : 'Sin lectura';
export function age(record, now = Date.now()) {
    if (!record) return 'Sin lectura';
    const received = date(record.received_at), stamp = received ?? date(record.timestamp);
    if (stamp === null) return 'Sin fecha válida';
    if (now < stamp) return '0 s · desfase de reloj';
    const seconds = Math.floor((now - stamp) / 1000);
    return `${seconds} s${received === null ? ' (estimada)' : ''}`;
  }
