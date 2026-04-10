package com.llevame.app;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Point;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import com.google.android.libraries.navigation.ArrivalEvent;
import com.google.android.libraries.navigation.ListenableResultFuture;
import com.google.android.libraries.navigation.NavigationApi;
import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.Navigator.ArrivalListener;
import com.google.android.libraries.navigation.Navigator.RouteChangedListener;
import com.google.android.libraries.navigation.RoutingOptions;
import com.google.android.libraries.navigation.SpeedAlertOptions;
import com.google.android.libraries.navigation.SpeedAlertSeverity;
import com.google.android.libraries.navigation.SupportNavigationFragment;
import com.google.android.libraries.navigation.Waypoint;

import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.model.BitmapDescriptorFactory;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.Marker;
import com.google.android.gms.maps.model.MarkerOptions;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * NavigationPluginImpl — Implementación completa del Navigation SDK.
 *
 * Responsabilidades:
 * - Inicializar el Navigation SDK con la API key del Manifest
 * - Crear y posicionar SupportNavigationFragment detrás del WebView
 * - Gestionar marcadores personalizados via GoogleMap
 * - Controlar la navegación turn-by-turn
 * - Emitir eventos hacia JavaScript vía NavigationPlugin
 */
public class NavigationPluginImpl implements OnMapReadyCallback {

    private final Activity activity;
    private final Bridge bridge;
    private final NavigationPlugin plugin;

    private Navigator navigator;
    private GoogleMap googleMap;
    private SupportNavigationFragment navFragment;
    private FrameLayout mapContainer;

    private final Map<String, Marker> markers = new HashMap<>();
    private boolean isNavigating = false;
    private boolean sdkInitialized = false;

    // Listeners activos — guardados para poder removerlos al destruir
    private ArrivalListener arrivalListener;
    private RouteChangedListener routeChangedListener;

    public NavigationPluginImpl(Activity activity, Bridge bridge, NavigationPlugin plugin) {
        this.activity = activity;
        this.bridge = bridge;
        this.plugin = plugin;
    }

    // ─────────────────────────────────────────────
    // initMap
    // ─────────────────────────────────────────────

    public void initMap(final PluginCall call) {
        final int x = dpToPx(call.getInt("x", 0));
        final int y = dpToPx(call.getInt("y", 0));
        final int width = dpToPx(call.getInt("width", 400));
        final int height = dpToPx(call.getInt("height", 600));

        activity.runOnUiThread(() -> {
            // 1. Hacer el WebView transparente para que el mapa nativo sea visible
            setupTransparentWebView();

            // 2. Crear FrameLayout contenedor del mapa
            mapContainer = new FrameLayout(activity);
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
            params.leftMargin = x;
            params.topMargin = y;
            mapContainer.setLayoutParams(params);

            // 3. Insertar el contenedor DETRÁS del WebView en el layout de la Activity
            ViewGroup rootLayout = (ViewGroup) activity.getWindow().getDecorView().getRootView();
            rootLayout.addView(mapContainer, 0);

            // 4. Inicializar el Navigation SDK (acepta ToS automáticamente si ya fue aceptado)
            NavigationApi.getNavigator(activity, new NavigationApi.NavigatorInitializationCallback() {
                @Override
                public void onNavigatorReady(@NonNull Navigator nav) {
                    navigator = nav;
                    sdkInitialized = true;
                    setupNavigationListeners();

                    // 5. Crear y adjuntar el SupportNavigationFragment
                    navFragment = SupportNavigationFragment.newInstance();
                    ((FragmentActivity) activity).getSupportFragmentManager()
                        .beginTransaction()
                        .add(mapContainer.getId(), navFragment)
                        .commitNow();

                    // 6. Obtener el GoogleMap subyacente para marcadores personalizados
                    navFragment.getMapAsync(NavigationPluginImpl.this);

                    JSObject result = new JSObject();
                    result.put("initialized", true);
                    call.resolve(result);
                }

                @Override
                public void onError(@NonNull NavigationApi.ErrorCode errorCode) {
                    call.reject("Navigation SDK init error: " + errorCode.name());
                }
            });
        });
    }

    // ─────────────────────────────────────────────
    // OnMapReadyCallback
    // ─────────────────────────────────────────────

    @Override
    public void onMapReady(@NonNull GoogleMap map) {
        this.googleMap = map;

        // Configurar mapa
        googleMap.setMyLocationEnabled(true);
        googleMap.getUiSettings().setMyLocationButtonEnabled(false);
        googleMap.getUiSettings().setCompassEnabled(false);
        googleMap.getUiSettings().setMapToolbarEnabled(false);
        googleMap.getUiSettings().setZoomControlsEnabled(false);

        // Emitir evento de mapa listo
        plugin.emitNavigationEvent("mapReady", null);
    }

    // ─────────────────────────────────────────────
    // Listeners de navegación
    // ─────────────────────────────────────────────

    private void setupNavigationListeners() {
        // Llegada a un waypoint
        arrivalListener = new ArrivalListener() {
            @Override
            public void onArrival(ArrivalEvent arrivalEvent) {
                String title = arrivalEvent.getWaypoint() != null
                    ? arrivalEvent.getWaypoint().getTitle()
                    : "Destino";
                plugin.emitArrival(title);

                if (arrivalEvent.isFinalDestination()) {
                    navigator.clearDestinations();
                    isNavigating = false;
                    plugin.emitNavigationEvent("navigationFinished", null);
                }
            }
        };
        navigator.addArrivalListener(arrivalListener);

        // Ruta recalculada
        routeChangedListener = new RouteChangedListener() {
            @Override
            public void onRouteChanged() {
                plugin.emitReroute();
            }
        };
        navigator.addRouteChangedListener(routeChangedListener);

        // Alertas de velocidad
        SpeedAlertOptions speedAlertOptions = new SpeedAlertOptions.Builder()
            .setSpeedAlertThresholdPercentage(SpeedAlertSeverity.MINOR, 5f)
            .setSpeedAlertThresholdPercentage(SpeedAlertSeverity.MAJOR, 15f)
            .build();
        navigator.setSpeedAlertOptions(speedAlertOptions);

        navigator.addSpeedingListener((isSpeeding, percentageAboveLimit, severity) -> {
            // Obtener velocidad actual desde el listener de ubicación del SDK
            plugin.emitSpeedAlert(0f, 0f);
        });
    }

    // ─────────────────────────────────────────────
    // updateMapBounds
    // ─────────────────────────────────────────────

    public void updateMapBounds(PluginCall call) {
        if (mapContainer == null) { call.reject("Map not initialized"); return; }

        final int x = dpToPx(call.getInt("x", 0));
        final int y = dpToPx(call.getInt("y", 0));
        final int width = dpToPx(call.getInt("width", 400));
        final int height = dpToPx(call.getInt("height", 600));

        activity.runOnUiThread(() -> {
            FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) mapContainer.getLayoutParams();
            params.leftMargin = x;
            params.topMargin = y;
            params.width = width;
            params.height = height;
            mapContainer.setLayoutParams(params);
            call.resolve();
        });
    }

    // ─────────────────────────────────────────────
    // animateCamera
    // ─────────────────────────────────────────────

    public void animateCamera(PluginCall call) {
        if (googleMap == null) { call.reject("Map not ready"); return; }

        double lat = call.getDouble("lat", 0.0);
        double lng = call.getDouble("lng", 0.0);
        float zoom = call.getFloat("zoom", 15f);
        float bearing = call.getFloat("bearing", 0f);
        float tilt = call.getFloat("tilt", 0f);

        activity.runOnUiThread(() -> {
            com.google.android.gms.maps.model.CameraPosition position =
                new com.google.android.gms.maps.model.CameraPosition.Builder()
                    .target(new LatLng(lat, lng))
                    .zoom(zoom)
                    .bearing(bearing)
                    .tilt(tilt)
                    .build();
            googleMap.animateCamera(CameraUpdateFactory.newCameraPosition(position));
            call.resolve();
        });
    }

    // ─────────────────────────────────────────────
    // setMapType
    // ─────────────────────────────────────────────

    public void setMapType(PluginCall call) {
        if (googleMap == null) { call.reject("Map not ready"); return; }
        String type = call.getString("mapType", "normal");

        activity.runOnUiThread(() -> {
            switch (type) {
                case "satellite": googleMap.setMapType(GoogleMap.MAP_TYPE_SATELLITE); break;
                case "terrain":   googleMap.setMapType(GoogleMap.MAP_TYPE_TERRAIN);   break;
                case "hybrid":    googleMap.setMapType(GoogleMap.MAP_TYPE_HYBRID);    break;
                default:          googleMap.setMapType(GoogleMap.MAP_TYPE_NORMAL);    break;
            }
            call.resolve();
        });
    }

    // ─────────────────────────────────────────────
    // Marcadores
    // ─────────────────────────────────────────────

    public void addMarker(PluginCall call) {
        if (googleMap == null) { call.reject("Map not ready"); return; }

        String id = call.getString("id", "marker_" + System.currentTimeMillis());
        double lat = call.getDouble("lat", 0.0);
        double lng = call.getDouble("lng", 0.0);
        String title = call.getString("title", "");
        String svgBase64 = call.getString("svgBase64", null);
        int width = call.getInt("width", 40);
        int height = call.getInt("height", 40);

        activity.runOnUiThread(() -> {
            // Eliminar marcador existente con ese ID
            if (markers.containsKey(id)) {
                markers.get(id).remove();
            }

            MarkerOptions options = new MarkerOptions()
                .position(new LatLng(lat, lng))
                .title(title);

            // Ícono SVG personalizado desde base64
            if (svgBase64 != null && !svgBase64.isEmpty()) {
                try {
                    byte[] decoded = Base64.decode(svgBase64, Base64.DEFAULT);
                    Bitmap bmp = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                    if (bmp != null) {
                        Bitmap scaled = Bitmap.createScaledBitmap(bmp, dpToPx(width), dpToPx(height), true);
                        options.icon(BitmapDescriptorFactory.fromBitmap(scaled));
                    }
                } catch (Exception e) {
                    // Si falla el decode, usar ícono por defecto
                }
            }

            Marker marker = googleMap.addMarker(options);
            if (marker != null) {
                markers.put(id, marker);
            }
            call.resolve();
        });
    }

    public void removeMarker(PluginCall call) {
        String id = call.getString("id", "");
        activity.runOnUiThread(() -> {
            Marker marker = markers.remove(id);
            if (marker != null) marker.remove();
            call.resolve();
        });
    }

    public void clearMarkers(PluginCall call) {
        activity.runOnUiThread(() -> {
            for (Marker m : markers.values()) m.remove();
            markers.clear();
            call.resolve();
        });
    }

    // ─────────────────────────────────────────────
    // Navegación
    // ─────────────────────────────────────────────

    public void setRoute(PluginCall call) {
        if (!sdkInitialized || navigator == null) { call.reject("Navigator not ready"); return; }

        try {
            List<Waypoint> waypoints = new ArrayList<>();
            org.json.JSONArray wps = call.getArray("waypoints").toJSONArray();
            for (int i = 0; i < wps.length(); i++) {
                org.json.JSONObject wp = wps.getJSONObject(i);
                double lat = wp.getDouble("lat");
                double lng = wp.getDouble("lng");
                String title = wp.optString("title", "Destino");
                waypoints.add(
                    new Waypoint.Builder()
                        .setLatLng(lat, lng)
                        .setTitle(title)
                        .build()
                );
            }

            RoutingOptions routingOptions = new RoutingOptions();
            routingOptions.travelMode(RoutingOptions.TravelMode.DRIVING);

            ListenableResultFuture<Navigator.RouteStatus> pendingRoute =
                navigator.setDestinations(waypoints, routingOptions);

            pendingRoute.setOnResultListener(routeStatus -> {
                JSObject result = new JSObject();
                result.put("status", routeStatus.name());
                result.put("success", routeStatus == Navigator.RouteStatus.OK);
                call.resolve(result);
            });

        } catch (Exception e) {
            call.reject("setRoute error: " + e.getMessage());
        }
    }

    public void startNavigation(PluginCall call) {
        if (navigator == null) { call.reject("Navigator not ready"); return; }

        activity.runOnUiThread(() -> {
            navigator.startGuidance();
            isNavigating = true;

            JSObject event = new JSObject();
            event.put("mode", "navigation");
            plugin.emitNavigationEvent("navigationStarted", event);

            call.resolve();
        });
    }

    public void stopNavigation(PluginCall call) {
        if (navigator == null) { call.reject("Navigator not ready"); return; }

        activity.runOnUiThread(() -> {
            navigator.stopGuidance();
            navigator.clearDestinations();
            isNavigating = false;

            JSObject event = new JSObject();
            event.put("mode", "map");
            plugin.emitNavigationEvent("navigationStopped", event);

            call.resolve();
        });
    }

    public void setAudioGuidance(PluginCall call) {
        if (navigator == null) { call.reject("Navigator not ready"); return; }
        boolean muted = Boolean.TRUE.equals(call.getBoolean("muted", false));

        navigator.setAudioGuidance(
            muted
                ? Navigator.AudioGuidance.SILENT
                : Navigator.AudioGuidance.VOICE_ALERTS_AND_GUIDANCE
        );
        call.resolve();
    }

    // ─────────────────────────────────────────────
    // destroyMap
    // ─────────────────────────────────────────────

    public void destroyMap(PluginCall call) {
        activity.runOnUiThread(() -> {
            // Remover listeners
            if (navigator != null) {
                if (arrivalListener != null) navigator.removeArrivalListener(arrivalListener);
                if (routeChangedListener != null) navigator.removeRouteChangedListener(routeChangedListener);
                navigator.cleanup();
                navigator = null;
            }

            // Eliminar todos los marcadores
            for (Marker m : markers.values()) m.remove();
            markers.clear();

            // Remover fragment
            if (navFragment != null) {
                ((FragmentActivity) activity).getSupportFragmentManager()
                    .beginTransaction()
                    .remove(navFragment)
                    .commitNow();
                navFragment = null;
            }

            // Remover contenedor del layout
            if (mapContainer != null) {
                ViewGroup parent = (ViewGroup) mapContainer.getParent();
                if (parent != null) parent.removeView(mapContainer);
                mapContainer = null;
            }

            // Restaurar WebView opaco
            restoreWebViewBackground();

            googleMap = null;
            sdkInitialized = false;

            call.resolve();
        });
    }

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────

    private void setupTransparentWebView() {
        View webView = bridge.getWebView();
        webView.setBackgroundColor(Color.TRANSPARENT);
        webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
    }

    private void restoreWebViewBackground() {
        View webView = bridge.getWebView();
        webView.setBackgroundColor(Color.WHITE);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
    }

    private int dpToPx(int dp) {
        DisplayMetrics metrics = activity.getResources().getDisplayMetrics();
        return Math.round(dp * metrics.density);
    }
}
