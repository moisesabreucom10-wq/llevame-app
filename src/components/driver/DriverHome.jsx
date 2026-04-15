import React, { useState, useRef, useEffect } from 'react';
import Map from '../shared/Map';
import { Power, Map as MapIcon, Navigation, Layers, CheckCircle, Clock, Plus, Minus, Compass, Locate, MessageCircle, Bell, ChevronDown, ChevronUp, AlertCircle, Shield } from 'lucide-react';
import Chat from '../shared/Chat';
import { useTrip } from '../../context/TripContext';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

const DriverHome = () => {
    // Consume global online state
    const { nearbyTrips, currentTrip, acceptTrip, startTrip, completeTrip, isDriverOnline, setIsDriverOnline } = useTrip();
    const { userProfile, currentUser } = useAuth(); // Need currentUser for ID
    const { currentLocation, getCurrentPosition } = useLocation();
    const mapRef = useRef(null);

    // UI State (Local visual only)
    const [stats, setStats] = useState({ trips: 0, earnings: 0 }); // Real stats
    const [mapType, setMapType] = useState(() => localStorage.getItem('llevame_mapType') || 'roadmap');
    const [centerTrigger, setCenterTrigger] = useState(0);
    const [isCompassActive, setIsCompassActive] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [tripDetails, setTripDetails] = useState(null);
    const [hasCenteredInitial, setHasCenteredInitial] = useState(false);
    const [isPanelExpanded, setIsPanelExpanded] = useState(true);
    const [bcvRate, setBcvRate] = useState(60.00); // Default Fallback

    // Panels State
    const [showBottomPanel, setShowBottomPanel] = useState(true);

    // Fetch BCV Rate
    useEffect(() => {
        const fetchBCV = async () => {
            try {
                const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.promedio) {
                        setBcvRate(data.promedio);
                    }
                }
            } catch (error) {
                console.warn("Failed to fetch BCV rate, using default:", error);
            }
        };
        fetchBCV();
    }, []);

    // (Removed local storage effect for online state as it is now in Context)

    // Listen for Stats
    useEffect(() => {
        if (!currentUser) return;
        // Use Local Date
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const statsRef = doc(db, 'driver_daily_stats', `${currentUser.uid}_${todayStr}`);

        const unsubscribe = onSnapshot(statsRef, (docSnap) => {
            if (docSnap.exists()) {
                setStats(docSnap.data());
            } else {
                setStats({ trips: 0, earnings: 0 });
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Initial Center on Location
    useEffect(() => {
        if (currentLocation && !hasCenteredInitial && mapRef.current) {
            setHasCenteredInitial(true);
            // Small timeout to allow map to be ready
            setTimeout(() => {
                if (mapRef.current) {
                    mapRef.current.panTo({ lat: currentLocation.lat, lng: currentLocation.lng });
                    mapRef.current.setZoom(16);
                }
            }, 500);
        }
    }, [currentLocation, hasCenteredInitial]);

    // Reset details when trip changes
    useEffect(() => {
        setTripDetails(null);
    }, [currentTrip?.id]);

    const handleDirectionsResult = (result) => {
        setTripDetails(result);
    };

    const handleAcceptTrip = async (tripId) => {
        try {
            await acceptTrip(tripId);
        } catch (error) {
            alert('Error al aceptar el viaje: ' + error.message);
        }
    };

    const handleStartTrip = async () => {
        if (!currentTrip) return;
        try {
            await startTrip(currentTrip.id);
        } catch (error) {
            alert('Error al iniciar el viaje');
        }
    };

    // --- UTILS ---
    const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    const handleCompleteTrip = async () => {
        if (!currentTrip || !currentLocation) return;

        // 1. Geofencing Check (e.g., 300 meters)
        const dist = getDistanceFromLatLonInKm(
            currentLocation.lat,
            currentLocation.lng,
            currentTrip.dropoff.coordinates.lat,
            currentTrip.dropoff.coordinates.lng
        );

        if (dist > 0.5) { // 0.5 km tolerance
            alert(`Estás muy lejos del destino (${dist.toFixed(2)} km). Acércate para finalizar.`);
            return;
        }

        // 2. Payment Confirmation
        const confirmMsg = currentTrip.paymentMethod?.type === 'cash'
            ? `Cobrar $${currentTrip.fare} en EFECTIVO al pasajero.`
            : `Verificar pago de $${currentTrip.fare} por ${currentTrip.paymentMethod?.type === 'pago_movil' ? 'PAGO MÓVIL' : 'TARJETA'}.`;

        if (window.confirm(`${confirmMsg}\n\n¿El pago se ha realizado correctamente?`)) {
            try {
                await completeTrip(currentTrip.id, parseFloat(currentTrip.fare));
            } catch (error) {
                alert('Error al completar el viaje');
            }
        }
    };

    const handleLocateMe = () => {
        getCurrentPosition();
        setCenterTrigger(prev => prev + 1);
    };

    const toggleMapType = () => {
        setMapType(prev => {
            const newType = prev === 'roadmap' ? 'satellite' : 'roadmap';
            localStorage.setItem('llevame_mapType', newType);
            return newType;
        });
    };

    const handleZoomIn = () => {
        if (mapRef.current) mapRef.current.zoomIn();
    };

    const handleZoomOut = () => {
        if (mapRef.current) mapRef.current.zoomOut();
    };

    const handleCompass = () => {
        setIsCompassActive(!isCompassActive);
    };

    // Calculate distance in km (Haversine formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        return d.toFixed(1);
    };

    // Prepare Custom Markers with minimalist flat design + Labels
    const getMarkers = () => {
        const markers = [];
        // Safety check: Ensure Google Maps API is loaded before accessing .maps
        if (!window.google || !window.google.maps) return markers;

        if (!currentTrip) return markers;

        // Pickup point (Minimalist Green Pin with 'A')
        if (currentTrip.pickup?.coordinates) {
            const GREEN_PIN_MINIMAL = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
                    </filter>
                    <g filter="url(#shadow)">
                        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#10B981" stroke="white" stroke-width="1"/>
                        <text x="12" y="13" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">A</text>
                    </g>
                </svg>
            `;

            markers.push({
                id: 'pickup',
                position: currentTrip.pickup.coordinates,
                title: 'Recogida Pasajero',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(GREEN_PIN_MINIMAL),
                    scaledSize: new window.google.maps.Size(40, 40),
                    anchor: new window.google.maps.Point(20, 40)
                }
            });
        }

        // Dropoff point (Minimalist Red Pin with 'B')
        if (currentTrip.dropoff?.coordinates) {
            const RED_PIN_MINIMAL = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
                    </filter>
                    <g filter="url(#shadow)">
                        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#EF4444" stroke="white" stroke-width="1"/>
                        <text x="12" y="13" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">B</text>
                    </g>
                </svg>
            `;

            markers.push({
                id: 'dropoff',
                position: currentTrip.dropoff.coordinates,
                title: 'Destino',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(RED_PIN_MINIMAL),
                    scaledSize: new window.google.maps.Size(40, 40),
                    anchor: new window.google.maps.Point(20, 40)
                }
            });
        }

        return markers;
    };

    // --- RENDER HELPERS ---

    const renderMapControls = () => (
        <div className="absolute top-4 right-4 flex flex-col gap-3 z-10 pointer-events-auto mt-safe-top">
            {/* Zoom Controls */}
            <div className="flex flex-col bg-white rounded-full shadow-lg overflow-hidden mb-2">
                <button
                    onClick={handleZoomIn}
                    className="p-3 text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                >
                    <Plus size={24} />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-3 text-gray-700 hover:bg-gray-50"
                >
                    <Minus size={24} />
                </button>
            </div>

            {/* Compass Button */}
            <button
                onClick={handleCompass}
                className={`bg-white p-3 rounded-full shadow-lg text-gray-700 hover:bg-gray-50 transition-colors ${isCompassActive ? 'text-blue-600' : ''}`}
            >
                <Compass size={24} className={isCompassActive ? "fill-blue-100" : ""} />
            </button>

            <button
                onClick={toggleMapType}
                className="bg-white p-3 rounded-full shadow-lg text-gray-700 hover:bg-gray-50"
            >
                {mapType === 'roadmap' ? <Layers size={24} /> : <MapIcon size={24} />}
            </button>
            <button
                onClick={handleLocateMe}
                className="bg-white p-3 rounded-full shadow-lg text-gray-700 hover:bg-gray-50"
            >
                <Locate size={24} />
            </button>
        </div>
    );

    // If there's an active trip, render the Active Trip UI (Full Screen Mode)
    if (currentTrip) {
        return (
            <div className="relative h-full w-full flex flex-col">
                <div className="absolute inset-0 z-0">
                    <Map
                        key="active-trip-map"
                        ref={mapRef}
                        className="w-full h-full"
                        mapType={mapType}
                        centerOnLocationTrigger={centerTrigger}
                        origin={currentLocation}
                        destination={currentTrip.status === 'accepted' ? currentTrip.pickup.coordinates : currentTrip.dropoff.coordinates}
                        showDirections={true}
                        onDirectionsResult={handleDirectionsResult}
                        markers={getMarkers()}
                    />
                </div>

                {renderMapControls()}

                {/* Active Trip Card */}
                <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                    {/* Toggle Header (Always Visible) */}
                    <div
                        onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                        className="w-full flex flex-col items-center justify-center pt-4 pb-2 cursor-pointer active:bg-gray-50 rounded-t-3xl touch-manipulation"
                    >
                        <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-2"></div>
                        {isPanelExpanded ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronUp size={20} className="text-gray-400" />}
                    </div>

                    {/* EXPANDED CONTENT with Smooth Transition */}
                    <div className={`transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden ${isPanelExpanded ? 'max-h-[85vh] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
                            <div className="mb-2 pt-2">
                                {/* Status Header Full */}
                                <div className="flex items-center justify-between mb-6">
                                    <span className={`px-5 py-2.5 rounded-full text-sm font-bold shadow-sm ${currentTrip.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                                        'bg-green-100 text-green-800'
                                        }`}>
                                        {currentTrip.status === 'accepted' ? 'Ir a recoger' : 'En viaje'}
                                    </span>
                                    <div className="text-right flex flex-col items-end">
                                        <p className="text-3xl font-black text-gray-900 tracking-tight">${currentTrip.fare}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${currentTrip.paymentMethod?.type === 'cash' ? 'bg-green-100 text-green-800' :
                                                currentTrip.paymentMethod?.type === 'pago_movil' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-indigo-100 text-indigo-800'
                                                }`}>
                                                {currentTrip.paymentMethod?.type === 'cash' ? 'Efectivo' :
                                                    currentTrip.paymentMethod?.type === 'pago_movil' ? 'Pago Móvil' :
                                                        'Tarjeta'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Rider Info Card */}
                                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl mb-6 shadow-sm border border-gray-100">
                                    <div className="w-14 h-14 rounded-full overflow-hidden shadow-md shrink-0 border-2 border-white ring-2 ring-gray-100">
                                        {currentTrip.riderPhoto ? (
                                            <img
                                                src={currentTrip.riderPhoto}
                                                alt="Pasajero"
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.target.style.display = 'none'}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl">
                                                {currentTrip.riderName?.[0] || 'P'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-lg text-gray-800 truncate">{currentTrip.riderName || 'Pasajero'}</p>
                                        <p className="text-sm text-gray-500 truncate flex items-center gap-1">
                                            <MapIcon size={12} /> {currentTrip.pickup?.address || 'Ubicación de recogida'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsChatOpen(true)}
                                        className="w-12 h-12 bg-blue-600 active:bg-blue-700 text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                                    >
                                        <MessageCircle size={24} />
                                    </button>
                                </div>

                                {/* Actions Area */}
                                {currentTrip.status === 'accepted' ? (
                                    <div className="space-y-3">
                                        {/* Navigation Button */}
                                        <button
                                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentTrip.pickup.coordinates.lat},${currentTrip.pickup.coordinates.lng}&travelmode=driving`, '_system')}
                                            className="w-full py-4 bg-white border-2 border-indigo-50 text-indigo-600 font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all"
                                        >
                                            <Navigation size={20} className="fill-indigo-600" />
                                            Navegar
                                        </button>

                                        {/* Start Trip Button */}
                                        <button
                                            onClick={handleStartTrip}
                                            className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:bg-black active:scale-[0.98] transition-all text-lg flex items-center justify-center gap-3 tracking-wide"
                                        >
                                            <Power size={22} className="text-green-400" />
                                            INICIAR VIAJE
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleCompleteTrip}
                                            className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:bg-green-700 active:scale-[0.98] transition-all text-lg flex items-center justify-center gap-3 tracking-wide"
                                        >
                                            <CheckCircle size={24} />
                                            FINALIZAR VIAJE
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (window.confirm("⚠️ ¿Estás seguro de cancelar este viaje en curso? Úsalo solo en emergencias.")) {
                                                    completeTrip(currentTrip.id, 0);
                                                }
                                            }}
                                            className="mt-4 w-full py-3 text-red-500 font-medium text-sm flex items-center justify-center gap-1 opacity-70 hover:opacity-100"
                                        >
                                            Cancelar Viaje
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {isChatOpen && currentTrip && (
                    <Chat
                        tripId={currentTrip.id}
                        currentUser={currentUser}
                        otherUserName={currentTrip.riderName || 'Pasajero'}
                        otherUserDecoratedName="Pasajero"
                        onClose={() => setIsChatOpen(false)}
                    />
                )}
            </div>
        );
    }

    // Default Driver View (Waiting for requests)
    return (
        <div className="relative h-full w-full flex flex-col overflow-hidden">
            {/* Map Background */}
            <div className="absolute inset-0 z-0">
                <Map
                    key="idle-map"
                    ref={mapRef}
                    className="w-full h-full"
                    mapType={mapType}
                    centerOnLocationTrigger={centerTrigger}
                />
            </div>

            {renderMapControls()}

            {/* UNIFIED BOTTOM PANEL */}
            <div className={`absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-5px_30px_rgba(0,0,0,0.15)] transition-all duration-300 pb-[calc(env(safe-area-inset-bottom)+1rem)]`}>

                {/* Header / Control Bar */}
                <div
                    className="flex flex-col items-center pt-3 pb-2 bg-white rounded-t-3xl cursor-pointer"
                    onClick={() => setShowBottomPanel(!showBottomPanel)}
                >
                    {/* Handle */}
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-2"></div>
                    {showBottomPanel ? <ChevronDown size={20} className="text-gray-400 mb-2" /> : <ChevronUp size={20} className="text-gray-400 mb-2" />}

                    {/* Status Row */}
                    <div className="w-full px-6 flex items-center justify-between mb-2">
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Tu Estado</span>
                            <span className={`font-bold text-lg ${isDriverOnline ? 'text-green-600' : 'text-gray-500'}`}>
                                {isDriverOnline ? 'Disponible' : 'Desconectado'}
                            </span>
                        </div>

                        {/* BCV Ticker (Compact) */}
                        <div className="bg-black/90 px-3 py-1.5 rounded-full flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">BCV</span>
                            <span className="text-xs font-bold text-white font-mono">{bcvRate ? bcvRate.toFixed(2) : '---'} Bs</span>
                        </div>

                        {/* Online Toggle Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsDriverOnline(!isDriverOnline);
                            }}
                            className={`pl-4 pr-6 py-2.5 rounded-full font-bold text-white shadow-lg transform active:scale-95 transition-all flex items-center gap-2 ${isDriverOnline ? 'bg-black' : 'bg-red-500'
                                }`}
                        >
                            <Power size={18} />
                            {isDriverOnline ? 'ON' : 'OFF'}
                        </button>
                    </div>
                </div>

                {/* ---- BANNER DE VERIFICACIÓN ---- */}
                {(() => {
                    const vs = userProfile?.verificationStatus;
                    const isVerified = userProfile?.isVerified;
                    // No mostrar si ya está verificado o aprobado
                    if (isVerified || vs === 'approved') return null;

                    if (vs === 'pending') {
                        return (
                            <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                                <Clock size={18} className="text-amber-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-amber-800">Verificación en revisión</p>
                                    <p className="text-[10px] text-amber-600">Tu cuenta será activada en 24-48h</p>
                                </div>
                            </div>
                        );
                    }

                    // Sin verificar — banne rojo con CTA a perfil
                    return (
                        <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                            <AlertCircle size={18} className="text-red-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-red-800">Cuenta sin verificar</p>
                                <p className="text-[10px] text-red-600">Ve a Perfil para subir tus documentos</p>
                            </div>
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                        </div>
                    );
                })()}

                <div className={`transition-all duration-300 overflow-hidden bg-gray-50 ${showBottomPanel ? 'max-h-[60vh] opacity-100' : 'max-h-0 opacity-0'}`}>

                    {isDriverOnline ? (
                        <>
                            {/* Requests List */}
                            {nearbyTrips.length > 0 ? (
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center gap-2 px-2 mb-2">
                                        <Bell size={16} className="text-indigo-600" />
                                        <span className="font-bold text-gray-700">Solicitudes Nuevas ({nearbyTrips.length})</span>
                                    </div>

                                    {nearbyTrips.map((trip) => {

                                        // Calculate trip distance (Pickup -> Dropoff) fallback
                                        let tripDistanceDisplay = trip.distanceText;
                                        if (!tripDistanceDisplay && trip.pickup?.coordinates && trip.dropoff?.coordinates) {
                                            const directDist = calculateDistance(
                                                trip.pickup.coordinates.lat,
                                                trip.pickup.coordinates.lng,
                                                trip.dropoff.coordinates.lat,
                                                trip.dropoff.coordinates.lng
                                            );
                                            tripDistanceDisplay = `${directDist} km (aprox)`;
                                        }

                                        // Driver to Pickup Distance
                                        const distanceToPickup = currentLocation ?
                                            calculateDistance(currentLocation.lat, currentLocation.lng, trip.location?.lat, trip.location?.lng) : null;

                                        return (
                                            <div key={trip.id} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                                                {/* Header: Rider Info & Price */}
                                                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-50">
                                                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 shrink-0 border border-gray-100 shadow-sm">
                                                        {trip.riderPhoto ? (
                                                            <img
                                                                src={trip.riderPhoto}
                                                                alt="Pasajero"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => e.target.style.display = 'none'}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg bg-gray-50">
                                                                {trip.riderName?.[0] || 'P'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-bold text-gray-900 text-lg block leading-tight truncate">
                                                            {trip.riderName || 'Pasajero'}
                                                        </span>

                                                        {tripDistanceDisplay && (
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                                                    {tripDistanceDisplay}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block font-black text-2xl text-green-600 tracking-tight">${trip.fare}</span>
                                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${trip.paymentMethod?.type === 'cash' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                                                            }`}>
                                                            {trip.paymentMethod?.type === 'cash' ? 'Efectivo' : 'Digital'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-600 mb-3 block space-y-1">
                                                    <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full"></div> {trip.pickup?.address}</div>
                                                    <div className="flex items-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full"></div> {trip.dropoff?.address}</div>
                                                </div>
                                                <button
                                                    onClick={() => handleAcceptTrip(trip.id)}
                                                    className="w-full py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 flex justify-center items-center gap-2"
                                                >
                                                    Aceptar {distanceToPickup ? `(${distanceToPickup} km)` : ''}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 text-center">
                                    <p className="text-gray-400 text-sm mb-6">Buscando viajes cercanos...</p>

                                    {/* Stats (When idle) */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                            <p className="text-xs text-gray-400 uppercase font-bold">Ganancias</p>
                                            <p className="text-xl font-black text-green-600">${stats.earnings.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                            <p className="text-xs text-gray-400 uppercase font-bold">Viajes</p>
                                            <p className="text-xl font-black text-blue-600">{stats.trips}</p>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                            <p className="text-xs text-gray-400 uppercase font-bold">Horas</p>
                                            <p className="text-xl font-black text-purple-600">--</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="p-8 text-center text-gray-400">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                <Power size={32} />
                            </div>
                            <p>Estás desconectado.</p>
                            <p className="text-sm mt-2">Activa el estado "Online" para recibir solicitudes.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DriverHome;
