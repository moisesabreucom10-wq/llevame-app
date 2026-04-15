package com.llevame.app.plugins;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * NavigationPlugin — Stub que delega la navegación giro a giro
 * a la app nativa de Google Maps via Intent.
 *
 * No depende del Navigation SDK privado de Google.
 * La llamada JS es idéntica a la interfaz original.
 */
@CapacitorPlugin(name = "NavigationSDK")
public class NavigationPlugin extends Plugin {

    private static final String TAG = "NavigationPlugin";
    private boolean isNavigatingState = false;

    /** Inicialización — siempre exitosa en el stub. */
    @PluginMethod
    public void initialize(PluginCall call) {
        Log.i(TAG, "NavigationPlugin stub: initialize()");
        JSObject result = new JSObject();
        result.put("status", "ready");
        call.resolve(result);
    }

    /**
     * Inicia navegación lanzando Google Maps con modo driving.
     * Parámetros JS: { lat: double, lng: double, title?: string }
     */
    @PluginMethod
    public void startNavigation(PluginCall call) {
        double lat   = call.getDouble("lat", 0.0);
        double lng   = call.getDouble("lng", 0.0);
        String title = call.getString("title", "Destino");

        if (lat == 0.0 && lng == 0.0) {
            call.reject("Coordenadas de destino inválidas");
            return;
        }

        try {
            // URI de Google Maps — modo driving, con indicaciones turn-by-turn
            String uriStr = "google.navigation:q=" + lat + "," + lng
                    + "&mode=d";
            Uri gmmIntentUri = Uri.parse(uriStr);
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
            mapIntent.setPackage("com.google.android.apps.maps");

            if (mapIntent.resolveActivity(getActivity().getPackageManager()) != null) {
                getActivity().startActivity(mapIntent);
            } else {
                // Fallback: abrir en el browser si Maps no está instalado
                String browserUri = "https://www.google.com/maps/dir/?api=1"
                        + "&destination=" + lat + "," + lng
                        + "&travelmode=driving";
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(browserUri));
                getActivity().startActivity(browserIntent);
            }

            isNavigatingState = true;

            JSObject result = new JSObject();
            result.put("status", "navigating");
            result.put("lat", lat);
            result.put("lng", lng);
            call.resolve(result);

            Log.i(TAG, "Navigation started → " + lat + ", " + lng);

        } catch (Exception e) {
            Log.e(TAG, "startNavigation error", e);
            call.reject("Error al iniciar navegación: " + e.getMessage());
        }
    }

    /** Detiene la navegación (en el stub solo actualiza el estado interno). */
    @PluginMethod
    public void stopNavigation(PluginCall call) {
        isNavigatingState = false;
        Log.i(TAG, "NavigationPlugin stub: stopNavigation()");
        JSObject result = new JSObject();
        result.put("status", "stopped");
        call.resolve(result);
    }

    /** Devuelve el estado actual de navegación. */
    @PluginMethod
    public void isNavigating(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isNavigating", isNavigatingState);
        result.put("termsAccepted", true);
        call.resolve(result);
    }

    /**
     * setWebViewTransparent — no-op en el stub.
     * En el stub no hay vista nativa de navegación detrás del WebView.
     */
    @PluginMethod
    public void setWebViewTransparent(PluginCall call) {
        boolean transparent = call.getBoolean("transparent", false);
        JSObject result = new JSObject();
        result.put("transparent", transparent);
        call.resolve(result);
    }
}
