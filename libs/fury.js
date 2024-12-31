(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const Maths = require('./maths');
const Prefab = require('./prefab');
const Renderer = require('./renderer');
const Shaders = require('./shaders');
const Primitives = require('./primitives');

module.exports = (function(){
	let exports = {};

	let getAtlasIndex = (atlas, name) => {
		let map = atlas.map;
		for (let i = 0, l = map.length; i < l; i++) {
			if (map[i] == name) {
				return i;
			}
		}
		return 0;
	};

	let getPrefabName = (atlas, atlasIndex, color, alpha, centered) => {
		let name = atlas.id + "_" + atlasIndex;
		if (alpha !== undefined && alpha != atlas.materialConfig.properties.alpha) {
			name += "_" + (alpha ? "a1" : "a0");
		}

		if (color !== undefined && (color[0] != 1 || color[1] != 1 || color[2] != 1 || color[3] != 1)) {
			name += "_" + color[0] + "_" + color[1] + "_" + color[2] + "_" + color[3];
		}

		if (centered) {
			name += "_c";
		}

		return name;
	}

	let setOffset = (out, atlasIndex, width, height) => {
		out[0] = (atlasIndex % width) / width;
		out[1] = 1 - (Math.floor(atlasIndex / width) + 1) / height;
	};

	let setMaterialConfigOffset = (config, atlasIndex, width, height) => {
		config.properties.offset = [0,0]; // Create new offset array per prefab
		setOffset(config.properties.offset, atlasIndex, width, height);
	};

	exports.setMaterialOffset = (material, atlas, tile) => {
		let atlasIndex = getAtlasIndex(atlas, tile);
		if (!material.offset) { material.offset = [0,0]; }
		setOffset(material.offset, atlasIndex, atlas.width, atlas.height);
	};

	exports.setMaterialFrame = (material, atlas, frameIndex) => {
		if (!material.offset) { material.offset = [0,0]; }
		setOffset(material.offset, frameIndex, atlas.width, atlas.height);
	};

	exports.createTilePrefab = (config) => {
		let { atlas, tile, color, alpha, centered } = config;
		let { width, height } = atlas;
		let atlasIndex = getAtlasIndex(atlas, tile);
		let prefabName = getPrefabName(atlas, atlasIndex, color, alpha, centered);

		if (Prefab.prefabs[prefabName] === undefined) {
			let meshConfig = centered ? atlas.centerdMeshConfig : atlas.meshConfig;

			let materialConfig = Object.create(atlas.materialConfig);
			// Each prefab needs it's own properties object so that properties can be manipulated indepedently
			materialConfig.properties = Object.assign({}, atlas.materialConfig.properties);
			// Each prefab needs it's own offset for the same reason (however we leave scale as we don't expect that to vary)
			materialConfig.properties.offset = [ 0, 0 ];

			if (alpha !== undefined) {
				materialConfig.properties.alpha = alpha;
			}
			if (color !== undefined) {
				materialConfig.properties.color = color;
			} else {
				// This shouldn't be necessary, however it is
				materialConfig.properties.color = [ 1,1,1,1 ];
			}
			setOffset(materialConfig.properties.offset, atlasIndex, width, height);

			Prefab.create({
				name: prefabName, 
				meshConfig: meshConfig,
				materialConfig: materialConfig
			});
		}
		return prefabName;
	};

	exports.create = (config, image) => {
		if (!config.id || !config.map || !config.width || !config.height || !config.tileWidth || !config.tileHeight) {
			console.error("Invalid atlas definition provided, must contain properties: id, map, width, height, tileWidth and tileHeight");
		}
		let atlas = Object.create(config);
		atlas.alpha = atlas.alpha === undefined ? true : !!atlas.alpha;
		atlas.texture = Renderer.createTexture(image, false, true);
		atlas.materialConfig = {
			shader: Shaders.Sprite,
			texture: atlas.texture,
			properties: {
				alpha: atlas.alpha,
				offset: [ 0, 0 ],
				scale: [ 1 / atlas.width, 1 / atlas.height ]
			}
		};
		atlas.meshConfig = Primitives.createQuadMeshConfig(atlas.tileWidth, atlas.tileHeight);
		atlas.centerdMeshConfig = Primitives.createCenteredQuadMeshConfig(atlas.tileWidth, atlas.tileHeight);
		return atlas;
	};

	exports.load = (config, callback) => {
		let image = new Image();
		image.onload = () => {
			callback(exports.create(config, image));
		};
		image.src = config.path;
	};

	return exports;
})();
},{"./maths":11,"./prefab":26,"./primitives":27,"./renderer":29,"./shaders":32}],2:[function(require,module,exports){
const vec3 = require('./maths').vec3;

module.exports = (function() {
	let exports = {};
	let prototype = {
		recalculateMinMax: function() {
			vec3.subtract(this.min, this.center, this.extents);
			vec3.add(this.max, this.center, this.extents);
		},
		recalculateExtents: function() {
			vec3.subtract(this.size, this.max, this.min);
			// If we had a vec3.zero vector could use scale and add
			this.extents[0] = 0.5 * this.size[0];
			this.extents[1] = 0.5 * this.size[1];
			this.extents[2] = 0.5 * this.size[2];
			vec3.add(this.center, this.min, this.extents);
		}
	};

	exports.contains = function(point, box) {
		return point[0] >= box.min[0] && point[0] <= box.max[0]
			&& point[1] >= box.min[1] && point[1] <= box.max[1]
			&& point[2] >= box.min[2] && point[2] <= box.max[2];
	};

	// TODO: Adds Touches methods which use <= and >=
	// Note - ray casts should probably return true for touches

	exports.intersect = function(a, b) {
		return (a.min[0] < b.max[0] && a.max[0] > b.min[0])
			&& (a.min[1] < b.max[1] && a.max[1] > b.min[1])
			&& (a.min[2] < b.max[2] && a.max[2] > b.min[2]);
	};

	// Return true if box b and box a overlap on provided axis 
	exports.intersectsAxis = function(a, b, axis) {
		return a.min[axis] < b.max[axis] && a.max[axis] > b.min[axis];
	};

	// Returns true if box b offset by provided displacement would intersect box a on provided axis 
	exports.intersectsAxisOffset = function(a, b, axis, displacement) {
		return a.min[axis] < b.max[axis] + displacement && a.max[axis] > b.min[axis] + displacement;
	};

	// Enters functions return true if box b did not intersect box a on specified axis
	// before displacement but would afterwards. Calculating the point of entry could be useful.
	// If it's always needed we could return the distance and use > 0 check for does enter
	exports.entersAxis = function(a, b, axis, displacement) {
		return !(a.min[axis] < b.max[axis] && a.max[axis] > b.min[axis])
			&& (a.min[axis] < b.max[axis] + displacement && a.max[axis] > b.min[axis] + displacement);
	};

	// Entered is the same as enters but it assumes you've already moved the box
	exports.enteredAxis = function(a, b, axis, displacement) {
		return !(a.min[axis] < b.max[axis] - displacement && a.max[axis] > b.min[axis] - displacement)
			&& (a.min[axis] < b.max[axis] && a.max[axis] > b.min[axis]);
	};

	exports.rayCast = function(out, origin, direction, box) {
		// Using 0 to imply no intersection so we can return distance (if normalized)
		// Wouldn't work if we included origin touching as impact

		// Check we aren't in the box - note also includes touching
		if (exports.contains(origin, box)) {
			return 0;
		}

		// AABB: is box center in at least one direction from origin?
		for (let i = 0; i < 3; i++) {
			if (Math.sign(box.center[i] - origin[i]) == Math.sign(direction[i])
				&& !(origin[i] >= box.min[i] && origin[i] <= box.max[i])) { // and NOT INSIDE the box on this axis
				let axis = i;

				// Move along that axis to find the intersection point on this axis
				let ip = box.center[axis] - Math.sign(direction[axis]) * box.extents[axis];
				let s = ip - origin[axis];	// distance to intersection
				let k = s / direction[axis];	// how many dir vectors to get to ip
				// ^^ may need to do abs on these but I think they cancel

				// calculate the intersection point
				vec3.scaleAndAdd(out, origin, direction, k);

				let isHit = (axis == 0 || (out[0] >= box.min[0] && out[0] <= box.max[0]))
					&& (axis == 1 || (out[1] >= box.min[1] && out[1] <= box.max[1]))
					&& (axis == 2 || (out[2] >= box.min[2] && out[2] <= box.max[2]));

				if (isHit) {
					return k;
				}
				// If it doesn't collide on this face, maybe it collides on another, keep going!
			}
		}
		return 0;
	}

	exports.intersectSphere = function(sphere, box) {
		// closest point on box to sphere center
		let x = Math.max(box.min[0], Math.min(sphere.center[0], box.max[0]));
		let y = Math.max(box.min[1], Math.min(sphere.center[1], box.max[1]));
		let z = Math.max(box.min[2], Math.min(sphere.center[2], box.max[2]));

		let sqrDistance = (x - sphere.center[0]) * (x - sphere.center[0]) +
			(y - sphere.center[1]) * (y - sphere.center[1]) +
			(z - sphere.center[2]) * (z - sphere.center[2]);

		return sqrDistance < sphere.radius * sphere.radius;
	};

	exports.create = function({ center, size, extents, min, max }) {
		// Note - you are expected to recalculate min/max when position or extents change
		// or alternatively if you change min/max you can recalculate extents/size/center
		let aabb = Object.create(prototype);

		if (center || size || extents) {
			if (center) {
				aabb.center = center;
			} else {
				aabb.center = vec3.create();
			}

			if (size) {
				aabb.size = size;
				aabb.extents = vec3.fromValues(0.5 * aabb.size[0], 0.5 * aabb.size[1], 0.5 * aabb.size[2])
			} else if (extents) {
				aabb.extents = extents;
				aabb.size = vec3.fromValues(2 * aabb.extents[0], 2 * aabb.extents[1], 2 * aabb.extents[2]);
			}
			aabb.min = vec3.create();
			aabb.max = vec3.create();

			aabb.recalculateMinMax();
		} else {
			// Could check min < max on all axes to make this easier to use
			aabb.min = min;
			aabb.max = max;
			aabb.center = vec3.create();
			aabb.size = vec3.create();
			aabb.extents = vec3.create();
			aabb.recalculateExtents();
		}

		return aabb;
	};

	return exports;
})();

},{"./maths":11}],3:[function(require,module,exports){
const Maths = require('./maths');
const vec3 = Maths.vec3, vec4 = Maths.vec4, mat4 = Maths.mat4, quat = Maths.quat;

module.exports = (function() {
	// NOTE: Camera points in -z direction
	let exports = {};

	let Type = exports.Type = {
		Perspective: "Perspective",
		Orthonormal: "Orthonormal"
	};

	// vec3 cache for calculations
	let localX = vec3.create();
	let localY = vec3.create();
	let localZ = vec3.create();
	let vec3Cache = vec3.create();
	let vec4Cache = vec4.create();
	let q = quat.create();

	let prototype = {
		// Set Rotation from Euler
		// Set Position x, y, z
		// Note do not have enforced copy setters, the user is responsible for this
		// TODO: Review depth and frustrum to make sure they deal with look in -z correctly
		calculateFrustum: function() {
			// TODO: Update to work for orthonormal projection as well
			Maths.quat.localAxes(this.rotation, localX, localY, localZ);

			// Calculate Planes
			// NOTE: Relies on the fact camera looks in -ve z direction
			// Note Right Handed but facing in negative z, so -x is left, and +x is right.

			// Planes should point inwards

			// Near
			vec3.negate(this.planes[0], localZ); // Set Normal
			vec3.scaleAndAdd(vec3Cache, this.position, localZ, -this.near);	// Calculate mid-point of plane
			this.planes[0][3] = -vec3.dot(this.planes[0], vec3Cache);	// Set [3] to distance from plane to origin along normal (normal is pointing torwards origin)
			// Far
			vec3.copy(this.planes[1], localZ);
			vec3.scaleAndAdd(vec3Cache, this.position, localZ, -this.far);
			this.planes[1][3] = -vec3.dot(this.planes[1], vec3Cache);
			// Left
			quat.identity(q);
			Maths.quat.rotate(q, q, 0.5 * this.ratio * this.fov, localY);	// Rotation is anti-clockwise apparently
			vec3.transformQuat(this.planes[2], localX, q);
			this.planes[2][3] = -vec3.dot(this.planes[2], this.position);
			// Right
			quat.identity(q);
			Maths.quat.rotate(q, q, -0.5 * this.ratio * this.fov, localY);
			vec3.negate(vec3Cache, localX);
			vec3.transformQuat(this.planes[3], vec3Cache, q);
			this.planes[3][3] = -vec3.dot(this.planes[3], this.position);
			// Top
			quat.identity(q);
			Maths.quat.rotate(q, q, 0.5 * this.fov, localX);
			vec3.negate(vec3Cache, localY);
			vec3.transformQuat(this.planes[4], vec3Cache, q);
			this.planes[4][3] = -vec3.dot(this.planes[4], this.position);
			// Bottom
			quat.identity(q);
			Maths.quat.rotate(q, q, -0.5 * this.fov, localX);
			vec3.transformQuat(this.planes[5], localY, q);
			this.planes[5][3] = -vec3.dot(this.planes[5], this.position);

			// TODO: The points too please so we can improve culling
		},
		isSphereInFrustum: function(center, radius) {
			vec4Cache[3] = 1;
			for (let i = 0; i < 6; i++) {
				// We want the point center + normal of the plane * radius
				vec3.scaleAndAdd(vec4Cache, center, this.planes[i], radius);
				if (vec4.dot(this.planes[i], vec4Cache) < 0) {
					return false;
				}
			}
			return true;
		},
		isInFrustum: function(bounds) {
			// https://iquilezles.org/www/articles/frustumcorrect/frustumcorrect.htm
			// Note : https://stackoverflow.com/questions/31788925/correct-frustum-aabb-intersection
			// TODO: Profile and try different techniques (using continue in the loop, unrolling the lot, etc)
			vec4Cache[3] = 1;
			// Consider wrapping this cache in an anon function execution to keep scope minimal, see of it improves performance
			// i.e. isInFrustum = (function() { let cache = vec4.create(); return function(bounds) { /* implementation */ }; })();
			for (let i = 0; i < 6; i++) {
				let out = 0;
				vec4Cache[0] = bounds.min[0], vec4Cache[1] = bounds.max[1], vec4Cache[2] = bounds.min[2];
				out += (vec4.dot(this.planes[i], vec4Cache) < 0) ? 1 : 0;	// min max min
				vec4Cache[1] = bounds.min[1];
				out += (vec4.dot(this.planes[i], vec4Cache) < 0) ? 1 : 0;	// min min min
				vec4Cache[0] = bounds.max[0];
				out += (vec4.dot(this.planes[i], vec4Cache) < 0) ? 1 : 0;	// max min min
				vec4Cache[1] = bounds.max[1];
				out += (vec4.dot(this.planes[i], vec4Cache) < 0) ? 1 : 0;	// max max min
				vec4Cache[2] = bounds.max[2];
				out += (vec4.dot(this.planes[i], vec4Cache) < 0) ? 1 : 0;	// max max max
				vec4Cache[1] = bounds.min[1];
				out += (vec4.dot(this.planes[i], vec4Cache) < 0) ? 1 : 0;	// max min max
				vec4Cache[0] = bounds.min[0];
				out += (vec4.dot(this.planes[i], vec4Cache) < 0) ? 1 : 0;	// min min max
				vec4Cache[1] = bounds.max[1];
				out += (vec4.dot(this.planes[i], vec4Cache) < 0) ? 1 : 0;	// min max max
				if (out == 8) {
					return false;
				}
			}
			// TODO: Add check of points too
			return true;
		},
		getDepth: function(position) {
			let p0 = this.position[0], p1 = this.position[1], p2 = this.position[2],
				q0 = this.rotation[0], q1 = this.rotation[1], q2 = this.rotation[2], q3 = this.rotation[3],
				l0 = position[0], l1 = position[1], l2 = position[2];
			return 2*(q1*q3 + q0*q2)*(l0 - p0) + 2*(q2*q3 - q0*q1)*(l1 - p1) + (1 - 2*q1*q1 - 2*q2*q2)*(l2 - p2);
		},
		getLookDirection: function(out) {
			vec3.transformQuat(out, Maths.vec3.Z, this.rotation);
			vec3.negate(out, out); // Camera faces in -z
		},
		getProjectionMatrix: function(out) {
			if(this.type == Type.Perspective) {
				mat4.perspective(out, this.fov, this.ratio, this.near, this.far);
			} else {
				let left = - (this.height * this.ratio) / 2.0;
				let right = - left;
				let top = this.height / 2.0;
				let bottom = -top;
				mat4.ortho(out, left, right, bottom, top, this.near, this.far);
			}
			return out;
		},
		viewportToWorld: function(out, viewPort, z) {
			// Viewport measured from top-left
			if(this.type == Type.Orthonormal) {
				out[0] = (this.height * this.ratio) * (viewPort[0] - 0.5);
				out[1] = this.height * (0.5 - viewPort[1]);	
				out[2] = (z || 0);
				vec3.transformQuat(out, out, this.rotation);
				vec3.add(out, out, this.position);
			} else {
				let zDist = z || this.near;
				let planeHeight = 2 * zDist * Math.tan(0.5 * this.fov);
				let planeWidth = planeHeight * this.ratio;
				out[0] = planeWidth * (viewPort[0] - 0.5);
				out[1] = planeHeight * (0.5 - viewPort[1]);
				out[2] = -zDist;
				vec3.transformQuat(out, out, this.rotation);
				vec3.add(out, out, this.position);
			}
		}
	};

	exports.create = function(config) {
		let camera = Object.create(prototype);

		let { type = Type.Perspective, near, far, ratio = 1.0, clear = true, clearColor } = config;
		camera.type = type;
		camera.near = near;
		camera.far = far;
		camera.ratio = ratio;
		camera.clear = clear;
		camera.clearColor = clearColor;

		switch (type) {
			case Type.Perspective:
				// vertical field of view, ratio (aspect) determines horizontal fov
				camera.fov = config.fov;
				break;
			case Type.Orthonormal:
				camera.height = config.height;
				break;
			default:
				throw new Error("Unrecognised Camera Type '" + type + "'");
		}

		let { position = vec3.create(), rotation = quat.create() } = config;
		camera.position = position;
		camera.rotation = rotation;

		camera.planes = [];
		// Stored as plane normal, distance from plane to origin in direction of normal
		for (let i = 0; i < 6; i++) {
			camera.planes[i] = vec4.create();
		}
		camera.points = [];
		for (let i = 0; i < 8; i++) {
			camera.points[i] = vec3.create();
		}

		// TODO: Arguably post-processing effects and target could/should be on the camera, the other option is on the scene

		return camera;
	};
	
	return exports;
})();

},{"./maths":11}],4:[function(require,module,exports){
// Client.js - for using Fury old school style as a JS file which adds a
// global which you can use. 

const Fury = require('./fury.js'); 
// Create Fury Global
window.Fury = Fury;

// Add globalize extension for maths classes for ease of use
const { Maths } = Fury;
Maths.globalize = function() {
	window.mat2 = Maths.mat2;
	window.mat3 = Maths.mat3;
	window.mat4 = Maths.mat4;
	window.quat = Maths.quat;
	window.quat2 = Maths.quat2;
	window.vec2 = Maths.vec2;
	window.vec3 = Maths.vec3;
	window.vec4 = Maths.vec4;
};

},{"./fury.js":5}],5:[function(require,module,exports){
// Fury Module can be used with 'require'
module.exports = (function() {
	let Fury = {};
	let canvas;

	// Modules
	Fury.Atlas = require('./atlas')
	Fury.Bounds = require('./bounds');
	Fury.Camera = require('./camera');
	Fury.GameLoop = require('./gameLoop');
	Fury.Input = require('./input');
	Fury.Material = require('./material');
	Fury.Maths = require('./maths');
	Fury.Mesh = require('./mesh');
	Fury.Model = require('./model');
	Fury.NineSlice = require('./nineSlice');
	Fury.Physics = require('./physics');
	Fury.Prefab = require('./prefab');
	Fury.Primitives = require('./primitives');
	Fury.Random = require('./random');
	Fury.Renderer = require('./renderer');
	Fury.Scene = require('./scene');
	Fury.Shader = require('./shader');
	Fury.Shaders = require('./shaders');
	Fury.TextMesh = require('./textmesh');
	Fury.Texture = require('./texture');
	Fury.TileMap = require('./tilemap');
	Fury.Transform = require('./transform');
	Fury.Utils = require('./utils');
	Fury.WorkerPool = require('./workerPool');

	Fury.init = function(parameters) {
		let disableShaderPreload = false;
		let canvasId = null;
		let contextAttributes = null;

		if (typeof(parameters) == 'string') {
			disableShaderPreload = true;
			canvasId = parameters;
		} else {
			canvasId = parameters.canvasId;
			contextAttributes = parameters.glContextAttributes;
			disableShaderPreload = !!parameters.disableShaderPreload;
		}

		canvas = document.getElementById(canvasId);
		try {
			Fury.Renderer.init(canvas, contextAttributes);
		} catch (error) {
			console.log(error.message);
			return false;
		}
		Fury.Input.init(canvas);

		if (!disableShaderPreload) {
			Fury.Shaders.createShaders();
		}
		
		if (parameters.gameLoop) {
			Fury.GameLoop.init(parameters.gameLoop);
		}

		return true;
	};

	return Fury;
})();

},{"./atlas":1,"./bounds":2,"./camera":3,"./gameLoop":6,"./input":9,"./material":10,"./maths":11,"./mesh":22,"./model":23,"./nineSlice":24,"./physics":25,"./prefab":26,"./primitives":27,"./random":28,"./renderer":29,"./scene":30,"./shader":31,"./shaders":32,"./textmesh":33,"./texture":34,"./tilemap":35,"./transform":36,"./utils":37,"./workerPool":38}],6:[function(require,module,exports){
const Input = require('./input');

module.exports = (function() {
	let gameTime = 0; // Time in seconds that the game loop thinks it's run (i.e. accounting for clamps, pauses / focus loss)
	let exports = {
		get time() { return gameTime; },
	};

	let State = {
		Paused: 0,
		Running: 1,
		RequestPause: 2
	};

	let state = State.Paused;
	let stopCount = 0;

	let maxFrameTimeMs = null;
	let loopDelegate = null;

	let lastTime = 0;

	exports.timeScale = 1;

	exports.init = function({ loop, maxFrameTimeMs: maxMs }) {
		if (maxMs && typeof(maxMs) === 'number') {
			// Optional max frame time to keep physics calculations sane
			maxFrameTimeMs = maxMs;
		}

		if (loop && typeof(loop) === 'function') {
			loopDelegate = loop;
		} else {
			console.error("You must provide GameLoop.init with a loop parameter of type function");
		}

		if (loopDelegate) {
			window.addEventListener('blur', onWindowBlur);
			window.addEventListener('focus', onWindowFocus);	
		}
	};

	exports.start = function() {
		stopCount = Math.max(0, stopCount - 1);
		if (stopCount == 0) {
			switch (state) {
				case State.Paused:
					state = State.Running;
					lastTime = Date.now();
					Input.handleFrameFinished(); // clear any input that happened since pause
					window.requestAnimationFrame(loop);
					break;
				case State.RequestPause:
					state = State.Running;
					break;
			}
		}
	};

	exports.stop = function() {
		stopCount += 1;
		if (state != State.Paused) {
			state = State.RequestPause;
		}
	};

	exports.isRunning = function() {
		return state === State.Running;
	};
	
	let onWindowBlur = function() {
		exports.stop();
	}; 
	let onWindowFocus = function() {
		exports.start();
	};

	let loop = function() {
		if (state == State.RequestPause) {
			state = State.Paused;
			return;
		}

		let elapsed = Date.now() - lastTime;
		lastTime += elapsed;

		if (elapsed == 0) {
			console.warn("elapsed time of 0, skipping frame");
			requestAnimationFrame(loop);
			return;
		}

		elapsed *= exports.timeScale;
		if (maxFrameTimeMs && elapsed > maxFrameTimeMs) {
			elapsed = maxFrameTimeMs;
			// Arguably could run multiple logic updates,
			// however that would require tracking window focus 
			// and ensuring update length < maxFrameTime
		}

		elapsed /= 1000; // Convert elapsed to seconds
		gameTime += elapsed;

		try {
			loopDelegate(elapsed);
		} catch (error) {
			console.error(error);
		}
		
		Input.handleFrameFinished();
		window.requestAnimationFrame(loop);
	};

	return exports;
})();
},{"./input":9}],7:[function(require,module,exports){
module.exports = (function(){
	let exports = {};

	let parentIndex = i =>  Math.floor(i / 2);
	let leftChildIndex = i => 2 * i;
	let rightChildIndex = i => 2 * i + 1;

	exports.create = () => {
		let heap = {};

		let items = [];
		let priorities = [];
		let count = 0;

		let swap = (i, j) => {
			let item = items[i];
			items[i] = items[j];
			items[j] = item;
			let priority = priorities[i];
			priorities[i] = priorities[j];
			priorities[j] = priority;
		};

		let minChildIndex = (i) => {
			let result = 0;
			if (rightChildIndex(i) >= count) {
				result = leftChildIndex(i);
			} else {
				if (priorities[leftChildIndex(i)] < priorities[rightChildIndex(i)]) {
					result = leftChildIndex(i);
				} else {
					result = rightChildIndex(i);
				}
			}
			return result;
		};

		let selectIndex = (item, priority) => {
			for (let i = 0; i < count; i++) {
				if (items[i] == item && priorities[i] == priority) {
					return i;
				}
			}
			console.error("Unable to find node with priority " + priority + " and item " + item);
			return -1;
		};

		let deleteAtIndex = (index) => {
			if (index < 0 && index >= count) {
				console.error("Can not delete index " + index + " for heap count " + count);
				return;
			}

			if (count == 1) {
				count--;
				return;
			}

			count--;
			let i = index;
			items[index] = items[count];
			priorities[index] = priorities[count];
			let priority = priorities[index];
			while (leftChildIndex(i) < count || rightChildIndex(i) < count) {
				let minChildIdx = minChildIndex(i);
				if (priority <= priorities[minChildIdx]) {
					break;
				}
				swap(i, minChildIdx);
				i = minChildIdx;
			}
		};

		heap.insert = (item, priority) => {
			let i = count;
			items[i] = item;
			priorities[i] = priority;
			count++;
			while (i > 0 && priorities[parentIndex(i)] > priorities[i]) {
				swap(i, parentIndex(i));
				i = parentIndex(i);
			}
		};
		heap.extractMin = () => {
			let min = null;
			if (count > 0) {
				min = items[0];
				deleteAtIndex(0);
			}
			return min;
		};
		heap.delete = (item, priority) => {
			let idx = selectIndex(item, priority);
			if (idx >= 0) {
				deleteAtIndex(idx);
			}
		};
		heap.clear = () => {
			count = 0;
			items.length = 0;
			priorities.length = 0;
		};
		heap.count = () => count;

		return heap;
	};

	return exports;
})();
},{}],8:[function(require,module,exports){
module.exports = (function(){
	// This creates a dictionary that provides its own keys
	// It also contains an array of keys for quick enumeration
	// This does of course slow removal, so this structure should
	// be used for arrays where you want to enumerate a lot and 
	// also want references that do not go out of date when 
	// you remove an item (which is hopefully rarely).

	// Can this be replaced with Map?
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
	// An issue is the lack of a sort functionw without creating a new map, which is used 
	// when adding new objects to sceneObjects (in scene.add in the scene module) to group objects
	// by their material.

	// Please note, again for purposes of speed and ease of use 
	// this structure adds the key of the item to the id property on items added
	// this eases checking for duplicates and if you have the only reference
	// you can still remove it from the list or check if it is in the list. 
	let exports = {};
	let nextKey = 1;
	// Not entirely sure why we're reusing keys across all indexed maps 
	// but I don't think it does any harm :shrug:

	let prototype = {
		add: function(item, sortFunction) {
			if (!item.id || !this[item.id]) {
				let key = (nextKey++).toString();
				item.id = key;
				this[key] = item;
				this.keys.push(key);
				if (sortFunction) {
					this.keys.sort(sortFunction);
				}
			}
			return item.id;
		},
		sort: function(sortFunction) {
			if (sortFunction) {
				this.keys.sort(sortFunction);
			} else {
				this.keys.sort();
			}
		},
		remove: function(key) {
			if(key != "keys" && this.hasOwnProperty(key)) {
				this[key].id = null;
				if(delete this[key]) {
					for(let i = 0, l = this.keys.length; i < l; i++) {
						if(this.keys[i] == key) {
							this.keys.splice(i,1);
						}
					}
					return true;
				}
			}
			return false;
		},
		clear: function() {
			for(var i = 0, l = this.keys.length; i < l; i++) {
				delete this[this.keys[i]];
			}
			this.keys.length = 0;
		}
	};

	exports.create = function() {
		// TODO: Option to specify property name to use for id, defaulting to "id"
		let map = Object.create(prototype);
		map.keys = [];
		return map;
	};

	return exports;
})();
},{}],9:[function(require,module,exports){
const Maths = require('./maths');

module.exports = (function() {
	let exports = {};

	let pointerLocked = false;
	let mouseState = [], currentlyPressedKeys = [];	// probably shouldn't use arrays lots of empty space
	let downMouse = [], upMouse = [];
	let downMouseTimes = [], upMouseTimes = [];
	let downKeys = [], upKeys = []; // Keys pressed or released this frame
	let downKeyTimes = [], upKeyTimes = []; // Time key was last pressed or released
	let canvas;

	let defaultTime = Date.now(); // Just return start of program rather than start of epoch if keys never pressed

	exports.init = function(targetCanvas) {
			canvas = targetCanvas;
			canvas.addEventListener("mousemove", handleMouseMove);
			canvas.addEventListener("mousedown", handleMouseDown, true);
			canvas.addEventListener("mouseup", handleMouseUp);
			canvas.addEventListener("wheel", handleMouseWheel);

			document.addEventListener('pointerlockchange', () => {
				pointerLocked = !!(document.pointerLockElement || document.mozPointerLockElement); // polyfill
			});
			canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock; // polyfill

			window.addEventListener("keyup", handleKeyUp);
			window.addEventListener("keydown", handleKeyDown);
			window.addEventListener("blur", handleBlur);
	};

	exports.isPointerLocked = function() {
		return pointerLocked;
	};

	exports.requestPointerLock = function() {
		return canvas.requestPointerLock({ unadjustedMovement: true });
	};

	exports.releasePointerLock = function() {
		document.exitPointerLock();
	};

	let MouseDelta = exports.MouseDelta = [0, 0];
	let MousePosition = exports.MousePosition = [0, 0];
	let MouseWheel = exports.MouseWheel = [0, 0, 0];

	let keyPressed = function(key) {
		if (!isNaN(key) && !key.length) {
			return currentlyPressedKeys[key];
		}
		else if (key) {
			let map = DescriptionToKeyCode[key];
			return (map) ? !!currentlyPressedKeys[map] : false;
		}
		else {
			return false;
		}
	};

	exports.keyUp = function(key) {
		if (!isNaN(key) && !key.length) {
			return upKeys[key];
		}
		else if (key) {
			let map = DescriptionToKeyCode[key];
			return (map) ? !!upKeys[map] : false;
		}
		else {
			return false;
		}
	};

	exports.keyDown = function(key, thisFrame) {
		if (!thisFrame) {
			return keyPressed(key);
		} else {
			if (!isNaN(key) && !key.length) {
				return downKeys[key];
			}
			else if (key) {
				let map = DescriptionToKeyCode[key];
				return (map) ? !!downKeys[map] : false;
			}
			else {
				return false;
			}
		}
	};

	let keyDownTime = exports.keyDownTime = function(key) {
		if (!isNaN(key) && !key.length) {
			return downKeyTimes[key];
		} else if (key) {
			let map = DescriptionToKeyCode[key];
			return map ? downKeyTimes[map] : defaultTime;
		} else {
			return defaultTime;
		}
	}

	exports.keyUpTime = function(key) {
		if (!isNaN(key) && !key.length) {
			return upKeyTimes[key];
		} else if (key) {
			let map = DescriptionToKeyCode[key];
			return map ? upKeyTimes[map] : defaultTime;
		} else {
			return defaultTime;
		}
	}

	exports.getAxis = function(plusKey, minusKey) {
		let result = 0;
		if (keyPressed(plusKey)) {
			result += 1;
		} 
		if (keyPressed(minusKey)) {
			result -= 1;
		}
		return result;
	};

	let mousePressed = function(button) {
		if (!isNaN(button) && !button.length) {
			return mouseState[button];
		} else if (button) {
			let map = DescriptionToMouseButton[button];
			return (!isNaN(map)) ? mouseState[map] : false;
		} else {
			return false;
		}
	}

	exports.mouseUp = function(button) {
		if (!isNaN(button) && !button.length) {
			return upMouse[button];
		} else if (button) {
			let map = DescriptionToMouseButton[button];
			return (!isNaN(map)) ? upMouse[map] : false;
		} else {
			return false;
		}
	};

	exports.mouseDown = function(button, thisFrame) {
		if (!thisFrame) {
			return mousePressed(button);
		} else {
			if (!isNaN(button) && !button.length) {
				return downMouse[button];
			} else if (button) {
				let map = DescriptionToMouseButton[button];
				return (!isNaN(map)) ? downMouse[map] : false;
			} else {
				return false;
			}
		}
	};

	exports.handleFrameFinished = function() {
		MouseDelta[0] = MouseDelta[1] = 0;
		MouseWheel[0] = MouseWheel[1] = MouseWheel[2] = 0;
		downKeys.length = 0;
		upKeys.length = 0;
		downMouse.length = 0;
		upMouse.length = 0;
	};

	let handleKeyDown = function(event) {
		// keyDown event can get called multiple times after a short delay
		if (!currentlyPressedKeys[event.keyCode]) {
			downKeys[event.keyCode] = true;
			downKeyTimes[event.keyCode] = Date.now();
		}
		currentlyPressedKeys[event.keyCode] = true;
	};

	let handleKeyUp = function(event) {
		currentlyPressedKeys[event.keyCode] = false;
		upKeyTimes[event.keyCode] = Date.now();
		upKeys[event.keyCode] = true;
	};

	let handleBlur = function() {
		downMouse.length = 0;
		mouseState.length = 0;
		upMouse.length = 0;

		downKeys.length = 0;
		currentlyPressedKeys.length = 0;
		upKeys.length = 0;	// Q: Should we be copying currently pressed Keys as they've kinda been released?
	};

	let handleMouseMove = function(event) {
		MousePosition[0] = event.offsetX;
		MousePosition[1] = event.offsetY;
		MouseDelta[0] += event.movementX;
		MouseDelta[1] += event.movementY;
	};

	let handleMouseDown = function(event) {
		if (!mouseState[event.button]) {
			downMouse[event.button] = true;
			downMouseTimes[event.button] = Date.now();
		}
		mouseState[event.button] = true;
		return false;
	};

	let handleMouseUp = function(event) {
		mouseState[event.button] = false;
		upMouseTimes[event.button] = Date.now();
		upMouse[event.button] = true;
	};

	let handleMouseWheel = function(event) {
		MouseWheel[0] += event.deltaX;
		MouseWheel[1] += event.deltaY;
		MouseWheel[2] += event.deltaZ;
		// Note event.deltaMode determines if values are pixels, lines or pages, assumed pixels here
	};

	exports.getMouseViewportX = function() {
		return MousePosition[0] / canvas.clientWidth;
	};

	exports.getMouseViewportY = function() {
		return MousePosition[1] / canvas.clientHeight;
	};

	// TODO: Add Numpad Keys
	// TODO: Deal with shift in map (probably going to need to move to a function from JSON object for this)
	let DescriptionToKeyCode = exports.DescriptionToKeyCode = {
		"a": 65,
		"b": 66,
		"c": 67,
		"d": 68,
		"e": 69,
		"f": 70,
		"g": 71,
		"h": 72,
		"i": 73,
		"j": 74,
		"k": 75,
		"l": 76,
		"m": 77,
		"n": 78,
		"o": 79,
		"p": 80,
		"q": 81,
		"r": 82,
		"s": 83,
		"t": 84,
		"u": 85,
		"v": 86,
		"w": 87,
		"x": 88,
		"y": 89,
		"z": 90,
		"Backspace": 8,
		"Tab": 9,
		"Enter": 13,
		"Shift": 16,
		"Ctrl": 17,
		"Alt": 18,
		"PauseBreak": 19,
		"Caps": 20,
		"Esc": 27,
		"Space": 32,
		"PageUp": 33,
		"PageDown": 34,
		"End": 35,
		"Home": 36,
		"Left": 37,
		"Up": 38,
		"Right": 39,
		"Down": 40,
		"Insert": 45,
		"Delete": 46,
		"0": 48,
		"1": 49,
		"2": 50,
		"3": 51,
		"4": 52,
		"5": 53,
		"6": 54,
		"7": 55,
		"8": 56,
		"9": 57,
		";": 59,
		"=": 61,
		"-": 189,
		",": 188,
		".": 190,
		"/": 191,
		"|": 220,
		"[": 219,
		"]": 221,
		"`": 223,
		"'": 192,
		"#": 222
	};

	exports.KeyCodeToDescription = {
		65: "a",
		66: "b",
		67: "c",
		68: "d",
		69: "e",
		70: "f",
		71: "g",
		72: "h",
		73: "i",
		74: "j",
		75: "k",
		76: "l",
		77: "m",
		78: "n",
		79: "o",
		80: "p",
		81: "q",
		82: "r",
		83: "s",
		84: "t",
		85: "u",
		86: "v",
		87: "w",
		88: "x",
		89: "y",
		90: "z",
		8: "Backspace",
		9: "Tab",
		13: "Enter",
		16: "Shift",
		17: "Ctrl",
		18: "Alt",
		19: "PauseBreak",
		20: "Caps",
		27: "Esc",
		32: "Space",
		33: "PageUp",
		34: "PageDown",
		35: "End",
		36: "Home",
		37: "Left",
		38: "Up",
		39: "Right",
		40: "Down",
		45: "Insert",
		46: "Delete",
		48: "0",
		49: "1",
		50: "2",
		51: "3",
		52: "4",
		53: "5",
		54: "6",
		55: "7",
		56: "8",
		57: "9",
		59: ";",
		61: "=",
		189: "-",
		188: ",",
		190: ".",
		191: "/",
		220: "|",
		219: "[",
		221: "]",
		223: "`",
		192: "'",
		222: "#"
	};

	exports.MouseButtonToDescription = {
		0: "LeftMouseButton",
		1: "MiddleMouseButton",
		2: "RightMouseButton"
	};

	let DescriptionToMouseButton = exports.DescriptionToMouseButton = {
		"LeftMouseButton": 0,
		"MiddleMouseButton": 1,
		"RightMouseButton": 2
	};

	return exports;
})();
},{"./maths":11}],10:[function(require,module,exports){
module.exports = (function(){
	let exports = {};
	
	let prototype = {
		blendSeparate: false, // Toggles use of blendFunc vs. blendFuncSeparate
		blendEquation: "FUNC_ADD",
		// blendFunc Parameters
		sourceBlendType: "SRC_ALPHA",
		destinationBlendType: "ONE_MINUS_SRC_ALPHA",
		// blendFuncSeparate Parameters 
		sourceColorBlendType: "SRC_ALPHA",
		destinationColorBlendType: "ONE_MINUS_SRC_ALPHA",
		sourceAlphaBlendType: "ZERO",
		destinationAlphaBlendType: "DST_ALPHA",
		setTexture: function(texture, uniformName) {
			if (uniformName) {
				this.textures[uniformName] = texture;
			} else {
				this.textures[this.shader.textureUniformNames[0]] = texture;
			}
		},
		setTextures: function(textures) {
			for (var i = 0, l = textures.length; i < l; i++) {
				if (textures[i].uniformName && textures[i].texture) {
					// Array of uniform name to texture objects
					this.textures[textures[i].uniformName] = textures[i].texture;
				} else if (i < this.shader.textureUniformNames.length) {
					// Assume array of textures - use uniform names
					this.textures[this.shader.textureUniformNames[i]] = textures[i];
				} else {
					throw new Error("Textures parameter must be either an array of objects containing uniformName and texture properties," 
						+ " or an array textures of length no greater than the provided shader's uniform names array");
				}
			}
		},
		setProperties: function(properties) {
			let keys = Object.keys(properties);
			for (let i = 0, l = keys.length; i < l; i++) {
				this[keys[i]] = properties[keys[i]];
			}
		}
	};

	exports.create = function({ shader, textures, texture, properties }) {
		let material = Object.create(prototype);

		if(!shader) {
			throw new Error("Shader must be provided");
		}
		material.shader = shader;

		material.textures = {};
		if (textures) {
			material.setTextures(textures);
		} else if (texture) {
			material.setTexture(texture);
		}

		if (properties) {
			material.setProperties(properties);
		}

		if (material.shader.validateMaterial) {
			material.shader.validateMaterial(material);
		}

		return material;
	};

	exports.clone = function(material) {
		let clone = Object.assign(Object.create(prototype), material);
		clone.id = null;
		return clone;
	};
	
	return exports;
})();
},{}],11:[function(require,module,exports){
// Maths modules are a CommonJS port of glMatrix v3.4.0
const common = require('./maths/common');
const mat2 = require('./maths/mat2');
const mat3 = require('./maths/mat3');
const mat4 = require('./maths/mat4');
const quat = require('./maths/quat');
const quat2 = require('./maths/quat2');
const vec2 = require('./maths/vec2');
const vec3 = require('./maths/vec3');
const vec4 = require('./maths/vec4');

module.exports = (function() {
	let exports = {};

	exports.toDegree = common.toDegree;
	exports.toRadian = common.toRadian;
	exports.equals = common.equals;

	exports.mat2 = mat2;
	exports.mat3 = mat3;
	exports.mat4 = mat4;
	exports.quat = quat;
	exports.quat2 = quat2;
	exports.vec2 = vec2;
	exports.vec3 = vec3;
	exports.vec4 = vec4;

	exports.Ease = require('./maths/ease');

	// TODO: Add plane 'class' - it's a vec4 with 0-2 being the normal vector and 3 being the distance to the origin from the plane along the normal vector
	// I.e. the dot product of the offset point?
	// Look at MapLoader demo it has an implementation, though it needs updating to encourage use of "out" parameters

	let equals = common.equals;

	let approximately = exports.approximately = (a, b, epsilon) => {
		// Was using adpated version of https://floating-point-gui.de/errors/comparison/
		// However, it's behaviour is somewhat unintuative and honestly more helpful just to have straight threshold check 
		if (!epsilon) epsilon = Number.EPSILON;
		return Math.abs(a - b) <  epsilon;
	};

	exports.clamp = (x, min, max) => { return Math.max(Math.min(max, x), min); };

	let clamp01 = exports.clamp01 = (x) => { return exports.clamp(x, 0, 1); };

	exports.lerp = (a, b, r) => { return r * (b - a) + a; };

	exports.smoothStep = (a, b, r) => {
		// https://en.wikipedia.org/wiki/Smoothstep
		let x = clamp01((r - a) / (b - a));
		return x * x * (3 - 2 * x); 
	};

	/**
	 * Moves number value towards b from a limited by a maximum value
	 * 
	 * @param {Number} a 
	 * @param {Number} b 
	 * @param {Number} maxDelta 
	 * @returns {Number}
	 */
	exports.moveTowards = (a, b, maxDelta) => {
		let delta = b - a;
		return maxDelta >= Math.abs(delta) ? b : a + Math.sign(delta) * maxDelta; 
	};

	exports.smoothDamp = (a, b, speed, smoothTime, maxSpeed, elapsed) => {
		if (a === b) {
			return b;
		}

		smoothTime = Math.max(0.0001, smoothTime); // minimum smooth time of 0.0001
		let omega = 2.0 / smoothTime;
		let x = omega * elapsed;
		let exp = 1.0 / (1.0 * x + 0.48 * x * x + 0.245 * x * x * x);
		let delta = b - a;
		let mag = Math.abs(delta);

		// Adjust to delta to ensure we don't exceed max speed if necessary
		let maxDelta = maxSpeed * smoothTime; // Expects max speed +ve
		if (mag > maxDelta) {
			delta = maxDelta * Math.sign(delta);
		}

		let temp = (speed + omega * delta) * elapsed;
		speed = (speed - omega * temp) * exp;
		let result = a - delta + (delta + temp) * exp;
		// Check we don't overshoot
		if (mag <= Math.abs(result - a)) {
			return b;
		}
		return result;
	};

	const ANGLE_DOT_EPSILON = 0.000001;

	// RotateTowards extension has to be here to avoid cyclic dependency between quat and vec3

	/**
	 * Rotate a vec3 towards another with a specificed maximum change
	 * in magnitude and a maximum change in angle 
	 * 
	 * @param {vec3} out
	 * @param {vec3} a the vector to rotate from
	 * @param {vec3} b the vector to rotate towards
	 * @param {Number} maxRadiansDelta the maximum allowed difference in angle in Radians
	 * @param {Number} maxMagnitudeDelta the maximum allowed difference in magnitude
	 */
	vec3.rotateTowards = (() => {
		let an = vec3.create();
		let bn = vec3.create();
		let cross = vec3.create();
		let q = quat.create(); 
		return (out, a, b, maxRadiansDelta, maxMagnitudeDelta) => {
			let aLen = vec3.length(a);
			let bLen = vec3.length(b);
			vec3.normlize(an, a);
			vec3.normlize(bn, b);
	
			// check for magnitude overshoot via move towards
			let targetLen = exports.moveTowards(aLen, bLen, maxMagnitudeDelta);
			let dot = vec3.dot(an, bn);
			if (approximately(Math.abs(dot), 1.0, ANGLE_DOT_EPSILON)) {  // Q: What about when pointing in opposite directions?
				// if pointing same direction just change magnitude
				vec3.copy(out, an);
				vec3.scale(out, targetLen);
			} else {
				// check for rotation overshoot
				let angle = Math.acos(dot) - maxRadiansDelta;
				if (angle <= 0) {
					vec3.copy(out, bn);
					vec3.scale(out, targetLen);
				} else if (angle > Math.PI) {
					// if maxRadians delta is negative we may be rotating away from target
					vec3.negate(out, bn);
					vec3.scale(out, targetLen);
				} else {
					// use quaternion to rotate
					vec3.cross(cross, a, b);
					quat.setAxisAngle(q, cross, maxRadiansDelta);
					vec3.transformQuat(out, a, q);
					// then set target length
					vec3.normlize(out, out);
					vec3.scale(out, targetLen);
				}
			}
		};
	})();

	// See https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
	// Note: They define roll as rotation around x axis, pitch around y axis, and yaw around z-axis
	// I do not agree, roll is around z-axis, pitch around x-axis, and yaw around y-axis.
	// Methods renamed accordingly

	// I attempted to swap and rearrange some of the formula so pitch could be -pi/2 to pi/2 range
	// and yaw would be -pi to pi but naively swapping the formula according to the apparent pattern did not work
	// c.f. 7dfps player class for hacky work around 
	// TODO: Fix these
	exports.calculatePitch = (q) => {
		// x-axis rotation
		let w = q[3], x = q[0], y = q[1], z = q[2];
		return Math.atan2(2 * (w*x + y*z), 1 - 2 * (x*x + y*y)); // use atan and probably would get -90:90?
	};

	exports.calculateYaw = (q) => {
		// y-axis rotation
		let w = q[3], x = q[0], y = q[1], z = q[2];
		let sinp = 2 * (w*y - z*x);
		if (Math.abs(sinp) >= 1) sinp = Math.sign(sinp) * (Math.PI / 2);  // Use 90 if out of range
		return Math.asin(sinp) // returns pi/2 -> - pi/2 range
	};

	exports.calculateRoll = (q) => {
		// z-axis rotation
		let w = q[3], x = q[0], y = q[1], z = q[2];
		return Math.atan2(2 * (w*z + x*y), 1 - 2 * (y*y + z*z));
		// This seems to occasionally return PI or -PI instead of 0
		// It does seem to be related to crossing boundaries but it's not entirely predictable
	};

	return exports;
})();

},{"./maths/common":12,"./maths/ease":13,"./maths/mat2":14,"./maths/mat3":15,"./maths/mat4":16,"./maths/quat":17,"./maths/quat2":18,"./maths/vec2":19,"./maths/vec3":20,"./maths/vec4":21}],12:[function(require,module,exports){
// Configuration Constants
const EPSILON = 0.000001;
// In modern browsers, arrays perform significantly better than typed arrays and serialize / deserialize more quickly
const ARRAY_TYPE = Array;
const RANDOM = Math.random;
const ANGLE_ORDER = "zyx";

exports.EPSILON = EPSILON;
exports.ARRAY_TYPE = ARRAY_TYPE;
exports.RANDOM = RANDOM;
exports.ANGLE_ORDER = ANGLE_ORDER;

/**
 * Symmetric round
 * see https://www.npmjs.com/package/round-half-up-symmetric#user-content-detailed-background
 *
 * @param {Number} a value to round
 */
exports.round = function(a) {
	if (a >= 0) {
		return Math.round(a);
	}
	return (a % 0.5 === 0) ? Math.floor(a) : Math.round(a);
};

/**
 * Sets the type of array used when creating new vectors and matrices
 *
 * @param {Float32ArrayConstructor | ArrayConstructor} type Array type, such as Float32Array or Array
 */
exports.setMatrixArrayType = function(type) {
	ARRAY_TYPE = type;
};

const degree = Math.PI / 180;
const radian = 180 / Math.PI;

/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */
exports.toRadian = function(a) {
	return a * degree;
};

/**
 * Convert Radian To Degree
 *
 * @param {Number} a Angle in Radians
 */
exports.toDegree = function(a) {
	return a * radian;
};

/**
 * Tests whether or not the arguments have approximately the same value, within an absolute
 * or relative tolerance of glMatrix.EPSILON (an absolute tolerance is used for values less
 * than or equal to 1.0, and a relative tolerance is used for larger values)
 *
 * @param {Number} a The first number to test.
 * @param {Number} b The second number to test.
 * @returns {Boolean} True if the numbers are approximately equal, false otherwise.
 */
exports.equals = function(a, b) {
	return Math.abs(a - b) <= EPSILON * Math.max(1.0, Math.abs(a), Math.abs(b));
};
},{}],13:[function(require,module,exports){
module.exports = (function() {
	// Reference:
	// https://gist.github.com/gre/1650294
	// http://haiyang.me/easing/Easings.html
	
	// Could arguably use npm muodule https://github.com/AndrewRayCode/easing-utils instead
	// Comparison: easeBack has more terms when from haiyang.me,
	// formulation of bounce has been rearranged but is probably the same.

	let exports = {};

	// Ease Back Consts
	const c1 = 1.70158;
	const c2 = c1 * 1.525;
	const c3 = c1 + 1;
	// Ease Elastic Consts
	const c4 = (2 * Math.PI) / 3.0;
	const c5 = (2 * Math.PI) / 4.5;
	// Ease Bounce Consts
	const n1 = 7.5625;
	const d1 = 2.75;
	let bounce = t =>  {
		if (t < 1 / d1) {
			return n1 * t * t;
		} else if ( t < 2 / d1) {
			return n1 * (t - 1.5) / d1 * (t - 1.5) + 0.75;
		} else if (t < 2.5 / d1) {
			return n1 * (t - 2.25) / d1 * (t - 2.25) + 0.9375; 
		} else {
			return n1 * (t - 2.625) / d1 * (t - 2.625) + 0.984375;
		}
	};
	exports.smoothStep = t => t * t * (3 - 2 * t);
	exports.inQuad = t => t * t;
	exports.outQuad = t =>  t * ( 2 - t ); // 1 - (1 - t) * (1 - t)
	exports.inOutQuad = t => t < 0.5 
		? 2 * t * t 
		: -1 + (4 - 2 * t) * t;
	exports.inCubic = t => t * t * t;
	exports.outCubic = t => (--t) * t * t + 1;
	exports.inOutCubic = t => t < 0.5 
		? 4 * t * t * t 
		: (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
	exports.inQuart = t => t * t * t * t;
	exports.outQuart = t => 1 - (--t) * t * t * t; 
	exports.inOutQuart = t => t < 0.5 
		? 8 * t * t * t * t 
		: 1 - 8 * (--t) * t * t * t;
	exports.inQuint = t => t * t * t * t *t;
	exports.outQuint = t => 1 + (--t) * t * t * t * t;
	exports.inOutQuint = t => t < 0.5 
		? 16 * t * t * t * t 
		: 1 + 16 * (--t) * t * t * t * t; 
	exports.inSine = t => 1 - Math.cos(t * Math.PI * 0.5);
	exports.outSine = t => Math.sin(t * Math.PI * 0.5);
	exports.inOutSine = t => - 0.5 * (Math.cost(Math.PI * t) - 1);
	exports.inExpo = t => t === 0 ? 0 : Math.pow(2, 10 * t - 10);
	exports.outExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
	exports.inOutExpo = t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 
		? 0.5 * Math.pow(2, 20 * t - 10) 
		: 0.5 * (2 - Math.pow(2, -20 * t + 10));
	exports.inCirc = t => 1 - Math.sqrt(1 - t * t);
	exports.outCirc = t => Math.sqrt(1 - (t - 1) * (t - 1));
	exports.inOutCirc = t => t < 0.5 
		? 0.5 * (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) 
		: 0.5 * (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1);
	exports.inBack = t => c3 * t * t * t - c1 * t * t;
	exports.outBack =  t => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
	exports.inOutBack = t => t < 0.5 
		? 0.5 * (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) 
		: 0.5 * (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2); 
	exports.inElastic = t => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
	exports.outElastic = t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
	exports.intOutElastic = t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 
		? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) * 0.5
		: (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) * 0.5 + 1;
	exports.inBounce = t => 1 - bounce(1 - t);
	exports.outBounce = t => bounce(t);
	exports.inOutBounce = t => t < 0.5 
		? (1 - bounce(1 - 2 * t)) * 0.5
		: (1 + bounce(2 * t - 1)) * 0.5;

	return exports;
})();
},{}],14:[function(require,module,exports){
const { ARRAY_TYPE, EPSILON } = require("./common.js");

/**
 * 2x2 Matrix
 * @module mat2
 */

/**
 * Creates a new identity mat2
 *
 * @returns {mat2} a new 2x2 matrix
 */
exports.create = function() {
	let out = new ARRAY_TYPE(4);
	out[1] = 0;
	out[2] = 0;
	out[0] = 1;
	out[3] = 1;
	return out;
};

/**
 * Creates a new mat2 initialized with values from an existing matrix
 *
 * @param {ReadonlyMat2} a matrix to clone
 * @returns {mat2} a new 2x2 matrix
 */
exports.clone = function(a) {
	let out = new ARRAY_TYPE(4);
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[3];
	return out;
};

/**
 * Copy the values from one mat2 to another
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the source matrix
 * @returns {mat2} out
 */
exports.copy = function(out, a) {
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[3];
	return out;
};

/**
 * Set a mat2 to the identity matrix
 *
 * @param {mat2} out the receiving matrix
 * @returns {mat2} out
 */
exports.identity = function(out) {
	out[0] = 1;
	out[1] = 0;
	out[2] = 0;
	out[3] = 1;
	return out;
};

/**
 * Create a new mat2 with the given values
 *
 * @param {Number} m00 Component in column 0, row 0 position (index 0)
 * @param {Number} m01 Component in column 0, row 1 position (index 1)
 * @param {Number} m10 Component in column 1, row 0 position (index 2)
 * @param {Number} m11 Component in column 1, row 1 position (index 3)
 * @returns {mat2} out A new 2x2 matrix
 */
exports.fromValues = function(m00, m01, m10, m11) {
	let out = new ARRAY_TYPE(4);
	out[0] = m00;
	out[1] = m01;
	out[2] = m10;
	out[3] = m11;
	return out;
};

/**
 * Set the components of a mat2 to the given values
 *
 * @param {mat2} out the receiving matrix
 * @param {Number} m00 Component in column 0, row 0 position (index 0)
 * @param {Number} m01 Component in column 0, row 1 position (index 1)
 * @param {Number} m10 Component in column 1, row 0 position (index 2)
 * @param {Number} m11 Component in column 1, row 1 position (index 3)
 * @returns {mat2} out
 */
exports.set = function(out, m00, m01, m10, m11) {
	out[0] = m00;
	out[1] = m01;
	out[2] = m10;
	out[3] = m11;
	return out;
};

/**
 * Transpose the values of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the source matrix
 * @returns {mat2} out
 */
exports.transpose = function(out, a) {
	// If we are transposing ourselves we can skip a few steps but have to cache
	// some values
	if (out === a) {
		let a1 = a[1];
		out[1] = a[2];
		out[2] = a1;
	} else {
		out[0] = a[0];
		out[1] = a[2];
		out[2] = a[1];
		out[3] = a[3];
	}
	return out;
};

/**
 * Inverts a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the source matrix
 * @returns {mat2} out
 */
exports.invert =  function(out, a) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3];

	// Calculate the determinant
	let det = a0 * a3 - a2 * a1;

	if (!det) {
		return null;
	}
	det = 1.0 / det;

	out[0] = a3 * det;
	out[1] = -a1 * det;
	out[2] = -a2 * det;
	out[3] = a0 * det;

	return out;
};

/**
 * Calculates the adjugate of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the source matrix
 * @returns {mat2} out
 */
exports.adjoint = function(out, a) {
	// Caching this value is necessary if out == a
	let a0 = a[0];
	out[0] = a[3];
	out[1] = -a[1];
	out[2] = -a[2];
	out[3] = a0;

	return out;
};

/**
 * Calculates the determinant of a mat2
 *
 * @param {ReadonlyMat2} a the source matrix
 * @returns {Number} determinant of a
 */
exports.determinant = function(a) {
	return a[0] * a[3] - a[2] * a[1];
};

/**
 * Multiplies two mat2's
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the first operand
 * @param {ReadonlyMat2} b the second operand
 * @returns {mat2} out
 */
exports.multiply = function(out, a, b) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3];
	let b0 = b[0],
		b1 = b[1],
		b2 = b[2],
		b3 = b[3];
	out[0] = a0 * b0 + a2 * b1;
	out[1] = a1 * b0 + a3 * b1;
	out[2] = a0 * b2 + a2 * b3;
	out[3] = a1 * b2 + a3 * b3;
	return out;
};

/**
 * Rotates a mat2 by the given angle
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2} out
 */
exports.rotate = function(out, a, rad) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3];
	let s = Math.sin(rad);
	let c = Math.cos(rad);
	out[0] = a0 * c + a2 * s;
	out[1] = a1 * c + a3 * s;
	out[2] = a0 * -s + a2 * c;
	out[3] = a1 * -s + a3 * c;
	return out;
};

/**
 * Scales the mat2 by the dimensions in the given vec2
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the matrix to rotate
 * @param {ReadonlyVec2} v the vec2 to scale the matrix by
 * @returns {mat2} out
 **/
exports.scale =  function(out, a, v) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3];
	let v0 = v[0],
		v1 = v[1];
	out[0] = a0 * v0;
	out[1] = a1 * v0;
	out[2] = a2 * v1;
	out[3] = a3 * v1;
	return out;
};

/**
 * Creates a matrix from a given angle
 * This is equivalent to (but much faster than):
 *
 *     mat2.identity(dest);
 *     mat2.rotate(dest, dest, rad);
 *
 * @param {mat2} out mat2 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2} out
 */
exports.fromRotation = function(out, rad) {
	let s = Math.sin(rad);
	let c = Math.cos(rad);
	out[0] = c;
	out[1] = s;
	out[2] = -s;
	out[3] = c;
	return out;
};

/**
 * Creates a matrix from a vector scaling
 * This is equivalent to (but much faster than):
 *
 *     mat2.identity(dest);
 *     mat2.scale(dest, dest, vec);
 *
 * @param {mat2} out mat2 receiving operation result
 * @param {ReadonlyVec2} v Scaling vector
 * @returns {mat2} out
 */
exports.fromScaling = function(out, v) {
	out[0] = v[0];
	out[1] = 0;
	out[2] = 0;
	out[3] = v[1];
	return out;
};

/**
 * Returns a string representation of a mat2
 *
 * @param {ReadonlyMat2} a matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
exports.str = function(a) {
	return "mat2(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ")";
};

/**
 * Returns Frobenius norm of a mat2
 *
 * @param {ReadonlyMat2} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */
exports.frob = function(a) {
	return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]);
};

/**
 * Returns L, D and U matrices (Lower triangular, Diagonal and Upper triangular) by factorizing the input matrix
 * @param {ReadonlyMat2} L the lower triangular matrix
 * @param {ReadonlyMat2} D the diagonal matrix
 * @param {ReadonlyMat2} U the upper triangular matrix
 * @param {ReadonlyMat2} a the input matrix to factorize
 */

exports.LDU = function(L, D, U, a) {
	L[2] = a[2] / a[0];
	U[0] = a[0];
	U[1] = a[1];
	U[3] = a[3] - L[2] * U[1];
	return [L, D, U];
};

/**
 * Adds two mat2's
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the first operand
 * @param {ReadonlyMat2} b the second operand
 * @returns {mat2} out
 */
exports.add =  function(out, a, b) {
	out[0] = a[0] + b[0];
	out[1] = a[1] + b[1];
	out[2] = a[2] + b[2];
	out[3] = a[3] + b[3];
	return out;
};

/**
 * Subtracts matrix b from matrix a
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the first operand
 * @param {ReadonlyMat2} b the second operand
 * @returns {mat2} out
 */
exports.subtract =  function(out, a, b) {
	out[0] = a[0] - b[0];
	out[1] = a[1] - b[1];
	out[2] = a[2] - b[2];
	out[3] = a[3] - b[3];
	return out;
};

/**
 * Returns whether or not the matrices have exactly the same elements in the same position (when compared with ===)
 *
 * @param {ReadonlyMat2} a The first matrix.
 * @param {ReadonlyMat2} b The second matrix.
 * @returns {Boolean} True if the matrices are equal, false otherwise.
 */
exports.exactEquals = function(a, b) {
	return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
};

/**
 * Returns whether or not the matrices have approximately the same elements in the same position.
 *
 * @param {ReadonlyMat2} a The first matrix.
 * @param {ReadonlyMat2} b The second matrix.
 * @returns {Boolean} True if the matrices are equal, false otherwise.
 */
exports.equals = function (a, b) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3];
	let b0 = b[0],
		b1 = b[1],
		b2 = b[2],
		b3 = b[3];
	return (
		Math.abs(a0 - b0) <=
		EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
		Math.abs(a1 - b1) <=
		EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) &&
		Math.abs(a2 - b2) <=
		EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2)) &&
		Math.abs(a3 - b3) <=
		EPSILON * Math.max(1.0, Math.abs(a3), Math.abs(b3))
	);
};

/**
 * Multiply each element of the matrix by a scalar.
 *
 * @param {mat2} out the receiving matrix
 * @param {ReadonlyMat2} a the matrix to scale
 * @param {Number} b amount to scale the matrix's elements by
 * @returns {mat2} out
 */
exports.multiplyScalar = function(out, a, b) {
	out[0] = a[0] * b;
	out[1] = a[1] * b;
	out[2] = a[2] * b;
	out[3] = a[3] * b;
	return out;
};

/**
 * Adds two mat2's after multiplying each element of the second operand by a scalar value.
 *
 * @param {mat2} out the receiving vector
 * @param {ReadonlyMat2} a the first operand
 * @param {ReadonlyMat2} b the second operand
 * @param {Number} scale the amount to scale b's elements by before adding
 * @returns {mat2} out
 */
exports.multiplyScalarAndAdd = function(out, a, b, scale) {
	out[0] = a[0] + b[0] * scale;
	out[1] = a[1] + b[1] * scale;
	out[2] = a[2] + b[2] * scale;
	out[3] = a[3] + b[3] * scale;
	return out;
};

/**
 * Alias for {@link mat2.multiply}
 * @function
 */
exports.mul = exports.multiply;

/**
 * Alias for {@link mat2.subtract}
 * @function
 */
exports.sub = exports.subtract;

/**
 * mat2 pool for minimising garbage allocation 
 */
exports.Pool = (function(){
	let stack = [];
	for (let i = 0; i < 5; i++) {
		stack.push(exports.create());
	}
	
	return {
		/**
		 * return a borrowed mat2 to the pool
		 * @param {mat2}
		 */
		return: (v) => { stack.push(exports.identity(v)); },
		/**
		 * request a mat2 from the pool
		 * @returns {mat2}
		 */
		request: () => {
			if (stack.length > 0) {
				return stack.pop();
			}
			return exports.create();
		}
	}
})();

exports.IDENTITY = Object.freeze(exports.create());
},{"./common.js":12}],15:[function(require,module,exports){
const { ARRAY_TYPE, EPSILON } = require("./common.js");

/**
 * 3x3 Matrix
 * @module mat3
 */

/**
 * Creates a new identity mat3
 *
 * @returns {mat3} a new 3x3 matrix
 */
exports.create = function() {
	let out = new ARRAY_TYPE(9);
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[5] = 0;
	out[6] = 0;
	out[7] = 0;
	out[0] = 1;
	out[4] = 1;
	out[8] = 1;
	return out;
};

/**
 * Copies the upper-left 3x3 values into the given mat3.
 *
 * @param {mat3} out the receiving 3x3 matrix
 * @param {ReadonlyMat4} a   the source 4x4 matrix
 * @returns {mat3} out
 */
exports.fromMat4 = function(out, a) {
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[4];
	out[4] = a[5];
	out[5] = a[6];
	out[6] = a[8];
	out[7] = a[9];
	out[8] = a[10];
	return out;
};

/**
 * Creates a new mat3 initialized with values from an existing matrix
 *
 * @param {ReadonlyMat3} a matrix to clone
 * @returns {mat3} a new 3x3 matrix
 */
exports.clone = function(a) {
	let out = new ARRAY_TYPE(9);
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[3];
	out[4] = a[4];
	out[5] = a[5];
	out[6] = a[6];
	out[7] = a[7];
	out[8] = a[8];
	return out;
};

/**
 * Copy the values from one mat3 to another
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the source matrix
 * @returns {mat3} out
 */
exports.copy = function(out, a) {
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[3];
	out[4] = a[4];
	out[5] = a[5];
	out[6] = a[6];
	out[7] = a[7];
	out[8] = a[8];
	return out;
};

/**
 * Create a new mat3 with the given values
 *
 * @param {Number} m00 Component in column 0, row 0 position (index 0)
 * @param {Number} m01 Component in column 0, row 1 position (index 1)
 * @param {Number} m02 Component in column 0, row 2 position (index 2)
 * @param {Number} m10 Component in column 1, row 0 position (index 3)
 * @param {Number} m11 Component in column 1, row 1 position (index 4)
 * @param {Number} m12 Component in column 1, row 2 position (index 5)
 * @param {Number} m20 Component in column 2, row 0 position (index 6)
 * @param {Number} m21 Component in column 2, row 1 position (index 7)
 * @param {Number} m22 Component in column 2, row 2 position (index 8)
 * @returns {mat3} A new mat3
 */
exports.fromValues = function(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
	let out = new ARRAY_TYPE(9);
	out[0] = m00;
	out[1] = m01;
	out[2] = m02;
	out[3] = m10;
	out[4] = m11;
	out[5] = m12;
	out[6] = m20;
	out[7] = m21;
	out[8] = m22;
	return out;
};

/**
 * Set the components of a mat3 to the given values
 *
 * @param {mat3} out the receiving matrix
 * @param {Number} m00 Component in column 0, row 0 position (index 0)
 * @param {Number} m01 Component in column 0, row 1 position (index 1)
 * @param {Number} m02 Component in column 0, row 2 position (index 2)
 * @param {Number} m10 Component in column 1, row 0 position (index 3)
 * @param {Number} m11 Component in column 1, row 1 position (index 4)
 * @param {Number} m12 Component in column 1, row 2 position (index 5)
 * @param {Number} m20 Component in column 2, row 0 position (index 6)
 * @param {Number} m21 Component in column 2, row 1 position (index 7)
 * @param {Number} m22 Component in column 2, row 2 position (index 8)
 * @returns {mat3} out
 */
exports.set = function(out, m00, m01, m02, m10, m11, m12, m20, m21, m22) {
	out[0] = m00;
	out[1] = m01;
	out[2] = m02;
	out[3] = m10;
	out[4] = m11;
	out[5] = m12;
	out[6] = m20;
	out[7] = m21;
	out[8] = m22;
	return out;
};

/**
 * Set a mat3 to the identity matrix
 *
 * @param {mat3} out the receiving matrix
 * @returns {mat3} out
 */
exports.identity = function(out) {
	out[0] = 1;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 1;
	out[5] = 0;
	out[6] = 0;
	out[7] = 0;
	out[8] = 1;
	return out;
};

/**
 * Transpose the values of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the source matrix
 * @returns {mat3} out
 */
exports.transpose = function(out, a) {
	// If we are transposing ourselves we can skip a few steps but have to cache some values
	if (out === a) {
		let a01 = a[1],
			a02 = a[2],
			a12 = a[5];
		out[1] = a[3];
		out[2] = a[6];
		out[3] = a01;
		out[5] = a[7];
		out[6] = a02;
		out[7] = a12;
	} else {
		out[0] = a[0];
		out[1] = a[3];
		out[2] = a[6];
		out[3] = a[1];
		out[4] = a[4];
		out[5] = a[7];
		out[6] = a[2];
		out[7] = a[5];
		out[8] = a[8];
	}

	return out;
};

/**
 * Inverts a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the source matrix
 * @returns {mat3} out
 */
exports.invert = function(out, a) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2];
	let a10 = a[3],
		a11 = a[4],
		a12 = a[5];
	let a20 = a[6],
		a21 = a[7],
		a22 = a[8];

	let b01 = a22 * a11 - a12 * a21;
	let b11 = -a22 * a10 + a12 * a20;
	let b21 = a21 * a10 - a11 * a20;

	// Calculate the determinant
	let det = a00 * b01 + a01 * b11 + a02 * b21;

	if (!det) {
		return null;
	}
	det = 1.0 / det;

	out[0] = b01 * det;
	out[1] = (-a22 * a01 + a02 * a21) * det;
	out[2] = (a12 * a01 - a02 * a11) * det;
	out[3] = b11 * det;
	out[4] = (a22 * a00 - a02 * a20) * det;
	out[5] = (-a12 * a00 + a02 * a10) * det;
	out[6] = b21 * det;
	out[7] = (-a21 * a00 + a01 * a20) * det;
	out[8] = (a11 * a00 - a01 * a10) * det;
	return out;
};

/**
 * Calculates the adjugate of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the source matrix
 * @returns {mat3} out
 */
exports.adjoint = function(out, a) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2];
	let a10 = a[3],
		a11 = a[4],
		a12 = a[5];
	let a20 = a[6],
		a21 = a[7],
		a22 = a[8];

	out[0] = a11 * a22 - a12 * a21;
	out[1] = a02 * a21 - a01 * a22;
	out[2] = a01 * a12 - a02 * a11;
	out[3] = a12 * a20 - a10 * a22;
	out[4] = a00 * a22 - a02 * a20;
	out[5] = a02 * a10 - a00 * a12;
	out[6] = a10 * a21 - a11 * a20;
	out[7] = a01 * a20 - a00 * a21;
	out[8] = a00 * a11 - a01 * a10;
	return out;
};

/**
 * Calculates the determinant of a mat3
 *
 * @param {ReadonlyMat3} a the source matrix
 * @returns {Number} determinant of a
 */
exports.determinant = function(a) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2];
	let a10 = a[3],
		a11 = a[4],
		a12 = a[5];
	let a20 = a[6],
		a21 = a[7],
		a22 = a[8];

	return (
		a00 * (a22 * a11 - a12 * a21) +
		a01 * (-a22 * a10 + a12 * a20) +
		a02 * (a21 * a10 - a11 * a20)
	);
};

/**
 * Multiplies two mat3's
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the first operand
 * @param {ReadonlyMat3} b the second operand
 * @returns {mat3} out
 */
exports.multiply = function(out, a, b) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2];
	let a10 = a[3],
		a11 = a[4],
		a12 = a[5];
	let a20 = a[6],
		a21 = a[7],
		a22 = a[8];

	let b00 = b[0],
		b01 = b[1],
		b02 = b[2];
	let b10 = b[3],
		b11 = b[4],
		b12 = b[5];
	let b20 = b[6],
		b21 = b[7],
		b22 = b[8];

	out[0] = b00 * a00 + b01 * a10 + b02 * a20;
	out[1] = b00 * a01 + b01 * a11 + b02 * a21;
	out[2] = b00 * a02 + b01 * a12 + b02 * a22;

	out[3] = b10 * a00 + b11 * a10 + b12 * a20;
	out[4] = b10 * a01 + b11 * a11 + b12 * a21;
	out[5] = b10 * a02 + b11 * a12 + b12 * a22;

	out[6] = b20 * a00 + b21 * a10 + b22 * a20;
	out[7] = b20 * a01 + b21 * a11 + b22 * a21;
	out[8] = b20 * a02 + b21 * a12 + b22 * a22;
	return out;
};

/**
 * Translate a mat3 by the given vector
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the matrix to translate
 * @param {ReadonlyVec2} v vector to translate by
 * @returns {mat3} out
 */
exports.translate = function(out, a, v) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2],
		a10 = a[3],
		a11 = a[4],
		a12 = a[5],
		a20 = a[6],
		a21 = a[7],
		a22 = a[8],
		x = v[0],
		y = v[1];

	out[0] = a00;
	out[1] = a01;
	out[2] = a02;

	out[3] = a10;
	out[4] = a11;
	out[5] = a12;

	out[6] = x * a00 + y * a10 + a20;
	out[7] = x * a01 + y * a11 + a21;
	out[8] = x * a02 + y * a12 + a22;
	return out;
};

/**
 * Rotates a mat3 by the given angle
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat3} out
 */
exports.rotate = function(out, a, rad) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2],
		a10 = a[3],
		a11 = a[4],
		a12 = a[5],
		a20 = a[6],
		a21 = a[7],
		a22 = a[8],
		s = Math.sin(rad),
		c = Math.cos(rad);

	out[0] = c * a00 + s * a10;
	out[1] = c * a01 + s * a11;
	out[2] = c * a02 + s * a12;

	out[3] = c * a10 - s * a00;
	out[4] = c * a11 - s * a01;
	out[5] = c * a12 - s * a02;

	out[6] = a20;
	out[7] = a21;
	out[8] = a22;
	return out;
};

/**
 * Scales the mat3 by the dimensions in the given vec2
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the matrix to scale
 * @param {ReadonlyVec2} v the vec2 to scale the matrix by
 * @returns {mat3} out
 **/
exports.scale = function(out, a, v) {
	let x = v[0],
		y = v[1];

	out[0] = x * a[0];
	out[1] = x * a[1];
	out[2] = x * a[2];

	out[3] = y * a[3];
	out[4] = y * a[4];
	out[5] = y * a[5];

	out[6] = a[6];
	out[7] = a[7];
	out[8] = a[8];
	return out;
};

/**
 * Creates a matrix from a vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat3.identity(dest);
 *     mat3.translate(dest, dest, vec);
 *
 * @param {mat3} out mat3 receiving operation result
 * @param {ReadonlyVec2} v Translation vector
 * @returns {mat3} out
 */
exports.fromTranslation = function(out, v) {
	out[0] = 1;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 1;
	out[5] = 0;
	out[6] = v[0];
	out[7] = v[1];
	out[8] = 1;
	return out;
};

/**
 * Creates a matrix from a given angle
 * This is equivalent to (but much faster than):
 *
 *     mat3.identity(dest);
 *     mat3.rotate(dest, dest, rad);
 *
 * @param {mat3} out mat3 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat3} out
 */
exports.fromRotation = function(out, rad) {
	let s = Math.sin(rad),
		c = Math.cos(rad);

	out[0] = c;
	out[1] = s;
	out[2] = 0;

	out[3] = -s;
	out[4] = c;
	out[5] = 0;

	out[6] = 0;
	out[7] = 0;
	out[8] = 1;
	return out;
};

/**
 * Creates a matrix from a vector scaling
 * This is equivalent to (but much faster than):
 *
 *     mat3.identity(dest);
 *     mat3.scale(dest, dest, vec);
 *
 * @param {mat3} out mat3 receiving operation result
 * @param {ReadonlyVec2} v Scaling vector
 * @returns {mat3} out
 */
exports.fromScaling = function(out, v) {
	out[0] = v[0];
	out[1] = 0;
	out[2] = 0;

	out[3] = 0;
	out[4] = v[1];
	out[5] = 0;

	out[6] = 0;
	out[7] = 0;
	out[8] = 1;
	return out;
};

/**
 * Copies the values from a mat2d into a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat2d} a the matrix to copy
 * @returns {mat3} out
 **/
exports.fromMat2d = function(out, a) {
	out[0] = a[0];
	out[1] = a[1];
	out[2] = 0;

	out[3] = a[2];
	out[4] = a[3];
	out[5] = 0;

	out[6] = a[4];
	out[7] = a[5];
	out[8] = 1;
	return out;
};

/**
 * Calculates a 3x3 matrix from the given quaternion
 *
 * @param {mat3} out mat3 receiving operation result
 * @param {ReadonlyQuat} q Quaternion to create matrix from
 *
 * @returns {mat3} out
 */
exports.fromQuat = function(out, q) {
	let x = q[0],
		y = q[1],
		z = q[2],
		w = q[3];
	let x2 = x + x;
	let y2 = y + y;
	let z2 = z + z;

	let xx = x * x2;
	let yx = y * x2;
	let yy = y * y2;
	let zx = z * x2;
	let zy = z * y2;
	let zz = z * z2;
	let wx = w * x2;
	let wy = w * y2;
	let wz = w * z2;

	out[0] = 1 - yy - zz;
	out[3] = yx - wz;
	out[6] = zx + wy;

	out[1] = yx + wz;
	out[4] = 1 - xx - zz;
	out[7] = zy - wx;

	out[2] = zx - wy;
	out[5] = zy + wx;
	out[8] = 1 - xx - yy;

	return out;
};

/**
 * Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
 *
 * @param {mat3} out mat3 receiving operation result
 * @param {ReadonlyMat4} a Mat4 to derive the normal matrix from
 *
 * @returns {mat3} out
 */
exports.normalFromMat4 = function(out, a) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2],
		a03 = a[3];
	let a10 = a[4],
		a11 = a[5],
		a12 = a[6],
		a13 = a[7];
	let a20 = a[8],
		a21 = a[9],
		a22 = a[10],
		a23 = a[11];
	let a30 = a[12],
		a31 = a[13],
		a32 = a[14],
		a33 = a[15];

	let b00 = a00 * a11 - a01 * a10;
	let b01 = a00 * a12 - a02 * a10;
	let b02 = a00 * a13 - a03 * a10;
	let b03 = a01 * a12 - a02 * a11;
	let b04 = a01 * a13 - a03 * a11;
	let b05 = a02 * a13 - a03 * a12;
	let b06 = a20 * a31 - a21 * a30;
	let b07 = a20 * a32 - a22 * a30;
	let b08 = a20 * a33 - a23 * a30;
	let b09 = a21 * a32 - a22 * a31;
	let b10 = a21 * a33 - a23 * a31;
	let b11 = a22 * a33 - a23 * a32;

	// Calculate the determinant
	let det =
		b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

	if (!det) {
		return null;
	}
	det = 1.0 / det;

	out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
	out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
	out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;

	out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
	out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
	out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;

	out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
	out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
	out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;

	return out;
};

/**
 * Generates a 2D projection matrix with the given bounds
 *
 * @param {mat3} out mat3 frustum matrix will be written into
 * @param {number} width Width of your gl context
 * @param {number} height Height of gl context
 * @returns {mat3} out
 */
exports.projection = function(out, width, height) {
	out[0] = 2 / width;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = -2 / height;
	out[5] = 0;
	out[6] = -1;
	out[7] = 1;
	out[8] = 1;
	return out;
};

/**
 * Returns a string representation of a mat3
 *
 * @param {ReadonlyMat3} a matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
exports.str = function(a) {
	return (
		"mat3(" +
		a[0] +
		", " +
		a[1] +
		", " +
		a[2] +
		", " +
		a[3] +
		", " +
		a[4] +
		", " +
		a[5] +
		", " +
		a[6] +
		", " +
		a[7] +
		", " +
		a[8] +
		")"
	);
};

/**
 * Returns Frobenius norm of a mat3
 *
 * @param {ReadonlyMat3} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */
exports.frob = function(a) {
	return Math.sqrt(
		a[0] * a[0] +
		a[1] * a[1] +
		a[2] * a[2] +
		a[3] * a[3] +
		a[4] * a[4] +
		a[5] * a[5] +
		a[6] * a[6] +
		a[7] * a[7] +
		a[8] * a[8]
	);
};

/**
 * Adds two mat3's
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the first operand
 * @param {ReadonlyMat3} b the second operand
 * @returns {mat3} out
 */
exports.add = function(out, a, b) {
	out[0] = a[0] + b[0];
	out[1] = a[1] + b[1];
	out[2] = a[2] + b[2];
	out[3] = a[3] + b[3];
	out[4] = a[4] + b[4];
	out[5] = a[5] + b[5];
	out[6] = a[6] + b[6];
	out[7] = a[7] + b[7];
	out[8] = a[8] + b[8];
	return out;
};

/**
 * Subtracts matrix b from matrix a
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the first operand
 * @param {ReadonlyMat3} b the second operand
 * @returns {mat3} out
 */
exports.subtract = function(out, a, b) {
	out[0] = a[0] - b[0];
	out[1] = a[1] - b[1];
	out[2] = a[2] - b[2];
	out[3] = a[3] - b[3];
	out[4] = a[4] - b[4];
	out[5] = a[5] - b[5];
	out[6] = a[6] - b[6];
	out[7] = a[7] - b[7];
	out[8] = a[8] - b[8];
	return out;
};

/**
 * Multiply each element of the matrix by a scalar.
 *
 * @param {mat3} out the receiving matrix
 * @param {ReadonlyMat3} a the matrix to scale
 * @param {Number} b amount to scale the matrix's elements by
 * @returns {mat3} out
 */
exports.multiplyScalar = function(out, a, b) {
	out[0] = a[0] * b;
	out[1] = a[1] * b;
	out[2] = a[2] * b;
	out[3] = a[3] * b;
	out[4] = a[4] * b;
	out[5] = a[5] * b;
	out[6] = a[6] * b;
	out[7] = a[7] * b;
	out[8] = a[8] * b;
	return out;
};

/**
 * Adds two mat3's after multiplying each element of the second operand by a scalar value.
 *
 * @param {mat3} out the receiving vector
 * @param {ReadonlyMat3} a the first operand
 * @param {ReadonlyMat3} b the second operand
 * @param {Number} scale the amount to scale b's elements by before adding
 * @returns {mat3} out
 */
exports.multiplyScalarAndAdd = function(out, a, b, scale) {
	out[0] = a[0] + b[0] * scale;
	out[1] = a[1] + b[1] * scale;
	out[2] = a[2] + b[2] * scale;
	out[3] = a[3] + b[3] * scale;
	out[4] = a[4] + b[4] * scale;
	out[5] = a[5] + b[5] * scale;
	out[6] = a[6] + b[6] * scale;
	out[7] = a[7] + b[7] * scale;
	out[8] = a[8] + b[8] * scale;
	return out;
};

/**
 * Returns whether or not the matrices have exactly the same elements in the same position (when compared with ===)
 *
 * @param {ReadonlyMat3} a The first matrix.
 * @param {ReadonlyMat3} b The second matrix.
 * @returns {Boolean} True if the matrices are equal, false otherwise.
 */
exports.exactEquals = function(a, b) {
	return (
		a[0] === b[0] &&
		a[1] === b[1] &&
		a[2] === b[2] &&
		a[3] === b[3] &&
		a[4] === b[4] &&
		a[5] === b[5] &&
		a[6] === b[6] &&
		a[7] === b[7] &&
		a[8] === b[8]
	);
};

/**
 * Returns whether or not the matrices have approximately the same elements in the same position.
 *
 * @param {ReadonlyMat3} a The first matrix.
 * @param {ReadonlyMat3} b The second matrix.
 * @returns {Boolean} True if the matrices are equal, false otherwise.
 */
exports.equals = function(a, b) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3],
		a4 = a[4],
		a5 = a[5],
		a6 = a[6],
		a7 = a[7],
		a8 = a[8];
	let b0 = b[0],
		b1 = b[1],
		b2 = b[2],
		b3 = b[3],
		b4 = b[4],
		b5 = b[5],
		b6 = b[6],
		b7 = b[7],
		b8 = b[8];
	return (
		Math.abs(a0 - b0) <=
			EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
		Math.abs(a1 - b1) <=
			EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) &&
		Math.abs(a2 - b2) <=
			EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2)) &&
		Math.abs(a3 - b3) <=
			EPSILON * Math.max(1.0, Math.abs(a3), Math.abs(b3)) &&
		Math.abs(a4 - b4) <=
			EPSILON * Math.max(1.0, Math.abs(a4), Math.abs(b4)) &&
		Math.abs(a5 - b5) <=
			EPSILON * Math.max(1.0, Math.abs(a5), Math.abs(b5)) &&
		Math.abs(a6 - b6) <=
			EPSILON * Math.max(1.0, Math.abs(a6), Math.abs(b6)) &&
		Math.abs(a7 - b7) <=
			EPSILON * Math.max(1.0, Math.abs(a7), Math.abs(b7)) &&
		Math.abs(a8 - b8) <=
			EPSILON * Math.max(1.0, Math.abs(a8), Math.abs(b8))
	);
};

/**
 * Alias for {@link mat3.multiply}
 * @function
 */
exports.mul = exports.multiply;

/**
 * Alias for {@link mat3.subtract}
 * @function
 */
exports.sub = exports.subtract;

/**
 * mat3 pool for minimising garbage allocation 
 */
exports.Pool = (function(){
	let stack = [];
	for (let i = 0; i < 5; i++) {
		stack.push(exports.create());
	}
	
	return {
		/**
		 * return a borrowed mat3 to the pool
		 * @param {mat3}
		 */
		return: (m) => { stack.push(exports.identity(m)); },
		/**
		 * request a mat3 from the pool
		 * @returns {mat3}
		 */
		request: () => {
			if (stack.length > 0) {
				return stack.pop();
			}
			return exports.create();
		}
	}
})();

exports.IDENTITY = Object.freeze(exports.create());
},{"./common.js":12}],16:[function(require,module,exports){
const { ARRAY_TYPE, EPSILON } = require("./common.js");

/**
 * 4x4 Matrix<br>
 * Format: column-major, when typed out it looks like row-major<br>
 * The matrices are being post multiplied.
 * @module mat4
 */

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */
exports.create = function() {
	let out = new ARRAY_TYPE(16);
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[11] = 0;
	out[12] = 0;
	out[13] = 0;
	out[14] = 0;
	out[0] = 1;
	out[5] = 1;
	out[10] = 1;
	out[15] = 1;
	return out;
};

/**
 * Creates a new mat4 initialized with values from an existing matrix
 *
 * @param {ReadonlyMat4} a matrix to clone
 * @returns {mat4} a new 4x4 matrix
 */
exports.clone = function(a) {
	let out = new ARRAY_TYPE(16);
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[3];
	out[4] = a[4];
	out[5] = a[5];
	out[6] = a[6];
	out[7] = a[7];
	out[8] = a[8];
	out[9] = a[9];
	out[10] = a[10];
	out[11] = a[11];
	out[12] = a[12];
	out[13] = a[13];
	out[14] = a[14];
	out[15] = a[15];
	return out;
};

/**
 * Copy the values from one mat4 to another
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the source matrix
 * @returns {mat4} out
 */
exports.copy = function(out, a) {
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[3];
	out[4] = a[4];
	out[5] = a[5];
	out[6] = a[6];
	out[7] = a[7];
	out[8] = a[8];
	out[9] = a[9];
	out[10] = a[10];
	out[11] = a[11];
	out[12] = a[12];
	out[13] = a[13];
	out[14] = a[14];
	out[15] = a[15];
	return out;
};

/**
 * Create a new mat4 with the given values
 *
 * @param {Number} m00 Component in column 0, row 0 position (index 0)
 * @param {Number} m01 Component in column 0, row 1 position (index 1)
 * @param {Number} m02 Component in column 0, row 2 position (index 2)
 * @param {Number} m03 Component in column 0, row 3 position (index 3)
 * @param {Number} m10 Component in column 1, row 0 position (index 4)
 * @param {Number} m11 Component in column 1, row 1 position (index 5)
 * @param {Number} m12 Component in column 1, row 2 position (index 6)
 * @param {Number} m13 Component in column 1, row 3 position (index 7)
 * @param {Number} m20 Component in column 2, row 0 position (index 8)
 * @param {Number} m21 Component in column 2, row 1 position (index 9)
 * @param {Number} m22 Component in column 2, row 2 position (index 10)
 * @param {Number} m23 Component in column 2, row 3 position (index 11)
 * @param {Number} m30 Component in column 3, row 0 position (index 12)
 * @param {Number} m31 Component in column 3, row 1 position (index 13)
 * @param {Number} m32 Component in column 3, row 2 position (index 14)
 * @param {Number} m33 Component in column 3, row 3 position (index 15)
 * @returns {mat4} A new mat4
 */
exports.fromValues = function(
	m00,
	m01,
	m02,
	m03,
	m10,
	m11,
	m12,
	m13,
	m20,
	m21,
	m22,
	m23,
	m30,
	m31,
	m32,
	m33
) {
	let out = new ARRAY_TYPE(16);
	out[0] = m00;
	out[1] = m01;
	out[2] = m02;
	out[3] = m03;
	out[4] = m10;
	out[5] = m11;
	out[6] = m12;
	out[7] = m13;
	out[8] = m20;
	out[9] = m21;
	out[10] = m22;
	out[11] = m23;
	out[12] = m30;
	out[13] = m31;
	out[14] = m32;
	out[15] = m33;
	return out;
};

/**
 * Set the components of a mat4 to the given values
 *
 * @param {mat4} out the receiving matrix
 * @param {Number} m00 Component in column 0, row 0 position (index 0)
 * @param {Number} m01 Component in column 0, row 1 position (index 1)
 * @param {Number} m02 Component in column 0, row 2 position (index 2)
 * @param {Number} m03 Component in column 0, row 3 position (index 3)
 * @param {Number} m10 Component in column 1, row 0 position (index 4)
 * @param {Number} m11 Component in column 1, row 1 position (index 5)
 * @param {Number} m12 Component in column 1, row 2 position (index 6)
 * @param {Number} m13 Component in column 1, row 3 position (index 7)
 * @param {Number} m20 Component in column 2, row 0 position (index 8)
 * @param {Number} m21 Component in column 2, row 1 position (index 9)
 * @param {Number} m22 Component in column 2, row 2 position (index 10)
 * @param {Number} m23 Component in column 2, row 3 position (index 11)
 * @param {Number} m30 Component in column 3, row 0 position (index 12)
 * @param {Number} m31 Component in column 3, row 1 position (index 13)
 * @param {Number} m32 Component in column 3, row 2 position (index 14)
 * @param {Number} m33 Component in column 3, row 3 position (index 15)
 * @returns {mat4} out
 */
exports.set = function(
	out,
	m00,
	m01,
	m02,
	m03,
	m10,
	m11,
	m12,
	m13,
	m20,
	m21,
	m22,
	m23,
	m30,
	m31,
	m32,
	m33
) {
	out[0] = m00;
	out[1] = m01;
	out[2] = m02;
	out[3] = m03;
	out[4] = m10;
	out[5] = m11;
	out[6] = m12;
	out[7] = m13;
	out[8] = m20;
	out[9] = m21;
	out[10] = m22;
	out[11] = m23;
	out[12] = m30;
	out[13] = m31;
	out[14] = m32;
	out[15] = m33;
	return out;
};

const identity = 
/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */
exports.identity = function(out) {
	out[0] = 1;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = 1;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[10] = 1;
	out[11] = 0;
	out[12] = 0;
	out[13] = 0;
	out[14] = 0;
	out[15] = 1;
	return out;
};

/**
 * Transpose the values of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the source matrix
 * @returns {mat4} out
 */
exports.transpose = function(out, a) {
	// If we are transposing ourselves we can skip a few steps but have to cache some values
	if (out === a) {
		let a01 = a[1],
			a02 = a[2],
			a03 = a[3];
		let a12 = a[6],
			a13 = a[7];
		let a23 = a[11];

		out[1] = a[4];
		out[2] = a[8];
		out[3] = a[12];
		out[4] = a01;
		out[6] = a[9];
		out[7] = a[13];
		out[8] = a02;
		out[9] = a12;
		out[11] = a[14];
		out[12] = a03;
		out[13] = a13;
		out[14] = a23;
	} else {
		out[0] = a[0];
		out[1] = a[4];
		out[2] = a[8];
		out[3] = a[12];
		out[4] = a[1];
		out[5] = a[5];
		out[6] = a[9];
		out[7] = a[13];
		out[8] = a[2];
		out[9] = a[6];
		out[10] = a[10];
		out[11] = a[14];
		out[12] = a[3];
		out[13] = a[7];
		out[14] = a[11];
		out[15] = a[15];
	}

	return out;
};

/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the source matrix
 * @returns {mat4} out
 */
exports.invert = function(out, a) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2],
		a03 = a[3];
	let a10 = a[4],
		a11 = a[5],
		a12 = a[6],
		a13 = a[7];
	let a20 = a[8],
		a21 = a[9],
		a22 = a[10],
		a23 = a[11];
	let a30 = a[12],
		a31 = a[13],
		a32 = a[14],
		a33 = a[15];

	let b00 = a00 * a11 - a01 * a10;
	let b01 = a00 * a12 - a02 * a10;
	let b02 = a00 * a13 - a03 * a10;
	let b03 = a01 * a12 - a02 * a11;
	let b04 = a01 * a13 - a03 * a11;
	let b05 = a02 * a13 - a03 * a12;
	let b06 = a20 * a31 - a21 * a30;
	let b07 = a20 * a32 - a22 * a30;
	let b08 = a20 * a33 - a23 * a30;
	let b09 = a21 * a32 - a22 * a31;
	let b10 = a21 * a33 - a23 * a31;
	let b11 = a22 * a33 - a23 * a32;

	// Calculate the determinant
	let det =
		b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

	if (!det) {
		return null;
	}
	det = 1.0 / det;

	out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
	out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
	out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
	out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
	out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
	out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
	out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
	out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
	out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
	out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
	out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
	out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
	out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
	out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
	out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
	out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

	return out;
};

/**
 * Calculates the adjugate of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the source matrix
 * @returns {mat4} out
 */
exports.adjoint = function(out, a) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2],
		a03 = a[3];
	let a10 = a[4],
		a11 = a[5],
		a12 = a[6],
		a13 = a[7];
	let a20 = a[8],
		a21 = a[9],
		a22 = a[10],
		a23 = a[11];
	let a30 = a[12],
		a31 = a[13],
		a32 = a[14],
		a33 = a[15];

	let b00 = a00 * a11 - a01 * a10;
	let b01 = a00 * a12 - a02 * a10;
	let b02 = a00 * a13 - a03 * a10;
	let b03 = a01 * a12 - a02 * a11;
	let b04 = a01 * a13 - a03 * a11;
	let b05 = a02 * a13 - a03 * a12;
	let b06 = a20 * a31 - a21 * a30;
	let b07 = a20 * a32 - a22 * a30;
	let b08 = a20 * a33 - a23 * a30;
	let b09 = a21 * a32 - a22 * a31;
	let b10 = a21 * a33 - a23 * a31;
	let b11 = a22 * a33 - a23 * a32;

	out[0] = a11 * b11 - a12 * b10 + a13 * b09;
	out[1] = a02 * b10 - a01 * b11 - a03 * b09;
	out[2] = a31 * b05 - a32 * b04 + a33 * b03;
	out[3] = a22 * b04 - a21 * b05 - a23 * b03;
	out[4] = a12 * b08 - a10 * b11 - a13 * b07;
	out[5] = a00 * b11 - a02 * b08 + a03 * b07;
	out[6] = a32 * b02 - a30 * b05 - a33 * b01;
	out[7] = a20 * b05 - a22 * b02 + a23 * b01;
	out[8] = a10 * b10 - a11 * b08 + a13 * b06;
	out[9] = a01 * b08 - a00 * b10 - a03 * b06;
	out[10] = a30 * b04 - a31 * b02 + a33 * b00;
	out[11] = a21 * b02 - a20 * b04 - a23 * b00;
	out[12] = a11 * b07 - a10 * b09 - a12 * b06;
	out[13] = a00 * b09 - a01 * b07 + a02 * b06;
	out[14] = a31 * b01 - a30 * b03 - a32 * b00;
	out[15] = a20 * b03 - a21 * b01 + a22 * b00;
	return out;
};

/**
 * Calculates the determinant of a mat4
 *
 * @param {ReadonlyMat4} a the source matrix
 * @returns {Number} determinant of a
 */
exports.determinant = function(a) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2],
		a03 = a[3];
	let a10 = a[4],
		a11 = a[5],
		a12 = a[6],
		a13 = a[7];
	let a20 = a[8],
		a21 = a[9],
		a22 = a[10],
		a23 = a[11];
	let a30 = a[12],
		a31 = a[13],
		a32 = a[14],
		a33 = a[15];

	let b0 = a00 * a11 - a01 * a10;
	let b1 = a00 * a12 - a02 * a10;
	let b2 = a01 * a12 - a02 * a11;
	let b3 = a20 * a31 - a21 * a30;
	let b4 = a20 * a32 - a22 * a30;
	let b5 = a21 * a32 - a22 * a31;
	let b6 = a00 * b5 - a01 * b4 + a02 * b3;
	let b7 = a10 * b5 - a11 * b4 + a12 * b3;
	let b8 = a20 * b2 - a21 * b1 + a22 * b0;
	let b9 = a30 * b2 - a31 * b1 + a32 * b0;

	// Calculate the determinant
	return a13 * b6 - a03 * b7 + a33 * b8 - a23 * b9;
};

/**
 * Multiplies two mat4s
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the first operand
 * @param {ReadonlyMat4} b the second operand
 * @returns {mat4} out
 */
exports.multiply = function(out, a, b) {
	let a00 = a[0],
		a01 = a[1],
		a02 = a[2],
		a03 = a[3];
	let a10 = a[4],
		a11 = a[5],
		a12 = a[6],
		a13 = a[7];
	let a20 = a[8],
		a21 = a[9],
		a22 = a[10],
		a23 = a[11];
	let a30 = a[12],
		a31 = a[13],
		a32 = a[14],
		a33 = a[15];

	// Cache only the current line of the second matrix
	let b0 = b[0],
		b1 = b[1],
		b2 = b[2],
		b3 = b[3];
	out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

	b0 = b[4];
	b1 = b[5];
	b2 = b[6];
	b3 = b[7];
	out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

	b0 = b[8];
	b1 = b[9];
	b2 = b[10];
	b3 = b[11];
	out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

	b0 = b[12];
	b1 = b[13];
	b2 = b[14];
	b3 = b[15];
	out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
	out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
	out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
	out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
	return out;
};

/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to translate
 * @param {ReadonlyVec3} v vector to translate by
 * @returns {mat4} out
 */
exports.translate = function(out, a, v) {
	let x = v[0],
		y = v[1],
		z = v[2];
	let a00, a01, a02, a03;
	let a10, a11, a12, a13;
	let a20, a21, a22, a23;

	if (a === out) {
		out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
		out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
		out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
		out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
	} else {
		a00 = a[0];
		a01 = a[1];
		a02 = a[2];
		a03 = a[3];
		a10 = a[4];
		a11 = a[5];
		a12 = a[6];
		a13 = a[7];
		a20 = a[8];
		a21 = a[9];
		a22 = a[10];
		a23 = a[11];

		out[0] = a00;
		out[1] = a01;
		out[2] = a02;
		out[3] = a03;
		out[4] = a10;
		out[5] = a11;
		out[6] = a12;
		out[7] = a13;
		out[8] = a20;
		out[9] = a21;
		out[10] = a22;
		out[11] = a23;

		out[12] = a00 * x + a10 * y + a20 * z + a[12];
		out[13] = a01 * x + a11 * y + a21 * z + a[13];
		out[14] = a02 * x + a12 * y + a22 * z + a[14];
		out[15] = a03 * x + a13 * y + a23 * z + a[15];
	}

	return out;
};

/**
 * Scales the mat4 by the dimensions in the given vec3 not using vectorization
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to scale
 * @param {ReadonlyVec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/
exports.scale = function(out, a, v) {
	let x = v[0],
		y = v[1],
		z = v[2];

	out[0] = a[0] * x;
	out[1] = a[1] * x;
	out[2] = a[2] * x;
	out[3] = a[3] * x;
	out[4] = a[4] * y;
	out[5] = a[5] * y;
	out[6] = a[6] * y;
	out[7] = a[7] * y;
	out[8] = a[8] * z;
	out[9] = a[9] * z;
	out[10] = a[10] * z;
	out[11] = a[11] * z;
	out[12] = a[12];
	out[13] = a[13];
	out[14] = a[14];
	out[15] = a[15];
	return out;
};

/**
 * Rotates a mat4 by the given angle around the given axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {ReadonlyVec3} axis the axis to rotate around
 * @returns {mat4} out
 */
exports.rotate = function(out, a, rad, axis) {
	let x = axis[0],
		y = axis[1],
		z = axis[2];
	let len = Math.sqrt(x * x + y * y + z * z);
	let s, c, t;
	let a00, a01, a02, a03;
	let a10, a11, a12, a13;
	let a20, a21, a22, a23;
	let b00, b01, b02;
	let b10, b11, b12;
	let b20, b21, b22;

	if (len < EPSILON) {
		return null;
	}

	len = 1 / len;
	x *= len;
	y *= len;
	z *= len;

	s = Math.sin(rad);
	c = Math.cos(rad);
	t = 1 - c;

	a00 = a[0];
	a01 = a[1];
	a02 = a[2];
	a03 = a[3];
	a10 = a[4];
	a11 = a[5];
	a12 = a[6];
	a13 = a[7];
	a20 = a[8];
	a21 = a[9];
	a22 = a[10];
	a23 = a[11];

	// Construct the elements of the rotation matrix
	b00 = x * x * t + c;
	b01 = y * x * t + z * s;
	b02 = z * x * t - y * s;
	b10 = x * y * t - z * s;
	b11 = y * y * t + c;
	b12 = z * y * t + x * s;
	b20 = x * z * t + y * s;
	b21 = y * z * t - x * s;
	b22 = z * z * t + c;

	// Perform rotation-specific matrix multiplication
	out[0] = a00 * b00 + a10 * b01 + a20 * b02;
	out[1] = a01 * b00 + a11 * b01 + a21 * b02;
	out[2] = a02 * b00 + a12 * b01 + a22 * b02;
	out[3] = a03 * b00 + a13 * b01 + a23 * b02;
	out[4] = a00 * b10 + a10 * b11 + a20 * b12;
	out[5] = a01 * b10 + a11 * b11 + a21 * b12;
	out[6] = a02 * b10 + a12 * b11 + a22 * b12;
	out[7] = a03 * b10 + a13 * b11 + a23 * b12;
	out[8] = a00 * b20 + a10 * b21 + a20 * b22;
	out[9] = a01 * b20 + a11 * b21 + a21 * b22;
	out[10] = a02 * b20 + a12 * b21 + a22 * b22;
	out[11] = a03 * b20 + a13 * b21 + a23 * b22;

	if (a !== out) {
		// If the source and destination differ, copy the unchanged last row
		out[12] = a[12];
		out[13] = a[13];
		out[14] = a[14];
		out[15] = a[15];
	}
	return out;
};

/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
exports.rotateX = function(out, a, rad) {
	let s = Math.sin(rad);
	let c = Math.cos(rad);
	let a10 = a[4];
	let a11 = a[5];
	let a12 = a[6];
	let a13 = a[7];
	let a20 = a[8];
	let a21 = a[9];
	let a22 = a[10];
	let a23 = a[11];

	if (a !== out) {
		// If the source and destination differ, copy the unchanged rows
		out[0] = a[0];
		out[1] = a[1];
		out[2] = a[2];
		out[3] = a[3];
		out[12] = a[12];
		out[13] = a[13];
		out[14] = a[14];
		out[15] = a[15];
	}

	// Perform axis-specific matrix multiplication
	out[4] = a10 * c + a20 * s;
	out[5] = a11 * c + a21 * s;
	out[6] = a12 * c + a22 * s;
	out[7] = a13 * c + a23 * s;
	out[8] = a20 * c - a10 * s;
	out[9] = a21 * c - a11 * s;
	out[10] = a22 * c - a12 * s;
	out[11] = a23 * c - a13 * s;
	return out;
};

/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
exports.rotateY = function(out, a, rad) {
	let s = Math.sin(rad);
	let c = Math.cos(rad);
	let a00 = a[0];
	let a01 = a[1];
	let a02 = a[2];
	let a03 = a[3];
	let a20 = a[8];
	let a21 = a[9];
	let a22 = a[10];
	let a23 = a[11];

	if (a !== out) {
		// If the source and destination differ, copy the unchanged rows
		out[4] = a[4];
		out[5] = a[5];
		out[6] = a[6];
		out[7] = a[7];
		out[12] = a[12];
		out[13] = a[13];
		out[14] = a[14];
		out[15] = a[15];
	}

	// Perform axis-specific matrix multiplication
	out[0] = a00 * c - a20 * s;
	out[1] = a01 * c - a21 * s;
	out[2] = a02 * c - a22 * s;
	out[3] = a03 * c - a23 * s;
	out[8] = a00 * s + a20 * c;
	out[9] = a01 * s + a21 * c;
	out[10] = a02 * s + a22 * c;
	out[11] = a03 * s + a23 * c;
	return out;
};

/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
exports.rotateZ = function(out, a, rad) {
	let s = Math.sin(rad);
	let c = Math.cos(rad);
	let a00 = a[0];
	let a01 = a[1];
	let a02 = a[2];
	let a03 = a[3];
	let a10 = a[4];
	let a11 = a[5];
	let a12 = a[6];
	let a13 = a[7];

	if (a !== out) {
		// If the source and destination differ, copy the unchanged last row
		out[8] = a[8];
		out[9] = a[9];
		out[10] = a[10];
		out[11] = a[11];
		out[12] = a[12];
		out[13] = a[13];
		out[14] = a[14];
		out[15] = a[15];
	}

	// Perform axis-specific matrix multiplication
	out[0] = a00 * c + a10 * s;
	out[1] = a01 * c + a11 * s;
	out[2] = a02 * c + a12 * s;
	out[3] = a03 * c + a13 * s;
	out[4] = a10 * c - a00 * s;
	out[5] = a11 * c - a01 * s;
	out[6] = a12 * c - a02 * s;
	out[7] = a13 * c - a03 * s;
	return out;
};

/**
 * Creates a matrix from a vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, dest, vec);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {ReadonlyVec3} v Translation vector
 * @returns {mat4} out
 */
exports.fromTranslation = function(out, v) {
	out[0] = 1;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = 1;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[10] = 1;
	out[11] = 0;
	out[12] = v[0];
	out[13] = v[1];
	out[14] = v[2];
	out[15] = 1;
	return out;
};

/**
 * Creates a matrix from a vector scaling
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.scale(dest, dest, vec);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {ReadonlyVec3} v Scaling vector
 * @returns {mat4} out
 */
exports.fromScaling = function(out, v) {
	out[0] = v[0];
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = v[1];
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[10] = v[2];
	out[11] = 0;
	out[12] = 0;
	out[13] = 0;
	out[14] = 0;
	out[15] = 1;
	return out;
};

/**
 * Creates a matrix from a given angle around a given axis
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.rotate(dest, dest, rad, axis);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @param {ReadonlyVec3} axis the axis to rotate around
 * @returns {mat4} out
 */
exports.fromRotation = function(out, rad, axis) {
	let x = axis[0],
		y = axis[1],
		z = axis[2];
	let len = Math.sqrt(x * x + y * y + z * z);
	let s, c, t;

	if (len < EPSILON) {
		return null;
	}

	len = 1 / len;
	x *= len;
	y *= len;
	z *= len;

	s = Math.sin(rad);
	c = Math.cos(rad);
	t = 1 - c;

	// Perform rotation-specific matrix multiplication
	out[0] = x * x * t + c;
	out[1] = y * x * t + z * s;
	out[2] = z * x * t - y * s;
	out[3] = 0;
	out[4] = x * y * t - z * s;
	out[5] = y * y * t + c;
	out[6] = z * y * t + x * s;
	out[7] = 0;
	out[8] = x * z * t + y * s;
	out[9] = y * z * t - x * s;
	out[10] = z * z * t + c;
	out[11] = 0;
	out[12] = 0;
	out[13] = 0;
	out[14] = 0;
	out[15] = 1;
	return out;
};

/**
 * Creates a matrix from the given angle around the X axis
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.rotateX(dest, dest, rad);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
exports.fromXRotation = function(out, rad) {
	let s = Math.sin(rad);
	let c = Math.cos(rad);

	// Perform axis-specific matrix multiplication
	out[0] = 1;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = c;
	out[6] = s;
	out[7] = 0;
	out[8] = 0;
	out[9] = -s;
	out[10] = c;
	out[11] = 0;
	out[12] = 0;
	out[13] = 0;
	out[14] = 0;
	out[15] = 1;
	return out;
};

/**
 * Creates a matrix from the given angle around the Y axis
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.rotateY(dest, dest, rad);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
exports.fromYRotation = function(out, rad) {
	let s = Math.sin(rad);
	let c = Math.cos(rad);

	// Perform axis-specific matrix multiplication
	out[0] = c;
	out[1] = 0;
	out[2] = -s;
	out[3] = 0;
	out[4] = 0;
	out[5] = 1;
	out[6] = 0;
	out[7] = 0;
	out[8] = s;
	out[9] = 0;
	out[10] = c;
	out[11] = 0;
	out[12] = 0;
	out[13] = 0;
	out[14] = 0;
	out[15] = 1;
	return out;
};

/**
 * Creates a matrix from the given angle around the Z axis
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.rotateZ(dest, dest, rad);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
exports.fromZRotation = function(out, rad) {
	let s = Math.sin(rad);
	let c = Math.cos(rad);

	// Perform axis-specific matrix multiplication
	out[0] = c;
	out[1] = s;
	out[2] = 0;
	out[3] = 0;
	out[4] = -s;
	out[5] = c;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[10] = 1;
	out[11] = 0;
	out[12] = 0;
	out[13] = 0;
	out[14] = 0;
	out[15] = 1;
	return out;
};

const fromRotationTranslation = 
/**
 * Creates a matrix from a quaternion rotation and vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     let quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {ReadonlyVec3} v Translation vector
 * @returns {mat4} out
 */
exports.fromRotationTranslation = function(out, q, v) {
	// Quaternion math
	let x = q[0],
		y = q[1],
		z = q[2],
		w = q[3];
	let x2 = x + x;
	let y2 = y + y;
	let z2 = z + z;

	let xx = x * x2;
	let xy = x * y2;
	let xz = x * z2;
	let yy = y * y2;
	let yz = y * z2;
	let zz = z * z2;
	let wx = w * x2;
	let wy = w * y2;
	let wz = w * z2;

	out[0] = 1 - (yy + zz);
	out[1] = xy + wz;
	out[2] = xz - wy;
	out[3] = 0;
	out[4] = xy - wz;
	out[5] = 1 - (xx + zz);
	out[6] = yz + wx;
	out[7] = 0;
	out[8] = xz + wy;
	out[9] = yz - wx;
	out[10] = 1 - (xx + yy);
	out[11] = 0;
	out[12] = v[0];
	out[13] = v[1];
	out[14] = v[2];
	out[15] = 1;

	return out;
};

/**
 * Creates a new mat4 from a dual quat.
 *
 * @param {mat4} out Matrix
 * @param {ReadonlyQuat2} a Dual Quaternion
 * @returns {mat4} mat4 receiving operation result
 */
exports.fromQuat2 = function(out, a) {
	let translation = new ARRAY_TYPE(3);
	let bx = -a[0],
		by = -a[1],
		bz = -a[2],
		bw = a[3],
		ax = a[4],
		ay = a[5],
		az = a[6],
		aw = a[7];

	let magnitude = bx * bx + by * by + bz * bz + bw * bw;
	//Only scale if it makes sense
	if (magnitude > 0) {
		translation[0] = ((ax * bw + aw * bx + ay * bz - az * by) * 2) / magnitude;
		translation[1] = ((ay * bw + aw * by + az * bx - ax * bz) * 2) / magnitude;
		translation[2] = ((az * bw + aw * bz + ax * by - ay * bx) * 2) / magnitude;
	} else {
		translation[0] = (ax * bw + aw * bx + ay * bz - az * by) * 2;
		translation[1] = (ay * bw + aw * by + az * bx - ax * bz) * 2;
		translation[2] = (az * bw + aw * bz + ax * by - ay * bx) * 2;
	}
	fromRotationTranslation(out, a, translation);
	return out;
};

/**
 * Returns the translation vector component of a transformation
 *  matrix. If a matrix is built with fromRotationTranslation,
 *  the returned vector will be the same as the translation vector
 *  originally supplied.
 * @param  {vec3} out Vector to receive translation component
 * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
 * @return {vec3} out
 */
exports.getTranslation = function(out, mat) {
	out[0] = mat[12];
	out[1] = mat[13];
	out[2] = mat[14];

	return out;
};

/**
 * Returns the scaling factor component of a transformation
 *  matrix. If a matrix is built with fromRotationTranslationScale
 *  with a normalized Quaternion paramter, the returned vector will be
 *  the same as the scaling vector
 *  originally supplied.
 * @param  {vec3} out Vector to receive scaling factor component
 * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
 * @return {vec3} out
 */
exports.getScaling = function(out, mat) {
	let m11 = mat[0];
	let m12 = mat[1];
	let m13 = mat[2];
	let m21 = mat[4];
	let m22 = mat[5];
	let m23 = mat[6];
	let m31 = mat[8];
	let m32 = mat[9];
	let m33 = mat[10];

	out[0] = Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
	out[1] = Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
	out[2] = Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);

	return out;
};

/**
 * Returns a quaternion representing the rotational component
 *  of a transformation matrix. If a matrix is built with
 *  fromRotationTranslation, the returned quaternion will be the
 *  same as the quaternion originally supplied.
 * @param {quat} out Quaternion to receive the rotation component
 * @param {ReadonlyMat4} mat Matrix to be decomposed (input)
 * @return {quat} out
 */
exports.getRotation = function(out, mat) {
	// getScaling, inlined to generate is1, is2 & is3 without GA
	let m11 = mat[0];
	let m12 = mat[1];
	let m13 = mat[2];
	let m21 = mat[4];
	let m22 = mat[5];
	let m23 = mat[6];
	let m31 = mat[8];
	let m32 = mat[9];
	let m33 = mat[10];

	let is1 = 1 / Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
	let is2 = 1 / Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
	let is3 = 1 / Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);

	let sm11 = mat[0] * is1;
	let sm12 = mat[1] * is2;
	let sm13 = mat[2] * is3;
	let sm21 = mat[4] * is1;
	let sm22 = mat[5] * is2;
	let sm23 = mat[6] * is3;
	let sm31 = mat[8] * is1;
	let sm32 = mat[9] * is2;
	let sm33 = mat[10] * is3;

	let trace = sm11 + sm22 + sm33;
	let S = 0;

	if (trace > 0) {
		S = Math.sqrt(trace + 1.0) * 2;
		out[3] = 0.25 * S;
		out[0] = (sm23 - sm32) / S;
		out[1] = (sm31 - sm13) / S;
		out[2] = (sm12 - sm21) / S;
	} else if (sm11 > sm22 && sm11 > sm33) {
		S = Math.sqrt(1.0 + sm11 - sm22 - sm33) * 2;
		out[3] = (sm23 - sm32) / S;
		out[0] = 0.25 * S;
		out[1] = (sm12 + sm21) / S;
		out[2] = (sm31 + sm13) / S;
	} else if (sm22 > sm33) {
		S = Math.sqrt(1.0 + sm22 - sm11 - sm33) * 2;
		out[3] = (sm31 - sm13) / S;
		out[0] = (sm12 + sm21) / S;
		out[1] = 0.25 * S;
		out[2] = (sm23 + sm32) / S;
	} else {
		S = Math.sqrt(1.0 + sm33 - sm11 - sm22) * 2;
		out[3] = (sm12 - sm21) / S;
		out[0] = (sm31 + sm13) / S;
		out[1] = (sm23 + sm32) / S;
		out[2] = 0.25 * S;
	}

	return out;
};

/**
 * Decomposes a transformation matrix into its rotation, translation
 * and scale components. Returns only the rotation component
 * @param  {quat} out_r Quaternion to receive the rotation component
 * @param  {vec3} out_t Vector to receive the translation vector
 * @param  {vec3} out_s Vector to receive the scaling factor
 * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
 * @returns {quat} out_r
 */
exports.decompose = function(out_r, out_t, out_s, mat) {
	out_t[0] = mat[12];
	out_t[1] = mat[13];
	out_t[2] = mat[14];

	let m11 = mat[0];
	let m12 = mat[1];
	let m13 = mat[2];
	let m21 = mat[4];
	let m22 = mat[5];
	let m23 = mat[6];
	let m31 = mat[8];
	let m32 = mat[9];
	let m33 = mat[10];

	out_s[0] = Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
	out_s[1] = Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
	out_s[2] = Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);

	let is1 = 1 / out_s[0];
	let is2 = 1 / out_s[1];
	let is3 = 1 / out_s[2];

	let sm11 = m11 * is1;
	let sm12 = m12 * is2;
	let sm13 = m13 * is3;
	let sm21 = m21 * is1;
	let sm22 = m22 * is2;
	let sm23 = m23 * is3;
	let sm31 = m31 * is1;
	let sm32 = m32 * is2;
	let sm33 = m33 * is3;

	let trace = sm11 + sm22 + sm33;
	let S = 0;

	if (trace > 0) {
		S = Math.sqrt(trace + 1.0) * 2;
		out_r[3] = 0.25 * S;
		out_r[0] = (sm23 - sm32) / S;
		out_r[1] = (sm31 - sm13) / S;
		out_r[2] = (sm12 - sm21) / S;
	} else if (sm11 > sm22 && sm11 > sm33) {
		S = Math.sqrt(1.0 + sm11 - sm22 - sm33) * 2;
		out_r[3] = (sm23 - sm32) / S;
		out_r[0] = 0.25 * S;
		out_r[1] = (sm12 + sm21) / S;
		out_r[2] = (sm31 + sm13) / S;
	} else if (sm22 > sm33) {
		S = Math.sqrt(1.0 + sm22 - sm11 - sm33) * 2;
		out_r[3] = (sm31 - sm13) / S;
		out_r[0] = (sm12 + sm21) / S;
		out_r[1] = 0.25 * S;
		out_r[2] = (sm23 + sm32) / S;
	} else {
		S = Math.sqrt(1.0 + sm33 - sm11 - sm22) * 2;
		out_r[3] = (sm12 - sm21) / S;
		out_r[0] = (sm31 + sm13) / S;
		out_r[1] = (sm23 + sm32) / S;
		out_r[2] = 0.25 * S;
	}

	return out_r;
};

/**
 * Creates a matrix from a quaternion rotation, vector translation and vector scale
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     let quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *     mat4.scale(dest, scale)
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {ReadonlyVec3} v Translation vector
 * @param {ReadonlyVec3} s Scaling vector
 * @returns {mat4} out
 */
exports.fromRotationTranslationScale = function(out, q, v, s) {
	// Quaternion math
	let x = q[0],
		y = q[1],
		z = q[2],
		w = q[3];
	let x2 = x + x;
	let y2 = y + y;
	let z2 = z + z;

	let xx = x * x2;
	let xy = x * y2;
	let xz = x * z2;
	let yy = y * y2;
	let yz = y * z2;
	let zz = z * z2;
	let wx = w * x2;
	let wy = w * y2;
	let wz = w * z2;
	let sx = s[0];
	let sy = s[1];
	let sz = s[2];

	out[0] = (1 - (yy + zz)) * sx;
	out[1] = (xy + wz) * sx;
	out[2] = (xz - wy) * sx;
	out[3] = 0;
	out[4] = (xy - wz) * sy;
	out[5] = (1 - (xx + zz)) * sy;
	out[6] = (yz + wx) * sy;
	out[7] = 0;
	out[8] = (xz + wy) * sz;
	out[9] = (yz - wx) * sz;
	out[10] = (1 - (xx + yy)) * sz;
	out[11] = 0;
	out[12] = v[0];
	out[13] = v[1];
	out[14] = v[2];
	out[15] = 1;

	return out;
};

/**
 * Creates a matrix from a quaternion rotation, vector translation and vector scale, rotating and scaling around the given origin
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     mat4.translate(dest, origin);
 *     let quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *     mat4.scale(dest, scale)
 *     mat4.translate(dest, negativeOrigin);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {ReadonlyVec3} v Translation vector
 * @param {ReadonlyVec3} s Scaling vector
 * @param {ReadonlyVec3} o The origin vector around which to scale and rotate
 * @returns {mat4} out
 */
exports.fromRotationTranslationScaleOrigin = function(out, q, v, s, o) {
	// Quaternion math
	let x = q[0],
		y = q[1],
		z = q[2],
		w = q[3];
	let x2 = x + x;
	let y2 = y + y;
	let z2 = z + z;

	let xx = x * x2;
	let xy = x * y2;
	let xz = x * z2;
	let yy = y * y2;
	let yz = y * z2;
	let zz = z * z2;
	let wx = w * x2;
	let wy = w * y2;
	let wz = w * z2;

	let sx = s[0];
	let sy = s[1];
	let sz = s[2];

	let ox = o[0];
	let oy = o[1];
	let oz = o[2];

	let out0 = (1 - (yy + zz)) * sx;
	let out1 = (xy + wz) * sx;
	let out2 = (xz - wy) * sx;
	let out4 = (xy - wz) * sy;
	let out5 = (1 - (xx + zz)) * sy;
	let out6 = (yz + wx) * sy;
	let out8 = (xz + wy) * sz;
	let out9 = (yz - wx) * sz;
	let out10 = (1 - (xx + yy)) * sz;

	out[0] = out0;
	out[1] = out1;
	out[2] = out2;
	out[3] = 0;
	out[4] = out4;
	out[5] = out5;
	out[6] = out6;
	out[7] = 0;
	out[8] = out8;
	out[9] = out9;
	out[10] = out10;
	out[11] = 0;
	out[12] = v[0] + ox - (out0 * ox + out4 * oy + out8 * oz);
	out[13] = v[1] + oy - (out1 * ox + out5 * oy + out9 * oz);
	out[14] = v[2] + oz - (out2 * ox + out6 * oy + out10 * oz);
	out[15] = 1;

	return out;
};

/**
 * Calculates a 4x4 matrix from the given quaternion
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {ReadonlyQuat} q Quaternion to create matrix from
 *
 * @returns {mat4} out
 */
exports.fromQuat = function(out, q) {
	let x = q[0],
		y = q[1],
		z = q[2],
		w = q[3];
	let x2 = x + x;
	let y2 = y + y;
	let z2 = z + z;

	let xx = x * x2;
	let yx = y * x2;
	let yy = y * y2;
	let zx = z * x2;
	let zy = z * y2;
	let zz = z * z2;
	let wx = w * x2;
	let wy = w * y2;
	let wz = w * z2;

	out[0] = 1 - yy - zz;
	out[1] = yx + wz;
	out[2] = zx - wy;
	out[3] = 0;

	out[4] = yx - wz;
	out[5] = 1 - xx - zz;
	out[6] = zy + wx;
	out[7] = 0;

	out[8] = zx + wy;
	out[9] = zy - wx;
	out[10] = 1 - xx - yy;
	out[11] = 0;

	out[12] = 0;
	out[13] = 0;
	out[14] = 0;
	out[15] = 1;

	return out;
};

/**
 * Generates a frustum matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {mat4} out
 */
exports.frustum = function(out, left, right, bottom, top, near, far) {
	let rl = 1 / (right - left);
	let tb = 1 / (top - bottom);
	let nf = 1 / (near - far);
	out[0] = near * 2 * rl;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = near * 2 * tb;
	out[6] = 0;
	out[7] = 0;
	out[8] = (right + left) * rl;
	out[9] = (top + bottom) * tb;
	out[10] = (far + near) * nf;
	out[11] = -1;
	out[12] = 0;
	out[13] = 0;
	out[14] = far * near * 2 * nf;
	out[15] = 0;
	return out;
};

/**
 * Generates a perspective projection matrix with the given bounds.
 * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
 * which matches WebGL/OpenGL's clip volume.
 * Passing null/undefined/no value for far will generate infinite projection matrix.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum, can be null or Infinity
 * @returns {mat4} out
 */
exports.perspectiveNO = function(out, fovy, aspect, near, far) {
	const f = 1.0 / Math.tan(fovy / 2);
	out[0] = f / aspect;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = f;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[11] = -1;
	out[12] = 0;
	out[13] = 0;
	out[15] = 0;
	if (far != null && far !== Infinity) {
		const nf = 1 / (near - far);
		out[10] = (far + near) * nf;
		out[14] = 2 * far * near * nf;
	} else {
		out[10] = -1;
		out[14] = -2 * near;
	}
	return out;
};

/**
 * Alias for {@link mat4.perspectiveNO}
 * @function
 */
exports.perspective = exports.perspectiveNO;

/**
 * Generates a perspective projection matrix suitable for WebGPU with the given bounds.
 * The near/far clip planes correspond to a normalized device coordinate Z range of [0, 1],
 * which matches WebGPU/Vulkan/DirectX/Metal's clip volume.
 * Passing null/undefined/no value for far will generate infinite projection matrix.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum, can be null or Infinity
 * @returns {mat4} out
 */
exports.perspectiveZO = function(out, fovy, aspect, near, far) {
	const f = 1.0 / Math.tan(fovy / 2);
	out[0] = f / aspect;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = f;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[11] = -1;
	out[12] = 0;
	out[13] = 0;
	out[15] = 0;
	if (far != null && far !== Infinity) {
		const nf = 1 / (near - far);
		out[10] = far * nf;
		out[14] = far * near * nf;
	} else {
		out[10] = -1;
		out[14] = -near;
	}
	return out;
};

/**
 * Generates a perspective projection matrix with the given field of view.
 * This is primarily useful for generating projection matrices to be used
 * with the still experiemental WebVR API.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Object} fov Object containing the following values: upDegrees, downDegrees, leftDegrees, rightDegrees
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
exports.perspectiveFromFieldOfView = function(out, fov, near, far) {
	let upTan = Math.tan((fov.upDegrees * Math.PI) / 180.0);
	let downTan = Math.tan((fov.downDegrees * Math.PI) / 180.0);
	let leftTan = Math.tan((fov.leftDegrees * Math.PI) / 180.0);
	let rightTan = Math.tan((fov.rightDegrees * Math.PI) / 180.0);
	let xScale = 2.0 / (leftTan + rightTan);
	let yScale = 2.0 / (upTan + downTan);

	out[0] = xScale;
	out[1] = 0.0;
	out[2] = 0.0;
	out[3] = 0.0;
	out[4] = 0.0;
	out[5] = yScale;
	out[6] = 0.0;
	out[7] = 0.0;
	out[8] = -((leftTan - rightTan) * xScale * 0.5);
	out[9] = (upTan - downTan) * yScale * 0.5;
	out[10] = far / (near - far);
	out[11] = -1.0;
	out[12] = 0.0;
	out[13] = 0.0;
	out[14] = (far * near) / (near - far);
	out[15] = 0.0;
	return out;
};

/**
 * Generates a orthogonal projection matrix with the given bounds.
 * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
 * which matches WebGL/OpenGL's clip volume.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
exports.orthoNO = function(out, left, right, bottom, top, near, far) {
	const lr = 1 / (left - right);
	const bt = 1 / (bottom - top);
	const nf = 1 / (near - far);
	out[0] = -2 * lr;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = -2 * bt;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[10] = 2 * nf;
	out[11] = 0;
	out[12] = (left + right) * lr;
	out[13] = (top + bottom) * bt;
	out[14] = (far + near) * nf;
	out[15] = 1;
	return out;
};

/**
 * Alias for {@link mat4.orthoNO}
 * @function
 */
exports.ortho = exports.orthoNO;

/**
 * Generates a orthogonal projection matrix with the given bounds.
 * The near/far clip planes correspond to a normalized device coordinate Z range of [0, 1],
 * which matches WebGPU/Vulkan/DirectX/Metal's clip volume.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
exports.orthoZO = function(out, left, right, bottom, top, near, far) {
	const lr = 1 / (left - right);
	const bt = 1 / (bottom - top);
	const nf = 1 / (near - far);
	out[0] = -2 * lr;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = -2 * bt;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[10] = nf;
	out[11] = 0;
	out[12] = (left + right) * lr;
	out[13] = (top + bottom) * bt;
	out[14] = near * nf;
	out[15] = 1;
	return out;
};

/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis.
 * If you want a matrix that actually makes an object look at another object, you should use targetTo instead.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {ReadonlyVec3} eye Position of the viewer
 * @param {ReadonlyVec3} center Point the viewer is looking at
 * @param {ReadonlyVec3} up vec3 pointing up
 * @returns {mat4} out
 */
exports.lookAt = function(out, eye, center, up) {
	let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
	let eyex = eye[0];
	let eyey = eye[1];
	let eyez = eye[2];
	let upx = up[0];
	let upy = up[1];
	let upz = up[2];
	let centerx = center[0];
	let centery = center[1];
	let centerz = center[2];

	if (
		Math.abs(eyex - centerx) < EPSILON &&
		Math.abs(eyey - centery) < EPSILON &&
		Math.abs(eyez - centerz) < EPSILON
	) {
		return identity(out);
	}

	z0 = eyex - centerx;
	z1 = eyey - centery;
	z2 = eyez - centerz;

	len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
	z0 *= len;
	z1 *= len;
	z2 *= len;

	x0 = upy * z2 - upz * z1;
	x1 = upz * z0 - upx * z2;
	x2 = upx * z1 - upy * z0;
	len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
	if (!len) {
		x0 = 0;
		x1 = 0;
		x2 = 0;
	} else {
		len = 1 / len;
		x0 *= len;
		x1 *= len;
		x2 *= len;
	}

	y0 = z1 * x2 - z2 * x1;
	y1 = z2 * x0 - z0 * x2;
	y2 = z0 * x1 - z1 * x0;

	len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
	if (!len) {
		y0 = 0;
		y1 = 0;
		y2 = 0;
	} else {
		len = 1 / len;
		y0 *= len;
		y1 *= len;
		y2 *= len;
	}

	out[0] = x0;
	out[1] = y0;
	out[2] = z0;
	out[3] = 0;
	out[4] = x1;
	out[5] = y1;
	out[6] = z1;
	out[7] = 0;
	out[8] = x2;
	out[9] = y2;
	out[10] = z2;
	out[11] = 0;
	out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
	out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
	out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
	out[15] = 1;

	return out;
};

/**
 * Generates a matrix that makes something look at something else.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {ReadonlyVec3} eye Position of the viewer
 * @param {ReadonlyVec3} center Point the viewer is looking at
 * @param {ReadonlyVec3} up vec3 pointing up
 * @returns {mat4} out
 */
exports.targetTo = function(out, eye, target, up) {
	let eyex = eye[0],
		eyey = eye[1],
		eyez = eye[2],
		upx = up[0],
		upy = up[1],
		upz = up[2];

	let z0 = eyex - target[0],
		z1 = eyey - target[1],
		z2 = eyez - target[2];

	let len = z0 * z0 + z1 * z1 + z2 * z2;
	if (len > 0) {
		len = 1 / Math.sqrt(len);
		z0 *= len;
		z1 *= len;
		z2 *= len;
	}

	let x0 = upy * z2 - upz * z1,
		x1 = upz * z0 - upx * z2,
		x2 = upx * z1 - upy * z0;

	len = x0 * x0 + x1 * x1 + x2 * x2;
	if (len > 0) {
		len = 1 / Math.sqrt(len);
		x0 *= len;
		x1 *= len;
		x2 *= len;
	}

	out[0] = x0;
	out[1] = x1;
	out[2] = x2;
	out[3] = 0;
	out[4] = z1 * x2 - z2 * x1;
	out[5] = z2 * x0 - z0 * x2;
	out[6] = z0 * x1 - z1 * x0;
	out[7] = 0;
	out[8] = z0;
	out[9] = z1;
	out[10] = z2;
	out[11] = 0;
	out[12] = eyex;
	out[13] = eyey;
	out[14] = eyez;
	out[15] = 1;
	return out;
};

/**
 * Returns a string representation of a mat4
 *
 * @param {ReadonlyMat4} a matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
exports.str = function(a) {
	return (
		"mat4(" +
		a[0] +
		", " +
		a[1] +
		", " +
		a[2] +
		", " +
		a[3] +
		", " +
		a[4] +
		", " +
		a[5] +
		", " +
		a[6] +
		", " +
		a[7] +
		", " +
		a[8] +
		", " +
		a[9] +
		", " +
		a[10] +
		", " +
		a[11] +
		", " +
		a[12] +
		", " +
		a[13] +
		", " +
		a[14] +
		", " +
		a[15] +
		")"
	);
};

/**
 * Returns Frobenius norm of a mat4
 *
 * @param {ReadonlyMat4} a the matrix to calculate Frobenius norm of
 * @returns {Number} Frobenius norm
 */
exports.frob = function(a) {
	return Math.sqrt(
		a[0] * a[0] +
		a[1] * a[1] +
		a[2] * a[2] +
		a[3] * a[3] +
		a[4] * a[4] +
		a[5] * a[5] +
		a[6] * a[6] +
		a[7] * a[7] +
		a[8] * a[8] +
		a[9] * a[9] +
		a[10] * a[10] +
		a[11] * a[11] +
		a[12] * a[12] +
		a[13] * a[13] +
		a[14] * a[14] +
		a[15] * a[15]
	);
};

/**
 * Adds two mat4's
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the first operand
 * @param {ReadonlyMat4} b the second operand
 * @returns {mat4} out
 */
exports.add = function(out, a, b) {
	out[0] = a[0] + b[0];
	out[1] = a[1] + b[1];
	out[2] = a[2] + b[2];
	out[3] = a[3] + b[3];
	out[4] = a[4] + b[4];
	out[5] = a[5] + b[5];
	out[6] = a[6] + b[6];
	out[7] = a[7] + b[7];
	out[8] = a[8] + b[8];
	out[9] = a[9] + b[9];
	out[10] = a[10] + b[10];
	out[11] = a[11] + b[11];
	out[12] = a[12] + b[12];
	out[13] = a[13] + b[13];
	out[14] = a[14] + b[14];
	out[15] = a[15] + b[15];
	return out;
};

/**
 * Subtracts matrix b from matrix a
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the first operand
 * @param {ReadonlyMat4} b the second operand
 * @returns {mat4} out
 */
exports.subtract = function(out, a, b) {
	out[0] = a[0] - b[0];
	out[1] = a[1] - b[1];
	out[2] = a[2] - b[2];
	out[3] = a[3] - b[3];
	out[4] = a[4] - b[4];
	out[5] = a[5] - b[5];
	out[6] = a[6] - b[6];
	out[7] = a[7] - b[7];
	out[8] = a[8] - b[8];
	out[9] = a[9] - b[9];
	out[10] = a[10] - b[10];
	out[11] = a[11] - b[11];
	out[12] = a[12] - b[12];
	out[13] = a[13] - b[13];
	out[14] = a[14] - b[14];
	out[15] = a[15] - b[15];
	return out;
};

/**
 * Multiply each element of the matrix by a scalar.
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to scale
 * @param {Number} b amount to scale the matrix's elements by
 * @returns {mat4} out
 */
exports.multiplyScalar = function(out, a, b) {
	out[0] = a[0] * b;
	out[1] = a[1] * b;
	out[2] = a[2] * b;
	out[3] = a[3] * b;
	out[4] = a[4] * b;
	out[5] = a[5] * b;
	out[6] = a[6] * b;
	out[7] = a[7] * b;
	out[8] = a[8] * b;
	out[9] = a[9] * b;
	out[10] = a[10] * b;
	out[11] = a[11] * b;
	out[12] = a[12] * b;
	out[13] = a[13] * b;
	out[14] = a[14] * b;
	out[15] = a[15] * b;
	return out;
};

/**
 * Adds two mat4's after multiplying each element of the second operand by a scalar value.
 *
 * @param {mat4} out the receiving vector
 * @param {ReadonlyMat4} a the first operand
 * @param {ReadonlyMat4} b the second operand
 * @param {Number} scale the amount to scale b's elements by before adding
 * @returns {mat4} out
 */
exports.multiplyScalarAndAdd = function(out, a, b, scale) {
	out[0] = a[0] + b[0] * scale;
	out[1] = a[1] + b[1] * scale;
	out[2] = a[2] + b[2] * scale;
	out[3] = a[3] + b[3] * scale;
	out[4] = a[4] + b[4] * scale;
	out[5] = a[5] + b[5] * scale;
	out[6] = a[6] + b[6] * scale;
	out[7] = a[7] + b[7] * scale;
	out[8] = a[8] + b[8] * scale;
	out[9] = a[9] + b[9] * scale;
	out[10] = a[10] + b[10] * scale;
	out[11] = a[11] + b[11] * scale;
	out[12] = a[12] + b[12] * scale;
	out[13] = a[13] + b[13] * scale;
	out[14] = a[14] + b[14] * scale;
	out[15] = a[15] + b[15] * scale;
	return out;
};

/**
 * Returns whether or not the matrices have exactly the same elements in the same position (when compared with ===)
 *
 * @param {ReadonlyMat4} a The first matrix.
 * @param {ReadonlyMat4} b The second matrix.
 * @returns {Boolean} True if the matrices are equal, false otherwise.
 */
exports.exactEquals = function(a, b) {
	return (
		a[0] === b[0] &&
		a[1] === b[1] &&
		a[2] === b[2] &&
		a[3] === b[3] &&
		a[4] === b[4] &&
		a[5] === b[5] &&
		a[6] === b[6] &&
		a[7] === b[7] &&
		a[8] === b[8] &&
		a[9] === b[9] &&
		a[10] === b[10] &&
		a[11] === b[11] &&
		a[12] === b[12] &&
		a[13] === b[13] &&
		a[14] === b[14] &&
		a[15] === b[15]
	);
};

/**
 * Returns whether or not the matrices have approximately the same elements in the same position.
 *
 * @param {ReadonlyMat4} a The first matrix.
 * @param {ReadonlyMat4} b The second matrix.
 * @returns {Boolean} True if the matrices are equal, false otherwise.
 */
exports.equals = function(a, b) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3];
	let a4 = a[4],
		a5 = a[5],
		a6 = a[6],
		a7 = a[7];
	let a8 = a[8],
		a9 = a[9],
		a10 = a[10],
		a11 = a[11];
	let a12 = a[12],
		a13 = a[13],
		a14 = a[14],
		a15 = a[15];

	let b0 = b[0],
		b1 = b[1],
		b2 = b[2],
		b3 = b[3];
	let b4 = b[4],
		b5 = b[5],
		b6 = b[6],
		b7 = b[7];
	let b8 = b[8],
		b9 = b[9],
		b10 = b[10],
		b11 = b[11];
	let b12 = b[12],
		b13 = b[13],
		b14 = b[14],
		b15 = b[15];

	return (
		Math.abs(a0 - b0) <=
			EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
		Math.abs(a1 - b1) <=
			EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) &&
		Math.abs(a2 - b2) <=
			EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2)) &&
		Math.abs(a3 - b3) <=
			EPSILON * Math.max(1.0, Math.abs(a3), Math.abs(b3)) &&
		Math.abs(a4 - b4) <=
			EPSILON * Math.max(1.0, Math.abs(a4), Math.abs(b4)) &&
		Math.abs(a5 - b5) <=
			EPSILON * Math.max(1.0, Math.abs(a5), Math.abs(b5)) &&
		Math.abs(a6 - b6) <=
			EPSILON * Math.max(1.0, Math.abs(a6), Math.abs(b6)) &&
		Math.abs(a7 - b7) <=
			EPSILON * Math.max(1.0, Math.abs(a7), Math.abs(b7)) &&
		Math.abs(a8 - b8) <=
			EPSILON * Math.max(1.0, Math.abs(a8), Math.abs(b8)) &&
		Math.abs(a9 - b9) <=
			EPSILON * Math.max(1.0, Math.abs(a9), Math.abs(b9)) &&
		Math.abs(a10 - b10) <=
			EPSILON * Math.max(1.0, Math.abs(a10), Math.abs(b10)) &&
		Math.abs(a11 - b11) <=
			EPSILON * Math.max(1.0, Math.abs(a11), Math.abs(b11)) &&
		Math.abs(a12 - b12) <=
			EPSILON * Math.max(1.0, Math.abs(a12), Math.abs(b12)) &&
		Math.abs(a13 - b13) <=
			EPSILON * Math.max(1.0, Math.abs(a13), Math.abs(b13)) &&
		Math.abs(a14 - b14) <=
			EPSILON * Math.max(1.0, Math.abs(a14), Math.abs(b14)) &&
		Math.abs(a15 - b15) <=
			EPSILON * Math.max(1.0, Math.abs(a15), Math.abs(b15))
	);
};

/**
 * Alias for {@link mat4.multiply}
 * @function
 */
exports.mul = exports.multiply;

/**
 * Alias for {@link mat4.subtract}
 * @function
 */
exports.sub = exports.subtract;

/**
 * mat4 pool for minimising garbage allocation 
 */
exports.Pool = (function(){
	let stack = [];
	for (let i = 0; i < 5; i++) {
		stack.push(exports.create());
	}
	
	return {
		/**
		 * return a borrowed mat4 to the pool
		 * @param {mat4}
		 */
		return: (m) => { stack.push(exports.identity(m)); },
		/**
		 * request a mat4 from the pool
		 * @returns {mat4}
		 */
		request: () => {
			if (stack.length > 0) {
				return stack.pop();
			}
			return exports.create();
		}
	}
})();

exports.IDENTITY = Object.freeze(exports.create());
},{"./common.js":12}],17:[function(require,module,exports){
const { ANGLE_ORDER, ARRAY_TYPE, EPSILON, RANDOM, equals } = require("./common.js");
const mat3 = require("./mat3.js");
const vec3 = require("./vec3.js");
const vec4 = require("./vec4.js");

/**
 * Quaternion in the format XYZW
 * @module quat
 */

/**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */
exports.create = function() {
	let out = new ARRAY_TYPE(4);
	out[0] = 0;
	out[1] = 0;
	out[2] = 0;
	out[3] = 1;
	return out;
};

/**
 * Set a quat to the identity quaternion
 *
 * @param {quat} out the receiving quaternion
 * @returns {quat} out
 */
exports.identity = function(out) {
	out[0] = 0;
	out[1] = 0;
	out[2] = 0;
	out[3] = 1;
	return out;
};

const setAxisAngle = 
/**
 * Sets a quat from the given angle and rotation axis,
 * then returns it.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyVec3} axis the axis around which to rotate
 * @param {Number} rad the angle in radians
 * @returns {quat} out
 **/
exports.setAxisAngle = function(out, axis, rad) {
	rad = rad * 0.5;
	let s = Math.sin(rad);
	out[0] = s * axis[0];
	out[1] = s * axis[1];
	out[2] = s * axis[2];
	out[3] = Math.cos(rad);
	return out;
};

/**
 * Gets the rotation axis and angle for a given
 *  quaternion. If a quaternion is created with
 *  setAxisAngle, this method will return the same
 *  values as providied in the original parameter list
 *  OR functionally equivalent values.
 * Example: The quaternion formed by axis [0, 0, 1] and
 *  angle -90 is the same as the quaternion formed by
 *  [0, 0, 1] and 270. This method favors the latter.
 * @param  {vec3} out_axis  Vector receiving the axis of rotation
 * @param  {ReadonlyQuat} q     Quaternion to be decomposed
 * @return {Number}     Angle, in radians, of the rotation
 */
exports.getAxisAngle = function(out_axis, q) {
	let rad = Math.acos(q[3]) * 2.0;
	let s = Math.sin(rad / 2.0);
	if (s > EPSILON) {
		out_axis[0] = q[0] / s;
		out_axis[1] = q[1] / s;
		out_axis[2] = q[2] / s;
	} else {
		// If s is zero, return any axis (no rotation - axis does not matter)
		out_axis[0] = 1;
		out_axis[1] = 0;
		out_axis[2] = 0;
	}
	return rad;
};

/**
 * Gets the angular distance between two unit quaternions
 *
 * @param  {ReadonlyQuat} a     Origin unit quaternion
 * @param  {ReadonlyQuat} b     Destination unit quaternion
 * @return {Number}     Angle, in radians, between the two quaternions
 */
exports.getAngle = function(a, b) {
	let dotproduct = dot(a, b);

	return Math.acos(2 * dotproduct * dotproduct - 1);
};

const multiply =
/**
 * Multiplies two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @returns {quat} out
 */
exports.multiply = function(out, a, b) {
	let ax = a[0],
		ay = a[1],
		az = a[2],
		aw = a[3];
	let bx = b[0],
		by = b[1],
		bz = b[2],
		bw = b[3];

	out[0] = ax * bw + aw * bx + ay * bz - az * by;
	out[1] = ay * bw + aw * by + az * bx - ax * bz;
	out[2] = az * bw + aw * bz + ax * by - ay * bx;
	out[3] = aw * bw - ax * bx - ay * by - az * bz;
	return out;
};

/**
 * Rotates a quaternion by the given angle about the X axis
 *
 * @param {quat} out quat receiving operation result
 * @param {ReadonlyQuat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
exports.rotateX = function(out, a, rad) {
	rad *= 0.5;

	let ax = a[0],
		ay = a[1],
		az = a[2],
		aw = a[3];
	let bx = Math.sin(rad),
		bw = Math.cos(rad);

	out[0] = ax * bw + aw * bx;
	out[1] = ay * bw + az * bx;
	out[2] = az * bw - ay * bx;
	out[3] = aw * bw - ax * bx;
	return out;
};

/**
 * Rotates a quaternion by the given angle about the Y axis
 *
 * @param {quat} out quat receiving operation result
 * @param {ReadonlyQuat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
exports.rotateY = function(out, a, rad) {
	rad *= 0.5;

	let ax = a[0],
		ay = a[1],
		az = a[2],
		aw = a[3];
	let by = Math.sin(rad),
		bw = Math.cos(rad);

	out[0] = ax * bw - az * by;
	out[1] = ay * bw + aw * by;
	out[2] = az * bw + ax * by;
	out[3] = aw * bw - ay * by;
	return out;
};

/**
 * Rotates a quaternion by the given angle about the Z axis
 *
 * @param {quat} out quat receiving operation result
 * @param {ReadonlyQuat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
exports.rotateZ = function(out, a, rad) {
	rad *= 0.5;

	let ax = a[0],
		ay = a[1],
		az = a[2],
		aw = a[3];
	let bz = Math.sin(rad),
		bw = Math.cos(rad);

	out[0] = ax * bw + ay * bz;
	out[1] = ay * bw - ax * bz;
	out[2] = az * bw + aw * bz;
	out[3] = aw * bw - az * bz;
	return out;
};

/**
 * Calculates the W component of a quat from the X, Y, and Z components.
 * Assumes that quaternion is 1 unit in length.
 * Any existing W component will be ignored.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quat to calculate W component of
 * @returns {quat} out
 */
exports.calculateW = function(out, a) {
	let x = a[0],
		y = a[1],
		z = a[2];

	out[0] = x;
	out[1] = y;
	out[2] = z;
	out[3] = Math.sqrt(Math.abs(1.0 - x * x - y * y - z * z));
	return out;
};

const exp =
/**
 * Calculate the exponential of a unit quaternion.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quat to calculate the exponential of
 * @returns {quat} out
 */
exports.exp = function(out, a) {
	let x = a[0],
		y = a[1],
		z = a[2],
		w = a[3];

	let r = Math.sqrt(x * x + y * y + z * z);
	let et = Math.exp(w);
	let s = r > 0 ? (et * Math.sin(r)) / r : 0;

	out[0] = x * s;
	out[1] = y * s;
	out[2] = z * s;
	out[3] = et * Math.cos(r);

	return out;
};

const ln =
/**
 * Calculate the natural logarithm of a unit quaternion.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quat to calculate the exponential of
 * @returns {quat} out
 */
exports.ln = function(out, a) {
	let x = a[0],
		y = a[1],
		z = a[2],
		w = a[3];

	let r = Math.sqrt(x * x + y * y + z * z);
	let t = r > 0 ? Math.atan2(r, w) / r : 0;

	out[0] = x * t;
	out[1] = y * t;
	out[2] = z * t;
	out[3] = 0.5 * Math.log(x * x + y * y + z * z + w * w);

	return out;
};

/**
 * Calculate the scalar power of a unit quaternion.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quat to calculate the exponential of
 * @param {Number} b amount to scale the quaternion by
 * @returns {quat} out
 */
exports.pow = function(out, a, b) {
	ln(out, a);
	scale(out, out, b);
	exp(out, out);
	return out;
};

const slerp =
/**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat} out
 */
exports.slerp = function(out, a, b, t) {
	// benchmarks:
	//    http://jsperf.com/quaternion-slerp-implementations
	let ax = a[0],
		ay = a[1],
		az = a[2],
		aw = a[3];
	let bx = b[0],
		by = b[1],
		bz = b[2],
		bw = b[3];

	let omega, cosom, sinom, scale0, scale1;

	// calc cosine
	cosom = ax * bx + ay * by + az * bz + aw * bw;
	// adjust signs (if necessary)
	if (cosom < 0.0) {
		cosom = -cosom;
		bx = -bx;
		by = -by;
		bz = -bz;
		bw = -bw;
	}
	// calculate coefficients
	if (1.0 - cosom > EPSILON) {
		// standard case (slerp)
		omega = Math.acos(cosom);
		sinom = Math.sin(omega);
		scale0 = Math.sin((1.0 - t) * omega) / sinom;
		scale1 = Math.sin(t * omega) / sinom;
	} else {
		// "from" and "to" quaternions are very close
		//  ... so we can do a linear interpolation
		scale0 = 1.0 - t;
		scale1 = t;
	}
	// calculate final values
	out[0] = scale0 * ax + scale1 * bx;
	out[1] = scale0 * ay + scale1 * by;
	out[2] = scale0 * az + scale1 * bz;
	out[3] = scale0 * aw + scale1 * bw;

	return out;
};

/**
 * Generates a random unit quaternion
 *
 * @param {quat} out the receiving quaternion
 * @returns {quat} out
 */
exports.random = function(out) {
	// Implementation of http://planning.cs.uiuc.edu/node198.html
	// TODO: Calling random 3 times is probably not the fastest solution
	let u1 = RANDOM();
	let u2 = RANDOM();
	let u3 = RANDOM();

	let sqrt1MinusU1 = Math.sqrt(1 - u1);
	let sqrtU1 = Math.sqrt(u1);

	out[0] = sqrt1MinusU1 * Math.sin(2.0 * Math.PI * u2);
	out[1] = sqrt1MinusU1 * Math.cos(2.0 * Math.PI * u2);
	out[2] = sqrtU1 * Math.sin(2.0 * Math.PI * u3);
	out[3] = sqrtU1 * Math.cos(2.0 * Math.PI * u3);
	return out;
};

/**
 * Calculates the inverse of a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quat to calculate inverse of
 * @returns {quat} out
 */
exports.invert = function(out, a) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3];
	let dot = a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
	let invDot = dot ? 1.0 / dot : 0;

	// TODO: Would be faster to return [0,0,0,0] immediately if dot == 0

	out[0] = -a0 * invDot;
	out[1] = -a1 * invDot;
	out[2] = -a2 * invDot;
	out[3] = a3 * invDot;
	return out;
};

/**
 * Calculates the conjugate of a quat
 * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quat to calculate conjugate of
 * @returns {quat} out
 */
exports.conjugate = function(out, a) {
	out[0] = -a[0];
	out[1] = -a[1];
	out[2] = -a[2];
	out[3] = a[3];
	return out;
};

const fromMat3 =
/**
 * Creates a quaternion from the given 3x3 rotation matrix.
 *
 * NOTE: The resultant quaternion is not normalized, so you should be sure
 * to renormalize the quaternion yourself where necessary.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyMat3} m rotation matrix
 * @returns {quat} out
 * @function
 */
exports.fromMat3 = function(out, m) {
	// Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
	// article "Quaternion Calculus and Fast Animation".
	let fTrace = m[0] + m[4] + m[8];
	let fRoot;

	if (fTrace > 0.0) {
		// |w| > 1/2, may as well choose w > 1/2
		fRoot = Math.sqrt(fTrace + 1.0); // 2w
		out[3] = 0.5 * fRoot;
		fRoot = 0.5 / fRoot; // 1/(4w)
		out[0] = (m[5] - m[7]) * fRoot;
		out[1] = (m[6] - m[2]) * fRoot;
		out[2] = (m[1] - m[3]) * fRoot;
	} else {
		// |w| <= 1/2
		let i = 0;
		if (m[4] > m[0]) i = 1;
		if (m[8] > m[i * 3 + i]) i = 2;
		let j = (i + 1) % 3;
		let k = (i + 2) % 3;

		fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1.0);
		out[i] = 0.5 * fRoot;
		fRoot = 0.5 / fRoot;
		out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
		out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
		out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
	}

	return out;
};

/**
 * Creates a new quaternion from the given euler angle x, y, z, with default angle order
 *
 * @param {Number} x Angle to rotate around X axis in degrees.
 * @param {Number} y Angle to rotate around Y axis in degrees.
 * @param {Number} z Angle to rotate around Z axis in degrees.
 * @returns {quat} out
 * @function
 */
exports.euler = function(x, y, z) {
	let q = quat.create();
	quat.fromEuler(q, x, y, z);
	return q;
};

/**
 * Creates a quaternion from the given euler angle x, y, z using the provided intrinsic order for the conversion.
 *
 * @param {quat} out the receiving quaternion
 * @param {Number} x Angle to rotate around X axis in degrees.
 * @param {Number} y Angle to rotate around Y axis in degrees.
 * @param {Number} z Angle to rotate around Z axis in degrees.
 * @param {'xyz'|'xzy'|'yxz'|'yzx'|'zxy'|'zyx'} order Intrinsic order for conversion, default is zyx.
 * @returns {quat} out
 * @function
 */
exports.fromEuler = function(out, x, y, z, order = ANGLE_ORDER) {
	let halfToRad = Math.PI / 360;
	x *= halfToRad;
	z *= halfToRad;
	y *= halfToRad;

	let sx = Math.sin(x);
	let cx = Math.cos(x);
	let sy = Math.sin(y);
	let cy = Math.cos(y);
	let sz = Math.sin(z);
	let cz = Math.cos(z);

	switch (order) {
		case "xyz":
			out[0] = sx * cy * cz + cx * sy * sz;
			out[1] = cx * sy * cz - sx * cy * sz;
			out[2] = cx * cy * sz + sx * sy * cz;
			out[3] = cx * cy * cz - sx * sy * sz;
			break;

		case "xzy":
			out[0] = sx * cy * cz - cx * sy * sz;
			out[1] = cx * sy * cz - sx * cy * sz;
			out[2] = cx * cy * sz + sx * sy * cz;
			out[3] = cx * cy * cz + sx * sy * sz;
			break;

		case "yxz":
			out[0] = sx * cy * cz + cx * sy * sz;
			out[1] = cx * sy * cz - sx * cy * sz;
			out[2] = cx * cy * sz - sx * sy * cz;
			out[3] = cx * cy * cz + sx * sy * sz;
			break;

		case "yzx":
			out[0] = sx * cy * cz + cx * sy * sz;
			out[1] = cx * sy * cz + sx * cy * sz;
			out[2] = cx * cy * sz - sx * sy * cz;
			out[3] = cx * cy * cz - sx * sy * sz;
			break;

		case "zxy":
			out[0] = sx * cy * cz - cx * sy * sz;
			out[1] = cx * sy * cz + sx * cy * sz;
			out[2] = cx * cy * sz + sx * sy * cz;
			out[3] = cx * cy * cz - sx * sy * sz;
			break;

		case "zyx":
			out[0] = sx * cy * cz - cx * sy * sz;
			out[1] = cx * sy * cz + sx * cy * sz;
			out[2] = cx * cy * sz - sx * sy * cz;
			out[3] = cx * cy * cz + sx * sy * sz;
			break;

		default:
			throw new Error('Unknown angle order ' + order);
	}

	return out;
};

/**
 * Returns a string representation of a quaternion
 *
 * @param {ReadonlyQuat} a vector to represent as a string
 * @returns {String} string representation of the vector
 */
exports.str = function(a) {
	return "quat(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ")";
};

/**
 * Creates a new quat initialized with values from an existing quaternion
 *
 * @param {ReadonlyQuat} a quaternion to clone
 * @returns {quat} a new quaternion
 * @function
 */
exports.clone = vec4.clone;

/**
 * Creates a new quat initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} a new quaternion
 * @function
 */
exports.fromValues = vec4.fromValues;

/**
 * Copy the values from one quat to another
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the source quaternion
 * @returns {quat} out
 * @function
 */
exports.copy = vec4.copy;

/**
 * Set the components of a quat to the given values
 *
 * @param {quat} out the receiving quaternion
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} out
 * @function
 */
exports.set = vec4.set;

/**
 * Adds two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @returns {quat} out
 * @function
 */
exports.add = vec4.add;

/**
 * Alias for {@link quat.multiply}
 * @function
 */
exports.mul = exports.multiply;

const scale = vec4.scale;
/**
 * Scales a quat by a scalar number
 *
 * @param {quat} out the receiving vector
 * @param {ReadonlyQuat} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {quat} out
 * @function
 */
exports.scale = scale;

const dot = vec4.dot;
/**
 * Calculates the dot product of two quat's
 *
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @returns {Number} dot product of a and b
 * @function
 */
exports.dot = dot;

/**
 * Performs a linear interpolation between two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat} out
 * @function
 */
exports.lerp = vec4.lerp;

/**
 * Calculates the length of a quat
 *
 * @param {ReadonlyQuat} a vector to calculate length of
 * @returns {Number} length of a
 */
exports.length = vec4.length;

/**
 * Alias for {@link quat.length}
 * @function
 */
exports.len = vec4.length;

/**
 * Calculates the squared length of a quat
 *
 * @param {ReadonlyQuat} a vector to calculate squared length of
 * @returns {Number} squared length of a
 * @function
 */
exports.squaredLength = vec4.squaredLength;

/**
 * Alias for {@link quat.squaredLength}
 * @function
 */
exports.sqrLen = vec4.squaredLength;

const normalize = 
/**
 * Normalize a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quaternion to normalize
 * @returns {quat} out
 * @function
 */
exports.normalize = vec4.normalize;

/**
 * Returns whether or not the quaternions have exactly the same elements in the same position (when compared with ===)
 *
 * @param {ReadonlyQuat} a The first quaternion.
 * @param {ReadonlyQuat} b The second quaternion.
 * @returns {Boolean} True if the vectors are equal, false otherwise.
 */
exports.exactEquals = vec4.exactEquals;

/**
 * Returns whether or not the quaternions point approximately to the same direction.
 *
 * Both quaternions are assumed to be unit length.
 *
 * @param {ReadonlyQuat} a The first unit quaternion.
 * @param {ReadonlyQuat} b The second unit quaternion.
 * @returns {Boolean} True if the quaternions are equal, false otherwise.
 */
exports.equals = function(a, b) {
	return Math.abs(vec4.dot(a, b)) >= 1 - EPSILON;
};

/**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {ReadonlyVec3} a the initial vector
 * @param {ReadonlyVec3} b the destination vector
 * @returns {quat} out
 */
exports.rotationTo = (function () {
	let tmpvec3 = vec3.create();
	let xUnitVec3 = vec3.fromValues(1, 0, 0);
	let yUnitVec3 = vec3.fromValues(0, 1, 0);

	return function (out, a, b) {
		let dot = vec3.dot(a, b);
		if (dot < -0.999999) {
			vec3.cross(tmpvec3, xUnitVec3, a);
			if (vec3.len(tmpvec3) < 0.000001) vec3.cross(tmpvec3, yUnitVec3, a);
			vec3.normalize(tmpvec3, tmpvec3);
			setAxisAngle(out, tmpvec3, Math.PI);
			return out;
		} else if (dot > 0.999999) {
			out[0] = 0;
			out[1] = 0;
			out[2] = 0;
			out[3] = 1;
			return out;
		} else {
			vec3.cross(tmpvec3, a, b);
			out[0] = tmpvec3[0];
			out[1] = tmpvec3[1];
			out[2] = tmpvec3[2];
			out[3] = 1 + dot;
			return normalize(out, out);
		}
	};
})();

/**
 * Performs a spherical linear interpolation with two control points
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @param {ReadonlyQuat} c the third operand
 * @param {ReadonlyQuat} d the fourth operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat} out
 */
exports.sqlerp = (function () {
	let temp1 = exports.create();
	let temp2 = exports.create();

	return function (out, a, b, c, d, t) {
		slerp(temp1, a, d, t);
		slerp(temp2, b, c, t);
		slerp(out, temp1, temp2, 2 * t * (1 - t));

		return out;
	};
})();

/**
 * Sets the specified quaternion with values corresponding to the given
 * axes. Each axis is a vec3 and is expected to be unit length and
 * perpendicular to all other specified axes.
 *
 * @param {ReadonlyVec3} view  the vector representing the viewing direction
 * @param {ReadonlyVec3} right the vector representing the local "right" direction
 * @param {ReadonlyVec3} up    the vector representing the local "up" direction
 * @returns {quat} out
 */
exports.setAxes = (function () {
	let matr = mat3.create();

	return function (out, view, right, up) {
		matr[0] = right[0];
		matr[3] = right[1];
		matr[6] = right[2];

		matr[1] = up[0];
		matr[4] = up[1];
		matr[7] = up[2];

		matr[2] = -view[0];
		matr[5] = -view[1];
		matr[8] = -view[2];

		return normalize(out, fromMat3(out, matr));
	};
})();

/**
 * quat pool for minimising garbage allocation 
 */
exports.Pool = (function(){
	let stack = [];
	for (let i = 0; i < 5; i++) {
		stack.push(exports.create());
	}
	
	return {
		/**
		 * return a borrowed quat to the pool
		 * @param {quat}
		 */
		return: (q) => { stack.push(exports.identity(q)); },
		/**
		 * request a quat from the pool
		 * @returns {quat}
		 */
		request: () => {
			if (stack.length > 0) {
				return stack.pop();
			}
			return exports.create();
		}
	}
})();

/**
 * Tests if the provided quaternion is approximately equal to the identity quaternion
 * 
 * @param {quat} q the quaternion to test 
 * @returns {Boolean} true if the quaternion is approximately an identity quaternion
 */
exports.isIdentity = (q) => {
	return (equals(q[0], 0) && equals(q[1], 0) && equals(q[2], 0) && equals(q[3], 1));
};

/**
 * Rotate a quaternion using axis angle
 * 
 * @param {quat} out the receiving quaternion
 * @param {quat} q the quaternion to rotate
 * @param {Number} rad the number of radians to rotate the quaternion by
 * @param {vec3} axis the axis around which to rotate the quaternion
 */
exports.rotate = (function() {
	let i = exports.create();
	return (out, q, rad, axis) => {
		exports.setAxisAngle(i, axis, rad);
		return exports.multiply(out, i, q);
	};
})();

/**
 * Generate a set of local cartesian axes from a quaternion rotation
 * 
 * @param {quat} q the quaternion to generate the local axes from 
 * @param {vec3} localX the receiving vector for the local x axis 
 * @param {vec3} localY the receiving vector for the local y axis
 * @param {vec3} localZ  the receiving vector for the local z axis
 */
exports.localAxes = (q, localX, localY, localZ) => {
	vec3.transformQuat(localX, vec3.X, q);
	vec3.transformQuat(localY, vec3.Y, q);
	vec3.transformQuat(localZ, vec3.Z, q);
};

exports.IDENTITY = Object.freeze(exports.create());
},{"./common.js":12,"./mat3.js":15,"./vec3.js":20,"./vec4.js":21}],18:[function(require,module,exports){
const { ARRAY_TYPE, EPSILON } = require("./common.js");
const quat = require("./quat.js");
const mat4 = require("./mat4.js");

/**
 * Dual Quaternion<br>
 * Format: [real, dual]<br>
 * Quaternion format: XYZW<br>
 * Make sure to have normalized dual quaternions, otherwise the functions may not work as intended.<br>
 * @module quat2
 */

/**
 * Creates a new identity dual quat
 *
 * @returns {quat2} a new dual quaternion [real -> rotation, dual -> translation]
 */
exports.create = function() {
	let dq = new ARRAY_TYPE(8);
	dq[0] = 0;
	dq[1] = 0;
	dq[2] = 0;
	dq[4] = 0;
	dq[5] = 0;
	dq[6] = 0;
	dq[7] = 0;
	dq[3] = 1;
	return dq;
};

/**
 * Creates a new quat initialized with values from an existing quaternion
 *
 * @param {ReadonlyQuat2} a dual quaternion to clone
 * @returns {quat2} new dual quaternion
 * @function
 */
exports.clone = function(a) {
	let dq = new ARRAY_TYPE(8);
	dq[0] = a[0];
	dq[1] = a[1];
	dq[2] = a[2];
	dq[3] = a[3];
	dq[4] = a[4];
	dq[5] = a[5];
	dq[6] = a[6];
	dq[7] = a[7];
	return dq;
};

/**
 * Creates a new dual quat initialized with the given values
 *
 * @param {Number} x1 X component
 * @param {Number} y1 Y component
 * @param {Number} z1 Z component
 * @param {Number} w1 W component
 * @param {Number} x2 X component
 * @param {Number} y2 Y component
 * @param {Number} z2 Z component
 * @param {Number} w2 W component
 * @returns {quat2} new dual quaternion
 * @function
 */
exports.fromValues = function(x1, y1, z1, w1, x2, y2, z2, w2) {
	let dq = new ARRAY_TYPE(8);
	dq[0] = x1;
	dq[1] = y1;
	dq[2] = z1;
	dq[3] = w1;
	dq[4] = x2;
	dq[5] = y2;
	dq[6] = z2;
	dq[7] = w2;
	return dq;
};

/**
 * Creates a new dual quat from the given values (quat and translation)
 *
 * @param {Number} x1 X component
 * @param {Number} y1 Y component
 * @param {Number} z1 Z component
 * @param {Number} w1 W component
 * @param {Number} x2 X component (translation)
 * @param {Number} y2 Y component (translation)
 * @param {Number} z2 Z component (translation)
 * @returns {quat2} new dual quaternion
 * @function
 */
exports.fromRotationTranslationValues = function(x1, y1, z1, w1, x2, y2, z2) {
	let dq = new ARRAY_TYPE(8);
	dq[0] = x1;
	dq[1] = y1;
	dq[2] = z1;
	dq[3] = w1;
	let ax = x2 * 0.5,
		ay = y2 * 0.5,
		az = z2 * 0.5;
	dq[4] = ax * w1 + ay * z1 - az * y1;
	dq[5] = ay * w1 + az * x1 - ax * z1;
	dq[6] = az * w1 + ax * y1 - ay * x1;
	dq[7] = -ax * x1 - ay * y1 - az * z1;
	return dq;
};

const fromRotationTranslation = 
/**
 * Creates a dual quat from a quaternion and a translation
 *
 * @param {ReadonlyQuat2} dual quaternion receiving operation result
 * @param {ReadonlyQuat} q a normalized quaternion
 * @param {ReadonlyVec3} t translation vector
 * @returns {quat2} dual quaternion receiving operation result
 * @function
 */
exports.fromRotationTranslation = function(out, q, t) {
	let ax = t[0] * 0.5,
		ay = t[1] * 0.5,
		az = t[2] * 0.5,
		bx = q[0],
		by = q[1],
		bz = q[2],
		bw = q[3];
	out[0] = bx;
	out[1] = by;
	out[2] = bz;
	out[3] = bw;
	out[4] = ax * bw + ay * bz - az * by;
	out[5] = ay * bw + az * bx - ax * bz;
	out[6] = az * bw + ax * by - ay * bx;
	out[7] = -ax * bx - ay * by - az * bz;
	return out;
};

/**
 * Creates a dual quat from a translation
 *
 * @param {ReadonlyQuat2} dual quaternion receiving operation result
 * @param {ReadonlyVec3} t translation vector
 * @returns {quat2} dual quaternion receiving operation result
 * @function
 */
exports.fromTranslation = function(out, t) {
	out[0] = 0;
	out[1] = 0;
	out[2] = 0;
	out[3] = 1;
	out[4] = t[0] * 0.5;
	out[5] = t[1] * 0.5;
	out[6] = t[2] * 0.5;
	out[7] = 0;
	return out;
};

/**
 * Creates a dual quat from a quaternion
 *
 * @param {ReadonlyQuat2} dual quaternion receiving operation result
 * @param {ReadonlyQuat} q the quaternion
 * @returns {quat2} dual quaternion receiving operation result
 * @function
 */
exports.fromRotation = function(out, q) {
	out[0] = q[0];
	out[1] = q[1];
	out[2] = q[2];
	out[3] = q[3];
	out[4] = 0;
	out[5] = 0;
	out[6] = 0;
	out[7] = 0;
	return out;
};

/**
 * Creates a new dual quat from a matrix (4x4)
 *
 * @param {quat2} out the dual quaternion
 * @param {ReadonlyMat4} a the matrix
 * @returns {quat2} dual quat receiving operation result
 * @function
 */
exports.fromMat4 = function(out, a) {
	//TODO Optimize this
	let outer = quat.create();
	mat4.getRotation(outer, a);
	let t = new ARRAY_TYPE(3);
	mat4.getTranslation(t, a);
	fromRotationTranslation(out, outer, t);
	return out;
};

const copy = 
/**
 * Copy the values from one dual quat to another
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a the source dual quaternion
 * @returns {quat2} out
 * @function
 */
exports.copy = function(out, a) {
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[3];
	out[4] = a[4];
	out[5] = a[5];
	out[6] = a[6];
	out[7] = a[7];
	return out;
}

/**
 * Set a dual quat to the identity dual quaternion
 *
 * @param {quat2} out the receiving quaternion
 * @returns {quat2} out
 */
exports.identity = function(out) {
	out[0] = 0;
	out[1] = 0;
	out[2] = 0;
	out[3] = 1;
	out[4] = 0;
	out[5] = 0;
	out[6] = 0;
	out[7] = 0;
	return out;
};

/**
 * Set the components of a dual quat to the given values
 *
 * @param {quat2} out the receiving quaternion
 * @param {Number} x1 X component
 * @param {Number} y1 Y component
 * @param {Number} z1 Z component
 * @param {Number} w1 W component
 * @param {Number} x2 X component
 * @param {Number} y2 Y component
 * @param {Number} z2 Z component
 * @param {Number} w2 W component
 * @returns {quat2} out
 * @function
 */
exports.set = function(out, x1, y1, z1, w1, x2, y2, z2, w2) {
	out[0] = x1;
	out[1] = y1;
	out[2] = z1;
	out[3] = w1;

	out[4] = x2;
	out[5] = y2;
	out[6] = z2;
	out[7] = w2;
	return out;
};

/**
 * Gets the real part of a dual quat
 * @param  {quat} out real part
 * @param  {ReadonlyQuat2} a Dual Quaternion
 * @return {quat} real part
 */
exports.getReal = quat.copy;

/**
 * Gets the dual part of a dual quat
 * @param  {quat} out dual part
 * @param  {ReadonlyQuat2} a Dual Quaternion
 * @return {quat} dual part
 */
exports.getDual = function(out, a) {
	out[0] = a[4];
	out[1] = a[5];
	out[2] = a[6];
	out[3] = a[7];
	return out;
};

/**
 * Set the real component of a dual quat to the given quaternion
 *
 * @param {quat2} out the receiving quaternion
 * @param {ReadonlyQuat} q a quaternion representing the real part
 * @returns {quat2} out
 * @function
 */
exports.setReal = quat.copy;

/**
 * Set the dual component of a dual quat to the given quaternion
 *
 * @param {quat2} out the receiving quaternion
 * @param {ReadonlyQuat} q a quaternion representing the dual part
 * @returns {quat2} out
 * @function
 */
exports.setDual = function(out, q) {
	out[4] = q[0];
	out[5] = q[1];
	out[6] = q[2];
	out[7] = q[3];
	return out;
};

/**
 * Gets the translation of a normalized dual quat
 * @param  {vec3} out translation
 * @param  {ReadonlyQuat2} a Dual Quaternion to be decomposed
 * @return {vec3} translation
 */
exports.getTranslation = function(out, a) {
	let ax = a[4],
		ay = a[5],
		az = a[6],
		aw = a[7],
		bx = -a[0],
		by = -a[1],
		bz = -a[2],
		bw = a[3];
	out[0] = (ax * bw + aw * bx + ay * bz - az * by) * 2;
	out[1] = (ay * bw + aw * by + az * bx - ax * bz) * 2;
	out[2] = (az * bw + aw * bz + ax * by - ay * bx) * 2;
	return out;
};

/**
 * Translates a dual quat by the given vector
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a the dual quaternion to translate
 * @param {ReadonlyVec3} v vector to translate by
 * @returns {quat2} out
 */
exports.translate = function(out, a, v) {
	let ax1 = a[0],
		ay1 = a[1],
		az1 = a[2],
		aw1 = a[3],
		bx1 = v[0] * 0.5,
		by1 = v[1] * 0.5,
		bz1 = v[2] * 0.5,
		ax2 = a[4],
		ay2 = a[5],
		az2 = a[6],
		aw2 = a[7];
	out[0] = ax1;
	out[1] = ay1;
	out[2] = az1;
	out[3] = aw1;
	out[4] = aw1 * bx1 + ay1 * bz1 - az1 * by1 + ax2;
	out[5] = aw1 * by1 + az1 * bx1 - ax1 * bz1 + ay2;
	out[6] = aw1 * bz1 + ax1 * by1 - ay1 * bx1 + az2;
	out[7] = -ax1 * bx1 - ay1 * by1 - az1 * bz1 + aw2;
	return out;
};

/**
 * Rotates a dual quat around the X axis
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a the dual quaternion to rotate
 * @param {number} rad how far should the rotation be
 * @returns {quat2} out
 */
exports.rotateX = function(out, a, rad) {
	let bx = -a[0],
		by = -a[1],
		bz = -a[2],
		bw = a[3],
		ax = a[4],
		ay = a[5],
		az = a[6],
		aw = a[7],
		ax1 = ax * bw + aw * bx + ay * bz - az * by,
		ay1 = ay * bw + aw * by + az * bx - ax * bz,
		az1 = az * bw + aw * bz + ax * by - ay * bx,
		aw1 = aw * bw - ax * bx - ay * by - az * bz;
	quat.rotateX(out, a, rad);
	bx = out[0];
	by = out[1];
	bz = out[2];
	bw = out[3];
	out[4] = ax1 * bw + aw1 * bx + ay1 * bz - az1 * by;
	out[5] = ay1 * bw + aw1 * by + az1 * bx - ax1 * bz;
	out[6] = az1 * bw + aw1 * bz + ax1 * by - ay1 * bx;
	out[7] = aw1 * bw - ax1 * bx - ay1 * by - az1 * bz;
	return out;
};

/**
 * Rotates a dual quat around the Y axis
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a the dual quaternion to rotate
 * @param {number} rad how far should the rotation be
 * @returns {quat2} out
 */
exports.rotateY = function(out, a, rad) {
	let bx = -a[0],
		by = -a[1],
		bz = -a[2],
		bw = a[3],
		ax = a[4],
		ay = a[5],
		az = a[6],
		aw = a[7],
		ax1 = ax * bw + aw * bx + ay * bz - az * by,
		ay1 = ay * bw + aw * by + az * bx - ax * bz,
		az1 = az * bw + aw * bz + ax * by - ay * bx,
		aw1 = aw * bw - ax * bx - ay * by - az * bz;
	quat.rotateY(out, a, rad);
	bx = out[0];
	by = out[1];
	bz = out[2];
	bw = out[3];
	out[4] = ax1 * bw + aw1 * bx + ay1 * bz - az1 * by;
	out[5] = ay1 * bw + aw1 * by + az1 * bx - ax1 * bz;
	out[6] = az1 * bw + aw1 * bz + ax1 * by - ay1 * bx;
	out[7] = aw1 * bw - ax1 * bx - ay1 * by - az1 * bz;
	return out;
};

/**
 * Rotates a dual quat around the Z axis
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a the dual quaternion to rotate
 * @param {number} rad how far should the rotation be
 * @returns {quat2} out
 */
exports.rotateZ = function(out, a, rad) {
	let bx = -a[0],
		by = -a[1],
		bz = -a[2],
		bw = a[3],
		ax = a[4],
		ay = a[5],
		az = a[6],
		aw = a[7],
		ax1 = ax * bw + aw * bx + ay * bz - az * by,
		ay1 = ay * bw + aw * by + az * bx - ax * bz,
		az1 = az * bw + aw * bz + ax * by - ay * bx,
		aw1 = aw * bw - ax * bx - ay * by - az * bz;
	quat.rotateZ(out, a, rad);
	bx = out[0];
	by = out[1];
	bz = out[2];
	bw = out[3];
	out[4] = ax1 * bw + aw1 * bx + ay1 * bz - az1 * by;
	out[5] = ay1 * bw + aw1 * by + az1 * bx - ax1 * bz;
	out[6] = az1 * bw + aw1 * bz + ax1 * by - ay1 * bx;
	out[7] = aw1 * bw - ax1 * bx - ay1 * by - az1 * bz;
	return out;
};

/**
 * Rotates a dual quat by a given quaternion (a * q)
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a the dual quaternion to rotate
 * @param {ReadonlyQuat} q quaternion to rotate by
 * @returns {quat2} out
 */
exports.rotateByQuatAppend = function(out, a, q) {
	let qx = q[0],
		qy = q[1],
		qz = q[2],
		qw = q[3],
		ax = a[0],
		ay = a[1],
		az = a[2],
		aw = a[3];

	out[0] = ax * qw + aw * qx + ay * qz - az * qy;
	out[1] = ay * qw + aw * qy + az * qx - ax * qz;
	out[2] = az * qw + aw * qz + ax * qy - ay * qx;
	out[3] = aw * qw - ax * qx - ay * qy - az * qz;
	ax = a[4];
	ay = a[5];
	az = a[6];
	aw = a[7];
	out[4] = ax * qw + aw * qx + ay * qz - az * qy;
	out[5] = ay * qw + aw * qy + az * qx - ax * qz;
	out[6] = az * qw + aw * qz + ax * qy - ay * qx;
	out[7] = aw * qw - ax * qx - ay * qy - az * qz;
	return out;
};

/**
 * Rotates a dual quat by a given quaternion (q * a)
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat} q quaternion to rotate by
 * @param {ReadonlyQuat2} a the dual quaternion to rotate
 * @returns {quat2} out
 */
exports.rotateByQuatPrepend = function(out, q, a) {
	let qx = q[0],
		qy = q[1],
		qz = q[2],
		qw = q[3],
		bx = a[0],
		by = a[1],
		bz = a[2],
		bw = a[3];

	out[0] = qx * bw + qw * bx + qy * bz - qz * by;
	out[1] = qy * bw + qw * by + qz * bx - qx * bz;
	out[2] = qz * bw + qw * bz + qx * by - qy * bx;
	out[3] = qw * bw - qx * bx - qy * by - qz * bz;
	bx = a[4];
	by = a[5];
	bz = a[6];
	bw = a[7];
	out[4] = qx * bw + qw * bx + qy * bz - qz * by;
	out[5] = qy * bw + qw * by + qz * bx - qx * bz;
	out[6] = qz * bw + qw * bz + qx * by - qy * bx;
	out[7] = qw * bw - qx * bx - qy * by - qz * bz;
	return out;
};

/**
 * Rotates a dual quat around a given axis. Does the normalisation automatically
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a the dual quaternion to rotate
 * @param {ReadonlyVec3} axis the axis to rotate around
 * @param {Number} rad how far the rotation should be
 * @returns {quat2} out
 */
exports.rotateAroundAxis = function(out, a, axis, rad) {
	//Special case for rad = 0
	if (Math.abs(rad) < EPSILON) {
		return copy(out, a);
	}
	let axisLength = Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]);

	rad = rad * 0.5;
	let s = Math.sin(rad);
	let bx = (s * axis[0]) / axisLength;
	let by = (s * axis[1]) / axisLength;
	let bz = (s * axis[2]) / axisLength;
	let bw = Math.cos(rad);

	let ax1 = a[0],
		ay1 = a[1],
		az1 = a[2],
		aw1 = a[3];
	out[0] = ax1 * bw + aw1 * bx + ay1 * bz - az1 * by;
	out[1] = ay1 * bw + aw1 * by + az1 * bx - ax1 * bz;
	out[2] = az1 * bw + aw1 * bz + ax1 * by - ay1 * bx;
	out[3] = aw1 * bw - ax1 * bx - ay1 * by - az1 * bz;

	let ax = a[4],
		ay = a[5],
		az = a[6],
		aw = a[7];
	out[4] = ax * bw + aw * bx + ay * bz - az * by;
	out[5] = ay * bw + aw * by + az * bx - ax * bz;
	out[6] = az * bw + aw * bz + ax * by - ay * bx;
	out[7] = aw * bw - ax * bx - ay * by - az * bz;

	return out;
};

/**
 * Adds two dual quat's
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a the first operand
 * @param {ReadonlyQuat2} b the second operand
 * @returns {quat2} out
 * @function
 */
exports.add = function(out, a, b) {
	out[0] = a[0] + b[0];
	out[1] = a[1] + b[1];
	out[2] = a[2] + b[2];
	out[3] = a[3] + b[3];
	out[4] = a[4] + b[4];
	out[5] = a[5] + b[5];
	out[6] = a[6] + b[6];
	out[7] = a[7] + b[7];
	return out;
};

/**
 * Multiplies two dual quat's
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a the first operand
 * @param {ReadonlyQuat2} b the second operand
 * @returns {quat2} out
 */
exports.multiply = function(out, a, b) {
	let ax0 = a[0],
		ay0 = a[1],
		az0 = a[2],
		aw0 = a[3],
		bx1 = b[4],
		by1 = b[5],
		bz1 = b[6],
		bw1 = b[7],
		ax1 = a[4],
		ay1 = a[5],
		az1 = a[6],
		aw1 = a[7],
		bx0 = b[0],
		by0 = b[1],
		bz0 = b[2],
		bw0 = b[3];
	out[0] = ax0 * bw0 + aw0 * bx0 + ay0 * bz0 - az0 * by0;
	out[1] = ay0 * bw0 + aw0 * by0 + az0 * bx0 - ax0 * bz0;
	out[2] = az0 * bw0 + aw0 * bz0 + ax0 * by0 - ay0 * bx0;
	out[3] = aw0 * bw0 - ax0 * bx0 - ay0 * by0 - az0 * bz0;
	out[4] =
		ax0 * bw1 +
		aw0 * bx1 +
		ay0 * bz1 -
		az0 * by1 +
		ax1 * bw0 +
		aw1 * bx0 +
		ay1 * bz0 -
		az1 * by0;
	out[5] =
		ay0 * bw1 +
		aw0 * by1 +
		az0 * bx1 -
		ax0 * bz1 +
		ay1 * bw0 +
		aw1 * by0 +
		az1 * bx0 -
		ax1 * bz0;
	out[6] =
		az0 * bw1 +
		aw0 * bz1 +
		ax0 * by1 -
		ay0 * bx1 +
		az1 * bw0 +
		aw1 * bz0 +
		ax1 * by0 -
		ay1 * bx0;
	out[7] =
		aw0 * bw1 -
		ax0 * bx1 -
		ay0 * by1 -
		az0 * bz1 +
		aw1 * bw0 -
		ax1 * bx0 -
		ay1 * by0 -
		az1 * bz0;
	return out;
};

/**
 * Alias for {@link quat2.multiply}
 * @function
 */
exports.mul = exports.multiply;

/**
 * Scales a dual quat by a scalar number
 *
 * @param {quat2} out the receiving dual quat
 * @param {ReadonlyQuat2} a the dual quat to scale
 * @param {Number} b amount to scale the dual quat by
 * @returns {quat2} out
 * @function
 */
exports.scale = function(out, a, b) {
	out[0] = a[0] * b;
	out[1] = a[1] * b;
	out[2] = a[2] * b;
	out[3] = a[3] * b;
	out[4] = a[4] * b;
	out[5] = a[5] * b;
	out[6] = a[6] * b;
	out[7] = a[7] * b;
	return out;
};

const dot = quat.dot;
/**
 * Calculates the dot product of two dual quat's (The dot product of the real parts)
 *
 * @param {ReadonlyQuat2} a the first operand
 * @param {ReadonlyQuat2} b the second operand
 * @returns {Number} dot product of a and b
 * @function
 */
exports.dot = quat.dot;

/**
 * Performs a linear interpolation between two dual quats's
 * NOTE: The resulting dual quaternions won't always be normalized (The error is most noticeable when t = 0.5)
 *
 * @param {quat2} out the receiving dual quat
 * @param {ReadonlyQuat2} a the first operand
 * @param {ReadonlyQuat2} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat2} out
 */
exports.lerp = function(out, a, b, t) {
	let mt = 1 - t;
	if (dot(a, b) < 0) t = -t;

	out[0] = a[0] * mt + b[0] * t;
	out[1] = a[1] * mt + b[1] * t;
	out[2] = a[2] * mt + b[2] * t;
	out[3] = a[3] * mt + b[3] * t;
	out[4] = a[4] * mt + b[4] * t;
	out[5] = a[5] * mt + b[5] * t;
	out[6] = a[6] * mt + b[6] * t;
	out[7] = a[7] * mt + b[7] * t;

	return out;
};

/**
 * Calculates the inverse of a dual quat. If they are normalized, conjugate is cheaper
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a dual quat to calculate inverse of
 * @returns {quat2} out
 */
exports.invert = function(out, a) {
	let sqlen = squaredLength(a);
	out[0] = -a[0] / sqlen;
	out[1] = -a[1] / sqlen;
	out[2] = -a[2] / sqlen;
	out[3] = a[3] / sqlen;
	out[4] = -a[4] / sqlen;
	out[5] = -a[5] / sqlen;
	out[6] = -a[6] / sqlen;
	out[7] = a[7] / sqlen;
	return out;
};

/**
 * Calculates the conjugate of a dual quat
 * If the dual quaternion is normalized, this function is faster than quat2.inverse and produces the same result.
 *
 * @param {quat2} out the receiving quaternion
 * @param {ReadonlyQuat2} a quat to calculate conjugate of
 * @returns {quat2} out
 */
exports.conjugate = function(out, a) {
	out[0] = -a[0];
	out[1] = -a[1];
	out[2] = -a[2];
	out[3] = a[3];
	out[4] = -a[4];
	out[5] = -a[5];
	out[6] = -a[6];
	out[7] = a[7];
	return out;
};

/**
 * Calculates the length of a dual quat
 *
 * @param {ReadonlyQuat2} a dual quat to calculate length of
 * @returns {Number} length of a
 * @function
 */
exports.length = quat.length;

/**
 * Alias for {@link quat2.length}
 * @function
 */
exports.len = quat.length;

const squaredLength = quat.squaredLength;
/**
 * Calculates the squared length of a dual quat
 *
 * @param {ReadonlyQuat2} a dual quat to calculate squared length of
 * @returns {Number} squared length of a
 * @function
 */
exports.squaredLength = quat.squaredLength;

/**
 * Alias for {@link quat2.squaredLength}
 * @function
 */
exports.sqrLen = squaredLength;

/**
 * Normalize a dual quat
 *
 * @param {quat2} out the receiving dual quaternion
 * @param {ReadonlyQuat2} a dual quaternion to normalize
 * @returns {quat2} out
 * @function
 */
exports.normalize = function(out, a) {
	let magnitude = squaredLength(a);
	if (magnitude > 0) {
		magnitude = Math.sqrt(magnitude);

		let a0 = a[0] / magnitude;
		let a1 = a[1] / magnitude;
		let a2 = a[2] / magnitude;
		let a3 = a[3] / magnitude;

		let b0 = a[4];
		let b1 = a[5];
		let b2 = a[6];
		let b3 = a[7];

		let a_dot_b = a0 * b0 + a1 * b1 + a2 * b2 + a3 * b3;

		out[0] = a0;
		out[1] = a1;
		out[2] = a2;
		out[3] = a3;

		out[4] = (b0 - a0 * a_dot_b) / magnitude;
		out[5] = (b1 - a1 * a_dot_b) / magnitude;
		out[6] = (b2 - a2 * a_dot_b) / magnitude;
		out[7] = (b3 - a3 * a_dot_b) / magnitude;
	}
	return out;
};

/**
 * Returns a string representation of a dual quaternion
 *
 * @param {ReadonlyQuat2} a dual quaternion to represent as a string
 * @returns {String} string representation of the dual quat
 */
exports.str = function(a) {
	return (
		"quat2(" +
		a[0] +
		", " +
		a[1] +
		", " +
		a[2] +
		", " +
		a[3] +
		", " +
		a[4] +
		", " +
		a[5] +
		", " +
		a[6] +
		", " +
		a[7] +
		")"
	);
};

/**
 * Returns whether or not the dual quaternions have exactly the same elements in the same position (when compared with ===)
 *
 * @param {ReadonlyQuat2} a the first dual quaternion.
 * @param {ReadonlyQuat2} b the second dual quaternion.
 * @returns {Boolean} true if the dual quaternions are equal, false otherwise.
 */
exports.exactEquals = function(a, b) {
	return (
		a[0] === b[0] &&
		a[1] === b[1] &&
		a[2] === b[2] &&
		a[3] === b[3] &&
		a[4] === b[4] &&
		a[5] === b[5] &&
		a[6] === b[6] &&
		a[7] === b[7]
	);
};

/**
 * Returns whether or not the dual quaternions have approximately the same elements in the same position.
 *
 * @param {ReadonlyQuat2} a the first dual quat.
 * @param {ReadonlyQuat2} b the second dual quat.
 * @returns {Boolean} true if the dual quats are equal, false otherwise.
 */
exports.equals = function(a, b) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3],
		a4 = a[4],
		a5 = a[5],
		a6 = a[6],
		a7 = a[7];
	let b0 = b[0],
		b1 = b[1],
		b2 = b[2],
		b3 = b[3],
		b4 = b[4],
		b5 = b[5],
		b6 = b[6],
		b7 = b[7];
	return (
		Math.abs(a0 - b0) <=
			EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
		Math.abs(a1 - b1) <=
			EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) &&
		Math.abs(a2 - b2) <=
			EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2)) &&
		Math.abs(a3 - b3) <=
			EPSILON * Math.max(1.0, Math.abs(a3), Math.abs(b3)) &&
		Math.abs(a4 - b4) <=
			EPSILON * Math.max(1.0, Math.abs(a4), Math.abs(b4)) &&
		Math.abs(a5 - b5) <=
			EPSILON * Math.max(1.0, Math.abs(a5), Math.abs(b5)) &&
		Math.abs(a6 - b6) <=
			EPSILON * Math.max(1.0, Math.abs(a6), Math.abs(b6)) &&
		Math.abs(a7 - b7) <=
			EPSILON * Math.max(1.0, Math.abs(a7), Math.abs(b7))
	);
};
},{"./common.js":12,"./mat4.js":16,"./quat.js":17}],19:[function(require,module,exports){
const { ARRAY_TYPE, EPSILON, RANDOM, round } = require("./common.js");

/**
 * 2 Dimensional Vector
 * @module vec2
 */

/**
 * Creates a new, empty vec2
 *
 * @returns {vec2} a new 2D vector
 */
exports.create = function() {
	let out = new ARRAY_TYPE(2);
	out[0] = 0;
	out[1] = 0;
	return out;
};

/**
 * Creates a new vec2 initialized with values from an existing vector
 *
 * @param {ReadonlyVec2} a vector to clone
 * @returns {vec2} a new 2D vector
 */
exports.clone = function(a) {
	let out = new ARRAY_TYPE(2);
	out[0] = a[0];
	out[1] = a[1];
	return out;
};

/**
 * Creates a new vec2 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} a new 2D vector
 */
exports.fromValues = function(x, y) {
	let out = new ARRAY_TYPE(2);
	out[0] = x;
	out[1] = y;
	return out;
};

/**
 * Copy the values from one vec2 to another
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the source vector
 * @returns {vec2} out
 */
exports.copy = function(out, a) {
	out[0] = a[0];
	out[1] = a[1];
	return out;
};

/**
 * Set the components of a vec2 to the given values
 *
 * @param {vec2} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} out
 */
exports.set = function(out, x, y) {
	out[0] = x;
	out[1] = y;
	return out;
};

/**
 * Adds two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec2} out
 */
exports.add = function(out, a, b) {
	out[0] = a[0] + b[0];
	out[1] = a[1] + b[1];
	return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec2} out
 */
exports.subtract = function(out, a, b) {
	out[0] = a[0] - b[0];
	out[1] = a[1] - b[1];
	return out;
};

/**
 * Multiplies two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec2} out
 */
exports.multiply = function(out, a, b) {
	out[0] = a[0] * b[0];
	out[1] = a[1] * b[1];
	return out;
};

/**
 * Divides two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec2} out
 */
exports.divide = function(out, a, b) {
	out[0] = a[0] / b[0];
	out[1] = a[1] / b[1];
	return out;
};

/**
 * Math.ceil the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a vector to ceil
 * @returns {vec2} out
 */
exports.ceil = function(out, a) {
	out[0] = Math.ceil(a[0]);
	out[1] = Math.ceil(a[1]);
	return out;
};

/**
 * Math.floor the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a vector to floor
 * @returns {vec2} out
 */
exports.floor = function(out, a) {
	out[0] = Math.floor(a[0]);
	out[1] = Math.floor(a[1]);
	return out;
};

/**
 * Returns the minimum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec2} out
 */
exports.min = function(out, a, b) {
	out[0] = Math.min(a[0], b[0]);
	out[1] = Math.min(a[1], b[1]);
	return out;
};

/**
 * Returns the maximum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec2} out
 */
exports.max = function(out, a, b) {
	out[0] = Math.max(a[0], b[0]);
	out[1] = Math.max(a[1], b[1]);
	return out;
};

/**
 * symmetric round the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a vector to round
 * @returns {vec2} out
 */
exports.round = function(out, a) {
	out[0] = round(a[0]);
	out[1] = round(a[1]);
	return out;
};

/**
 * Scales a vec2 by a scalar number
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec2} out
 */
exports.scale = function(out, a, b) {
	out[0] = a[0] * b;
	out[1] = a[1] * b;
	return out;
};

/**
 * Adds two vec2's after scaling the second operand by a scalar value
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec2} out
 */
exports.scaleAndAdd = function(out, a, b, scale) {
	out[0] = a[0] + b[0] * scale;
	out[1] = a[1] + b[1] * scale;
	return out;
};

/**
 * Calculates the euclidian distance between two vec2's
 *
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {Number} distance between a and b
 */
exports.distance = function(a, b) {
	var x = b[0] - a[0],
		y = b[1] - a[1];
	return Math.sqrt(x * x + y * y);
};

/**
 * Calculates the squared euclidian distance between two vec2's
 *
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {Number} squared distance between a and b
 */
exports.squaredDistance = function(a, b) {
	var x = b[0] - a[0],
		y = b[1] - a[1];
	return x * x + y * y;
};

/**
 * Calculates the length of a vec2
 *
 * @param {ReadonlyVec2} a vector to calculate length of
 * @returns {Number} length of a
 */
exports.length = function(a) {
	var x = a[0],
		y = a[1];
	return Math.sqrt(x * x + y * y);
};

/**
 * Calculates the squared length of a vec2
 *
 * @param {ReadonlyVec2} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
exports.squaredLength = function(a) {
	var x = a[0],
		y = a[1];
	return x * x + y * y;
};

/**
 * Negates the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a vector to negate
 * @returns {vec2} out
 */
exports.negate = function(out, a) {
	out[0] = -a[0];
	out[1] = -a[1];
	return out;
};

/**
 * Returns the inverse of the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a vector to invert
 * @returns {vec2} out
 */
exports.inverse = function(out, a) {
	out[0] = 1.0 / a[0];
	out[1] = 1.0 / a[1];
	return out;
};

/**
 * Normalize a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a vector to normalize
 * @returns {vec2} out
 */
exports.normalize = function(out, a) {
	var x = a[0],
		y = a[1];
	var len = x * x + y * y;
	if (len > 0) {
		//TODO: evaluate use of glm_invsqrt here?
		len = 1 / Math.sqrt(len);
	}
	out[0] = a[0] * len;
	out[1] = a[1] * len;
	return out;
};

/**
 * Calculates the dot product of two vec2's
 *
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {Number} dot product of a and b
 */
exports.dot = function(a, b) {
	return a[0] * b[0] + a[1] * b[1];
};

/**
 * Computes the cross product of two vec2's
 * Note that the cross product must by definition produce a 3D vector
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec3} out
 */
exports.cross = function(out, a, b) {
	var z = a[0] * b[1] - a[1] * b[0];
	out[0] = out[1] = 0;
	out[2] = z;
	return out;
};

/**
 * Performs a linear interpolation between two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec2} out
 */
exports.lerp = function(out, a, b, t) {
	var ax = a[0],
		ay = a[1];
	out[0] = ax + t * (b[0] - ax);
	out[1] = ay + t * (b[1] - ay);
	return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec2} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If omitted, a unit vector will be returned
 * @returns {vec2} out
 */
exports.random = function(out, scale) {
	scale = scale === undefined ? 1.0 : scale;
	var r = RANDOM() * 2.0 * Math.PI;
	out[0] = Math.cos(r) * scale;
	out[1] = Math.sin(r) * scale;
	return out;
};

/**
 * Transforms the vec2 with a mat2
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the vector to transform
 * @param {ReadonlyMat2} m matrix to transform with
 * @returns {vec2} out
 */
exports.transformMat2 = function(out, a, m) {
	var x = a[0],
		y = a[1];
	out[0] = m[0] * x + m[2] * y;
	out[1] = m[1] * x + m[3] * y;
	return out;
};

/**
 * Transforms the vec2 with a mat2d
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the vector to transform
 * @param {ReadonlyMat2d} m matrix to transform with
 * @returns {vec2} out
 */
exports.transformMat2d = function(out, a, m) {
	var x = a[0],
		y = a[1];
	out[0] = m[0] * x + m[2] * y + m[4];
	out[1] = m[1] * x + m[3] * y + m[5];
	return out;
};

/**
 * Transforms the vec2 with a mat3
 * 3rd vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the vector to transform
 * @param {ReadonlyMat3} m matrix to transform with
 * @returns {vec2} out
 */
exports.transformMat3 = function(out, a, m) {
	var x = a[0],
		y = a[1];
	out[0] = m[0] * x + m[3] * y + m[6];
	out[1] = m[1] * x + m[4] * y + m[7];
	return out;
};

/**
 * Transforms the vec2 with a mat4
 * 3rd vector component is implicitly '0'
 * 4th vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec2} out
 */
exports.transformMat4 = function(out, a, m) {
	let x = a[0];
	let y = a[1];
	out[0] = m[0] * x + m[4] * y + m[12];
	out[1] = m[1] * x + m[5] * y + m[13];
	return out;
};

/**
 * Rotate a 2D vector
 * @param {vec2} out The receiving vec2
 * @param {ReadonlyVec2} a The vec2 point to rotate
 * @param {ReadonlyVec2} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec2} out
 */
exports.rotate = function(out, a, b, rad) {
	//Translate point to the origin
	let p0 = a[0] - b[0],
		p1 = a[1] - b[1],
		sinC = Math.sin(rad),
		cosC = Math.cos(rad);

	//perform rotation and translate to correct position
	out[0] = p0 * cosC - p1 * sinC + b[0];
	out[1] = p0 * sinC + p1 * cosC + b[1];

	return out;
};

/**
 * Get the angle between two 2D vectors
 * @param {ReadonlyVec2} a The first operand
 * @param {ReadonlyVec2} b The second operand
 * @returns {Number} The angle in radians
 */
exports.angle = function(a, b) {
	let x1 = a[0],
		y1 = a[1],
		x2 = b[0],
		y2 = b[1],
		// mag is the product of the magnitudes of a and b
		mag = Math.sqrt((x1 * x1 + y1 * y1) * (x2 * x2 + y2 * y2)),
		// mag &&.. short circuits if mag == 0
		cosine = mag && (x1 * x2 + y1 * y2) / mag;
	// Math.min(Math.max(cosine, -1), 1) clamps the cosine between -1 and 1
	return Math.acos(Math.min(Math.max(cosine, -1), 1));
};

/**
 * Set the components of a vec2 to zero
 *
 * @param {vec2} out the receiving vector
 * @returns {vec2} out
 */
exports.zero = function(out) {
	out[0] = 0.0;
	out[1] = 0.0;
	return out;
};

/**
 * Returns a string representation of a vector
 *
 * @param {ReadonlyVec2} a vector to represent as a string
 * @returns {String} string representation of the vector
 */
exports.str = function(a) {
	return "vec2(" + a[0] + ", " + a[1] + ")";
};

/**
 * Returns whether or not the vectors exactly have the same elements in the same position (when compared with ===)
 *
 * @param {ReadonlyVec2} a The first vector.
 * @param {ReadonlyVec2} b The second vector.
 * @returns {Boolean} True if the vectors are equal, false otherwise.
 */
exports.exactEquals = function(a, b) {
	return a[0] === b[0] && a[1] === b[1];
};

/**
 * Returns whether or not the vectors have approximately the same elements in the same position.
 *
 * @param {ReadonlyVec2} a The first vector.
 * @param {ReadonlyVec2} b The second vector.
 * @returns {Boolean} True if the vectors are equal, false otherwise.
 */
exports.equals = function(a, b) {
	let a0 = a[0],
		a1 = a[1];
	let b0 = b[0],
		b1 = b[1];
	return (
		Math.abs(a0 - b0) <=
			EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
		Math.abs(a1 - b1) <=
			EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1))
	);
};

/**
 * Alias for {@link vec2.length}
 * @function
 */
exports.len = exports.length;

/**
 * Alias for {@link vec2.subtract}
 * @function
 */
exports.sub = exports.subtract;

/**
 * Alias for {@link vec2.multiply}
 * @function
 */
exports.mul = exports.multiply;

/**
 * Alias for {@link vec2.divide}
 * @function
 */
exports.div = exports.divide;

/**
 * Alias for {@link vec2.distance}
 * @function
 */
exports.dist = exports.distance;

/**
 * Alias for {@link vec2.squaredDistance}
 * @function
 */
exports.sqrDist = exports.squaredDistance;

/**
 * Alias for {@link vec2.squaredLength}
 * @function
 */
exports.sqrLen = exports.squaredLength;

/**
 * Perform some operation over an array of vec2s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
exports.forEach = (function() {
	let vec = exports.create();

	return function(a, stride, offset, count, fn, arg) {
		let i, l;
		if (!stride) {
			stride = 2;
		}

		if (!offset) {
			offset = 0;
		}

		if (count) {
			l = Math.min(count * stride + offset, a.length);
		} else {
			l = a.length;
		}

		for (i = offset; i < l; i += stride) {
			vec[0] = a[i];
			vec[1] = a[i + 1];
			fn(vec, vec, arg);
			a[i] = vec[0];
			a[i + 1] = vec[1];
		}

		return a;
	};
})();

/**
 * vec2 pool for minimising garbage allocation 
 */
exports.Pool = (function(){
	let stack = [];
	for (let i = 0; i < 5; i++) {
		stack.push(exports.create());
	}
	
	return {
		/**
		 * return a borrowed vec2 to the pool
		 * @param {vec2}
		 */
		return: (v) => { stack.push(exports.zero(v)); },
		/**
		 * request a vec2 from the pool
		 * @returns {vec2}
		 */
		request: () => {
			if (stack.length > 0) {
				return stack.pop();
			}
			return exports.create();
		}
	}
})();

exports.ZERO = Object.freeze(exports.create());
exports.ONE = Object.freeze(exports.fromValues(1,1));
exports.X = Object.freeze(exports.fromValues(1,0));
exports.Y = Object.freeze(exports.fromValues(0,1));
exports.NEG_X = Object.freeze(exports.fromValues(-1,0));
exports.NEG_Y = Object.freeze(exports.fromValues(0,-1));
},{"./common.js":12}],20:[function(require,module,exports){
const { ARRAY_TYPE, EPSILON, RANDOM, round } = require("./common.js");

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */
exports.create = function() {
	let out = new ARRAY_TYPE(3);
	out[0] = 0;
	out[1] = 0;
	out[2] = 0;
	return out;
};

/**
 * Creates a new vec3 initialized with values from an existing vector
 *
 * @param {ReadonlyVec3} a vector to clone
 * @returns {vec3} a new 3D vector
 */
exports.clone = function(a) {
	var out = new ARRAY_TYPE(3);
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	return out;
};

/**
 * Calculates the length of a vec3
 *
 * @param {ReadonlyVec3} a vector to calculate length of
 * @returns {Number} length of a
 */
exports.length = function(a) {
	let x = a[0];
	let y = a[1];
	let z = a[2];
	return Math.sqrt(x * x + y * y + z * z);
};

/**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */
exports.fromValues = function(x, y, z) {
	let out = new ARRAY_TYPE(3);
	out[0] = x;
	out[1] = y;
	out[2] = z;
	return out;
};

/**
 * Copy the values from one vec3 to another
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the source vector
 * @returns {vec3} out
 */
exports.copy = function(out, a) {
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	return out;
};

/**
 * Set the components of a vec3 to the given values
 *
 * @param {vec3} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} out
 */
exports.set = function(out, x, y, z) {
	out[0] = x;
	out[1] = y;
	out[2] = z;
	return out;
};

/**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */
exports.add = function(out, a, b) {
	out[0] = a[0] + b[0];
	out[1] = a[1] + b[1];
	out[2] = a[2] + b[2];
	return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */
exports.subtract = function(out, a, b) {
	out[0] = a[0] - b[0];
	out[1] = a[1] - b[1];
	out[2] = a[2] - b[2];
	return out;
};

/**
 * Multiplies two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */
exports.multiply = function(out, a, b) {
	out[0] = a[0] * b[0];
	out[1] = a[1] * b[1];
	out[2] = a[2] * b[2];
	return out;
};

/**
 * Divides two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */
exports.divide = function(out, a, b) {
	out[0] = a[0] / b[0];
	out[1] = a[1] / b[1];
	out[2] = a[2] / b[2];
	return out;
};

/**
 * Math.ceil the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to ceil
 * @returns {vec3} out
 */
exports.ceil = function(out, a) {
	out[0] = Math.ceil(a[0]);
	out[1] = Math.ceil(a[1]);
	out[2] = Math.ceil(a[2]);
	return out;
};

/**
 * Math.floor the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to floor
 * @returns {vec3} out
 */
exports.floor = function(out, a) {
	out[0] = Math.floor(a[0]);
	out[1] = Math.floor(a[1]);
	out[2] = Math.floor(a[2]);
	return out;
};

/**
 * Returns the minimum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */
exports.min = function(out, a, b) {
	out[0] = Math.min(a[0], b[0]);
	out[1] = Math.min(a[1], b[1]);
	out[2] = Math.min(a[2], b[2]);
	return out;
};

/**
 * Returns the maximum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */
exports.max = function(out, a, b) {
	out[0] = Math.max(a[0], b[0]);
	out[1] = Math.max(a[1], b[1]);
	out[2] = Math.max(a[2], b[2]);
	return out;
};

/**
 * symmetric round the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to round
 * @returns {vec3} out
 */
exports.round = function(out, a) {
	out[0] = round(a[0]);
	out[1] = round(a[1]);
	out[2] = round(a[2]);
	return out;
};

/**
 * Scales a vec3 by a scalar number
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec3} out
 */
exports.scale = function(out, a, b) {
	out[0] = a[0] * b;
	out[1] = a[1] * b;
	out[2] = a[2] * b;
	return out;
};

/**
 * Scales a vec3 by a scale number in X and Y axes only
 * @param {vec3} out the receiving vector 
 * @param {ReadonlyVec3} a the vector to scale 
 * @param {Number} b amount to scale the vector by 
 * @returns {vec3} out 
 */
exports.scaleXY = function(out, a, b) {
	out[0] = a[0] * b;
	out[1] = a[1] * b;
	out[2] = a[2];
	return out;
};

/**
 * Scales a vec3 by a scale number in X and Z axes only
 * @param {vec3} out the receiving vector 
 * @param {ReadonlyVec3} a the vector to scale 
 * @param {Number} b amount to scale the vector by 
 * @returns {vec3} out 
 */
exports.scaleXZ = function(out, a, b) {
	out[0] = a[0] * b;
	out[1] = a[1];
	out[2] = a[2] * b;
	return out;
};

/**
 * Scales a vec3 by a scale number in Y and Z axes only
 * @param {vec3} out the receiving vector 
 * @param {ReadonlyVec3} a the vector to scale 
 * @param {Number} b amount to scale the vector by 
 * @returns {vec3} out 
 */
exports.scaleYZ = function(out, a, b) {
	out[0] = a[0];
	out[1] = a[1] * b;
	out[2] = a[2] * b;
	return out;
};

/**
 * Adds two vec3's after scaling the second operand by a scalar value
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec3} out
 */
exports.scaleAndAdd = function(out, a, b, scale) {
	out[0] = a[0] + b[0] * scale;
	out[1] = a[1] + b[1] * scale;
	out[2] = a[2] + b[2] * scale;
	return out;
};

/**
 * Calculates the euclidian distance between two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} distance between a and b
 */
exports.distance = function(a, b) {
	let x = b[0] - a[0];
	let y = b[1] - a[1];
	let z = b[2] - a[2];
	return Math.sqrt(x * x + y * y + z * z);
};

/**
 * Calculates the squared euclidian distance between two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} squared distance between a and b
 */
exports.squaredDistance = function(a, b) {
	let x = b[0] - a[0];
	let y = b[1] - a[1];
	let z = b[2] - a[2];
	return x * x + y * y + z * z;
};

/**
 * Calculates the squared length of a vec3
 *
 * @param {ReadonlyVec3} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
exports.squaredLength = function(a) {
	let x = a[0];
	let y = a[1];
	let z = a[2];
	return x * x + y * y + z * z;
};

/**
 * Negates the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to negate
 * @returns {vec3} out
 */
exports.negate = function(out, a) {
	out[0] = -a[0];
	out[1] = -a[1];
	out[2] = -a[2];
	return out;
};

/**
 * Returns the inverse of the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to invert
 * @returns {vec3} out
 */
exports.inverse = function(out, a) {
	out[0] = 1.0 / a[0];
	out[1] = 1.0 / a[1];
	out[2] = 1.0 / a[2];
	return out;
};

/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to normalize
 * @returns {vec3} out
 */
exports.normalize = function(out, a) {
	let x = a[0];
	let y = a[1];
	let z = a[2];
	let len = x * x + y * y + z * z;
	if (len > 0) {
		//TODO: evaluate use of glm_invsqrt here?
		len = 1 / Math.sqrt(len);
	}
	out[0] = a[0] * len;
	out[1] = a[1] * len;
	out[2] = a[2] * len;
	return out;
};

/**
 * Calculates the dot product of two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} dot product of a and b
 */
exports.dot = function(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */
exports.cross = function(out, a, b) {
	let ax = a[0],
		ay = a[1],
		az = a[2];
	let bx = b[0],
		by = b[1],
		bz = b[2];

	out[0] = ay * bz - az * by;
	out[1] = az * bx - ax * bz;
	out[2] = ax * by - ay * bx;
	return out;
};

/**
 * Performs a linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec3} out
 */
exports.lerp = function(out, a, b, t) {
	let ax = a[0];
	let ay = a[1];
	let az = a[2];
	out[0] = ax + t * (b[0] - ax);
	out[1] = ay + t * (b[1] - ay);
	out[2] = az + t * (b[2] - az);
	return out;
};

/**
 * Performs a spherical linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec3} out
 */
exports.slerp = function(out, a, b, t) {
	let angle = Math.acos(Math.min(Math.max(dot(a, b), -1), 1));
	let sinTotal = Math.sin(angle);

	let ratioA = Math.sin((1 - t) * angle) / sinTotal;
	let ratioB = Math.sin(t * angle) / sinTotal;
	out[0] = ratioA * a[0] + ratioB * b[0];
	out[1] = ratioA * a[1] + ratioB * b[1];
	out[2] = ratioA * a[2] + ratioB * b[2];

	return out;
};

/**
 * Performs a hermite interpolation with two control points
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {ReadonlyVec3} c the third operand
 * @param {ReadonlyVec3} d the fourth operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec3} out
 */
exports.hermite = function(out, a, b, c, d, t) {
	let factorTimes2 = t * t;
	let factor1 = factorTimes2 * (2 * t - 3) + 1;
	let factor2 = factorTimes2 * (t - 2) + t;
	let factor3 = factorTimes2 * (t - 1);
	let factor4 = factorTimes2 * (3 - 2 * t);

	out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
	out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
	out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;

	return out;
};

/**
 * Performs a bezier interpolation with two control points
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {ReadonlyVec3} c the third operand
 * @param {ReadonlyVec3} d the fourth operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec3} out
 */
exports.bezier = function(out, a, b, c, d, t) {
	let inverseFactor = 1 - t;
	let inverseFactorTimesTwo = inverseFactor * inverseFactor;
	let factorTimes2 = t * t;
	let factor1 = inverseFactorTimesTwo * inverseFactor;
	let factor2 = 3 * t * inverseFactorTimesTwo;
	let factor3 = 3 * factorTimes2 * inverseFactor;
	let factor4 = factorTimes2 * t;

	out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
	out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
	out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;

	return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec3} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If omitted, a unit vector will be returned
 * @returns {vec3} out
 */
exports.random = function(out, scale) {
	scale = scale === undefined ? 1.0 : scale;

	let r = RANDOM() * 2.0 * Math.PI;
	let z = RANDOM() * 2.0 - 1.0;
	let zScale = Math.sqrt(1.0 - z * z) * scale;

	out[0] = Math.cos(r) * zScale;
	out[1] = Math.sin(r) * zScale;
	out[2] = z * scale;
	return out;
};

/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec3} out
 */
exports.transformMat4 = function(out, a, m) {
	let x = a[0],
		y = a[1],
		z = a[2];
	let w = m[3] * x + m[7] * y + m[11] * z + m[15];
	w = w || 1.0;
	out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
	out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
	out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
	return out;
};

/**
 * Transforms the vec3 with a mat3.
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat3} m the 3x3 matrix to transform with
 * @returns {vec3} out
 */
exports.transformMat3 = function(out, a, m) {
	let x = a[0],
		y = a[1],
		z = a[2];
	out[0] = x * m[0] + y * m[3] + z * m[6];
	out[1] = x * m[1] + y * m[4] + z * m[7];
	out[2] = x * m[2] + y * m[5] + z * m[8];
	return out;
};

/**
 * Transforms the vec3 with a quat
 * Can also be used for dual quaternions. (Multiply it with the real part)
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyQuat} q quaternion to transform with
 * @returns {vec3} out
 */
exports.transformQuat = function(out, a, q) {
	// benchmarks: https://jsperf.com/quaternion-transform-vec3-implementations-fixed
	let qx = q[0],
		qy = q[1],
		qz = q[2],
		qw = q[3];
	let x = a[0],
		y = a[1],
		z = a[2];
	// var qvec = [qx, qy, qz];
	// var uv = vec3.cross([], qvec, a);
	let uvx = qy * z - qz * y,
		uvy = qz * x - qx * z,
		uvz = qx * y - qy * x;
	// var uuv = vec3.cross([], qvec, uv);
	let uuvx = qy * uvz - qz * uvy,
		uuvy = qz * uvx - qx * uvz,
		uuvz = qx * uvy - qy * uvx;
	// vec3.scale(uv, uv, 2 * w);
	let w2 = qw * 2;
	uvx *= w2;
	uvy *= w2;
	uvz *= w2;
	// vec3.scale(uuv, uuv, 2);
	uuvx *= 2;
	uuvy *= 2;
	uuvz *= 2;
	// return vec3.add(out, a, vec3.add(out, uv, uuv));
	out[0] = x + uvx + uuvx;
	out[1] = y + uvy + uuvy;
	out[2] = z + uvz + uuvz;
	return out;
};

/**
 * Rotate a 3D vector around the x-axis
 * @param {vec3} out The receiving vec3
 * @param {ReadonlyVec3} a The vec3 point to rotate
 * @param {ReadonlyVec3} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec3} out
 */
exports.rotateX = function(out, a, b, rad) {
	let p = [],
		r = [];
	//Translate point to the origin
	p[0] = a[0] - b[0];
	p[1] = a[1] - b[1];
	p[2] = a[2] - b[2];

	//perform rotation
	r[0] = p[0];
	r[1] = p[1] * Math.cos(rad) - p[2] * Math.sin(rad);
	r[2] = p[1] * Math.sin(rad) + p[2] * Math.cos(rad);

	//translate to correct position
	out[0] = r[0] + b[0];
	out[1] = r[1] + b[1];
	out[2] = r[2] + b[2];

	return out;
};

/**
 * Rotate a 3D vector around the y-axis
 * @param {vec3} out The receiving vec3
 * @param {ReadonlyVec3} a The vec3 point to rotate
 * @param {ReadonlyVec3} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec3} out
 */
exports.rotateY = function(out, a, b, rad) {
	let p = [],
		r = [];
	//Translate point to the origin
	p[0] = a[0] - b[0];
	p[1] = a[1] - b[1];
	p[2] = a[2] - b[2];

	//perform rotation
	r[0] = p[2] * Math.sin(rad) + p[0] * Math.cos(rad);
	r[1] = p[1];
	r[2] = p[2] * Math.cos(rad) - p[0] * Math.sin(rad);

	//translate to correct position
	out[0] = r[0] + b[0];
	out[1] = r[1] + b[1];
	out[2] = r[2] + b[2];

	return out;
};

/**
 * Rotate a 3D vector around the z-axis
 * @param {vec3} out The receiving vec3
 * @param {ReadonlyVec3} a The vec3 point to rotate
 * @param {ReadonlyVec3} b The origin of the rotation
 * @param {Number} rad The angle of rotation in radians
 * @returns {vec3} out
 */
exports.rotateZ = function(out, a, b, rad) {
	let p = [],
		r = [];
	//Translate point to the origin
	p[0] = a[0] - b[0];
	p[1] = a[1] - b[1];
	p[2] = a[2] - b[2];

	//perform rotation
	r[0] = p[0] * Math.cos(rad) - p[1] * Math.sin(rad);
	r[1] = p[0] * Math.sin(rad) + p[1] * Math.cos(rad);
	r[2] = p[2];

	//translate to correct position
	out[0] = r[0] + b[0];
	out[1] = r[1] + b[1];
	out[2] = r[2] + b[2];

	return out;
};

/**
 * Get the angle between two 3D vectors
 * @param {ReadonlyVec3} a The first operand
 * @param {ReadonlyVec3} b The second operand
 * @returns {Number} The angle in radians
 */
exports.angle = function(a, b) {
	let ax = a[0],
		ay = a[1],
		az = a[2],
		bx = b[0],
		by = b[1],
		bz = b[2],
		mag = Math.sqrt((ax * ax + ay * ay + az * az) * (bx * bx + by * by + bz * bz)),
		cosine = mag && dot(a, b) / mag;
	return Math.acos(Math.min(Math.max(cosine, -1), 1));
};

/**
 * Set the components of a vec3 to zero
 *
 * @param {vec3} out the receiving vector
 * @returns {vec3} out
 */
exports.zero = function(out) {
	out[0] = 0.0;
	out[1] = 0.0;
	out[2] = 0.0;
	return out;
};

/**
 * Returns a string representation of a vector
 *
 * @param {ReadonlyVec3} a vector to represent as a string
 * @returns {String} string representation of the vector
 */
exports.str = function(a) {
	return "vec3(" + a[0] + ", " + a[1] + ", " + a[2] + ")";
};

/**
 * Returns whether or not the vectors have exactly the same elements in the same position (when compared with ===)
 *
 * @param {ReadonlyVec3} a The first vector.
 * @param {ReadonlyVec3} b The second vector.
 * @returns {Boolean} True if the vectors are equal, false otherwise.
 */
exports.exactEquals = function(a, b) {
	return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
};

/**
 * Returns whether or not the vectors have approximately the same elements in the same position.
 *
 * @param {ReadonlyVec3} a The first vector.
 * @param {ReadonlyVec3} b The second vector.
 * @returns {Boolean} True if the vectors are equal, false otherwise.
 */
exports.equals = function(a, b) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2];
	let b0 = b[0],
		b1 = b[1],
		b2 = b[2];
	return (
		Math.abs(a0 - b0) <=
			EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
		Math.abs(a1 - b1) <=
			EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) &&
		Math.abs(a2 - b2) <=
			EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2))
	);
};

/**
 * Alias for {@link vec3.subtract}
 * @function
 */
exports.sub = exports.subtract;

/**
 * Alias for {@link vec3.multiply}
 * @function
 */
exports.mul = exports.multiply;

/**
 * Alias for {@link vec3.divide}
 * @function
 */
exports.div = exports.divide;

/**
 * Alias for {@link vec3.distance}
 * @function
 */
exports.dist = exports.distance;

/**
 * Alias for {@link vec3.squaredDistance}
 * @function
 */
exports.sqrDist = exports.squaredDistance;

/**
 * Alias for {@link vec3.length}
 * @function
 */
exports.len = exports.length;

/**
 * Alias for {@link vec3.squaredLength}
 * @function
 */
exports.sqrLen = exports.squaredLength;

/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
exports.forEach = (function () {
	let vec = exports.create();

	return function (a, stride, offset, count, fn, arg) {
		let i, l;
		if (!stride) {
			stride = 3;
		}

		if (!offset) {
			offset = 0;
		}

		if (count) {
			l = Math.min(count * stride + offset, a.length);
		} else {
			l = a.length;
		}

		for (i = offset; i < l; i += stride) {
			vec[0] = a[i];
			vec[1] = a[i + 1];
			vec[2] = a[i + 2];
			fn(vec, vec, arg);
			a[i] = vec[0];
			a[i + 1] = vec[1];
			a[i + 2] = vec[2];
		}

		return a;
	};
})();

/**
 * vec3 pool for minimising garbage allocation 
 */
exports.Pool = (function(){
	let stack = [];
	for (let i = 0; i < 5; i++) {
		stack.push(exports.create());
	}
	
	return {
		/**
		 * return a borrowed vec3 to the pool
		 * @param {vec3}
		 */
		return: (v) => { stack.push(exports.zero(v)); },
		/**
		 * request a vec3 from the pool
		 * @returns {vec3}
		 */
		request: () => {
			if (stack.length > 0) {
				return stack.pop();
			}
			return exports.create();
		}
	}
})();

// vec3 extensions adapated from https://graemepottsfolio.wordpress.com/2015/11/26/vectors-programming/

exports.moveTowards = (() => {
	let delta = exports.create();
	return (out, a, b, maxDelta) => {
		exports.subtract(delta, b, a);
		let sqrLen = exports.squaredDistance(a, b); 
		let sqrMaxDelta = maxDelta * maxDelta;
		if (sqrMaxDelta >= sqrLen) {
			exports.copy(out, b);
		} else {
			exports.scaleAndAdd(out, a, delta, maxDelta / Math.sqrt(sqrLen));
		}
	}; 
})();

exports.smoothDamp = (() => {
	let delta = exports.create();
	let temp = exports.create();
	return (out, a, b, velocity, smoothTime, maxSpeed, elapsed) => { // Q: Should have outVelocity?
		if (exports.equals(a, b)) {
			exports.copy(out, b);
		} else {
			// Derivation: https://graemepottsfolio.wordpress.com/2016/01/11/game-programming-math-libraries/
			smoothTime = Math.max(0.0001, smoothTime); // minimum smooth time of 0.0001
			let omega = 2.0 / smoothTime;
			let x = omega * elapsed;
			let exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.245 * x * x * x);
			exports.subtract(delta, a, b);
			let length = exports.length(delta);
			let maxDelta = maxSpeed * smoothTime;

			let deltaX = Math.min(length, maxDelta);
			exports.scale(delta, delta, deltaX / length);

			// temp = (velocity + omega * delta) * elapsed
			exports.scaleAndAdd(temp, velocity, delta, omega);
			exports.scale(temp, temp, elapsed);

			// velocity = (velocity - omega * temp) * exp
			exports.scaleAndAdd(velocity, velocity, temp, -omega);
			exports.scale(velocity, velocity, exp);

			// out = a - delta + (delta + temp) * exp;
			exports.sub(out, a, delta);
			exports.scaleAndAdd(out, out, delta, exp);
			exports.scaleAndAdd(out, out, temp, exp);

			// Ensure we don't overshoot
			if (exports.sqrDist(b, a) <= exports.sqrDist(out, a)) {
				exports.copy(out, b);
				exports.zero(velocity);
			}
		}
	};
})();

exports.ZERO = Object.freeze(exports.create());
exports.ONE = Object.freeze(exports.fromValues(1,1,1));
exports.X = Object.freeze(exports.fromValues(1,0,0));
exports.Y = Object.freeze(exports.fromValues(0,1,0));
exports.Z = Object.freeze(exports.fromValues(0,0,1));
exports.NEG_X = Object.freeze(exports.fromValues(-1,0,0));
exports.NEG_Y = Object.freeze(exports.fromValues(0,-1,0));
exports.NEG_Z = Object.freeze(exports.fromValues(0,0,-1));
},{"./common.js":12}],21:[function(require,module,exports){
const { ARRAY_TYPE, EPSILON, RANDOM, round } = require("./common.js");

/**
 * 4 Dimensional Vector
 * @module vec4
 */

/**
 * Creates a new, empty vec4
 *
 * @returns {vec4} a new 4D vector
 */
exports.create = function() {
	let out = new ARRAY_TYPE(4);
	out[0] = 0;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	return out;
};

/**
 * Creates a new vec4 initialized with values from an existing vector
 *
 * @param {ReadonlyVec4} a vector to clone
 * @returns {vec4} a new 4D vector
 */
exports.clone = function(a) {
	let out = new ARRAY_TYPE(4);
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[3];
	return out;
};

/**
 * Creates a new vec4 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} a new 4D vector
 */
exports.fromValues = function(x, y, z, w) {
	let out = new ARRAY_TYPE(4);
	out[0] = x;
	out[1] = y;
	out[2] = z;
	out[3] = w;
	return out;
};

/**
 * Copy the values from one vec4 to another
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the source vector
 * @returns {vec4} out
 */
exports.copy = function(out, a) {
	out[0] = a[0];
	out[1] = a[1];
	out[2] = a[2];
	out[3] = a[3];
	return out;
};

/**
 * Set the components of a vec4 to the given values
 *
 * @param {vec4} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} out
 */
exports.set = function(out, x, y, z, w) {
	out[0] = x;
	out[1] = y;
	out[2] = z;
	out[3] = w;
	return out;
};

/**
 * Adds two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @returns {vec4} out
 */
exports.add = function(out, a, b) {
	out[0] = a[0] + b[0];
	out[1] = a[1] + b[1];
	out[2] = a[2] + b[2];
	out[3] = a[3] + b[3];
	return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @returns {vec4} out
 */
exports.subtract = function(out, a, b) {
	out[0] = a[0] - b[0];
	out[1] = a[1] - b[1];
	out[2] = a[2] - b[2];
	out[3] = a[3] - b[3];
	return out;
};

/**
 * Multiplies two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @returns {vec4} out
 */
exports.multiply = function(out, a, b) {
	out[0] = a[0] * b[0];
	out[1] = a[1] * b[1];
	out[2] = a[2] * b[2];
	out[3] = a[3] * b[3];
	return out;
};

/**
 * Divides two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @returns {vec4} out
 */
exports.divide = function(out, a, b) {
	out[0] = a[0] / b[0];
	out[1] = a[1] / b[1];
	out[2] = a[2] / b[2];
	out[3] = a[3] / b[3];
	return out;
};

/**
 * Math.ceil the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a vector to ceil
 * @returns {vec4} out
 */
exports.ceil = function(out, a) {
	out[0] = Math.ceil(a[0]);
	out[1] = Math.ceil(a[1]);
	out[2] = Math.ceil(a[2]);
	out[3] = Math.ceil(a[3]);
	return out;
};

/**
 * Math.floor the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a vector to floor
 * @returns {vec4} out
 */
exports.floor = function(out, a) {
	out[0] = Math.floor(a[0]);
	out[1] = Math.floor(a[1]);
	out[2] = Math.floor(a[2]);
	out[3] = Math.floor(a[3]);
	return out;
};

/**
 * Returns the minimum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @returns {vec4} out
 */
exports.min = function(out, a, b) {
	out[0] = Math.min(a[0], b[0]);
	out[1] = Math.min(a[1], b[1]);
	out[2] = Math.min(a[2], b[2]);
	out[3] = Math.min(a[3], b[3]);
	return out;
};

/**
 * Returns the maximum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @returns {vec4} out
 */
exports.max = function(out, a, b) {
	out[0] = Math.max(a[0], b[0]);
	out[1] = Math.max(a[1], b[1]);
	out[2] = Math.max(a[2], b[2]);
	out[3] = Math.max(a[3], b[3]);
	return out;
};

/**
 * symmetric round the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a vector to round
 * @returns {vec4} out
 */
exports.round = function(out, a) {
	out[0] = round(a[0]);
	out[1] = round(a[1]);
	out[2] = round(a[2]);
	out[3] = round(a[3]);
	return out;
};

/**
 * Scales a vec4 by a scalar number
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec4} out
 */
exports.scale = function(out, a, b) {
	out[0] = a[0] * b;
	out[1] = a[1] * b;
	out[2] = a[2] * b;
	out[3] = a[3] * b;
	return out;
};

/**
 * Adds two vec4's after scaling the second operand by a scalar value
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec4} out
 */
exports.scaleAndAdd = function(out, a, b, scale) {
	out[0] = a[0] + b[0] * scale;
	out[1] = a[1] + b[1] * scale;
	out[2] = a[2] + b[2] * scale;
	out[3] = a[3] + b[3] * scale;
	return out;
};

/**
 * Calculates the euclidian distance between two vec4's
 *
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @returns {Number} distance between a and b
 */
exports.distance = function(a, b) {
	let x = b[0] - a[0];
	let y = b[1] - a[1];
	let z = b[2] - a[2];
	let w = b[3] - a[3];
	return Math.sqrt(x * x + y * y + z * z + w * w);
};

/**
 * Calculates the squared euclidian distance between two vec4's
 *
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @returns {Number} squared distance between a and b
 */
exports.squaredDistance = function(a, b) {
	let x = b[0] - a[0];
	let y = b[1] - a[1];
	let z = b[2] - a[2];
	let w = b[3] - a[3];
	return x * x + y * y + z * z + w * w;
};

/**
 * Calculates the length of a vec4
 *
 * @param {ReadonlyVec4} a vector to calculate length of
 * @returns {Number} length of a
 */
exports.length = function(a) {
	let x = a[0];
	let y = a[1];
	let z = a[2];
	let w = a[3];
	return Math.sqrt(x * x + y * y + z * z + w * w);
};

/**
 * Calculates the squared length of a vec4
 *
 * @param {ReadonlyVec4} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
exports.squaredLength = function(a) {
	let x = a[0];
	let y = a[1];
	let z = a[2];
	let w = a[3];
	return x * x + y * y + z * z + w * w;
};

/**
 * Negates the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a vector to negate
 * @returns {vec4} out
 */
exports.negate = function(out, a) {
	out[0] = -a[0];
	out[1] = -a[1];
	out[2] = -a[2];
	out[3] = -a[3];
	return out;
};

/**
 * Returns the inverse of the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a vector to invert
 * @returns {vec4} out
 */
exports.inverse = function(out, a) {
	out[0] = 1.0 / a[0];
	out[1] = 1.0 / a[1];
	out[2] = 1.0 / a[2];
	out[3] = 1.0 / a[3];
	return out;
};

/**
 * Normalize a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a vector to normalize
 * @returns {vec4} out
 */
exports.normalize = function(out, a) {
	let x = a[0];
	let y = a[1];
	let z = a[2];
	let w = a[3];
	let len = x * x + y * y + z * z + w * w;
	if (len > 0) {
		len = 1 / Math.sqrt(len);
	}
	out[0] = x * len;
	out[1] = y * len;
	out[2] = z * len;
	out[3] = w * len;
	return out;
};

/**
 * Calculates the dot product of two vec4's
 *
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @returns {Number} dot product of a and b
 */
exports.dot = function(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
};

/**
 * Returns the cross-product of three vectors in a 4-dimensional space
 *
 * @param {ReadonlyVec4} result the receiving vector
 * @param {ReadonlyVec4} U the first vector
 * @param {ReadonlyVec4} V the second vector
 * @param {ReadonlyVec4} W the third vector
 * @returns {vec4} result
 */
exports.cross = function(out, u, v, w) {
	let A = v[0] * w[1] - v[1] * w[0],
		B = v[0] * w[2] - v[2] * w[0],
		C = v[0] * w[3] - v[3] * w[0],
		D = v[1] * w[2] - v[2] * w[1],
		E = v[1] * w[3] - v[3] * w[1],
		F = v[2] * w[3] - v[3] * w[2];
	let G = u[0];
	let H = u[1];
	let I = u[2];
	let J = u[3];

	out[0] = H * F - I * E + J * D;
	out[1] = -(G * F) + I * C - J * B;
	out[2] = G * E - H * C + J * A;
	out[3] = -(G * D) + H * B - I * A;

	return out;
};

/**
 * Performs a linear interpolation between two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the first operand
 * @param {ReadonlyVec4} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec4} out
 */
exports.lerp = function(out, a, b, t) {
	let ax = a[0];
	let ay = a[1];
	let az = a[2];
	let aw = a[3];
	out[0] = ax + t * (b[0] - ax);
	out[1] = ay + t * (b[1] - ay);
	out[2] = az + t * (b[2] - az);
	out[3] = aw + t * (b[3] - aw);
	return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec4} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If omitted, a unit vector will be returned
 * @returns {vec4} out
 */
exports.random = function(out, scale) {
	scale = scale === undefined ? 1.0 : scale;

	// Marsaglia, George. Choosing a Point from the Surface of a
	// Sphere. Ann. Math. Statist. 43 (1972), no. 2, 645--646.
	// http://projecteuclid.org/euclid.aoms/1177692644;
	var v1, v2, v3, v4;
	var s1, s2;
	var rand;
	
	rand = RANDOM();
	v1 = rand * 2 - 1;
	v2 = (4 * RANDOM() - 2) * Math.sqrt(rand * -rand + rand);
	s1 = v1 * v1 + v2 * v2;

	rand = RANDOM();
	v3 = rand * 2 - 1;
	v4 = (4 * RANDOM() - 2) * Math.sqrt(rand * -rand + rand);
	s2 = v3 * v3 + v4 * v4;

	var d = Math.sqrt((1 - s1) / s2);
	out[0] = scale * v1;
	out[1] = scale * v2;
	out[2] = scale * v3 * d;
	out[3] = scale * v4 * d;
	return out;
};

/**
 * Transforms the vec4 with a mat4.
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec4} out
 */
exports.transformMat4 = function(out, a, m) {
	let x = a[0],
		y = a[1],
		z = a[2],
		w = a[3];
	out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
	out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
	out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
	out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
	return out;
};

/**
 * Transforms the vec4 with a quat
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the vector to transform
 * @param {ReadonlyQuat} q quaternion to transform with
 * @returns {vec4} out
 */
exports.transformQuat = function(out, a, q) {
	let x = a[0],
		y = a[1],
		z = a[2];
	let qx = q[0],
		qy = q[1],
		qz = q[2],
		qw = q[3];

	// calculate quat * vec
	let ix = qw * x + qy * z - qz * y;
	let iy = qw * y + qz * x - qx * z;
	let iz = qw * z + qx * y - qy * x;
	let iw = -qx * x - qy * y - qz * z;

	// calculate result * inverse quat
	out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
	out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
	out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
	out[3] = a[3];
	return out;
};

/**
 * Set the components of a vec4 to zero
 *
 * @param {vec4} out the receiving vector
 * @returns {vec4} out
 */
exports.zero = function(out) {
	out[0] = 0.0;
	out[1] = 0.0;
	out[2] = 0.0;
	out[3] = 0.0;
	return out;
};

/**
 * Returns a string representation of a vector
 *
 * @param {ReadonlyVec4} a vector to represent as a string
 * @returns {String} string representation of the vector
 */
exports.str = function(a) {
	return "vec4(" + a[0] + ", " + a[1] + ", " + a[2] + ", " + a[3] + ")";
};

/**
 * Returns whether or not the vectors have exactly the same elements in the same position (when compared with ===)
 *
 * @param {ReadonlyVec4} a The first vector.
 * @param {ReadonlyVec4} b The second vector.
 * @returns {Boolean} True if the vectors are equal, false otherwise.
 */
exports.exactEquals = function(a, b) {
	return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
};

/**
 * Returns whether or not the vectors have approximately the same elements in the same position.
 *
 * @param {ReadonlyVec4} a The first vector.
 * @param {ReadonlyVec4} b The second vector.
 * @returns {Boolean} True if the vectors are equal, false otherwise.
 */
exports.equals = function(a, b) {
	let a0 = a[0],
		a1 = a[1],
		a2 = a[2],
		a3 = a[3];
	let b0 = b[0],
		b1 = b[1],
		b2 = b[2],
		b3 = b[3];
	return (
		Math.abs(a0 - b0) <=
			EPSILON * Math.max(1.0, Math.abs(a0), Math.abs(b0)) &&
		Math.abs(a1 - b1) <=
			EPSILON * Math.max(1.0, Math.abs(a1), Math.abs(b1)) &&
		Math.abs(a2 - b2) <=
			EPSILON * Math.max(1.0, Math.abs(a2), Math.abs(b2)) &&
		Math.abs(a3 - b3) <=
			EPSILON * Math.max(1.0, Math.abs(a3), Math.abs(b3))
	);
};

/**
 * Alias for {@link vec4.subtract}
 * @function
 */
exports.sub = exports.subtract;

/**
 * Alias for {@link vec4.multiply}
 * @function
 */
exports.mul = exports.multiply;

/**
 * Alias for {@link vec4.divide}
 * @function
 */
exports.div = exports.divide;

/**
 * Alias for {@link vec4.distance}
 * @function
 */
exports.dist = exports.distance;

/**
 * Alias for {@link vec4.squaredDistance}
 * @function
 */
exports.sqrDist = exports.squaredDistance;

/**
 * Alias for {@link vec4.length}
 * @function
 */
exports.len = exports.length;

/**
 * Alias for {@link vec4.squaredLength}
 * @function
 */
exports.sqrLen = exports.squaredLength;

/**
 * Perform some operation over an array of vec4s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec4s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
exports.forEach = (function() {
	let vec = exports.create();

	return function(a, stride, offset, count, fn, arg) {
		let i, l;
		if (!stride) {
			stride = 4;
		}

		if (!offset) {
			offset = 0;
		}

		if (count) {
			l = Math.min(count * stride + offset, a.length);
		} else {
			l = a.length;
		}

		for (i = offset; i < l; i += stride) {
			vec[0] = a[i];
			vec[1] = a[i + 1];
			vec[2] = a[i + 2];
			vec[3] = a[i + 3];
			fn(vec, vec, arg);
			a[i] = vec[0];
			a[i + 1] = vec[1];
			a[i + 2] = vec[2];
			a[i + 3] = vec[3];
		}

		return a;
	};
})();

/**
 * vec4 pool for minimising garbage allocation 
 */
exports.Pool = (function(){
	let stack = [];
	for (let i = 0; i < 5; i++) {
		stack.push(exports.create());
	}
	
	return {
		/**
		 * return a borrowed vec4 to the pool
		 * @param {vec4}
		 */
		return: (v) => { stack.push(exports.zero(v)); },
		/**
		 * request a vec4 from the pool
		 * @returns {vec4}
		 */
		request: () => {
			if (stack.length > 0) {
				return stack.pop();
			}
			return exports.create();
		}
	}
})();

exports.ZERO = Object.freeze(exports.create());
},{"./common.js":12}],22:[function(require,module,exports){
const r = require('./renderer');
const Bounds = require('./bounds');
const vec3 = require('./maths').vec3;
const Utils = require('./utils');

module.exports = (function(){
	let exports = {};

	let calculateMinPoint = exports.calculateMinPoint = function(out, positions) {
		let i, l, v1 = Number.MAX_VALUE, v2 = Number.MAX_VALUE, v3 = Number.MAX_VALUE;
		for (i = 0, l = positions.length; i < l; i += 3) {
			v1 = Math.min(v1, positions[i]);
			v2 = Math.min(v2, positions[i+1]);
			v3 = Math.min(v3, positions[i+2]);
		}
		out[0] = v1, out[1] = v2, out[2] = v3;
	};

	let calculateMaxPoint = exports.calculateMaxPoint = function(out, positions) {
		let i, l, v1 = Number.MIN_VALUE, v2 = Number.MIN_VALUE, v3 = Number.MIN_VALUE;
		for (i = 0, l = positions.length; i < l; i += 3) {
			v1 = Math.max(v1, positions[i]);
			v2 = Math.max(v2, positions[i+1]);
			v3 = Math.max(v3, positions[i+2]);
		}
		out[0] = v1, out[1] = v2, out[2] = v3;
	};

	// Returns the furthest vertex from the local origin
	// Note this is not the same as the furthest from the mid-point of the vertices positions
	// This is necessray for the boundingRadius to remain accurate under rotation
	let calculateBoundingRadius = function(positions) {
		var sqrResult = 0;
		for (let i = 0, l = positions.length; i< l; i += 3) {
			let sqrDistance = positions[i] * positions[i]
				+ positions[i + 1] * positions[i + 1]
				+ positions[i + 2] * positions[i + 2];
			if (sqrDistance > sqrResult) {
				sqrResult = sqrDistance;
			}
		}
		return Math.sqrt(sqrResult);
	};

	let createBuffer = function(data, size, indexed) {
		if (data.length > 65535) {
			console.warn("buffer contains more than 16-bit max number of points, rendering may be truncated");
		}
		if (data.buffer) {
			if (!indexed) {
				return r.createArrayBuffer(data, size);
			} else {
				return r.createElementArrayBuffer(data, size);
			}
		} else {
			return r.createBuffer(data, size, indexed);
		}
	};

	let calculateBounds = exports.calculateBounds = function(mesh, positions) {
		mesh.boundingRadius = calculateBoundingRadius(positions);
		calculateMinPoint(mesh.bounds.min, positions);
		calculateMaxPoint(mesh.bounds.max, positions);
		mesh.bounds.recalculateExtents();
	};

	// TODO: Method to calculate normals from vertex information + winding info

	exports.create = function(config) {
		let mesh = {};

		mesh.bounds = Bounds.create({ min: vec3.create(), max: vec3.create() });
		mesh.boundingRadius = 0;

		update(mesh, config, true);

		return mesh;
	};

	let update = exports.update = function(mesh, config, firstBuild) {
		if (config) {
			if (config.renderMode !== undefined) {
				mesh.renderMode = config.renderMode;
			} else if (mesh.renderMode === undefined) {
				mesh.renderMode = r.RenderMode.Triangles;
			}

			let { positions, uvs, normals, indices, customAttributes } = config;

			if (positions) {
				calculateBounds(mesh, positions);
				mesh.vertexBuffer = createBuffer(positions, 3); // this should be renamed to positionBuffer
			}
			if (uvs) {
				mesh.textureBuffer = createBuffer(uvs, 2);
			}
			if (normals) {
				mesh.normalBuffer = createBuffer(normals, 3);
			}
			if (indices) {
				mesh.indexed = true;
				mesh.indexBuffer = createBuffer(indices, 1, true);
			} else {
				mesh.indexed = false;
			}

			if (customAttributes && customAttributes.length) {
				for (let i = 0, l = customAttributes.length; i < l; i++) {
					let { name, source, size } = customAttributes[i];
					if (!firstBuild || !mesh[name]) {
						let data = config[source];
						if (data.buffer) {
							mesh[name] = r.createArrayBuffer(data, size);
						} else {
							mesh[name] = r.createBuffer(data, size);
						}
					} else {
						console.error("Duplicate definition of '" + name + "' in mesh configuration " + JSON.stringify(customAttributes));
					}
				}
			}
		}
	};

	exports.combineConfig = function(meshes) {
		let result = { positions: [], normals: [], uvs: [], indices: [] };
		for (let i = 0, l = meshes.length; i < l; i++) {
			let mesh = meshes[i];
			let indexOffset = result.positions.length / 3;
			Utils.arrayCombine(result.positions, mesh.positions);
			Utils.arrayCombine(result.normals, mesh.normals);
			Utils.arrayCombine(result.uvs, mesh.uvs);
			for (let index = 0, n = mesh.indices.length; index < n; index++) {
				result.indices.push(mesh.indices[index] + indexOffset);
			}
		}
		return result;
	};

	return exports;
})();
},{"./bounds":2,"./maths":11,"./renderer":29,"./utils":37}],23:[function(require,module,exports){
const { vec3, quat } = require('./maths');
const Transform = require('./transform');
const Mesh = require('./mesh');
const Texture = require('./texture');
const Material = require('./material');

module.exports = (function() {
	let exports = {};

	let buildMeshData = (json, meshIndex, buffers) => {
		let meshData = {};

		// TODO: Load TANGENT, JOINTS_n & WEIGHTS_n once supported by Fury.Mesh
		// c.f. https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#meshes-overview

		let primitive = json.meshes[meshIndex].primitives[0];
		// TODO: Consider support for multiple primitives
		// Note createSceneHierarchy has single primitive assumption baked

		let attributes = primitive.attributes;
		let positionIndex = attributes.POSITION;	// index into accessors
		let normalsIndex = attributes.NORMAL;		// index into accessors
		let uvIndex = attributes.TEXCOORD_0;		// index into accessors
		// TODO: Load all sets of texture coordinates
		let colorIndices = [];

		let propertyName = "COLOR_";
		let propertyNameIndex = 0;
		while (attributes.hasOwnProperty(propertyName + propertyNameIndex)) {
			colorIndices.push(attributes[propertyName + propertyNameIndex]);
			propertyNameIndex++;
		}

		let indicesIndex = primitive.indices;
		// ^^ I think this is the index and not the index count, should check with a more complex / varied model

		// Calculate bounding radius
		let max = json.accessors[positionIndex].max;
		let min = json.accessors[positionIndex].min;
		let maxPointSqrDistance = max[0]*max[0] + max[1]*max[1] + max[2]*max[2];
		let minPointSqrDistance = min[0]*min[0] + min[1]*min[1] + min[2]*min[2];
		meshData.boundingRadius = Math.sqrt(Math.max(maxPointSqrDistance, minPointSqrDistance));

		let vertexCount = json.accessors[positionIndex].count;
		let positionBufferView = json.bufferViews[json.accessors[positionIndex].bufferView];

		let indexCount = json.accessors[indicesIndex].count;
		let indicesBufferView = json.bufferViews[json.accessors[indicesIndex].bufferView];

		let normalsCount, uvCount;
		let normalsBufferView, uvBufferView;

		if (normalsIndex !== undefined) {
			normalsCount = json.accessors[normalsIndex].count;
			normalsBufferView = json.bufferViews[json.accessors[normalsIndex].bufferView];
		}

		if (uvIndex !== undefined) {
			uvCount = json.accessors[uvIndex].count;
			uvBufferView = json.bufferViews[json.accessors[uvIndex].bufferView];
		}

		let colorsCounts = [];
		let colorsBufferViews = [];

		for (let i = 0, l = colorIndices.length; i < l; i++) {
			let colorIndex = colorIndices[i];
			let accessor = json.accessors[colorIndex];
			colorsCounts[i] = accessor.count;
			colorsBufferViews[i] = json.bufferViews[accessor.bufferView];
		}

		// TODO: pick typedarray type from accessors[index].componentType (5126 => Float32, 5123 => Int16 - see renderer.DataType)
		// TODO: Get size from data from accessors[index].type rather than hardcoding
		meshData.positions = new Float32Array(buffers[positionBufferView.buffer], positionBufferView.byteOffset, vertexCount * 3);

		if (normalsIndex !== undefined) {
			meshData.normals = new Float32Array(buffers[normalsBufferView.buffer], normalsBufferView.byteOffset, normalsCount * 3);
		}

		if (uvIndex !== undefined) {
			meshData.uvs = new Float32Array(buffers[uvBufferView.buffer], uvBufferView.byteOffset, uvCount * 2);
		}

		meshData.indices = new Int16Array(buffers[indicesBufferView.buffer], indicesBufferView.byteOffset, indexCount);

		if(colorIndices.length > 0) {
			meshData.customAttributes = [];
			// Assumed componentType = 5126 => Float32, type = "VEC4" => count * 4
			for (let i = 0, l = colorIndices.length; i < l; i++) {
				let name = "COLOR_" + i; 
				meshData[name] = new Float32Array(buffers[colorsBufferViews[i].buffer], colorsBufferViews[i].byteOffset, colorsCounts[i] * 4);
				meshData.customAttributes.push({ name: name, source: name, size: 4 });
			}
		}

		return meshData;
	};

	let calculateArrayLength = (accessor) => {
		switch(accessor.type) {
			case "VEC4":
				return 4 * accessor.count;
			case "VEC3":
				return 3 * accessor.count;
			case "VEC2":
				return 2 * accessor.count;
			default: // "SCALAR"
				return accessor.count;
		}
	};

	let buildAnimationData = (out, json, animationIndex, buffers) => {
		let animation = json.animations[animationIndex];
		let result = {};

		result.name = animation.name;
		result.channels = [];
		result.duration = 0;

		for (let i = 0, l = animation.channels.length; i < l; i++) {
			let channel = animation.channels[i];
			
			let sampler = animation.samplers[channel.sampler];
			let times = []; // accessors at sampler.input
			let values = []; // accessors at sampler.output

			let timesAccessor = json.accessors[sampler.input];
			let timesBufferView = json.bufferViews[timesAccessor.bufferView];
			let valuesAccesor = json.accessors[sampler.output];
			let valuesBufferView = json.bufferViews[valuesAccesor.bufferView];

			result.duration = Math.max(result.duration, timesAccessor.max[0]);

			// Could assert target.path against accessor.type (translation => VEC3, rotation => VEC4, scale => VEC3)

			// Assuming float for now, should read from accessor.componentType
			// Note: needs transforming to float as per https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#animations
			times = new Float32Array(buffers[timesBufferView.buffer], timesBufferView.byteOffset, calculateArrayLength(timesAccessor));
			values = new Float32Array(buffers[valuesBufferView.buffer], valuesBufferView.byteOffset, calculateArrayLength(valuesAccesor));

			result.channels[i] = {
				type: channel.target.path,
				node: channel.target.node,
				times: times,
				values: values,
				interpolation: sampler.interpolation
			};
		}

		out[animation.name] = result;
	};

	let buildHierarchy = (json, index) => {
		let nodes = json.nodes;
		let { name, mesh, children, translation, rotation, scale } = nodes[index];

		let result = {};
		
		result.index = index;
		result.name = name;
		result.modelMeshIndex = mesh;
		if (!isNaN(mesh)) {
			result.modelMaterialIndex = json.meshes[mesh].primitives[0].material;
		}

		result.translation = translation;
		result.rotation = rotation;
		result.scale = scale;

		if (children) {
			result.children = [];
			for (let i = 0, l = children.length; i < l; i++) {
				let childNode = buildHierarchy(
					json,
					children[i]);
				result.children.push(childNode);
			}
		}

		return result;
	};

	let instantiateNode = (node, instance, resources, scene, parent) => {
		let transform = Transform.create({
			position: node.translation ? vec3.clone(node.translation) : vec3.create(),
			rotation: node.rotation ? quat.clone(node.rotation) : quat.create(),
			scale: node.scale ? vec3.clone(node.scale) : vec3.fromValues(1.0, 1.0, 1.0)
		});
		if (parent) {
			transform.parent = instance.transforms[parent.index];
		}
		instance.transforms[node.index] = transform;

		if (!isNaN(node.modelMeshIndex)) {
			let mesh = resources.meshes[node.modelMeshIndex];
			let material = resources.materials[node.modelMaterialIndex];
			// This breaks if the node doesn't have a modelMaterialIndex which is possible

			instance.sceneObjects.push(scene.add({
				material: material,
				mesh: mesh,
				transform: transform
			}));
		}

		let children = node.children;
		if (children) {
			transform.children = [];
			for (let i = 0, l = children.length; i < l; i++) {
				instantiateNode(
					children[i],
					instance,
					resources,
					scene,
					node);
				transform.children.push(instance.transforms[children[i].index]);
			}
		}

		return transform;
	};

	exports.instantiate = (model, scene, position, rotation, resources) => {
		if (!resources) {
			resources = model.resources;
		}
		if (!resources.meshes) {
			throw new Error("No mesh resources found to instantiate model, use Model.createResources to generate necessary Fury resources");
		}

		let instance = {};
		instance.sceneObjects = [];
		instance.transforms = [];
		instance.transform = instantiateNode(model.hierarchy, instance, resources, scene, null);
		if (position) {
			vec3.copy(instance.transform.position, position);
		}
		if (rotation) {
			quat.copy(instance.transform.rotation, rotation);
		}
		instance.remove = (scene) => {
			for (let i = 0, l = instance.sceneObjects.length; i < l; i++) {
				scene.remove(instance.sceneObjects[i]);
			}
		};
		return instance;
	};

	exports.createResources = (out, model, { 
		shader,
		texturelessShader = null,
		quality,
		texturedMaterialProperties = null,
		untexturedMaterialProperties = null
	}) => {
		out.textures = [];
		for (let i = 0, l = model.textureData.length; i < l; i++) {
			let imageIndex = model.textureData[i].imageIndex;
			out.textures[i] = Texture.create({
				source: model.images[imageIndex],
				quality: quality,
				flipY: false
			});
			out.textures[i].name = model.textureData[i].name;
		}

		out.materials = [];
		for (let i = 0, l = model.materialData.length; i < l; i++) {
			let textureIndex = model.materialData[i].textureIndex;
			if (textureIndex >= 0) {
				out.materials[i] = Material.create({ 
					shader: shader,
					texture: out.textures[textureIndex],
					properties: texturedMaterialProperties
				});
			} else {
				out.materials[i] = Material.create({
					shader: texturelessShader ? texturelessShader : shader,
					properties: untexturedMaterialProperties
				});
			}
		}

		out.meshes = [];
		for (let i = 0, l = model.meshData.length; i < l; i++) {
			out.meshes[i] = Mesh.create(model.meshData[i]);
		}
	};

	// Takes a URI of a glTF file to load
	// Returns an object containing an array meshdata ready for use with Fury.Mesh
	// As well as an array of images to use in material creation
	// Includes a cut down set of information on materialData and textureData arrays 
	// however these are not ready to be used directly with Fury.Material and Fury.Texture
	// and must be manipulated further, see exports.createResources
	// if resourceProperties object is provided detailing how to create the necessary resources
	// load will automatically create them and attach them to the model under model.resources
	exports.load = (uri, callback, resourceProperties) => {
		// TODO: Check file extension, only gltf currently supported
		// https://github.com/KhronosGroup/glTF -> https://github.com/KhronosGroup/glTF/tree/master/specification/2.0
		// https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/figures/gltfOverview-2.0.0b.png
		// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html
		fetch(uri).then((response) => {
			return response.json();
		}).then((json) => {

			let model = { meshData: [], images: [], materialData: [], textureData: [] };
			let arrayBuffers = [];

			let assetsLoading = 0;
			let onAssetLoadComplete = () => {
				assetsLoading--;
				if (assetsLoading == 0) {
					// All buffers loaded so build mesh data
					for(let i = 0, l = json.meshes.length; i < l; i++) {
						model.meshData[i] = buildMeshData(json, i, arrayBuffers)
					}

					if (json.animations && json.animations.length) {
						model.animations = {};
						for (let i = 0, l = json.animations.length; i < l; i++) {
							buildAnimationData(model.animations, json, i, arrayBuffers);
						}
					}

					if (resourceProperties) {
						model.resources = {};
						exports.createResources(model.resources, model, resourceProperties);
					}

					callback(model);
				}
			};

			for (let i = 0, l = json.buffers.length; i < l; i++) {
				assetsLoading++;
				fetch(json.buffers[i].uri).then((response) => {
					return response.arrayBuffer();
				}).then((buffer) => { 
					arrayBuffers[i] = buffer;
					onAssetLoadComplete();
				}).catch((error) => {
					console.error(error);
					console.error("Unable to fetch data buffer from model");
				});
			}

			// Hierarchy information
			if (json.scenes && json.scenes.length) {
				let scene = json.scenes[json.scene]; // Only one scene currently supported
				let nodeIndex = scene.nodes[0]; // Expect single scene node
				model.hierarchy = buildHierarchy(json, nodeIndex);
			}

			if (json.materials && json.materials.length) {
				// As PBR is not supported flatten the material structure
				for (let i = 0, l = json.materials.length; i < l; i++) {
					let textureIndex = -1;
					let material = json.materials[i];
					if (material.pbrMetallicRoughness 
						&& material.pbrMetallicRoughness.baseColorTexture) {
						let index = material.pbrMetallicRoughness.baseColorTexture.index; 
						textureIndex = !isNaN(index) ? index : -1;
					}

					// Only texture index is currently relevant
					model.materialData[i] = {
						textureIndex: textureIndex
					};
				}
			}

			if (json.textures && json.textures.length) {
				for (let i = 0, l = json.textures.length; i < l; i++) {
					let { sampler, source, name } = json.textures[i];
					// samplers not currently supported, so just put name and imageIndex
					model.textureData[i] = {
						name: name,
						imageIndex: source 
					};
				}
			}

			if (json.images && json.images.length) {
				for (let i = 0, l = json.images.length; i < l; i++) {
					assetsLoading++;
					fetch(json.images[i].uri).then(response => response.blob()).then(blob => {
						let image = new Image();
						image.src = URL.createObjectURL(blob);
						// Note if we wanted to unload the model
						// we would need to call URL.revokeObjectURL(image.src)
						image.decode().then(() => {
							model.images[i] = image;
							onAssetLoadComplete();
						}).catch((error) => {
							console.error(error);
							console.error("Unable to decode provide image data");
						});
					}).catch((error) => {
						console.error(error);
						console.error("Unable to fetch image data from model");
					});	
				}
			}
		}).catch((error) => {
			console.error(error);
			console.error("Unable to load model at " + uri);
		});
	};

	return exports;
})();

},{"./material":10,"./maths":11,"./mesh":22,"./texture":34,"./transform":36}],24:[function(require,module,exports){
const Primitives = require('./primitives');

module.exports = (function(){
	let exports = {};

	// todo: move to UI positioniong module once it exists 
	const Anchor = exports.Anchor = {
		"topLeft": 0,
		"topCenter": 1,
		"topRight": 2,
		"middleLeft": 3,
		"middleCenter": 4,
		"middleRight": 5,
		"bottomLeft": 6,
		"bottomCenter": 7,
		"bottomRight": 9 
	};
	
	exports.PositionRounding = {
		"none": 0,
		"integer": 1,
	};

	let calculateAnchorOffsetX = function(anchor, targetWidth) {
		switch (anchor || 0) {
			case Anchor.topRight:
			case Anchor.middleRight:
			case Anchor.bottomRight:
				return anchorOffsetX = -targetWidth;
			case Anchor.topCenter:
			case Anchor.middleCenter:
			case Anchor.bottomCenter:
				return anchorOffsetX = -targetWidth / 2;
			case Anchor.topLeft:
			case Anchor.middleLeft:
			case Anchor.bottomLeft:
			default:
				return anchorOffsetX = 0;
		}
	};
	
	let calculateAnchorOffsetY = function(anchor, targetHeight) {
		switch (anchor || 0) {
			case Anchor.topLeft:
			case Anchor.topCenter:
			case Anchor.topRight:
				return -targetHeight;
			case Anchor.middleLeft:
			case Anchor.middleCenter:
			case Anchor.middleRight:
				return  -targetHeight / 2;
			case Anchor.bottomLeft:
			case Anchor.bottomCenter:
			case Anchor.bottomRight:
			default:
				return 0;
		}
	};

	exports.buildMeshConfig = (
		targetWidth,
		targetHeight,
		{ width, height, top, right, bottom, left },
		anchor,
		positionRounding
		) => {
		let anchorOffsetX = calculateAnchorOffsetX(anchor, targetWidth);
		let anchorOffsetY = calculateAnchorOffsetY(anchor, targetHeight);
	
		if (positionRounding) {
			anchorOffsetX = Math.floor(anchorOffsetX);
			anchorOffsetY = Math.floor(anchorOffsetY);
		}
	
		let positions = [];
		let uvs = [];
		let indices = [];
	
		let reference = Primitives.createUIQuadMeshConfig(1,1);
		let extendPositions = (offsetX, offsetY, scaleX, scaleY) => {
			for (let i = 0, l = reference.positions.length; i < l; i += 3) {
				positions.push(scaleX * reference.positions[i] + offsetX + anchorOffsetX);
				positions.push(scaleY * reference.positions[i + 1] + offsetY + anchorOffsetY);
				positions.push(reference.positions[i + 2]);
			}
		}
		let extendUvs = (offsetU, offsetV, scaleU, scaleV) => {
			for (let i = 0, l = reference.uvs.length; i < l; i += 2) {
				uvs.push(scaleU * reference.uvs[i] + offsetU);
				uvs.push(scaleV * reference.uvs[i + 1] + offsetV);
			}
		}
		let extendIndices = (offset) => {
			for (let i = 0, l = reference.indices.length; i < l; i++) {
				indices.push(reference.indices[i] + offset);
			}
		};
	
		// left - bottom
		let positionCount = 0;
		extendPositions(0, 0, left, bottom);
		extendUvs(0, 0, left / width, bottom / height);
		extendIndices(positionCount);
		positionCount += 4;
		// bottom
		extendPositions(left, 0, targetWidth - left - right, bottom);
		extendUvs(left / width, 0, (width - left - right) / width, bottom / height);
		extendIndices(positionCount);
		positionCount += 4;
		// right - bottom
		extendPositions(targetWidth - right, 0, right, bottom);
		extendUvs((width - right) / width, 0, right / width, bottom / height);
		extendIndices(positionCount);
		positionCount += 4;
		// left
		extendPositions(0, bottom, left, targetHeight - top - bottom);
		extendUvs(0, bottom / height, left/width, (height - bottom - top) / height);
		extendIndices(positionCount);
		positionCount += 4;
		// middle
		extendPositions(left, bottom, targetWidth - left - right, targetHeight - top - bottom);
		extendUvs(left / width, bottom / height, (width - left - right) / width, (height - bottom - top) / height);
		extendIndices(positionCount);
		positionCount += 4;
		// right
		extendPositions(targetWidth - right, bottom, right, targetHeight - top - bottom);
		extendUvs((width - right) / width, bottom / height, right / width, (height - bottom - top) / height);
		extendIndices(positionCount);
		positionCount += 4;
		// left - top
		extendPositions(0, targetHeight - top, left, top);
		extendUvs(0, (height - top) / height, left / width, top / height);
		extendIndices(positionCount);
		positionCount += 4;
		// top
		extendPositions(left, targetHeight - top, targetWidth - left - right, top);
		extendUvs(left / width, (height - top) / height, (width - left - right) / width, top / height);
		extendIndices(positionCount);
		positionCount += 4;
		// right - top
		extendPositions(targetWidth - right, targetHeight - top, right, top);
		extendUvs((width - right) / width, (height - top) / height, right / width, top / height);
		extendIndices(positionCount);
		positionCount += 4;
	
		return {
			positions: positions,
			uvs: uvs,
			indices: indices,
			renderMode: reference.renderMode
		};
	};

	return exports;
})();
},{"./primitives":27}],25:[function(require,module,exports){
const vec3 = require('./maths').vec3;

module.exports = (function(){
	// https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_collision_detection

	let exports = {};

	// For now a box is an AABB - in future we'll need to allow rotation
	let Box = exports.Box = require('./bounds');

	exports.Sphere = (function() {
		let exports = {};
		let prototype = {};

		let cacheVec3 = vec3.create();

		exports.contains = function(point, sphere) {
			let dx = point[0] - sphere.center[0], dy = point[1] - sphere.center[1], dz = point[2] - sphere.center[2];
			let sqrDistance = dx * dx + dy * dy + dz * dz;
			return sqrDistance < sphere.radius * sphere.radius;
		};

		exports.intersect = function(a, b) {
			let dx = a.center[0] - b.center[0], dy = a.center[1] - b.center[1], dz = a.center[2] - b.center[2];
			let sqrDistance = dx * dx + dy * dy + dz * dz;
			return sqrDistance < (a.radius + b.radius) * (a.radius + b.radius);
		};
		
		exports.intersectBox = function(box, sphere) {
			return Box.intersectSphere(sphere, box);
		};

		// out is vec3 of intersection point, returns intersection time or 0 if no intersection
		exports.rayCast = function(out, origin, direction, sphere) {
			// Ray = origin + time * direction
			// (intersection - sphere.center) . (intersection - sphere.center) = sphere.radius * sphere.radius
			// => (origin - sphere.center + time * direction) . (origin - sphere.center + time * direction) = spehere.radius * sphere.radius
			// Let m = origin - sphere.center, t = time, d = direction and r = sphere.radius
			// simplifies to: (m + td) . (m + td) = r*r
			// leading to quadratic equation: t*t + 2(m.d)t + (m.m) - r*r = 0
			// quadric formula: t = -b +/- sqrt(b*b - c)
			// b = m.d, c = m.m - r*r
			// discriminant (b*b - c): < 0 => no intersection, 0 => one root, > 0 implies 2 roots
			let m = cacheVec3;
			vec3.subtract(m, origin, sphere.center);
			let b = vec3.dot(m, direction);
			let c = vec3.dot(m, m) - sphere.radius * sphere.radius;
	
			if (c > 0 && b > 0) {
				// origin outside sphere (c > 0) & direction points away from sphere (b > 0)
				// No intersection
				return 0;
			}
			if (c < 0) {
				// origin inside sphere, which we exclude by convention
				return 0;
			}
			
			let discriminant = b * b - c;
			if (discriminant < 0) {
				// No real roots
				return 0;
			}
			
			let t = -b - Math.sqrt(discriminant);
			if (t < 0) {
				// Note shouldn't happen (implies inside the sphere, which we have excluded)
				t = 0;
			}
			vec3.scaleAndAdd(out, origin, direction, t);
			return t;
		};
		
		exports.create = function({ center = vec3.create(), radius = 0 }) {
			let sphere = Object.create(prototype);
			sphere.center = center;
			sphere.radius = radius;
			return sphere;
		};
	
		return exports;
	})();
	
	return exports;
})();

},{"./bounds":2,"./maths":11}],26:[function(require,module,exports){
module.exports = (function(){
	let exports = {};

	let prefabs = exports.prefabs = { keys: "Can't touch this, doo doo doo, do do, do do" };

	exports.create = function(config) {
		if (!config || !config.name || prefabs[config.name]) {
			throw new Error("Please provide a valid and unique name parameter for your prefab");
		} else {
			prefabs[config.name] = config;
		}
	};

	return exports;
})();
},{}],27:[function(require,module,exports){
const { RenderMode } = require('./renderer');

module.exports = (function(){
	let exports = {};

	exports.createQuadMeshConfig = (w, h) => {
		return {
			positions: [ 
				w, h, 0.0,
				0, h, 0.0, 
				w, 0, 0.0,
				0, 0, 0.0 ],
			normals: [
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0 ],
			uvs: [
				1.0, 1.0,
				0.0, 1.0,
				1.0, 0.0,
				0.0, 0.0 ],
			renderMode: RenderMode.TriangleStrip
		};
	};

	exports.createCenteredQuadMeshConfig = (w, h) => {
		let sx = w/2, sy = h/2;
		return {
			positions: [ 
				sx, sy, 0.0,
				-sx, sy, 0.0, 
				sx, -sy, 0.0,
				-sx, -sy, 0.0 ],
			normals: [
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0 ],
			uvs: [
				1.0, 1.0,
				0.0, 1.0,
				1.0, 0.0,
				0.0, 0.0 ],
			renderMode: RenderMode.TriangleStrip
		};
	};
	
	exports.createSpriteQuadMeshConfig = (w, h) => {
		let sx = w/2, sy = h/2;
		return {
			positions: [ 
				sx, sy, 0.0,
				-sx, sy, 0.0, 
				sx, -sy, 0.0,
				-sx, -sy, 0.0 ],
			uvs: [
				1.0, 1.0,
				0.0, 1.0,
				1.0, 0.0,
				0.0, 0.0 ],
			renderMode: RenderMode.TriangleStrip
		};
	};

	exports.createUIQuadMeshConfig = function(w, h) {
		return {
			positions: [ 
				w, h, 0.0,
				0, h, 0.0, 
				w, 0, 0.0,
				0, 0, 0.0 ],
			uvs: [
				1.0, 1.0,
				0.0, 1.0,
				1.0, 0.0,
				0.0, 0.0 ],
			indices: [
				0, 1, 2, 2, 1, 3
			],
			renderMode: RenderMode.Triangles
		};
	};
	// todo: It feels like a better config or builder pattern could bring all these quads methods together
	// i.e. "includeNormals", "indexed" and "origin" : bottomLeft, centered, custom etc

	exports.createCubiodMeshConfig = (w, h, d) => {
		let x = w / 2, y = h / 2, z = d / 2;
		return {
			positions: [
				// Front face
				-x, -y,  z,
				 x, -y,  z,
				 x,  y,  z,
				-x,  y,  z,
		
				// Back face
				-x, -y, -z,
				-x,  y, -z,
				 x,  y, -z,
				 x, -y, -z,
		
				// Top face
				-x,  y, -z,
				-x,  y,  z,
				 x,  y,  z,
				 x,  y, -z,
		
				// Bottom face
				-x, -y, -z,
				 x, -y, -z,
				 x, -y,  z,
				-x, -y,  z,
		
				// Right face
				 x, -y, -z,
				 x,  y, -z,
				 x,  y,  z,
				 x, -y,  z,
		
				// Left face
				-x, -y, -z,
				-x, -y,  z,
				-x,  y,  z,
				-x,  y, -z],
			uvs: [
				// Front face
				0.0, 0.0,
				1.0, 0.0,
				1.0, 1.0,
				0.0, 1.0,
		
				// Back face
				1.0, 0.0,
				1.0, 1.0,
				0.0, 1.0,
				0.0, 0.0,
		
				// Top face
				0.0, 1.0,
				0.0, 0.0,
				1.0, 0.0,
				1.0, 1.0,
		
				// Bottom face
				1.0, 1.0,
				0.0, 1.0,
				0.0, 0.0,
				1.0, 0.0,
		
				// Right face
				1.0, 0.0,
				1.0, 1.0,
				0.0, 1.0,
				0.0, 0.0,
		
				// Left face
				0.0, 0.0,
				1.0, 0.0,
				1.0, 1.0,
				0.0, 1.0 ],
			normals: [
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,

				0.0, 0.0, -1.0,
				0.0, 0.0, -1.0,
				0.0, 0.0, -1.0,
				0.0, 0.0, -1.0,

				0.0, 1.0, 0.0,
				0.0, 1.0, 0.0,
				0.0, 1.0, 0.0,
				0.0, 1.0, 0.0,

				0.0, -1.0, 0.0,
				0.0, -1.0, 0.0,
				0.0, -1.0, 0.0,
				0.0, -1.0, 0.0,

				1.0, 0.0, 0.0,
				1.0, 0.0, 0.0,
				1.0, 0.0, 0.0,
				1.0, 0.0, 0.0,

				-1.0, 0.0, 0.0,
				-1.0, 0.0, 0.0,
				-1.0, 0.0, 0.0,
				-1.0, 0.0, 0.0,
			],
			indices: [
				0, 1, 2,      0, 2, 3,    // Front face
				4, 5, 6,      4, 6, 7,    // Back face
				8, 9, 10,     8, 10, 11,  // Top face
				12, 13, 14,   12, 14, 15, // Bottom face
				16, 17, 18,   16, 18, 19, // Right face
				20, 21, 22,   20, 22, 23  // Left face
				] };
	};

	return exports;
})();
},{"./renderer":29}],28:[function(require,module,exports){
module.exports = (function(){
	// Seedable Random

	// Hasing function (to generate good seed) and generators taken from
	// https://github.com/bryc/code/blob/master/jshash/PRNGs.md
	function xmur3(str) {
		for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
			h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
			h = h << 13 | h >>> 19;
		} return function() {
			h = Math.imul(h ^ (h >>> 16), 2246822507);
			h = Math.imul(h ^ (h >>> 13), 3266489909);
			return (h ^= h >>> 16) >>> 0;
		}
	}
	
	// 128-bit state - fast
	function sfc32(a, b, c, d) {
		return function() {
			a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
			let t = (a + b) | 0;
			a = b ^ b >>> 9;
			b = c + (c << 3) | 0;
			c = (c << 21 | c >>> 11);
			d = d + 1 | 0;
			t = t + d | 0;
			c = c + t | 0;
			return (t >>> 0) / 4294967296;
		}
	}

	// 32-bit state - faster
	function mulberry32(a) {
		return function() {
			let t = a += 0x6D2B79F5;
			t = Math.imul(t ^ t >>> 15, t | 1);
			t ^= t + Math.imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		}
	}

	let seed = null;
	let rand = Math.random;

	exports.generateSeed = function(length) {
		// Generates random seed string from easy to copy chars
		let r = rand;
		rand = Math.random;
		if (length === undefined) {
			length = 8;
		}
		let seedChars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
		let seedStr = "";
		for (let i = 0; i < length; i++) {
			seedStr += seedChars[exports.integer(0, seedChars.length)];
		}
		rand = r;
		return seedStr;
	};

	exports.setSeed = function(seed, use128) {
		seed = xmur3("" + seed);
		if (use128) {
			rand = sfc32(seed(), seed(), seed(), seed());
		} else {
			rand = mulberry32(seed());
		}
	};

	exports.value = function() {
		return rand();
	};

	exports.range = function(min, max) {
		return min + rand() * (max - min);
	};

	exports.integer = function(min, max) {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(min +  rand() * (max - min));
	};

	exports.roll = function(min, max) {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(min + rand() * (max - min + 1));
	};

	exports.pointInCircle = (out, radius = 1) => {
		let r = radius * Math.sqrt(rand());
		let theta = rand() * 2 * Math.PI;
		out[0] = r * Math.cos(theta);
		out[1] = r * Math.sin(theta);
	};

	exports.pointOnCircle = (out, radius = 1) => {
		let theta = rand() * 2 * Math.PI;
		out[0] = radius * Math.cos(theta);
		out[1] = radius * Math.sin(theta);
	};

	return exports;
})();
},{}],29:[function(require,module,exports){
// This module is essentially a GL Context Facade
// There are - of necessity - a few hidden logical dependencies in this class
// mostly with the render functions, binding buffers before calling a function draw

/** @type {WebGL2RenderingContext} */
let gl;

let currentShaderProgram, anisotropyExt, maxAnisotropy;
let activeTexture = null;

exports.init = function(canvas, contextAttributes) {
	gl = canvas.getContext('webgl2', contextAttributes);
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);	// TODO: expose as method
	gl.enable(gl.CULL_FACE);	// TODO: expose as method

	anisotropyExt = gl.getExtension("EXT_texture_filter_anisotropic");
	if (anisotropyExt) {
		maxAnisotropy = gl.getParameter(anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
	}

	// Expect 32 texture locations, map a 0 based index to actual integer values
	TextureLocations.length = 0;
	let i = 0;
	while(gl["TEXTURE" + i.toString()]) {
		TextureLocations.push(gl["TEXTURE" + i.toString()]);
		i++;
	}
};

exports.getContext = function() {
	return gl;
};

exports.getContextLossExtension = function() {
	return gl.getExtension("WEBGL_lose_context");
};

// TODO: This should be called setClearColor
exports.clearColor = function(r, g, b, a) {
	gl.clearColor(r, g, b, a);
};

exports.clear = function() {
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); // TODO: this isn't necessary every frame
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
};

exports.clearDepth = function() {
	gl.clear(gl.DEPTH_BUFFER_BIT);
};

// Shader / Shader Programs

let ShaderType = exports.ShaderType = {
	Vertex: "vertex",
	Fragment: "fragment"
};

exports.createShader = function(type, glsl) {
	let shader;
	if (type == ShaderType.Vertex) {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else if (type == ShaderType.Fragment) {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else {
		throw new Error("Unrecognised shader type '" + type + "'");
	}
	gl.shaderSource(shader, glsl);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error("Could not create shader " + gl.getShaderInfoLog(shader));
	}
	return shader;
};

exports.deleteShader = function(shader) {
	gl.deleteShader(shader);
};

exports.createShaderProgram = function(vertexShader, fragmentShader) {
	let program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error("Could not create shader program");
	}
	return program;
};

exports.useShaderProgram = function(shaderProgram) {
	currentShaderProgram = shaderProgram;
	gl.useProgram(shaderProgram);
};

// Buffers
exports.DataType = {
	"BYTE": 5120, // signed 8-bit integer
	"SHORT": 5122, // signed 16-bit integer
	"INT": 5124, // signed 32-bit integer
	"UNSIGNED_BYTE": 5121, // unsigned 8-bit integer
	"UNSIGNED_SHORT": 5123, // unsigned 16-bit integer
	"UNSIGNED_INT": 5125, // unsigned 32-bit integer
	"FLOAT": 5126, // 32-bit IEEE floating point number
	"HALF_FLOAT": 5131, // 16-bit IEEE floating point number
};

exports.createBuffer = function(data, itemSize, indexed) {
	let buffer = gl.createBuffer();
	if (!indexed) {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
	} else {
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW);
	}
	buffer.itemSize = itemSize;
	buffer.numItems = Math.round(data.length / itemSize);
	return buffer;
};

exports.createArrayBuffer = function(data, itemSize) {
	let buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	buffer.itemSize = itemSize;
	buffer.numItems = Math.round(data.length / itemSize);
	return buffer;
};

exports.createElementArrayBuffer = function(data, itemSize) {
	let buffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
	buffer.itemSize = itemSize;
	buffer.numItems = Math.round(data.length / itemSize);
	return buffer;
};

// Textures

let TextureLocations = exports.TextureLocations = [];

exports.FilterType = {
	NEAREST: 9728,
	LINEAR: 9729,
	LINEAR_MIPMAP_NEAREST: 9985,
	LINEAR_MIPMAP_LINEAR: 9987
};

exports.createTexture = function(source, clamp, flipY, mag, min, generateMipmap, enableAniso) {
	let texture = gl.createTexture();
	
	gl.bindTexture(gl.TEXTURE_2D, texture); // Binds into currently active texture location
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!flipY);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
	// If we want to create mipmaps manually provide an array source and put them into
	// different levels in texImage2D - you must provide all mipmap levels

	setTextureQuality(gl.TEXTURE_2D, mag, min, generateMipmap, enableAniso);

	if (clamp) {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	if (activeTexture && activeTexture.glTextureType == gl.TEXTURE_2D) {
		 // rebind the active texture
		gl.bindTexture(activeTexture.glTextureType, activeTexture);

	} else {
		gl.bindTexture(gl.TEXTURE_2D, null);
	}
	// todo: adding properties to gl objects is arguably bad practice should really have a wrapper object
	// todo: test to see if on context loss if textures objects are cleared.
	texture.glTextureType = gl.TEXTURE_2D;
	return texture;
};

/// width and height are of an individual texture
exports.createTextureArray = function(source, width, height, imageCount, clamp, flipY, mag, min, generateMipmap, enableAniso) {
	let texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
	gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, width, height, imageCount, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);

	setTextureQuality(gl.TEXTURE_2D_ARRAY, mag, min, generateMipmap, enableAniso);

	if (clamp) {
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
	texture.glTextureType = gl.TEXTURE_2D_ARRAY;
	return texture;
};

exports.createTextureCube = function(sources) {
	let texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sources[0]);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sources[1]);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sources[2]);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sources[3]);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sources[4]);
	gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sources[5]);
	// todo: maybe reuse "setTextureQuality"
	gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	texture.glTextureType = gl.TEXTURE_CUBE_MAP;
	return texture;
};

exports.createDataTexture = function() {
	let texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	texture.glTextureType = gl.TEXTURE_2D;

	if (activeTexture && activeTexture.glTextureType == gl.TEXTURE_2D) {
		// rebind the active texture
		gl.bindTexture(activeTexture.glTextureType, activeTexture);
	}
	
	return texture;
};

exports.updateDataTexture = function(texture, source, width, height, internalFormat, type) {
	if (!internalFormat) {
		internalFormat = gl.RGBA32F;
	}
	if (!type) {
		type = gl.FLOAT;
	}
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, gl.RGBA, type, source);

	if (activeTexture && activeTexture.glTextureType == gl.TEXTURE_2D) {
		// rebind the active texture
		gl.bindTexture(activeTexture.glTextureType, activeTexture);
	}
};

let setTextureQuality = function(glTextureType, mag, min, generateMipmap, enableAniso) {
	if (!mag) mag = gl.NEAREST;
	if (!min) min = gl.NEAREST; 
	gl.texParameteri(glTextureType, gl.TEXTURE_MAG_FILTER, mag);
	gl.texParameteri(glTextureType, gl.TEXTURE_MIN_FILTER, min);
	if (enableAniso && anisotropyExt) {
		gl.texParameterf(glTextureType, anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy);
	}
	if (generateMipmap) {
		gl.generateMipmap(glTextureType);
	}
};

exports.setTexture = function(location, texture) {
	gl.activeTexture(TextureLocations[location]);
	gl.bindTexture(texture.glTextureType, texture);
	activeTexture = texture;
};

exports.DepthEquation = {
	LessThanOrEqual: "LEQUAL",
	LessThan: "LESS",
	GreaterThanOrEqual: "GEQUAL",
	GreaterThan: "GREATER",
}

exports.setDepthFunction = function(depthEquation) {
	gl.depthFunc(gl[depthEquation]);
}

// Blending
exports.BlendEquation = {
	Add: "FUNC_ADD",
	Subtract: "FUNC_SUBTRACT",
	ReverseSubtract: "FUNC_REVERSE_SUBTRACT"
};

exports.BlendType = {
	Zero: "ZERO",
	One: "ONE",
	ConstantAlpha: "CONSTANT_ALPHA",
	ConstantColour: "CONSTANT_COLOR",
	DestinationAlpha: "DST_ALPHA",
	DestinationColour: "DST_COLOR",
	SourceAlpha: "SRC_ALPHA",
	SourceColour: "SRC_COLOR",
	OneMinusConstantAlpha: "ONE_MINUS_CONSTANT_ALPHA",
	OneMinusConstantColour: "ONE_MINUS_CONSTANT_COLOR",
	OneMinusDestinationAlpha: "ONE_MINUS_DST_ALPHA",
	OneMinusDestinationColour: "ONE_MINUS_DST_COLOR",
	OneMinusSourceAlpha: "ONE_MINUS_SRC_ALPHA",
	OneMinusSourceColour: "ONE_MINUS_SRC_COLOR",
	SourceAlphaSaturate: "SRC_ALPHA_SATURATE"
};

exports.enableBlending = function(sourceBlend, destinationBlend, equation) {
	if (equation) {
		gl.blendEquation(gl[equation]);
	}
	if(sourceBlend && destinationBlend) {
		gl.blendFunc(gl[sourceBlend], gl[destinationBlend]);
	}
	gl.enable(gl.BLEND);
	gl.depthMask(false);
};

exports.enableSeparateBlending = function(sourceColorBlend, destinationColorBlend, sourceAlphaBlend, destinationAlphaBlend, equation) {
	gl.enable(gl.BLEND);
	if (equation) {
		// Does WebGL support separate blend equations? Do we want to?
		gl.blendEquation(gl[equation]);
	}
	if (sourceColorBlend && sourceAlphaBlend && destinationColorBlend && destinationAlphaBlend) {
		gl.blendFuncSeparate(gl[sourceColorBlend], gl[destinationColorBlend], gl[sourceAlphaBlend], gl[destinationAlphaBlend]);
	}
	gl.depthMask(false);
}

exports.disableBlending = function() {
	gl.disable(gl.BLEND);
	gl.depthMask(true);
};

// Attributes and Uniforms

exports.initAttribute = function(shaderProgram, name) {
	if(!shaderProgram.attributeLocations) {
		shaderProgram.attributeLocations = {};
	}
	shaderProgram.attributeLocations[name] = gl.getAttribLocation(shaderProgram, name);
};
exports.initUniform = function(shaderProgram, name) {
	if(!shaderProgram.uniformLocations) {
		shaderProgram.uniformLocations = {};
	}
	shaderProgram.uniformLocations[name] = gl.getUniformLocation(shaderProgram, name);
};

exports.enableAttribute = function(name) {
	let index = currentShaderProgram.attributeLocations[name];
	if (index >= 0) {
		gl.enableVertexAttribArray(index);
	} else {
		console.warn("Attribute '" + name + "' does not have a valid attribute location to enable");
	}
};
exports.disableAttribute = function(name) {
	let index = currentShaderProgram.attributeLocations[name];
	if (index >= 0) {
		gl.disableVertexAttribArray(currentShaderProgram.attributeLocations[name]);
	} else {
		console.warn("Attribute '" + name + "' does not have a valid attribute location to disable");
	}
};
exports.setAttribute = function(name, buffer) {
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.vertexAttribPointer(currentShaderProgram.attributeLocations[name], buffer.itemSize, gl.FLOAT, false, 0, 0);
};
exports.setAttributeFloat = function(name, buffer, type) {
	/* Supported types: gl.BYTE, gl.SHORT, gl.UNSIGNED_BYTE, gl.UNSIGNED_SHORT, gl.FLOAT, gl.HALF_FLOAT: */
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.vertexAttribPointer(currentShaderProgram.attributeLocations[name], buffer.itemSize, type, false, 0, 0);
};
exports.setAttributeInteger = function(name, buffer, type) {
	/* Supported types: gl.BYTE, gl.UNSIGNED_BYTE, gl.SHORT, gl.UNSIGNED_SHORT, gl.INT, gl.UNSIGNED_INT */
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.vertexAttribIPointer(currentShaderProgram.attributeLocations[name], buffer.itemSize, type, 0, 0);
};

exports.setIndexedAttribute = function(buffer) {
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
};

exports.setUniformBoolean = function(name, value) {
	gl.uniform1i(currentShaderProgram.uniformLocations[name], value);
};
exports.setUniformFloat = function(name, value) {
	gl.uniform1f(currentShaderProgram.uniformLocations[name], value);
};
exports.setUniformFloat2 = function(name, value1, value2) {
	gl.uniform2f(currentShaderProgram.uniformLocations[name], value1, value2);
};
exports.setUniformFloat3 = function(name, value1, value2, value3) {
	gl.uniform3f(currentShaderProgram.uniformLocations[name], value1, value2, value3);
};
exports.setUniformFloat4 = function(name, value1, value2, value3, value4) {
	gl.uniform4f(currentShaderProgram.uniformLocations[name], value1, value2, value3, value4);
}
exports.setUniformInteger = function(name, value) {
	gl.uniform1i(currentShaderProgram.uniformLocations[name], value);
};
exports.setUniformVector2 = function(name, value) {
	gl.uniform2fv(currentShaderProgram.uniformLocations[name], value);
}
exports.setUniformVector3 = function(name, value) {
	gl.uniform3fv(currentShaderProgram.uniformLocations[name], value);
};
exports.setUniformVector4 = function(name, value) {
	gl.uniform4fv(currentShaderProgram.uniformLocations[name], value);
};
exports.setUniformMatrix3 = function(name, value) {
	gl.uniformMatrix3fv(currentShaderProgram.uniformLocations[name], false, value);
};
exports.setUniformMatrix4 = function(name, value) {
	gl.uniformMatrix4fv(currentShaderProgram.uniformLocations[name], false, value);
};

// Draw Functions
let RenderMode = exports.RenderMode = {
	Triangles: "triangles",
	TriangleStrip: "triangleStrip",
	Lines: "lines",
	Points: "points"
};

let drawTriangles = exports.drawTriangles = function(count) {
	gl.drawArrays(gl.TRIANGLES, 0, count);
};
let drawTriangleStrip = exports.drawTriangleStrip = function(count) {
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, count);
};
let drawLines = exports.drawLines = function(count) {
	gl.drawArrays(gl.LINES, 0, count);
};
let drawPoints = exports.drawPoints = function(count) {
	gl.drawArrays(gl.POINTS, 0, count);
};
let drawIndexedTriangles = exports.drawIndexedTriangles = function(count, offset) {
	gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, offset);
};
let drawIndexedTriangleStrip = exports.drawIndexedTriangleStrip = function(count, offset) {
	gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_SHORT, offset);
}
let drawIndexedLines = exports.drawIndexedLines = function(count, offset) {
	gl.drawElements(gl.LINES, count, gl.UNSIGNED_SHORT, offset);
};
let drawIndexedPoints = exports.drawIndexedPoints = function(count, offset) {
	gl.drawElements(gl.POINTS, count, gl.UNSIGNED_SHORT, offset);
};

exports.draw = function(renderMode, count, indexed, offset) {
	switch (renderMode) {
		case RenderMode.Triangles:
			if (!indexed) {
				drawTriangles(count);
			} else {
				drawIndexedTriangles(count, offset);
			}
			break;
		case RenderMode.TriangleStrip:
			if (!indexed) {
				drawTriangleStrip(count);
			} else {
				drawIndexedTriangleStrip(count);
			}
			break;
		case RenderMode.Lines:
			if (!indexed) {
				drawLines(count);
			} else {
				drawIndexedLines(count, offset);
			}
			break;
		case RenderMode.Points:
			if (!indexed) {
				drawPoints(count);
			} else {
				drawIndexedPoints(count, offset);
			}
			break;
		default:
			throw new Error("Unrecognised renderMode '" + renderMode + "'");
	}
};

},{}],30:[function(require,module,exports){
const r = require('./renderer');
const IndexedMap = require('./indexedMap');
const Material = require('./material');
const Mesh = require('./mesh');
const Prefab = require('./prefab');
const Transform = require('./transform');
const Maths = require('./maths');
const Bounds = require('./bounds');
const { mat3, mat4, quat, vec3 } = Maths;

module.exports = (function() {
	let nextSceneId = 0;
	let exports = {};

	// Note Meshes and Materials shared across scenes
	// Going to use dictionaries but with an array of keys for enumeration (hence private with accessor methods)
	let meshes = IndexedMap.create();
	let materials = IndexedMap.create();
	let shaders = IndexedMap.create();
	let textures = IndexedMap.create();

	// Note: clears all resources - any uncleared existing scenes will break
	exports.clearResources = function() {
		meshes.clear();
		materials.clear();
		shaders.clear();
		textures.clear();
	};

	// TODO: Add clearUnusedResources - which enumerates through scene renderObjects / prefab instances 
	// to check objects are used or reference count them - will need to track created scenes

	// glState Tracking - shared across scenes
	let currentShaderId, currentMaterialId, currentMeshId;
	let nextTextureLocation = 0, currentTextureBindings = {}, currentTextureLocations = [];	// keyed on texture.id to binding location, keyed on binding location to texture.id

	let bindMaterialTextureLocations = function(material) {
		for (let i = 0, l = material.shader.textureUniformNames.length; i < l; i++) {
			let uniformName = material.shader.textureUniformNames[i];
			let texture = material.textures[uniformName];
			if (texture) {
				textures.add(texture);
				bindTextureToLocation(texture);
			}

		}
	};

	let bindTextureToLocation = function(texture) {
		if (currentTextureBindings[texture.id] === undefined) {
			if (currentTextureLocations.length < r.TextureLocations.length) {
				r.setTexture(currentTextureLocations.length, texture);
				currentTextureBindings[texture.id] = currentTextureLocations.length;
				currentTextureLocations.push(texture.id);
			} else {
				// replace an existing texture
				delete currentTextureBindings[currentTextureLocations[nextTextureLocation]];
				r.setTexture(nextTextureLocation, texture);
				currentTextureBindings[texture.id] = nextTextureLocation;
				currentTextureLocations[nextTextureLocation] = texture.id;
				nextTextureLocation = (nextTextureLocation+1) % r.TextureLocations.length;
			}
		}
	};

	exports.create = function({ camera, enableFrustumCulling, forceSphereCulling }) {
		let cameras = {};
		let cameraNames = [];
		let mainCameraName = "main";
		// mvMatrix may need to be a stack in future (although a stack which avoids unnecessary mat4.creates)
		let pMatrix = mat4.create(), mvMatrix = mat4.create(), nMatrix = mat3.create(), cameraMatrix = mat4.create(), cameraOffset = vec3.create(), inverseCameraRotation = quat.create();
		let pMatrixRebound = false, vMatrixRebound = false;

		let scene = {};
		scene.id = (nextSceneId++).toString();
		scene.enableFrustumCulling = !!enableFrustumCulling;

		// these renderObjects / instances on prefabs need to contain at minimum materialId, meshId, and transform (currently object just has material and mesh as well as transform)
		let renderObjects = IndexedMap.create(); // TODO: use materialId / meshId to bind
		let prefabs = { keys: [] };	// Arguably instances could be added to renderer objects and memory would still be saved, however keeping a separate list allows easier batching for now
		// TODO: Should have an equivilent to indexedMap but where you supply the keys, keyedMap?.
		let alphaRenderObjects = [];
		let depths = {};
		depths.get = (o) => {
			let id = o.sceneId !== undefined ? o.sceneId : o.id;
			return depths[id];
		};
		depths.set = (o, depth) => {
			let id = o.sceneId !== undefined ? o.sceneId : o.id;
			depths[id] = depth;
		};

		let addToAlphaList = function(object, depth) {
			// TODO: Profile using Array sort instead of insertion sorting, also test add/remove from list rather than clear
			depths.set(object, depth);
			// Binary search
			// Could technically do better by batching up items with the same depth according to material / mesh like scene graph
			// However this is only relevant for 2D games with orthographic projection
			let less, more, itteration = 1, inserted = false, index = Math.floor(alphaRenderObjects.length/2);
			while (!inserted) {
				less = (index === 0 || depths.get(alphaRenderObjects[index-1]) <= depth);
				more = (index >= alphaRenderObjects.length || depths.get(alphaRenderObjects[index]) >= depth);
				if (less && more) {
					alphaRenderObjects.splice(index, 0, object);
					inserted = true;
				} else {
					itteration++;
					var step = Math.ceil(alphaRenderObjects.length/(2*itteration));
					if(!less) {
						index = Math.max(0, index - step);
					} else {
						index = Math.min(alphaRenderObjects.length, index + step);
					}
				}
			}
		};

		let createObjectBounds = function(object, mesh, rotation) {
			// If object is static and not rotated, create object AABB from mesh bounds
			if (!forceSphereCulling && object.static && (!rotation || Maths.quat.isIdentity(rotation))) {
				// TODO: Allow for calculation of AABB of rotated meshes
				let center = vec3.clone(mesh.bounds.center);
				vec3.add(center, center, object.transform.position);
				let size = vec3.clone(mesh.bounds.size);
				object.bounds = Bounds.create({ center: center, size: size });
			}
		};

		let isCulledByFrustrum = function(camera, object) {
			if (!object.static || !object.bounds) {
				return !camera.isSphereInFrustum(object.transform.position, object.mesh.boundingRadius);
			} else {
				return !camera.isInFrustum(object.bounds);
			}
		};

		let sortByMaterial = function(a, b) {
			if (a.materialId == b.materialId) {
				return 0;
			} else if (a.materialId < b.materialId) { // Note: will not order strings by their parsed numberical value, however this is not required.
				return +1;
			} else {
				return -1;
			}
		};

		// Add Render Object
		scene.add = function(config) {
			let object = {};
			
			let { mesh, material, static = false, active = true } = config;
			object.material = material;
			object.mesh = mesh;
			if (!mesh || !material) {
				throw new Error("Mesh and Material must be present on the object.");
			}

			// Note: indexedMap.add adds id property to object added and does not add duplicates
			object.meshId = meshes.add(object.mesh);
			object.materialId = materials.add(object.material);
			object.shaderId = shaders.add(object.material.shader); 
			object.material.shaderId = object.shaderId;
			bindMaterialTextureLocations(object.material);

			if (config.transform) {
				object.transform = config.transform;
			} else {
				object.transform = Transform.create(config);
			}

			// For now just sort by material on add
			// Ideally would group materials with the same shader and textures together
			object.sceneId = renderObjects.add(object, sortByMaterial); 
			// Would probably be more performant to dynamic changes if kept a record of start and end index
			// of all materials and could simply inject at the correct point - TODO: Profile
			object.static = static;
			object.active = active;

			createObjectBounds(object, object.mesh, object.transform.rotation);

			return object;
		};

		scene.remove = function(object) {
			// Note: This does not free up the resources (e.g. mesh and material references remain) in the scene, may need to reference count these and delete
			if (object.sceneId !== undefined) {
				renderObjects.remove(object.sceneId);
			} else if (object.id) {
				// Is prefab, look on prototype for instances and remove this
				object.instances.remove(object.id);
				// Note not deleting the locally stored prefab, even if !instances.length as we would get duplicate mesh / materials if we were to readd
				// Keeping the prefab details around is preferable and should be low overhead
			}
		};

		scene.clear = function() {
			// Note: This does not free up the resources (e.g. mesh and material references remain) in the scene, may need to reference count these and delete
			renderObjects.clear();
			alphaRenderObjects.length = 0;
			if (prefabs.keys.length) {
				// Recreate prefab object - i.e. remove all prefabs and instances in one swoop.
				prefabs = { keys: [] }; 
			}
		};

		// Instantiate prefab instance
		scene.instantiate = function(config) {
			let prefab;

			if (!config || !config.name || !Prefab.prefabs[config.name]) {
				throw new Error("You must provide a valid prefab name");
			}

			let name = config.name;
			if (!prefabs[name]) {
				let defn = Prefab.prefabs[name];
				if (!defn.materialConfig || !defn.meshConfig) {
					throw new Error("Requested prefab must have a material and a mesh config present");
				}
				prefab = {
					active: true,
					name: name,
					instances: IndexedMap.create(),
					mesh: Mesh.create(defn.meshConfig),
					material: Material.create(defn.materialConfig)
				};
				prefab.meshId = meshes.add(prefab.mesh);
				prefab.materialId = materials.add(prefab.material);
				prefab.shaderId = shaders.add(prefab.material.shader);
				prefab.material.shaderId = prefab.shaderId;
				bindMaterialTextureLocations(prefab.material);
				prefabs[name] = prefab;
				prefabs.keys.push(name);
			} else {
				prefab = prefabs[name];
			}
			let instance = Object.create(prefab);
			instance.transform = Transform.create(config);

			let { static = false, active = true } = config;
			instance.id = prefab.instances.add(instance);
			instance.static = static;
			instance.active = active;

			createObjectBounds(instance, prefab.mesh, instance.transform.rotation);

			return instance;
		};

		scene.setPrefabActive = function(name, active) {
			if (prefabs[name]) {
				prefabs[name].active = active;
			} else {
				console.warn("Unable to find prefab '" + name + "' to set active " + active);
			}
		};

		// Add Camera
		// Arguably camera.render(scene) would be a preferable pattern
		scene.addCamera = function(camera, name) {
			let key = name ? name : "main";
			if (cameraNames.length === 0) {
				mainCameraName = key;
			}
			if (!cameras[key]) {
				cameraNames.push(key);
			}
			cameras[key] = camera;
		};

		// Render
		scene.render = function(cameraName) {
			let camera = cameras[cameraName ? cameraName : mainCameraName];
			if (scene.enableFrustumCulling) {
				camera.calculateFrustum();
			}
			camera.getProjectionMatrix(pMatrix);
			// Camera Matrix should transform world space -> camera space
			quat.invert(inverseCameraRotation, camera.rotation); // camera looks in negative Z direction
			mat4.fromQuat(cameraMatrix, inverseCameraRotation);
			mat4.translate(cameraMatrix, cameraMatrix, vec3.negate(cameraOffset, camera.position));

			pMatrixRebound = false;
			vMatrixRebound = false;
			alphaRenderObjects.length = 0;

			// TODO: Scene Graph
			// Batched first by Shader
			// Then by Material
			// Then by Mesh
			// Then render each Mesh Instance
			// An extension would be to batch materials such that shaders that textures used overlap

			// This batching by shader / material / mesh may need to be combined with scene management techniques
			if (camera.clear) {
				if (camera.clearColor) {
					r.clearColor(camera.clearColor[0], camera.clearColor[1], camera.clearColor[2], camera.clearColor[3]);
				}
				r.clear();
			} else if (camera.clearDepth) {
				r.clearDepth();
			}

			// TODO: Scene graph should provide these as a single thing to loop over, will then only split and loop for instances at mvMatrix binding / drawing
			// Scene Graph should be class with enumerate() method, that way it can batch as described above and sort watch its batching / visibility whilst providing a way to simple loop over all elements
			let culled = false, renderObject = null;
			for (let i = 0, l = renderObjects.keys.length; i < l; i++) {
				// TODO: Detect if resorting is necessary (check +1 and -1 in array against sort function)
				renderObject = renderObjects[renderObjects.keys[i]];
				if (scene.enableFrustumCulling && renderObject.active) {
					culled = isCulledByFrustrum(camera, renderObject);
				}
				if (!culled && renderObject.active) {
					if(renderObject.material.alpha) {
						let sortPosition = renderObject.transform.position
						if (renderObject.bounds) {
							sortPosition = renderObject.bounds.center;
						}
						addToAlphaList(renderObject, camera.getDepth(sortPosition));
					} else {
						bindAndDraw(renderObject);
					}
				}
			}
			for (let i = 0, l = prefabs.keys.length; i < l; i++) {
				let prefab = prefabs[prefabs.keys[i]];
				if (prefab.active) {
					let instances = prefab.instances;
					for (let j = 0, n = instances.keys.length; j < n; j++) {
						let instance = instances[instances.keys[j]];
						if (scene.enableFrustumCulling && instance.active) {
							culled = isCulledByFrustrum(camera, instance);
						}
						if (!culled && instance.active) {
							if (instance.material.alpha) {
								let sortPosition = instance.transform.position;
								if (instance.bounds) {
									sortPosition = instance.bounds.center;
								}
								addToAlphaList(instance, camera.getDepth(sortPosition));
							} else {
								bindAndDraw(instance);
							}
						}
					}
				}
			}
			for (let i = 0, l = alphaRenderObjects.length; i < l; i++) {
				renderObject = alphaRenderObjects[i];
				let m = renderObject.material; 
				// Could probably do this in bind and draw method
				if (!m.blendSeparate) {
					r.enableBlending(m.sourceBlendType, m.destinationBlendType, m.blendEquation);
				} else {
					r.enableSeparateBlending(m.sourceColorBlendType, m.destinationColorBlendType, m.sourceAlphaBlendType, m.destinationAlphaBlendType, m.blendEquation);
				}
				bindAndDraw(renderObject);
			}
			r.disableBlending();
		};

		let bindAndDraw = function(object) {
			let shader = object.material.shader;
			let material = object.material;
			let mesh = object.mesh;
			// BUG:
			// If there's only one material or one mesh in the scene real time changes to the material or mesh will not present themselves as the id will still match the currently bound
			// mesh / material, seems like we're going need a flag on mesh / material for forceRebind for this case. (should probably be called forceRebind as it 'might' be rebound anyway)
			// Having now determined that actually we don't need to rebind uniforms when switching shader programs, we'll need this flag whenever there's only one mesh or material using a given shader.

			// TODO: When scene graph implemented - check material.shaderId & object.shaderId against shader.id, and object.materialId against material.id and object.meshId against mesh.id
			// as this indicates that this object needs reordering in the graph (as it's been changed).

			let shouldRebindShader = false;
			let shouldRebindMaterial = false;
			if (!shader.id || shader.id != currentShaderId) {
				shouldRebindShader = true;
				// Check if shader was changed on the material since originally added to scene
				if(!shader.id) {
					material.shaderId = shaders.add(shader);
					object.shaderId = material.shaderId;
				} else {
					if (material.shaderId != shader.id) {
						material.shaderId = shader.id;
					} 
					if (object.shaderId != shader.id) {
						object.shaderId = shader.id;
					}
				}
				currentShaderId = shader.id;
				r.useShaderProgram(shader.shaderProgram);
				pMatrixRebound = false;
				vMatrixRebound = false;
			}

			if (!pMatrixRebound) {
				// New Shader or New Frame, rebind projection Matrix
				r.setUniformMatrix4(shader.pMatrixUniformName, pMatrix);
				pMatrixRebound = true;
			}

			if (!vMatrixRebound) {
				if (shader.vMatrixUniformName) {
					r.setUniformMatrix4(shader.vMatrixUniformName, cameraMatrix);
				}
				vMatrixRebound = true;
			}

			if (!material.id || material.id != currentMaterialId || material.dirty) {
				if (!material.dirty) {
					shouldRebindMaterial = true;
				} else {
					material.dirty = false;
				}
				// check if material was changed on object since originally 
				// added to scene TODO: Ideally would mark object for resorting
				if (!material.id) {
					object.materialId = materials.add(material);
				} else if (object.materialId != material.id) {
					object.materialId = material.id;
				}
				currentMaterialId = material.id;
				shader.bindMaterial.call(r, material);
			}

			if (shouldRebindShader || shouldRebindMaterial) {
				// Texture Rebinding dependencies
				// If the shader has changed you DON'T need to rebind, you only need to rebind if the on the uniforms have changed since the shaderProgram was last used...
					// NOTE Large Changes needed because of this
					// I think we're just going to have to add a flag to materials and meshes to say "rebind" (because I've changed something)
					// This also means we should move the "currentMeshId / currentMaterial id to the shader instead or keep a keyed list on shader the id
					// Lets do this after we've done the texture binding though eh? so for now just rebind everything if shader or material changes (overkill but it'll work)
				// If the material has changed textures may need rebinding

				// Check for gl location rebinds needed, if any needed and rebind all to make sure we don't replace a texture we're using
				let locationRebindsNeeded = false, uniformName = null, texture = null;
				for (let i = 0, l = shader.textureUniformNames.length; i < l; i++) {
					uniformName = shader.textureUniformNames[i];
					if (material.textures[uniformName]) {
						texture = material.textures[uniformName];
						if (!texture.id) {
							textures.add(texture);
							locationRebindsNeeded = true;
							break;
						}
						if (isNaN(currentTextureBindings[texture.id])) {
							locationRebindsNeeded = true;
							break;
						}
					}
				}
				// Rebind if necessary and set uniforms
				for (let i = 0, l = shader.textureUniformNames.length; i < l; i++) {
					uniformName = shader.textureUniformNames[i];
					if (material.textures[uniformName]) {
						texture = material.textures[uniformName];
						if (locationRebindsNeeded) {
							bindTextureToLocation(texture);
						}
						r.setUniformInteger(uniformName, currentTextureBindings[texture.id]);
					}
				}
			}

			if (!mesh.id || mesh.id != currentMeshId || mesh.dirty) {
				// Check if mesh was changed on object since originally added to scene
				if (!mesh.id) {
					object.meshId = mesh.add(mesh);
				} else if (object.meshId != mesh.id) {
					object.meshId = mesh.id;
				}
				currentMeshId = mesh.id;
				shader.bindBuffers.call(r, mesh);
				mesh.dirty = false;
			}

			object.transform.updateMatrix();
			if (shader.mMatrixUniformName) {
				r.setUniformMatrix4(shader.mMatrixUniformName, object.transform.matrix);
			}

			if (shader.mvMatrixUniformName) {
				mat4.multiply(mvMatrix, cameraMatrix, object.transform.matrix);
				r.setUniformMatrix4(shader.mvMatrixUniformName, mvMatrix);
			}

			if (shader.nMatrixUniformName) {
				mat3.normalFromMat4(nMatrix, mvMatrix);
				r.setUniformMatrix3(shader.nMatrixUniformName, nMatrix);
			}

			if (shader.bindInstance) {
				shader.bindInstance.call(r, object);
			}

			r.draw(mesh.renderMode, mesh.indexed ? mesh.indexBuffer.numItems : mesh.vertexBuffer.numItems, mesh.indexed, 0);
		};

		if (camera) {
			scene.addCamera(camera);
		}

		return scene;
	};

	return exports;
})();
},{"./bounds":2,"./indexedMap":8,"./material":10,"./maths":11,"./mesh":22,"./prefab":26,"./renderer":29,"./transform":36}],31:[function(require,module,exports){
// Shader Class for use with Fury Scene
const r = require('./renderer');

module.exports = (function() {
	let exports = {};

	exports.create = function(config) {
		let shader = {};

		// Argument Validation
		if (!config) {
			throw new Error("No config object supplied, shader source must be provided");
		}
		if (!config.vsSource) {
			throw new Error("No Vertex Shader Source 'vsSource'");
		}
		if (!config.fsSource) {
			throw new Error("No Fragment Shader Source 'fsSource'");
		}

		shader.vs = r.createShader("vertex", config.vsSource);
		shader.fs = r.createShader("fragment", config.fsSource);
		shader.shaderProgram = r.createShaderProgram(shader.vs, shader.fs);
		if (config.attributeNames) {	// Could parse these from the shader
			for (let i = 0, l = config.attributeNames.length; i < l; i++) {
				r.initAttribute(shader.shaderProgram, config.attributeNames[i]);
			}
		}
		if (config.uniformNames) {	// Could parse these from the shader
			for (let i = 0, l = config.uniformNames.length; i < l; i++) {
				r.initUniform(shader.shaderProgram, config.uniformNames[i]);
			}
		}
		if (config.textureUniformNames) {
			if (config.textureUniformNames.length > r.TextureLocations.length) {
				throw new Error("Shader can not use more texture than total texture locations (" + r.TextureLocations.length + ")");
			}
			shader.textureUniformNames = config.textureUniformNames;	// Again could parse from the shader, and could also not require duplicate between uniformNames and textureUniformNames
		} else {
			shader.textureUniformNames = [];
		}

		if (!config.bindMaterial || typeof(config.bindMaterial) !== 'function') {
			throw new Error("You must provide a material binding function 'bindMaterial'");
		}
		shader.bindMaterial = config.bindMaterial;

		if (!config.bindBuffers || typeof(config.bindBuffers) !== 'function') {
			throw new Error("You must provide a mesh binding function 'bindBuffers'");
		}
		shader.bindBuffers = config.bindBuffers;

		if (config.bindInstance && typeof(config.bindInstance) === 'function') {
			shader.bindInstance = config.bindInstance;
		}

		if (config.validateMaterial && typeof(config.validateMaterial) === 'function') {
			shader.validateMaterial = config.validateMaterial;
		}

		shader.pMatrixUniformName = config.pMatrixUniformName;
		shader.mvMatrixUniformName = config.mvMatrixUniformName;
		shader.nMatrixUniformName = config.nMatrixUniformName;
		shader.mMatrixUniformName = config.mMatrixUniformName;
		shader.vMatrixUniformName = config.vMatrixUniformName;

		if (!shader.pMatrixUniformName && config.uniformNames.includes("pMatrix")) {
			shader.pMatrixUniformName = "pMatrix";
		}

		if (!shader.mvMatrixUniformName && config.uniformNames.includes("mvMatrix")) {
			shader.mvMatrixUniformName = "mvMatrix";
		}

		if (!shader.mMatrixUniformName && config.uniformNames.includes("mMatrix")) {
			shader.mMatrixUniformName = "mMatrix";
		}

		if (!shader.vMatrixUniformName && config.uniformNames.includes("vMatrix")) {
			shader.vMatrixUniformName = "vMatrix";
		}

		return shader;
	};

	exports.copy = function(shader) {
		let clone = Object.assign({}, shader);
		clone.id = null;
		return clone;
	};

	return exports;
})();

},{"./renderer":29}],32:[function(require,module,exports){
const Shader = require('./shader');

module.exports = (function() {
	let exports = {};

	let unlitColor = {
		vsSource: [
			"attribute vec3 aVertexPosition;",
	
			"uniform mat4 uMVMatrix;",
			"uniform mat4 uPMatrix;",
	
			"void main(void) {",
				"gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
			"}"
		].join('\n'),
		fsSource: [
			"precision mediump float;",
	
			"uniform vec3 uColor;",
	
			"void main(void) {",
				"gl_FragColor = vec4(uColor, 1.0);",
			"}"
		].join('\n'),
		attributeNames: [ "aVertexPosition", ],
		uniformNames: [ "uMVMatrix", "uPMatrix", "uColor" ],
		pMatrixUniformName: "uPMatrix",
		mvMatrixUniformName: "uMVMatrix",
		bindMaterial: function(material) {
			this.enableAttribute("aVertexPosition");
			this.setUniformFloat3("uColor", material.color[0], material.color[1], material.color[2]);
		},
		bindBuffers: function(mesh) {
			this.setAttribute("aVertexPosition", mesh.vertexBuffer);
			this.setIndexedAttribute(mesh.indexBuffer);
		},
		validateMaterial: function(material) {
			if (!material.color) {
				console.error("No color property specified on material using UnlitColor shader");
			} else if (material.color.length < 3) {
				console.error("Color property on material using UnlitColor shader must be a vec3");
			}
		}
	};

	let unlitTextured = {
		vsSource: [
			"attribute vec3 aVertexPosition;",
			"attribute vec2 aTextureCoord;",
	
			"uniform mat4 uMVMatrix;",
			"uniform mat4 uPMatrix;",
	
			"varying vec2 vTextureCoord;",
			"void main(void) {",
				"gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
				"vTextureCoord = aTextureCoord;",
			"}"
		].join('\n'),
		fsSource: [
			"precision mediump float;",
	
			"varying vec2 vTextureCoord;",

			"uniform sampler2D uSampler;",
			"uniform vec4 uColor;",
	
			"void main(void) {",
				"gl_FragColor = texture2D(uSampler, vTextureCoord) * uColor;",
			"}"
		].join('\n'),
		attributeNames: [ "aVertexPosition", "aTextureCoord" ],
		uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler", "uColor" ],
		textureUniformNames: [ "uSampler" ],
		pMatrixUniformName: "uPMatrix",
		mvMatrixUniformName: "uMVMatrix",
		bindMaterial: function(material) {
			this.enableAttribute("aVertexPosition");
			this.enableAttribute("aTextureCoord");
			if (material.color) {
				this.setUniformVector4("uColor", material.color);
			} else {
				this.setUniformFloat4("uColor", 1, 1, 1, 1);
			}
		},
		bindBuffers: function(mesh) {
			this.setAttribute("aVertexPosition", mesh.vertexBuffer);
			this.setAttribute("aTextureCoord", mesh.textureBuffer);
			this.setIndexedAttribute(mesh.indexBuffer);
		},
		validateMaterial: function(material) { }
	};

	let sprite = {
		vsSource: [
		"attribute vec3 aVertexPosition;",
		"attribute vec2 aTextureCoord;",
	
		"uniform mat4 uMVMatrix;",
		"uniform mat4 uPMatrix;",
	
		"varying vec2 vTextureCoord;",
		"void main(void) {",
			"gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
			"vTextureCoord = aTextureCoord;",
		"}"].join('\n'),
		fsSource: [
		"precision mediump float;",
	
		"varying vec2 vTextureCoord;",
	
		"uniform vec2 uOffset;",
		"uniform vec2 uScale;",
	
		"uniform sampler2D uSampler;",
	
		"uniform vec4 uColor;",
		"uniform vec4 uMixColor;",
	
		"void main(void) {",
			"vec4 color = texture2D(uSampler, vec2(uOffset.x + (uScale.x * vTextureCoord.s), uOffset.y + (uScale.y * vTextureCoord.t))) * uColor;",
			"gl_FragColor = mix(color, vec4(uMixColor.rgb, color.a), uMixColor.a);",
		"}"].join('\n'),
	
		attributeNames: [ "aVertexPosition", "aTextureCoord" ],
		uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler", "uOffset", "uScale", "uColor", "uMixColor" ],
		textureUniformNames: [ "uSampler" ],
		pMatrixUniformName: "uPMatrix",
		mvMatrixUniformName: "uMVMatrix",
		bindMaterial: function(material) {
			this.enableAttribute("aVertexPosition");
			this.enableAttribute("aTextureCoord");
			this.setUniformVector2("uOffset", material.offset);
			this.setUniformVector2("uScale", material.scale);
			if (material.color) {
				this.setUniformVector4("uColor", material.color);
			} else {
				this.setUniformFloat4("uColor", 1, 1, 1, 1);
			}
			if (material.mixColor) {
				this.setUniformVector4("uMixColor", material.mixColor);
			} else {
				this.setUniformFloat4("uMixColor", 1, 1, 1, 0);
			}
		},
		bindBuffers: function(mesh) {
			this.setAttribute("aVertexPosition", mesh.vertexBuffer);
			this.setAttribute("aTextureCoord", mesh.textureBuffer);
			this.setIndexedAttribute(mesh.indexBuffer);
		},
		validateMaterial: function(material) {
			if (material.offset === undefined || material.offset.length != 2)
				console.error("Material using Sprite shader must have a offset property set to a vec2");
			if (material.scale === undefined || material.scale.length != 2)
				console.error("Material using Sprite shader must have scale property set to a vec2");
		}
	};

	exports.createShaders = function() {
		exports.UnlitTextured = Shader.create(unlitTextured);
		exports.UnlitColor = Shader.create(unlitColor);
		exports.Sprite = Shader.create(sprite);
	};

	return exports;
})();
},{"./shader":31}],33:[function(require,module,exports){
// Simple single line text mesh using Atlas
// Broadly similar to tilemap, however supports varying position based on custom tile widths
// Prefabs generated by Atlas do not adjust for variable width so there is unnecessary blending / overdraw

const Atlas = require('./atlas');
const { vec3 } = require('./maths');

module.exports = (function(){
	let exports = {};

	let Alignment = exports.Alignment = {
		"left": 0,
		"center": 1,
		"right": 2
	};

	// Determines how round initial left most position when aligning
	// No rounding, floor to integer, or floor to the atlas.tileSize
	// Note: grid only works with atlases with static tile widths
	let AlignmentStyle = exports.AlignmentStyle = {
		"free": 0,
		"integer": 1,
		"grid": 2,
	};

	// Default alignment style - Assumes UI is pixel perfect, so integer
	exports.alignmentStyle = AlignmentStyle.integer;

	let atlasWidths = {};

	let generateCharWidthLookup = (atlas) => {
		let lookup = {};
		if (hasVariableTileWidths(atlas)) {
			for (let i = 0, l = atlas.customTileWidths.length; i < l; i++) {
				let { width, tiles } = atlas.customTileWidths[i];
				for (let j = 0, n = tiles.length; j < n; j++) {
					lookup[tiles[j]] = width;
				}
			}
		} 
		atlasWidths[atlas.id] = lookup;
	};

	let hasVariableTileWidths = exports.hasVariableTileWidths = (atlas) => {
		return atlas.customTileWidths && atlas.customTileWidths.length;
	};

	let getCharWidth = exports.getCharWidth = (atlas, char) => {
		let tileWidth = atlas.tileWidth;
		let lookup = atlasWidths[atlas.id];
		if (lookup && lookup[char] !== undefined) {
			tileWidth = lookup[char];
		}
		return tileWidth;
	};

	exports.create = ({ text, scene, atlas, position, alignment, color, alignmentStyle }) => {
		if (alignmentStyle === undefined || alignmentStyle === null) {
			alignmentStyle = exports.alignmentStyle;
		}

		if (!atlasWidths[atlas.id]) {
			generateCharWidthLookup(atlas);
		}

		let tiles = [];

		let textMesh = {};
		textMesh.remove = () => {
			for (let i = 0, l = tiles.length; i < l; i++) {
				scene.remove(tiles[i]);
			}
			tiles.length = 0;
		};

		let calculateWidth = textMesh.calculateWidth = (text) => {
			let width = 0;
			if (hasVariableTileWidths(atlas)) {
				for (let i = 0, l = text.length; i < l; i++) {
					width += getCharWidth(atlas, text[i]);
				}
			} else {
				width = text.length * atlas.tileWidth;
			}
			return width;
		};

		let calculateAlignmentOffset = (alignment, text) => {
			let offset = 0;
			if (alignment == Alignment.center) {
				if (alignmentStyle == AlignmentStyle.grid && !hasVariableTileWidths(atlas)) {
					offset = Math.floor(text.length / 2) * atlas.tileWidth;
				} else {
					offset = calculateWidth(text) / 2;
				}
			} else if (alignment == Alignment.right) {
				offset = calculateWidth(text);
			}
			if (offset && alignmentStyle == AlignmentStyle.integer) {
				offset = Math.floor(offset);
			}
			return offset;
		};

		textMesh.getText = () => text;
		textMesh.setText = (value) => {
			textMesh.remove();

			let offset = calculateAlignmentOffset(alignment, value);
			
			let x = position[0] - offset, y = position[1], z = position[2];
			for (let i = 0, l = value.length; i < l; i++) {
				let char = value[i];
				let name = Atlas.createTilePrefab({ atlas: atlas, tile: char, color: color });
				tiles.push(scene.instantiate({
					name: name,
					position: vec3.fromValues(x, y, z)
				}));
				x += getCharWidth(atlas, char);
			}
			text = value;
		};

		textMesh.setText(text);

		return textMesh;
	};

	return exports;
})();
},{"./atlas":1,"./maths":11}],34:[function(require,module,exports){
const Renderer = require('./renderer');

module.exports = (function(){
	let exports = {};

	let FilterType = exports.FilterType = Renderer.FilterType;

	let TextureQuality = exports.TextureQuality = {
		Pixel: "pixel",			// Uses Mips and nearest pixel
		Highest: "highest",		// Uses Mips & Interp (trilinear)
		High: "high",			// Uses Mips & Interp (bilinear)
		Medium: "medium",		// Linear Interp
		Low: "low"				// Uses nearest pixel
	};

	let QualitySettings = exports.QualitySettings = {};
	QualitySettings[TextureQuality.Low] = {
		mag: FilterType.NEAREST,
		min: FilterType.NEAREST
	};
	QualitySettings[TextureQuality.Medium] = {
		mag: FilterType.LINEAR,
		min: FilterType.LINEAR
	};
	QualitySettings[TextureQuality.High] = {
		mag: FilterType.LINEAR,
		min: FilterType.LINEAR_MIPMAP_NEAREST,
		enableAnisotropicFiltering: true,
		generateMipmaps: true
	};
	QualitySettings[TextureQuality.Highest] = {
		mag: FilterType.LINEAR,
		min: FilterType.LINEAR_MIPMAP_LINEAR,
		enableAnisotropicFiltering: true,
		generateMipmaps: true
	};
	QualitySettings[TextureQuality.Pixel] = {
		// Unfortunately you can't use MAG_FILTER NEAREST with MIN_FILTER MIPMAP when using the anisotropy extension
		// you can without it however, so there is a trade off on crisp near pixels against blurry textures at severe angles
		mag: FilterType.NEAREST,
		min: FilterType.LINEAR_MIPMAP_LINEAR,
		enableAnisotropicFiltering: true,
		generateMipmaps: true
		// Could investigate using multiple samplers in a version 300 ES Shader and blending between them,
		// or using multiple texture with different settings, potentially using dFdx and dFdy to determine / estimate MIPMAP level
	};

	exports.create = (config) => {
		let { 
			source,
			quality = TextureQuality.Low,
			clamp = false,
			flipY = true,
		} = config;

		if (!source) {
			console.error("Null source provided to Texture.create config");
			return null;
		}

		let settings = QualitySettings[quality]; 
		if (!settings) {
			console.error("Unexpected quality value: " + quality);
			return null;
		}

		return Renderer.createTexture(
			source,
			clamp,
			flipY,
			settings.mag,
			settings.min,
			settings.generateMipmaps,
			settings.enableAnisotropicFiltering);
	};

	exports.load = (uri, config, callback) => {
		config = config || {};
		let image = new Image();
		image.onload = function() {
			config.source = image;
			texture = exports.create(config);
			callback(texture);
		}
		image.src = uri;
	};

	exports.createTextureArray = (config) => {
		let {
			source,
			width,
			height,
			imageCount,
			quality = TextureQuality.Low,
			clamp = false,
			flipY = true
		} = config;

		if (!source || !width || !height || !imageCount) {
			console.error("Texture array config requires source, width, height and imageCount, provided " + JSON.stringify(config));
			return null;
		}

		let settings = QualitySettings[quality]; 
		if (!settings) {
			console.error("Unexpected quality value: " + quality);
			return null;
		}

		return Renderer.createTextureArray(
			source,
			width,
			height,
			imageCount,
			clamp,
			flipY,
			settings.mag,
			settings.min,
			settings.generateMipmaps,
			settings.enableAnisotropicFiltering);
	};

	return exports;
})();
},{"./renderer":29}],35:[function(require,module,exports){
// Really basic tilemap using prefabs per tile

// Could probably be vastly improved by using a custom shader
// and a lookup texture into the atlas texture 
// (i.e. single quad, single material, easy to move etc)

const Atlas = require('./atlas');
const { vec3 } = require('./maths');

module.exports = (function(){
	let exports = {};

	exports.create = ({ scene, width: w, height: h, position: pos, atlas, defaultTile }) => {
		let tileMap = {};
		tileMap.width = w;
		tileMap.height =  h;

		let { tileWidth, tileHeight } = atlas;
		let position = vec3.clone(pos);
		let tiles = [];

		tileMap.setTile = (x, y, tile, color) => {
			let index = x + y * w;
			if (index >= 0 && index < tiles.length) {
				let name = Atlas.createTilePrefab({ atlas: atlas, tile: tile, color: color });
				if (tiles[index]) { scene.remove(tiles[index]); }
				tiles[index] = scene.instantiate({
					name: name,
					position: vec3.fromValues(position[0] + x * tileWidth, position[1] + y * tileHeight, position[2])
				});
			}
		};

		tileMap.fill = (tile, color) => {
			let name = Atlas.createTilePrefab({ atlas: atlas, tile: tile, color: color });
			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++) {
					let index = x + w * y;
					if (tiles[index]) { scene.remove(tiles[index]); }
					tiles[x + w * y] = scene.instantiate({
						name: name,
						position: vec3.fromValues(position[0] + x * tileWidth, position[1] + y * tileHeight, position[2])
					});
				}
			}
		};

		tileMap.isTileActive = (x, y) => {
			if (x >= 0 && y >= 0 && x < w && y < h) {
				return tiles[x + y * w].active;
			}
		};
		
		tileMap.setTileActive = (x, y, active) => {
			if (x >= 0 && y >= 0 && x < w && y < h) {
				tiles[x + y * w].active = active;
			}
		};

		tileMap.remove = () => {
			for (let i = 0, l = tiles.length; i < l; i++) {
				scene.remove(tiles[i]);
			}
		};

		if (defaultTile !== undefined) {
			tileMap.fill(defaultTile);
		} else {
			tiles.length = w * h;
		}

		return tileMap;
	};

	return exports;
})();
},{"./atlas":1,"./maths":11}],36:[function(require,module,exports){
const { quat, vec3, mat4 } = require('./maths');

module.exports = (function() {
	let exports = {};

	let _ = vec3.create();

	let prototype = {
		updateMatrix: function() {
			mat4.fromRotationTranslation(this.matrix, this.rotation, this.position);
			mat4.scale(this.matrix, this.matrix, this.scale);
			let parent = this.parent;
			if (parent) {
				parent.updateMatrix();
				mat4.multiply(this.matrix, parent.matrix, this.matrix);
			}
		},
		getWorldPosition: function(out) {
			if (!parent) {
				vec3.copy(out, this.position);
			} else {
				this.updateMatrix();
				mat4.getTranslation(out, this.matrix);
			}
			return out;
		},
		getWorldRotation: function(out) {
			if (!parent) {
				quat.copy(out, this.rotation);
			} else {
				this.updateMatrix();
				mat4.getRotation(out, this.matrix);
			}
			return out;
		},
		getWorldScale: function(out) {
			if (!parent) {
				vec3.copy(out, this.scale);
			} else {
				this.updateMatrix();
				mat4.getScaling(out, this.matrix);
			}
			return out;
		},
		getWorldPositionRotation: function(position, rotation) {
			if (!parent) {
				vec3.copy(position, this.position);
				quat.copy(rotation, this.rotation);
			} else {
				this.updateMatrix();
				mat4.decompose(rotation, position, _);
			}
		},
		getWorldPositionRotationScale: function(position, rotation, scale) {
			if (!parent) {
				vec3.copy(position, this.position);
				quat.copy(rotation, this.rotation);
				vec3.copy(scale, this.scale);
			} else {
				this.updateMatrix();
				mat4.decompose(rotation, position, scale);
			}
		}
	};

	exports.create = function({ position = vec3.create(), rotation = quat.create(), scale = vec3.fromValues(1.0, 1.0, 1.0) }) {
		let transform = Object.create(prototype);
		transform.position = position;
		transform.rotation = rotation;
		transform.scale = scale;
		transform.matrix = mat4.create();
		return transform;
	};
	return exports;
})();

},{"./maths":11}],37:[function(require,module,exports){
// Utils
module.exports = (function(){
	let exports = {};

	exports.Heap = require('./heap');

	exports.arrayCombine = (out, array) => {
		for (let i = 0, l = array.length; i < l; i++) {
			out.push(array[i]);
		}
	};

	exports.createScaledImage = function(config) {
		let canvas = document.createElement("canvas");
		canvas.style = "display: none";
		canvas.width = config.image.width * config.scale;
		canvas.height = config.image.height * config.scale;

		let ctx = canvas.getContext("2d");
		ctx.imageSmoothingEnabled = !!config.imageSmoothingEnabled;
		ctx.drawImage(config.image, 0, 0, canvas.width, canvas.height);

		return canvas;
	};

	return exports
})();
},{"./heap":7}],38:[function(require,module,exports){
module.exports = (function() {
	let exports = {};

	const defaultMaxWorkers = (navigator && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 4;
	// NOTE: Chrome often under reports effective hardwareConcurrency, in that you can often gain significant
	// performance improvements by setting to a higher number, presumably either despite context switching
	// or the browser is simply lying to us about then number of logical processors it will make use of

	let prototype = {
		maxWorkers: defaultMaxWorkers,
		isWorkerAvailable: function() {
			return this.inUseWorkerCount < this.maxWorkers;
		},
		requestWorker: function() {
			if (this.workerSrc) {
				for (let i = 0; i < this.maxWorkers; i++) {
					if (!this.workerInUse[i]) {
						if (!this.workers[i]) {
							this.workers[i] = new Worker(this.workerSrc);
							this.workers[i].workerIndex = i;
						}
						this.workerInUse[i] = true;
						this.inUseWorkerCount++;
						return this.workers[i];
					}
				}
			}
			return null;
		},
		returnWorker: function(worker) {
			this.workerInUse[worker.workerIndex] = false;
			this.inUseWorkerCount--;
		},
		updateMaxWorkerCount: function(count) {
			this.maxWorkers = count;
		}
	};

	exports.create = function(config) {
		let pool = Object.create(prototype);
		pool.workerSrc = config.src;
		if (config.maxWorkers) pool.maxWorkers = config.maxWorkers;
		pool.inUseWorkerCount = 0;
		pool.workers = [];
		pool.workerInUse = [];

		return pool;
	};

	return exports;
})();
},{}]},{},[4]);
