import { registerPlugin } from '@capacitor/core';

const NavigationSDK = registerPlugin('NavigationSDK');

/**
 * Navigation SDK Bridge
 * Connects React to the native Google Navigation SDK via Capacitor plugin.
 * 
 * Methods:
 *   initialize()          → Must be called once. Shows T&C dialog, acquires Navigator.
 *   startNavigation(opts) → Starts turn-by-turn guidance to {lat, lng, title}.
 *   stopNavigation()      → Stops guidance and hides native view.
 *   isNavigating()        → Returns {isNavigating: bool, termsAccepted: bool}.
 *   setWebViewTransparent({transparent: bool}) → Controls WebView bg for see-through.
 */

class NavigationService {
    constructor() {
        this.initialized = false;
        this.navigating = false;
    }

    /**
     * Initialize the Navigation SDK. Call once on app startup or
     * when the driver first goes online.
     * @returns {Promise<{status: string}>}
     */
    async initialize() {
        if (this.initialized) {
            return { status: 'already_initialized' };
        }

        try {
            const result = await NavigationSDK.initialize();
            this.initialized = true;
            console.log('[NavSDK] Initialized:', result);
            return result;
        } catch (error) {
            console.error('[NavSDK] Init failed:', error);
            throw error;
        }
    }

    /**
     * Start turn-by-turn navigation to a destination.
     * Automatically makes the WebView transparent so the native map shows through.
     * 
     * @param {Object} opts
     * @param {number} opts.lat  - Destination latitude
     * @param {number} opts.lng  - Destination longitude
     * @param {string} [opts.title] - Optional waypoint title
     * @returns {Promise<{status: string, lat: number, lng: number}>}
     */
    async startNavigation({ lat, lng, title = 'Destino' }) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // Make WebView transparent so native nav shows behind
            await NavigationSDK.setWebViewTransparent({ transparent: true });

            const result = await NavigationSDK.startNavigation({ lat, lng, title });
            this.navigating = true;
            console.log('[NavSDK] Navigation started:', result);
            return result;
        } catch (error) {
            console.error('[NavSDK] Start failed:', error);
            // Restore WebView if navigation failed
            await NavigationSDK.setWebViewTransparent({ transparent: false }).catch(() => {});
            throw error;
        }
    }

    /**
     * Stop navigation and restore the WebView background.
     * @returns {Promise<{status: string}>}
     */
    async stopNavigation() {
        try {
            const result = await NavigationSDK.stopNavigation();
            this.navigating = false;

            // Restore WebView opacity
            await NavigationSDK.setWebViewTransparent({ transparent: false });

            console.log('[NavSDK] Navigation stopped:', result);
            return result;
        } catch (error) {
            console.error('[NavSDK] Stop failed:', error);
            // Force restore WebView
            await NavigationSDK.setWebViewTransparent({ transparent: false }).catch(() => {});
            throw error;
        }
    }

    /**
     * Check the current navigation state.
     * @returns {Promise<{isNavigating: boolean, termsAccepted: boolean}>}
     */
    async getStatus() {
        try {
            return await NavigationSDK.isNavigating();
        } catch (error) {
            return { isNavigating: false, termsAccepted: false };
        }
    }

    /**
     * Whether the service has been initialized.
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Whether navigation is currently active.
     */
    isActive() {
        return this.navigating;
    }
}

// Singleton
const navigationService = new NavigationService();
export { navigationService, NavigationSDK };
export default navigationService;
