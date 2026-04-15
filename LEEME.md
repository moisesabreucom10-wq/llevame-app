# 🚗 LLEVAME — App Móvil (Conductor + Pasajero)

> Aplicación de transporte tipo Uber para Venezuela, construida con **React + Capacitor + Firebase**.

---

## 📋 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 18 + Vite |
| **Móvil** | Capacitor 7 (Android) |
| **Backend** | Firebase (Auth, Firestore, Storage, FCM) |
| **Mapas** | Google Maps JavaScript API |
| **Estilos** | Tailwind CSS |
| **Estado** | React Context API |

---

## 🏗️ Estructura del Proyecto

```
llevame-app/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx         # Login con Email + Google Sign-In
│   │   │   └── ProfileSetup.jsx      # Selección de rol (pasajero/conductor)
│   │   ├── driver/
│   │   │   ├── DriverHome.jsx        # Dashboard del conductor
│   │   │   └── VerificationFlow.jsx  # Wizard KYC de 3 pasos
│   │   └── shared/
│   │       ├── Profile.jsx           # Perfil con identidad, vehículo, seguridad
│   │       ├── Map.jsx               # Mapa interactivo
│   │       ├── Chat.jsx              # Chat conductor-pasajero
│   │       └── SecureImage.jsx       # Imagen con fallback
│   ├── context/
│   │   └── AuthContext.jsx           # Estado global de autenticación
│   ├── services/
│   │   ├── firebase.js               # Configuración Firebase
│   │   └── maps.js                   # Servicio de Google Maps
│   └── App.jsx                       # Router principal
├── android/                          # Proyecto Android nativo
│   └── app/
│       ├── build.gradle              # Deps: Credential Manager, Firebase
│       ├── google-services.json      # Config Firebase (OAuth, API keys)
│       └── src/main/java/com/llevame/app/
│           ├── MainActivity.java
│           └── plugins/
│               └── NavigationPlugin.java  # Stub → abre Google Maps via Intent
├── capacitor.config.json
├── package.json
└── vite.config.js
```

---

## 🔐 Autenticación

### Email + Contraseña
- Registro, login, y recuperación de contraseña vía Firebase Auth.

### Google Sign-In (Nativo Android)
- Plugin: `@capacitor-firebase/authentication` v7.5.0
- Flujo: `FirebaseAuthentication.signInWithGoogle()` → obtiene `idToken` → `signInWithCredential()` en Firebase Web SDK
- **Requisitos Android (API 34+):**
  ```gradle
  // build.gradle — Credential Manager (obligatorio)
  implementation 'androidx.credentials:credentials:1.5.0-rc01'
  implementation 'androidx.credentials:credentials-play-services-auth:1.5.0-rc01'
  implementation 'com.google.android.libraries.identity.googleid:googleid:1.1.1'
  ```
- **API Key Android** debe tener `identitytoolkit.googleapis.com` habilitado en restricciones

### Configuración OAuth
| Tipo | Client ID |
|---|---|
| Android (type 1) | `634861898408-f20tq5iagpdv8p5tn6me85turs760n1l.apps.googleusercontent.com` |
| Web (type 3) | `634861898408-pql24rj4dj9k8vl8lbgnt3ltgq0b423n.apps.googleusercontent.com` |

- SHA-1 debug: `60:D6:C3:03:C6:3F:95:B2:D8:B0:F4:EC:C0:08:E9:FE:31:91:A0:CD`
- `strings.xml` → `server_client_id` = Web client ID (type 3)

---

## 👤 Perfil de Usuario

### Campos de Identidad
| Campo | Tipo | Validación |
|---|---|---|
| `firstName` | string | Obligatorio |
| `lastName` | string | Obligatorio |
| `alias` | string | Único. `@usuario` — 3-20 chars, solo letras/números/_ |
| `cedula` | string | Único. Formato `V-12345678` o `E-12345678` |
| `cedulaDisplay` | string | Formato visual: `V-12.345.678` |

### Unicidad de Cédula y Alias
Se usan dos colecciones índice en Firestore:

```
cedulas_index/{V-12345678}  →  { uid: "xxx", registeredAt: Timestamp }
aliases_index/{juancho23}   →  { uid: "xxx" }
```

**Flujo de validación:**
1. Usuario ingresa cédula → normalizar → buscar en `cedulas_index`
2. Si existe y `uid !== currentUser.uid` → **"Esta cédula ya está registrada"**
3. Si no existe o es del mismo usuario → guardar

---

## ✅ Verificación KYC (Conductores)

### Flujo en la App (`VerificationFlow.jsx`)
Wizard de 3 pasos:

1. **Paso 1 — Identidad**: Selfie con cédula + cédula frente + cédula reverso
2. **Paso 2 — Vehículo**: Datos (marca, modelo, año, placa, tipo) + carnet circulación + póliza seguro
3. **Paso 3 — Confirmación**: Resumen visual → envía a Firestore

### Datos en Firestore
```
conductores_verificaciones/{uid} = {
  status: 'pending' | 'approved' | 'rejected',
  documentos_kyc: { selfie, cedula_frente, cedula_reverso },
  documentos_vehiculo: { carnet_circulacion, poliza_seguro },
  vehiculo: { marca, modelo, anio, placa, tipo },
  submittedAt: Timestamp
}
```

### Estados del Conductor
| Estado | Comportamiento |
|---|---|
| Sin verificación | Ve botón "Verificar Cuenta" en perfil |
| `pending` | Banner amarillo en DriverHome, funciones bloqueadas |
| `approved` | Acceso completo, puede recibir viajes |
| `rejected` | Banner rojo con motivo del rechazo |

---

## 🧩 NavigationPlugin (Stub)

El plugin original dependía del **Google Navigation SDK** (privado, requiere licencia especial). Se reemplazó por un **stub** que:
- `initialize()` → siempre resuelve con `status: "ready"`
- `startNavigation({lat, lng})` → abre **Google Maps** via `Intent` con `google.navigation:q=lat,lng&mode=d`
- `stopNavigation()` → no-op
- `setWebViewTransparent()` → no-op

---

## 🚀 Comandos

```bash
# Desarrollo web
npm run dev

# Build
npm run build

# Sync a Android
npx cap sync android

# Build APK debug
cd android && ./gradlew assembleDebug

# APK resultante
android/app/build/outputs/apk/debug/app-debug.apk

# Instalar en emulador
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Variables de entorno necesarias
```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

---

## 🔧 Problemas Conocidos y Soluciones

### "No credentials available" en Google Sign-In
**Causa:** Faltan dependencias de Credential Manager en API 34+
**Solución:** Añadir las 3 dependencias en `android/app/build.gradle`

### "SignInWithIdp are blocked"
**Causa:** La API key de Android tiene restricciones que no incluyen `identitytoolkit.googleapis.com`
**Solución:** En Google Cloud Console → Credentials → Android key → añadir `identitytoolkit.googleapis.com`

### Imágenes de documentos no se ven en admin
**Causa:** Tailwind `aspect-ratio` no genera CSS en build de producción
**Solución:** Usar inline styles con `height` fijo + `object-fit: contain`

### Build de Android falla con "cannot find symbol R.id"
**Causa:** NavigationPlugin referenciaba IDs de resources inexistentes
**Solución:** Reescribir como stub sin dependencia del Navigation SDK

---

## 📊 Firebase Project

- **Project ID:** `llevame-app-24edf`
- **Project Number:** `634861898408`
- **Auth:** Email/Password + Google + Phone
- **Firestore:** `llevame_users`, `conductores_verificaciones`, `cedulas_index`, `aliases_index`, `llevame_trips`, `llevame_feedback`
- **Storage:** Fotos de perfil, documentos KYC

---

## 📝 Historial de Cambios

### 14 Abr 2026
- ✅ Perfil de identidad: nombre, apellido, alias único, cédula única
- ✅ Google Sign-In: Credential Manager deps + API key fix
- ✅ NavigationPlugin: reescrito como stub (abre Google Maps)
- ✅ VerificationFlow: wizard KYC de 3 pasos
- ✅ Profile.jsx: sección "Información Personal" con validaciones
- ✅ API Key Android: añadido `identitytoolkit.googleapis.com` + Firebase APIs

### Sesiones anteriores
- ✅ App base con login, mapa, chat, perfil
- ✅ Roles: pasajero y conductor
- ✅ DriverHome con banner de verificación
- ✅ Push Notifications vía FCM
- ✅ Geolocalización en background
