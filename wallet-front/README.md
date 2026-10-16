# Plata Wallet — frontend

Aplicación web de billetera digital creada con Angular. Incluye una interfaz adaptable para registro/KYC, pagos a contactos, lectura y generación de QR, estado de wallet e historial de operaciones.

## Requisitos y ejecución

- Node.js 22.12 o superior
- npm

```powershell
cd wallet-front
npm install
npm start
```

Abre la URL que Angular CLI indique al iniciar el servidor. Si el puerto 4200 ya esta ocupado, Angular puede seleccionar otro disponible.

Para compilar:

```powershell
npm run build
```

## Backend local

El registro y la consulta de saldos requieren el middleware definido en `../api/contrato-wallet.json`.

El frontend envia las solicitudes al mismo origen usando `/api`. En desarrollo, Angular CLI aplica `src/proxy.conf.json` y reenvia al backend local en `http://127.0.0.1:5000`; en Compose, Nginx reenvia `/api` al servicio `wallet-services`. Esto evita llamadas cross-origin desde el navegador y no requiere habilitar CORS globalmente en Flask.

- El alta envía `documentType: TEST` y un documento ficticio `TEST-<8 dígitos>` a `POST /crear-wallet`. No ingreses documentos reales.
- La aplicación consulta el resultado mediante `GET /consultar-kyc/{verification_id}` y los saldos mediante `GET /consulta-estado-saldos/{wallet_id}`.
- La sesión y los identificadores de prueba se conservan en `sessionStorage` durante la pestaña actual.
- Contactos e historial siguen siendo datos de ejemplo; los comprobantes son vistas previas, no pagos.
- La lectura y generación de QR se realizan localmente con el formato `wallet://pay?customer=...&amount=...`.

## Funciones

- Navegación entre inicio, onboarding, envío a contactos, QR, wallet y operaciones.
- Validación de documento DNI y montos PEN entre S/ 0.01 y S/ 500.00.
- Búsqueda local de contactos y operaciones de ejemplo.
- Comprobante de demostración para el flujo de envío.
- Lectura de QR desde una imagen y generación local de QR de demostración.
- Vistas adaptables para móvil y escritorio.
