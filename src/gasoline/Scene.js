/**
 * Thin film interference demo.
 *
 * @author Alex Ostrovski
 */

(function(namespace) {
	
var ThinFilm = namespace.ThinFilm,
	OilyWater = namespace.OilyWater;

function GasolineScene(renderer, data) {
	this.renderer = renderer;
	this.width = renderer.domElement.clientWidth;
	this.height = renderer.domElement.clientHeight;
	this.aspectRatio = this.width / this.height;
	this.initScene(data);
}

GasolineScene.prototype.initScene = function(data) {
	this.scene = data;
	this.camera = this.scene.getObjectByName('camera', true);
	this.textures = data.globals.textures;
	
	var controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
	controls.enablePan = false;
	controls.maxPolarAngle = Math.PI * 0.5;
	controls.target.set(0, 5, 0);
	// TODO find initial camera pos
	controls.update();
	
	var fogParams = this.scene.userData.fog;
	this.scene.fog = new THREE.Fog(fogParams.color, fogParams.near, fogParams.far);
	this.renderer.setClearColor(this.scene.fog.color, 1.0);
	
	this.initWater();
	this.initAsphalt();
	this.initBarrels();
	
	this.time = 0.0;
};

GasolineScene.prototype.initWater = function() {
	var waterMesh = this.scene.getObjectByName('water', true),
		params = waterMesh.userData;
	params.normals = this.textures[params.normals];
	params.thicknessMap = this.textures[params.thicknessMap];
	params.fog = this.scene.fog;
	
	this.water = new OilyWater(this.renderer, this.camera, params);
	waterMesh.material = this.water.material;
	waterMesh.add(this.water);
};

GasolineScene.prototype.initAsphalt = function() {
	var mesh = this.scene.getObjectByName('asphalt', true),
		params = mesh.userData;
	params.thicknessMap = this.textures[params.thicknessMap];
	if (params.bumpMap) {
		params.bumpMap = this.textures[params.bumpMap];
	}
	
	var film = new ThinFilm(params, mesh.geometry);
	mesh.add(film);
};

GasolineScene.prototype.initBarrels = function() {
	var barrels = [];
	this.scene.traverse(function(node) {
		if (node.userData.barrel) {
			barrels.push(node);
		}
	});
	
	var params = barrels[0].userData;
	params.thicknessMap = this.textures[params.thicknessMap];
	
	var composedGeometry = THREE.GeometryUtils.mergeObjectGeometries(barrels);
	film = new ThinFilm(params, composedGeometry);
	this.scene.add(film);
};

GasolineScene.prototype.render = function(dt) {
	this.time += dt;
	this.water.setTime(0.5 * this.time);
	this.water.render();
	this.renderer.render(this.scene, this.camera);
};

namespace.GasolineScene = GasolineScene;

})(THREE);
