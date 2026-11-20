# Dashboard IT/OT — prototipo

Rama `handoff/dashboard-itot-prototipo`: contiene la especificación y los datos de prueba. La aplicación y su comando de arranque están por implementar.

## Documentación

- [Handoff del prototipo](HANDOFF_Dashboard_ITOT_2026-11-19.md)
- [Fixture de telemetría INTEGRACION-001](fixtures/telemetry-INTEGRACION-001.json)
- [Arquitectura consolidada](Reto_ITOT_Arquitectura_Consolidada.md)

## Primer entregable

Una pantalla que inicia con tres tarjetas en «Sin lectura», carga `seq=1` y las tres pasan a «Señal inactiva»; al reproducir `seq=2` cinco segundos después, cambia únicamente el pistón 1 a «Señal activa». La transición debe aparecer en la línea de tiempo y en la tabla. El modo se rotula «Datos simulados».

## Segundo paso

Integrar el polling y el proxy HTTP local de solo lectura desde la laptop IT, conforme al handoff. La conexión al Historian y la prueba en vivo quedan para el montaje físico.
