/**
 * Starry sky shader and a corresponding particle cloud object.
 * @author Alex Ostrovski
 */

(function(namespace) {

/**
 * Creates a new sky object with blinking stars.
 * Stars are located at the surface of a sphere centered at the start of local coordinates.
 * Stars are rendered with sprites.
 * 
 * @constructor
 * @param {Object} options
 *    sky options
 * @param {Number} options.nStars
 *    number of stars (default is 1000)
 * @param {Number} options.radius
 *    radius of the sky object (default is 200.0)
 * @param {Number} options.minSpriteSize
 *    minimum size of the star sprite (default is 1.0)
 * @param {Number} options.maxSpriteSize
 *    maximum size of the star sprite (default is 1.0)
 * @param {THREE.Texture2D} options.starSprite
 *    sprite for a single star
 */
function StarrySky(options) {
	options.nStars = options.nStars || 1000;
	options.radius = options.radius || 200;
	options.minSpriteSize = options.minSpriteSize || 1.0;
	options.maxSpriteSize = options.maxSpriteSize || 1.0;
	
	this._init(options);
}

var StarrySkyShader = {
		attributes: {
			size: { type: 'f', value: 0.0 },
			phase: { type: 'f', value: 0.0 },
			phaseVelocity: { type: 'f', value: 0.0 }
		},

		uniforms: {
			time: { type: 'f', value: 0.0 },
			spriteSampler: { type: 't', value: null }
		},
			
		vertexShader: [
			'attribute vec3 color;',
			'attribute float size;',
			'attribute float phase;',
			'attribute float phaseVelocity;',
			
			'varying vec4 vColor;',
			
			'uniform float time;',
			
			'void main() {',
			'	vColor = (0.8 + 0.2 * sin(phase + phaseVelocity * time)) * vec4(color, 1.0);',
			'	gl_PointSize = size;',
			'	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
			'}'
		].join('\n'),
		
		fragmentShader: [
			'varying vec4 vColor;',
			
			'uniform sampler2D spriteSampler;',
			
			'void main() {',
			'	gl_FragColor = texture2D(spriteSampler, gl_PointCoord) * vColor;',
			'}'
		].join('\n')
	};

StarrySky.prototype = Object.create(THREE.Points.prototype);

StarrySky.prototype._init = function(options) {
	var geometry = new THREE.BufferGeometry();
	var nStars = options.nStars;
	var positions = new Float32Array(3 * nStars), 
		colors = new Float32Array(3 * nStars),
		sizes = new Float32Array(nStars), 
		phases = new Float32Array(nStars), 
		phaseVelocities = new Float32Array(nStars);

	for (var i = 0; i < nStars; i++) {
		// TODO actually, this does not imply a uniform distribution on the sufrace of the sphere
		var pos = new THREE.Vector3(2.0 * Math.random() - 1.0, 2.0 * Math.random() - 1.0, 2.0 * Math.random() - 1.0)
			.normalize().multiplyScalar(options.radius);
		
		positions[3 * i + 0] = pos.x;
		positions[3 * i + 1] = pos.y;
		positions[3 * i + 2] = pos.z;
		
		var color = new THREE.Color();
		color.setHSL(0.5 + 0.3 * Math.random(), 0.8 + 0.2 * Math.random(), 0.9 + 0.1 * Math.random());
		var colorI = 0.5 + Math.random() * 1.5;
		colors[3 * i + 0] = color.r * colorI;
		colors[3 * i + 1] = color.g * colorI;
		colors[3 * i + 2] = color.b * colorI;
		
		sizes[i] = options.minSpriteSize + (options.maxSpriteSize - options.minSpriteSize) * Math.random();
		phases[i] = 2 * Math.PI * Math.random();
		phaseVelocities[i] = 3.0 + 1.5 * Math.random();
	}
	geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
	geometry.addAttribute('size', new THREE.BufferAttribute(sizes, 1));
	geometry.addAttribute('phase', new THREE.BufferAttribute(phases, 1));
	geometry.addAttribute('phaseVelocity', new THREE.BufferAttribute(phaseVelocities, 1));
	
	var shader = StarrySkyShader;
	var material = new THREE.ShaderMaterial({
		uniforms: shader.uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	material.uniforms.spriteSampler.value = options.starSprite;
	
	THREE.Points.call(this, geometry, material);
};

StarrySky.prototype.setTime = function(time) {
	this.material.uniforms.time.value = time;
	return this;
};

namespace.StarrySky = StarrySky;

})(THREE);