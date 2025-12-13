import React, { useState, useEffect, useRef } from 'react';
import Map from '../shared/Map';
import PlaceSearch from '../shared/PlaceSearch';
import { MapPin, Navigation, Search, Menu, MessageCircle, Phone, X, AlertCircle, Compass, Layers, Locate, Minus, Plus, Settings, ChevronDown, ChevronUp, Map as MapIcon, User, Star, Car, Clock, ArrowLeft, DollarSign, Package } from 'lucide-react';
import Chat from '../shared/Chat';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { loadGoogleMaps, getReverseGeocode } from '../../services/maps';
import { useTrip } from '../../context/TripContext';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import PaymentMethodSelector from '../shared/PaymentMethodSelector';


const RiderHome = () => {
    const { currentUser } = useAuth(); // Needed for Chat
    const [showRequestModal, setShowRequestModal] = useState(false);
    const mapRef = useRef(null);

    // Trip Request State
    const [destination, setDestination] = useState('');
    const [destinationAddress, setDestinationAddress] = useState(''); // Added missing state
    const [centerTrigger, setCenterTrigger] = useState(0);
    const [destinationLocation, setDestinationLocation] = useState(null);
    const [isPanelExpanded, setIsPanelExpanded] = useState(true); // Control panel visibility
    const [estimatedDetails, setEstimatedDetails] = useState(null);

    // Payment State (NEW)
    const [paymentMethod, setPaymentMethod] = useState({ type: 'cash' });

    // Vehicle & Negotiation State (NEW)
    const [vehicleType, setVehicleType] = useState('moto'); // Default checked to Moto for cheap rides
    const [isNegotiating, setIsNegotiating] = useState(false);
    const [customFare, setCustomFare] = useState('');
    const [bcvRate, setBcvRate] = useState(60.00); // Default Fallback


    // Service Type State (NEW - Viaje o Paquete)
    const [serviceType, setServiceType] = useState('ride'); // 'ride' | 'package'
    const [packageDescription, setPackageDescription] = useState('');


    // Fetch BCV Rate
    useEffect(() => {
        const fetchBCV = async () => {
            try {
                // Using a known public proxy for Venezuelan rates or a hardcoded fallback update mechanism
                // For now, we simulate a fetch or use a stable free API if available.
                // Example: https://pydolarvenezuela-api-yoshimito.vercel.app/api/v1/dollar/page?page=bcv (Often slow)
                // Let's use a mock fetch that simulates getting ~55-60 which is realistic
                // In production, replace with real API:
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

    // Map State
    const [mapType, setMapType] = useState(() => localStorage.getItem('llevame_mapType') || 'roadmap'); // 'roadmap' | 'satellite'
    const [isSelectingOnMap, setIsSelectingOnMap] = useState(false);
    const [mapCenter, setMapCenter] = useState(null);

    const { requestRide, currentTrip, loading, cancelTrip, db } = useTrip();
    const { currentLocation, getCurrentPosition } = useLocation();
    const [hasCenteredInitial, setHasCenteredInitial] = useState(false);
    const [nearbyDrivers, setNearbyDrivers] = useState([]);
    const [selectedDriver, setSelectedDriver] = useState(null); // To show info modal
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Haversine formula to calculate distance in km
    const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    };

    const deg2rad = (deg) => {
        return deg * (Math.PI / 180);
    };

    // Listen for real nearby drivers from 'online_drivers'
    useEffect(() => {
        if (!currentLocation || !db) return;

        // Query all online drivers (Optimization: In production use GeoHash/GeoFire)
        const q = query(collection(db, 'online_drivers'), where('status', '==', 'online'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const drivers = [];
            const now = new Date();
            const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

            snapshot.forEach((doc) => {
                const data = doc.data();

                // Filter stales
                if (data.updatedAt) {
                    const lastUpdate = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                    if (now - lastUpdate > STALE_THRESHOLD_MS) return;
                }

                if (data.location) {
                    const distance = getDistanceFromLatLonInKm(
                        currentLocation.lat,
                        currentLocation.lng,
                        data.location.lat,
                        data.location.lng
                    );

                    // Filter by radius (e.g., 700 meters = 0.7 km)
                    if (distance <= 0.7) {
                        drivers.push({
                            id: doc.id,
                            position: data.location,
                            ...data
                        });
                    }
                }
            });
            setNearbyDrivers(drivers);
        });

        return () => unsubscribe();
    }, [currentLocation, db]);

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

    // Reset details when destination changes
    useEffect(() => {
        if (!destinationLocation) {
            setEstimatedDetails(null);
        }
    }, [destinationLocation]);

    const handlePlaceSelect = (place) => {
        if (place) {
            setDestination(place.name);
            setDestinationAddress(place.address);
            setDestinationLocation(place.coordinates);
        } else {
            setDestination('');
            setDestinationAddress('');
            setDestinationLocation(null);
        }
    };

    const startMapSelection = () => {
        setIsSelectingOnMap(true);
        setShowRequestModal(false);
    };

    const confirmMapSelection = async () => {
        let center = mapCenter;

        // Force get fresh center from map instance if available
        if (mapRef.current && mapRef.current.getCenter) {
            const fresh = mapRef.current.getCenter();
            if (fresh) center = fresh;
        }

        if (center) {
            // Set coordinates immediately
            setDestinationLocation(center);
            const coordsString = `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
            setDestination(`Ubicación (${coordsString})`); // Temporary default
            setDestinationAddress(coordsString);

            setIsSelectingOnMap(false);
            setShowRequestModal(true);

            // Fetch real address
            try {
                const address = await getReverseGeocode(center.lat, center.lng);
                if (address) {
                    setDestination(address); // Shows: "Av. Bolívar, Charallave"
                    setDestinationAddress(address);
                }
            } catch (error) {
                console.warn("Geocoding failed", error);
            }

        } else {
            console.error("ConfirmMapSelection: No center detected");
            alert("Mueve el mapa ligeramente para confirmar la ubicación.");
        }
    };

    const cancelMapSelection = () => {
        setIsSelectingOnMap(false);
        setShowRequestModal(true);
    };

    const handleRequestRide = async () => {
        if (!destination || !currentLocation || !destinationLocation) return;

        // Pricing Logic (Tiered)
        const calculateTieredFare = (km, type) => {
            let price = 0.40;
            const tier1Km = Math.min(km, 5);
            price += tier1Km * 0.15;
            if (km > 5) {
                const tier2Km = Math.min(km - 5, 15);
                price += tier2Km * 0.55;
            }
            if (km > 20) {
                const tier3Km = km - 20;
                price += tier3Km * 1.05;
            }
            if (type === 'car') price = price * 1.4;
            if (type === 'premium') price = price * 1.9;
            return price;
        };

        const distKm = estimatedDetails ? estimatedDetails.distance.value / 1000 : 0;
        let rawPrice = calculateTieredFare(distKm, vehicleType);

        // Minimum Fares
        if (vehicleType === 'moto' && rawPrice < 1.00) rawPrice = 1.00;
        if (vehicleType === 'car' && rawPrice < 1.50) rawPrice = 1.50;
        if (vehicleType === 'premium' && rawPrice < 2.50) rawPrice = 2.50;

        const calculatedFare = estimatedDetails
            ? rawPrice.toFixed(2)
            : rawPrice.toFixed(2);

        // Determine final fare (negotiated or calculated)
        const finalFare = isNegotiating && customFare ? parseFloat(customFare) : Number(calculatedFare);

        if (isNaN(finalFare) || finalFare <= 0) {
            alert("Por favor ingresa un monto válido.");
            return;
        }

        const meta = estimatedDetails ? {
            distanceValue: estimatedDetails.distance.value,
            distanceText: estimatedDetails.distance.text,
            durationValue: estimatedDetails.duration.value,
            durationText: estimatedDetails.duration.text
        } : {};

        // Inject Payment Method & Vehicle Info into Meta
        meta.paymentMethod = paymentMethod;
        meta.vehicleType = vehicleType;
        meta.isNegotiated = isNegotiating;
        meta.originalFare = Number(calculatedFare);

        // Service Type Info (Viaje o Paquete)
        meta.serviceType = serviceType;
        if (serviceType === 'package') {
            meta.packageDescription = packageDescription || 'Paquete sin descripción';
        }

        await requestRide(
            {
                address: "Mi ubicación actual",
                coordinates: currentLocation
            },
            {
                address: destinationAddress || destination,
                coordinates: destinationLocation
            },
            finalFare, // Use final negotiated fare
            meta
        );

        setShowRequestModal(false);
        setDestination('');
        setDestinationAddress('');
        setDestinationLocation(null);
        setEstimatedDetails(null);
        setIsNegotiating(false); // Reset
        setCustomFare(''); // Reset
        setServiceType('ride'); // Reset
        setPackageDescription(''); // Reset
    };

    const toggleMapType = () => {
        // Use 'hybrid' instead of 'satellite' to ensure labels/street names are visible
        const newType = mapType === 'roadmap' ? 'hybrid' : 'roadmap';
        setMapType(newType);
        localStorage.setItem('llevame_mapType', newType);
    };

    const handleDirectionsResult = (result) => {
        setEstimatedDetails(result);
    };

    const handleZoomIn = () => {
        if (mapRef.current) mapRef.current.zoomIn();
    };

    const handleZoomOut = () => {
        if (mapRef.current) mapRef.current.zoomOut();
    };

    const handleLocateMe = () => {
        getCurrentPosition();
        setCenterTrigger(prev => prev + 1);
    };

    // Calculate markers with minimalist flat design + Labels
    const getMarkers = () => {
        const markers = [];
        // Safety check: Ensure Google Maps API is loaded before accessing .maps
        if (!window.google || !window.google.maps) return markers;


        // Determine if we should show trip markers or available cars
        if (!currentTrip) {
            // Show available cars if no trip is active
            if (nearbyDrivers && nearbyDrivers.length > 0) {
                const CAR_MINIMAL = `
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.3"/>
                        </filter>
                        <g filter="url(#shadow)">
                            <circle cx="12" cy="12" r="11" fill="white" stroke="#E5E7EB" stroke-width="1"/>
                            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.29 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 16C5.67 16 5 15.33 5 14.5C5 13.67 5.67 13 6.5 13C7.33 13 8 13.67 8 14.5C8 15.33 7.33 16 6.5 16ZM17.5 16C16.67 16 16 15.33 16 14.5C16 13.67 16.67 13 17.5 13C18.33 13 19 13.67 19 14.5C19 15.33 18.33 16 17.5 16ZM5 11L6.5 6.5H17.5L19 11H5Z" fill="#6B7280"/>
                        </g>
                    </svg>
                `;

                nearbyDrivers.forEach(driver => {
                    markers.push({
                        id: driver.id,
                        position: driver.position,
                        title: 'Conductor cercano',
                        icon: {
                            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(CAR_MINIMAL),
                            scaledSize: new window.google.maps.Size(32, 32),
                            anchor: new window.google.maps.Point(16, 16)
                        },
                        rotation: driver.heading
                    });
                });
            }
            return markers;
        }

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
                title: 'Recogida',
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

        // Driver (Minimalist Car)
        if (currentTrip.driverLocation) {
            const CAR_MINIMAL = `
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.3"/>
                    </filter>
                    <g filter="url(#shadow)">
                        <circle cx="12" cy="12" r="11" fill="white" stroke="#E5E7EB" stroke-width="1"/>
                        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.29 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 16C5.67 16 5 15.33 5 14.5C5 13.67 5.67 13 6.5 13C7.33 13 8 13.67 8 14.5C8 15.33 7.33 16 6.5 16ZM17.5 16C16.67 16 16 15.33 16 14.5C16 13.67 16.67 13 17.5 13C18.33 13 19 13.67 19 14.5C19 15.33 18.33 16 17.5 16ZM5 11L6.5 6.5H17.5L19 11H5Z" fill="#1F2937"/>
                    </g>
                </svg>
            `;

            markers.push({
                id: 'driver',
                position: currentTrip.driverLocation,
                title: 'Conductor',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(CAR_MINIMAL),
                    scaledSize: new window.google.maps.Size(40, 40),
                    anchor: new window.google.maps.Point(20, 20)
                }
            });
        }

        return markers;
    };

    // --- RENDER HELPERS ---

    const renderMapControls = () => (
        <div className="absolute top-36 right-4 flex flex-col gap-3 z-10 pointer-events-auto mt-safe-top">
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

            <button
                className="bg-white p-3 rounded-full shadow-lg text-gray-700 hover:bg-gray-50"
            >
                <Compass size={24} />
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

    // --- MAIN RENDER ---

    // 1. Map Selection Mode
    if (isSelectingOnMap) {
        return (
            <div className="relative h-full w-full">
                <Map
                    ref={mapRef}
                    className="w-full h-full"
                    mapType={mapType}
                    initialCenter={destinationLocation} // Use selected destination as initial center if available
                    onCenterChange={setMapCenter}
                    centerOnLocationTrigger={centerTrigger}
                />

                {renderMapControls()}

                {/* Fixed Center Pin */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 pb-8">
                    <MapPin size={48} className="text-red-500 fill-current drop-shadow-xl animate-bounce-short" />
                    <div className="absolute w-4 h-2 bg-black/20 rounded-full blur-sm mt-12"></div>
                </div>

                {/* Controls */}
                <div className="absolute top-0 left-0 right-0 p-4 pt-safe-top z-30 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-gray-100 text-center pointer-events-auto">
                        <p className="font-bold text-gray-800">Mueve el mapa para ubicar el destino</p>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] z-30 flex gap-4 pointer-events-none">
                    <button
                        onClick={cancelMapSelection}
                        className="bg-white text-gray-700 p-4 rounded-xl shadow-lg font-bold flex-1 pointer-events-auto"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={confirmMapSelection}
                        className="bg-black text-white p-4 rounded-xl shadow-lg font-bold flex-[2] pointer-events-auto"
                    >
                        Confirmar ubicación
                    </button>
                </div>
            </div>
        );
    }

    // 2. Main View
    return (
        <div className="relative h-full w-full flex flex-col">
            {/* Map Background */}
            <div className="absolute inset-0 z-0">
                <Map
                    ref={mapRef}
                    className="w-full h-full"
                    mapType={mapType}
                    origin={currentTrip ? currentTrip.pickup.coordinates : (showRequestModal && destinationLocation ? currentLocation : null)}
                    destination={currentTrip ? currentTrip.dropoff.coordinates : (showRequestModal ? destinationLocation : null)}
                    showDirections={!!currentTrip || (showRequestModal && !!destinationLocation)}
                    onDirectionsResult={handleDirectionsResult}
                    centerOnLocationTrigger={centerTrigger}
                    markers={getMarkers()} // Pass custom markers
                />
            </div>

            {renderMapControls()}

            {/* Top Header & Search */}
            {!currentTrip && !showRequestModal && (
                <div className="absolute top-0 left-0 right-0 z-10 flex flex-col pointer-events-none pt-safe-top">

                    {/* Row 1: Search Trigger */}
                    <div className="p-4 pt-2 pointer-events-auto">
                        <button
                            onClick={() => setShowRequestModal(true)}
                            className="bg-white rounded-2xl shadow-lg p-4 flex items-center gap-3 w-full hover:shadow-xl transition-shadow"
                        >
                            <div className="w-2 h-2 bg-black rounded-full"></div>
                            <span className="text-gray-500 font-medium text-lg">¿A dónde vas?</span>
                        </button>
                    </div>

                    {/* Row 2: Counter + BCV Rate */}
                    <div className="flex items-center justify-center gap-3 pb-4 pointer-events-auto">
                        {/* Vehicles Counter */}
                        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${nearbyDrivers.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
                            <span className="text-sm font-bold text-gray-700">
                                {nearbyDrivers.length > 0 ? `${nearbyDrivers.length} autos` : 'Buscando...'}
                            </span>
                        </div>

                        {/* BCV Ticker */}
                        <div className="bg-black/80 backdrop-blur-md px-3 py-2 rounded-full flex items-center gap-2 shadow-lg border border-white/10">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">BCV</span>
                            <span className="text-sm font-bold text-white font-mono">{bcvRate ? bcvRate.toFixed(2) : '---'} Bs</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Trip In Progress Card */}
            {/* Trip In Progress Card - Collapsible */}
            {currentTrip && (
                <div className={`absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-3xl shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col overflow-hidden ${isPanelExpanded ? 'max-h-[85vh]' : 'max-h-[100px]'}`}
                    style={{ willChange: 'max-height, opacity' }}
                >
                    {/* Handle & Toggle */}
                    <div
                        onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                        className="w-full pt-3 pb-1 flex flex-col items-center justify-center cursor-pointer bg-white active:bg-gray-50 touch-pan-y z-20"
                    >
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-1" />
                        <div className="text-gray-400">
                            {isPanelExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                        </div>
                    </div>

                    {/* Collapsed Minimal View */}
                    {!isPanelExpanded && (
                        <div
                            className="px-8 pb-6 flex items-center justify-between animate-fadeIn cursor-pointer"
                            onClick={() => setIsPanelExpanded(true)}
                        >
                            <div className="flex flex-col">
                                <span className={`text-sm font-bold ${currentTrip.status === 'requested' ? 'text-yellow-600' :
                                    currentTrip.status === 'accepted' ? 'text-blue-600' : 'text-green-600'
                                    }`}>
                                    {currentTrip.status === 'requested' ? 'Buscando...' :
                                        currentTrip.status === 'accepted' ? 'Conductor cerca' : 'En camino'}
                                </span>
                                <span className="text-xs text-gray-500 mt-0.5">Desliza para ver detalles</span>
                            </div>
                            <span className="font-black text-xl text-gray-800">${currentTrip.fare}</span>
                        </div>
                    )}

                    {/* Expanded Content */}
                    <div className={`px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] overflow-y-auto transition-opacity duration-300 ${isPanelExpanded ? 'opacity-100' : 'opacity-0 h-0 hidden'}`}>
                        <div className="mb-4 mt-2">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Estado del viaje</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentTrip.status === 'requested' ? 'bg-yellow-100 text-yellow-800' :
                                    currentTrip.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                                        'bg-green-100 text-green-800'
                                    }`}>
                                    {currentTrip.status === 'requested' ? 'Buscando conductor...' :
                                        currentTrip.status === 'accepted' ? 'Conductor en camino' :
                                            'En viaje'}
                                </span>
                            </div>

                            {/* Driver & Trip Info */}
                            {currentTrip.driverName && (
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-6 shadow-inner">
                                    <div className="w-14 h-14 rounded-full overflow-hidden shadow-sm shrink-0 border-2 border-white">
                                        {currentTrip.driverPhoto ? (
                                            <img
                                                src={currentTrip.driverPhoto}
                                                alt="Conductor"
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.target.style.display = 'none'}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xl">
                                                {currentTrip.driverName[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-900 text-lg truncate">{currentTrip.driverName}</p>
                                        <p className="text-sm text-gray-500 truncate">
                                            {typeof currentTrip.driverVehicle === 'object'
                                                ? `${currentTrip.driverVehicle.model || ''} • ${currentTrip.driverVehicle.plate || ''}`
                                                : (currentTrip.driverVehicle || 'Vehículo')}
                                        </p>
                                        <div className="flex items-center gap-1 mt-1">
                                            <Star size={12} className="text-yellow-400 fill-current" />
                                            <span className="text-xs font-bold text-gray-600">4.9</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <button
                                            onClick={() => setIsChatOpen(true)}
                                            className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                                        >
                                            <MessageCircle size={20} />
                                        </button>
                                        <span className="text-[10px] text-gray-400 font-medium">Chat</span>
                                    </div>
                                </div>
                            )}

                            {!currentTrip.driverName && (
                                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300 mb-6">
                                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                                    <p className="text-sm text-gray-500 font-medium">Contactando conductores cercanos...</p>
                                </div>
                            )}

                            {/* Payment Info */}
                            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl mb-6">
                                <span className="text-sm font-bold text-gray-500 uppercase">Monto a pagar</span>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-gray-900 tracking-tight">${currentTrip.fare}</p>
                                    <p className="text-xs text-gray-400 font-medium uppercase mt-0.5">
                                        {currentTrip.paymentMethod?.type === 'cash' ? 'Efectivo' :
                                            currentTrip.paymentMethod?.type === 'pago_movil' ? 'Pago Móvil' :
                                                'Tarjeta'}
                                    </p>
                                </div>
                            </div>

                            {/* Route Info */}
                            <div className="space-y-4 pl-2 relative">
                                <div className="absolute left-3.5 top-2 bottom-8 w-0.5 bg-gray-200" />
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5 ring-4 ring-white shadow-sm"></div>
                                    <div className="flex-1 pb-4 border-b border-gray-50">
                                        <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Origen</p>
                                        <p className="text-sm font-medium text-gray-900 leading-snug">{currentTrip.pickup?.address}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5 ring-4 ring-white shadow-sm"></div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold uppercase mb-0.5">Destino</p>
                                        <p className="text-sm font-medium text-gray-900 leading-snug">{currentTrip.dropoff?.address}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Cancel Button */}
                            {(currentTrip.status === 'requested' || currentTrip.status === 'accepted') && (
                                <button
                                    onClick={() => cancelTrip(currentTrip.id)}
                                    className="w-full mt-8 py-4 bg-white text-red-500 rounded-xl font-bold hover:bg-red-50 transition-colors border border-red-100 shadow-sm flex items-center justify-center gap-2"
                                >
                                    <X size={18} />
                                    Cancelar viaje
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* Request Ride Modal */}
            {showRequestModal && (
                <div className="absolute inset-0 z-20 bg-black/50 flex items-end">
                    <div className="bg-white w-full h-[85vh] rounded-t-3xl flex flex-col animate-slide-up">
                        {/* Header */}
                        <div className="p-6 flex items-center justify-between border-b border-gray-100">
                            <h2 className="text-xl font-bold">{serviceType === 'package' ? '📦 Enviar paquete' : 'Solicitar viaje'}</h2>
                            <button onClick={() => setShowRequestModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-6">
                                {/* Route Inputs */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Origen</label>
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                            <span className="text-gray-700 font-medium">Mi ubicación actual</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Destino</label>
                                        <PlaceSearch
                                            placeholder="Ingresa tu destino"
                                            initialValue={destination}
                                            onPlaceSelect={handlePlaceSelect}
                                        />

                                        <button
                                            onClick={startMapSelection}
                                            className="mt-3 flex items-center gap-2 text-indigo-600 font-medium text-sm hover:text-indigo-800"
                                        >
                                            <MapPin size={16} />
                                            Seleccionar en el mapa
                                        </button>
                                    </div>
                                </div>

                                {/* Service Type Selection (NEW) */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Tipo de servicio</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setServiceType('ride')}
                                            className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${serviceType === 'ride' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}
                                        >
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${serviceType === 'ride' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                <User size={24} />
                                            </div>
                                            <div className="text-left">
                                                <span className="block font-bold text-gray-800">Viaje</span>
                                                <span className="block text-xs text-gray-500">Te llevamos</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setServiceType('package')}
                                            className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${serviceType === 'package' ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:border-gray-200'}`}
                                        >
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${serviceType === 'package' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                <Package size={24} />
                                            </div>
                                            <div className="text-left">
                                                <span className="block font-bold text-gray-800">Paquete</span>
                                                <span className="block text-xs text-gray-500">Envío express</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Package Description (only if package selected) */}
                                {serviceType === 'package' && (
                                    <div className="animate-fadeIn">
                                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Descripción del paquete</label>
                                        <textarea
                                            value={packageDescription}
                                            onChange={(e) => setPackageDescription(e.target.value)}
                                            placeholder="Ej: Caja pequeña con documentos, bolsa de ropa, comida..."
                                            className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition-all resize-none"
                                            rows={3}
                                        />
                                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                            <AlertCircle size={12} />
                                            El conductor no abre ni manipula el contenido
                                        </p>
                                    </div>
                                )}

                                {/* Vehicle Selection */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                                        {serviceType === 'package' ? 'Tipo de envío' : 'Elige tu vehículo'}
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            onClick={() => setVehicleType('moto')}
                                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${vehicleType === 'moto' ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}
                                        >
                                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                                                {/* Moto Icon */}
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 13h-6v6h6v-6z" /><path d="M5 13h6v6H5v-6z" /><path d="M12 9V3" /><path d="M15.5 13a3.5 3.5 0 0 0-7 0" /></svg>
                                            </div>
                                            <div className="text-center">
                                                <span className="block font-bold text-sm text-gray-800">Moto</span>
                                                <span className="block text-xs text-green-600 font-bold">Ahorra</span>
                                            </div>
                                        </button>

                                        {/* Carro - PRÓXIMAMENTE */}
                                        <div className="relative">
                                            <button
                                                disabled
                                                className="p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                                            >
                                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                                                    <Car size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <span className="block font-bold text-sm text-gray-400">Carro</span>
                                                    <span className="block text-xs text-gray-400">Estándar</span>
                                                </div>
                                            </button>
                                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                                PRÓXIMAMENTE
                                            </span>
                                        </div>

                                        {/* VIP - PRÓXIMAMENTE */}
                                        <div className="relative">
                                            <button
                                                disabled
                                                className="p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                                            >
                                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                                                    <Star size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <span className="block font-bold text-sm text-gray-400">VIP</span>
                                                    <span className="block text-xs text-gray-400">Lujo</span>
                                                </div>
                                            </button>
                                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                                PRÓXIMAMENTE
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Estimated Info & Negotiation */}
                                <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                                    {/* Calculation Logic for Display */}
                                    {(() => {
                                        // Advanced Tiered Pricing Function
                                        const calculateTieredFare = (km, type) => {
                                            // Base Baseline (Moto Reference)
                                            // 0-5km: Base 0.40 + 0.15/km (4km = 1.00)
                                            // 5-20km: Previous + 0.55/km (17km = ~8.00)
                                            // 20km+: Previous + 1.00/km (40km = ~30.00)

                                            let price = 0.40; // Base arranque

                                            // Tier 1: First 5km
                                            const tier1Km = Math.min(km, 5);
                                            price += tier1Km * 0.15;

                                            // Tier 2: Next 15km (from 5 to 20)
                                            if (km > 5) {
                                                const tier2Km = Math.min(km - 5, 15);
                                                price += tier2Km * 0.55;
                                            }

                                            // Tier 3: Beyond 20km
                                            if (km > 20) {
                                                const tier3Km = km - 20;
                                                price += tier3Km * 1.05;
                                            }

                                            // Vehicle Multipliers
                                            if (type === 'car') price = price * 1.4; // %40 more expensive
                                            if (type === 'premium') price = price * 1.9; // %90 more expensive

                                            // Rounding
                                            return parseFloat(price.toFixed(2));
                                        };

                                        const distKm = estimatedDetails ? estimatedDetails.distance.value / 1000 : 0;
                                        const rawPrice = calculateTieredFare(distKm, vehicleType);

                                        // Enforce Minimums (Optional override if formula gives less)
                                        let finalPrice = rawPrice;
                                        if (vehicleType === 'moto' && finalPrice < 1.00) finalPrice = 1.00;
                                        if (vehicleType === 'car' && finalPrice < 1.50) finalPrice = 1.50;

                                        // Export for display
                                        const calculatedPrice = estimatedDetails ? finalPrice.toFixed(2) : "0.00";

                                        // BS Conversion
                                        const activePrice = isNegotiating && customFare ? customFare : calculatedPrice;
                                        const conversion = bcvRate ? (parseFloat(activePrice) * bcvRate).toFixed(2) : "---";

                                        return (
                                            <>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Tarifa Sugerida</span>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <DollarSign size={20} className="text-gray-400" />
                                                                <span className={`text-3xl font-black ${isNegotiating ? 'text-gray-300 line-through decoration-2' : 'text-gray-900'}`}>
                                                                    {calculatedPrice}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs font-medium text-gray-500">
                                                                ≈ {conversion} Bs (Tasa: {bcvRate ? bcvRate.toFixed(2) : '--'})
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Cuadralo Toggle */}
                                                    <div className="flex flex-col items-end">
                                                        <button
                                                            onClick={() => setIsNegotiating(!isNegotiating)}
                                                            className={`px-4 py-2 rounded-full font-bold text-sm transition-all flex items-center gap-2 ${isNegotiating ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                        >
                                                            <span>✨ Cuádralo</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Negotiation Input */}
                                                {isNegotiating && (
                                                    <div className="mt-4 animate-fadeIn">
                                                        <label className="text-xs font-bold text-indigo-600 uppercase mb-2 block">Tu Oferta</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                                <DollarSign size={24} className="text-indigo-600" />
                                                            </div>
                                                            <input
                                                                type="number"
                                                                value={customFare}
                                                                onChange={(e) => setCustomFare(e.target.value)}
                                                                placeholder="0.00"
                                                                className="w-full pl-12 pr-4 py-4 bg-indigo-50 border-2 border-indigo-100 rounded-xl text-2xl font-black text-indigo-900 focus:outline-none focus:border-indigo-500 transition-colors placeholder-indigo-200"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-2 text-center">
                                                            Oferta un precio justo para aumentar tus chances.
                                                        </p>
                                                    </div>
                                                )}

                                                {estimatedDetails && (
                                                    <div className="flex gap-4 text-sm text-gray-500 pt-4 mt-2 border-t border-dashed border-gray-200">
                                                        <span className="flex items-center gap-1"><Clock size={14} /> {estimatedDetails.duration.text}</span>
                                                        <span className="flex items-center gap-1"><Navigation size={14} /> {estimatedDetails.distance.text}</span>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Payment Selector */}
                                <div>
                                    <PaymentMethodSelector
                                        selectedMethod={paymentMethod}
                                        onSelect={setPaymentMethod}
                                    />
                                </div>

                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-6 border-t border-gray-100 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                            <button
                                onClick={handleRequestRide}
                                disabled={!destinationLocation || loading}
                                className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all ${!destinationLocation || loading
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-black hover:shadow-xl transform hover:-translate-y-1'
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <span>{loading ? 'Solicitando...' : 'Confirmar viaje'}</span>
                                    {!loading && (
                                        <span className="text-sm font-normal opacity-80">
                                            ({paymentMethod.type === 'cash' ? 'Efectivo' :
                                                paymentMethod.type === 'pago_movil' ? 'Pago Móvil' :
                                                    `• ${paymentMethod.last4}`})
                                        </span>
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Driver Info Modal (Bottom Sheet) */}
            {selectedDriver && (
                <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={() => setSelectedDriver(null)} />
                    <div className="bg-white w-full rounded-t-3xl shadow-2xl p-6 pointer-events-auto transform transition-transform duration-300 animate-slideUp">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Conductor Disponible</h3>
                            <button onClick={() => setSelectedDriver(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                                <X size={20} className="text-gray-600" />
                            </button>
                        </div>

                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                                {selectedDriver.photoURL ? (
                                    <img src={selectedDriver.photoURL} alt="Driver" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={32} className="text-gray-400" />
                                )}
                            </div>
                            <div>
                                <h4 className="font-bold text-lg text-gray-900">{selectedDriver.name || 'Conductor'}</h4>
                                <div className="flex items-center gap-1 text-yellow-500">
                                    <span className="text-sm font-bold">★ {selectedDriver.rating || '5.0'}</span>
                                    <span className="text-xs text-gray-400 font-normal"> • {selectedDriver.trips || 0} viajes</span>
                                </div>
                            </div>
                        </div>

                        {/* Vehicle Details Card */}
                        <div className="bg-gray-50 p-5 rounded-2xl mb-6 border border-gray-100">
                            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vehículo</h5>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg text-gray-600 shadow-sm">
                                        <Car size={24} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-lg leading-tight">
                                            {selectedDriver.vehicleInfo?.model || 'Vehículo'}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {selectedDriver.vehicleInfo?.color || 'Color Desconocido'}
                                        </p>
                                    </div>
                                </div>

                                {/* Plate Badge */}
                                <div className="flex flex-col items-end">
                                    <div className="px-2 py-1 bg-yellow-300 border-2 border-black rounded shadow-sm text-black font-mono font-bold text-sm uppercase">
                                        {selectedDriver.vehicleInfo?.plate || '---'}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Placa</span>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="bg-blue-50 p-4 rounded-xl flex items-center gap-3 text-blue-800 mb-6">
                            <div className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm">
                                {/* Phone icon would need import, using unicode fallback or generic element */}
                                <span className="text-lg">📞</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase opacity-60">Contacto</p>
                                <p className="font-bold">{selectedDriver.phoneNumber || 'No disponible'}</p>
                            </div>
                        </div>

                        <div className="text-center text-gray-400 text-xs mt-4">
                            Selecciona "Solicitar Viaje" para conectar.
                        </div>

                        <button
                            className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
                            onClick={() => {
                                setSelectedDriver(null);
                                // Here you could pre-select this driver for the request
                                alert("Funcionalidad de elegir conductor específico próximamente");
                            }}
                        >
                            Solicitar viaje
                        </button>
                    </div>
                </div>
            )}

            {isChatOpen && currentTrip && (
                <Chat
                    tripId={currentTrip.id}
                    currentUser={currentUser}
                    otherUserName={currentTrip.driverName || 'Conductor'}
                    otherUserDecoratedName="Conductor"
                    onClose={() => setIsChatOpen(false)}
                />
            )}
        </div>
    );
};

export default RiderHome;
