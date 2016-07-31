/**
 * Water with thin film on it.
 *
 * @author Alex Ostrovski
 */

(function(namespace) {
	
// Imports
	
var Mirror = namespace.Mirror;

var OilyWaterShader = {

	uniforms: THREE.UniformsUtils.merge([
		THREE.ShaderLib.phong.uniforms,
		{
			skySampler: { type: 't', value: null },
			noiseSampler: { type: 't', value: null },
			normalsSampler: { type: 't', value: null },
			time: { type: 'f', value: 0.0 },
			
			textureMatrix: {type: 'm4', value: null },
			
			distortion: { type: 'f', value: 1.5 },
			reflectionFactor: { type: 'f', value: 0.35 },
			waterColor: { type: 'c', value: new THREE.Color(0x103040) },
			oilColor: { type: 'c', value: new THREE.Color(0x303030) },
			thicknessRange: { type: 'f', value: 2.5 }
		}
	]),

	vertexShader: [
		'uniform mat4 textureMatrix;',
		//'uniform mat4 refractionMatrix;',
	
		'varying vec2 vUv;',
		'varying vec3 vPosition;',
		'varying vec4 vTexturePos;',
		'varying vec3 vViewPosition;',
		
		'void main() {',
		'	vUv = uv;',
		'	vPosition = (modelMatrix * vec4(position, 1.0)).xyz;',
		'	vTexturePos = textureMatrix * modelMatrix * vec4(position, 1.0);',
		'	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
		'	vViewPosition = -mvPosition.xyz;',
		'	gl_Position = projectionMatrix * mvPosition;',
		'}'
	].join('\n'),

	fragmentShader: [
		'varying vec2 vUv;',
		'varying vec3 vPosition;',
		'varying vec4 vTexturePos;',
		
		'uniform mat3 normalMatrix;',
		
		'uniform float distortion;',
		
		'uniform vec3 waterColor;',
		'uniform vec3 filmColor;',
		'const float waterMirrorReflectivity = 0.9;',
		'const float filmMirrorReflectivity = 0.3;',
		'const float waterReflectionFactor = 0.3;',
		'const float filmReflectionFactor = 0.7;',
		'const float waterShininess = 10.0;',
		'const float filmShininess = 50.0;',
		
		'uniform float thicknessRange;',
		
		// Lights
		THREE.ShaderChunk.lights_phong_pars_fragment,
		'uniform vec3 diffuse;',
		'uniform vec3 emissive;',
		'uniform vec3 specular;',
		
		'uniform float time;',
		
		THREE.ShaderChunk.noise,
		THREE.ShaderChunk.recursive_noise_2d,

		THREE.ShaderChunk.fog_pars_fragment,
		
		'uniform sampler2D skySampler;',
		'uniform sampler2D normalsSampler;',
		'uniform sampler2D noiseSampler;',
		
		THREE.ShaderChunk.common,
		
		'const float interferencePower = 1.0;',
		'float interference(float thickness, float angleCos) {',
		'	float count = mod(thickness * angleCos, 1.0);',
		'	float intencity = 1.0 - pow(abs(1.0 - 2.0 * count), interferencePower);',
		'	return intencity;',
		'}',
		
		'void main() {',
		// Calculate surface normal
		'	vec3 normal = getNoise(normalsSampler, vPosition.xz * 10.0, time).xzy;',
		'	normal = 2.0 * normal - 1.0;',
		
		//'	vec2 dN = vec2(dFdx(normal.x), dFdy(normal.z));',
		//'	gl_FragColor = vec4(dN, 0.0, 1.0); return;',
		
		//'	normal = mix(normal, vec3(0.0, 1.0, 0.0), filmI * 0.5);', // film is disturbed less than water
		
		// Calculate distortion before we transform the normal from world to view coordinates
		'	vec2 refPos = vTexturePos.xy + normal.xz * distortion;',
		
		'	float thickness = thicknessRange * getRecursiveNoise(noiseSampler, vUv - 0.01 * normal.xz, 0.0).b;',
		//'	gl_FragColor = vec4(vec3(thickness), 1.0); return;',
		
		'	float filmI = smoothstep(0.0, 1.0, thickness);',
		//'	const float filmI = 0.0;', 
		//'	const float thickness = 0.0;',
		
		// Interpolate surface parameters
		'	float mirrorC = mix(waterMirrorReflectivity, filmMirrorReflectivity, filmI);',
		'	float shininess = mix(waterShininess, filmShininess, filmI);',
		'	float reflectionFactor = mix(waterReflectionFactor, filmReflectionFactor, filmI);',
		'	vec3 surfaceColor = mix(vec3(0.15), vec3(0.3), filmI);', // mix(waterColor, filmColor, filmI);
		
		'	const float specularStrength = 1.0;',

		'	normal = normalize(normalMatrix * normal.xzy);',
		'	float theta = max(dot(normalize(vViewPosition), normal), 0.0);',
		//'	gl_FragColor = vec4(vec3(theta), 1.0); return;',
		
		'	vec3 intfColor = vec3(interference(thickness, theta), interference(thickness * 1.29, theta), interference(thickness * 1.45, theta));',
		//'	gl_FragColor = vec4(intfColor, 1.0); return;',
		
		'	vec3 skyColor = texture2D(skySampler, refPos / vTexturePos.w).rgb;',
		'	float reflectance = reflectionFactor + (1.0 - reflectionFactor) * pow((1.0 - theta), 5.0);',
		//'	gl_FragColor = vec4(skyColor, 1.0); return;',
		
		THREE.ShaderChunk.lights_phong_fragment,
		
		'	totalDiffuseLight += ambientLightColor;',
		'	vec3 outgoingLight = mix(totalDiffuseLight * surfaceColor + totalDiffuseLight * intfColor * 0.1 * filmI,',
		'		vec3(0.1) + skyColor * mirrorC + totalSpecularLight * (0.25 + intfColor * 1.0), reflectance);',
		
		THREE.ShaderChunk.fog_fragment, 
		'	gl_FragColor = vec4(outgoingLight, 1.0);',
		'}'
	].join('\n')
};

function OilyWater(renderer, camera, options) {
	Mirror.call(this, renderer, camera, options);
	this.name = 'water_' + this.id;
	
	this.texture.texture.generateMipmaps = false;
	this.texture.texture.magFilter = THREE.LinearFilter;
	this.texture.texture.minFilter = THREE.LinearFilter;
	
	var shader = OilyWaterShader;
	var shaderUniforms = THREE.UniformsUtils.clone(shader.uniforms);

	this.material = new THREE.ShaderMaterial({
		lights: true,
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		uniforms: shaderUniforms,
		fog: true
	});
	
	this.material.uniforms.textureMatrix.value = this.textureMatrix;
	this.material.uniforms.skySampler.value = this.texture;
	this.material.uniforms.normalsSampler.value = options.normals;
	this.material.uniforms.noiseSampler.value = options.thicknessMap;
	
	if (options.fog) {
		this.material.uniforms.fogColor.value = options.fog.color;
		this.material.uniforms.fogNear.value = options.fog.near;
		this.material.uniforms.fogFar.value = options.fog.far;
		this.material.defines = { USE_FOG: '' };
	}
	
	this.renderer = renderer;
}

OilyWater.prototype = Object.create(Mirror.prototype);

OilyWater.prototype.setTime = function(t) {
	this.material.uniforms.time.value = t;
};

OilyWater.prototype.updateTextureMatrix = function () {
	this.updateMatrixWorld();
	this.camera.updateMatrixWorld();
	this.mirrorWorldPosition.setFromMatrixPosition( this.matrixWorld );
	this.cameraWorldPosition.setFromMatrixPosition( this.camera.matrixWorld );

	this.rotationMatrix.extractRotation( this.matrixWorld );
	this.normal.set( 0, 0, -1 );
	this.normal.applyMatrix4( this.rotationMatrix );

	var _this = this;
	this.updateCamera(this.mirrorCamera, this.textureMatrix, function(v) {
		return v.reflect(_this.normal);
	});
	this.setClipPlane(this.mirrorCamera);
};

OilyWater.prototype.render = function () {
	this.updateTextureMatrix();

	// Render the mirrored view of the current scene into the target texture
	var scene = this;
	while ( scene.parent ) {
		scene = scene.parent;
	}

	if (scene && (scene instanceof THREE.Scene)) {
		this.material.visible = false;
		this.renderer.render(scene, this.mirrorCamera, this.texture, true);
		this.material.visible = true;
	}
};

namespace.OilyWater = OilyWater;

})(THREE);
