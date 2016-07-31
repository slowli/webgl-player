/**
 * Firefly shader and corresponding mesh.
 * (c) 2014 Alex Ostrovski
 */
 
(function(namespace) {

// Imports
var MathUtils = namespace.MathUtils;


function Firefly() { }

var Firefly_Shader = {

	uniforms: {
		diffuseColor: { type: 'c', value: new THREE.Color(0xaaaaaa) },
		specularColor: { type: 'c', value: new THREE.Color(0xaaaaaa) },
		specularR: {type: 'f', value: 0.2 },
		direction: { type: 'v3', value: new THREE.Vector3() }
	},
	
	vertexShader: [
		'varying vec3 vViewPosition;',
		'varying vec3 vNormal;',
		
		'void main() {',
		'	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
		'	vViewPosition = -mvPosition.xyz;',
		'	vNormal = normalMatrix * normal;',
		'	gl_Position = projectionMatrix * mvPosition;',
		'}'
	].join('\n'),
	
	fragmentShader: [
		'varying vec3 vViewPosition;',
		'varying vec3 vNormal;',
		
		'uniform vec3 diffuseColor;',
		'uniform vec3 specularColor;',
		'uniform float specularR;',
		
		'uniform vec3 direction;',
		
		'void main() {',
		'	vec3 eyeDirection = normalize(vViewPosition);',
		'	vec3 r = normalize(vNormal);',
		'	float theta = 1.0 - max(dot(eyeDirection, r), 0.0);',
		'	theta = pow(theta, 0.5);',
		
		'	float lightI = 0.5 * (1.0 - smoothstep(0.0, 1.0, theta)) ',
		'		+ 2.0 * (1.0 - smoothstep(0.0, specularR, theta));',
		
		'	gl_FragColor = lightI * vec4(diffuseColor, 1.0);',
		'}'
	].join('\n')
};

Firefly.setup = function(parameters) {
	var shader = Firefly_Shader;
	this.material = new THREE.ShaderMaterial({
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		uniforms: THREE.UniformsUtils.clone(shader.uniforms),
		transparent: true,
		blending: THREE.AdditiveBlending
	});
	this.material.uniforms.diffuseColor.value = parameters.color || new THREE.Color(0xaaaaaa);
	
	this._moveTime = 0.0;
	this._moveDuration = -1.0;
	this._sleeping = false;
	
	this.moveOptions = parameters.moveOptions;
	this.sleepP = parameters.sleepP || 0.0;
	this.sleepDuration = parameters.sleepDuration || { 'min': 0, 'max': 0 };
	
	this._newPath = Firefly.prototype._newPath;
	this.setTime = Firefly.prototype.setTime;
};

Firefly.prototype._newPath = function() {
	this._curve = MathUtils.BezierCurve.random(this.position, this.moveOptions, this._curve);
	var travelTime = this.moveOptions.travelTime;
	this._moveDuration = travelTime.min + Math.random() * (travelTime.max - travelTime.min);
};

Firefly.prototype.setTime = function(dummy, delta) {
	this._moveTime += delta;
	
	if (this._moveTime >= this._moveDuration) {
		while ((this._moveDuration > 0) && (this._moveTime >= this._moveDuration)) {
			this._moveTime -= this._moveDuration;
		}
		
		if (Math.random() < this.sleepP) {
			this._sleeping = true;
			var time = this.sleepDuration;
			this._moveDuration = Math.random() * (time.max - time.min) + time.min;
		} else {
			this._newPath();
			this._sleeping = false;
		}
	}
	
	if (this._sleeping) {
		return;
	}
	
	var t = this._moveTime / this._moveDuration;
	
	this.position.copy(this._curve.position(t));
	//!var tangent = this._curve.tangent(t).normalize();
	//this.material.uniforms['direction'].value = tangent;
	
	if (this._debug) {
		this._dirHelper.setDirection(tangent);
	}
};

namespace.Firefly = Firefly;

})(THREE);
