/**
 * Planet system with comets.
 * @author Alex Ostrovski
 */

(function(namespace) {
	
// Imports
var StarrySky = namespace.StarrySky,
	LightsPass = namespace.LightsPass,
	Planet = namespace.Planet,
	Comet = namespace.Comet,
	ParticleSource = namespace.ParticleSource;

function PlanetsScene(renderer, data) {
	this.renderer = renderer;
	this.width = renderer.domElement.clientWidth;
	this.height = renderer.domElement.clientHeight;
	this.aspectRatio = this.width / this.height;
	
	this.scene = data;
	this.camera = this.scene.getObjectByName('camera', true);
	this.textures = data.globals.textures;
	
	var cloudImage = data.globals.images['im.clouds'];
	this.textures['tex.clouds'] = new THREE.CubeTexture([
		cloudImage,
		cloudImage,
		cloudImage,
		cloudImage,
		cloudImage,
		cloudImage
	]);
	this.textures['tex.clouds'].needsUpdate = true;
	this.textures['tex.clouds'].wrapS = this.textures['tex.clouds'].wrapT = THREE.RepeatWrapping;
	
	var controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
	controls.target.set(7.5, 5, 7.5);
	
	this.initStars();
	this.initPlanets();
	this.initComets();
	this.initPostprocessing();
	
	this.time = 0.0;
}

PlanetsScene.prototype.initStars = function() {
	var starsObject = this.scene.getObjectByName('stars', true);
	var params = starsObject.userData;
	params.starSprite = this.textures[params.starSprite];

	var stars = new StarrySky(params);
	stars.renderOrder = 1000;
	starsObject.add(stars);
};

PlanetsScene.prototype.initPlanets = function() {
	var planets = this.planets = [];
	this.scene.traverse(function(node) {
		if (node.userData.planet) {
			planets.push(node);
		}
	});
	
	for (var i = 0; i < planets.length; i++) {
		var planet = planets[i], params = planet.userData;
		if (params.cloudColor) params.cloudColor = new THREE.Color(params.cloudColor);
		if (params.surfaceColor) params.surfaceColor = new THREE.Color(params.surfaceColor);
		if (params.rotationAxis) params.rotationAxis = new THREE.Vector3().fromArray(params.rotationAxis);
		if (params.orbitFocus) params.orbitFocus = new THREE.Vector3().fromArray(params.orbitFocus);
		if (params.cloudSampler) params.cloudSampler = this.textures['tex.clouds'];
		
		Planet.setup.call(planet, params);
		
		// Unify orbiting speed according to Euler laws
		if (planet.majorR) {
			planet.velocity = 10.0 * Math.pow(planet.majorR, -1.5);
		}
	}
};

PlanetsScene.prototype.initComets = function() {
	var comets = this.comets = [];
	this.scene.traverse(function(node) {
		if (node.userData.comet) {
			comets.push(node);
		}
	});
	
	var moveOptions, nParticles = 0;
	
	for (var i = 0; i < comets.length; i++) {
		var comet = comets[i], params = comet.userData;
		if (params.color) params.color = new THREE.Color(params.color);
		if (params.moveOptions) {
			moveOptions = params.moveOptions;
			moveOptions.boundingBox = new THREE.Box3(
				new THREE.Vector3().fromArray(moveOptions.boundingBox.min),
				new THREE.Vector3().fromArray(moveOptions.boundingBox.max)
			);
		} else {
			params.moveOptions = moveOptions;
		}
		
		Comet.setup.call(comet, params);
		nParticles += params.particleCount;
	}
	
	this.rttRenderer = ParticleSource.initRTT(comets, this.planets);
	this.initParticleCloud(nParticles);
};

PlanetsScene.prototype.initParticleCloud = function(nParticles) {
	var geometry = new THREE.Geometry();
	Array.prototype.push.apply(geometry.vertices, 
		ParticleSource.getVertices(nParticles));
	
	var sprite = this.textures['tex.particle'];
	var material = ParticleSource.createMaterial();
	material.uniforms.spriteSampler.value = sprite;
	material.uniforms.particleSize.value = 25.0;
	
	this.particleCloud = new THREE.Points(geometry, material);
	this.particleCloud.sortParticles = false;
	this.particleCloud.renderOrder = 0; // Render after stars
	this.scene.add(this.particleCloud);
};

PlanetsScene.prototype.initPostprocessing = function() {
	var renderMain = new THREE.RenderPass(this.scene, this.camera);
	var lightsPass = new LightsPass(this.scene, this.camera, {
		width: this.width / 2,
		height: this.height / 2
	});
	lightsPass.uniforms.haloSampler.value = this.textures['tex.halo'];
	
	// Add appropriate lights to the halo pass
	this.scene.traverse(function(node){
		var params = node.userData;
		if (params.halo) {
			lightsPass.addLight(node, params);
		}
	});
	lightsPass.renderToScreen = true;
	
	var composer = this.composer = new THREE.EffectComposer(this.renderer);
	composer.setSize(this.width, this.height);
	composer.addPass(renderMain);
	composer.addPass(lightsPass);
};

PlanetsScene.prototype.render = function(dt) {
	this.time += dt;
	
	var i;
	for (i = 0; i < this.planets.length; i++) {
		this.planets[i].setTime(this.time, dt);
	}
	
	for (i = 0; i < this.comets.length; i++) {
		this.comets[i].setTime(this.time, dt);
	}
	
	ParticleSource.setUniforms(this.particleCloud.material, this.comets);
	var positionSampler = this.rttRenderer(this.renderer, dt);
	this.particleCloud.material.uniforms.positionSampler.value = positionSampler;
	
	this.composer.render(0.01);
};

PlanetsScene.prototype.onresize = function(width, height) {
	this.composer.setSize(width, height);
};

namespace.PlanetsScene = PlanetsScene;

})(THREE);
