import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, X, Loader } from 'lucide-react';
import {
    getAutocompleteSuggestions,
    getPlaceDetails,
    generateSessionToken,
} from '../../services/placesService';

/**
 * PlaceSearch — Buscador de lugares usando Places API (New) via REST.
 *
 * Reemplaza la versión anterior que dependía del SDK de JS de Google Maps.
 * La UI es idéntica — solo cambió la capa de datos.
 */
const PlaceSearch = ({
    onPlaceSelect,
    placeholder = 'Buscar ubicación',
    initialValue = '',
    locationBias = null, // { lat, lng } del usuario para mejorar resultados
}) => {
    const [query, setQuery] = useState(initialValue);
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Token de sesión: agrupa autocomplete + getDetails en una sola sesión de facturación
    const sessionTokenRef = useRef(generateSessionToken());
    const debounceRef = useRef(null);
    const wrapperRef = useRef(null);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─────────────────────────────────────────────
    // Input con debounce para no disparar una request por cada tecla
    // ─────────────────────────────────────────────
    const handleInput = useCallback((e) => {
        const val = e.target.value;
        setQuery(val);
        setIsOpen(true);

        if (!val || val.trim().length < 2) {
            setSuggestions([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            const results = await getAutocompleteSuggestions(
                val,
                sessionTokenRef.current,
                locationBias,
            );
            setSuggestions(results);
            setIsLoading(false);
        }, 300); // 300ms debounce
    }, [locationBias]);

    // ─────────────────────────────────────────────
    // Selección de un resultado
    // ─────────────────────────────────────────────
    const handleSelect = useCallback(async (suggestion) => {
        setQuery(suggestion.description || suggestion.mainText);
        setIsOpen(false);
        setSuggestions([]);
        setIsLoading(true);

        const details = await getPlaceDetails(suggestion.placeId, sessionTokenRef.current);

        setIsLoading(false);

        // Generar nuevo token para la próxima sesión
        sessionTokenRef.current = generateSessionToken();

        if (details) {
            onPlaceSelect({
                address: details.address,
                name: details.name || suggestion.mainText,
                coordinates: details.coordinates,
            });
        } else {
            console.error('[PlaceSearch] No se obtuvieron detalles para:', suggestion.placeId);
        }
    }, [onPlaceSelect]);

    // ─────────────────────────────────────────────
    // Limpiar input
    // ─────────────────────────────────────────────
    const clearInput = useCallback(() => {
        setQuery('');
        setSuggestions([]);
        setIsOpen(false);
        onPlaceSelect(null);
        sessionTokenRef.current = generateSessionToken();
    }, [onPlaceSelect]);

    // ─────────────────────────────────────────────
    // Render — misma UI que antes
    // ─────────────────────────────────────────────
    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border-2 border-indigo-200 focus-within:border-indigo-500 transition-colors">
                {isLoading
                    ? <Loader size={20} className="text-indigo-600 shrink-0 animate-spin" />
                    : <MapPin size={20} className="text-indigo-600 shrink-0" />
                }
                <input
                    type="text"
                    placeholder={placeholder}
                    className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                    value={query}
                    onChange={handleInput}
                    onFocus={() => query && suggestions.length > 0 && setIsOpen(true)}
                />
                {query && (
                    <button onClick={clearInput} className="p-1 hover:bg-gray-200 rounded-full">
                        <X size={16} className="text-gray-500" />
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {isOpen && suggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-xl max-h-60 overflow-y-auto border border-gray-100">
                    {suggestions.map((suggestion) => (
                        <button
                            key={suggestion.placeId}
                            onClick={() => handleSelect(suggestion)}
                            className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-3 transition-colors"
                        >
                            <div className="mt-1 bg-gray-100 p-1.5 rounded-full">
                                <MapPin size={14} className="text-gray-500" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-800 text-sm">{suggestion.mainText}</p>
                                <p className="text-xs text-gray-500">{suggestion.secondaryText}</p>
                            </div>
                        </button>
                    ))}
                    <div className="p-2 text-right">
                        <img
                            src="https://developers.google.com/static/maps/documentation/images/powered_by_google_on_white.png"
                            alt="Powered by Google"
                            className="h-4 inline-block opacity-50"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlaceSearch;
