import React, { useState, useEffect, useRef } from 'react';
import { MapPin, X, Loader } from 'lucide-react';
import { loadGoogleMaps } from '../../services/maps';

const PlaceSearch = ({ onPlaceSelect, placeholder = "Buscar ubicación", initialValue = "" }) => {
    const [query, setQuery] = useState(initialValue);
    const [predictions, setPredictions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [googleApi, setGoogleApi] = useState(null);
    const [autocompleteService, setAutocompleteService] = useState(null);
    const [placesService, setPlacesService] = useState(null);
    const wrapperRef = useRef(null);

    // Load Google Maps API directly
    useEffect(() => {
        const init = async () => {
            try {
                const google = await loadGoogleMaps();
                setGoogleApi(google);
                setAutocompleteService(new google.maps.places.AutocompleteService());
                // PlacesService requires a DOM element, we can use a dummy one
                const dummyDiv = document.createElement('div');
                setPlacesService(new google.maps.places.PlacesService(dummyDiv));
            } catch (error) {
                console.error("Error loading Google Maps for search:", error);
            }
        };
        init();
    }, []);

    // Handle outside clicks
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInput = (e) => {
        const val = e.target.value;
        setQuery(val);
        setIsOpen(true);

        if (!val || !autocompleteService) {
            setPredictions([]);
            return;
        }

        setIsLoading(true);
        autocompleteService.getPlacePredictions(
            { input: val },
            (predictions, status) => {
                setIsLoading(false);
                if (status === googleApi.maps.places.PlacesServiceStatus.OK && predictions) {
                    setPredictions(predictions);
                } else {
                    setPredictions([]);
                }
            }
        );
    };

    const handleSelect = (prediction) => {
        setQuery(prediction.description);
        setIsOpen(false);
        setIsLoading(true);

        // Get details (coordinates) for the selected place
        placesService.getDetails(
            {
                placeId: prediction.place_id,
                fields: ['geometry', 'formatted_address', 'name']
            },
            (place, status) => {
                setIsLoading(false);
                if (status === googleApi.maps.places.PlacesServiceStatus.OK && place.geometry && place.geometry.location) {
                    onPlaceSelect({
                        address: place.formatted_address || prediction.description,
                        name: place.name,
                        coordinates: {
                            lat: place.geometry.location.lat(),
                            lng: place.geometry.location.lng()
                        }
                    });
                } else {
                    console.error("Failed to get place details");
                }
            }
        );
    };

    const clearInput = () => {
        setQuery('');
        setPredictions([]);
        setIsOpen(false);
        onPlaceSelect(null);
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border-2 border-indigo-200 focus-within:border-indigo-500 transition-colors">
                <MapPin size={20} className="text-indigo-600 shrink-0" />
                <input
                    type="text"
                    placeholder={placeholder}
                    className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                    value={query}
                    onChange={handleInput}
                    onFocus={() => query && setIsOpen(true)}
                />
                {query && (
                    <button onClick={clearInput} className="p-1 hover:bg-gray-200 rounded-full">
                        <X size={16} className="text-gray-500" />
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {isOpen && predictions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-xl max-h-60 overflow-y-auto border border-gray-100">
                    {predictions.map((prediction) => (
                        <button
                            key={prediction.place_id}
                            onClick={() => handleSelect(prediction)}
                            className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-3 transition-colors"
                        >
                            <div className="mt-1 bg-gray-100 p-1.5 rounded-full">
                                <MapPin size={14} className="text-gray-500" />
                            </div>
                            <div>
                                <p className="font-medium text-gray-800 text-sm">{prediction.structured_formatting.main_text}</p>
                                <p className="text-xs text-gray-500">{prediction.structured_formatting.secondary_text}</p>
                            </div>
                        </button>
                    ))}
                    <div className="p-2 text-right">
                        <img src="https://developers.google.com/static/maps/documentation/images/powered_by_google_on_white.png" alt="Powered by Google" className="h-4 inline-block opacity-50" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlaceSearch;
