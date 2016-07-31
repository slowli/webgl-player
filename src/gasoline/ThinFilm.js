/**
 * Transparent thin film surface.
 *
 * @author Alex Ostrovski
 */

(function(namespace) {
	
// TODO remove 3D noise option

var ThinFilmShader = {

	uniforms: THREE.UniformsUtils.merge([
		THREE.ShaderLib.phong.uniforms, 
		{
			dataSampler: { type: 't', value: null },
			thicknessMap: { type: 't', value: null },
			thicknessOffsetRepeat: { type: 'v4', value: new THREE.Vector4(0, 0, 1, 1) },
			time: { type: 'f', value: 0.0 },
			interferencePower: { type: 'f', value: 1.0 },
			referencePoint: { type: 'v3', value: new THREE.Vector3() },
			minThickness: { type: 'f', value: 0.0 },
			maxThickness: { type: 'f', value: 1.0 },
			opacity: { type: 'f', value: 0.1 },
			inflation: { type: 'f', value: 0.01 }
		}
	]),
	
	vertexShader: [
		THREE.ShaderChunk.uv_pars_vertex,

		'varying vec2 vThicknessUv;',
		'uniform vec4 thicknessOffsetRepeat;',

		'varying vec3 vNormal;',
		'varying vec3 vViewPosition;',
		
		'uniform vec3 referencePoint;',
		'uniform float inflation;',
		
		'void main() {',
		THREE.ShaderChunk.uv_vertex,
		'	vThicknessUv = thicknessOffsetRepeat.zw * uv + thicknessOffsetRepeat.xy;',

		THREE.ShaderChunk.beginnormal_vertex,
		THREE.ShaderChunk.defaultnormal_vertex,
		'	vec3 inflatedPos = position + inflation * normal;',
		
		'	vec4 mvPosition = modelViewMatrix * vec4(inflatedPos, 1.0);',
		//'	vLocalNormal = position - referencePoint;',
		'	vNormal = transformedNormal;',
		'	vViewPosition = -mvPosition.xyz;',
		
		'	gl_Position = projectionMatrix * mvPosition;',
		'}' 
	].join('\n'),
	
	fragmentShader: [
		'varying vec2 vUv;',
		'varying vec2 vThicknessUv;',
		
		'uniform float minThickness;',
		'uniform float maxThickness;',
		
		'uniform float time;', // XXX: remove?
		'uniform sampler2D thicknessMap;',
		THREE.ShaderChunk.recursive_noise_2d,
		
		'uniform float interferencePower;',
		'uniform float baseThickness;',
		
		'uniform float opacity;',

		'uniform vec3 diffuse;',
		'uniform vec3 emissive;',
		'uniform vec3 specular;',
		'uniform float shininess;',
		
		THREE.ShaderChunk.lights_phong_pars_fragment,
		THREE.ShaderChunk.bumpmap_pars_fragment,
		THREE.ShaderChunk.fog_pars_fragment,
		
		THREE.ShaderChunk.common,
		
		'float interference(float thickness, float angleCos) {',
		'	float count = mod(thickness * angleCos, 1.0);',
		'	float intencity = 1.0 - pow(abs(1.0 - 2.0 * count), interferencePower);',
		'	return intencity;',
		'}',
		
		'void main() {',
		'	vec4 noise = getRecursiveNoise(thicknessMap, vThicknessUv, time);',
		'	float thickness = minThickness + (maxThickness - minThickness) * noise.b;',
		
		// Calculate lighting
		'	float specularStrength = 1.0;',
		'	gl_FragColor = vec4(1.0);',
		
		THREE.ShaderChunk.normal_phong_fragment,
		THREE.ShaderChunk.lights_phong_fragment,
		
		// 'normal' and 'viewPosition' variables are declared in the Phong lighting shader chunk
		'	vec3 refractedDir = refract(-viewDir, normal, 0.67);',
		'	float theta = dot(refractedDir, -normal);',
		
		'	float reflectTheta = max(dot(viewDir, normal), 0.0);',
		'	float reflectionFactor = 0.25;',
		'	float reflectance = reflectionFactor + (1.0 - reflectionFactor) * pow(1.0 - reflectTheta, 5.0);',
		
		'	vec3 intfColor = vec3(interference(thickness, theta), interference(thickness * 1.29, theta), interference(thickness * 1.45, theta));',
		
		'	vec3 surfaceColor = vec3(0.1);',
		'	vec3 outgoingLight = mix((totalDiffuseLight + ambientLightColor) * (surfaceColor + intfColor * 0.1),',
		'		vec3(0.1) + totalSpecularLight * (0.75 + intfColor * 1.5), reflectance);',
		
		THREE.ShaderChunk.fog_fragment,
		
		'	gl_FragColor = vec4(outgoingLight, 1.0);',
		'	gl_FragColor.a = opacity * smoothstep(0.0, 1.0, thickness) * reflectTheta;',
		'}'
	].join('\n')
};

function ThinFilm(params, geometry) {
	THREE.Mesh.call(this);
	
	var shader = ThinFilmShader;
	this.material = new THREE.ShaderMaterial({
		uniforms: THREE.UniformsUtils.clone(shader.uniforms),
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
		transparent: true,
		lights: true,
		fog: true
	});
	
	this.material.uniforms.diffuse.value = new THREE.Color(0xc0c0c0);
	this.material.uniforms.specular.value = new THREE.Color(0x4f4f4f);
	this.material.uniforms.shininess.value = 60.0;
	this.material.uniforms.minThickness.value = params.minThickness || 0.0;
	this.material.uniforms.maxThickness.value = params.maxThickness || 2.0;
	this.material.uniforms.opacity.value = params.opacity || 0.2;
	this.material.uniforms.time.value = params.time || 0.0;
	this.material.uniforms.inflation.value = params.inflation || 0.01;

	if (params.thicknessMap) {
		var map = params.thicknessMap;
		this.material.uniforms.thicknessMap.value = map;
		this.material.uniforms.thicknessOffsetRepeat.value.set(map.offset.x, map.offset.y, map.repeat.x, map.repeat.y);
	}
	
	if (params.bumpMap) {
		this.setBumpMap(params.bumpMap, params.bumpScale);
	}
	
	if (geometry) this.geometry = geometry;
}

ThinFilm.prototype = Object.create(THREE.Mesh.prototype);

ThinFilm.prototype.setBumpMap = function(bumpMap, bumpScale) {
	this.material.bumpMap = bumpMap;
	this.material.uniforms.bumpMap.value = bumpMap;
	this.material.uniforms.bumpScale.value = bumpScale || 1.0;
	this.material.uniforms.offsetRepeat.value.set(bumpMap.offset.x, bumpMap.offset.y, bumpMap.repeat.x, bumpMap.repeat.y);
	return this;
};

namespace.ThinFilm = ThinFilm;

})(THREE);
