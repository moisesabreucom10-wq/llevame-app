#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup_nav_sdk.sh
# Configura las credenciales del Navigation SDK for Android.
#
# USO:
#   ./setup_nav_sdk.sh <ruta-a-service-account.json>
#
# EJEMPLO:
#   ./setup_nav_sdk.sh ~/Downloads/mi-proyecto-sa-key.json
#
# ¿Qué hace?
#   1. Usa el archivo de Service Account para obtener un token OAuth2 de Google
#   2. Escribe NAVIGATION_SDK_TOKEN y sdk.dir en local.properties
#   3. El token dura ~1 hora. Volver a ejecutar si Gradle da error 401.
#
# ALTERNATIVA (si ya tienes gcloud instalado):
#   gcloud auth application-default login
#   TOKEN=$(gcloud auth application-default print-access-token)
#   echo "NAVIGATION_SDK_TOKEN=$TOKEN" >> local.properties
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_PROPS="$SCRIPT_DIR/local.properties"

# ── 1. Validar argumento ──────────────────────────────────────────────────────
if [ -z "$1" ]; then
    # Sin argumento: intentar con gcloud directamente
    if command -v gcloud &>/dev/null; then
        echo "▶ No se pasó service account, usando gcloud..."
        TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null || gcloud auth print-access-token)
    else
        echo ""
        echo "ERROR: Debes proporcionar uno de los siguientes:"
        echo "  a) Ruta al archivo JSON de Service Account:"
        echo "     ./setup_nav_sdk.sh ~/Downloads/service-account-key.json"
        echo ""
        echo "  b) Tener gcloud instalado y autenticado:"
        echo "     gcloud auth application-default login"
        echo "     ./setup_nav_sdk.sh"
        echo ""
        echo "  c) Pegar el token manualmente en android/local.properties:"
        echo "     NAVIGATION_SDK_TOKEN=ya29.xxxxx"
        echo ""
        exit 1
    fi
else
    SA_KEY_FILE="$1"

    if [ ! -f "$SA_KEY_FILE" ]; then
        echo "ERROR: No se encontró el archivo: $SA_KEY_FILE"
        exit 1
    fi

    # ── 2. Obtener token OAuth2 desde Service Account ─────────────────────────
    echo "▶ Obteniendo token OAuth2 desde Service Account..."

    # Requiere: pip install google-auth requests  (o usar python3 con las libs)
    TOKEN=$(python3 - <<EOF
import json, time, base64, hashlib, hmac, urllib.request, urllib.parse

with open("$SA_KEY_FILE") as f:
    sa = json.load(f)

# Construir JWT para Google OAuth2
header = base64.urlsafe_b64encode(b'{"alg":"RS256","typ":"JWT"}').rstrip(b'=').decode()
now = int(time.time())
payload = {
    "iss": sa["client_email"],
    "scope": "https://www.googleapis.com/auth/cloud-platform",
    "aud": "https://oauth2.googleapis.com/token",
    "exp": now + 3600,
    "iat": now
}
payload_b64 = base64.urlsafe_b64encode(
    json.dumps(payload).encode()
).rstrip(b'=').decode()
signing_input = f"{header}.{payload_b64}".encode()

# Firmar con la clave privada del SA
try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.backends import default_backend

    private_key = serialization.load_pem_private_key(
        sa["private_key"].encode(),
        password=None,
        backend=default_backend()
    )
    signature = private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())
except ImportError:
    print("ERROR: Instala cryptography: pip3 install cryptography", flush=True)
    exit(1)

sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b'=').decode()
jwt = f"{header}.{payload_b64}.{sig_b64}"

# Intercambiar JWT por access token
data = urllib.parse.urlencode({
    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
    "assertion": jwt
}).encode()

req = urllib.request.Request(
    "https://oauth2.googleapis.com/token",
    data=data,
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())

print(result["access_token"])
EOF
    )
fi

if [ -z "$TOKEN" ]; then
    echo "ERROR: No se pudo obtener el token OAuth2."
    exit 1
fi

# ── 3. Detectar sdk.dir ───────────────────────────────────────────────────────
SDK_DIR=""
if [ -f "$LOCAL_PROPS" ]; then
    SDK_DIR=$(grep "^sdk.dir=" "$LOCAL_PROPS" 2>/dev/null | cut -d'=' -f2-)
fi

if [ -z "$SDK_DIR" ]; then
    # Intentar detectar automáticamente
    if [ -d "$HOME/Library/Android/sdk" ]; then
        SDK_DIR="$HOME/Library/Android/sdk"          # macOS
    elif [ -d "$HOME/Android/Sdk" ]; then
        SDK_DIR="$HOME/Android/Sdk"                  # Linux
    elif [ -d "/usr/lib/android-sdk" ]; then
        SDK_DIR="/usr/lib/android-sdk"               # Linux sistema
    fi
fi

# ── 4. Escribir local.properties ─────────────────────────────────────────────
echo "▶ Escribiendo local.properties..."

# Preservar líneas existentes que no sean las que vamos a sobreescribir
if [ -f "$LOCAL_PROPS" ]; then
    EXISTING=$(grep -v "^NAVIGATION_SDK_TOKEN=" "$LOCAL_PROPS" | grep -v "^sdk.dir=" || true)
else
    EXISTING=""
fi

{
    [ -n "$EXISTING" ] && echo "$EXISTING"
    [ -n "$SDK_DIR" ] && echo "sdk.dir=$SDK_DIR"
    echo "NAVIGATION_SDK_TOKEN=$TOKEN"
} > "$LOCAL_PROPS"

echo ""
echo "✅ local.properties actualizado correctamente."
echo "   Token válido por ~60 minutos."
echo ""
echo "▶ Próximo paso: Abre Android Studio y sincroniza Gradle."
echo "   Si el token expira, ejecuta este script de nuevo."
echo ""
