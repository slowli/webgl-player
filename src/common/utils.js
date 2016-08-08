/**
 * Common math utilities and shader chunks for use with THREE.js.
 * @author Alex Ostrovski
 */

(function(namespace) {

function MathUtils() {}

/**
 * Returns a random point in the specified box.
 * 
 * @param {THREE.Vector3} min
 *    minimal coordinate values
 * @param max
 *    maximal coordinate values
 * @returns {THREE.Vector3}
 *    random point
 */
MathUtils.randomPt = function(min, max) {
	min = min || new THREE.Vector3(-1, -1, -1);
	max = max || new THREE.Vector3(1, 1, 1);

	var v = new THREE.Vector3(Math.random(), Math.random(), Math.random());
	var diff = new THREE.Vector3();
	diff.subVectors(max, min);
	v.multiply(diff).add(min);
	return v;
};

/**
 * Smoothstep function.
 * 
 * @param {Number} t
 *    parameter; it is assumed that 0 <= t <= 1
 * @returns {Number}
 *    value of the function
 */
MathUtils.smooth = function(t) {
	return t * t * (3 - 2 * t);
};

/**
 * Returns noise with standard normal distribution (mean zero and st.dev. 1).
 * 
 * @returns {Number}
 */
MathUtils.normalNoise = function() {
	var x = 0.0;
	for (var i = 0; i < 6; i++) {
		x += (Math.random() * 2.0 - 1.0) * Math.SQRT1_2;
	}
	return x;
};

/**
 * Creates float-valued textures with all channels filled with normal noise.
 * 
 * @param {Number} size
 *    texture size (should be the power of 2)
 * @returns {THREE.DataTexture}
 *    created texture
 */
MathUtils.createNormalNoiseTexture = function(size) {
	var data = new Float32Array(4 * size * size);
	for (var i = 0; i < data.length; i++) {
		data[i] = MathUtils.normalNoise();
	}

	var dataTexture = new THREE.DataTexture(data, size, size, 
		THREE.RGBAFormat, THREE.FloatType);
	dataTexture.needsUpdate = true;
	dataTexture.minFilter = dataTexture.magFilter = THREE.NearestFilter;
	dataTexture.generateMipmaps = false;
	dataTexture.flipY = false;
	dataTexture.wrapS = dataTexture.wrapT = THREE.RepeatWrapping;

	return dataTexture;
};

/**
 * Determines (a little hack-ishly) whether an object intersects any of reference objects.
 *
 * @param {THREE.Object3D[]} references
 *    array of objects
 * @param {THREE.Object3D} object
 * @returns {Boolean}
 *    true if object intersects any of references
 */
MathUtils.intersects = (function() {
	var vertices = [
		new THREE.Vector3(1, 1, 1), new THREE.Vector3(-1, 1, 1),
		new THREE.Vector3(1, -1, 1), new THREE.Vector3(1, 1, -1),
		new THREE.Vector3(-1, -1, 1), new THREE.Vector3(-1, 1, -1),
		new THREE.Vector3(1, -1, -1), new THREE.Vector3(-1, -1, -1),
		
		new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
		new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
		new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
		
		new THREE.Vector3(0, 0, 0)
	];
	var invMatrixWorld = new THREE.Matrix4();
	
	return function(references, object) {
		var i;
		for (i = 0; i < vertices.length; i++) {
			vertices[i].applyMatrix4(object.matrixWorld);
		}
		
		for (i = 0; i < references.length; i++) {
			invMatrixWorld.getInverse(references[i].matrixWorld);
			for (var j = 0; j < vertices.length; j++) {
				var v = vertices[j].clone().applyMatrix4(invMatrixWorld);
				if (v.length() < 1.0) {
					return true;
				}
			}
		}
		return false;
	};
})();

/**
 * Bezier curve with arbitrary number of points.
 * 
 * @constructor
 * @param {THREE.Vector3[]} points
 *    array of points in 3-dimensional space
 */
MathUtils.BezierCurve = function(points) {
	this.points = points;
	this.diffs = [];
	
	var i;
	for (i = 1; i < points.length; i++) {
		this.diffs.push(points[i].clone().sub(points[i - 1]));
	}
	
	this._beta = [];
	for (i = 0; i < 2 * points.length; i++) {
		this._beta[i] = new THREE.Vector3();
	}
};

MathUtils.BezierCurve._calc = function(points, t, beta) {
	var n = points.length, i, j;
	for (i = 0; i < n; i++) {
		beta[i].copy(points[i]);
	}
	for (j = 1; j < n; j++) {
		for (i = 0; i <= n - j; i++) {
			beta[i + n].copy(beta[i]);
		}
	
		for (i = n - j - 1; i >= 0; i--) {
			beta[i].lerp(beta[i + n + 1], t);
		}
	}
	return beta[0].clone();
};

/**
 * @returns {Object}
 *    default options for generating random Bezier curves
 */
MathUtils.BezierCurve.randomOptions = function() {
	return {
		'boundingBox': new THREE.Box3( 
			new THREE.Vector3(-35,-35, -35), 
			new THREE.Vector3(35, 35, 35)
		),
		'travelTime': { 'min': 15.0, 'max': 25.0 },
		'travelDistance': { 'min': 15.0, 'max': 75.0 },
		'minAngleCos': 0.0,
		'nControls': 5
	};
};

/**
 * Creates a new Bezier curve with the given options.
 * 
 * @param {THREE.Vector3} start
 *    starting point of the curve
 * @param {Object} options
 *    curve options (e.g., bounding box and travel distance)
 * @param {MathUtils.BezierCurve} prevCurve
 *    previous curve (optional)
 */
MathUtils.BezierCurve.random = function(start, options, prevCurve) {
	var controls = [ new THREE.Vector3() ], n;
	controls[0].copy(start);
	
	if (prevCurve) {
		n = prevCurve.points.length;
		var direction = prevCurve.points[n - 1].sub(prevCurve.points[n - 2]);
		controls.push(start.clone().add(direction));
	}
	
	while (controls.length < options.nControls) {
		var dist = 0.0, pt = null,
			lastDir = null, angleCos, iterCount = 0;
		n = controls.length;
		if (n > 1) {
			lastDir = controls[n - 1].clone().sub(controls[n - 2]).normalize();
		}
		
		do {
			pt = MathUtils.randomPt(options.boundingBox.min, options.boundingBox.max);
			dist = pt.distanceTo(controls[n - 1]);
			angleCos = lastDir ? pt.clone().sub(controls[n - 1]).normalize().dot(lastDir) : 1.0;
			iterCount++;
		} while ((dist > options.travelDistance.max) || (dist < options.travelDistance.min) || (angleCos < options.minAngleCos - 0.02 * iterCount));
		
		if (n == options.nControls - 1) {
			pt.lerp(controls[n - 1], 0.5);
		}
		controls.push(pt);
	}
	
	return new MathUtils.BezierCurve(controls);
};

/**
 * Calculates a position along the curve.
 * 
 * @param {Number} t
 *    curve parameter; 0 <= t <= 1
 * @returns {THREE.Vector3}
 *    the point on curve corresponding to the specified value of the parameter
 */
MathUtils.BezierCurve.prototype.position = function(t) {
	var beta = this._beta;
	while (beta.length < this.points.length) {
		beta.push(new THREE.Vector3());
	}
	return MathUtils.BezierCurve._calc(this.points, t, this._beta);
};

/**
 * Calculates a tangent along the curve.
 * 
 * @param {Number} t
 *    curve parameter; 0 <= t <= 1
 * @returns {THREE.Vector3}
 *    value of the tangent at the point on the curve corresponding to the specified value of the parameter
 */
MathUtils.BezierCurve.prototype.tangent = function(t) {
	return MathUtils.BezierCurve._calc(this.diffs, t, this._beta)
		.multiplyScalar(this.points.length - 1);
};

/**
 * Refracts a beam. Should act identical to the corresponding OpenGL ES primitive. 
 * 
 * @param {THREE.Vector3} incident
 * @param {THREE.Vector3} normal
 * @param {Number} eta
 * @returns {THREE.Vector3}
 */
MathUtils.refract = function(incident, normal, eta) {
	var product = incident.dot(normal), 
		k = 1.0 - eta * eta * (1.0 - product * product);
	
	if (k < 0.0) {
		return new THREE.Vector3();
	} else {
		return incident.clone().multiplyScalar(eta)
			.sub(normal.clone().multiplyScalar(eta * product + Math.sqrt(k)));
	}
};

/**
 * Merges several object geometries into one.
 * 
 * @param {THREE.Geometry[]}
 *    list of geometry objects
 * @returns {THREE.Geometry}
 *    composed geometry
 */
THREE.GeometryUtils.mergeObjectGeometries = (function() {
	var normalMatrix = new THREE.Matrix3();
	
	return function(objects) {
		var composedGeometry = new THREE.Geometry();
		
		for (var i = 0; i < objects.length; i++) {
			var object = objects[i];
			object.updateMatrixWorld();
			normalMatrix.getNormalMatrix(object.matrixWorld);
			
			var objGeometry = object.geometry.clone();
			for (var vx = 0; vx < objGeometry.vertices.length; vx++) {
				objGeometry.vertices[vx].applyMatrix4(object.matrixWorld);
			}
			for (var f = 0; f < objGeometry.faces.length; f++) {
				var face = objGeometry.faces[f];
				face.normal.applyMatrix3(normalMatrix);
				face.vertexNormals[0].applyMatrix3(normalMatrix);
				face.vertexNormals[1].applyMatrix3(normalMatrix);
				face.vertexNormals[2].applyMatrix3(normalMatrix);
			}
			composedGeometry.merge(objGeometry);
			objGeometry.dispose();
		}
		
		return composedGeometry;
	};
})();

/** Simple loader for sprites. */

/* FIXME remove
function SpriteLoader() {
}

SpriteLoader.prototype.load = function(url, callback) {
	setTimeout(function() {
		callback(new THREE.Sprite());
	}, 50);
};*/

/* Common shader parts. */

THREE.ShaderChunk.noise = [
	
	'vec4 getNoise( sampler2D sampler, vec2 uv, float time ) {',
	'	vec2 uv0 = (uv / 103.0) + vec2(time / 17.0, time / 29.0);',
	'	vec2 uv1 = uv / 107.0 - vec2( time / -19.0, time / 31.0 );',
	'	vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );',
	'	vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );',
	'	vec4 noise = texture2D(sampler, uv0)',
	'		+ texture2D(sampler, uv1)',
	'		+ texture2D(sampler, uv2)',
	'		+ texture2D(sampler, uv3);',
	'	return noise * 0.25;',
	'}'
].join('\n');

THREE.ShaderChunk.recursive_noise_3d = [
	'mat3 rotationAxis(vec3 axis, float angle) {',
	'	float c = cos(angle), s = sin(angle), t = 1.0 - c;',
	'	float tx = t * axis.x, ty = t * axis.y;',

	'	return mat3(',
	'		tx * axis.x + c, tx * axis.y - s * axis.z, tx * axis.z + s * axis.y,',
	'		tx * axis.y + s * axis.z, ty * axis.y + c, ty * axis.z - s * axis.x,',
	'		tx * axis.z - s * axis.y, ty * axis.z + s * axis.x, t * axis.z * axis.z + c',
	'	);',
	'}',

	'vec4 getRecursiveNoise(samplerCube noiseSampler, vec3 direction, float time) {',
	'	vec4 noise = textureCube(noiseSampler, normalize(direction));',
	'	mat3 rotation = rotationAxis(vec3(1.0, 0.0, 0.0), 0.1 * time);',
	'	vec3 noiseUv = normalize(direction) + rotation * (2.0 * noise.xyz - 1.0);',
	'	noise = textureCube(noiseSampler, noiseUv);',
	'	rotation = rotationAxis(vec3(0.0, 1.0, 0.0), 0.19 * time);',
	'	noiseUv += rotation * (2.0 * noise.xyz - 1.0);',
	'	return textureCube(noiseSampler, noiseUv);',
	'}'
].join('\n');

THREE.ShaderChunk.recursive_noise_2d = [
	'vec4 getRecursiveNoise(sampler2D sampler, vec2 uv, float time) {',
	'	vec4 noise = texture2D(sampler, uv);',
	'	vec2 noiseUv = uv + vec2(1.0, -1.0) * time * 0.01 + noise.xy;',
	'	noise = texture2D(sampler, noiseUv);',
	'	noiseUv = noiseUv + vec2(-0.7, 0.3) * time * 0.002 + vec2(sin(3.1416 * uv.y), cos(2.0 * 3.1416 * uv.x)) * noise.xy;',
	'	return texture2D(sampler, noiseUv);',
	'}'
].join('\n');

namespace.MathUtils = MathUtils;

})(THREE);
