# Criterios de calidad de CajaLima

Definidos para el alcance solicitado: configuración inicial, login, inicio vacío y 404.

- Mantener la Fase A, V1 y los datos existentes. `mvn clean test`: cero fallos, errores u omitidas.
- TypeScript estricto, sin `any` ni supresiones para ocultar problemas. `npm run build` debe pasar.
- `npm run lint`, `npm run format:check` y `npm test`: cero errores.
- Ningún secreto, JWT completo, `.env`, dependencia instalada o artefacto temporal en Git.
- JWT únicamente en memoria. Nunca en URL, cookies, localStorage o sessionStorage.
- Autenticación contra el backend real. Roles decididos por el servidor.
- Cero errores de consola inesperados y cero violaciones WCAG A/AA detectadas por axe en las pantallas probadas.
- Teclado, etiquetas, errores asociados y foco visible. Controles de al menos 44 px de alto.
- Verificar 375×812, 768×1024 y 1366×768 sin desbordamiento horizontal.
- Máximo seis capturas representativas, sin credenciales ni tokens.
- Componentes pequeños por responsabilidad, API centralizada y sin dependencias circulares.
- Colores y tipografía centralizados. No simular métricas ni integraciones futuras.
- No debilitar estos criterios para obtener un resultado verde. Una herramienta no disponible debe declararse como pendiente, nunca como aprobada.

Comandos frontend desde `frontend/`; pruebas de navegador con Playwright CLI y axe descritas en `docs/verification.md`. Los resultados de Strix dependen de una sesión autenticada y un modelo disponible.
