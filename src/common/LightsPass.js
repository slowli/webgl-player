(function(namespace) {

var LightsHaloShader = {

	uniforms: {
		tDiffuse: { type: 't', value: null },
		tDepth: { type: 't', value: null },
		haloSampler: { type: 't', value: null },
		lightViewPositions: { type: 'v4v', value: [] },
		lightColors: { type: 'fv', value: [] },
		lightRadii: { type: 'fv1', value: [] },
		aspectRatio: { type: 'f', value: 1.0 }
	},
	
	defines: {
		MAX_LIGHTS: 10
	},
	
	vertexShader: [
		'varying vec2 vUv;',
		
		'void main() {',
		'	vUv = uv;',
		'	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
		'}'
	].join('\n'),
	
	fragmentShader: [
		'varying vec2 vUv;',
		
		'uniform sampler2D tDiffuse;',
		'uniform sampler2D tDepth;',
		'uniform float aspectRatio;',
		'uniform sampler2D haloSampler;',
		
		'uniform vec4 lightViewPositions[MAX_LIGHTS];',
		'uniform vec3 lightColors[MAX_LIGHTS];',
		'uniform float lightRadii[MAX_LIGHTS];',
		'uniform float lightScale[MAX_LIGHTS];',
		
		'void main() {',
		'	gl_FragColor = texture2D(tDiffuse, vUv);',

		'	for (int i = 0; i < MAX_LIGHTS; i++) {',
		'		vec2 lightUv = lightViewPositions[i].xy;',
		'		float lightDepth = lightViewPositions[i].w + lightRadii[i];',
		'		vec2 shift = vec2(1.0, aspectRatio) * 0.025 / lightViewPositions[i].z;',
		
		'		float invSize = lightViewPositions[i].z;',
		'		if (invSize > 1e-2) {',
		'			bool depthTest = false;',
		'			float depth;',
		'			depth = texture2D(tDepth, lightUv + vec2(-1.0, -1.0) * shift).r;',
		'			if (depth <= lightDepth) depthTest = true;',
		'			depth = texture2D(tDepth, lightUv + vec2(-1.0,  1.0) * shift).r;',
		'			if (depth <= lightDepth) depthTest = true;',
		'			depth = texture2D(tDepth, lightUv + vec2( 1.0, -1.0) * shift).r;',
		'			if (depth <= lightDepth) depthTest = true;',
		'			depth = texture2D(tDepth, lightUv + vec2( 1.0,  1.0) * shift).r;',
		'			if (depth <= lightDepth) depthTest = true;',
		
		'			if (depthTest) {',
		'				vec2 haloUv = (vUv - lightUv) * vec2(aspectRatio, 1.0) * invSize;',
		'				haloUv = 0.5 * haloUv + 0.5;',
		'				if ((haloUv.x < 0.0) || (haloUv.x > 1.0) || (haloUv.y < 0.0) || (haloUv.y > 1.0)) continue;',
		'				vec4 pixel = texture2D(haloSampler, haloUv);',
		'				gl_FragColor.rgb += lightColors[i] * pixel.rgb * pixel.a;',
		'			}',
		'		}',
		'	}',
		'}'
	].join('\n')
};

var FloatDepthShader = {

	uniforms: {
		cameraFar: { type: 'f', value: 1000.0 }
	},

	vertexShader: [
		'varying vec4 vViewPosition;',
	
		'void main() {',
		'	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
		'	vViewPosition = gl_Position;',
		'}'
	].join('\n'),
	
	fragmentShader: [
		'varying vec4 vViewPosition;',
		
		'uniform float cameraFar;',
		
		'void main() {',
		'	gl_FragColor = vec4(cameraFar - vViewPosition.z, 0.0, 0.0, 1.0);',
		'}'
	].join('\n')
};

function LightsPass(scene, camera, params) {
	this.scene = scene;
	this.camera = camera;

	// Render targets
	var width = params.width || 1;
	var height = params.height || 1;

	this.renderTargetDepth = new THREE.WebGLRenderTarget(width, height, {
		'type': THREE.FloatType,
		'minFilter': THREE.LinearFilter,
		'magFilter': THREE.LinearFilter,
		'format': THREE.RGBAFormat
	});
	
	var shader = FloatDepthShader;
	this.materialDepth = new THREE.ShaderMaterial({
		'uniforms': THREE.UniformsUtils.clone(shader.uniforms),
		'vertexShader': shader.vertexShader,
		'fragmentShader': shader.fragmentShader
	});
	this.materialDepth.uniforms.cameraFar.value = this.camera.far;

	shader = LightsHaloShader;
	this.glowMaterial = new THREE.ShaderMaterial({
		'uniforms': THREE.UniformsUtils.clone(shader.uniforms),
		'defines': shader.defines,
		'vertexShader': shader.vertexShader,
		'fragmentShader': shader.fragmentShader
	});

	this.uniforms = this.glowMaterial.uniforms;
	this.uniforms.aspectRatio.value = width / height;
	this._aspectRatio = width / height;
	
	this.enabled = true;
	this.needsSwap = true;
	this.renderToScreen = false;
	this.clear = false;

	this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	this.quadScene = new THREE.Scene();
	this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.glowMaterial);
	this.quadScene.add(this.quad);
	
	this._projScreenMatrix = new THREE.Matrix4();
	this._vector3 = new THREE.Vector3();
	this._vector4 = new THREE.Vector4();
	this._direction = new THREE.Vector3();
	this._direction2 = new THREE.Vector3();
	this.lights = [];
	this.lightRadii = [];
	this.haloSize = [];
}

LightsPass.prototype.addLight = function(light, parameters) {
	this.lights.push(light);
	this.lightRadii.push(parameters.lightRadius || 0.0);
	this.haloSize.push(parameters.haloSize || 1.0);
};

LightsPass.prototype.renderDepth = function(renderer) {
	this.scene.overrideMaterial = this.materialDepth;
	renderer.render(this.scene, this.camera, this.renderTargetDepth, true);
	this.scene.overrideMaterial = null;
};

LightsPass.prototype.render = function(renderer, writeBuffer, readBuffer, delta, maskActive) {
	function isVisible(x, y) {
		return (x >= 0.0) && (x <= 1.0) && (y >= 0.0) && (y <= 1.0);
	}
	
	this.renderDepth(renderer);

	// Determine where the lights are
	var camera = this.camera;
	camera.matrixWorldInverse.getInverse(camera.matrixWorld);
	this._projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
	
	this.uniforms.lightViewPositions.value = [];
	this.uniforms.lightColors.value = [];
	this.uniforms.lightRadii.value = [];
	
	var pos = this._vector3, pos4 = this._vector4, lightDir = this._direction, cameraDir = this._direction2;
	for (var i = 0; i < this.lights.length; i++) {
		pos.setFromMatrixPosition(this.lights[i].matrixWorld);
		pos4.x = pos.x;
		pos4.y = pos.y; 
		pos4.z = pos.z;
		pos4.w = 1.0;
		pos4.applyMatrix4(this._projScreenMatrix);
		
		var lightViewPos = new THREE.Vector4(
			pos4.x / pos4.w * 0.5 + 0.5, // x view coordinate in [0, 1]
			pos4.y / pos4.w * 0.5 + 0.5, // y view coordinate in [0, 1]
			pos4.z / this.haloSize[i], // scaled depth (determines the size of halo)
			this.camera.far - pos4.z); // depth used to determine if the light is visible
		this.uniforms.lightViewPositions.value.push(lightViewPos);
		this.uniforms.lightRadii.value.push(this.lightRadii[i]);

		var color = this.lights[i].color.clone();
		color.multiplyScalar(this.lights[i].intensity);

		// Size of the light in uv coordinates
		var lightSizeX = 0.05 / lightViewPos.z, lightSizeY = lightSizeX * this._aspectRatio;
		
		if (
			!isVisible(lightViewPos.x - lightSizeX, lightViewPos.y - lightSizeY) &&
			!isVisible(lightViewPos.x - lightSizeX, lightViewPos.y + lightSizeY) &&
			!isVisible(lightViewPos.x + lightSizeX, lightViewPos.y - lightSizeY) &&
			!isVisible(lightViewPos.x + lightSizeX, lightViewPos.y + lightSizeY)
		) {
			// The light is out of view
			color.setHex(0);
		} else {
			cameraDir.copy(pos);
			cameraDir.sub(this.camera.position);

			if (this.lights[i].distance > 0.0) {
				var intencity = 1.0 - Math.min(cameraDir.length() / this.lights[i].distance, 1.0);
				color.multiplyScalar(intencity);
			}

			cameraDir.normalize();
		
			if (this.lights[i] instanceof THREE.SpotLight) {
				lightDir.copy(pos);
				pos.setFromMatrixPosition(this.lights[i].target.matrixWorld);
				lightDir.sub(pos);
				lightDir.normalize();
			
				var theta = Math.max(lightDir.dot(cameraDir), 0.0);
				if (theta < Math.cos(this.lights[i].angle)) theta = 0.0;
				theta = Math.pow(theta, this.lights[i].exponent);
				color.multiplyScalar(theta);
			}
		}
		this.uniforms.lightColors.value.push(color.r, color.g, color.b);
	}
	
	// Render composite
	this.uniforms.tDiffuse.value = readBuffer;
	this.uniforms.tDepth.value = this.renderTargetDepth;

	if (this.renderToScreen) {
		renderer.render(this.quadScene, this.quadCamera);
	} else {
		renderer.render(this.quadScene, this.quadCamera, writeBuffer, this.clear);
	}
};

namespace.LightsPass = LightsPass;

})(THREE);
