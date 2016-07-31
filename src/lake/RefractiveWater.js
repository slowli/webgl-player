/**
 * Water shader that supports refraction.
 * @author Alex Ostrovski
 */

(function(namespace) {
	
// Imports
var Mirror = namespace.Mirror;

var RefractiveWater_Shader = {

	uniforms: THREE.UniformsUtils.merge([
		THREE.UniformsLib.lights,
		THREE.UniformsLib.fog,
		{
			floorSampler: { type: 't', value: null },
			skySampler: { type: 't', value: null },
			normalsSampler: { type: 't', value: null },
			time: { type: 'f', value: 0.0 },
			
			textureMatrix: {type: 'm4', value: null },
			refractionMatrix: {type: 'm4', value: null },
			
			distortion: { type: 'f', value: 2.0 },
			reflectionFactor: { type: 'f', value: 0.4 },
			waterColor: { type: 'c', value: new THREE.Color(0x406070) },
			shininess: { type: 'f', value: 5.0 }
		}
	]),

	vertexShader: [
		'uniform mat4 textureMatrix;',
		'uniform mat4 refractionMatrix;',
	
		'varying vec3 vPosition;',
		'varying vec3 vViewPosition;',
		'varying vec4 vTexturePos;',
		'varying vec4 vRefractedPos;',
		
		'void main() {',
		'	vPosition = (modelMatrix * vec4(position, 1.0)).xyz;',
		'	vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
		'	vViewPosition = -mvPosition.xyz;',
		'	vTexturePos = textureMatrix * modelMatrix * vec4(position, 1.0);',
		'	vRefractedPos = refractionMatrix * modelMatrix * vec4(position, 1.0);',
		'	gl_Position = projectionMatrix * mvPosition;',
		'}'
	].join('\n'),

	fragmentShader: [
		'varying vec3 vPosition;',
		'varying vec4 vTexturePos;',
		'varying vec4 vRefractedPos;',
		
		'uniform float distortion;',
		'uniform float reflectionFactor;',
		'uniform vec3 waterColor;',
		
		'uniform mat3 normalMatrix;',
		
		// Lights
		THREE.ShaderChunk.common,
		THREE.ShaderChunk.lights_phong_pars_fragment,
		
		'uniform float shininess;',
		THREE.ShaderChunk.phong_lighting,
		
		'uniform float time;',
		'uniform sampler2D normalsSampler;',
		THREE.ShaderChunk.noise,
		THREE.ShaderChunk.fog_pars_fragment,
		
		'uniform sampler2D floorSampler;',
		'uniform sampler2D skySampler;',
		
		'void main() {',
		'	vec3 normal = getNoise(normalsSampler, vPosition.xz * 30.0, time).xzy;',
		'	normal = 2.0 * normal - 1.0;',
		'	normal = normalize(normal);',
		
		// Determine sky and bottom texture points that corresponds to the surface point
		'	vec3 eyeDir = normalize(cameraPosition - vPosition);',
		'	float theta = max(dot(eyeDir, normal), 0.0);',
		'	vec2 refPos = vRefractedPos.xy - normal.xz * distortion * 0.75;',
		'	vec3 floorColor = texture2D(floorSampler, refPos / vRefractedPos.w).rgb;',
		'	floorColor = mix(waterColor, floorColor, min(theta, 0.9));',
		'	refPos = vTexturePos.xy + normal.xz * distortion;',
		'	vec3 skyColor = texture2D(skySampler, refPos.xy / vTexturePos.w).rgb;',
		

		// Convert the normal to view coordinates
		'	normal = normalMatrix * normal.xzy;',
		
		//  Apply lighting
		'	vec3 specular = waterColor;',
		'	float specularStrength = 1.0;',
		THREE.ShaderChunk.lights_phong_fragment,
		'	totalDiffuseLight += ambientLightColor;',
		
		'	float reflectance = reflectionFactor + (1.0 - reflectionFactor) * pow((1.0 - theta), 5.0);',
		'	vec3 outgoingLight = mix(totalDiffuseLight * floorColor,',
		'		vec3( 0.1 ) + skyColor * 0.9 + skyColor * totalSpecularLight, reflectance);',
		'	gl_FragColor = vec4(outgoingLight, 1.0);',
		
		// Apply fog if needed
		'	#ifdef USE_FOG',
		'	float fogDepth = smoothstep(fogNear, fogFar, length(vPosition.xz));',
		'	gl_FragColor = mix(gl_FragColor, vec4(fogColor, 1.0), fogDepth);',
		'	#endif',
		'}'
	].join('\n')
};

function RefractiveWater(renderer, camera, options) {
	Mirror.call(this, renderer, camera, options);
	
	this.refractionCamera = camera.clone();
	this.refractionMatrix = new THREE.Matrix4();
	this.refractionTexture = new THREE.WebGLRenderTarget(options.textureWidth, options.textureHeight, {
		magFilter: THREE.LinearFilter,
		minFilter: THREE.LinearFilter
	} );
	this.refractionTexture.texture.generateMipmaps = false;
	
	this.texture.texture.generateMipmaps = false;
	this.texture.texture.magFilter = THREE.LinearFilter;
	this.texture.texture.minFilter = THREE.LinearFilter;
	
	var shader = RefractiveWater_Shader;
	this.material = new THREE.ShaderMaterial({
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		uniforms: THREE.UniformsUtils.clone(shader.uniforms),
		lights: true,
		fog: true
	});
	
	this.material.uniforms.textureMatrix.value = this.textureMatrix;
	this.material.uniforms.refractionMatrix.value = this.refractionMatrix;
	this.material.uniforms.skySampler.value = this.texture;
	this.material.uniforms.floorSampler.value = this.refractionTexture;
	this.material.uniforms.normalsSampler.value = options.normals;
	
	console.log(this.material.uniforms);
	
	if (options.fog) {
		this.material.uniforms.fogColor.value = options.fog.color;
		this.material.uniforms.fogNear.value = options.fog.near;
		this.material.uniforms.fogFar.value = options.fog.far;
		this.material.defines = { USE_FOG: '' };
	}
	
	this.renderer = renderer;
}

RefractiveWater.prototype = Object.create(Mirror.prototype);

RefractiveWater.prototype.setTime = function(t) {
	this.material.uniforms.time.value = t;
};

RefractiveWater.prototype.updateTextureMatrix = function () {
	this.updateMatrixWorld();
	this.camera.updateMatrixWorld();
	this.mirrorWorldPosition.setFromMatrixPosition(this.matrixWorld);
	this.cameraWorldPosition.setFromMatrixPosition(this.camera.matrixWorld);

	this.rotationMatrix.extractRotation(this.matrixWorld);
	this.normal.set(0, 0, -1);
	this.normal.applyMatrix4(this.rotationMatrix);

	var _this = this;
	this.updateCamera(this.mirrorCamera, this.textureMatrix, function(v) {
		return v.reflect(_this.normal);
	});
	this.setClipPlane(this.mirrorCamera);
	
	if (this.refractionCamera) {
		this.updateCamera(this.refractionCamera, this.refractionMatrix, function(v) {
			return v.multiplyScalar(1.2);
		});
		this.setClipPlane(this.refractionCamera);
	}
};

RefractiveWater.prototype.render = function () {
	this.updateTextureMatrix();
	
	// Render the mirrored view of the current scene into the target texture
	var scene = this;
	while (scene.parent) {
		scene = scene.parent;
	}

	if (scene && (scene instanceof THREE.Scene)) {
		this.material.visible = false;
		this.renderer.render(scene, this.mirrorCamera, this.texture, true);
		this.renderer.render(scene, this.refractionCamera, this.refractionTexture, true);
		this.material.visible = true;
	}
};

namespace.RefractiveWater = RefractiveWater;

})(THREE);
