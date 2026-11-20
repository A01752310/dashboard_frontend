# Planta Alfa · Dashboard de telemetría IT/OT

Frontend **React + Vite**, pantalla única de solo lectura. Rama de implementación: `feature/dashboard-itot-simulacion`, creada desde `handoff/dashboard-itot-prototipo` (base `6732eef673a13938d39c7ca8cc7e4f64e84477ae`). El cambio a React responde a la indicación del equipo; sustituye la recomendación sin framework del handoff, conservando su contrato.

## Abrir en desarrollo

Requisitos: Node.js 22.12+ y npm. Desde esta carpeta:

```sh
npm ci
npm run dev
```

Abrir la URL local que imprime Vite (normalmente `http://127.0.0.1:5173/`). La pantalla inicia en **Datos simulados**. No necesita AWS, PLC, MQTT, VPN ni Historian. Las dependencias se instalan una vez; el frontend no carga fuentes, scripts ni servicios externos.

El fixture original `fixtures/telemetry-INTEGRACION-001.json` se importa en React y se incluye en el build:

- Al iniciar, `seq=1`: tres señales inactivas.
- Cinco segundos después, `seq=2`: solo `piston1_act=true`.
- Reiniciar simulación repite la misma secuencia, sin inventar registros.
- El banner indica que los datos no provienen del PLC; la edad no aplica.
- El filtro de corrida recarga la pantalla y limpia el historial. Otra corrida muestra una tabla vacía; dejarlo vacío muestra todas las corridas del fixture.

## Build para la laptop IT

```sh
npm run build
python3 server.py
```

En Windows puede usarse `py server.py`. Abrir `http://127.0.0.1:8080/`. El build puede prepararse en una computadora con Node; en la laptop IT basta copiar `dist/` y `server.py` y tener Python 3.9+. No abrir `index.html` con doble clic.

El servidor escucha únicamente en loopback por defecto. El proxy de datos queda deshabilitado; no se consulta ningún equipo físico al arrancar. Vite solo sirve la simulación; para verificar `/api` se utiliza `server.py` con el build.

## Integración posterior: Historian y AWS

**AWS todavía no se implementa en este repositorio.** No hay base de datos, tabla, API Gateway, Lambda, Cognito ni infraestructura AWS creada. No se eligió un servicio de base de datos. React es la visualización; el almacenamiento necesita un backend separado. Las credenciales y los secretos de AWS no deben incluirse en React ni en variables `VITE_*`.

`src/api.js` concentra el adaptador HTTP de solo lectura. El contrato de referencia sigue siendo el del Historian: un arreglo de registros con `id`, `run_id`, `source`, `seq`, `timestamp`, `received_at` y `variables`. Un futuro backend AWS deberá exponer ese contrato o incorporar una conversión explícita en el adaptador, junto con su autenticación. No existe un envío directo desde React a la base de datos.

Para el montaje, una vez confirmada la ruta desde la laptop IT y sin modificar el Historian:

```sh
HISTORIAN_URL=http://192.168.20.20:8081 python3 server.py --enable-api
```

Abrir `http://127.0.0.1:8080/?sim=0&run_id=INTEGRACION-001`. En PowerShell:

```powershell
$env:HISTORIAN_URL = "http://192.168.20.20:8081"
py server.py --enable-api
```

El navegador consulta `/api/telemetry` en su propio origen; el proxy consulta al Historian. No consulta las interfaces VLAN, el colector, los firewalls ni Mosquitto. No hay acciones de control. `GET /api/health` se reserva para diagnóstico. Solo se admiten `GET`, `limit` (1–50) y `run_id`; el destino se fija en el entorno del servidor. Se bloquean redirecciones y rutas fuera del build.

**AC-11 permanece pendiente.** Ninguna prueba local comprueba el transporte físico o el funcionamiento real de `/telemetry` y `/health`.

## Direccionamiento recibido

| Elemento | Dirección | Uso en esta entrega |
|---|---|---|
| IDMZ, VLAN 10 | `192.168.10.1` | Referencia de red; no es un endpoint de datos. |
| OT, VLAN 30 | `192.168.30.1` | Interfaz OT reportada; el handoff la ubica en el segmento de tránsito. |
| Colector OT | `192.168.100.20` | Reportado por David; fuera de la ruta actual según el handoff. Confirmar en montaje. |
| Firewall | `192.168.20.254` | Reportado por David; conciliar con las interfaces del handoff. |
| Historian | `192.168.20.20` | Futuro origen HTTP, puerto 8081; proxy deshabilitado por defecto. |
| IT, VLAN 20 | `192.168.20.1` | Interfaz de red destino, no la laptop. El cliente documentado es `.20.10`. |

La interfaz muestra estas referencias y sus pendientes en “Recorrido de la telemetría”. Ninguna dirección ni estado visible se presenta como conectividad verificada. Los documentos anteriores proponían OPC UA/InfluxDB; el handoff actual utiliza MQTT, SQLite e Historian HTTP. La futura decisión AWS sigue abierta.

## Contrato y comportamiento

- Estados de señal: “Señal activa”, “Señal inactiva”, “Sin lectura”. Sin interpretación física.
- Tres carriles con hasta 50 muestras; huecos de secuencia y valores desconocidos explícitos, sin interpolación.
- Deduplicación por `(run_id, source, seq)`, recepción más reciente y primera aparición si empatan.
- Orden por hora de origen y después secuencia, tabla descendente.
- Valores no booleanos se muestran como “Sin lectura”; campos extra se ignoran.
- Consulta vacía y errores conservan el último historial. La recuperación no requiere recarga.
- Polling secuencial de 1 s después de terminar cada consulta, timeout 3 s, sin solapamientos.
- Fallback de parámetros limitado a un reintento por consulta. Filtrado local visible si la API ignora/rechaza `run_id`.
- Nunca se sustituye una API fallida con el fixture.
- Hora UTC; edad desde `received_at`, estimada desde `timestamp` si falta y aviso de desfase si está en el futuro.

## Verificación

```sh
npm test
npm run build
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Se ejecutaron 11 pruebas Node y 6 pruebas Python: contrato, transición, vacío, fallos y recuperación, deduplicación, límite, tipos, reloj, fallback, timeout, rutas estáticas, métodos, proxy fijo y modo sin red. La instalación limpia con `npm ci` se verificó con el lockfile actualizado para las dependencias de las distintas plataformas. El build de producción compiló con Node 24.14.1. Las pruebas Python verifican el handler en memoria, sin abrir sockets.

**Límite de esta sesión:** el entorno bloqueó la escucha de un servidor local y la apertura de archivos locales en el navegador. No se completó inspección visual en navegador ni una prueba HTTP de extremo a extremo. Revisar escritorio/móvil, reinicio, transición a los 5 s y Network sin peticiones a `/api` antes de aceptar AC-07/AC-09 como evidencia visual. El montaje y AC-11 no se ejecutaron.

## Archivos

- `src/App.jsx`: pantalla y componentes React.
- `src/useTelemetry.js`: simulación, polling y ciclo de vida.
- `src/core.js`: normalización, búfer y estados comprobables sin navegador.
- `src/api.js`: adaptador de consulta para el montaje.
- `src/config.js`: configuración pública; simulación activa por defecto.
- `src/styles.css`: escritorio, móvil, foco de teclado y reducción de movimiento.
- `server.py`: servidor del build y proxy opcional.
- `tests/`: pruebas sin hardware ni servicios externos.
- [Handoff](HANDOFF_Dashboard_ITOT_2026-11-19.md), [fixture](fixtures/telemetry-INTEGRACION-001.json) y [arquitectura de referencia](Reto_ITOT_Arquitectura_Consolidada.md), conservados.
