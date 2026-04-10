const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBfItBX3Ju37NAqzvO4ORh_CdntCYR_pFc';

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
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,marker,geometry,distancematrix&v=weekly`;
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

export const getDistanceMatrix = async (origin, destination) => {
    try {
        const google = await loadGoogleMaps();
        const service = new google.maps.DistanceMatrixService();

        return new Promise((resolve, reject) => {
            service.getDistanceMatrix(
                {
                    origins: [origin],
                    destinations: [destination],
                    travelMode: google.maps.TravelMode.DRIVING,
                    drivingOptions: {
                        departureTime: new Date(),
                        trafficModel: google.maps.TrafficModel.BEST_GUESS
                    },
                    unitSystem: google.maps.UnitSystem.METRIC,
                },
                (response, status) => {
                    if (status === 'OK') {
                        const element = response.rows[0].elements[0];
                        if (element.status === 'OK') {
                            resolve({
                                distance: element.distance,
                                duration: element.duration,
                                durationInTraffic: element.duration_in_traffic || element.duration
                            });
                        } else {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    } catch (error) {
        console.error("Distance Matrix error:", error);
        return null;
    }
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
