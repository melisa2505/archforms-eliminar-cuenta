# Eliminación de cuenta de ArchForms

Página **funcional**, conectada al backend que utiliza la aplicación.

- Sitio: https://melisa2505.github.io/archforms-eliminar-cuenta/
- Contacto: celis.ai.dev@gmail.com

## Funcionamiento

1. Autenticación con correo y contraseña de la cuenta ArchForms mediante HTTPS.
2. Confirmación explícita escribiendo `ELIMINAR`.
3. Inicio idempotente del borrado mediante `begin_account_deletion_v1`.
4. Eliminación de objetos reales mediante la API de Supabase Storage, en lotes.
5. Borrado en cascada de la identidad y datos mediante `delete_my_account_v1`.

Las funciones verifican `auth.uid()` en el servidor; el navegador no decide qué
usuario se borra. No se utilizan claves de administrador. `config.json` contiene
únicamente la URL y la clave **publishable**, diseñadas para ser públicas y usadas
por la aplicación. Las reglas de autorización siguen en Supabase.

La contraseña se retira del campo al enviarla. Las credenciales y tokens no se
guardan en cookies, localStorage o sessionStorage. La sesión vive solo en memoria,
se renueva durante borrados largos y se descarta al cancelar o terminar. Refrescar
la página requiere volver a iniciar sesión. No hay scripts externos ni analítica.
Si falla una operación, se muestra el error y es posible reintentar. Iniciar el
borrado bloquea nuevas subidas de esa cuenta; cerrar la página no cancela el
proceso iniciado. El correo de soporte es una vía alternativa real de solicitud,
pero requiere atención humana y verificación del titular.

La página no puede limpiar datos que la app haya guardado en otro dispositivo u
origen, ni retirar PDF exportados o compartidos. Esa limitación se informa antes
de confirmar y en la política de privacidad.

## Publicación

GitHub Pages publica `main`, carpeta raíz. El archivo `.nojekyll` evita Jekyll.
Usar la URL del sitio en el campo **Eliminación de cuenta** de Play Console.
No alojar esta página bajo un dominio que no controles y mantener protegidas las
cuentas con acceso de escritura al repositorio.

## Backend requerido

Se utiliza la migración ya aplicada
`20261119000300_account_deletion.sql` de ArchForms. No hace falta otro servidor,
clave privilegiada ni desplegar una función nueva.
