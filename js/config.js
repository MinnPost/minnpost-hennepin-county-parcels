/**
 * RequireJS config which maps out where files are and shims
 * any non-compliant libraries.
 */
require.config({
  shim: {
    // Mapbox and requireJS don't really work, so we just let
    // the L be global
    'mapbox': {
      exports: 'mapbox'
    }
  },
  baseUrl: 'js',
  paths: {
    'requirejs': '../bower_components/requirejs/require',
    'almond': '../bower_components/almond/almond',
    'text': '../bower_components/text/text',
    'jquery': '../bower_components/jquery/dist/jquery',
    'underscore': '../bower_components/underscore/underscore',
    // Mapbox is include manually because it doesn't play nice with Require
    //'mapbox': '../bower_components/mapbox.js/dist/mapbox.uncompressed',
    'leafletUTFGrid': '../bower_components/Leaflet.utfgrid/src/leaflet.utfgrid',
    'mpConfig': '../bower_components/minnpost-styles/dist/minnpost-styles.config',
    'mpFormatters': '../bower_components/minnpost-styles/dist/minnpost-styles.formatters',
    'mpMaps': '../bower_components/minnpost-styles/dist/minnpost-styles.maps',
    'leaflet': 'leaflet-shim',
    'minnpost-hennepin-county-parcels': 'app'
  }
});
