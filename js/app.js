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
        url: this.options.tilestream_base + this.options.tilestream_map + '.json?callback=?',
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
