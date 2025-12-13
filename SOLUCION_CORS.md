# Solución al Problema de la Foto de Perfil

## Problema Identificado
```
Access to image has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

Firebase Storage está bloqueando las peticiones desde el WebView de Capacitor debido a restricciones CORS.

## Solución

Debes configurar CORS en tu bucket de Firebase Storage usando Google Cloud Console o gsutil:

### Opción 1: Usar gsutil (Recomendado)

1. Instala Google Cloud SDK si no lo tienes:
   ```bash
   brew install google-cloud-sdk
   ```

2. Autentica con tu cuenta de Google:
   ```bash
   gcloud auth login
   ```

3. Aplica la configuración CORS:
   ```bash
   gsutil cors set cors.json gs://llevame-app-24edf.firebasestorage.app
   ```

### Opción 2: Usar Firebase Console

1. Ve a https://console.firebase.google.com
2. Selecciona tu proyecto "llevame-app-24edf"
3. Ve a Storage
4. Haz clic en "Rules"
5. Cambia las reglas a:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /profiles/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

### Opción 3: Hacer las imágenes públicas (Más simple pero menos seguro)

En Firebase Console > Storage > Files:
1. Navega a la carpeta "profiles"
2. Haz clic derecho en un archivo
3. Selecciona "Get download URL" o "Make public"

## Por qué esto resuelve el problema

El WebView de Capacitor hace peticiones desde el origen `https://localhost`, pero Firebase Storage no tiene configurado CORS para permitir este origen. Al configurar CORS con `"origin": ["*"]`, permitimos peticiones desde cualquier origen, incluyendo `https://localhost`.

## Archivo cors.json

Ya he creado el archivo `cors.json` en tu proyecto con la configuración correcta.
