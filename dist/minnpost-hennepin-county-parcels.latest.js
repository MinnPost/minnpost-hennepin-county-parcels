L.Util.ajax = function (url, cb) {
	// the following is from JavaScript: The Definitive Guide
	// and https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Using_XMLHttpRequest_in_IE6
	if (window.XMLHttpRequest === undefined) {
		window.XMLHttpRequest = function () {
			/*global ActiveXObject:true */
			try {
				return new ActiveXObject("Microsoft.XMLHTTP");
			}
			catch  (e) {
				throw new Error("XMLHttpRequest is not supported");
			}
		};
	}
	var response, request = new XMLHttpRequest();
	request.open("GET", url);
	request.onreadystatechange = function () {
		/*jshint evil: true */
		if (request.readyState === 4 && request.status === 200) {
			if (window.JSON) {
				response = JSON.parse(request.responseText);
			} else {
				response = eval("(" + request.responseText + ")");
			}
			cb(response);
		}
	};
	request.send();
};
L.UtfGrid = L.Class.extend({
	includes: L.Mixin.Events,
	options: {
		subdomains: 'abc',

		minZoom: 0,
		maxZoom: 18,
		tileSize: 256,

		resolution: 4,

		useJsonP: true,
		pointerCursor: true
	},

	//The thing the mouse is currently on
	_mouseOn: null,

	initialize: function (url, options) {
		L.Util.setOptions(this, options);

		this._url = url;
		this._cache = {};

		//Find a unique id in window we can use for our callbacks
		//Required for jsonP
		var i = 0;
		while (window['lu' + i]) {
			i++;
		}
		this._windowKey = 'lu' + i;
		window[this._windowKey] = {};

		var subdomains = this.options.subdomains;
		if (typeof this.options.subdomains === 'string') {
			this.options.subdomains = subdomains.split('');
		}
	},

	onAdd: function (map) {
		this._map = map;
		this._container = this._map._container;

		this._update();

		var zoom = this._map.getZoom();

		if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
			return;
		}

		map.on('click', this._click, this);
		map.on('mousemove', this._move, this);
		map.on('moveend', this._update, this);
	},

	onRemove: function () {
		var map = this._map;
		map.off('click', this._click, this);
		map.off('mousemove', this._move, this);
		map.off('moveend', this._update, this);
		if (this.options.pointerCursor) {
			this._container.style.cursor = '';
		}
	},

	_click: function (e) {
		this.fire('click', this._objectForEvent(e));
	},
	_move: function (e) {
		var on = this._objectForEvent(e);

		if (on.data !== this._mouseOn) {
			if (this._mouseOn) {
				this.fire('mouseout', { latlng: e.latlng, data: this._mouseOn });
				if (this.options.pointerCursor) {
					this._container.style.cursor = '';
				}
			}
			if (on.data) {
				this.fire('mouseover', on);
				if (this.options.pointerCursor) {
					this._container.style.cursor = 'pointer';
				}
			}

			this._mouseOn = on.data;
		} else if (on.data) {
			this.fire('mousemove', on);
		}
	},

	_objectForEvent: function (e) {
		var map = this._map,
		    point = map.project(e.latlng),
		    tileSize = this.options.tileSize,
		    resolution = this.options.resolution,
		    x = Math.floor(point.x / tileSize),
		    y = Math.floor(point.y / tileSize),
		    gridX = Math.floor((point.x - (x * tileSize)) / resolution),
		    gridY = Math.floor((point.y - (y * tileSize)) / resolution),
			max = map.options.crs.scale(map.getZoom()) / tileSize;

		x = (x + max) % max;
		y = (y + max) % max;

		var data = this._cache[map.getZoom() + '_' + x + '_' + y];
		if (!data || !data.grid) {
			return { latlng: e.latlng, data: null };
		}

		var idx = this._utfDecode(data.grid[gridY].charCodeAt(gridX)),
		    key = data.keys[idx],
		    result = data.data[key];

		if (!data.data.hasOwnProperty(key)) {
			result = null;
		}

		return { latlng: e.latlng, data: result};
	},

	//Load up all required json grid files
	//TODO: Load from center etc
	_update: function () {

		var bounds = this._map.getPixelBounds(),
		    zoom = this._map.getZoom(),
		    tileSize = this.options.tileSize;

		if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
			return;
		}

		var nwTilePoint = new L.Point(
				Math.floor(bounds.min.x / tileSize),
				Math.floor(bounds.min.y / tileSize)),
			seTilePoint = new L.Point(
				Math.floor(bounds.max.x / tileSize),
				Math.floor(bounds.max.y / tileSize)),
				max = this._map.options.crs.scale(zoom) / tileSize;

		//Load all required ones
		for (var x = nwTilePoint.x; x <= seTilePoint.x; x++) {
			for (var y = nwTilePoint.y; y <= seTilePoint.y; y++) {

				var xw = (x + max) % max, yw = (y + max) % max;
				var key = zoom + '_' + xw + '_' + yw;

				if (!this._cache.hasOwnProperty(key)) {
					this._cache[key] = null;

					if (this.options.useJsonP) {
						this._loadTileP(zoom, xw, yw);
					} else {
						this._loadTile(zoom, xw, yw);
					}
				}
			}
		}
	},

	_loadTileP: function (zoom, x, y) {
		var head = document.getElementsByTagName('head')[0],
		    key = zoom + '_' + x + '_' + y,
		    functionName = 'lu_' + key,
		    wk = this._windowKey,
		    self = this;

		var url = L.Util.template(this._url, L.Util.extend({
			s: L.TileLayer.prototype._getSubdomain.call(this, { x: x, y: y }),
			z: zoom,
			x: x,
			y: y,
			cb: wk + '.' + functionName
		}, this.options));

		var script = document.createElement('script');
		script.setAttribute("type", "text/javascript");
		script.setAttribute("src", url);

		window[wk][functionName] = function (data) {
			self._cache[key] = data;
			delete window[wk][functionName];
			head.removeChild(script);
		};

		head.appendChild(script);
	},

	_loadTile: function (zoom, x, y) {
		var url = L.Util.template(this._url, L.Util.extend({
			s: L.TileLayer.prototype._getSubdomain.call(this, { x: x, y: y }),
			z: zoom,
			x: x,
			y: y
		}, this.options));

		var key = zoom + '_' + x + '_' + y;
		var self = this;
		L.Util.ajax(url, function (data) {
			self._cache[key] = data;
		});
	},

	_utfDecode: function (c) {
		if (c >= 93) {
			c--;
		}
		if (c >= 35) {
			c--;
		}
		return c - 32;
	}
});

L.utfGrid = function (url, options) {
	return new L.UtfGrid(url, options);
};

define("leafletUTFGrid", function(){});

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
  'jquery', 'underscore', 'leafletUTFGrid', 'mpConfig', 'mpFormatters', 'mpMaps', 'helpers',
  'text!templates/application.underscore',
  'text!templates/map-tooltip.underscore'
], function(
  $, _, LUTF, mpConfig, mpFormatters, mpMaps, helpers, tApplication, tTooltip
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
      $.getJSON(this.options.tilestream_base + this.options.tilestream_map + '.json?callback=?', function(data) {
        thisApp.tilejson = data;
        thisApp.makeMap();
        thisApp.handleEvents();
      });
    },

    // Put together map
    makeMap: function() {
      var thisApp = this;

      // Mapbox.js doesn't seem to play nicely with cross domain requests
      // to our custom tilestream server (though it looks like the appropriate
      // headers are there).  So, we use a different library for the UTF grid

      // Map
      this.map = new L.map('h-county-parcels', {
        minZoom: this.tilejson.minzoom,
        maxZoom: this.tilejson.maxzoom,
        scrollWheelZoom: false,
        trackResize: true
      }).setView([this.tilejson.center[1], this.tilejson.center[0]], this.tilejson.center[2]);
      this.map.removeControl(this.map.attributionControl);

      // Add tooltip control
      this.tooltip = new mpMaps.TooltipControl();
      this.map.addControl(this.tooltip);

      // Add main map
      L.tileLayer(this.options.tilestream_base + this.options.tilestream_map +
        '/{z}/{x}/{y}.png', {
      }).addTo(this.map);

      // Add main map grid
      this.grid = new L.UtfGrid(this.options.tilestream_base +
        this.options.tilestream_map + '/{z}/{x}/{y}.grid.json?callback={cb}', {
        useJsonP: true
      });
      this.grid.on('mouseover', function(e) {
        e.data = thisApp.parseParcelData(e.data);
        thisApp.tooltip.update(thisApp.tooltipTemplate({
          format: mpFormatters,
          data: e.data
        }));
      });
      this.grid.on('mouseout', function(e) {
        thisApp.tooltip.hide();
      });
      this.map.addLayer(this.grid);

      // Add street overlay, limit view to when zoomed further in
      L.tileLayer(this.options.mapbox_base + 'minnpost.map-dotjndlk/{z}/{x}/{y}.png', {
        zIndex: 100,
        minZoom: 12
      }).addTo(this.map);

      // Add terrain underlay
      L.tileLayer(this.options.mapbox_base + 'minnpost.map-vhjzpwel/{z}/{x}/{y}.png', {
        zIndex: -100
      }).addTo(this.map);


      // This way doesn't work with cross domain stuff, though its simpler
      /*
      // Override urls for Mapbox
      L.mapbox.config.HTTP_URLS = [tilestream_base];

      // Make base map
      this.map = L.mapbox.map('h-county-parcels', 'hennepin-parcels', {
        minZoom: 10,
        maxZoom: 16
      });
      // Remove mapbox control
      this.map.removeControl(this.map.infoControl);

      // Add street overlay
      L.tileLayer(mapbox_base + 'minnpost.map-dotjndlk/{z}/{x}/{y}.png', {
        zIndex: 100,
        minZoom: 12
      }).addTo(this.map);

      // Add terrain underlay
      L.tileLayer(mapbox_base + 'minnpost.map-vhjzpwel/{z}/{x}/{y}.png', {
        zIndex: -100
      }).addTo(this.map);
      */

      // For whatever reason, the map may not load complete, probably
      // due to the face that the DOM element for it is not
      // completely loaded
      _.delay(function() {
        thisApp.map.invalidateSize();
      }, 750);
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

