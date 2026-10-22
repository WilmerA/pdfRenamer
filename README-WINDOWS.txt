PDF RENAMER PARA WINDOWS
========================

PDF Renamer clasifica PDFs de documentos ANM usando OpenRouter y mueve los archivos a carpetas de salida. El usuario debe configurar su propia API key de OpenRouter.

PRIMERA EJECUCIÓN
-----------------

1. Ejecuta PdfRenamer.exe desde una consola o con doble clic.
2. En el primer inicio se crea config.env en la misma carpeta que PdfRenamer.exe.
3. Si la aplicación indica que falta la API key, abre config.env y agrega tu clave:

   API_OPEN_ROUTER=tu_clave_personal

4. Guarda el archivo y vuelve a ejecutar PdfRenamer.exe.

La clave queda almacenada como texto junto al ejecutable. No compartas config.env ni incluyas una clave real al distribuir la aplicación. Descomprime el paquete en una carpeta donde tu usuario tenga permiso de escritura; evita C:\Program Files.

CARPETAS DE TRABAJO
-------------------

Por defecto se crean en la carpeta workspace, junto al ejecutable:

workspace\
|-- input\       Coloca aquí los PDFs que quieres procesar
|-- processed\   PDFs procesados, organizados por contrato
|-- review\      PDFs pendientes o con error, organizados por contrato

La aplicación busca PDFs directamente dentro de input; no busca dentro de subcarpetas. Los archivos se mueven, no se copian. Los procesados se renombran como tipo_contrato_fecha.pdf; los que van a revisión conservan su nombre original.

CONSULTAR LOS LOGS
------------------

Cada ejecución crea un archivo con fecha y hora dentro de logs, junto a PdfRenamer.exe (no dentro de workspace). Los mensajes que aparecen en la consola también se guardan allí, por lo que puedes revisar el resultado después de cerrar la ventana. El log no incluye el texto completo de los PDFs y la API key se redacta si apareciera en un mensaje.

Puedes elegir otro workspace desde la consola:

   PdfRenamer.exe --workspace "D:\Documentos\PdfRenamer"

En esa ubicación se crean input, processed y review. Una ruta relativa se resuelve desde el directorio actual de la consola.

PRIVACIDAD Y USO DE LA API
--------------------------

El texto extraído de cada PDF se envía a OpenRouter para su análisis. La API key y el uso de la API corresponden al usuario. Considera las políticas de privacidad y costos del proveedor antes de procesar documentos.

COMPILACIÓN PARA WINDOWS x64
----------------------------

Con Bun instalado en la máquina de desarrollo, ejecuta:

   bun install
   bun run build:windows

El resultado queda en release\PdfRenamer.exe, junto con este archivo como LEEME.txt. config.env se crea al primer inicio y no se incluye en el ejecutable. No copies PDFs al directorio de distribución.
