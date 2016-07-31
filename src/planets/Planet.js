/**
 * Cloudy planet shader and 3d object.
 * @author Alex Ostrovski
 */

(function(namespace) {

// TODO remove; implement as postprocessing
// XXX is it used?
var HaloShader = {
	'uniforms': {
		'haloColor': { type: 'c', value: new THREE.Color(0xffffff) },
		
		'time': { type: 'f', value: 0.0 }
	},
	
	'vertexShader': [
		'varying vec3 vViewPosition;',
		'varying vec3 vViewNormal;',
		'varying vec3 vNormal;',
		
		'void main() {',
		'	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
		
		'	vViewPosition = -mvPosition.xyz;',
		'	vNormal = normal;',
		'	vViewNormal = normalize(normalMatrix * normal);',
		
		'	gl_Position = projectionMatrix * mvPosition;',
		'}'
	].join('\n'),
	
	'fragmentShader': [
		'varying vec3 vViewPosition;',
		'varying vec3 vViewNormal;',
		'varying vec3 vNormal;',

		'uniform vec3 haloColor;',
		
		'void main() {',
		'	vec3 cameraDir = normalize(vViewPosition.xyz);',
		'	float theta = max(dot(cameraDir, normalize(vViewNormal)), 0.0);',
		'	theta = smoothstep(0.0, 1.0, pow(theta, 2.0));',
		
		'	gl_FragColor = vec4(haloColor, theta);',
		'}'
	].join('\n')
};

// XXX remove
/*function Planet(mass, radius, options) {
	THREE.Mesh.call(this);

	if (!options) options = {};
	options.surfaceColor = options.surfaceColor || new THREE.Color(0xc0d0ff);
	options.cloudColor = options.cloudColor || new THREE.Color(0xffffff);
	if (options.lighting == undefined) {
		options.lighting = true;
	}
	options.cloudSpeed = options.cloudSpeed || 0.0;
	options.cloudIntencity = options.cloudIntencity || 1.0;
	
	this.geometry = new THREE.SphereGeometry(0.9 * radius, 50, 30);
	
	var shader = CloudyPlanetShader;
	this.material = new THREE.ShaderMaterial({
		'uniforms': THREE.UniformsUtils.clone(shader.uniforms),
		'defines': { 'LIGHTING': options.lighting },
		'vertexShader': shader.vertexShader,
		'fragmentShader': shader.fragmentShader,
		'lights': options.lighting,
		//'transparent': true // Doesn't work well with particles
	});
	this.material.uniforms['surfaceColor'].value = options.surfaceColor;
	this.material.uniforms['cloudColor'].value = options.cloudColor;
	this.material.uniforms['cloudIntencity'].value = options.cloudIntencity;
	
	this.mass = mass;
	this.radius = radius;
	this.cloudSpeed = options.cloudSpeed;
	
	
}*/

function Planet() {}

var Planet_CloudyShader = {

	uniforms: THREE.UniformsUtils.merge([
		THREE.ShaderLib.lambert.uniforms,
		{
			time: { type: 'f', value: 1.0 },
			cloudSampler: { type: 't', value: null },
			
			surfaceColor: { type: 'c', value: new THREE.Color(0xc0d0ff) },
			cloudColor: { type: 'c', value: new THREE.Color(0xffffff) },
			cloudIntencity: { type: 'f', value: 1.0 }
		}
	]),
	
	defines: {
		LIGHTING: false // whether to use Lambert shading model
	},
	
	vertexShader: [
		'varying vec3 vViewPosition;',
		'varying vec3 vViewNormal;',
		'varying vec3 vNormal;',

		'#ifdef LIGHTING',
		'varying vec3 vLightFront;',
		THREE.ShaderChunk.lights_lambert_pars_vertex,
		THREE.ShaderChunk.common,
		'#endif',


		'void main() {',
		'	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
		
		'	vViewPosition = -mvPosition.xyz;',
		'	vNormal = normal;',
		'	vViewNormal = normalize(normalMatrix * normal);',
		
		'	#ifdef LIGHTING',
		'	vec3 transformedNormal = vViewNormal;',
		'	vLightFront = vec3(0.0);',
		THREE.ShaderChunk.lights_lambert_vertex,
		'	#endif',
		
		'	gl_Position = projectionMatrix * mvPosition;',
		'}'
	].join('\n'),
	
	fragmentShader: [
		'varying vec3 vViewPosition;',
		'varying vec3 vViewNormal;',
		'varying vec3 vNormal;',
		
		'#ifdef LIGHTING',
		'varying vec3 vLightFront;',
		'#endif',

		'uniform samplerCube cloudSampler;',
		'uniform float time;',
		THREE.ShaderChunk.recursive_noise_3d,

		'uniform vec3 surfaceColor;',
		'uniform vec3 cloudColor;',
		'uniform float cloudIntencity;',

		'void main( void ) {',
		'	vec3 cameraDir = normalize(vViewPosition.xyz);',
		'	float theta = 1.0 - max(dot(cameraDir, normalize(vViewNormal)), 0.0);',
		
		'	vec4 noise = getRecursiveNoise(cloudSampler, normalize(vNormal), time);',
		'	vec4 color = vec4(surfaceColor, 1.0);',
		'	color.rgb = mix(color.rgb, cloudColor, pow(max(noise.g * 1.25, 0.0), cloudIntencity));',
		
		'	gl_FragColor = clamp(color, vec4(0.0), vec4(1.0));',
		'	#ifdef LIGHTING',
		'	gl_FragColor.rgb *= vLightFront;',
		'	#endif',
		'}'
	].join('\n')
};

Planet.setup = function(parameters) {
	if (parameters.lighting === undefined) parameters.lighting = true;

	this.mass = parameters.mass;
	this.radius = parameters.radius;
	this.cloudSpeed = parameters.cloudSpeed;
	
	var shader = Planet_CloudyShader;
	this.material = new THREE.ShaderMaterial({
		uniforms: THREE.UniformsUtils.clone(shader.uniforms),
		defines: { LIGHTING: parameters.lighting },
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
		lights: parameters.lighting
	});
	this.material.uniforms.surfaceColor.value = parameters.surfaceColor;
	this.material.uniforms.cloudColor.value = parameters.cloudColor;
	this.material.uniforms.cloudIntencity.value = parameters.cloudIntencity;
	this.material.uniforms.cloudSampler.value = parameters.cloudSampler;
	
	this.orbitRotation = Planet.prototype.orbitRotation;
	this.selfRotation = Planet.prototype.selfRotation;
	this.setTime = Planet.prototype.setTime;
	
	this.orbitV = 0.0;
	this.selfV = 0.0;
	this._vec = new THREE.Vector3();
	
	this._rotationHelper = new THREE.Line(
		new THREE.Geometry(),
		new THREE.LineBasicMaterial({ color: 0xffff00 })
	);
	this._rotationHelper.visible = false;
	this.add(this._rotationHelper);
	
	this._orbitHelper = new THREE.Mesh(
		new THREE.Geometry(),
		new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
	);
	this._orbitHelper.visible = false;
	
	this._cloudOffset = 10.0 * Math.random();
	
	if (parameters.rotationSpeed) {
		this.selfRotation(parameters.rotationAxis, parameters.rotationSpeed);
	}
	if (parameters.orbitSpeed) {
		this.orbitRotation(parameters.orbitFocus, parameters.orbitSpeed, parameters.orbitE);
	}
};

Planet.prototype = Object.create(THREE.Mesh.prototype);

Planet.prototype.orbitRotation = function(focus, angularV, eccentricity) {
	this.eccentricity = eccentricity || 0.0;
	this.focus = focus;
	this.majorR = focus.distanceTo(this.position) / (1 + this.eccentricity);
	this.majorDir = this.position.clone().sub(focus).normalize();
	
	this._vec.copy(this.up).projectOnVector(this.majorDir);
	this.orbitAxis = this.up.clone().sub(this._vec).normalize();
	this.orbitV = angularV;
	
	this._orbitHelper.geometry = new THREE.RingGeometry(this.majorR, this.majorR, 50);
	var orbitCenter = this.majorDir.clone().multiplyScalar(this.majorR * this.eccentricity).add(this.focus);
	this._orbitHelper.position.copy(orbitCenter);
	this._orbitHelper.up.copy(this.orbitAxis);
	this._orbitHelper.lookAt(orbitCenter.clone().add(this.orbitAxis));
	this._orbitHelper.scale.set(1.0, 1.0, 1.0 - this.eccentricity);
	
	return this;
};

Planet.prototype.selfRotation = function(axis, angularV) {
	this.selfAxis = axis;
	this.selfV = angularV;
	
	var vx = this._rotationHelper.geometry.vertices;
	vx.length = 0;
	vx.push(axis.clone().multiplyScalar(this.radius * 1.25).negate());
	vx.push(axis.clone().multiplyScalar(this.radius * 1.25));
	
	return this;
};

Planet.prototype.setTime = function(time, delta) {
	this.material.uniforms.time.value = time * this.cloudSpeed + this._cloudOffset;
	
	if (this.orbitV !== 0.0) {
		var angle = this.orbitV * time;
		var r = this.majorR * (1 - this.eccentricity * this.eccentricity) / (1 - this.eccentricity * Math.cos(angle));
		this._vec.copy(this.majorDir).multiplyScalar(r).applyAxisAngle(this.orbitAxis, angle).add(this.focus);
		this.position.copy(this._vec);
	}
	
	if (this.selfV !== 0.0) {
		this.rotateOnAxis(this.selfAxis, delta * this.selfV);
	}
};

namespace.Planet = Planet;

})(THREE);