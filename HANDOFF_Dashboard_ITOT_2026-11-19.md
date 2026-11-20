# Handoff — Prototipo de dashboard IT/OT

**Corte:** 19 de noviembre de 2026 (inspección UTC: 2026-11-20T04:06Z).

**Repositorio:** `dashboard_frontend`.

**Rama / HEAD:** `master`; base de la inspección `f6e89ad` (`Initial commit`); HEAD actual: consultar `git log -1`.

**Estado del árbol al iniciar:** solo `README.md` trackeado; `Reto_ITOT_Arquitectura_Consolidada.md` sin seguimiento.

**Alcance de esta ronda:** inspección y documentación. No se implementó backend, frontend ni Historian.

## Leyenda de evidencia

| Etiqueta | Significado |
|---|---|
| **Equipo** | Dato confirmado por el equipo del Reto el 2026-11-19. |
| **PDF** | Dato documentado en `Documentación Técnica - Arquitectura de Telemetría Industrial OT-IDMZ-IT.pdf`. |
| **Repo** | Dato verificado en este repositorio o en su historia Git. |
| **Local** | Comprobación ejecutada en el equipo de trabajo durante esta ronda. |
| **Pendiente** | No verificable sin el montaje físico o sin acceso a la VM Historian. |

La regla de lectura es estricta: un dato **PDF** no equivale a código verificado; un dato **Equipo** no equivale a una prueba de extremo a extremo; una comprobación **Local** contra un fixture no demuestra el comportamiento de la API real.

---

## 0. Resumen para el siguiente desarrollador

Hay que construir **una sola pantalla estática** que consulte `GET /telemetry` del Historian y muestre tres tarjetas de señal, tres carriles de historial y una tabla reciente. El repositorio no contiene hoy ningún punto de entrada, dependencia ni servidor: se parte de cero.

La recomendación es **HTML + CSS + JavaScript sin build** y un **proxy HTTP mismo origen con Python estándar** en la laptop IT (`192.168.20.10`). El navegador llama a `/api/telemetry`; el proxy llama a `http://192.168.20.20:8081/telemetry`. Así no se toca el Historian, no se depende de CORS y se conserva la IP de origen documentada.

La primera tarea no es pintar la pantalla: es **congelar el fixture y la máquina de estados** descritos en este documento, y probarlos sin hardware. La segunda es el adaptador de API y el polling. La prueba contra el Historian real queda para el final y requiere acceso a la red IT.

**No hacer:** inventar el significado físico de `piston1_act`, `piston2_act`, `piston3_act`; mostrar “PLC desconectado” por la edad de un registro; usar el contrato viejo de `flujo_itot.py` (`/records`, `origen`, `secuencia`) como si fuera `/telemetry`; activar un fallback silencioso al fixture cuando falle la API.

---

## 1. Inspección del repositorio

### 1.1 Árbol y estado Git

Comprobado con `git status --short`, `git log --oneline`, `git ls-files` y `find`:

| Elemento | Estado |
|---|---|
| `README.md` | Trackeado. Contenido literal: `wisol beibi wisol beibi` (24 bytes). No describe el proyecto. |
| `Reto_ITOT_Arquitectura_Consolidada.md` | Sin seguimiento al iniciar; 9 223 bytes al iniciar; documento técnico consolidado del proyecto. Se actualiza en esta ronda. |
| `fixtures/telemetry-INTEGRACION-001.json` | Nuevo en esta ronda; datos de ejemplo para desarrollo y simulación. |
| Código de aplicación | No existe. No hay `src/`, `web/`, `app/`, `server.py`, `package.json`, `requirements.txt`, `Dockerfile`, `docker-compose.yml`, `index.html` ni pruebas. |
| Historial al iniciar | Un solo commit: `f6e89ad` `Initial commit`; solo añade `README.md`. |
| Remoto | `https://github.com/A01752310/dashboard_frontend.git`; al iniciar, `master` y `origin/master` apuntaban a `f6e89ad`. |

**Consecuencia:** en este repositorio no hay puntos de entrada ni comandos de arranque que ejecutar. Cualquier comando de backend, Historian o frontend que se documente más abajo es **propuesto**, salvo que se indique expresamente como verificado.

La única ruta documental existente es la raíz del repositorio (`README.md` y `Reto_ITOT_Arquitectura_Consolidada.md`). Por eso este handoff se ubica ahí y no se creó un árbol `docs/` nuevo.

### 1.2 Artefactos relacionados fuera del repositorio

No forman parte del entregable, pero se inspeccionaron para no confundir contratos:

| Ruta | Qué es | Qué prueba | Qué no prueba |
|---|---|---|---|
| `../Documentación Técnica - Arquitectura de Telemetría Industrial OT-IDMZ-IT.pdf` | Documento técnico del proyecto, 5 secciones. | Topología, IPs, Mosquitto, ACL, QoS, SQLite, endpoints `/health` y `/telemetry`, orden y `limit=50`. | No es código; su ejemplo JSON (`temperatura_c`, `presion_bar`, `motor_run`) quedó superado. |
| `/home/angerchy/Projects/firewall-lab-baseline/Proyecto_Conexion_IT-OT/cierre-flujo_itot-COMPLETO-001.py` | Demo de laboratorio anterior, 11 397 bytes, sha256 `506f5030c90579e8950504ee75020200306e824d3634240476bd87cb08c9ead5`; idéntico a `itot-flujo-completo/itot-completo/flujo_itot.py`. | Existió un flujo Python OT→colector→MQTT→Historian→IT con SQLite y HTTP. | **No es la implementación actual.** Expone `/records`, `/telemetria` (POST) y `/health`; usa `origen`/`secuencia`/`temp` y una tabla `records(id, run_id, origen, secuencia, payload)`. No tiene `/telemetry` ni los tres booleanos. |
| `/home/angerchy/Projects/firewall-lab-baseline/Proyecto_Conexion_IT-OT/Reto_ITOT_baseline_2026-11-10.md` | Baseline del cierre físico anterior. | Comandos y evidencia del flujo de laboratorio del 10 de noviembre. | No corresponde al stack PLC real + Historian Alpine actual; los comandos citados no se reejecutaron en esta ronda. |
| `/home/angerchy/Projects/firewall-lab-baseline/itot-mvp-telemetria/` | MVP OPC UA + InfluxDB en Docker. | Existió otro prototipo con `docker compose`, pero de otra arquitectura. | No usa MQTT/PLC real, no usa SQLite y su `src/dashboard.py` solo imprime mensajes MQTT en stdout; no hay UI que reutilizar. |
| `/home/angerchy/Projects/firewall-lab-baseline/itot-integracion-fisica-v1/GUIA.md` | Guía de integración física KVM/libvirt. | Procedimientos de laboratorio y advertencias de alcance. | No es una aplicación ni un servidor de dashboard. |

**Búsqueda de la implementación actual:** no se localizó `it_historian_service.py`, `it_query_client.py` ni `ot_plc_publisher.py` en el repositorio ni en el árbol de trabajo. La búsqueda de `piston1_act`/`received_at` solo devolvió el documento consolidado y el texto de esta solicitud, no código. Por tanto, la implementación de `/telemetry` **no está disponible** para inspección.

### 1.3 Stack recomendado

**Recomendación:** frontend estático sin build + proxy Python de biblioteca estándar.

| Capa | Elección | Motivo y evidencia |
|---|---|---|
| Frontend | `index.html` + `styles.css` + `app.js` + `config.js`; JavaScript moderno sin framework. | **Repo:** no hay stack previo que respetar. **PDF:** la API es HTTP/JSON simple. Un build de React/Vite añadiría Node/npm en la laptop IT, cuya disponibilidad no está confirmada. |
| Servidor / mismo origen | `server.py` con `http.server.ThreadingHTTPServer` + `urllib.request`; sirve estáticos y hace proxy de `/api/*` a `HISTORIAN_URL`. | **PDF:** el Historian ya es Python y HTTP 8081. **Local:** Python 3.15.2 disponible en el equipo de trabajo; **Pendiente:** confirmar Python en la laptop IT. Evita CORS y no modifica el Historian. |
| Historian | Sin cambios. `GET /health` y `GET /telemetry?limit=50&run_id=<ID>` en TCP 8081. | **PDF** y **Equipo**. No se reutiliza el servidor del demo viejo porque su contrato es distinto. |
| Dependencias | Ninguna de terceros para el prototipo. | El repo no tiene `requirements.txt` ni `package.json`; el entorno IT es una red aislada. Menos dependencias = menos fricción de instalación. |
| Pruebas | Fixture JSON + mock local de la API + pruebas de la máquina de estados. | Permiten aceptar la pantalla sin montaje físico. **Pendiente:** prueba contra la API real. |

**Alternativas descartadas para esta demo:**

- **React/Vite/Next:** exige Node, `npm install` y un build; no hay evidencia de Node en la laptop IT ni de acceso a registro de paquetes. No se justifica para una pantalla.
- **Streamlit/Gradio:** dependencias Python pesadas y otro puerto; no hay nada instalado y el control visual/fixture sería peor.
- **nginx/Caddy:** no está instalado ni documentado; añade un servicio que nadie ha probado en la IT.
- **Servir desde `file://`:** `fetch` a `http://192.168.20.20:8081` sería cross-origin y probablemente bloqueado por CORS; además rompe la ruta misma-origen.

### 1.4 Tópico MQTT: referencia documental y contraste con el código

El tópico se conserva como **`planta/telemetria/integracion`**.

| Fuente | Qué dice | Estado |
|---|---|---|
| PDF, §4.2–4.3 | ACL: `user ot_plc` → `topic write planta/telemetria/integracion`; `user it_historian` → `topic read planta/telemetria/integracion`. QoS 1, `retain=false`, MQTT/TCP 1883. | **PDF** |
| Equipo, 2026-11-19 | El S7-1500 publica directamente en ese tópico con `ot_plc`; el Historian se suscribe con `it_historian`. | **Equipo** |
| `firewall-lab-baseline/Proyecto_Conexion_IT-OT/cierre-flujo_itot-COMPLETO-001.py` (idéntico a `itot-flujo-completo/itot-completo/flujo_itot.py`) | Usa el mismo tópico por defecto: `--topic` en la línea 252 y `c.publish(a.topic, ...)` en la línea 131. Pero su payload es `run_id`, `origen`, `sensor`, `secuencia`, `temp`, y el publicador es la laptop OT a través de un colector HTTP, no el PLC. | **Repo (demo viejo)** |
| Implementación actual del publicador/Historian | No disponible en el repositorio ni localizada en el árbol de trabajo. | **Pendiente** |

**Conclusión:** el tópico coincide entre PDF, equipo y demo viejo, pero **el payload y el rol del publicador cambiaron**. El demo viejo no sirve para validar el contrato nuevo; solo confirma que el nombre del tópico ya se usaba en el laboratorio.

---

## 2. Contrato de datos y API

### 2.1 Forma confirmada por el equipo

**Equipo:** `GET /telemetry` devuelve un **arreglo** de objetos. Cada objeto tiene:

| Campo | Tipo esperado | Confirmación | Uso en la pantalla |
|---|---|---|---|
| `id` | entero (asumido) | El equipo confirmó que existe; no dio sus valores ni su tipo exacto. | Clave interna; no se muestra. |
| `run_id` | string | Confirmado; valor de ejemplo `INTEGRACION-001`. | Filtro y agrupación. |
| `source` | string | Confirmado; valor de ejemplo `PLC-SIEMENS-01`. | Agrupación; se muestra en el encabezado si hay más de una fuente. |
| `seq` | entero | Confirmado; valores 1 y 2. | Orden y deduplicación. |
| `timestamp` | string ISO 8601 UTC | Confirmado; `2026-11-19T21:40:00Z` y `2026-11-19T21:40:05Z`. | Hora de la señal en tabla y carriles. |
| `received_at` | string ISO 8601 (asumido) | El equipo confirmó que existe; no dio sus valores ni su formato exacto. | Hora de recepción y cálculo de edad; se muestra en la tabla. |
| `variables` | objeto | Confirmado. | Contiene los tres booleanos. |

Los tres campos booleanos confirmados son `piston1_act`, `piston2_act` y `piston3_act`. El equipo no confirmó que sean los únicos campos de `variables`; la UI debe ignorar cualquier otro campo sin fallar.

**Registros de referencia (Equipo):**

- `INTEGRACION-001` / `PLC-SIEMENS-01`, corrida del `2026-11-19`.
- `seq=1`, `timestamp=2026-11-19T21:40:00Z`, las tres señales en `false`.
- `seq=2`, `timestamp=2026-11-19T21:40:05Z`, solo `piston1_act` en `true`; `piston2_act` y `piston3_act` en `false`.

**Fixture:** `fixtures/telemetry-INTEGRACION-001.json`, en orden documentado de la API (más reciente primero). Los valores de `id` (2 y 1) y `received_at` (iguales a `timestamp`) son **placeholders de ejemplo**; el equipo no los proporcionó. El fixture no debe presentarse como respuesta real capturada.

### 2.2 Comportamiento documentado de la API

| Aspecto | Fuente | Estado | Qué debe hacer el prototipo |
|---|---|---|---|
| Forma de respuesta | Equipo | **Confirmado:** arreglo. | Exigir `Array.isArray(body)`. No aceptar `{ "records": [...] }` como si fuera el contrato nuevo; si aparece, es otra implementación y debe tratarse como error de contrato. |
| Campos | Equipo | **Confirmado.** | Normalizar los siete campos; descartar ítems sin `run_id`, `source`, `seq` o `variables`. |
| Orden | PDF | **Documentado:** del más reciente al más antiguo. | No confiar en el orden recibido: ordenar en el cliente por `timestamp` y, si empatan, por `seq`. |
| `limit` | PDF | **Documentado:** `limit=50` en el ejemplo. | Enviar `limit=50`; recortar a 50 tras deduplicar. Si la API rechaza el parámetro, reintentar sin él y recortar localmente. |
| `run_id` | PDF | **Documentado:** `run_id=<ID>`. | Enviar el `run_id` configurado. Si la API lo ignora o lo rechaza, activar filtro local y avisarlo en la pantalla. |
| Respuesta vacía | — | **No documentado.** Se asume `200 []`. | Tratar `200 []` como “espera de datos”, no como fallo. Si la implementación devuelve `404` para una corrida sin datos, tratarlo como interrupción hasta que el equipo lo confirme. |
| `/health` | PDF | **Documentado**; forma de respuesta no confirmada. | Usarlo solo como diagnóstico del proxy (`/api/health`); no bloquear la pantalla si falla. |
| Errores | — | **No documentado.** | Cualquier no-2xx, timeout, cuerpo no-JSON o no-array = consulta interrumpida. Excepción: `400/422` por `run_id` permite un reintento sin filtro. |
| CORS | — | **No documentado.** | Evitarlo con el proxy mismo origen; no añadir `Access-Control-Allow-Origin: *`. |
| Autenticación | — | **No documentada.** | No inventar token ni credenciales; si el equipo la añade, es un cambio de alcance. |

### 2.3 Verificación realizada y límites

| Comprobación | Resultado |
|---|---|
| Código de `it_historian_service.py` en el repo | **No existe.** `git ls-files` solo devuelve `README.md`; no hay `src/` ni `server.py`. |
| Código en el árbol de trabajo | **No localizado.** Búsqueda por nombre y por `piston1_act`/`received_at` sin coincidencias de código. |
| Prueba contra la API real | **No ejecutada.** `curl --max-time 3 http://192.168.20.20:8081/health` desde este equipo: `Connection timed out`; el host no tiene interfaz en `192.168.20.0/24` (`ip -br addr`). |
| Forma del arreglo y valores | **Verificada solo contra el fixture**, no contra la API. |
| Orden, `limit`, filtro y respuesta vacía | **No verificados** contra la implementación. Quedan como contrato documentado + comportamiento defensivo del cliente. |
| `/health` | **Documentado**, no verificado. |

**Conclusión:** no se puede afirmar que la API real cumpla el contrato. Se puede afirmar que el fixture cumple la forma confirmada por el equipo y que el cliente debe tolerar las variaciones descritas.

### 2.4 Reglas de normalización

1. **Arreglo obligatorio.** Si el cuerpo no es un arreglo, la consulta es inválida; no intentar extraer `records`, `data` ni `items`.
2. **Campos obligatorios por ítem:** `run_id` (string no vacío), `source` (string no vacío), `seq` (entero ≥ 1), `variables` (objeto). Si falta uno, descartar el ítem y contar el descarte.
3. **Booleanos estrictos:** `true` → “Señal activa”; `false` → “Señal inactiva”; ausente, `null`, `0`, `1` o string → “Sin lectura” para esa señal. No convertir valores dudosos.
4. **Timestamps:** aceptar ISO 8601 con `Z` o con offset. Mostrar en UTC para que la tabla coincida con los registros del equipo. Si `timestamp` es inválido, el ítem se puede mostrar con “Hora inválida” pero no se usa para ordenar; preferir descartarlo.
5. **`received_at`:** si es válido, se muestra y se usa para la edad; si falta o es inválido, usar `timestamp` y etiquetar la edad como “estimada”. No inventar una hora de recepción.
6. **Variables extra:** ignorarlas. No mostrarlas en las tarjetas ni en los carriles; la tabla solo muestra las tres señales confirmadas.
7. **`run_id` distinto:** si el filtro está activo y llega un ítem de otra corrida, no mostrarlo; si la API ignora el filtro, pasar a filtro local (ver §5.3).

---

## 3. Servido y mismo origen en la red IT

### 3.1 Topología recomendada

```text
Laptop IT 192.168.20.10
┌──────────────────────────────────────────────────────────────┐
│ Navegador                                                    │
│   http://127.0.0.1:8080/  ──►  server.py (estáticos + proxy) │
│                                      │                       │
│                                      │ GET /api/telemetry    │
│                                      ▼                       │
│                          http://192.168.20.20:8081/telemetry │
└──────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                          VM Historian Alpine 192.168.20.20
```

- El navegador solo conoce el origen `http://127.0.0.1:8080`.
- El proxy es el único que conoce la IP del Historian.
- La API se consume como `/api/telemetry`; no hay CORS porque es el mismo origen.
- El Historian no se modifica.

### 3.2 Opción A — recomendada: proxy en la laptop IT

**Componente:** `server.py` (Python 3, biblioteca estándar).

| Ruta | Comportamiento |
|---|---|
| `GET /` | Devuelve `web/index.html`. |
| `GET /app.js`, `/styles.css`, `/config.js` | Estáticos desde `web/`, con `Content-Type` correcto y `Cache-Control: no-cache`. |
| `GET /api/telemetry?limit=50&run_id=...` | Reenvía a `HISTORIAN_URL/telemetry` con los mismos parámetros permitidos (`limit`, `run_id`). Devuelve estado, `Content-Type` y cuerpo. |
| `GET /api/health` | Reenvía a `HISTORIAN_URL/health`. Diagnóstico; no es requisito de la pantalla. |
| Otros métodos | `405 Method Not Allowed`. |
| Rutas estáticas fuera de `web/` | `404`; prohibido el listado de directorios y el path traversal. |

**Configuración del servidor:**

| Variable / argumento | Default | Uso |
|---|---|---|
| `HISTORIAN_URL` | `http://192.168.20.20:8081` | URL base del Historian. **Único lugar donde se configura la IP del Historian.** |
| `BIND` | `127.0.0.1` | Interfaz de escucha. Loopback por defecto; para proyectar desde otro equipo IT, usar `192.168.20.10`. No exponer a OT/IDMZ. |
| `PORT` | `8080` | Puerto del dashboard. |
| `REQUEST_TIMEOUT` | `3` s | Timeout hacia el Historian. |
| `WEB_ROOT` | `./web` | Raíz de estáticos. |

**Reglas de seguridad del proxy:**

- URL de destino fija por configuración; no aceptar un host/puerto enviado por el cliente (evita SSRF).
- Solo reenviar `limit` y `run_id`; rechazar o ignorar parámetros arbitrarios.
- No reenviar cookies ni cabeceras de autenticación del navegador.
- No registrar secretos; `run_id` no es secreto.
- Añadir `X-Content-Type-Options: nosniff` y no servir rutas con `..`.
- Devolver `502` con JSON `{"error":"historian_unreachable"}` si el Historian no responde; el frontend lo trata como consulta interrumpida.

**Comando propuesto (no ejecutado, porque `server.py` aún no existe):**

```sh
cd /ruta/a/dashboard_frontend
HISTORIAN_URL=http://192.168.20.20:8081 python3 server.py --bind 127.0.0.1 --port 8080 --web ./web
# Navegador en la misma laptop:
# http://127.0.0.1:8080/
```

**Estado:** propuesto. La disponibilidad de Python 3 en la laptop IT está **pendiente** de confirmar; el baseline del 10 de noviembre usó `py` en la laptop IT, lo que es evidencia histórica, no una garantía del equipo actual.

### 3.3 Opción B — alternativa: servir la UI desde el Historian

El PDF documenta que el Historian ya escucha en `192.168.20.20:8081`. Se podría ampliar `it_historian_service.py` para servir `index.html` en `/` y mantener `/telemetry` y `/health` en el mismo puerto. El navegador de la laptop IT abriría `http://192.168.20.20:8081/` y llamaría a `/telemetry` sin proxy: mismo origen literal.

**Ventajas:** no hay proceso extra; la ruta HTTP ya está documentada (laptop IT → Historian 8081).

**Costos y riesgos:** modifica el servicio de datos; el código no está en este repositorio y no se puede revisar aquí; hay que coordinar con el responsable del Historian, respaldar y probar; un error en el servidor de archivos afecta también la API. **No es la opción recomendada para esta ronda.** Si se elige, `web/config.js` debe usar `API_BASE: ""` y el proxy desaparece.

### 3.4 Opción C — descartada: nginx/Caddy

No hay evidencia de que estén instalados en la laptop IT o en el Historian. Añadir un servicio nuevo en una red aislada, sin probarlo, es más riesgo que el proxy pequeño de Python estándar. Descartado para la demo.

### 3.5 Dónde se configura la URL base

| Lugar | Qué se configura | Quién lo ve |
|---|---|---|
| `server.py` → `HISTORIAN_URL` | `http://192.168.20.20:8081` | Solo el servidor. |
| `web/config.js` → `API_BASE` | `/api` (Opción A) o `""` (Opción B) | Navegador. |
| `web/config.js` → `RUN_ID` | `INTEGRACION-001` por defecto; se puede sobreescribir con `?run_id=` | Navegador. |
| `web/config.js` → `POLL_MS`, `LIMIT`, `SIMULATION` | `1000`, `50`, `false` | Navegador. |

**Regla:** la IP del Historian no se pone en `config.js`. Si se pone ahí, el navegador vuelve a depender de CORS y de la ruta directa; además se rompe la misma-origen.

### 3.6 Desde qué equipo se levanta la demo

**Recomendación:** laptop IT `192.168.20.10`, con el navegador en la misma laptop y el proxy escuchando en `127.0.0.1:8080`.

Motivos:

- Es el equipo documentado como “Cliente de consulta y Dashboard” (PDF).
- La matriz de comunicaciones ya permite laptop IT → Historian HTTP 8081 (PDF).
- El proxy conserva la IP de origen `192.168.20.10`, que es la que la regla documentada espera.
- El navegador usa loopback; no hace falta abrir el puerto 8080 en Windows Firewall para la demo local.

**Si se proyecta desde otro equipo IT:** cambiar `BIND` a `192.168.20.10` (no `0.0.0.0`), abrir `http://192.168.20.10:8080/` y permitir inbound TCP 8080 en la laptop IT, limitado a la subred IT. El proxy sigue saliendo desde `.20.10`; no se requiere una regla nueva en Firepower. **Pendiente:** confirmar que la laptop IT puede ejecutar Python y que el puerto 8080 está libre.

**Si la laptop IT no puede ejecutar Python:** usar la Opción B (UI en el Historian) o llevar el proxy a otro equipo IT con Python y obtener autorización para que ese equipo consulte el Historian; esto último puede requerir una regla de firewall nueva y no está recomendado.

### 3.7 Firewall y red

| Flujo | Estado | Acción |
|---|---|---|
| Laptop IT `.20.10` → Historian `.20.20` TCP 8081 | **Documentado** (PDF, matriz). | Mantener; es el único flujo de datos del dashboard. |
| Navegador → proxy `127.0.0.1:8080` | Loopback. | No requiere regla. |
| Otro equipo IT → laptop IT TCP 8080 | No documentado. | Solo si se proyecta desde otro equipo; requiere `BIND=192.168.20.10` y abrir 8080 en Windows Firewall, no en Firepower. |
| OT/IDMZ → proxy | Prohibido. | El proxy escucha en loopback por defecto; no publicar en `0.0.0.0` sin revisión. |

No se requiere TLS para la demo: el PDF documenta HTTP 8081 sin TLS y la red IT es local. No introducir HTTPS autofirmado en el prototipo; añadiría fricción de certificados sin mejorar el alcance.

---

## 4. Pantalla única

### 4.1 Principios

- **Una sola pantalla**, sin pestañas ni rutas internas.
- **Tres tarjetas** de señal, **tres carriles** de historial y **una tabla** reciente.
- Los estados usan exclusivamente los textos **“Señal activa”**, **“Señal inactiva”** y **“Sin lectura”**.
- El significado físico de los tags está **pendiente**. No usar “válvula abierta”, “pistón extendido/replegado”, “motor encendido” ni equivalentes.
- No mostrar un estado de “PLC conectado/desconectado”. La pantalla solo conoce la API y los datos; la edad de un registro no es un diagnóstico del PLC.
- El color no es el único portador de estado: cada tarjeta y cada celda lleva texto.

### 4.2 Esquema textual

```text
+----------------------------------------------------------------------------------+
| Dashboard de telemetría IT/OT                          Corrida: INTEGRACION-001 |
| Estado de consulta: [En línea | Esperando datos | Consulta interrumpida]          |
| Última consulta: 21:40:06Z   Último registro: 21:40:05Z   Edad: 1 s               |
+----------------------------------------------------------------------------------+
| [ MODO SIMULACIÓN — datos de ejemplo, no provienen del PLC ]   (solo si aplica)  |
+----------------------------------------------------------------------------------+
| SEÑALES                                                                           |
|  +---------------------+  +---------------------+  +---------------------+        |
|  | Señal 1             |  | Señal 2             |  | Señal 3             |        |
|  | piston1_act         |  | piston2_act         |  | piston3_act         |        |
|  | Señal activa        |  | Señal inactiva      |  | Señal inactiva      |        |
|  | Última: 21:40:05Z   |  | Última: 21:40:05Z   |  | Última: 21:40:05Z   |        |
|  +---------------------+  +---------------------+  +---------------------+        |
+----------------------------------------------------------------------------------+
| HISTORIAL (hasta 50 registros; izquierda = antiguo, derecha = reciente)           |
|  Señal 1  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█   false → true                   |
|  Señal 2  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁   false                         |
|  Señal 3  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁   false                         |
+----------------------------------------------------------------------------------+
| REGISTROS RECIENTES                                                               |
|  Hora (UTC)          Seq  Señal 1        Señal 2        Señal 3        Recibido   |
|  2026-11-19 21:40:05   2  Señal activa   Señal inactiva Señal inactiva 21:40:05Z  |
|  2026-11-19 21:40:00   1  Señal inactiva Señal inactiva Señal inactiva 21:40:00Z  |
+----------------------------------------------------------------------------------+
| Nota: el significado físico de las señales está pendiente de confirmación.        |
+----------------------------------------------------------------------------------+
```

### 4.3 Tarjetas de señal

Cada tarjeta contiene:

1. Título genérico: `Señal 1`, `Señal 2`, `Señal 3`.
2. Tag técnico en monoespaciado: `piston1_act`, etc.
3. Estado: `Señal activa`, `Señal inactiva` o `Sin lectura`.
4. `Última: <timestamp>` si hay lectura; `Sin lectura` si no hay registro o el booleano es inválido.
5. Opcional: `Seq <n>` de la última lectura.

**Mapeo:**

| Valor de `variables.pistonN_act` | Texto | Estilo |
|---|---|---|
| `true` | `Señal activa` | Acento positivo + texto. |
| `false` | `Señal inactiva` | Neutro + texto. |
| ausente / `null` / no booleano | `Sin lectura` | Gris + texto. |
| sin ningún registro | `Sin lectura` | Gris + texto; la tarjeta no inventa `false`. |

### 4.4 Carriles de historial

- Tres carriles, uno por señal, en el mismo orden que las tarjetas.
- Cada carril muestra hasta 50 muestras, **izquierda = más antigua, derecha = más reciente**.
- Una muestra `true` se pinta como bloque lleno; `false` como bloque vacío con borde; un hueco de `seq` se muestra como espacio punteado.
- Debajo del carril, una leyenda textual: `false → true` si hubo transición; `sin cambios` si no; `sin lectura` si no hay datos.
- Si hay menos de 50 registros, el carril se dibuja con las muestras disponibles y un espacio vacío a la izquierda; no rellenar con `false` inventados.
- El carril no es una gráfica temporal continua: es una secuencia de muestras. No interpolar.

### 4.5 Tabla reciente

- Orden: **más reciente primero**, independientemente del orden de la API.
- Filas: hasta 50 registros únicos; si hay más, las 50 más recientes.
- Columnas: `Hora (UTC)`, `Seq`, `Señal 1`, `Señal 2`, `Señal 3`, `Recibido (UTC)`.
- Si el filtro de corrida es local o hay más de una corrida visible, añadir `Corrida` y `Origen` como columnas (o en una línea secundaria).
- Los valores de las señales usan los textos exactos; no usar iconos solos.
- Si no hay filas: una sola fila vacía con `Sin registros para la corrida`.
- La tabla no es editable y no tiene acciones.

### 4.6 Textos y prohibiciones

**Textos permitidos para el estado de la consulta:**

- `En línea` — última consulta HTTP 200 con datos.
- `Esperando datos` — última consulta HTTP 200 con arreglo vacío.
- `Sin datos nuevos` — nota secundaria cuando la API responde `[]` pero ya había datos; no sustituye a `Esperando datos`.
- `Consulta interrumpida` — timeout, error de red, no-2xx, JSON inválido.
- `Simulación` — modo explícito; no es un estado de red.

**Prohibido:**

- `PLC desconectado`, `PLC en línea`, `PLC sin conexión`.
- `Fallo de planta`, `alarma`, `crítico` sin definición del equipo.
- `Pistón extendido/replegado`, `válvula abierta/cerrada`, `motor encendido/apagado`.
- Cualquier texto que deduzca el estado físico a partir de la edad del registro.

**Nota de alcance visible al pie:** `El significado físico de las señales está pendiente de confirmación.`

---

## 5. Contrato del prototipo

### 5.1 Configuración

`web/config.js` (propuesto):

```js
window.DASH_CONFIG = {
  API_BASE: "/api",              // Opción A; "" si el Historian sirve la UI
  RUN_ID: "INTEGRACION-001",     // se puede sobreescribir con ?run_id=
  LIMIT: 50,
  POLL_MS: 1000,
  REQUEST_TIMEOUT_MS: 3000,
  SIMULATION: false              // se puede activar con ?sim=1
};
```

Precedencia: `?run_id=` > `DASH_CONFIG.RUN_ID`; `?sim=1` > `DASH_CONFIG.SIMULATION`. No hay otros parámetros de URL en el prototipo.

### 5.2 Bucle de polling

- Intervalo inicial: **1 000 ms**.
- **Una sola consulta en vuelo.** No usar `setInterval`; usar `setTimeout` después de que la consulta anterior termine (éxito o error).
- Timeout por consulta: **3 000 ms** con `AbortController`.
- `cache: "no-store"` para evitar respuestas cacheadas.
- Si la pestaña queda oculta, el prototipo puede seguir consultando; no se requiere pausa. Si se añade, debe documentarse y no cambiar el contrato.
- No hay reintentos por error de red; el siguiente tick es el reintento. Los únicos reintentos son los de fallback de contrato (§5.3), como máximo uno por consulta.

Pseudocódigo:

```text
inFlight = false

function tick():
    if inFlight: return
    inFlight = true
    try:
        respuesta = fetch(API_BASE + "/telemetry?limit=50&run_id=" + runId,
                          timeout=3000, cache=no-store)
        procesar(respuesta)
    catch error:
        estado = INTERRUMPIDA
        conservarUltimaLectura()
    finally:
        inFlight = false
        setTimeout(tick, 1000)
```

### 5.3 Consulta y fallback de `run_id`

1. Primera consulta: `GET {API_BASE}/telemetry?limit=50&run_id={RUN_ID}`.
2. Si la respuesta es `200` y **todos** los ítems tienen el `run_id` pedido: modo `filtro API`.
3. Si la respuesta es `200` pero aparece un ítem con otro `run_id`: el filtro fue ignorado. Filtrar la respuesta actual, pasar a `filtro local` y omitir `run_id` en las consultas siguientes. Mostrar `Filtro de corrida: local` en el encabezado.
4. Si la respuesta es `400` o `422` y el cuerpo menciona `run_id` (o no hay cuerpo): reintentar **una vez** sin `run_id`; si vuelve `200`, activar `filtro local`. Si vuelve a fallar, `consulta interrumpida`.
5. Si `RUN_ID` está vacío: no enviar `run_id`; mostrar todas las corridas y añadir la columna `Corrida`.
6. Si `limit=50` es rechazado: reintentar una vez sin `limit`, recortar a 50 en el cliente y mostrar `Límite: local`.

No hacer más de un reintento de fallback por consulta. Si coinciden dos causas (por ejemplo, `run_id` y `limit`), priorizar `run_id` y dejar `limit` para la consulta siguiente. No ocultar el modo de filtro: es información para la demo.

### 5.4 Deduplicación y orden

- Clave: `run_id + "\u0000" + source + "\u0000" + seq`.
- Si llega la misma clave dos veces, conservar el registro con `received_at` más reciente; si empatan, el primero del arreglo (el más reciente según el orden documentado).
- Mantener un búfer de hasta **50 registros únicos**.
- Al fusionar, ordenar por `timestamp` ascendente y, si empatan, por `seq` ascendente.
- La tabla muestra el búfer en orden descendente.
- No deduplicar por `id`: el `id` no es la clave funcional confirmada.
- Al cambiar `RUN_ID` o al recargar, reiniciar el búfer.

### 5.5 Máquina de estados

| Estado | Disparador | Tarjetas | Encabezado | Tabla |
|---|---|---|---|---|
| `CARGANDO` | Primera consulta aún no termina; no hay datos previos. | `Sin lectura` | `Esperando datos` | `Sin registros para la corrida` |
| `EN_LINEA` | Última consulta 200 con ≥1 registro válido. | Según el último registro. | `En línea` | Poblada. |
| `ESPERANDO` | Última consulta 200 con `[]`; no hay datos previos. | `Sin lectura` | `Esperando datos` | `Sin registros para la corrida` |
| `SIN_DATOS_NUEVOS` | Última consulta 200 con `[]`; había datos previos. | Se conservan las últimas tarjetas. | `Esperando datos` + `Sin datos nuevos` | Se conserva. |
| `INTERRUMPIDA` | Timeout, error de red, no-2xx, JSON inválido o no-array. | Se conservan; si nunca hubo datos, `Sin lectura`. | `Consulta interrumpida` + `Última lectura: ...` | Se conserva. |
| `SIMULACION` | `?sim=1` o `SIMULATION=true`. | Según el guion de simulación. | `Simulación` + banner. | Poblada con el fixture. |

**Regla de conservación:** un fallo nunca borra la última lectura. Se conserva el último valor y su hora; se muestra la edad. Un `200 []` tampoco borra el historial previo: indica que no hay datos nuevos en esa consulta.

**Regla de edad:** la edad se calcula con `received_at` si es válido; si no, con `timestamp` y se etiqueta `estimada`. Si la edad es negativa, mostrar `0 s` y `reloj del cliente adelantado`; no inferir un estado del PLC. **La edad no es un indicador de conexión del PLC.**

### 5.6 Fallo y recuperación

- **Fallo:** el estado pasa a `INTERRUMPIDA` en el primer error; no se espera a un segundo fallo. Se conserva la última lectura y se muestra su hora. El polling sigue cada 1 s.
- **Recuperación:** en la primera respuesta 200 válida, el estado vuelve a `EN_LINEA` o `ESPERANDO`; se fusionan los nuevos registros, se deduplica y se actualiza `Última consulta`. No se recarga la página.
- **Fallo en el arranque:** si nunca hubo datos, las tarjetas muestran `Sin lectura` y el banner `Consulta interrumpida`; no se muestra un estado de PLC.
- **Error de contrato:** si el cuerpo es un objeto con `records`, un HTML de error o un arreglo de tipos incorrectos, se trata como interrumpida y se registra `error de contrato` en la consola; no se intenta adivinar.

### 5.7 Modo simulación

- Activación explícita: `?sim=1` o `SIMULATION: true` en `config.js`.
- Banner permanente y visible: `MODO SIMULACIÓN — datos de ejemplo, no provienen del PLC`.
- Fuente: `fixtures/telemetry-INTEGRACION-001.json`. Para que la simulación funcione sin red, embeber los dos registros en `app.js` o cargarlos desde el mismo origen; en ningún caso se hace una petición a `/api` ni al Historian.
- Guion: a los 0 s se muestra `seq=1` (tres señales inactivas); a los 5 s se añade `seq=2` (`piston1_act` activo). El búfer conserva ambos; la tabla queda con `seq=2` arriba.
- La edad en simulación se muestra como `No aplica (simulación)`; no se calcula contra el reloj actual, porque los datos son históricos y no “en vivo”.
- Si se intenta salir del modo simulación, se requiere cambiar el parámetro/config y recargar; **no hay fallback automático** al fixture cuando la API falla.
- El modo simulación debe poder probarse sin red y sin el Historian.

### 5.8 Lo que el prototipo no hace

- No pagina ni hace *catch-up*: pide los últimos 50 y descarta los más antiguos si se superan entre consultas.
- No persiste datos: al recargar, vuelve a pedir los últimos 50.
- No autentica, no escribe, no controla PLC ni actuadores.
- No compara corridas, no filtra por rango de fechas, no exporta.
- No muestra el estado físico de los pistones; solo el valor lógico de los tags.
- No promete entrega exacta ni historia completa; es un visor de los últimos 50 registros.

---

## 6. Criterios de aceptación

Todos los criterios se prueban primero contra el fixture/mock local. Los que requieren la API real se marcan **Pendiente**.

### AC-01 — Arranque sin datos (API 200 `[]`)

- **Dado:** el dashboard arranca; la API responde `200 []`; no hay datos previos.
- **Cuando:** se carga la página y transcurren 3 s.
- **Entonces:** las tres tarjetas muestran `Sin lectura`; el encabezado muestra `Esperando datos`; la tabla muestra `Sin registros para la corrida`; no hay errores en consola; el polling continúa.
- **Evidencia:** captura de pantalla, consola limpia, una petición por segundo sin solapamiento (DevTools → Network).

### AC-02 — Arranque con API caída

- **Dado:** el dashboard arranca; la API no responde o devuelve 502; no hay datos previos.
- **Cuando:** falla la primera consulta.
- **Entonces:** las tres tarjetas muestran `Sin lectura`; el encabezado muestra `Consulta interrumpida`; no aparece `PLC desconectado`; el polling sigue.
- **Evidencia:** captura, texto del banner, reintentos en Network.

### AC-03 — Transición `seq=1` → `seq=2`

- **Dado:** el modo simulación o un mock entrega `seq=1` (tres `false`) y, 5 s después, `seq=2` (`piston1_act=true`).
- **Cuando:** llega el segundo registro.
- **Entonces:** antes, las tres tarjetas muestran `Señal inactiva` y la tabla tiene 1 fila; después, `Señal 1` muestra `Señal activa`, `Señal 2` y `Señal 3` siguen `Señal inactiva`; la tabla tiene 2 filas con `seq=2` arriba; el carril 1 muestra la transición `false → true`; no hay filas duplicadas tras varios polls.
- **Evidencia:** captura antes/después, contenido de la tabla, número de filas.

### AC-04 — Fallo tras datos

- **Dado:** hay datos cargados (`seq=1`, `seq=2`).
- **Cuando:** la API deja de responder durante 3 consultas.
- **Entonces:** el encabezado muestra `Consulta interrumpida` y `Última lectura: <hora>`; las tarjetas conservan `Señal activa`/`Señal inactiva`; la tabla conserva las filas; no se borra nada; no aparece lenguaje de PLC.
- **Evidencia:** captura, texto del banner, filas conservadas.

### AC-05 — Recuperación

- **Dado:** el estado es `INTERRUMPIDA` con datos previos.
- **Cuando:** la API vuelve a responder `200` con los mismos registros o con uno nuevo.
- **Entonces:** el banner desaparece; el estado vuelve a `En línea`; no se duplican `seq=1` ni `seq=2`; si hay un `seq=3`, aparece arriba en la tabla; `Última consulta` se actualiza.
- **Evidencia:** captura, número de filas, claves de deduplicación.

### AC-06 — Deduplicación

- **Dado:** el mock repite `seq=1` dos veces en la misma respuesta o en polls consecutivos.
- **Cuando:** se procesan las respuestas.
- **Entonces:** la tabla y los carriles muestran una sola fila para `run_id=INTEGRACION-001`, `source=PLC-SIEMENS-01`, `seq=1`; el número de filas no crece.
- **Evidencia:** respuesta del mock, filas renderizadas.

### AC-07 — Simulación

- **Dado:** se abre `?sim=1` (o `SIMULATION=true`).
- **Cuando:** se carga la página.
- **Entonces:** el banner `MODO SIMULACIÓN — datos de ejemplo, no provienen del PLC` es visible; no hay peticiones a `/api` ni al Historian; a los 0 s se ve `seq=1`; a los 5 s se ve `seq=2`; la tabla muestra 2 filas; la edad dice `No aplica (simulación)`; si la API real está caída, la simulación sigue funcionando y no se muestra como “En línea”.
- **Evidencia:** captura, Network vacío de `/api`, tabla.

### AC-08 — Filtro de corrida

- **Dado A:** la API respeta `run_id`. **Entonces:** la petición incluye `run_id=INTEGRACION-001`; solo se muestran filas de esa corrida.
- **Dado B:** la API ignora `run_id` y devuelve otra corrida. **Entonces:** el cliente detecta el `run_id` distinto, reintenta sin `run_id`, filtra localmente y muestra `Filtro de corrida: local`; no se muestran filas de otras corridas.
- **Evidencia:** URL de la petición, filas, texto del encabezado.

### AC-09 — Mismo origen

- **Dado:** el dashboard se sirve con la Opción A.
- **Cuando:** el navegador carga la página y consulta.
- **Entonces:** las peticiones van a `http://127.0.0.1:8080/api/telemetry` (mismo origen); no hay peticiones del navegador a `192.168.20.20:8081`; no hay preflight CORS; el proxy devuelve 200.
- **Evidencia:** DevTools → Network, cabeceras.

### AC-10 — Etiquetas y lenguaje

- **Dado:** cualquier estado de la pantalla.
- **Cuando:** se inspecciona el texto visible.
- **Entonces:** los únicos estados de señal son `Señal activa`, `Señal inactiva` y `Sin lectura`; no aparece `PLC desconectado` ni una interpretación física; el aviso de significado pendiente está visible.
- **Evidencia:** búsqueda de texto en el DOM, captura.

### AC-11 — API real (Pendiente)

- **Dado:** la laptop IT `192.168.20.10` con acceso al Historian `192.168.20.20:8081`.
- **Cuando:** se ejecutan `GET /health` y `GET /telemetry?limit=50&run_id=INTEGRACION-001`.
- **Entonces:** se registran código, cabeceras y cuerpo; el cuerpo es un arreglo; los campos y los tres booleanos coinciden; se documenta el orden real, si `limit` y `run_id` se aplican y qué devuelve una corrida vacía.
- **Evidencia:** transcripción de `curl` o captura de DevTools, con fecha y hora.
- **Estado:** no ejecutado en esta ronda; el host de trabajo no está en `192.168.20.0/24` y el intento a `/health` agotó el tiempo.

### Datos de prueba sin hardware

- Fixture: `fixtures/telemetry-INTEGRACION-001.json`.
- Mock local: implementar un servidor que devuelva el fixture en `/telemetry` y `{"status":"ok"}` en `/health`; permitir alternar `[]`, error 500 y timeout para AC-01/02/04/05. El mock queda fuera del entregable o en `tests/`, no en producción.
- Guion de simulación: `seq=1` a los 0 s, `seq=2` a los 5 s.
- Verificación rápida del fixture: `python3 -m json.tool fixtures/telemetry-INTEGRACION-001.json` y una comprobación de que `seq` 1 y 2 existen con los booleanos esperados.

---

## 7. Orden de implementación

| Paso | Entregable | Verificación | No hacer todavía |
|---|---|---|---|
| 0 | Este handoff + fixture + actualización del documento consolidado. | Revisión humana; `python3 -m json.tool` sobre el fixture. | No escribir la UI. |
| 1 | `web/index.html`, `web/styles.css`, `web/config.js` con la estructura de una pantalla, tarjetas, carriles y tabla en estado `Sin lectura`. | AC-01/AC-02 con datos simulados en memoria; revisión visual. | No conectar la API. |
| 2 | `web/app.js`: máquina de estados, render, normalización, deduplicación, orden y búfer de 50. | Pruebas con el fixture y con vectores de duplicados/valores inválidos. | No implementar el proxy. |
| 3 | Poller de 1 s con una sola consulta en vuelo, timeout de 3 s y manejo de `[]`/errores. | AC-01, AC-02, AC-04, AC-05 con mock. | No probar contra el Historian. |
| 4 | Modo simulación con el guion de 5 s y banner. | AC-07 sin red. | No usar el fixture como fallback de la API. |
| 5 | `server.py` (estáticos + `/api` + `/health`) con `HISTORIAN_URL` y bind loopback. | AC-09 en local; `curl` al proxy; path traversal y métodos no-GET. | No exponer en `0.0.0.0` sin revisión. |
| 6 | Aceptación local completa con mock: AC-01 a AC-10. | Capturas, Network, texto del DOM, tabla. | No declarar “demo lista” sin AC-11. |
| 7 | Prueba física en la laptop IT: `HISTORIAN_URL=http://192.168.20.20:8081`, abrir `http://127.0.0.1:8080/`, ejecutar AC-11 y repetir AC-01..AC-10 con datos reales. | Transcripción de `curl`, capturas, tabla. | No cambiar firewall/Firepower sin autorización. |

**Primera tarea concreta para el siguiente desarrollador:** crear la pantalla en estado vacío y la máquina de estados con el fixture, sin red. El criterio de cierre de esa primera tarea es AC-01/AC-02 y una captura de las tres tarjetas con `Sin lectura`.

**Archivos propuestos (no crear todos de golpe):**

```text
dashboard_frontend/
├── HANDOFF_Dashboard_ITOT_2026-11-19.md   (este documento)
├── Reto_ITOT_Arquitectura_Consolidada.md  (actualizado)
├── fixtures/
│   └── telemetry-INTEGRACION-001.json
├── web/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── config.js
└── server.py
```

---

## 8. Decisiones abiertas que afectan la demo

| ID | Pregunta | Recomendación | Qué bloquea | Qué falta |
|---|---|---|---|---|
| D-01 | ¿La demo se sirve desde la laptop IT o desde el Historian? | Laptop IT `.20.10` con proxy loopback (Opción A). | `server.py`, runbook de demo. | Confirmar Python 3 y puerto 8080 libre en la laptop; permiso para ejecutar un servidor local. |
| D-02 | ¿La API real respeta `limit`, `run_id` y devuelve `200 []`? | Implementar el contrato documentado + fallback; probar en cuanto haya acceso. | AC-08 y la confianza en el filtro. | Un `GET /telemetry` real desde `.20.10`. |
| D-03 | ¿Cuáles son los valores y formatos reales de `id` y `received_at`? | El fixture usa placeholders; la UI acepta ISO 8601 y tolera ausencia. | Edad exacta y tabla final. | Respuesta HTTP completa de los dos registros. |
| D-04 | ¿Qué significa físicamente cada pistón? | No mostrarlo; usar solo `Señal activa/inactiva` y dejar la nota. | Textos finales y narrativa de la demo. | Confirmación del equipo/TIA Portal. |
| D-05 | ¿Qué `run_id` se usará en la demo: `INTEGRACION-001` o uno nuevo? | Configurable; `INTEGRACION-001` por defecto para simulación; `?run_id=` para la corrida real. | Capturas y filtro por defecto. | Decidir el run_id de la demo. |
| D-06 | ¿Se autoriza modificar `it_historian_service.py` para servir la UI (Opción B)? | No para esta ronda; solo si no hay Python en la laptop. | Opción B. | Revisión del dueño del Historian y respaldo. |
| D-07 | ¿Qué navegador/SO tiene la laptop IT? | Edge/Chrome actualizado; probar `fetch`, `AbortController` y CSS. | Compatibilidad menor. | Confirmar versión. |
| D-08 | ¿La API tiene autenticación o límite de tasa? | Asumir sin auth y 1 rps; si hay auth, es cambio de alcance. | Polling y proxy. | Confirmar con el equipo. |
| D-09 | ¿El reloj de la laptop y el Historian están sincronizados? | Mostrar UTC; edad con `received_at`; no inferir PLC. | Precisión de la edad. | Comparar `date -u` en ambos. |

---

## 9. Comandos verificados y no verificados

### 9.1 Verificados en esta ronda

```sh
# Estado inicial del repositorio, antes de crear este handoff y el fixture
git -C /home/angerchy/Projects/Ciberseguridad/proyecto/dashboard_frontend status --short
# → ?? Reto_ITOT_Arquitectura_Consolidada.md

git -C /home/angerchy/Projects/Ciberseguridad/proyecto/dashboard_frontend log --oneline -1
# → f6e89ad Initial commit

git -C /home/angerchy/Projects/Ciberseguridad/proyecto/dashboard_frontend ls-files
# → README.md

# Búsqueda de la implementación actual
find /home/angerchy -name 'it_historian_service.py' -o -name 'ot_plc_publisher.py' -o -name 'it_query_client.py'
# → sin resultados

# Demo anterior: contrato distinto
sha256sum /home/angerchy/Projects/firewall-lab-baseline/Proyecto_Conexion_IT-OT/cierre-flujo_itot-COMPLETO-001.py
# → 506f5030c90579e8950504ee75020200306e824d3634240476bd87cb08c9ead5
grep -nE "path.path ==|/telemetry|/records|/health" /home/angerchy/Projects/firewall-lab-baseline/Proyecto_Conexion_IT-OT/cierre-flujo_itot-COMPLETO-001.py
# → /health, /records, /telemetria (POST); no /telemetry

# Entorno local
python3 --version
# → Python 3.15.2

# Acceso al Historian desde este equipo
curl -sS --max-time 3 -o /dev/null -w 'HTTP %{http_code} time %{time_total}\n' http://192.168.20.20:8081/health
# → curl: (28) Connection timed out after 3002 milliseconds; HTTP 000
ip -br addr
# → sin interfaz en 192.168.20.0/24
```

### 9.2 No verificados / no existentes

| Comando o componente | Estado |
|---|---|
| `python3 server.py` | **No existe** `server.py`; comando propuesto, no ejecutado. |
| `npm install` / `npm run dev` / build de frontend | **No existe** `package.json`; no aplica a la recomendación. |
| `python3 -m http.server` como servidor definitivo | No sirve el proxy `/api`; solo se podría usar para una prueba estática. No es la recomendación. |
| Arranque del Historian actual | **No disponible** en el repo; el PDF describe `it_historian_service.py`, pero el archivo no está. |
| Comandos del baseline 2026-11-10 (`flujo_itot.py historian/colector/it/ot`) | Documentados y ejecutados en esa sesión, **no reejecutados** ahora; pertenecen al contrato viejo `/records`, no a `/telemetry`. |
| `docker compose` del MVP InfluxDB | Existe en otro directorio, pero es otra arquitectura; no se usó. |

### 9.3 Comandos propuestos para la siguiente ronda

```sh
# Servidor del dashboard (cuando exista)
cd /home/angerchy/Projects/Ciberseguridad/proyecto/dashboard_frontend
HISTORIAN_URL=http://192.168.20.20:8081 \
  python3 server.py --bind 127.0.0.1 --port 8080 --web ./web

# Prueba del proxy (local)
curl -sS http://127.0.0.1:8080/api/health
curl -sS 'http://127.0.0.1:8080/api/telemetry?limit=50&run_id=INTEGRACION-001'

# Prueba directa contra el Historian (solo desde la laptop IT, Pendiente)
curl -sS -D - 'http://192.168.20.20:8081/health'
curl -sS -D - 'http://192.168.20.20:8081/telemetry?limit=50&run_id=INTEGRACION-001'
curl -sS -D - 'http://192.168.20.20:8081/telemetry?limit=50&run_id=CORRIDA-QUE-NO-EXISTE'
```

---

## 10. Prompt corto para el siguiente agente

```text
Repositorio: /home/angerchy/Projects/Ciberseguridad/proyecto/dashboard_frontend
Rama master; base f6e89ad; consulta `git log -1` para el HEAD actual. Lee
HANDOFF_Dashboard_ITOT_2026-11-19.md y Reto_ITOT_Arquitectura_Consolidada.md.
Implementa solo la pantalla única y el proxy mismo origen descritos; empieza
por el fixture y la máquina de estados, sin montaje físico. No inventes el
significado de piston1_act/piston2_act/piston3_act ni muestres “PLC
desconectado”. Verifica con el fixture/mock y deja AC-11 pendiente hasta tener
acceso a 192.168.20.20:8081.
```

---

## 11. Skills para las siguientes fases

Inventario consultado: `/home/angerchy/Projects/hermes-local/SKILLS-INVENTORY.md`. Ninguna skill candidata se instaló en esta ronda.

| Fase | Skill sugerida | Estado | Uso |
|---|---|---|---|
| Handoff / cierre | `project-handoff` | Instalada; usada | Este documento y el prompt de relevo. |
| Entrega con agentes | `agent-assisted-software-delivery` | Instalada; usada | Reglas de alcance, verificación y separación de lo verificado. |
| Diseño de contrato | `architecture-data-contracts` | Candidata; no instalada | Revisar §2 y §5 antes de codificar. |
| Diseño frontend/backend | `architecture-frontend-backend` | Candidata; no instalada | Validar el proxy mismo origen de §3. |
| Construcción | `execution-*`, `discipline-ai-code-review` | Candidatas; no instaladas | Implementación y revisión por otro agente. |
| Pruebas | `qa-testing-strategy`, `qa-debugging-tools` | Candidatas; no instaladas | AC-01 a AC-11. |
| Operación | `observability-monitoring`, `infra-deployment` | Candidatas; no instaladas | Solo si se despliega fuera del laboratorio. |

Regla: las candidatas se leen y adaptan; no se copian rutas, modelos ni automatizaciones heredadas, y no se instalan en bloque. La autorización humana sigue siendo necesaria.

---

## Anexo A — Fixture de referencia

Ruta: `fixtures/telemetry-INTEGRACION-001.json`.

```json
[
  {
    "id": 2,
    "run_id": "INTEGRACION-001",
    "source": "PLC-SIEMENS-01",
    "seq": 2,
    "timestamp": "2026-11-19T21:40:05Z",
    "received_at": "2026-11-19T21:40:05Z",
    "variables": {
      "piston1_act": true,
      "piston2_act": false,
      "piston3_act": false
    }
  },
  {
    "id": 1,
    "run_id": "INTEGRACION-001",
    "source": "PLC-SIEMENS-01",
    "seq": 1,
    "timestamp": "2026-11-19T21:40:00Z",
    "received_at": "2026-11-19T21:40:00Z",
    "variables": {
      "piston1_act": false,
      "piston2_act": false,
      "piston3_act": false
    }
  }
]
```

**Advertencia:** `id` y `received_at` son valores de ejemplo. El equipo solo confirmó que los campos existen y los valores de `timestamp`/`seq`/`variables`. No citar este fixture como una captura real de la API.

---

## Anexo B — Trazabilidad de la solicitud

| Punto solicitado | Sección |
|---|---|
| 1. Puntos de entrada, stack y comandos; rutas y distinción código/equipo. | §1, §9 |
| 2. Verificación de `/telemetry` y `/health` con código/fixtures; pendientes físicos. | §2.2, §2.3, AC-11 |
| 3. Cómo servir el dashboard y ruta misma-origen; URL base y equipo de demo. | §3 |
| 4. Pantalla única, tarjetas, carriles, tabla, etiquetas y esquema textual. | §4 |
| 5. Polling 1 s, una consulta en vuelo, 50 registros, filtro, dedupe, estados, fallo, edad, simulación. | §5 |
| 6. Criterios de aceptación y orden de implementación. | §6, §7 |
| Entrega: rutas, stack, comandos, decisiones abiertas. | §1.3, §8, §9; respuesta de esta ronda |
