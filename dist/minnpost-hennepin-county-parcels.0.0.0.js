/**
 * This is a hack around the fact that Mapbox includes the Leaflet
 * library.
 */

define('leaflet', [], function() {
 return window.L;
});

/**
 * Stylings and interactions for maps
 */

(function(global, factory) {
  // Common JS (i.e. browserify) environment
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    module.exports = factory(require('leaflet'));
  }
  // AMD
  else if (typeof define === 'function' && define.amd) {
    define('mpMaps',['leaflet'], factory);
  }
  // Browser global
  else if (global.MP && global.Leaflet) {
    global.MP = global.MP || {};
    global.MP.maps = factory(global.Leaflet);
  }
  else {
    throw new Error('Could not find dependencies for MinnPost Styles Maps.' );
  }
})(typeof window !== 'undefined' ? window : this, function(L) {

  // Placeholder for maps stuff
  var maps = {};

  // Some general helpful values
  maps.minneapolisPoint = L.latLng(44.983333998267824, -93.26667000248563);
  maps.stPaulPoint = L.latLng(44.95370289870105, -93.08995780069381);
  maps.minnesotaPoint = L.latLng(46.518286790004616, -94.55406386114191);
  maps.mapboxSatelliteStreets = 'minnpost.map-95lgm5jf';
  maps.mapboxStreetsDarkLabels = 'minnpost.map-4v6echxm';
  maps.mapboxStreetsLightLabels = 'minnpost.map-wi88b700';
  maps.mapboxTerrainLight = 'minnpost.map-vhjzpwel';
  maps.mapboxTerrainDark = 'minnpost.map-dhba3e3l';
  maps.mapOptions = {
    scrollWheelZoom: false,
    trackResize: true
  };
  maps.mapStyle = {
    stroke: true,
    color: '#2DA51D',
    weight: 1.5,
    opacity: 0.9,
    fill: true,
    fillColor: '#2DA51D',
    fillOpacity: 0.2
  };
  maps.mapboxAttribution = 'Some map imagery provided by <a href="https://www.mapbox.com/about/maps/" target="_blank">Mapbox</a>.';
  maps.openstreetmapAttribution = 'Some map data provided by &copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors.';

  // Make basic Leaflet map.  Takes id of container and mapbox ID
  // in the maps object
  maps.makeLeafletMap = function(id, baseName, center) {
    baseName = baseName || maps.mapboxStreetsLightLabels;
    center = center || maps.minneapolisPoint;

    var map = new L.Map(id, maps.mapOptions);
    var base = new L.tileLayer('//{s}.tiles.mapbox.com/v3/' + baseName + '/{z}/{x}/{y}.png');
    map.addLayer(base);
    map.setView(center, 8);

    // This removes the embedded attribution which should be in the footnote
    // but ensure that attribution is given correctly
    map.removeControl(map.attributionControl);

    return map;
  };

  // Make a Maki icon.  Icon should refer to maki icon short name,
  // size should be s, m, or l and color should be hex without the #.
  //
  // See list of icons: https://www.mapbox.com/maki/
  // Leave icon blank for blank pin
  maps.makeMakiIcon = function(icon, size, color) {
    icon = icon || null;
    color = color || '094C86';
    size = size || 'm';

    var url = 'https://api.tiles.mapbox.com/v3/marker/';
    var iconSizes = {
      's': { iconSize: [20, 50], popupAnchor: [0, -20] },
      'm': { iconSize: [30, 70], popupAnchor: [0, -30] },
      'l': { iconSize: [36,90], popupAnchor: [0, -40] }
    };
    url = url + 'pin-' + size + ((icon === null) ? '' : '-' + icon) + '+' + color + '.png';

    return new L.Icon(L.extend(iconSizes[size], {
      iconUrl: url,
      shadowAnchor: null,
      shadowSize: null,
      shadowUrl: null,
      className: 'maki-marker'
    }));
  };

  // Basic control for a staticly places tooltip
  maps.TooltipControl = L.Control.extend({
    options: {
      position: 'topright'
    },

    initialize: function() {
    },

    update: function(content) {
      this._contentWrapper.innerHTML = content;
      this.show();
    },

    show: function() {
      this._container.style.display = 'block';
    },

    hide: function() {
      this._container.style.display = 'none';
    },

    onAdd: function(map) {
      this._container = L.DomUtil.create('div', 'map-tooltip');
      this._contentWrapper = L.DomUtil.create('div', 'map-tooltip-content');
      this._container.appendChild(this._contentWrapper);
      this.hide();
      return this._container;
    },

    onRemove: function(map) {
    }
  });

  return maps;

});


/**
 * Helpers functions such as formatters or extensions
 * to libraries.
 */
define('helpers', ['jquery', 'underscore'],
  function($, _) {

  var helpers = {};

  /**
   * Override Backbone's ajax call to use JSONP by default as well
   * as force a specific callback to ensure that server side
   * caching is effective.
   */
  helpers.overrideBackboneAJAX = function() {
    Backbone.ajax = function() {
      var options = arguments;

      if (options[0].dataTypeForce !== true) {
        options[0].dataType = 'jsonp';
        options[0].jsonpCallback = 'mpServerSideCachingHelper' +
          _.hash(options[0].url);
      }
      return Backbone.$.ajax.apply(Backbone.$, options);
    };
  };

  /**
   * Returns version of MSIE.
   */
  helpers.isMSIE = function() {
    var match = /(msie) ([\w.]+)/i.exec(navigator.userAgent);
    return match ? parseInt(match[2], 10) : false;
  };

  /**
   * Wrapper for a JSONP request, the first set of options are for
   * the AJAX request, while the other are from the application.
   */
  helpers.jsonpRequest = function(requestOptions, appOptions) {
    options.dataType = 'jsonp';
    options.jsonpCallback = 'mpServerSideCachingHelper' +
      _.hash(options.url);

    if (appOptions.remoteProxy) {
      options.url = options.url + '&callback=mpServerSideCachingHelper';
      options.url = appOptions.remoteProxy + encodeURIComponent(options.url);
      options.cache = true;
    }

    return $.ajax.apply($, [options]);
  };

  /**
   * Data source handling.  For development, we can call
   * the data directly from the JSON file, but for production
   * we want to proxy for JSONP.
   *
   * `name` should be relative path to dataset
   * `options` are app options
   *
   * Returns jQuery's defferred object.
   */
  helpers.getLocalData = function(name, options) {
    var useJSONP = false;
    var defers = [];
    name = (_.isArray(name)) ? name : [ name ];

    // If the data path is not relative, then use JSONP
    if (options && options.paths && options.paths.data.indexOf('http') === 0) {
      useJSONP = true;
    }

    // Go through each file and add to defers
    _.each(name, function(d) {
      var defer;

      if (useJSONP) {
        defer = helpers.jsonpRequest({
          url: proxyPrefix + encodeURI(options.paths.data + d)
        }, options);
      }
      else {
        defer = $.getJSON(options.paths.data + d);
      }
      defers.push(defer);
    });

    return $.when.apply($, defers);
  };

  /**
   * Reads query string and turns into object.
   */
  helpers.parseQueryString = function() {
    var assoc  = {};
    var decode = function(s) {
      return decodeURIComponent(s.replace(/\+/g, " "));
    };
    var queryString = location.search.substring(1);
    var keyValues = queryString.split('&');

    _.each(keyValues, function(v, vi) {
      var key = v.split('=');
      if (key.length > 1) {
        assoc[decode(key[0])] = decode(key[1]);
      }
    });

    return assoc;
  };

  return helpers;
});


define('text!templates/application.underscore',[],function () { return '<div class="application-container">\n  <div class="message-container"></div>\n\n  <div class="content-container">\n\n    <div class="component-label">Hennepin County parcels</div>\n\n    <div class="caption">The map below shows the estimated market value of most all the parcels in Hennepin County.  Hover over (or tap on a mobile device) to see some more information about the parcel.</div>\n\n    <div class="legend caption">\n      <ul>\n        <% _.each(legend, function(l, li) { %>\n          <li class="inline-block"><span class="inline-block" style="background-color: <%= li %>"></span> <%= l %></li>\n        <% }) %>\n      </ul>\n    </div>\n\n    <div class="map" id="h-county-parcels">\n    </div>\n\n  </div>\n\n  <div class="footnote-container">\n    <div class="footnote">\n      <p>Some code, techniques, and data on <a href="https://github.com/minnpost/minnpost-hennepin-county-parcels" target="_blank">Github</a>.  Some map data © OpenStreetMap contributors; licensed under the <a href="http://www.openstreetmap.org/copyright" target="_blank">Open Data Commons Open Database License</a>.  Some map design © MapBox; licensed according to the <a href="http://mapbox.com/tos/" target="_blank">MapBox Terms of Service</a>.</p>\n\n    </div>\n  </div>\n</div>\n';});


define('text!templates/map-tooltip.underscore',[],function () { return '<% if (!data.MKT_VAL_TO) { %>\n  <div>There is no estimated market value on this parcel.</div>\n<% } else { %>\n\n  <div>\n    Estimated market value is <strong><%= \'$\' + format.number(data.MKT_VAL_TO, 0) %></strong>.\n    <% if (data.EST_BLDG_M || data.EST_LAND_M) { %>\n      This is made up from a building value of <%= \'$\' + format.number(data.EST_BLDG_M || 0, 0) %> and a land value of <%= \'$\' + format.number(data.EST_LAND_M || 0, 0) %>.\n    <% } %>\n\n    <% if (data.BUILD_YR) { %>\n      Approximately built in <strong><%= data.BUILD_YR %></strong>.\n    <% } %>\n\n    <% if (data.HMSTD_CD1_ || data.PROPERTY_T) { %>\n      This parcel is classified as <em><%= data.PROPERTY_T.toLowerCase() %></em>, <em><%= data.HMSTD_CD1_.toLowerCase() %></em>.\n    <% } %>\n  </div>\n\n<% } %>\n';});

/**
 * Main application file for: minnpost-hennepin-county-parcels
 *
 * This pulls in all the parts
 * and creates the main object for the application.
 */

// Create main application
define('minnpost-hennepin-county-parcels', [
  'jquery', 'underscore', 'mpConfig', 'mpFormatters', 'mpMaps', 'helpers',
  'text!templates/application.underscore',
  'text!templates/map-tooltip.underscore'
], function(
  $, _, mpConfig, mpFormatters, mpMaps, helpers, tApplication, tTooltip
  ) {

  // Constructor for app
  var App = function(options) {
    this.options = _.extend(this.defaultOptions, options);
    this.el = this.options.el;
    this.$el = $(this.el);
    this.$ = function(selector) { return this.$el.find(selector); };
    this.$content = this.$el.find('.content-container');
    this.loadApp();
  };

  // Extend with custom methods
  _.extend(App.prototype, {
    // Start function
    start: function() {
      var thisApp = this;

      // Create main application view
      this.$el.html(_.template(tApplication, {
        legend: {
          '#F1F1F1': '$0 or no data.',
          '#543005': '$0 - $100k',
          '#8c510a': '$100k - $250k',
          '#bf812d': '$250k - $500',
          '#dfc27d': '$500 - $1M',
          '#c7eae5': '$1M - $2M',
          '#80cdc1': '$2M - $5M',
          '#35978f': '$5M - $20M',
          '#01665e': '$20M - $100M',
          '#003c30': 'above $100M'
        }
      }));

      // Make tooltip template
      this.tooltipTemplate = _.template(tTooltip);

      // Get tilejson data
      $.ajax({
        url: this.options.mapbox_base.replace('{s}', 'a') + 'minnpost.dojn61or' + '.json?callback=?',
        dataType: 'jsonp',
        jsonpCallback: 'mpCacheBuster',
        cache: true,
        success: function(data) {
          thisApp.tilejson = data;
          thisApp.makeMap();
          thisApp.handleEvents();
        }
      });
    },

    // Put together map
    makeMap: function() {
      var thisApp = this;

      // Make map
      this.map = L.mapbox.map('h-county-parcels', 'minnpost.map-vhjzpwel,minnpost.dojn61or,minnpost.map-dotjndlk', {
        scrollWheelZoom: false,
        trackResize: true
      });

      // Override the template function in Mapbox's grid control because
      // it doesn't expose more options and Mustache is stupid
      this.map.gridControl._template = function(format, data) {
        if (!data) {
          return;
        }

        var template = this.options.template || this._layer.getTileJSON().template;

        if (template) {
          return this.options.sanitizer(
            _.template(template, {
              format: mpFormatters,
              data: data
            })
          );
        }
      };

      // Set new template
      this.map.gridControl.setTemplate(tTooltip);
      this.map.gridControl.options.pinnable = false;

      // Remove attribution control
      this.map.removeControl(this.map.infoControl);

      // For whatever reason, the map may not load complete, probably
      // due to the face that the DOM element for it is not
      // completely loaded
      _.delay(function() {
        thisApp.map.invalidateSize();
      }, 1500);
    },

    // Handle some events
    handleEvents: function() {
      var thisApp = this;
      var places = {
        'harriet': {
          loc: [44.92236863873383, -93.30546547367703],
          zoom: 14
        },
        'ids': {
          loc: [44.97611437647188, -93.27250648930203],
          zoom: 15
        }
      };

      this.$el.find('.location-link').on('click', function(e) {
        e.preventDefault();
        var place = $(this).data('location');
        if (_.isObject(places[place])) {
          thisApp.map.setView(places[place].loc, places[place].zoom);
        }
      });

    },

    // Make the data a tad better
    parseParcelData: function(data) {
      data.BUILD_YR = (data.BUILD_YR == '0000' || data.BUILD_YR < 1) ? null : data.BUILD_YR;
      return data;
    },

    // Default options
    defaultOptions: {
      projectName: 'minnpost-hennepin-county-parcels',
      remoteProxy: null,
      el: '.minnpost-hennepin-county-parcels-container',
      // We our using a temporary Tilestream server, so we override
      // what Mapbox usually expects
      tilestream_base: '//ec2-54-82-59-19.compute-1.amazonaws.com:9003/v2/',
      tilestream_map: 'hennepin-parcels',
      mapbox_base: '//{s}.tiles.mapbox.com/v3/',
      availablePaths: {
        local: {
          css: ['.tmp/css/main.css'],
          images: 'images/',
          data: 'data/'
        },
        build: {
          css: [
            '//netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css',
            'dist/minnpost-hennepin-county-parcels.libs.min.css',
            'dist/minnpost-hennepin-county-parcels.latest.min.css'
          ],
          ie: [
            'dist/minnpost-hennepin-county-parcels.libs.min.ie.css',
            'dist/minnpost-hennepin-county-parcels.latest.min.ie.css'
          ],
          images: 'dist/images/',
          data: 'dist/data/'
        },
        deploy: {
          css: [
            '//netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css',  'https://s3.amazonaws.com/data.minnpost/projects/minnpost-hennepin-county-parcels/minnpost-hennepin-county-parcels.libs.min.css',
            'https://s3.amazonaws.com/data.minnpost/projects/minnpost-hennepin-county-parcels/minnpost-hennepin-county-parcels.latest.min.css'
          ],
          ie: [  'https://s3.amazonaws.com/data.minnpost/projects/minnpost-hennepin-county-parcels/minnpost-hennepin-county-parcels.libs.min.ie.css',
            'https://s3.amazonaws.com/data.minnpost/projects/minnpost-hennepin-county-parcels/minnpost-hennepin-county-parcels.latest.min.ie.css'
          ],
          images: 'https://s3.amazonaws.com/data.minnpost/projects/minnpost-hennepin-county-parcels/images/',
          data: 'https://s3.amazonaws.com/data.minnpost/projects/minnpost-hennepin-county-parcels/data/'
        }
      }
    },

    // Load up app
    loadApp: function() {
      this.determinePaths();
      this.getLocalAssests(function(map) {
        this.renderAssests(map);
        this.start();
      });
    },

    // Determine paths.  A bit hacky.
    determinePaths: function() {
      var query;
      this.options.deployment = 'deploy';

      if (window.location.host.indexOf('localhost') !== -1) {
        this.options.deployment = 'local';

        // Check if a query string forces something
        query = helpers.parseQueryString();
        if (_.isObject(query) && _.isString(query.mpDeployment)) {
          this.options.deployment = query.mpDeployment;
        }
      }

      this.options.paths = this.options.availablePaths[this.options.deployment];
    },

    // Get local assests, if needed
    getLocalAssests: function(callback) {
      var thisApp = this;

      // If local read in the bower map
      if (this.options.deployment === 'local') {
        $.getJSON('bower.json', function(data) {
          callback.apply(thisApp, [data.dependencyMap]);
        });
      }
      else {
        callback.apply(this, []);
      }
    },

    // Rendering tasks
    renderAssests: function(map) {
      var isIE = (helpers.isMSIE() && helpers.isMSIE() <= 8);

      // Add CSS from bower map
      if (_.isObject(map)) {
        _.each(map, function(c, ci) {
          if (c.css) {
            _.each(c.css, function(s, si) {
              s = (s.match(/^(http|\/\/)/)) ? s : 'bower_components/' + s + '.css';
              $('head').append('<link rel="stylesheet" href="' + s + '" type="text/css" />');
            });
          }
          if (c.ie && isIE) {
            _.each(c.ie, function(s, si) {
              s = (s.match(/^(http|\/\/)/)) ? s : 'bower_components/' + s + '.css';
              $('head').append('<link rel="stylesheet" href="' + s + '" type="text/css" />');
            });
          }
        });
      }

      // Get main CSS
      _.each(this.options.paths.css, function(c, ci) {
        $('head').append('<link rel="stylesheet" href="' + c + '" type="text/css" />');
      });
      if (isIE) {
        _.each(this.options.paths.ie, function(c, ci) {
          $('head').append('<link rel="stylesheet" href="' + c + '" type="text/css" />');
        });
      }

      // Add a processed class
      this.$el.addClass('processed');
    }
  });

  return App;
});


/**
 * Run application
 */
require(['jquery', 'minnpost-hennepin-county-parcels'], function($, App) {
  $(document).ready(function() {
    var app = new App();
  });
});

