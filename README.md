# CajaLima

Para cerrar el día con las cuentas claras.

## ¿Qué es CajaLima?

CajaLima nace en Lima, Perú, como una idea para ayudar a los pequeños negocios a llevar sus ventas y su caja en un solo lugar. Está pensado para quienes atienden, cobran, reponen productos y hacen las cuentas al terminar la jornada, muchas veces entre las mismas pocas personas.

La propuesta es una aplicación sencilla donde se pueda registrar lo que se vende, cómo se cobra y qué queda disponible. Hoy estamos construyendo esa base; las funciones para operar un negocio todavía están en desarrollo.

## ¿Qué problema busca resolver?

En muchos comercios, una parte del dinero entra en efectivo, otra por Yape o Plin y otra por transferencia. Los apuntes pueden quedar repartidos entre un cuaderno, mensajes y una hoja de cálculo.

Al cerrar, responder cuánto se vendió, cuánto entró por cada medio, qué productos salieron más o cuánto stock queda puede tomar más tiempo del necesario. También puede ser difícil saber quién registró una operación. CajaLima busca reunir esa información para que revisar el día sea más fácil.

Yape y Plin se contemplan como medios de pago que el negocio podrá registrar. No hay integraciones oficiales ni validación automática de esos pagos.

## ¿Para quién está pensado?

Para bodegas, barberías, cafeterías, minimarkets, pequeños restaurantes, emprendimientos y negocios familiares de Lima y del resto del Perú que necesitan ordenar sus operaciones diarias.

## ¿Qué podrá hacer?

Estas funciones están previstas y aún no están disponibles:

- Definir permisos específicos para cada operación del negocio según el rol del usuario.
- Organizar productos y consultar el stock disponible.
- Registrar ventas y su medio de pago: efectivo, Yape, Plin o transferencia.
- Guardar información de clientes.
- Consultar un panel con ventas diarias y mensuales, productos más vendidos y ticket promedio, es decir, cuánto se vende en promedio por operación.
- Revisar quién registró cada operación mediante un historial de auditoría.

## Estado del proyecto

CajaLima se encuentra actualmente en desarrollo. Ya están disponibles el backend con Java 21 y Spring Boot, PostgreSQL en Docker, el registro de usuarios con roles `ADMIN` y `EMPLOYEE`, el inicio de sesión y las pruebas automatizadas de autenticación.

Los cambios de la base de datos se administran con migraciones versionadas de Flyway. La primera crea la tabla de usuarios, sin cuentas precargadas.

Todavía no hay una interfaz para clientes ni funciones de ventas o inventario. La API permite registrar una cuenta, iniciar sesión y consultar los datos del usuario autenticado.

## Arquitectura

El frontend previsto se comunicará con el backend mediante una API REST. Spring Boot procesará las operaciones y PostgreSQL guardará la información.

```text
Frontend futuro
       |
       | REST API
       v
  Spring Boot
       |
       v
  PostgreSQL
```

## Tecnologías

| Área | Tecnologías |
| --- | --- |
| Backend | Java 21, Spring Boot 4.1.1, Spring Security, Spring Data JPA y Maven |
| Base de datos | PostgreSQL 17 y Flyway para las migraciones |
| Infraestructura local | Docker y Docker Compose |
| Próximamente | React, TypeScript, más pruebas automatizadas y CI/CD |

## Seguridad desde el diseño

La seguridad forma parte de cómo queremos construir CajaLima desde el inicio. Los secretos se mantienen fuera del repositorio y la configuración privada se proporciona mediante variables de entorno. PostgreSQL solo se publica en la interfaz local del equipo.

Las contraseñas se almacenan mediante hash BCrypt y la autenticación de la API utiliza tokens JWT. Los datos de entrada se validan, las respuestas no incluyen contraseñas ni hashes y cada petición autenticada comprueba que la cuenta siga activa. La auditoría y los permisos específicos de cada operación se implementarán junto con las funciones del negocio.

En esta primera versión, el registro es público y permite elegir `ADMIN` o `EMPLOYEE`. Cualquier visitante puede crear una cuenta administradora: antes de abrir el sistema a clientes habrá que restringir ese registro y la asignación de roles. Esta versión no incorpora todavía limitación de intentos de login. En despliegue, la API debe servirse mediante HTTPS.

## Ejecutar localmente

Necesitas Java 21, Maven y Docker Desktop iniciado con contenedores Linux.

Crea manualmente un archivo `.env` en la raíz del proyecto. Los valores de usuario y contraseña de este ejemplo son ficticios: reemplázalos por los de tu entorno local y no los subas a Git.

```dotenv
POSTGRES_DB=cajalima
POSTGRES_USER=tu_usuario_local
POSTGRES_PASSWORD=tu_clave_local
POSTGRES_PORT=5433
JWT_SECRET=
JWT_EXPIRATION=3600000
```

Completa `JWT_SECRET` con un secreto aleatorio privado de al menos 32 bytes, generado con una herramienta segura. No uses una frase predecible. `JWT_EXPIRATION` se expresa en milisegundos (3600000 equivale a una hora); se admite entre un segundo y un día. El backend rechaza una clave ausente o demasiado corta.

Si ya tienes un `.env` y una base de datos inicializada, conserva sus credenciales. Cambiar la contraseña en el archivo no cambia la del usuario dentro de PostgreSQL. Para contraseñas con `$` o `#`, usa comillas simples en `.env`. Las variables del proceso tienen prioridad sobre el archivo al ejecutar Compose.

Desde la raíz:

```powershell
docker compose up -d postgres
docker compose ps
.\run-local.ps1
```

PostgreSQL se publica en `127.0.0.1:5433` por defecto; usamos 5433 para evitar conflictos con instalaciones locales que ocupen 5432. El backend escucha en 8080.

`run-local.ps1` usa el lector de `.env` de Compose, pasa únicamente las variables JWT al proceso y ejecuta `mvn spring-boot:run` desde `backend`. No imprime secretos y restaura las variables al terminar. Si Windows bloquea scripts locales, puedes invocarlo con `powershell -ExecutionPolicy RemoteSigned -File .\run-local.ps1`, sin cambiar la política permanente del equipo.

Maven activa el perfil `local`. La integración oficial de Spring Boot con Docker Compose obtiene la conexión de PostgreSQL sin duplicar credenciales. También puedes ejecutar `mvn spring-boot:run` directamente desde `backend` si `JWT_SECRET` y `JWT_EXPIRATION` ya están definidos en su entorno. En el IDE, configura esas variables, usa `backend` como directorio de trabajo y activa el perfil `local`.

Para comprobar el backend desde otra terminal:

```powershell
curl.exe -i http://localhost:8080/
```

Una respuesta `401` o `403` es válida en esta etapa: Spring Security protege la ruta. Para ejecutar las pruebas, desde `backend` y con Docker disponible:

```powershell
mvn clean test
```

Las pruebas generan su propia clave JWT y revierten sus operaciones sobre usuarios. La API ofrece `POST /api/auth/register`, `POST /api/auth/login` y `GET /api/auth/me`; este último necesita `Authorization: Bearer <token>`. El login devuelve `expiresIn` en segundos. Los tokens se firman con HS256 y no se usan cookies ni sesiones HTTP para autenticar.

En despliegue se usará la configuración privada de la plataforma mediante `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `JWT_SECRET` y `JWT_EXPIRATION`, sin activar el perfil `local`.

## Detener el proyecto

Presiona `Ctrl+C` en la terminal de Spring Boot. Después, desde la raíz:

```powershell
docker compose stop
```

Los datos permanecen en el volumen de Docker. Evita `docker compose down -v`, porque elimina ese volumen.

## Roadmap

- [x] Infraestructura inicial
- [x] PostgreSQL con Docker
- [x] Backend Spring Boot
- [x] Migraciones Flyway
- [x] Usuarios y roles
- [x] Autenticación JWT
- [ ] Productos
- [ ] Ventas
- [ ] Pagos
- [ ] Dashboard
- [ ] Frontend React + TypeScript
- [ ] Pruebas E2E
- [ ] Despliegue

## Autor

Fabrizio Alamo

[GitHub](https://github.com/yfabrizio777)

© 2026 Derechos reservados by Fabrizio Alamo.
