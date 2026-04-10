import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { loadGoogleMaps } from '../../services/maps';
import { useLocation } from '../../context/LocationContext';

const Map = forwardRef(({
    className,
    mapType = 'roadmap',
    onCenterChange,
    origin,
    destination,
    initialCenter, // NEW PROP
    showDirections = false,
    onDirectionsResult,
    centerOnLocationTrigger = 0,
    markers = []
}, ref) => {
    const mapRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [googleApi, setGoogleApi] = useState(null);
    const [directionsRenderer, setDirectionsRenderer] = useState(null);
    const { currentLocation } = useLocation();
    const markerRef = useRef(null);
    const centerChangeTimeoutRef = useRef(null);
    const customMarkersRef = useRef({});

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        zoomIn: () => {
            if (mapInstance) mapInstance.setZoom((mapInstance.getZoom() || 15) + 1);
        },
        zoomOut: () => {
            if (mapInstance) mapInstance.setZoom((mapInstance.getZoom() || 15) - 1);
        },
        panTo: (latLng) => {
            if (mapInstance) mapInstance.panTo(latLng);
        },
        setZoom: (zoomLevel) => {
            if (mapInstance) mapInstance.setZoom(zoomLevel);
        },
        getCenter: () => {
            if (mapInstance) {
                const center = mapInstance.getCenter();
                return { lat: center.lat(), lng: center.lng() };
            }
            return null;
        }
    }));

    // 1. Initialize Map
    const mapInstanceLocalRef = useRef(null);
    const rendererLocalRef = useRef(null);

    useEffect(() => {
        let mounted = true;

        const initMap = async () => {
            try {
                const google = await loadGoogleMaps();
                if (!mounted || !mapRef.current) return;

                setGoogleApi(google);

                const defaultLocation = { lat: 10.4806, lng: -66.9036 };
                const MapConstructor = google.maps.Map;

                const map = new MapConstructor(mapRef.current, {
                    center: initialCenter || currentLocation || defaultLocation,
                    zoom: 15,
                    // mapId: 'LLEVAME_MAP_ID', // Commented out to restore default detailed styles
                    disableDefaultUI: true, // We build our own UI
                    zoomControl: false,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    clickableIcons: true, // Allow clicking shops/POIs to see names
                    backgroundColor: '#f0f0f0',
                    mapTypeId: mapType,
                    // Explicitly force labels to show
                    styles: [
                        {
                            "featureType": "all",
                            "elementType": "labels",
                            "stylers": [{ "visibility": "on" }]
                        },
                        {
                            "featureType": "poi",
                            "elementType": "labels",
                            "stylers": [{ "visibility": "on" }]
                        }
                    ],
                    gestureHandling: 'greedy', // Best for mobile apps (one finger pan, pinch zoom)
                });

                if (!mounted) {
                    // Component unmounted during async init — detach immediately
                    try { google.maps.event.clearInstanceListeners(map); } catch (e) {}
                    return;
                }

                mapInstanceLocalRef.current = map;

                // Listen for center changes (dragging)
                if (onCenterChange) {
                    map.addListener('center_changed', () => {
                        if (centerChangeTimeoutRef.current) clearTimeout(centerChangeTimeoutRef.current);

                        centerChangeTimeoutRef.current = setTimeout(() => {
                            const center = map.getCenter();
                            onCenterChange({
                                lat: center.lat(),
                                lng: center.lng()
                            });
                        }, 100);
                    });
                }

                setMapInstance(map);

                // Initialize DirectionsRenderer
                const renderer = new window.google.maps.DirectionsRenderer({
                    map: map,
                    suppressMarkers: true, // Hide default A/B markers
                    // Customize route line style
                    polylineOptions: {
                        strokeColor: '#3b82f6', // Blue color (Tailwind blue-500)
                        strokeOpacity: 0.8,
                        strokeWeight: 6
                    }
                });
                rendererLocalRef.current = renderer;
                setDirectionsRenderer(renderer);

            } catch (error) {
                console.error("Error loading map:", error);
            }
        };

        initMap();

        return () => {
            mounted = false;

            // Cancel all running marker animations
            Object.values(activeAnimations.current).forEach(id => cancelAnimationFrame(id));
            activeAnimations.current = {};

            // Detach all custom markers from the map
            Object.values(customMarkersRef.current).forEach(m => {
                try { m.setMap(null); } catch (e) {}
            });
            customMarkersRef.current = {};

            // Detach the location marker
            if (markerRef.current) {
                try { markerRef.current.setMap(null); } catch (e) {}
                markerRef.current = null;
            }

            // Detach directions renderer
            if (rendererLocalRef.current) {
                try { rendererLocalRef.current.setMap(null); } catch (e) {}
                rendererLocalRef.current = null;
            }

            // Clear all Google Maps event listeners on the map instance
            if (mapInstanceLocalRef.current && window.google?.maps?.event) {
                try { window.google.maps.event.clearInstanceListeners(mapInstanceLocalRef.current); } catch (e) {}
            }

            // Clear timeout
            if (centerChangeTimeoutRef.current) clearTimeout(centerChangeTimeoutRef.current);

            mapInstanceLocalRef.current = null;
        };
    }, []);

    // 2. Handle map type changes
    useEffect(() => {
        if (mapInstance) {
            mapInstance.setMapTypeId(mapType);
        }
    }, [mapType, mapInstance]);

    // 3. Update current location marker with premium design
    useEffect(() => {
        const updateMarker = async () => {
            if (mapInstance && currentLocation && googleApi && !showDirections) {
                const Marker = googleApi.maps.Marker;

                // Minimalist Passenger Icon (Requested) - Black/White Style
                const MINIMAL_USER_ICON = `
                    <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                        <!-- Drop Shadow -->
                         <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.3"/>
                        </filter>
                        
                        <!-- Pulse Effect -->
                        <circle cx="30" cy="30" r="24" fill="none" stroke="black" stroke-width="1" opacity="0.1">
                            <animate attributeName="r" from="18" to="28" dur="2s" repeatCount="indefinite"/>
                            <animate attributeName="opacity" from="0.2" to="0" dur="2s" repeatCount="indefinite"/>
                        </circle>

                        <!-- Main Marker Body -->
                        <g filter="url(#shadow)">
                            <circle cx="30" cy="30" r="14" fill="black" stroke="white" stroke-width="2.5"/>
                            <!-- User Concept (Simplified) -->
                            <circle cx="30" cy="27" r="4" fill="white"/>
                            <path d="M22 39 C22 34 25 32 30 32 C35 32 38 34 38 39" stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
                        </g>
                    </svg>
                `;

                const iconConfig = {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(MINIMAL_USER_ICON),
                    scaledSize: new googleApi.maps.Size(60, 60),
                    anchor: new googleApi.maps.Point(30, 30),
                };

                if (markerRef.current) {
                    markerRef.current.setPosition(currentLocation);
                    markerRef.current.setIcon(iconConfig);
                } else {
                    markerRef.current = new Marker({
                        map: mapInstance,
                        position: currentLocation,
                        title: "Tu ubicación",
                        zIndex: 2,
                        icon: iconConfig
                    });
                }
            }
        };

        updateMarker();
    }, [currentLocation, mapInstance, googleApi, showDirections]);

    // 4. Handle Directions
    useEffect(() => {
        if (showDirections && origin && destination && googleApi && directionsRenderer) {
            const directionsService = new googleApi.maps.DirectionsService();

            directionsService.route(
                {
                    origin: origin,
                    destination: destination,
                    travelMode: googleApi.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === googleApi.maps.DirectionsStatus.OK) {
                        directionsRenderer.setDirections(result);

                        const route = result.routes[0];
                        if (route && route.legs && route.legs[0]) {
                            const leg = route.legs[0];
                            if (onDirectionsResult) {
                                onDirectionsResult({
                                    distance: leg.distance,
                                    duration: leg.duration,
                                    encodedPolyline: route.overview_polyline
                                });
                            }
                        }
                    } else {
                        console.error(`Directions request failed due to ${status}`);
                    }
                }
            );

            if (markerRef.current) markerRef.current.setVisible(false);

        } else {
            if (directionsRenderer) {
                try {
                    // Safe cleanup for directions
                    directionsRenderer.setMap(null); // Detach from map temporarily
                    directionsRenderer.setDirections({ routes: [] }); // Clear routes
                } catch (e) {
                    // Ignore cleanup errors
                }
                // Re-attach if needed or standard reset
                directionsRenderer.setMap(mapInstance);
            }
            if (markerRef.current) markerRef.current.setVisible(true);
        }
    }, [showDirections, origin, destination, googleApi, directionsRenderer]);

    // 5. Handle manual center trigger
    useEffect(() => {
        if (mapInstance && currentLocation && centerOnLocationTrigger > 0) {
            mapInstance.panTo(currentLocation);
            mapInstance.setZoom(17);
        }
    }, [centerOnLocationTrigger, mapInstance, currentLocation]);

    // Helper for smooth animation
    const activeAnimations = useRef({});

    function toRad(deg) { return deg * Math.PI / 180; }
    function toDeg(rad) { return rad * 180 / Math.PI; }

    function getBearing(startLat, startLng, destLat, destLng) {
        startLat = toRad(startLat);
        startLng = toRad(startLng);
        destLat = toRad(destLat);
        destLng = toRad(destLng);

        const y = Math.sin(destLng - startLng) * Math.cos(destLat);
        const x = Math.cos(startLat) * Math.sin(destLat) -
            Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
        let brng = Math.atan2(y, x);
        brng = toDeg(brng);
        return (brng + 360) % 360;
    }

    // 6. Handle Custom Markers with Smooth Animation
    useEffect(() => {
        if (!mapInstance || !googleApi) return;

        // Cleanup missing markers
        Object.keys(customMarkersRef.current).forEach(id => {
            if (!markers.find(m => m.id === id)) {
                if (activeAnimations.current[id]) {
                    cancelAnimationFrame(activeAnimations.current[id]);
                    delete activeAnimations.current[id];
                }
                customMarkersRef.current[id].setMap(null);
                delete customMarkersRef.current[id];
            }
        });

        // Update or Create markers
        markers.forEach(markerData => {
            const { id, position, icon, title, onClick, rotation } = markerData;
            if (!position) return;

            let marker = customMarkersRef.current[id];

            if (marker) {
                // Smooth Animation Logic
                if (activeAnimations.current[id]) cancelAnimationFrame(activeAnimations.current[id]);

                const startPos = marker.getPosition();
                const startLat = startPos.lat();
                const startLng = startPos.lng();

                // Calculate distance manually approx
                const latDiff = position.lat - startLat;
                const lngDiff = position.lng - startLng;
                const distSq = latDiff * latDiff + lngDiff * lngDiff;

                // Thresholds: Too small (jitter) or too big (teleport)
                if (distSq < 0.00000001 || distSq > 0.1) {
                    marker.setPosition(position);
                    if (icon) marker.setIcon(icon);
                    return;
                }

                const startTime = performance.now();
                const duration = 2000; // 2 seconds animation for smooth glide

                // Calculate Heading for cars
                let heading = rotation || 0;
                // Only calculate heading if moved enough and it looks like a car/moving object
                if (distSq > 0.000001) {
                    heading = getBearing(startLat, startLng, position.lat, position.lng);
                }

                // Animate
                const animate = (time) => {
                    let progress = (time - startTime) / duration;
                    if (progress > 1) progress = 1;

                    // Ease out cubic
                    const ease = 1 - Math.pow(1 - progress, 3);

                    const currentLat = startLat + (position.lat - startLat) * ease;
                    const currentLng = startLng + (position.lng - startLng) * ease;
                    const newPos = new googleApi.maps.LatLng(currentLat, currentLng);

                    marker.setPosition(newPos);

                    // Update Icon Rotation if supported (SVG path with rotation or Icon object)
                    if (icon && typeof icon === 'object') {
                        // If it's a Symbol (SVG path), we can rotate it easily
                        if (icon.path) {
                            marker.setIcon({
                                ...icon,
                                rotation: heading
                            });
                        }
                        // If it's an image, CSS rotation is hard on google maps markers without custom overlays
                        // But we can check if it's our Car SVG string and inject rotation? Hard.
                        // Standard Google Maps Marker rotation only works for Symbols (vector paths).
                        // If we use HTML attributes, we need OverlayView.
                        // For now, we animate position primarily.
                    }

                    if (progress < 1) {
                        activeAnimations.current[id] = requestAnimationFrame(animate);
                    } else {
                        // Ensure final exact position
                        marker.setPosition(position);
                        delete activeAnimations.current[id];
                    }
                };

                activeAnimations.current[id] = requestAnimationFrame(animate);

            } else {
                // New Marker (Teleport)
                marker = new googleApi.maps.Marker({
                    map: mapInstance,
                    position: position,
                    title: title,
                    icon: icon,
                    zIndex: 20
                });
                customMarkersRef.current[id] = marker;
            }

            // Update Click Listener
            if (marker._clickListener) {
                googleApi.maps.event.removeListener(marker._clickListener);
                delete marker._clickListener;
            }
            if (onClick) {
                marker._clickListener = marker.addListener("click", onClick);
            }
        });

    }, [markers, mapInstance, googleApi]);

    return (
        <div ref={mapRef} className={`w-full h-full ${className}`} style={{ minHeight: '100%', minWidth: '100%', background: '#e5e7eb', touchAction: 'none' }} />
    );
});

export default Map;
