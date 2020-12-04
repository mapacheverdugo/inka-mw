# Inka Middleware

Software encargado de conectar distintas redes sociales, como Facebook, Instagram y Telegram con el fin de unificarlas en un mismo chat de servicio al cliente en el proyecto core de Inka.

## 2. Configuración

### 2.1. Telegram

#### Configuración de variables de entorno

1. Inicia sesión con tu cuenta de Telegram [en este enlace](https://my.telegram.org/).
2.  Navega hacia  ["API development tools"](https://my.telegram.org/apps)  y rellena el formulario.
3. Obtendrás los parámetros  **`api_id`**  y  **`api_hash`**  requeridos, que corresponden a los valores de `TELEGRAM_API_ID` y `TELEGRAM_API_HASH` respectivos en las variables de entorno.

![image](https://user-images.githubusercontent.com/16374322/100661965-0549bf80-3333-11eb-9526-58ae72c5ca4b.png)


Un ejemplo de como deben quedar las variables de entorno en el archivo `.env`:
```
TELEGRAM_API_ID=1234567
TELEGRAM_API_HASH=fcab3735bc4c7f130e1351d55726
```

> Debes reemplazar con tus propios valores de `api_id` y `api_hash`

#### Configuración de la base de datos

| Columna | Valor |
|--|--|
| `app_name` | `Telegram` |
| `app_data1` | Número de teléfono. Ej: `56987654321` |

### 2.2. Instagram

#### Configuración de la base de datos

| Columna | Valor |
|--|--|
| `app_name` | `Instagram` |
| `app_data1` | Nombre de usuario sin `@`. Ej: `usuario_empresa` |
| `app_data2` | Contraseña de inicio de sesión. Ej: `3gja70#2df` |


### 2.3. Facebook

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

6. Ahora en la sección "Tokens de acceso" debería aparecer la página vinculada. El primer dato importante a extraer es el **ID de la página**, que está ubicado justo debajo del nombre. En el caso de la imagen, el nombre es "Página de Ejemplo" y el ID es  `108388123456789`.

![image](https://user-images.githubusercontent.com/16374322/100555683-f9e78d00-327b-11eb-956c-334cedb501e4.png)

7. Luego de obtener el ID de la página, se debe obtener el **token de acceso de la página**, para eso se debe pinchar el botón "Generar token".
8. Al abrirse el dialogo, se pueden ver los primeros caracteres del token seguidos de unos asteriscos que ocultan la información. Para ver el token completo y poder copiarlo, debemos marcar la casilla "Acepto".

![image](https://user-images.githubusercontent.com/16374322/100555796-b4778f80-327c-11eb-9b6b-915a2f9fb10e.png)

 