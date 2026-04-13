package com.llevame.app;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
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

import android.location.Location;

import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.Navigator.ArrivalListener;
import com.google.android.libraries.navigation.Navigator.RouteChangedListener;
import com.google.android.libraries.navigation.SupportNavigationFragment;

import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.model.BitmapDescriptorFactory;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.Marker;
import com.google.android.gms.maps.model.MarkerOptions;

import java.util.HashMap;
import java.util.Map;

/**
 * NavigationPluginImpl — Implementación del Navigation SDK.
 *
 * El mapa se muestra vía SupportNavigationFragment sin requerir el Navigator.
 * La funcionalidad de navegación turn-by-turn se activa cuando el Navigator
 * esté disponible vía el API correcto del SDK instalado.
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
    private boolean destroyed = false;

    // Listeners activos
    private ArrivalListener arrivalListener;
    private RouteChangedListener routeChangedListener;

    // Guardada para resolver cuando el mapa esté listo
    private PluginCall pendingInitCall;

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
            setupTransparentWebView();

            mapContainer = new FrameLayout(activity);
            mapContainer.setId(View.generateViewId());
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
            params.leftMargin = x;
            params.topMargin = y;
            mapContainer.setLayoutParams(params);

            ViewGroup rootLayout = (ViewGroup) activity.getWindow().getDecorView().getRootView();
            rootLayout.addView(mapContainer, 0);

            destroyed = false;
            pendingInitCall = call;

            // Crear el fragmento de mapa directamente — la call se resuelve en onMapReady
            navFragment = SupportNavigationFragment.newInstance();
            ((FragmentActivity) activity).getSupportFragmentManager()
                .beginTransaction()
                .add(mapContainer.getId(), navFragment)
                .commitNow();

            navFragment.getMapAsync(NavigationPluginImpl.this);
        });
    }

    // ─────────────────────────────────────────────
    // OnMapReadyCallback
    // ─────────────────────────────────────────────

    @Override
    public void onMapReady(@NonNull GoogleMap map) {
        if (destroyed) return;
        this.googleMap = map;

        try {
            googleMap.setMyLocationEnabled(true);
        } catch (SecurityException e) {
            // Permiso de ubicación no concedido aún
        }
        googleMap.getUiSettings().setMyLocationButtonEnabled(false);
        googleMap.getUiSettings().setCompassEnabled(false);
        googleMap.getUiSettings().setMapToolbarEnabled(false);
        googleMap.getUiSettings().setZoomControlsEnabled(false);

        googleMap.setOnCameraMoveListener(() -> {
            LatLng center = googleMap.getCameraPosition().target;
            plugin.emitCameraMove(center.latitude, center.longitude);
        });

        plugin.emitNavigationEvent("mapReady", null);

        // Resolver la llamada de initMap
        if (pendingInitCall != null) {
            JSObject result = new JSObject();
            result.put("initialized", true);
            pendingInitCall.resolve(result);
            pendingInitCall = null;
        }
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
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) mapContainer.getLayoutParams();
            lp.leftMargin = x;
            lp.topMargin = y;
            lp.width = width;
            lp.height = height;
            mapContainer.setLayoutParams(lp);
            call.resolve();
        });
    }

    // ─────────────────────────────────────────────
    // animateCamera
    // ─────────────────────────────────────────────

    public void animateCamera(PluginCall call) {
        if (googleMap == null) { call.reject("Map not ready"); return; }

        final Double lat = call.getDouble("lat");
        final Double lng = call.getDouble("lng");
        final Float zoom = call.getFloat("zoom");
        final Float bearing = call.getFloat("bearing");
        final Float tilt = call.getFloat("tilt");

        activity.runOnUiThread(() -> {
            com.google.android.gms.maps.model.CameraPosition current = googleMap.getCameraPosition();

            if (lat != null && lng != null) {
                com.google.android.gms.maps.model.CameraPosition position =
                    new com.google.android.gms.maps.model.CameraPosition.Builder()
                        .target(new LatLng(lat, lng))
                        .zoom(zoom    != null ? zoom    : current.zoom)
                        .bearing(bearing != null ? bearing : current.bearing)
                        .tilt(tilt    != null ? tilt    : current.tilt)
                        .build();
                googleMap.animateCamera(CameraUpdateFactory.newCameraPosition(position));
            } else if (zoom != null) {
                googleMap.animateCamera(CameraUpdateFactory.zoomTo(zoom));
            }
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
    // setNightMode
    // ─────────────────────────────────────────────

    private static final String NIGHT_MAP_STYLE = "[" +
        "{\"elementType\":\"geometry\",\"stylers\":[{\"color\":\"#212121\"}]}," +
        "{\"elementType\":\"labels.icon\",\"stylers\":[{\"visibility\":\"off\"}]}," +
        "{\"elementType\":\"labels.text.fill\",\"stylers\":[{\"color\":\"#757575\"}]}," +
        "{\"elementType\":\"labels.text.stroke\",\"stylers\":[{\"color\":\"#212121\"}]}," +
        "{\"featureType\":\"administrative\",\"elementType\":\"geometry\",\"stylers\":[{\"color\":\"#757575\"}]}," +
        "{\"featureType\":\"administrative.country\",\"elementType\":\"labels.text.fill\",\"stylers\":[{\"color\":\"#9e9e9e\"}]}," +
        "{\"featureType\":\"administrative.locality\",\"elementType\":\"labels.text.fill\",\"stylers\":[{\"color\":\"#bdbdbd\"}]}," +
        "{\"featureType\":\"poi\",\"elementType\":\"labels.text.fill\",\"stylers\":[{\"color\":\"#757575\"}]}," +
        "{\"featureType\":\"poi.park\",\"elementType\":\"geometry\",\"stylers\":[{\"color\":\"#181818\"}]}," +
        "{\"featureType\":\"poi.park\",\"elementType\":\"labels.text.fill\",\"stylers\":[{\"color\":\"#616161\"}]}," +
        "{\"featureType\":\"poi.park\",\"elementType\":\"labels.text.stroke\",\"stylers\":[{\"color\":\"#1b1b1b\"}]}," +
        "{\"featureType\":\"road\",\"elementType\":\"geometry.fill\",\"stylers\":[{\"color\":\"#2c2c2c\"}]}," +
        "{\"featureType\":\"road\",\"elementType\":\"labels.text.fill\",\"stylers\":[{\"color\":\"#8a8a8a\"}]}," +
        "{\"featureType\":\"road.arterial\",\"elementType\":\"geometry\",\"stylers\":[{\"color\":\"#373737\"}]}," +
        "{\"featureType\":\"road.highway\",\"elementType\":\"geometry\",\"stylers\":[{\"color\":\"#3c3c3c\"}]}," +
        "{\"featureType\":\"road.highway.controlled_access\",\"elementType\":\"geometry\",\"stylers\":[{\"color\":\"#4e4e4e\"}]}," +
        "{\"featureType\":\"road.local\",\"elementType\":\"labels.text.fill\",\"stylers\":[{\"color\":\"#616161\"}]}," +
        "{\"featureType\":\"transit\",\"elementType\":\"labels.text.fill\",\"stylers\":[{\"color\":\"#757575\"}]}," +
        "{\"featureType\":\"water\",\"elementType\":\"geometry\",\"stylers\":[{\"color\":\"#000000\"}]}," +
        "{\"featureType\":\"water\",\"elementType\":\"labels.text.fill\",\"stylers\":[{\"color\":\"#3d3d3d\"}]}" +
    "]";

    public void setNightMode(PluginCall call) {
        if (googleMap == null) { call.reject("Map not ready"); return; }
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));

        activity.runOnUiThread(() -> {
            try {
                if (enabled) {
                    googleMap.setMapStyle(
                        new com.google.android.gms.maps.model.MapStyleOptions(NIGHT_MAP_STYLE));
                } else {
                    googleMap.setMapStyle(null);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("setNightMode error: " + e.getMessage());
            }
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
            if (markers.containsKey(id)) {
                markers.get(id).remove();
            }

            MarkerOptions options = new MarkerOptions()
                .position(new LatLng(lat, lng))
                .title(title);

            if (svgBase64 != null && !svgBase64.isEmpty()) {
                try {
                    byte[] decoded = Base64.decode(svgBase64, Base64.DEFAULT);
                    Bitmap bmp = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                    if (bmp != null) {
                        Bitmap scaled = Bitmap.createScaledBitmap(bmp,
                            dpToPx(width), dpToPx(height), true);
                        options.icon(BitmapDescriptorFactory.fromBitmap(scaled));
                    }
                } catch (Exception e) {
                    // Usar ícono por defecto si falla el decode
                }
            }

            Marker marker = googleMap.addMarker(options);
            if (marker != null) markers.put(id, marker);
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
    // Navegación (requiere Navigator — no disponible sin getNavigator API)
    // ─────────────────────────────────────────────

    public void setRoute(PluginCall call) {
        if (navigator == null) {
            call.reject("Navigator not available");
            return;
        }
        // TODO: implementar cuando el API de getNavigator esté resuelto
        call.reject("Navigation not yet configured");
    }

    public void startNavigation(PluginCall call) {
        if (navigator == null) { call.reject("Navigator not available"); return; }
        activity.runOnUiThread(() -> {
            navigator.startGuidance();
            JSObject event = new JSObject();
            event.put("mode", "navigation");
            plugin.emitNavigationEvent("navigationStarted", event);
            call.resolve();
        });
    }

    public void stopNavigation(PluginCall call) {
        if (navigator == null) { call.reject("Navigator not available"); return; }
        activity.runOnUiThread(() -> {
            navigator.stopGuidance();
            navigator.clearDestinations();
            JSObject event = new JSObject();
            event.put("mode", "map");
            plugin.emitNavigationEvent("navigationStopped", event);
            call.resolve();
        });
    }

    public void setAudioGuidance(PluginCall call) {
        if (navigator == null) { call.reject("Navigator not available"); return; }
        boolean muted = Boolean.TRUE.equals(call.getBoolean("muted", false));
        navigator.setAudioGuidance(
            muted ? Navigator.AudioGuidance.SILENT
                  : Navigator.AudioGuidance.VOICE_ALERTS_AND_GUIDANCE);
        call.resolve();
    }

    // ─────────────────────────────────────────────
    // destroyMap
    // ─────────────────────────────────────────────

    public void destroyMap(PluginCall call) {
        destroyed = true;
        activity.runOnUiThread(() -> {
            if (navigator != null) {
                if (arrivalListener != null) navigator.removeArrivalListener(arrivalListener);
                if (routeChangedListener != null) navigator.removeRouteChangedListener(routeChangedListener);
                navigator.cleanup();
                navigator = null;
            }

            for (Marker m : markers.values()) m.remove();
            markers.clear();

            if (navFragment != null) {
                ((FragmentActivity) activity).getSupportFragmentManager()
                    .beginTransaction()
                    .remove(navFragment)
                    .commitNow();
                navFragment = null;
            }

            if (mapContainer != null) {
                ViewGroup parent = (ViewGroup) mapContainer.getParent();
                if (parent != null) parent.removeView(mapContainer);
                mapContainer = null;
            }

            restoreWebViewBackground();
            googleMap = null;
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
