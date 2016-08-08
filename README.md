WebGL Player
==========================

YouTube-like WebGL player widget. Uses [jQuery](http://jquery.com/) 
and [THREE.js](http://threejs.org/).
Comes with a bundle of demos.

Contents
--------------------------

  * **src/** - Source files 
  * **src/webgl-player.js** - WebGL player code
  * **src/webgl-player.css** - supporting stylesheet
  * **src/icons.woff** - icons used in the player widget
  * **src/<demo name>** - demo-specific files
  * **src/common** - scripts used in multiple demos
  * **views/** - Jade view templates
  * **three.sh** - script to download THREE.js dependencies (placed in **src/three/** directory)
  
JS Dependencies
--------------------------

  * **jQuery**
  * **THREE.js** (core library, as well as some auxiliary scripts.)
  
Building
---------------------------

The library uses Grunt the automated builds. Build modes:

  * **test** - runs JSHint
  * **pub** - runs JSHint, then creates public versions of the SVGTree library and styles in the **public/** directory.
    After the task is completed, the Node server can be launched with the `npm start` command.
  * **static** - same as **pub** + creates the static website version in the **static-html/** directory.
  * **clean** - cleans the build by removing temporary files, as well as **public/** and  **static-html/** directories.
  
Usage
--------------------------

See demo pages of the local web server ([http://localhost:4000/](http://localhost:4000/) by default) for examples of usage.

Note that each demo can be called with the following query parameters:

  * **debug** - preloads all scripts required by the demo
  * **dp** - specifies the device pixel ratio used in the demo. The default value is 1. 
    Set to zero in order to use `window.devicePixelRatio`.
	
For example, to run the cube demo with the pixel ratio of 2 and debugging on, use 
[http://localhost:4000/cube?dp=2&debug=1](http://localhost:4000/cube?dp=2&debug=1).

License
--------------------------

Distributed under the MIT license. See [LICENSE](LICENSE) for more details.
