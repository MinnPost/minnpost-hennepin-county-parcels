# Minnpost Hennepin County Parcels

A (map) look at Hennepin County parcels, specifically around market value.

You can see this project in action at *published story link goes here*.

*Unless otherwise noted, MinnPost projects on [Github](https://github.com/minnpost) are story-driven and meant for transparency sake and not focused on re-use.  For a list of our more reusable projects, go to [code.minnpost.com](http://code.minnpost.com).*

## Data

Parcel data from [Hennepin County](http://www.hennepin.us/your-government/open-government/gis-open-data); detailed information about the dataset can be found [on PDF](http://www.hennepin.us/~/media/hennepinus/your-government/open-government/taxable-parcels.pdf).  [Original download](http://gis-stage.co.hennepin.mn.us/publicgisdata/hennepin_county_tax_property_base.zip) is in ESRI Geodatabase (FileGDB) (.gdb) format.

We use some [already converted files](http://data.dbspatial.com/hennepin/) provided by David Bitner.  The process for converting is described on [Github](https://github.com/dbSpatial/opentwincities/blob/master/fetch_hennepin.sh).

## Data processing

Unfortunately the FileGDB format is very proprietary and support for it in open source applications like QGIS or Tilemill are not very well supported at the moment.  We will use already converted files, see below on how to convert.  Note that Tilemill may crash on unzipping large files due to memory use, hence why we do it like this.

1. Use variable for Mapbox path just in case yours is different: `export MAPBOX_PATH=~/Documents/MapBox/`
1. Get the data and extract it: `cd data && wget http://data.dbspatial.com/hennepin/Hennepin_County_Tax_Property_Base.shp.zip && unzip Hennepin_County_Tax_Property_Base.shp.zip -d Hennepin_County_Tax_Property_Base; cd -;`
1. Link data into Mapbox directory: `ln -s "$(pwd)/data/Hennepin_County_Tax_Property_Base" $MAPBOX_PATH/data/Hennepin_County_Tax_Property_Base`
1. Link the Tilemill project into Mapbox directory: `ln -s "$(pwd)/data-processing/mapbox-hennepin-parcels" $MAPBOX_PATH/project/mapbox-hennepin-parcels`

### Converting FileGDB (ESRI Geodatabase) to Shapefiles

Essentially, we need to install GADL 1.11+ or build GDAL with this support and then use `ogr2ogr` to convert it.

On Mac, this means using Homebrew and the [custom OSGeo tap](https://github.com/OSGeo/homebrew-osgeo4mac).

1. Download file from ESRI, specifically the "File Geodatabase API 1.3 version for Mac 64-bit" version.  This requires making a free account on ESRI.
    * http://www.esri.com/apps/products/download/index.cfm?fuseaction=#File_Geodatabase_API_1.3
1. Copy the file to Homebrew cache: `cp FileGDB_API_1_3-64.zip $(brew --cache)/FileGDB_API_1_3-64.zip
1. Install tap (ensure that old version of tap is removed): `brew untap dakcarto/osgeo4mac && brew tap osgeo/osgeo4mac && brew tap --repair;`
1. `brew install osgeo/osgeo4mac/gdal-filegdb`
1. `brew install osgeo/osgeo4mac/gdal --complete --enable-unsupported`
1. Tell GDAL about the plugins: `export GDAL_DRIVER_PATH=$(brew --prefix)/lib/gdalplugins`
    * This should go in your `.bash_profile` so that it is consistently available.

### Exporting tiles

Ideally we would use Mapbox to host our `mbtiles` from Tilemill but, currently, our account is full and the next tier is 10x more expensive.  So, we host on S3 temporarily; this will make it slow because of many things, most specifically that browsers will only download a few images at a time from the same domain.

## Development and running locally

### Prerequisites

All commands are assumed to be on the [command line](http://en.wikipedia.org/wiki/Command-line_interface), often called the Terminal, unless otherwise noted.  The following will install technologies needed for the other steps and will only needed to be run once on your computer so there is a good chance you already have these technologies on your computer.

1. Install [Git](http://git-scm.com/).
   * On a Mac, install [Homebrew](http://brew.sh/), then do: `brew install git`
1. Install [NodeJS](http://nodejs.org/).
   * On a Mac, do: `brew install node`
1. Optionally, for development, install [Grunt](http://gruntjs.com/): `npm install -g grunt-cli`
1. Install [Bower](http://bower.io/): `npm install -g bower`
1. Install [Sass](http://sass-lang.com/): `gem install sass`
   * On a Mac do: `sudo gem install sass`
   1. Install [Compass](http://compass-style.org/): `gem install compass`
   * On a Mac do: `sudo gem install compass`


### Get code and install packages

Get the code for this project and install the necessary dependency libraries and packages.

1. Check out this code with [Git](http://git-scm.com/): `git clone https://github.com/MinnPost/minnpost-hennepin-county-parcels.git`
1. Go into the template directory: `cd minnpost-hennepin-county-parcels`
1. Install NodeJS packages: `npm install`
1. Install Bower components: `bower install`
1. Because Mapbox comes unbuilt, we need to build it: `cd bower_components/mapbox.js/ && npm install && make; cd -;`

### Running locally

1. Run: `grunt server`
    * This will run a local webserver for development and you can view the application in your web browser at [http://localhost:8804](http://localhost:8804).
1. By default, running a local server will show you the local development version.  But there are other builds that you can view by changing the query parameters.  Do note that you may have to run the build and deploy things for things to work normally.
    * Local build: http://localhost:8804/?mpDeployment=build
    * Build deployed on S3: http://localhost:8804/?mpDeployment=deploy
    * Embedded version with local build: http://localhost:8804/?mpDeployment=build&mpEmbed=true
    * Embedded version with S3 build: http://localhost:8804/?mpDeployment=deploy&mpEmbed=true

### Developing

Development will depend on what libraries are used.  But here are a few common parts.

* `js/app.js` is the main application and will contain the top logic.

Adding libraries is not difficult, but there are a few steps.

1. User bower to install the appropriate library: `bower install library --save`
1. Add the appropriate reference in `js/config.js` so that RequireJS knows about it.
1. Add an entry in the `dependencyMap` object in `bower.json`.  This is used to automatically collect resources in the build process.  It is possible, like with `minnpost-styles` that multiple entries will need to be made, one ber `.js` file.  Here is an example:

```
// Should be bower identifier.  Order matters for build, meaning that any dependencies should come first.
"library": {
  // Name used for reference in RequireJS (some modules expect dependencies with specific case, otherwise its arbitrary and you can just use the library name from above).
  // If this is not a JS library, do not include.
  "rname": "library",
  // (optional) Path to un-minified JS files within bower_components excluding .js suffix.
  "js": ["library/dist/library"],
  // (optional) Path to un-minified CSS files within bower_components excluding .css suffix.
  "css": ["library/dist/css/library"],
  // (optional) Path to un-minified IE-specific CSS files within bower_components excluding .css suffix.
  "ie": ["library/dist/css/library.ie"],
  // What is expected to be returned when using as a RequireJS dependency.  Some specific libraries, like jQuery use $, or backbone returns the Backbone class.
  // If this is not a JS library, do not include.
  "returns": "Library"
}
```

### Testing

Unfortunately there are no tests at the moment.

### Build

To build or compile all the assets together for easy and efficient deployment, do the following.  It will create all the files in the `dist/` folder.

1. Run: `grunt`

### Deploy

Deploying will push the relevant files up to Amazon's AWS S3 so that they can be easily referenced on the MinnPost site.  This is specific to MinnPost, and your deployment might be different.

1. Run: `grunt deploy`
    * This will output a bit of HTML to if you want to use the project as an embed.

There are to main ways to include the necessary HTML in a page in order to run the project.

1. Copy the relevant parts from `index.html`.
    * This has the benefit of showing messages to users that have older browsers or have Javascript turned off.  This also uses the build that separates out the third-party libraries that are used and are less likely to change; this gains a bit of performance for users.
1. Copy the embed output from `grunt deploy`.

## Hacks

*List any hacks used in this project, such as forked repos.  Link to pull request or repo and issue.*

## About Us

MinnData, the MinnPost data team, is Alan, Tom, and Kaeti and all the awesome contributors to open source projects we utilize.  See our work at [minnpost.com/data](http://minnpost.com/data).

```

                                                   .--.
                                                   `.  \
                                                     \  \
                                                      .  \
                                                      :   .
                                                      |    .
                                                      |    :
                                                      |    |
      ..._  ___                                       |    |
     `."".`''''""--..___                              |    |
     ,-\  \             ""-...__         _____________/    |
     / ` " '                    `""""""""                  .
     \                                                      L
     (>                                                      \
    /                                                         \
    \_    ___..---.                                            L
      `--'         '.                                           \
                     .                                           \_
                    _/`.                                           `.._
                 .'     -.                                             `.
                /     __.-Y     /''''''-...___,...--------.._            |
               /   _."    |    /                ' .      \   '---..._    |
              /   /      /    /                _,. '    ,/           |   |
              \_,'     _.'   /              /''     _,-'            _|   |
                      '     /               `-----''               /     |
                      `...-'                                       `...-'

```
