const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCj31yOYezP6JjFU9NHPW1toRCQuICTKZs';

let googleMapsPromise = null;

export const loadGoogleMaps = () => {
    if (window.google && window.google.maps) {
        return Promise.resolve(window.google);
    }

    if (googleMapsPromise) {
        return googleMapsPromise;
    }

    googleMapsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,marker,geometry&v=weekly`; // Added geometry library just in case
        script.async = true;
        script.defer = true;

        script.onload = () => {
            if (window.google && window.google.maps) {
                resolve(window.google);
            } else {
                reject(new Error("Google Maps script loaded but window.google is undefined"));
            }
        };

        script.onerror = (error) => {
            console.error("Google Maps script load error:", error);
            reject(new Error("Failed to load Google Maps script"));
        };

        document.head.appendChild(script);
    });

    return googleMapsPromise;
};

export const getReverseGeocode = async (lat, lng) => {
    try {
        const google = await loadGoogleMaps();
        const geocoder = new google.maps.Geocoder();

        return new Promise((resolve, reject) => {
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === 'OK' && results && results.length > 0) {
                    // Return the most specific formatted address
                    resolve(results[0].formatted_address);
                } else {
                    console.warn("Geocoder failed or found no results:", status);
                    resolve(null); // Resolve null instead of reject to avoid crashing UI flow
                }
            });
        });
    } catch (error) {
        console.error("Reverse geocode loop error:", error);
        return null;
    }
};
