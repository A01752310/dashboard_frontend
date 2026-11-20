export const CONFIG = Object.freeze({
  API_BASE: '/api', RUN_ID: 'INTEGRACION-001', LIMIT: 50,
  POLL_MS: 1000, REQUEST_TIMEOUT_MS: 3000, SIMULATION: true
});
// The Historian host belongs in the server environment, never in the API adapter.
// AWS storage and its authenticated backend have not been implemented.
