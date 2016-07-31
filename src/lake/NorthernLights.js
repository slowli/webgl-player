/**
 * Northern lights shader.
 *
 * @author Alex Ostrovski
 */

(function(namespace) { 

var NorthernLights_Shader = {

	uniforms: {
		// Light color
		lightColor: { type: 'c', value: new THREE.Color(0x88ff88) },
		// Color of the top of the lights
		diffuseColor: { type: 'c', value: new THREE.Color(0x6060a0) },
		// Transformation matrix for getting noise
		// Input: (UV coordinates, 1.0, time)
		// Output: x - influences color, y - influences height of the lights
		transform: { type: 'm4', value: new THREE.Matrix4() },
		
		// Noise variables
		time: { type: 'f', value: 0.0 },
		noiseSampler: { type: 't', value: null}
	},
	
	vertexShader: [
		'varying vec4 vPosition;',
		'varying vec2 vUv;',
		'varying vec3 vNormal;',
		'varying vec3 vViewPosition;',
		
		'uniform float time;',
		'uniform mat4 transform;',
		
		'void main() {',
		'	vPosition = transform * vec4(uv, 1.0, time);',
		'	vNormal = normalize(normalMatrix * normal);',
		'	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
		'	vViewPosition = -mvPosition.xyz;',
		'	vUv = uv;',
		'	gl_Position = projectionMatrix * mvPosition;',
		'}'
	].join('\n'),
	
	fragmentShader: [
		'varying vec4 vPosition;',
		'varying vec2 vUv;',
		'varying vec3 vNormal;',
		'varying vec3 vViewPosition;',
		
		'uniform vec3 lightColor;',
		'uniform vec3 diffuseColor;',
		
		'uniform sampler2D noiseSampler;',
		THREE.ShaderChunk.noise,
		
		'float smoothedge(float lowEdge, float highEdge, float value) {',
		'	return smoothstep(0.0, lowEdge, value) - smoothstep(1.0 - highEdge, 1.0, value);',
		'}',
		
		'const float colorSpread = 0.1;',
		'const float spatialSpread = 0.8;',
		
		'void main() {',
		'	float theta = dot(normalize(vNormal), normalize(vViewPosition));',
		'	theta = abs(theta);',
		
		'	float t = vPosition.w;',
		'	vec4 noise = getNoise(noiseSampler, vPosition.xx, t);',
		'	vec3 baseColor = /*lightColor + colorSpread */ noise.rgb * vec3(1.0, 1.25, 0.5);',
		'	vec3 upColor = /*diffuseColor + colorSpread */ noise.brg  * vec3(1.0, 0.65, 1.25) + vec3(0.0, 0.0, 0.1);',
		
		'	noise = getNoise(noiseSampler, vPosition.yy, t);',
		//'	float end = 1.5;',
		'	float end = 1.0 / (0.2 + spatialSpread * noise.g);',
		'	baseColor = mix(baseColor, upColor, min(vUv.y * end * 1.65, 1.0));',
		'	float I = noise.b + 0.1;',
		//'	float I = 0.6;',
		'	vec3 color = baseColor * I * 2.0 + (baseColor * baseColor - 0.05);',
		
		'	if( color.r > 1.0 ){ color.bg += color.r - 1.0; }',
		'	if( color.g > 1.0 ){ color.rb += color.g - 1.0; }',
		'	if( color.b > 1.0 ){ color.br += color.b - 1.0; }',
		
		'	float alpha = smoothedge(0.1, 0.6, vUv.y * end);',
		'	gl_FragColor = vec4(color, alpha * pow(theta, 2.0));',
		//'	gl_FragColor = vec4(vec3(vPosition.x), alpha * pow(theta, 2.0));',
		'}'
	].join('\n')
};

function NorthernLights() {}

NorthernLights.createMaterial = function(params) {
	var shader = NorthernLights_Shader;
	var material = new THREE.ShaderMaterial({
		uniforms: THREE.UniformsUtils.clone(shader.uniforms),
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		transparent: true,
		blending: THREE.AdditiveBlending
	});
	material.uniforms.noiseSampler.value = params.noiseSampler;
	material.uniforms.lightColor.value = params.lightColor;
	material.uniforms.diffuseColor.value = params.diffuseColor;
	material.uniforms.transform.value = params.transform;
	return material;
};

namespace.NorthernLights = NorthernLights;

})(THREE);
