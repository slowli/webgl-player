(function(window) {
	
// TODO: patch parseTextures to create CubeTextures?
	
function patchedObjectLoaderParse( json, onLoad ) {

	var geometries = this.parseGeometries( json.geometries );
	var images = this.parseImages( json.images, function () {
		if ( onLoad !== undefined ) onLoad( object );
	} );

	var textures  = this.parseTextures( json.textures, images );
	var materials = this.parseMaterials( json.materials, textures );
	var object = this.parseObject( json.object, geometries, materials );

	if ( json.animations ) {
		object.animations = this.parseAnimations( json.animations );
	}

	if ( json.images === undefined || json.images.length === 0 ) {
		if ( onLoad !== undefined ) onLoad( object );
	}
	
	// Start added code
	object.globals = {
		images: images,
		textures: textures,
		geometries: geometries,
		materials: materials
	};
	// End added code

	return object;
}

function WebGLPlayer(params) {
	
	var $ = jQuery;
	
	var DEFAULT_RES = 360;
	
	var TEMPLATE = [
		'<canvas class="webgl-player-canvas"></canvas>',
		'<div class="webgl-player-start">',
		'	<h2>$title</h2>',
		'	<a href="#" class="start" title="$start_title"></a>',
		'	<div class="loading">',
		'		<p><span class="scripts">$loading_scripts</span>',
		'			<span class="textures" style="display: none;">$loading_textures</span>',
		'			<span class="error" style="display: none;">$load_error</span></p>',
		'		<div class="progress-c"><div class="progress"></div></div>',
		'	</div>',
		'</div>',
		'<div class="webgl-player-controls">',
		'	<div class="webgl-player-popup">',
		'		<button class="webgl-player-res text" type="button"></button>',
		'	</div>',
		'	<div class="right">',
		'		<button class="webgl-player-resolution text" type="button" title="$resolution_title">360p</button>',
		'		<button class="webgl-player-fullscreen" type="button" title="$fullscreen_title"></button>',
		'	</div>',
		'	<button class="webgl-player-pause" type="button" title="$pause_title"></button>',
		'	<button class="webgl-player-resume" type="button" style="display: none;" title="$resume_title"></button>',
		'	<button class="webgl-player-capture" type="button" title="$capture_title"></button>',
		'	<button class="webgl-player-stats active" type="button" title="$stats_title"></button>',
		'</div>',
	].join('\n');
	
	var FULLSCREEN_EVENT = 'fullscreenchange mozfullscreenchange webkitfullscreenchange msfullscreenchange';
	
	var DEFAULT_PARAMS = {
		// Script dependencies
		scripts: [],
		// Scene data
		data: null,
		// Scene initializer called when everything is loaded
		sceneCallback: function(renderer, data) { 
			return function() { }; 
		},
		// Aspect ratio for the player
		aspectRatio: 16 / 9,
		// Windowed resolutions for the player
		windowedRes: [180, 270, 360],
		// Fullscreen resolutions for the player
		fullscreenRes: [360, 540, 720],
		// Pixel ratio passed to the renderer. 0 means using window.devicePixelRatio
		devicePixelRatio: 1,
		// Whether scripts and data should be reloaded forcefully. 
		// If false, cached versions of scripts and/or data may be used
		forceReload: false
	};
	
	params = $.extend(DEFAULT_PARAMS, params);
	
	var renderer = null,
		scene = {
			render : $.noop	
		},
		stats = null,
		statsVisible = (localStorage.getItem('statsVisible') == '1'),
		clock = null,
		scenePaused = false;
	
	// Extract information from the parameters
	var jqWrapper = params.wrapper,
		aspectRatio = params.aspectRatio,
		windowedRes = params.windowedRes,
		fullscreenRes = params.fullscreenRes,
		sceneScripts = params.scripts,
		sceneData = params.data,
		sceneCallback = params.sceneCallback;
	
	// Validate the parameters
	if (!sceneData) throw 'No scene data specified';
	if (!jqWrapper) throw 'No wrapper element specified';
	
	// jQuery controls
	var jqStartOverlay = null,
		jqStartBtn = null,
		jqLoading = null,
		jqLoadingProgress = null,
		jqLoadingMessages = null,
		jqLoadingScriptsMsg = null,
		jqLoadingTexturesMsg = null,
		jqLoadingErrorMsg = null,
		jqCanvas = null,
		jqPauseBtn = null,
		jqResumeBtn = null,
		jqStatsBtn = null,
		jqCaptureBtn = null,
		jqResolutionBtn = null,
		jqResPanel = null,
		jqResOptionBtns = null,
		jqFullscreenBtn = null;
		
	var initialRes = 0; // initial widget resolution

	var requestFullscreen = jqWrapper[0].requestFullscreen ||
		jqWrapper[0].msRequestFullscreen ||
		jqWrapper[0].mozRequestFullScreen ||
		jqWrapper[0].webkitRequestFullscreen;
	var exitFullscreen = document.exitFullscreen ||
		document.msExitFullscreen ||
		document.mozCancelFullScreen ||
		document.webkitExitFullscreen;

	var loadedScripts = 0, totalScripts = 0,
		loadSuffix = params.forceReload ? ('?v=' + Date.now()) : '';

	preInit();
	
	/**
	 * Sets the value of the progress bar.
	 *
	 * @param {Number} value
	 *    progress bar position (between 0 and 1)
	 */
	function reportProgress(progress) {
		jqLoadingProgress.css('width', (progress * 100) + '%');
	}
	
	function reportError(error) {
		jqLoading.addClass('error');
		jqLoadingMessages.hide();
		jqLoadingErrorMsg.show();
		
	}

	/**
	 * Loads a list of scripts.
	 *
	 * @param {Array} scripts
	 *    URLs of scripts to load
	 * @param {Function} onLoad
	 *    callback to activate when all scripts are loaded
	 */
	function loadScripts(scripts, onLoad, onFail) {
		if (scripts.length === 0) {
			onLoad();
			return;
		}
		var script = scripts.shift(0);

		var scriptTag = $('<script/>');
		scriptTag.attr('src', script + loadSuffix);
		scriptTag.on('load', function() {
			loadedScripts++;
			reportProgress(loadedScripts / totalScripts);

			if (scripts.length === 0) {
				onLoad();
			} else {
				loadScripts(scripts, onLoad, onFail);
			}
		});
		scriptTag.on('error', function() {
			onFail(script);
		});
		$('body')[0].appendChild(scriptTag[0]);
	}
	
	/**
	 * Inserts localized messages into a template.
	 * Variables are marked with symbol '$' followed by the name of a variable
	 * (e.g., '$var').
	 * 
	 * @param {String} template
	 *    template to localize
	 * @param {Object} variables
	 *    mapping of variable names to localized strings
	 */
	function localize(template, variables) {
		for (var varName in variables) {
			var str = variables[varName], regex = new RegExp('\\$' + varName + '\\b', 'g');
			template = template.replace(regex, str);
		}
		return template;
	}

	/**
	 * Entry point of the player.
	 */
	function preInit() {
		var messages = $.extend(WebGLPlayer.messages, {
			'title': jqWrapper.prop('title')
		});
		var template = localize(TEMPLATE, messages);
		jqWrapper.prop('title', '').prop('tabindex', 0).addClass('webgl-player').html(template);
		
		// Define controls
		
		jqStartOverlay = jqWrapper.find('.webgl-player-start');
		jqStartBtn = jqStartOverlay.find('a.start');
		jqControls = jqWrapper.find('.webgl-player-controls');

		jqLoading = jqStartOverlay.find('.loading');
		jqLoadingProgress = jqLoading.find('.progress');
		jqLoadingMessages = jqLoading.find('span');
		jqLoadingScriptsMsg = jqLoading.find('.scripts');
		jqLoadingTexturesMsg = jqLoading.find('.textures');
		jqLoadingErrorMsg = jqLoading.find('.error');

		jqCanvas = jqWrapper.find('canvas');
		jqPauseBtn = jqWrapper.find('.webgl-player-pause');
		jqResumeBtn = jqWrapper.find('.webgl-player-resume');
		jqStatsBtn = jqWrapper.find('.webgl-player-stats');
		jqCaptureBtn = jqWrapper.find('.webgl-player-capture');
		jqResolutionBtn = jqWrapper.find('.webgl-player-resolution');
		jqResPanel = jqWrapper.find('.webgl-player-popup');
		jqFullscreenBtn = jqWrapper.find('.webgl-player-fullscreen');
		
		// Populate resolution options
		var templateBtn = jqResPanel.find('button'), i, btn;
		for (i = 0; i < windowedRes.length; i++) {
			btn = templateBtn.clone().addClass('w').text(windowedRes[i] + 'p');
			setResolutionToClass(btn[0], windowedRes[i]);
			jqResPanel.append(btn);
		}
		
		var maxRes = Math.min(window.screen.width / params.aspectRatio, window.screen.height);
		var fsCount = 0;
		for (i = 0; i < fullscreenRes.length; i++) {
			if (fullscreenRes[i] < maxRes) {
				btn = templateBtn.clone().addClass('fs').text(fullscreenRes[i] + 'p');
				setResolutionToClass(btn[0], fullscreenRes[i]);
				jqResPanel.append(btn);
				
				fsCount++;
			}
		}
		if (fsCount === 0) {
			jqFullscreenBtn.hide();
		}
		
		templateBtn.remove();
		jqResOptionBtns = jqResPanel.find('button');
		
		// Set initial resolution
		initialRes = getResolutionFromClass(jqWrapper[0]);
		setResolutionToClass(jqWrapper[0], 0);
		onResize();
		$(window).resize(onResize);
		
		if (!canCaptureCanvas()) {
			jqCaptureBtn.hide();
		}
		
		jqStartBtn.click(function(event) {
			event.preventDefault();
			init();
		});
	}
	
	function onResize() {
		var width = jqWrapper.parent().width(), maxRes = width / params.aspectRatio, res;
		
		var highestRes = params.windowedRes[0];
		for (var i = 0; i < params.windowedRes.length; i++) {
			res = params.windowedRes[i];
			if ((highestRes < res) && (res < maxRes)) {
				highestRes = res;
			}
		}
		
		// Change the current resolution:
		//   a. if the maximum supported resolution is less than the current resolution
		//   b. if the current resolution is lower than the initial resolution and a bigger resolution is supported
		
		res = getResolutionFromClass(jqWrapper[0]);
		if ((res > maxRes) || ((res < initialRes) && (highestRes > res))) {
			jqResOptionBtns.each(function() {
				var res = getResolutionFromClass(this);
				if ((res == highestRes) && $(this).hasClass('w')) {
					resolutionBtnClick.call(this);
					return false;
				}
			});
		}
	}

	/**
	 * Initializes scene by loading scripts and then scene data (models and textures).
	 */
	function init() {
		jqStartBtn.hide();
		jqLoading.show();
		
		totalScripts = sceneScripts.length;

		jqLoadingScriptsMsg.show();
		reportProgress(0.0);
		loadScripts(sceneScripts, function() {
			jqLoadingScriptsMsg.hide();
			jqLoadingTexturesMsg.show();

			reportProgress(0.0);
			$.ajax({
				dataType: 'json',
				url: sceneData + loadSuffix
			}).done(function(response) {
				var loader = new THREE.ObjectLoader();
				loader.texturePath = THREE.Loader.prototype.extractUrlBase(sceneData);
				loader.parse = patchedObjectLoaderParse;
				loader.parse(response, onLoad, sceneData);
			}).fail(function() {
				reportError(sceneData);
			});
		}, function(script) {
			reportError(script);
		});
	}
	
	/**
	 * Checks if the browser supports capturing canvas. 
	 * 
	 * @returns {Boolean}
	 */
	function canCaptureCanvas() {
		return (typeof Blob != 'undefined') && (typeof URL != 'undefined') && 
				URL.createObjectURL;
	}

	/**
	 * Called when all resources for the scene are loaded.
	 *
	 * @param {Object} data
	 *    scene data containing textures, models, materials, etc.
	 */
	function onLoad(data) {
		jqStartOverlay.hide();
		initControls();

		var renderingOptions = { 
			canvas: jqCanvas[0]
		};
		if (canCaptureCanvas()) {
			renderingOptions.preserveDrawingBuffer = true;
		}
		var pixelRatio = (params.devicePixelRatio === 0) ? window.devicePixelRatio : params.devicePixelRatio;
		renderer = new THREE.WebGLRenderer(renderingOptions);
		renderer.setPixelRatio(pixelRatio);
		var sz = renderer.getSize();
		renderer.setSize(sz.width, sz.height);

		if (typeof Stats != 'undefined') {
			stats = new Stats();
			stats.domElement.className = 'stats';
			jqWrapper.prepend($(stats.domElement));
			toggleStats(statsVisible);
		} else {
			statsVisible = false;
			jqStatsBtn.hide();
		}

		scene = sceneCallback.call(null, renderer, data);
		clock = new THREE.Clock(true);
		render();
	}
	
	/**
	 * Handles clicking on resolution buttons.
	 */
	function resolutionBtnClick() {
		var height = getResolutionFromClass(this), 
			width = height * aspectRatio;
		
		setResolution(width, height);
	
		jqResOptionBtns.removeClass('active');
		$(this).addClass('active');
		jqResPanel.hide();
		jqResolutionBtn.text($(this).text());
	}

	function toggleStats(visible) {
		localStorage.setItem('statsVisible', visible ? '1' : '0');
		jqStatsBtn.toggleClass('active', visible);
		$(stats.domElement).toggle(visible);
	}
	
	/**
	 * Converts base64 string to a uint8 array.
	 * Taken from developers.mozilla.org.
	 * 
	 * @param sBase64
	 * @returns {Uint8Array}
	 */
	function base64toArray(sBase64, nBlocksSize) {
		
		function b64ToUint6(nChr) {
			return nChr > 64 && nChr < 91 ? nChr - 65
					: nChr > 96 && nChr < 123 ? nChr - 71
							: nChr > 47 && nChr < 58 ? nChr + 4 : nChr === 43 ? 62
									: nChr === 47 ? 63 : 0;
		}
		
		var sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length, 
			nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize
				: nInLen * 3 + 1 >> 2, 
			taBytes = new Uint8Array(nOutLen);

		for ( var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
			nMod4 = nInIdx & 3;
			nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
			if (nMod4 === 3 || nInLen - nInIdx === 1) {
				for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
					taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
				}
				nUint24 = 0;

			}
		}

		return taBytes;
	}
	
	/**
	 * Captures a scene into a PNG image.
	 */
	function captureScene() {
		var blob = jqCanvas[0].toDataURL('image/png');
		blob = blob.replace(/^.*?,(.*)$/, '$1');
		blob = base64toArray(blob);
		blob = new Blob([ blob ], { type: 'image/png' });
		
		var url = URL.createObjectURL(blob);
		window.open(url);
	}
	
	/**
	 * Adds event handlers for user interaction.
	 */
	function initControls() {
		jqPauseBtn.click(function() {
			scenePaused = true;
			jqPauseBtn.hide();
			jqResumeBtn.show();
		});

		jqResumeBtn.click(function() {
			scenePaused = false;
			jqPauseBtn.show();
			jqResumeBtn.hide();
		});

		jqResolutionBtn.click(function() {
			var fs = isInFullscreen();
			var maxRes = jqWrapper.parent().width() / params.aspectRatio;
			var buttonsToShow = 0;
			
			jqResOptionBtns.each(function() {
				var $this = $(this);
				var show = ($this.hasClass('fs') && fs) || ($this.hasClass('w') && !fs);
				if (!fs && show) {
					var res = getResolutionFromClass(this);
					show = res < maxRes;
				}
				$this.toggle(show);
				if (show) buttonsToShow++;
			});
			
			if (buttonsToShow >= 2) {
				jqResPanel.toggle();
			}
		});

		var minFullscreenRes = 10000000, 
			maxWindowedRes = 0,
			minFullscreenResBtn = null,
			maxWindowedResBtn = null;

		jqResOptionBtns.each(function() {
			var btn = $(this), height = getResolutionFromClass(this);
			if (btn.hasClass('fs') && (height < minFullscreenRes)) {
				minFullscreenRes = height;
				minFullscreenResBtn = btn;
			}
			if (btn.hasClass('w') && (height > maxWindowedRes)) {
				maxWindowedRes = height;
				maxWindowedResBtn = btn;
			}
		});

		jqResOptionBtns.click(resolutionBtnClick);

		if (!requestFullscreen || !exitFullscreen) {
			jqFullscreenBtn.hide();
		} else {
			jqFullscreenBtn.click(function() {
				toggleFullscreen();
			});
		}

		jqStatsBtn.click(function() {
			statsVisible = !statsVisible;
			toggleStats(statsVisible);
		});
		
		jqCaptureBtn.click(captureScene);
		
		jqWrapper.keydown(onKeydown);
		jqCanvas.click(function() {
			// The focus may be prevented by THREE.OrbitControls, 
			// so we have to restore the default behavior manually.
			jqWrapper.focus();
		});
		jqCanvas.dblclick(function() {
			jqFullscreenBtn.click();
		});

		$(document).on(FULLSCREEN_EVENT, function() {
			var height = jqCanvas.height(),
				inFullscreen = isInFullscreen();

			jqFullscreenBtn.toggleClass('active', inFullscreen);
			
			if (inFullscreen && (height < minFullscreenRes)) {
				minFullscreenResBtn.click();
			} else if (!inFullscreen && (height > maxWindowedRes)) {
				maxWindowedResBtn.click();
			} else {
				var screenClass = inFullscreen ? 'fs' : 'w', 
					activeResBtn = jqResOptionBtns.filter('.res' + height + '.' + screenClass);
				
				activeResBtn.click();
			}
		});
	}
	
	function onKeydown(event) {
		switch (event.key) {
			case ' ':
				if (scenePaused) {
					jqResumeBtn.click();
				} else {
					jqPauseBtn.click();
				}
				return;
		}
		
		if (event.altKey && !event.shiftKey && !event.ctrlKey) {
			switch (event.key) {
				case 's':
					if (jqStatsBtn.is(':visible')) {
						jqStatsBtn.click();
					}
					break;
				case 'c':
					if (jqCaptureBtn.is(':visible')) {
						jqCaptureBtn.click();
					}
					break;
				case 'f':
					jqFullscreenBtn.click();
					break;
			}
		}
	}

	/**
	 * Returns resolution height corresponding to a button based on its classes.
	 *
	 * @param {jQuery} elem
	 *    DOM element
	 * @return {Number}
	 *    resolution height set by the button
	 */
	function getResolutionFromClass(elem) {
		var classes = elem.className.split(/\s+/);
		for (var i = 0; i < classes.length; i++) {
			var match = classes[i].match(/^res(\d+)$/);
			if (match) {
				return parseInt(match[1]);
			}
		}
		return DEFAULT_RES;
	}
	
	/**
	 * Sets class corresponding to a resolution.
	 * 
	 * @param {jQuery} elem
	 *    DOM element
	 * @param {Number} resolution
	 *    resolution height
	 */
	function setResolutionToClass(elem, resolution) {
		var oldRes = getResolutionFromClass(elem);
		$(elem).removeClass('res' + oldRes).addClass('res' + resolution);
	}

	/**
	 * Checks if the scene is currently in fullscreen mode.
	 *
	 * @return {Boolean}
	 */
	function isInFullscreen() {
		var fullscreenElement = document.fullscreenElement ||
			document.mozFullScreenElement ||
			document.webkitFullscreenElement ||
			document.msFullscreenElement;
		return !!fullscreenElement;
	}

	/**
	 * Sets the rendering resolution for the scene.
	 *
	 * @param {Number} width
	 *    resolution width
	 * @param {Number} height
	 *    resolution height
	 */
	function setResolution(width, height) {
		if (isInFullscreen()) {
			jqWrapper.css('padding-top', Math.max(0, (window.screen.height - height - 40) / 2));
		} else {
			jqWrapper.css('padding-top', 0);
		}

		var res = getResolutionFromClass(jqWrapper[0]);
		jqWrapper.width(isInFullscreen() ? '100%' : width);
		if (res == height) return;
		setResolutionToClass(jqWrapper[0], height);
		
		if (renderer !== null) {
			renderer.setSize(width, height);
			if (scene.onresize) {
				scene.onresize(width, height);
			}
		} else {
			jqCanvas.prop('width', width).prop('height', height);
		}
	}

	/**
	 * Toggles fullscreen mode for the scene.
	 */
	function toggleFullscreen() {
		if (isInFullscreen()) {
			exitFullscreen.call(document);
		} else {
			requestFullscreen.call(jqWrapper[0]);
		}
	}

	/**
	 * Renders the scene.
	 */
	function render() {
		requestAnimationFrame(render);
		
		var dt = Math.min(clock.getDelta(), 1.0 / 30);
		if (scenePaused) dt = 0.0;

		scene.render(dt);
		if (statsVisible) stats.update();
	}
}

// Default English messages
WebGLPlayer.messages = {
	start_title: 'Load resources and start rendeding',
	loading_scripts: 'Loading scripts',
	loading_textures: 'Loading textures',
	load_error: 'Error loading resources',
	resolution_title: 'Set rendering resolution',
	fullscreen_title: 'Toggle fullscreen',
	pause_title: 'Pause scene',
	resume_title: 'Resume scene',
	capture_title: 'Capture scene as an image',
	stats_title: 'Toggle statistics'
};

// Exports
window.WebGLPlayer = WebGLPlayer;

})(window);
