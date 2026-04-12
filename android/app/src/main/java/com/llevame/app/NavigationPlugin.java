package com.llevame.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * NavigationPlugin — Capacitor bridge para el Google Navigation SDK.
 *
 * Expone métodos JavaScript → nativo y emite eventos nativo → JavaScript.
 * La lógica real vive en NavigationPluginImpl para mantener este archivo limpio.
 */
@CapacitorPlugin(name = "NavigationPlugin")
public class NavigationPlugin extends Plugin {

    private NavigationPluginImpl impl;

    @Override
    public void load() {
        impl = new NavigationPluginImpl(getActivity(), getBridge(), this);
    }

    // ─────────────────────────────────────────────
    // Ciclo de vida del mapa
    // ─────────────────────────────────────────────

    /**
     * Inicializa la NavigationView nativa detrás del WebView.
     * options: { x, y, width, height } en píxeles — bounds del área del mapa en React.
     */
    @PluginMethod
    public void initMap(PluginCall call) {
        impl.initMap(call);
    }

    /**
     * Redimensiona/reposiciona la NavigationView cuando la UI React cambia.
     * bounds: { x, y, width, height }
     */
    @PluginMethod
    public void updateMapBounds(PluginCall call) {
        impl.updateMapBounds(call);
    }

    /**
     * Destruye la NavigationView y libera todos los recursos.
     */
    @PluginMethod
    public void destroyMap(PluginCall call) {
        impl.destroyMap(call);
    }

    // ─────────────────────────────────────────────
    // Cámara
    // ─────────────────────────────────────────────

    /**
     * Mueve la cámara suavemente.
     * options: { lat, lng, zoom, bearing, tilt }
     */
    @PluginMethod
    public void animateCamera(PluginCall call) {
        impl.animateCamera(call);
    }

    /**
     * Cambia el tipo de mapa.
     * options: { mapType: 'normal' | 'satellite' | 'terrain' | 'hybrid' }
     */
    @PluginMethod
    public void setMapType(PluginCall call) {
        impl.setMapType(call);
    }

    // ─────────────────────────────────────────────
    // Marcadores
    // ─────────────────────────────────────────────

    /**
     * Agrega o actualiza un marcador.
     * options: { id, lat, lng, title, svgBase64, width, height, anchorX, anchorY }
     */
    @PluginMethod
    public void addMarker(PluginCall call) {
        impl.addMarker(call);
    }

    /**
     * Elimina un marcador por ID.
     * options: { id }
     */
    @PluginMethod
    public void removeMarker(PluginCall call) {
        impl.removeMarker(call);
    }

    /**
     * Elimina todos los marcadores del mapa.
     */
    @PluginMethod
    public void clearMarkers(PluginCall call) {
        impl.clearMarkers(call);
    }

    // ─────────────────────────────────────────────
    // Navegación
    // ─────────────────────────────────────────────

    /**
     * Establece el destino y calcula la ruta.
     * options: { waypoints: [{ lat, lng, title }] }
     */
    @PluginMethod
    public void setRoute(PluginCall call) {
        impl.setRoute(call);
    }

    /**
     * Activa la navegación turn-by-turn con voz.
     */
    @PluginMethod
    public void startNavigation(PluginCall call) {
        impl.startNavigation(call);
    }

    /**
     * Detiene la navegación, vuelve a modo mapa estático.
     */
    @PluginMethod
    public void stopNavigation(PluginCall call) {
        impl.stopNavigation(call);
    }

    /**
     * Silencia / activa la voz de la navegación.
     * options: { muted: boolean }
     */
    @PluginMethod
    public void setAudioGuidance(PluginCall call) {
        impl.setAudioGuidance(call);
    }

    // ─────────────────────────────────────────────
    // Helpers para emitir eventos a JavaScript
    // ─────────────────────────────────────────────

    public void emitLocationUpdate(double lat, double lng, float speed, float bearing) {
        JSObject data = new JSObject();
        data.put("lat", lat);
        data.put("lng", lng);
        data.put("speed", speed);
        data.put("bearing", bearing);
        notifyListeners("onLocationUpdate", data);
    }

    public void emitArrival(String waypointTitle) {
        JSObject data = new JSObject();
        data.put("waypoint", waypointTitle);
        notifyListeners("onArrival", data);
    }

    public void emitReroute() {
        notifyListeners("onReroute", new JSObject());
    }

    public void emitNavigationEvent(String event, JSObject extra) {
        JSObject data = new JSObject();
        data.put("event", event);
        if (extra != null) {
            data.put("data", extra);
        }
        notifyListeners("onNavigationEvent", data);
    }

    public void emitSpeedAlert(float currentSpeed, float speedLimit) {
        JSObject data = new JSObject();
        data.put("currentSpeed", currentSpeed);
        data.put("speedLimit", speedLimit);
        data.put("isOver", currentSpeed > speedLimit);
        notifyListeners("onSpeedAlert", data);
    }

    public void emitCameraMove(double lat, double lng) {
        JSObject data = new JSObject();
        data.put("lat", lat);
        data.put("lng", lng);
        notifyListeners("onCameraMove", data);
    }
}
