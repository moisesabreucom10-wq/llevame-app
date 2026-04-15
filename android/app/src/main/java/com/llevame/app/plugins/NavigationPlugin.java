package com.llevame.app.plugins;

import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.libraries.navigation.NavigationApi;
import com.google.android.libraries.navigation.Navigator;
import com.google.android.libraries.navigation.SupportNavigationFragment;
import com.google.android.libraries.navigation.Waypoint;
import com.google.android.libraries.navigation.NavigationApi.NavigatorListener;

import com.llevame.app.R;

@CapacitorPlugin(name = "NavigationSDK")
public class NavigationPlugin extends Plugin {

    private static final String TAG = "NavigationPlugin";

    private SupportNavigationFragment navFragment;
    private Navigator navigator;
    private boolean isNavigating = false;
    private boolean termsAccepted = false;

    /**
     * Initialize the Navigation SDK. Must be called once before startNavigation.
     * Handles Terms & Conditions dialog and Navigator acquisition.
     */
    @PluginMethod
    public void initialize(PluginCall call) {
        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                NavigationApi.getNavigator(
                    activity,
                    new NavigatorListener() {
                        @Override
                        public void onNavigatorReady(@NonNull Navigator nav) {
                            navigator = nav;
                            termsAccepted = true;
                            Log.i(TAG, "Navigator ready");

                            navFragment = SupportNavigationFragment.newInstance();

                            FrameLayout container = activity.findViewById(R.id.navigation_container);
                            if (container != null) {
                                activity.getSupportFragmentManager()
                                    .beginTransaction()
                                    .replace(R.id.navigation_container, navFragment)
                                    .commitAllowingStateLoss();
                                Log.i(TAG, "Navigation fragment attached");
                            }

                            JSObject result = new JSObject();
                            result.put("status", "ready");
                            call.resolve(result);
                        }

                        @Override
                        public void onError(int errorCode) {
                            Log.e(TAG, "Navigator error code: " + errorCode);
                            String msg;
                            switch (errorCode) {
                                case NavigationApi.ErrorCode.NOT_AUTHORIZED:
                                    msg = "API key not authorized for Navigation SDK. Check Google Cloud Console.";
                                    break;
                                case NavigationApi.ErrorCode.TERMS_NOT_ACCEPTED:
                                    msg = "User declined the Navigation SDK terms.";
                                    break;
                                default:
                                    msg = "Navigation SDK error code: " + errorCode;
                            }
                            call.reject(msg);
                        }
                    }
                );
            } catch (Exception e) {
                Log.e(TAG, "Initialize error", e);
                call.reject("Failed to initialize: " + e.getMessage());
            }
        });
    }

    /**
     * Start turn-by-turn navigation to a destination.
     */
    @PluginMethod
    public void startNavigation(PluginCall call) {
        if (navigator == null) {
            call.reject("Navigator not initialized. Call initialize() first.");
            return;
        }

        double lat = call.getDouble("lat", 0.0);
        double lng = call.getDouble("lng", 0.0);
        String title = call.getString("title", "Destino");

        if (lat == 0.0 && lng == 0.0) {
            call.reject("Invalid destination coordinates");
            return;
        }

        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Waypoint destination = Waypoint.builder()
                    .setLatLng(lat, lng)
                    .setTitle(title)
                    .build();

                navigator.setDestination(destination);
                navigator.startGuidance();

                FrameLayout container = activity.findViewById(R.id.navigation_container);
                if (container != null) {
                    container.setVisibility(View.VISIBLE);
                }

                if (navFragment != null) {
                    navFragment.setTripProgressBarEnabled(true);
                    navFragment.setSpeedLimitIconEnabled(true);
                    navFragment.setSpeedometerEnabled(true);
                    navFragment.setHeaderEnabled(true);
                }

                isNavigating = true;

                JSObject result = new JSObject();
                result.put("status", "navigating");
                result.put("lat", lat);
                result.put("lng", lng);
                call.resolve(result);

                Log.i(TAG, "Navigation started to: " + lat + ", " + lng);

            } catch (Exception e) {
                Log.e(TAG, "Start navigation error", e);
                call.reject("Failed to start navigation: " + e.getMessage());
            }
        });
    }

    /**
     * Stop the current navigation session and hide the native view.
     */
    @PluginMethod
    public void stopNavigation(PluginCall call) {
        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                if (navigator != null) {
                    navigator.stopGuidance();
                    navigator.clearDestinations();
                }

                FrameLayout container = activity.findViewById(R.id.navigation_container);
                if (container != null) {
                    container.setVisibility(View.GONE);
                }

                isNavigating = false;

                JSObject result = new JSObject();
                result.put("status", "stopped");
                call.resolve(result);

                Log.i(TAG, "Navigation stopped");

            } catch (Exception e) {
                Log.e(TAG, "Stop navigation error", e);
                call.reject("Failed to stop navigation: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void isNavigating(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isNavigating", isNavigating);
        result.put("termsAccepted", termsAccepted);
        call.resolve(result);
    }

    /**
     * Makes the WebView transparent so the native navigation view shows through.
     */
    @PluginMethod
    public void setWebViewTransparent(PluginCall call) {
        boolean transparent = call.getBoolean("transparent", false);
        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                View webView = activity.findViewById(R.id.webview);
                if (webView != null) {
                    if (transparent) {
                        webView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                        if (webView instanceof android.webkit.WebView) {
                            ((android.webkit.WebView) webView).setBackgroundColor(android.graphics.Color.TRANSPARENT);
                        }
                    } else {
                        webView.setBackgroundColor(android.graphics.Color.WHITE);
                        if (webView instanceof android.webkit.WebView) {
                            ((android.webkit.WebView) webView).setBackgroundColor(android.graphics.Color.WHITE);
                        }
                    }
                }

                JSObject result = new JSObject();
                result.put("transparent", transparent);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Failed to set transparency: " + e.getMessage());
            }
        });
    }
}
