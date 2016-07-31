/**
 * Generic source of particles.
 * @author Alex Ostrovski
 */

(function(namespace) {
	
// Imports
var MathUtils = namespace.MathUtils;

function ParticleSource() { }

var ParticleSource_RTTShader = {

	uniforms: {
		positionSampler: { type: 't', value: null },
		pixelSize: { type: 'f', value: 1.0 / 256 },
		
		sourcePositions: { type: 'v3v', value: [] },
		sourceVelocities: { type: 'v3v', value: [] },
		attractorPositions: { type: 'v3v', value: [] },
		attractorMasses: { type: 'fv1', value: [] },
		attractorRadii: { type: 'fv1', value: [] },
		
		delta: { type: 'f', value: 1.0 / 60 },
		time: { type: 'f', value: 0.0 },
		fadeTime: { type: 'f', value: 10.0 },
		nParticles: { type: 'f', value: 0.0 },
		
		// Medium resistance
		resistanceFactor: { type: 'f', value: 0.25 }
	},
	
	vertexShader: [
		'varying vec2 vUv;',
		
		'void main() {',
		'	vUv = uv;',
		'	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
		'}'
	].join('\n'),
	
	defines: {
		MAX_SOURCES: 5,
		MAX_ATTRACTORS: 5
	},
	
	fragmentShader: [
		'varying vec2 vUv;',
		
		'#if MAX_SOURCES > 0',
		'uniform vec3 sourcePositions[MAX_SOURCES];',
		'uniform vec3 sourceVelocities[MAX_SOURCES];',
		'#endif',
		
		'#if MAX_ATTRACTORS > 0',
		'uniform vec3 attractorPositions[MAX_ATTRACTORS];',
		'uniform float attractorMasses[MAX_ATTRACTORS];',
		'uniform float attractorRadii[MAX_ATTRACTORS];',
		'#endif',
		
		'uniform sampler2D positionSampler;',
		'uniform float pixelSize;',
		
		'uniform float delta;',
		'uniform float time;',
		'uniform float resistanceFactor;',
		'uniform float fadeTime;',
		'uniform float nParticles;',
		
		'float getNoise(vec2 uv, float time) {',
		'	float val = (uv.x + 0.01) * (uv.y + 0.01) * (time + 1.0) * 1000.0;',
		'	val = mod(val, 13.0) * mod(val, 123.0);',
		'	return 100.0 * mod(val, 0.01);',
		'}',
		
		'vec3 getNoiseV(vec2 uv, float time) {',
		'	return 2.0 * vec3(getNoise(uv, time + 17.0), getNoise(uv, time + 31.0), getNoise(uv, time + 61.0)) - 1.0;',
		'}',
		
		'float uvToIndex(vec2 uv) {',
		'	return 0.5 / pixelSize * ( floor(uv.y / pixelSize) + uv.x );',
		'}',
		
		'void main() {',
		'	float positionInStruct = mod(vUv.x / pixelSize, 2.0);',
		'	vec2 baseUv = vUv - positionInStruct * vec2(pixelSize, 0.0);',
		'	float particleIdx = uvToIndex(baseUv);',
		'	if (particleIdx > nParticles) return;',
		
		'	vec4 direction, len;',
		'	vec3 position, velocity, acceleration;',
		'	position = texture2D(positionSampler, baseUv).xyz;',
		'	float sourceIdx = texture2D(positionSampler, baseUv).w;',
		'	velocity = texture2D(positionSampler, baseUv + vec2(pixelSize, 0.0)).xyz;',
		'	float particleTime = texture2D(positionSampler, baseUv + vec2(pixelSize, 0.0)).w;',
		
		'	acceleration = vec3(0.0);',
		
		'	particleTime -= delta;',
		'	if (particleTime < 0.0) {',
		'		particleTime = fadeTime;',
		'		#if MAX_SOURCES > 0',
		'		for (int i = 0; i < MAX_SOURCES; i++) {',
		'			if (abs(float(i) - sourceIdx) < 0.1) {',
		'				position = sourcePositions[i] + getNoiseV(baseUv, time + 31.0);',
		'				velocity = sourceVelocities[i];',
		'			}',
		'		}',
		'		#endif',
		'	}',
		
		'#if MAX_SOURCES > 0',
		'	for (int i = 0; i < MAX_SOURCES; i++) {',
		'		vec3 r = sourcePositions[i] - position;',
		'		float dist = max(length(r), 0.1);',
		'		r = normalize(r);',
		'		if (abs(float(i) - sourceIdx) < 0.1) {',
		'			// Rotate around the center',
		'			acceleration += 1.0 * cross(r, sourceVelocities[i]) * pow(dist, -2.0);',
		'		} else {',
		'			// Repel from other particle sources',
		'			acceleration -= r * 10.0 * pow(dist, -1.0);',
		'		}',
		'	}',
		'#endif',
		
		'#if MAX_ATTRACTORS > 0',
		'	for (int i = 0; i < MAX_ATTRACTORS; i++) {',
		'		vec3 r = attractorPositions[i] - position;',
		'		float dist = max(length(r), 0.1);',
		'		r = normalize(r);',
		'		if (dist < attractorRadii[i]) {',
		'			// Orbit the particle around the attractor',
		'			position = attractorPositions[i] - r * attractorRadii[i];',
		'			velocity -= r * dot(normalize(velocity), r);',
		'		}',
		'		acceleration += r * attractorMasses[i] * pow(dist, -2.0);',
		'	}',
		'#endif',
		
		'	acceleration += 5.0 * getNoiseV(baseUv, time);',
		'	acceleration -= resistanceFactor * velocity;',
		'	velocity += acceleration * delta;',
		'	position += velocity * delta;',
		
		'	if (positionInStruct < 1.0) {',
		'		gl_FragColor = vec4(position, sourceIdx);',
		'	} else {',
		'		gl_FragColor = vec4(velocity, particleTime);',
		'	}',
		'}'
	].join('\n')
};

var ParticleSource_count = 0;

ParticleSource.setup = function(parameters) {
	this._moveDuration = 0.001;
	this._moveStart = -1.0;
	this._curve = null;
	
	this.nParticles = parameters.particleCount || 1000;
	this.fadeTime = parameters.fadeTime || 10.0;
	this.color = parameters.color || new THREE.Color(0xffffff);
	this._sourceIndex = ParticleSource_count++;
	
	this.pathHelper = new THREE.Line(
		new THREE.Geometry(),
		new THREE.LineDashedMaterial( { color: 0xffff00 } )
	);
	this.pathHelper.visible = false;
	
	this.moveOptions = parameters.moveOptions || MathUtils.BezierCurve.randomOptions();
	
	this.encode = ParticleSource.prototype.encode;
	this._newPath = ParticleSource.prototype._newPath;
	this.setTime = ParticleSource.prototype.setTime;
};

ParticleSource.getVertices = function(count) {
	var vertices = [];
	for (var i = 0; i < count; i++) {
		var rowCount = 256 / 2,
			row = Math.floor(i / rowCount),
			col = i - rowCount * row;
		vertices.push(new THREE.Vector3(col * 2, row, 0.0));
	}
	return vertices;
};

ParticleSource.setUniforms = function(material, sources, attractors) {
	var uniforms = material.uniforms, i;
	material.defines.MAX_SOURCES = sources.length;

	uniforms.sourcePositions.value = [];
	uniforms.sourceVelocities.value = [];
	if (uniforms.sourceColors) {
		uniforms.sourceColors.value = [];
	}
	
	for (i = 0; i < sources.length; i++) {
		var s = sources[i];
		uniforms.sourcePositions.value.push(s.position);
		uniforms.sourceVelocities.value.push(s.velocity);
		
		if (uniforms.sourceColors) {
			uniforms.sourceColors.value.push(s.color.r, s.color.g, s.color.b);
		}
	}
	
	if (attractors) {
		material.defines.MAX_ATTRACTORS = attractors.length;

		uniforms.attractorPositions.value = [];
		uniforms.attractorMasses.value = [];
		uniforms.attractorRadii.value = [];
		
		for (i = 0; i < attractors.length; i++) {
			var a = attractors[i];
			uniforms.attractorPositions.value.push(a.position);
			uniforms.attractorMasses.value.push(a.mass);
			uniforms.attractorRadii.value.push(a.radius);
		}
	}
};

ParticleSource.prototype.encode = function(buffer, offset) {
	var tokenOffset = offset * 8;
	
	for (var i = 0; i < this.nParticles; i++) {
		// coordinates
		buffer[tokenOffset + 0] = 1000.0;
		buffer[tokenOffset + 1] = 1000.0;
		buffer[tokenOffset + 2] = 1000.0;
		
		// index of the emitting source
		buffer[tokenOffset + 3] = this._sourceIndex;
		
		// velocity
		buffer[tokenOffset + 4] = 0.0;
		buffer[tokenOffset + 5] = 0.0;
		buffer[tokenOffset + 6] = 0.0;
		
		// time to the fade-out
		buffer[tokenOffset + 7] = Math.random() * this.fadeTime;
		
		tokenOffset += 8;
	}
};

ParticleSource.prototype._newPath = function() {
	this._curve = MathUtils.BezierCurve.random(this.position, this.moveOptions, this._curve);
	var travelTime = this.moveOptions.travelTime;
	this._moveDuration = travelTime.min + Math.random() * (travelTime.max - travelTime.min);
	
	var vx = this.pathHelper.geometry.vertices;
	vx.length = 0;
	for (var t = 0; t < 1; t += 0.01) {
		vx.push(this._curve.position(t));
	}
	
	this.pathHelper.geometry.computeLineDistances();
	this.pathHelper.geometry.verticesNeedUpdate = true;
};

ParticleSource.prototype.setTime = function(time) {
	var t = (time - this._moveStart) / this._moveDuration;
	if (t > 1.0) {
		this._newPath();
		this._moveStart = time;
		t = 0.0;
	}

	this.position.copy(this._curve.position(t));
	var tangent = this._curve.tangent(t).normalize();
	this.velocity = tangent;
};

ParticleSource.initRTT = function(sources, attractors) {
	var dataTextureSize = 256,
		data = new Float32Array(4 * dataTextureSize * dataTextureSize);
		
	var nParticles = 0;
	for (var i = 0; i < sources.length; i++) {
		sources[i].encode(data, nParticles);
		nParticles += sources[i].nParticles;
	}
	
	var dataTexture = new THREE.DataTexture(data, dataTextureSize, dataTextureSize, 
		THREE.RGBAFormat, THREE.FloatType);
	dataTexture.needsUpdate = true;
	dataTexture.minFilter = dataTexture.magFilter = THREE.NearestFilter;
	dataTexture.generateMipmaps = false;
	dataTexture.flipY = false;
	
	// Initialize rendering targets
	
	var targetOptions = {
		type: THREE.FloatType,
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		generateMipmaps: false
	};
	var dataTarget = new THREE.WebGLRenderTarget(dataTextureSize, dataTextureSize, targetOptions);
	var dataTarget1 = new THREE.WebGLRenderTarget(dataTextureSize, dataTextureSize, targetOptions);
	
	var frame = 0; // frame counter to determine read and write targets
	
	// Initialize the RTT scene
	var rttScene = new THREE.Scene();
	var rttCamera = new THREE.OrthographicCamera(-1, 1, -1, 1, 0.1, 100);
	rttCamera.position.set(0, 1, 0);
	rttCamera.up.set(0, 0, -10);
	rttCamera.lookAt(new THREE.Vector3(0, -1, 0));
	rttCamera.updateProjectionMatrix();
	
	var shader = ParticleSource_RTTShader;
	var material = new THREE.ShaderMaterial({
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
		uniforms: THREE.UniformsUtils.clone(shader.uniforms),
		defines: shader.defines
	});
	material.uniforms.positionSampler.value = dataTexture;
	material.uniforms.resistanceFactor.value = 0.1; // XXX make a parameter
	material.uniforms.nParticles.value = nParticles;
	
	var rttQuad = new THREE.Mesh(
		new THREE.PlaneGeometry(2, 2),
		material
	);
	rttQuad.position.set(0, -1, 0);
	rttQuad.rotateX(Math.PI / 2);
	rttScene.add(rttQuad);
	
	var time = 0.0;
	
	return function(renderer, delta) {
		frame++;
		time += delta;
		
		ParticleSource.setUniforms(rttQuad.material, sources, attractors);
		rttQuad.material.uniforms.time.value = time;
		rttQuad.material.uniforms.delta.value = delta;
		var target = (frame % 2 === 0) ? dataTarget1 : dataTarget;
		renderer.render(rttScene, rttCamera, target, true);
		rttQuad.material.uniforms.positionSampler.value = target;
		return target;
	};
};

var ParticleSource_RenderShader = {

	uniforms: {
		sourcePositions: { type: 'v3v', value: [] },
		sourceVelocities: { type: 'v3v', value: [] },
		sourceColors: { type: 'fv', value: [] },
	
		positionSampler: { type: 't', value: null },
		spriteSampler: { type: 't', value: null },
		pixelSize: { type: 'f', value: 1.0 / 256 },
		
		particleSize: { type: 'f', value: 20.0 },
		fadeTime: { type: 'f', value: 10.0 }
	},
	
	defines: {
		MAX_SOURCES: 5
	},
	
	vertexShader: [
		'uniform sampler2D positionSampler;',
		'uniform float pixelSize;',
		
		'uniform float particleSize;',
		
		'varying vec4 pointColor;',
		
		'#if MAX_SOURCES > 0',
		'uniform vec3 sourcePositions[MAX_SOURCES];',
		'uniform vec3 sourceColors[MAX_SOURCES];',
		'#endif',
		
		'uniform float fadeTime;',
		
		'void main() {',
		'	vec2 uvPosition = position.xy * pixelSize;',
		'	vec4 particlePos = texture2D(positionSampler, uvPosition);',
		'	float sourceIdx = particlePos.w;',
		'	particlePos.w = 1.0;',
		'	vec4 particleV = texture2D(positionSampler, uvPosition + vec2(pixelSize, 0.0));',
		'	float particleTime = particleV.w;',
		
		'	pointColor = vec4(1.0, 1.0, 1.0, 0.5);',
		'	vec4 lighting = vec4(0.2, 0.2, 0.2, 0.0);',
		'#if MAX_SOURCES > 0',
		'	for (int i = 0; i < MAX_SOURCES; i++) {',
		'		if (abs(float(i) - sourceIdx) < 0.1) {',
		'			lighting += vec4(sourceColors[i], 1.0);',
		'		} else {',
		'			lighting += vec4(sourceColors[i], 1.0) * max(1.0 - distance(sourcePositions[i], particlePos.xyz) / 20.0, 0.0);',
		'		}',
		'	}',
		'#endif',
		'	pointColor *= lighting * (particleTime / fadeTime);',
		'	pointColor.a = min(pointColor.a, 1.0);',
		
		'	particlePos = modelViewMatrix * particlePos;',
		'	gl_PointSize = particleSize * 20.0 / length(particlePos.xyz);',
		'	gl_Position = projectionMatrix * particlePos;',
		'}'
	].join('\n'),
	
	fragmentShader: [
		'uniform sampler2D spriteSampler;',
		
		'varying vec4 pointColor;',
		'varying float spriteMix;',
	
		'void main() {',
		'	gl_FragColor = texture2D(spriteSampler, gl_PointCoord) * pointColor;',
		'}'
	].join('\n')
};

ParticleSource.createMaterial = function() {
	var shader = ParticleSource_RenderShader;

	return new THREE.ShaderMaterial({ 
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader,
		uniforms: THREE.UniformsUtils.clone(shader.uniforms),
		defines: shader.defines,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
};

namespace.ParticleSource = ParticleSource;

})(THREE);
