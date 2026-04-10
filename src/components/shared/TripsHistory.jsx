import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { Calendar, MapPin, DollarSign, Clock, XCircle, CheckCircle } from 'lucide-react';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const getStaticMapUrl = (pickup, dropoff) => {
    if (!pickup?.coordinates || !dropoff?.coordinates) return null;
    const { lat: lat1, lng: lng1 } = pickup.coordinates;
    const { lat: lat2, lng: lng2 } = dropoff.coordinates;
    const origin = `${lat1},${lng1}`;
    const dest = `${lat2},${lng2}`;
    const params = new URLSearchParams({
        size: '600x160',
        scale: '2',
        maptype: 'roadmap',
        markers: `color:green|label:A|${origin}`,
        path: `color:0x4F46E5CC|weight:4|${origin}|${dest}`,
        key: MAPS_KEY,
    });
    // Add destination marker separately
    return `https://maps.googleapis.com/maps/api/staticmap?${params}&markers=color:red|label:B|${dest}`;
};

const TripsHistory = () => {
    const { currentUser, userProfile } = useAuth();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [pullY, setPullY] = useState(0);
    const containerRef = React.useRef(null);
    const touchStartRef = React.useRef(0);

    const handleTouchStart = (e) => {
        if (containerRef.current.scrollTop === 0) {
            touchStartRef.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e) => {
        const touchY = e.touches[0].clientY;
        const diff = touchY - touchStartRef.current;
        if (containerRef.current.scrollTop === 0 && diff > 0 && diff < 150) {
            setPullY(diff);
        }
    };

    const handleTouchEnd = () => {
        if (pullY > 80) { // Threshold to trigger refresh
            setLoading(true);
            setRefreshTrigger(prev => prev + 1); // Trigger re-fetch
        }
        setPullY(0);
        touchStartRef.current = 0;
    };

    useEffect(() => {
        if (!currentUser || !userProfile) return;

        console.log("Loading history for:", userProfile.userType, currentUser.uid);

        const tripsRef = collection(db, 'llevame_trips');
        const roleField = userProfile.userType === 'driver' ? 'driverId' : 'riderId';

        // Query without orderBy to avoid composite index requirements for MVP
        // Filtering by role and status (completed or cancelled)
        const q = query(
            tripsRef,
            where(roleField, '==', currentUser.uid),
            where('status', 'in', ['completed', 'cancelled']),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tripsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Helper to convert Firestore Timestamp safely
                createdAtDate: doc.data().createdAt?.toDate() || new Date()
            }));

            // Sort in memory to avoid index creation delay
            tripsData.sort((a, b) => b.createdAtDate - a.createdAtDate);

            setTrips(tripsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching history:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, userProfile, refreshTrigger]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full p-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (trips.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Clock size={40} className="text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-600">Sin viajes aún</h3>
                <p className="text-sm">Tu historial de viajes aparecerá aquí.</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="h-full bg-gray-50 overflow-y-auto pb-24 relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull Indicator */}
            <div
                className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none transition-all duration-300 overflow-hidden"
                style={{ height: `${pullY}px`, opacity: pullY > 0 ? 1 : 0 }}
            >
                <div className="bg-white rounded-full p-2 shadow-md">
                    <div className={`animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full ${pullY > 80 ? 'block' : 'hidden'}`} />
                    <span className={`text-xs text-gray-400 font-bold ${pullY <= 80 ? 'block' : 'hidden'}`}>Desliza para actualizar</span>
                </div>
            </div>

            <div className="bg-white p-6 pt-12 rounded-b-3xl shadow-sm mb-4 sticky top-0 z-10">
                <h1 className="text-2xl font-black text-gray-900">Historial</h1>
                <p className="text-sm text-gray-500">{trips.length} viajes realizados</p>
            </div>

            <div className="px-4 space-y-3">
                {trips.map(trip => (
                    <div key={trip.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        {/* Header: Date + Status */}
                        <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-50">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
                                <Calendar size={14} />
                                {trip.createdAtDate.toLocaleDateString()} • {trip.createdAtDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase flex items-center gap-1
                                ${trip.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {trip.status === 'completed' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                {trip.status === 'completed' ? 'Completado' : 'Cancelado'}
                            </span>
                        </div>

                        {/* Route Info */}
                        <div className="space-y-3 mb-4">
                            <div className="flex gap-3">
                                <div className="flex flex-col items-center pt-1">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <div className="w-0.5 h-full bg-gray-100 my-1"></div>
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold uppercase">Recogida</p>
                                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{trip.pickup.address}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-bold uppercase">Destino</p>
                                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{trip.dropoff.address}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mapa estático de la ruta */}
                        {(() => {
                            const mapUrl = getStaticMapUrl(trip.pickup, trip.dropoff);
                            return mapUrl ? (
                                <div className="mb-4 rounded-xl overflow-hidden border border-gray-100 bg-gray-50 h-24">
                                    <img
                                        src={mapUrl}
                                        alt="Ruta del viaje"
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(e) => { e.target.closest('div').style.display = 'none'; }}
                                    />
                                </div>
                            ) : null;
                        })()}

                        {/* Footer: Price & Payment */}
                        <div className="flex justify-between items-center pt-2">
                            <div className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded uppercase">
                                {trip.paymentMethod?.type === 'cash' ? 'Efectivo' :
                                    trip.paymentMethod?.type === 'pago_movil' ? 'Pago Móvil' : 'Tarjeta'}
                            </div>
                            <div className="text-xl font-black text-gray-900 flex items-center">
                                <span className="text-xs mr-0.5 text-gray-400">$</span>
                                {trip.fare}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TripsHistory;
