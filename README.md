# Inka Middleware

Software encargado de conectar distintas redes sociales, como Instagram y Facebook con el fin de unificarlas en un mismo chat de servicio al cliente en el proyecto core de Inka.

## 1. Instalación

### 1.1. Requisitos
- Node 12 o superior
- `npm`
- `ffmpeg`

### 1.2. Variables de entorno
El archivo de configuración se encuentra en la raíz del proyecto con el nombre de `.env`. Acá un ejemplo:
```
CORE_PORT=9090
LOG_LEVEL=info

PORT=3000
PRIVATE_KEY_PATH=/etc/ssl/demo.host.cl/privkey.pem
CERTIFICATE_PATH=/etc/ssl/demo.host.cl/cert.pem

FACEBOOK_VALUE=Facebook
FACEBOOK_PORT=9021

INSTAGRAM_VALUE=Instagram
INSTAGRAM_PORT=9022
INSTAGRAM_SEC_INTERVAL=30

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
| `PRIVATE_KEY_PATH`       | Ubicación de la llave privada del certificado SSL.                                                                        |
| `CERTIFICATE_PATH`       | Ubicación del certificado SLL.                                                                                            |
| `FACEBOOK_VALUE`         | Valor en la tabla `inka_app` de las aplicaciones Facebook. Por defecto es `Facebook`.                                     |
| `FACEBOOK_PORT`          | Puerto donde correrá el servido socket TCP para recibir mensajes de Facebook.                                             |
| `INSTAGRAM_VALUE`        | Valor en la tabla `inka_app` de las aplicaciones Instagram. Por defecto es `Instagram`.                                   |
| `INSTAGRAM_PORT`         | Puerto donde correrá el servido socket TCP para recibir mensajes de Instagram.                                            |
| `INSTAGRAM_SEC_INTERVAL` | Intervalo en segundos que define cada cuanto se procesarán las "solicitudes de mensajes" en Instagram.                    |
| `PGUSER`                 | Usuario de la base de datos PostgreSQL.                                                                                   |
| `PGHOST`                 | IP o host de la base de datos PostgreSQL.                                                                                 |
| `PGPASSWORD`             | Contraseña de la base de datos PostgreSQL.                                                                                |
| `PGDATABASE`             | Nombre de la base de datos PostgreSQL.                                                                                    |
| `PGPORT`                 | Puerto de la base de datos PostgreSQL.                                                                                    |

### 1.3. Instrucciones

1. Instalar librerías y dependencias
```bash
npm install
```

3. Correr el servicio
```bash
npm start
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

 
