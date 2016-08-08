/**
 * Night lake with fireflies.
 * @author Alex Ostrovski
 */

(function(namespace) {
	
// Imports
var RefractiveWater = namespace.RefractiveWater,
	NorthernLights = namespace.NorthernLights,
	Firefly = namespace.Firefly,
	StarrySky = namespace.StarrySky,
	MathUtils = namespace.MathUtils;

function NightLakeScene(renderer, data) {
	this.renderer = renderer;
	this.width = renderer.domElement.clientWidth;
	this.height = renderer.domElement.clientHeight;
	this.aspectRatio = this.width / this.height;

	this.scene = data;
	this.camera = this.scene.getObjectByName('camera', true);
	this.textures = data.globals.textures;
	
	var fogParams = this.scene.userData.fog;
	this.scene.fog = new THREE.Fog(fogParams.color, fogParams.near, fogParams.far);
	this.renderer.setClearColor(this.scene.fog.color, 1.0);
	
	var controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
	controls.enablePan = false;
	controls.enableZoom = false;
	controls.target.set(0, 5.0, 0);
	controls.update();

	this.initStars();
	this.initNorthernLights();
	this.initFireflies();
	this.initWater();
	this.initRocks();
	
	this.time = 0.0;
}

NightLakeScene.prototype.initStars = function() {
	var starsObject = this.scene.getObjectByName("stars", true);
	var params = starsObject.userData;
	params.starSprite = this.textures[params.starSprite];

	var stars = this.stars = new StarrySky(params);
	stars.renderOrder = -1000;
	starsObject.add(stars);
};

NightLakeScene.prototype.initNorthernLights = function() {
	var lights = this.northernLights = this.scene.getObjectByName("northernLights", true);
	var params = lights.userData;
	params.noiseSampler = this.textures[params.noiseSampler];
	params.lightColor = new THREE.Color(params.lightColor);
	params.diffuseColor = new THREE.Color(params.diffuseColor);
	params.transform = new THREE.Matrix4().fromArray(params.transform);
	
	lights.material = NorthernLights.createMaterial(params);
	lights.renderOrder = -950.0;
};

NightLakeScene.prototype.initRocks = function() {
	var rock = this.scene.getObjectByName("rock", true),
		params = rock.userData;

	var minPosition = new THREE.Vector3().fromArray(params.minPosition),
		maxPosition = new THREE.Vector3().fromArray(params.maxPosition),
		minScale = new THREE.Vector3().fromArray(params.minScale),
		maxScale = new THREE.Vector3().fromArray(params.maxScale);
	var rocks = [];
	
	for (var i = 0; i < params.count; i++) {
		var obj = new THREE.Mesh(rock.geometry, null);
		
		var position, scale;
		do {
			position = MathUtils.randomPt(minPosition, maxPosition);
			scale = MathUtils.randomPt(minScale, maxScale);
			obj.scale.copy(scale);
			obj.position.copy(position);
			obj.rotateY(Math.random() * Math.PI / 2);
			obj.rotateX((2.0 * Math.random() - 1.0) * Math.PI / 6);
			obj.updateMatrixWorld();
		} while (MathUtils.intersects(rocks, obj));
		
		rocks.push(obj);
	}
	rock.geometry = THREE.GeometryUtils.mergeObjectGeometries(rocks);
};

NightLakeScene.prototype.initFireflies = function() {
	var fireflies = this.fireflies = [];
	this.scene.traverse(function(node) {
		if (node.userData.firefly) {
			fireflies.push(node);
		}
	});
	
	var moveOptions;
	
	for (var i = 0; i < fireflies.length; i++) {
		var firefly = fireflies[i], params = firefly.userData;
		params.color = new THREE.Color(params.color);
		
		if (params.moveOptions) {
			moveOptions = params.moveOptions;
			moveOptions.boundingBox = new THREE.Box3(
				new THREE.Vector3().fromArray(moveOptions.boundingBox.min),
				new THREE.Vector3().fromArray(moveOptions.boundingBox.max)
			);
		} else {
			params.moveOptions = moveOptions;
		}
		
		Firefly.setup.call(firefly, params);
	}
};

NightLakeScene.prototype.initWater = function() {
	var waterMesh = this.scene.getObjectByName('water', true),
		params = waterMesh.userData;
	params.normals = this.textures[params.normals];
	params.fog = this.scene.fog;

	this.water = new RefractiveWater(this.renderer, this.camera, params);
	waterMesh.material = this.water.material;
	waterMesh.add(this.water);
};

NightLakeScene.prototype.render = function(dt) {
	if (this.scene) {
		this.time += dt;
		
		this.stars.setTime(this.time);
		this.northernLights.material.uniforms.time.value = this.time;
		this.water.setTime(this.time, dt);
		
		for (var i = 0; i < this.fireflies.length; i++) {
			this.fireflies[i].setTime(this.time, dt);
		}
		
		this.water.render();
		this.renderer.render(this.scene, this.camera);
	}
};

namespace.NightLakeScene = NightLakeScene;

})(THREE);
