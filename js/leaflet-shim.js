/**
 * This is a hack around the fact that Mapbox includes the Leaflet
 * library.
 */

define('leaflet', [], function() {
 return window.L;
});
