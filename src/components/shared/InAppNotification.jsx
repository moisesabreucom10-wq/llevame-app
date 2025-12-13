import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, MessageCircle, Check, X, Car, Package, Bell, User } from 'lucide-react';

// Sistema de notificaciones elegantes in-app
const InAppNotification = () => {
    const [notifications, setNotifications] = useState([]);

    // Función global para mostrar notificaciones
    useEffect(() => {
        window.showInAppNotification = (type, title, message, data = {}) => {
            const id = Date.now();
            const notification = { id, type, title, message, data, visible: true };

            setNotifications(prev => [...prev, notification]);

            // Auto-dismiss después de 4 segundos
            setTimeout(() => {
                dismissNotification(id);
            }, 4000);
        };

        return () => {
            delete window.showInAppNotification;
        };
    }, []);

    const dismissNotification = useCallback((id) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, visible: false } : n)
        );
        // Remover del DOM después de la animación
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 300);
    }, []);

    const getIcon = (type) => {
        switch (type) {
            case 'driver_accepted':
                return <Car className="text-white" size={24} />;
            case 'driver_nearby':
            case 'driver_arrived':
                return <MapPin className="text-white" size={24} />;
            case 'message':
                return <MessageCircle className="text-white" size={24} />;
            case 'trip_completed':
                return <Check className="text-white" size={24} />;
            case 'trip_cancelled':
                return <X className="text-white" size={24} />;
            case 'new_ride':
                return <Bell className="text-white" size={24} />;
            case 'package':
                return <Package className="text-white" size={24} />;
            default:
                return <Bell className="text-white" size={24} />;
        }
    };

    const getGradient = (type) => {
        switch (type) {
            case 'driver_accepted':
                return 'from-emerald-500 to-green-600';
            case 'driver_nearby':
                return 'from-amber-500 to-orange-600';
            case 'driver_arrived':
                return 'from-blue-500 to-indigo-600';
            case 'message':
                return 'from-violet-500 to-purple-600';
            case 'trip_completed':
                return 'from-green-500 to-emerald-600';
            case 'trip_cancelled':
                return 'from-red-500 to-rose-600';
            case 'new_ride':
                return 'from-indigo-500 to-blue-600';
            case 'package':
                return 'from-amber-500 to-yellow-600';
            default:
                return 'from-gray-700 to-gray-800';
        }
    };

    const getAccentColor = (type) => {
        switch (type) {
            case 'driver_accepted':
                return 'bg-emerald-400';
            case 'driver_nearby':
                return 'bg-amber-400';
            case 'driver_arrived':
                return 'bg-blue-400';
            case 'message':
                return 'bg-violet-400';
            case 'trip_completed':
                return 'bg-green-400';
            case 'trip_cancelled':
                return 'bg-red-400';
            case 'new_ride':
                return 'bg-indigo-400';
            default:
                return 'bg-gray-400';
        }
    };

    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none px-4 pt-safe-top">
            <div className="flex flex-col gap-3 pt-4">
                {notifications.map((notification) => (
                    <div
                        key={notification.id}
                        className={`
                            pointer-events-auto
                            transform transition-all duration-300 ease-out
                            ${notification.visible
                                ? 'translate-y-0 opacity-100 scale-100'
                                : '-translate-y-full opacity-0 scale-95'}
                        `}
                    >
                        <div
                            className={`
                                relative overflow-hidden
                                bg-gradient-to-r ${getGradient(notification.type)}
                                rounded-2xl shadow-2xl
                                backdrop-blur-xl
                            `}
                            onClick={() => dismissNotification(notification.id)}
                        >
                            {/* Shimmer Effect */}
                            <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute -inset-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent"
                                    style={{ animationDuration: '2s' }} />
                            </div>

                            {/* Content */}
                            <div className="relative flex items-center gap-4 p-4">
                                {/* Icon Container */}
                                <div className={`
                                    flex-shrink-0 w-12 h-12 rounded-full 
                                    ${getAccentColor(notification.type)}
                                    flex items-center justify-center
                                    shadow-lg
                                `}>
                                    {getIcon(notification.type)}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-bold text-base leading-tight">
                                        {notification.title}
                                    </h4>
                                    <p className="text-white/80 text-sm mt-0.5 truncate">
                                        {notification.message}
                                    </p>
                                </div>

                                {/* Close Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dismissNotification(notification.id);
                                    }}
                                    className="flex-shrink-0 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                                >
                                    <X size={16} className="text-white" />
                                </button>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-1 bg-black/20">
                                <div
                                    className="h-full bg-white/50 animate-shrink"
                                    style={{ animationDuration: '4s' }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InAppNotification;

// CSS que necesitas agregar a tu index.css:
/*
@keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

@keyframes shrink {
    0% { width: 100%; }
    100% { width: 0%; }
}

.animate-shimmer {
    animation: shimmer 2s infinite;
}

.animate-shrink {
    animation: shrink 4s linear forwards;
}
*/
