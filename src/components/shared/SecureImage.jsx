import React, { useState, useEffect } from 'react';
import { CapacitorHttp } from '@capacitor/core';

/**
 * SecureImage component loads an image source safely in Capacitor environments.
 */
const SecureImage = ({ src, className, alt, fallback }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let isActive = true;
        let objectUrl = null;

        const load = async () => {
            try {
                // Reset state
                setError(false);
                setLoading(true);

                if (!src) {
                    setLoading(false);
                    return;
                }

                // Enhanced loading for Firebase Storage URLs (or any http) to bypass WebView strictness
                if (typeof src === 'string' && src.startsWith('http')) {
                    if (isActive) {
                        try {
                            const isFirebase = src.includes('firebasestorage.googleapis.com');

                            if (isFirebase) {
                                // Explicitly send empty headers to avoid auto-injection by plugins
                                const result = await CapacitorHttp.get({
                                    url: src,
                                    responseType: 'blob',
                                    headers: {
                                        'Authorization': '',
                                        'Content-Type': ''
                                    }
                                });

                                const { data } = result;

                                if (data && typeof data === 'string' && data.length > 0) {
                                    // Check if it looks like an image or error
                                    const prefix = data.substring(0, 20);

                                    if (!prefix.trim().startsWith('<') && !prefix.includes('Error') && !prefix.includes('{')) {
                                        const lowerSrc = src.toLowerCase();
                                        let mimeType = 'image/jpeg';
                                        if (lowerSrc.includes('.png')) mimeType = 'image/png';
                                        else if (lowerSrc.includes('.jpg') || lowerSrc.includes('.jpeg')) mimeType = 'image/jpeg';
                                        else if (lowerSrc.includes('.gif')) mimeType = 'image/gif';

                                        const base64Src = `data:${mimeType};base64,${data}`;
                                        setImageSrc(base64Src);
                                        setLoading(false);
                                        return;
                                    }
                                }
                            }
                        } catch (nativeErr) {
                            console.error("SecureImage: Native fetch failed", nativeErr);
                        }

                        // Fallback to standard source
                        setImageSrc(src);
                        setLoading(false);
                    }
                    return;
                }

                // For data URIs / Blob URLs, use directly
                if (typeof src === 'string') {
                    if (isActive) {
                        setImageSrc(src);
                        setLoading(false);
                    }
                    return;
                }

            } catch (err) {
                console.error('SecureImage: Error loading image', err);
                if (isActive) {
                    setError(true);
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            isActive = false;
            if (objectUrl) {
                try {
                    URL.revokeObjectURL(objectUrl);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        };
    }, [src]);

    // Render loading state
    if (loading) {
        return <div className={`animate-pulse bg-gray-200 ${className || ''}`} />;
    }

    // Render error/fallback state
    if (error || !imageSrc) {
        return fallback || <div className={`bg-gray-200 ${className || ''}`} />;
    }

    // Render image
    return (
        <img
            src={imageSrc}
            alt={alt || 'Image'}
            className={className || ''}
            onError={() => {
                console.error('SecureImage: Image failed to load', imageSrc);
                setError(true);
            }}
        />
    );
};

export default SecureImage;
