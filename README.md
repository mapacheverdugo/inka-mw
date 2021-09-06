# Inka Middleware

Software encargado de conectar distintas redes sociales, como Instagram y Facebook con el fin de unificarlas en un mismo chat de servicio al cliente en el proyecto core de Inka.

## 1. Instalación

### 1.1. Requisitos
- Node 12 o superior
- `npm`
- `ffmpeg`

Instalacion Node 15.X para Debian

```
curl -sL https://deb.nodesource.com/setup_15.x | bash -
apt-get install -y nodejs
```

### 1.2. Proxy reverso node
Activar el proxy reverso para node

entrar al directorio
`/etc/apache2/conf-available`

crear el archivo `node.conf` y agregar la siguiente linea

```
SSLProxyEngine on # Esto solamente va si el destino es para https, ejemplo https://inka.aware.cl:3000
ProxyPass /node http://localhost:3000
```

ahora activarlo
```
a2enconf node
a2enmod proxy_http
service apache2 restart
```
### 1.3. Variables de entorno
El archivo de configuración se encuentra en la raíz del proyecto con el nombre de `.env`. Acá un ejemplo:
```
CORE_PORT=9090
LOG_LEVEL=info

PORT=3000

FACEBOOK_VALUE=Facebook
FACEBOOK_PORT=9021

INSTAGRAM_VALUE=Instagram
INSTAGRAM_PORT=9022
INSTAGRAM_SEC_DELAY=600

PGUSER=aware
PGHOST=123.12.123.123
PGPASSWORD=r.2ae3e,6696be
PGDATABASE=aware
PGPORT=5432

```

| **Variable**             | **Descripción**                                                                                                           |
|--------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `CORE_PORT`              | Puerto del socket TCP del Core.                                                                                           |
| `PORT`                   | Puerto donde correrá la API HTTP que donde se conectaran los webhook de Facebook.                                         |
| `LOG_LEVEL`              | Tipo de detalles de log. Por defecto `info`. Más información [acá](https://www.npmjs.com/package/winston#logging-levels). |
| `FACEBOOK_VALUE`         | Valor en la tabla `inka_app` de las aplicaciones Facebook. Por defecto debe ser `Facebook`.                               |
| `FACEBOOK_PORT`          | Puerto donde correrá el servido socket TCP para recibir mensajes de Facebook.                                             |
| `INSTAGRAM_VALUE`        | Valor en la tabla `inka_app` de las aplicaciones Instagram. Por defecto debe ser `Instagram`.                             |
| `INSTAGRAM_PORT`         | Puerto donde correrá el servido socket TCP para recibir mensajes de Instagram.                                            |
| `INSTAGRAM_SEC_DELAY` | Intervalo en segundos que define cada cuanto se procesarán las "solicitudes de mensajes" en Instagram.                    |
| `PGUSER`                 | Usuario de la base de datos PostgreSQL.                                                                                   |
| `PGHOST`                 | IP o host de la base de datos PostgreSQL.                                                                                 |
| `PGPASSWORD`             | Contraseña de la base de datos PostgreSQL.                                                                                |
| `PGDATABASE`             | Nombre de la base de datos PostgreSQL.                                                                                    |
| `PGPORT`                 | Puerto de la base de datos PostgreSQL.                                                                                    |

### 1.4. Instrucciones

Inka-mw requiere de node V12.0.0, por lo que se debe instalar precisamente dicha version.

1. Instalar librerías y dependencias
```bash
npm install -g n
n stable
n 12.0.0
rm -rf ~/.node-gyp
rm -rf package-lock.json node_modules/
npm install
```

3. Correr el servicio
```bash
npm start
```
4. Si se desea reinstalar, primeo se deben desinstalar todas las librerías con:
```bash
rm -rf package-lock.json node_modules/
```
y luego instalarlas nuevamente (previamente ya habiendo instalado node v12.0.0).
```bash
npm install
```

## 2. Configuración

### 2.1. Instagram

#### Configuración de la base de datos

| Columna | Valor |
|--|--|
| `app_name` | `Instagram` |
| `app_data1` | `appKey`. Nombre de usuario sin `@` + `-ig`. Ej: `usuario_empresa-ig` |
| `app_data2` | Nombre de usuario sin `@`. Ej: `usuario_empresa` |
| `app_data3` | Contraseña de inicio de sesión. Ej: `3gja70#2df` |
| `app_data7` | IP o host del Core. Ej: `123.15.12.143` |

#### Autenticación de dos factores (2FA)

Cuando una cuenta tenga activada la autenticación de dos factores, se deberá enviar un código adicional para iniciar sesión a través de una API HTTP montada dentro del mismo servidor.

1. Al iniciar el programa e intentar iniciar sesión el programa arrojará un mensaje como este:

```bash
Requiere 2FA, enviando código por SMS...
```
2. En caso de tener 2FA con SMS, enviará automáticamente un código de verificación.
3. Se deberá enviar el código del SMS, o en su defector del generador de código de autenticación, al programa en la siguiente petición `POST` al endpoint `/instagram/login/2fa` para finalizar el inicio de sesión.

```
POST /instagram/login/2fa HTTP/1.1
Content-Type: application/json

{
    "appKey": "usuario_empresa-ig",     // Correspondiente al appKey definido anteriormente en la base de datos.
    "code": "123456"                    // Correspondiente al código del 2FA
}
```

Lo que arrojará una respuesta como la siguiente

```json
{
    "appName": "Instagram",
    "appKey": "usuario_empresa-ig",
    "type": "2fa",
    "message": "Se envió la petición correctamente. Revisa los logs."
}
```

4. Lo que significará que se recibieron correctamente los datos, sin embargo se sugiere revisar los logs para saber si el inicio se completó satisfactoriamente.

#### Verificación de inicio de sesión

> Una cuenta que tenga activada 2FA puede requerir verificación adicional, es decir, primero habrá que completar el proceso de 2FA y luego este proceso de verificación

Cuando el servidor se encuentra en una ubicación que Instagram considera sospechosa, se deberá enviar un código adicional para iniciar sesión a través de una API HTTP montada dentro del mismo servidor.

1. Al iniciar el programa e intentar iniciar sesión el programa arrojará un mensaje como este:

```bash
Requiere verificación, enviando código al correo...
```
2. Enviará automáticamente un código de verificación.
3. Se deberá enviar ese código al programa en la siguiente petición `POST` al endpoint `/instagram/login/verification` para finalizar el inicio de sesión.

```
POST /instagram/login/verification HTTP/1.1
Content-Type: application/json

{
    "appKey": "usuario_empresa-ig",     // Correspondiente al appKey definido anteriormente en la base de datos.
    "code": "123456"                    // Correspondiente al código recibido por correo
}
```

Lo que arrojará una respuesta como la siguiente

```json
{
    "appName": "Instagram",
    "appKey": "usuario_empresa-ig",
    "type": "verification",
    "message": "Se envió la petición correctamente. Revisa los logs."
}
```

4. Lo que significará que se recibieron correctamente los datos, sin embargo se sugiere revisar los logs para saber si el inicio se completó satisfactoriamente.


### 2.2. Facebook

> Es importante destacar que este software no es compatible con cuentas personales de Facebook, solo con Páginas de Facebook.

#### Crear página de Facebook

Lo primero es tener una **página** de Facebook, en caso de ya contar con una, se puede omitir esta sección.

1. Se puede crear una nueva en el siguiente [este enlace](https://www.facebook.com/pages/create/). 
2. Rellenar el formulario y darle a "Crear página".
 
![image](https://user-images.githubusercontent.com/16374322/100555164-6fe9f500-3278-11eb-988a-076959cd5ef8.png)


#### Crear aplicación de Facebook

Además de una página, se necesita tener una **aplicación** de Facebook. En caso de que ya la tengas se puede omitir esta sección.

1. Para crear una aplicación de Facebook hay que dirigirse a [este enlace](https://developers.facebook.com/quickstarts/). 
 
 ![image](https://user-images.githubusercontent.com/16374322/100554869-90b14b00-3276-11eb-9057-16f0194e7e71.png)

 2. Una vez cargue la página, se selecciona la opción de **"configuración básica"** que aparece en inferior.

![image](https://user-images.githubusercontent.com/16374322/100554897-d40bb980-3276-11eb-9022-c8ca5f7e070e.png)

 4. Escoger la opción **"Administrar integraciones comerciales"**, ya que es la que tiene el aspecto "cuentas de Messenger". luego presionar el botón "Continuar".
 ![image](https://user-images.githubusercontent.com/16374322/100555027-c0ad1e00-3277-11eb-8722-79f2d1a31458.png)

 5.  El siguiente paso corresponde a completar el formulario con los datos que se piden, según corresponda, para posteriormente darle al botón "Crear app".
 6. Finalmente hay que completar la verificación que se pida, generalmente es recuadro de reCAPTCHA para validar que no eres un robot.
 
#### Configurar aplicación

1. Una vez teniendo creada la página y la aplicación, hay que navegar a [este enlace](https://developers.facebook.com/apps) y seleccionar la aplicación que queremos usar.
2. Esto nos llevara al *dashboard* de la aplicación, y al bajar un poco encontraremos la sección **"Agrega productos a tu app"**.

![image](https://user-images.githubusercontent.com/16374322/100555437-416d1980-327a-11eb-98bf-fee7d828fee3.png)

3. En esta sección buscaremos **"Messenger"** y le daremos al botón "Configurar".
4. En la sección de configuración, encontraremos un apartado que dice **"Tokens de acceso"** y hay que pinchar el botón "Agregar o eliminar páginas".

![image](https://user-images.githubusercontent.com/16374322/100555527-e7b91f00-327a-11eb-993d-62629b8123ae.png)

5. El botón abrirá una ventana emergente, que nos guiará en el proceso para vincular alguna de nuestras páginas con la aplicación, para eso se selecciona la página deseada y se le conceden los permisos a la aplicación.

![image](https://user-images.githubusercontent.com/16374322/100555618-58603b80-327b-11eb-8b82-c6fe19c31aff.png)

6. Ahora en la sección "Tokens de acceso" debería aparecer la página vinculada. El primer dato importante a extraer es el **ID de la página**, que está ubicado justo debajo del nombre. En el caso de la imagen, el nombre es "Página de Ejemplo" y el ID es `108388123456789`.

![image](https://user-images.githubusercontent.com/16374322/100555683-f9e78d00-327b-11eb-956c-334cedb501e4.png)

7. Luego de obtener el ID de la página, se debe obtener el **token de acceso de la página**, para eso se debe pinchar el botón "Generar token".
8. Al abrirse el dialogo, se pueden ver los primeros caracteres del token seguidos de unos asteriscos que ocultan la información. Para ver el token completo y poder copiarlo, debemos marcar la casilla "Acepto".

![image](https://user-images.githubusercontent.com/16374322/100555796-b4778f80-327c-11eb-9b6b-915a2f9fb10e.png)

#### Configuración de la base de datos

| Columna | Valor |
|--|--|
| `app_name` | `Facebook` |
| `app_data1` | `appKey`. ID de la página + `-fb`. Ej: `108388123456789-fb` |
| `app_data2` | ID de la página. Ej: `108388123456789` |
| `app_data3` | Token de acceso de la página. Ej: `3gja70#2df` |
| `app_data4` | Token de verificación. Ej: `inkaapp` |
| `app_data5` | Secreto de la app. Ej: `3g12866d3dbe6792ae02df2d0ja` |
| `app_data7` | IP o host del Core. Ej: `123.15.12.143` |

 
 ## 3. Problemas que pueden ocurrir 
 
 #### 3.1 Instagram
 
 1. Puede ocurrir que Instagram bloquee los intentos se login, esto es cuando aparece un mensaje como éste:

 `[ERROr] [Instagram - @aware_callmanager] Error al inicializar: IgCheckpointError: POST /api/v1/accounts/login/ - 400 Bad Request; challenge_required`

 Se debe abrir sesion en un telefono u otro navegador para resolverlo, ya que enviará un codigo a la cuenta de correo que esta inscrito dicha cuenta.

 #### 3.2 Facebook
