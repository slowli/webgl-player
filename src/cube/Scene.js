/**
 * Rotating cube.
 * @author Alex Ostrovski
 */

(function(namespace) {
 
/**
 * Initializes the scene.
 * @param {THREE.WebGLRenderer} renderer
 *    scene renderer
 * @param {Object} data
 *    loaded scene data 
 */
function CubeScene(renderer, scene) {
	this.renderer = renderer;
	
	this.scene = scene;
	this.cube = this.scene.getObjectByName('cube', true);
	this.camera = this.scene.getObjectByName('camera', true);
	this.camera.lookAt(this.cube.position);
}

/**
 * Renders the scene.
 * 
 * @param {Number} dt
 *    time increment
 */
CubeScene.prototype.render = function(dt) {
	this.cube.rotateY(dt * 0.2);
	this.cube.rotateX(dt * 0.1);
	this.renderer.render(this.scene, this.camera);
};

namespace.CubeScene = CubeScene;

})(THREE);