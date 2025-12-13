// StatusBarBackground.jsx
// Componente que crea un fondo negro para la barra de estado
// Necesario en Android 15+ donde la barra es transparente por defecto

import React from 'react';
import { Capacitor } from '@capacitor/core';

const StatusBarBackground = () => {
    // Solo mostrar en plataforma nativa
    if (!Capacitor.isNativePlatform()) {
        return null;
    }

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[9999] bg-black"
            style={{
                height: 'env(safe-area-inset-top, 24px)',
                minHeight: '24px'
            }}
        />
    );
};

export default StatusBarBackground;
