// Basic First Person Character Controller
// Test bed for AABB physics testing

// Potential Improvements:
// * Arrest velocity in perpendicular direction on collision (grounded and air)
// * Move player position to bottom of player box
// * Sidestep logic is unpolished
// * Rocket Impulse application falls off very quickly, perhaps should be max for set radius before fall off
// * Velocity is store of distance moved, not expected velocity next frame
// * The TODOs through this file

// globalize glMatrix
Fury.Maths.globalize();

// Init Fury
Fury.init({ canvasId: "fury" });
// Disable Aniso Filtering for this demo
Fury.Texture.QualitySettings["pixel"].enableAnisotropicFiltering = false;

// Create Camera & Scene
let camera = Fury.Camera.create({ near: 0.1, far: 1000000.0, fov: Fury.Maths.toRadian(60), ratio: 1.0, position: vec3.fromValues(0.0, 1.0, 0.0) });
let scene = Fury.Scene.create({ camera: camera, enableFrustumCulling: true });

// Physics world
let world = { boxes: [] };

let Maths = Fury.Maths;
let Physics = Fury.Physics;

let vec3ScaleXZ = (out, a, scale) => {
	let y = a[1];
	a[1] = 0;
	vec3.scale(out, a, scale);
	a[1] = out[1] = y;
};

// Fullscreen logic
let glCanvas = document.getElementById("fury");
glCanvas.style = "width: 100%; height: 100vh;";
document.body.style = "margin: 0; overflow-y: hidden;";
let cameraRatio = 1.0, resolutionFactor = 1.0;
let updateCanvasSize = (event) => {
	glCanvas.width = resolutionFactor * glCanvas.clientWidth;
	glCanvas.height = resolutionFactor * glCanvas.clientHeight;
	cameraRatio = glCanvas.clientWidth / glCanvas.clientHeight;
	if (camera && camera.ratio) camera.ratio = cameraRatio;
};
window.addEventListener('resize', updateCanvasSize);
updateCanvasSize();

// Create shader
let shader = Fury.Shader.create({
	vsSource: [
		"attribute vec3 aVertexPosition;",
		"attribute vec2 aTextureCoord;",

		"uniform mat4 uMVMatrix;",
		"uniform mat4 uPMatrix;",

		"uniform float uSScale;",
		"uniform float uTScale;",

		"varying vec2 vTextureCoord;",
		"void main(void) {",
			"gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
			"vTextureCoord = vec2(uSScale * aTextureCoord.s, uTScale * aTextureCoord.t);",
		"}"].join('\n'),
	fsSource: [
		"precision mediump float;",

		"varying vec2 vTextureCoord;",

		"uniform sampler2D uSampler;",

		"void main(void) {",
			"gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));",
		"}"].join('\n'),
	attributeNames: [ "aVertexPosition", "aTextureCoord" ],
	uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler", "uSScale", "uTScale" ],
	textureUniformNames: [ "uSampler" ],
	pMatrixUniformName: "uPMatrix",
	mvMatrixUniformName: "uMVMatrix",
	bindMaterial: function(material) {
		this.enableAttribute("aVertexPosition");
		this.enableAttribute("aTextureCoord");
		if (material.sScale) {
			this.setUniformFloat("uSScale", material.sScale);
		} else {
			this.setUniformFloat("uSScale", 1);
		}
		if (material.tScale) {
			this.setUniformFloat("uTScale", material.tScale);
		} else {
			this.setUniformFloat("uTScale", 1);
		}
	},
	bindBuffers: function(mesh) {
		this.setAttribute("aVertexPosition", mesh.vertexBuffer);
		this.setAttribute("aTextureCoord", mesh.textureBuffer);
		this.setIndexedAttribute(mesh.indexBuffer);
	},
	validateMaterial: function(material) {
		if (!material.sScale) {
			console.log("Warning: material does not have sScale property set");
		}
		if (!material.tScale) {
			console.log("Warning: material does not have tScale property set");
		}
	}
});

let namedMaterials = [];

// Creates a cuboid origin in centre of specifed width / height / depth
// x, y, z used to offset the UVs
// Texture coordinates 1:1 with world size
let createCuboidMesh = function(width, height, depth, x, y, z) {
	let sx = width / 2, sy = height / 2, sz = depth / 2;
	return {
		positions: [
			// Front face
			-sx, -sy,  sz,
			 sx, -sy,  sz,
			 sx,  sy,  sz,
			-sx,  sy,  sz,

			// Back face
			-sx, -sy, -sz,
			-sx,  sy, -sz,
			 sx,  sy, -sz,
			 sx, -sy, -sz,

			// Top face
			-sx,  sy, -sz,
			-sx,  sy,  sz,
			 sx,  sy,  sz,
			 sx,  sy, -sz,

			// Bottom face
			-sx, -sy, -sz,
			 sx, -sy, -sz,
			 sx, -sy,  sz,
			-sx, -sy,  sz,

			// Right face
			 sx, -sy, -sz,
			 sx,  sy, -sz,
			 sx,  sy,  sz,
			 sx, -sy,  sz,

			// Left face
			-sx, -sy, -sz,
			-sx, -sy,  sz,
			-sx,  sy,  sz,
			-sx,  sy, -sz],
		uvs: [
			// Updated uvs as noted from naive to match trenchbroom's texture mapping
			// Front face - swapped x direction
			x+sx, y-sy,
			x-sx, y-sy,
			x-sx, y+sy,
			x+sx, y+sy,

			// Back face - swapped x direction
			x+sx, y-sy,
			x+sx, y+sy,
			x-sx, y+sy,
			x-sx, y-sy,

			// Top face - swapped x and z
			z+sz, x-sx,
			z-sz, x-sx,
			z-sz, x+sx,
			z+sz, x+sx,

			// Bottom face - swapped x and z
			z+sz, x+sx,
			z+sz, x-sx,
			z-sz, x-sx,
			z-sz, x+sx,

			// Right face
			z+sz, y-sy,
			z+sz, y+sy,
			z-sz, y+sy,
			z-sz, y-sy,

			// Left face - swaped z direction
			z+sz, y-sy,
			z-sz, y-sy,
			z-sz, y+sy,
			z+sz, y+sy ],
		indices: [
			0, 1, 2,      0, 2, 3,    // Front face
			4, 5, 6,      4, 6, 7,    // Back face
			8, 9, 10,     8, 10, 11,  // Top face
			12, 13, 14,   12, 14, 15, // Bottom face
			16, 17, 18,   16, 18, 19, // Right face
			20, 21, 22,   20, 22, 23  // Left face
		] };
};

let createCuboid = function(w, h, d, x, y, z, material) {
	let position = vec3.fromValues(x, y, z);
	let size = vec3.fromValues(w, h, d);
	let mesh = Fury.Mesh.create(createCuboidMesh(w, h, d, x, y, z));
	let box = Physics.Box.create({ center: position, size: size });
	// Note if you move the cuboid you have to recalculate min max

	// Add to scene and physics world
	world.boxes.push(box);
	return scene.add({ material: material, mesh: mesh, position: position, static: true });
};

// Quick and Dirty .map file loader
// Supports only AABB
// c.f. http://www.gamers.org/dEngine/quake/QDP/qmapspec.html
let MapLoader = (function(){
	let exports = {};

	let assertLineStartsWith = (lines, index, startsWith) => {
		if (!lines[index].startsWith(startsWith)) {
			throw new Error("Unexpected start to line " + index + " expected '" + startsWith + "' actual '" + lines[index] + "'");
		}
	};

	let parseVector = (out, str, scaleFactor) => {
		// Quake uses different coordinate system
		let split = str.split(' ');
		out[0] = scaleFactor * -parseInt(split[1], 10);
		out[1] = scaleFactor * parseInt(split[2], 10);
		out[2] = scaleFactor * -parseInt(split[0], 10);
	};

	let parseAABBFromBrush = (out, brush, scaleFactor) => {
		let x1, x2, y1, y2, z1, z2;
		let xFound = false, yFound = false, zFound = false;
		for (let i = 0; i < 6; i++) {
			let plane = brush.planes[i]; 

			// Convert Points to AABB
			// These points define a plane, the correct way to solve is determine normal and point and then intersect the defined planes to determine
			// vertices, however because we're limiting ourselves to AABB we can take a shortcut, which is one axis will have the same value across
			// all three points, and this is one of that components min or max for the AABB
			if (plane.p1[0] == plane.p2[0] && plane.p2[0] == plane.p3[0]) {
				if (!xFound) {
					x1 = plane.p1[0];
					xFound = true;
				} else {
					x2 = plane.p1[0];
				}
			} else if (plane.p1[1] == plane.p2[1] && plane.p2[1] == plane.p3[1]) {
				if (!yFound) {
					y1 = plane.p1[1];
					yFound = true;
				} else {
					y2 = plane.p1[1];
				}
			} else if (plane.p1[2] == plane.p2[2] && plane.p2[2] == plane.p3[2]) {
				if (!zFound) {
					z1 = plane.p2[2];
					zFound = true;
				} else {
					z2 = plane.p2[2];
				}
			}
		}

		// Convert Coordinates from Quake Space
		let xMin = Math.min(-y1, -y2), xMax = Math.max(-y1, -y2);
		let yMin = Math.min(z1, z2), yMax = Math.max(z1, z2);
		let zMin = Math.min(-x1, -x2), zMax = Math.max(-x1, -x2);

		xMin *= scaleFactor;
		xMax *= scaleFactor;
		yMin *= scaleFactor;
		yMax *= scaleFactor;
		zMin *= scaleFactor;
		zMax *= scaleFactor;

		out.xMin = xMin;
		out.xMax = xMax;
		out.yMin = yMin;
		out.yMax = yMax;
		out.zMin = zMin;
		out.zMax = zMax;
	}; 

	let instanitateWorldBrushes = (brushes, scaleFactor, instantiationDelegate) => {
		let aabb = {};
		for (let i = 0, l = brushes.length; i < l; i++) {
			parseAABBFromBrush(aabb, brushes[i], scaleFactor);
			// TODO: Support texture name per face
			instantiationDelegate(aabb, brushes[i].planes[0].texture.name)
		}
	};

	exports.parse = (data) => {
		// Parse line by line
		let lines = data.split('\n');

		let lineIndex = 0;
		// Parse Starting Comment Info
		let properties = {};
		let colonIndex = lines[lineIndex].indexOf(":"); 
		while (colonIndex !== -1) {
			let line = lines[lineIndex];
			let name = line.substring(3, colonIndex);
			let value = line.substring(colonIndex + 2).trim();
			properties[name] = value;
			lineIndex++;
			colonIndex = lines[lineIndex].indexOf(":");
		}

		let entities = [];
		// Parse Entities
		while (lines[lineIndex].startsWith("//")) { // Expect comment giving entity name
			let entity = {};
			entity.name = lines[lineIndex].substring(3).trim(); 
			lineIndex += 1;

			assertLineStartsWith(lines, lineIndex, "{");
			lineIndex += 1;

			// Parse Entity Properties
			while (!lines[lineIndex].startsWith("}") && !lines[lineIndex].startsWith("//")) {
				assertLineStartsWith(lines, lineIndex, '"');
				let propertyData = lines[lineIndex].split('"');
				entity[propertyData[1]] = propertyData[3];
				lineIndex++;
			}

			while (lines[lineIndex].startsWith("//")) {	// Expect comment giving brush name
				// Brushes Incoming!
				let brush = {};
				brush.name = lines[lineIndex].substring(3).trim();
				lineIndex++;
				assertLineStartsWith(lines, lineIndex, "{");
				lineIndex++;
				// Parse Brush Info
				brush.planes = [];
				while (!lines[lineIndex].startsWith("}")) {
					let planeInfo = lines[lineIndex].split(' ');
					let plane = {
						p1: [parseInt(planeInfo[1], 10), parseInt(planeInfo[2], 10), parseInt(planeInfo[3], 10)],	// 1-> 3
						p2: [parseInt(planeInfo[6], 10), parseInt(planeInfo[7], 10), parseInt(planeInfo[8], 10)],  // 6 -> 8
						p3: [parseInt(planeInfo[11], 10), parseInt(planeInfo[12], 10), parseInt(planeInfo[13], 10)], // 11 -> 13
						texture: { 
							name: planeInfo[15],
							xOffset: planeInfo[16],
							yOffset: planeInfo[17],
							angle: planeInfo[18],
							xScale: planeInfo[19],
							yScale: planeInfo[20]
						}
					};
					brush.planes.push(plane);
					lineIndex++;
				}
				if (!entity.brushes) {
					entity.brushes = [];
				}
				entity.brushes.push(brush);
				// Consume brush closing line
				lineIndex++;
				// now expect comment for next brush or close
			}
			// Assert entity close
			assertLineStartsWith(lines, lineIndex, "}"); 
			entities.push(entity);
			lineIndex++;
		}

		// Return Map Object
		return {
			properties: properties,
			entities: entities
		};
	};

	exports.instantiate = (data, scaleFactor, instantiationDelegate) => {
		let playerSpawn = {
			origin: [0, 0, 0],
			angle: 0
		};

		for (let i = 0, l = data.entities.length; i < l; i++) {
			let entity = data.entities[i];
			switch (entity.classname) {
				case "worldspawn":
					instanitateWorldBrushes(entity.brushes, scaleFactor, instantiationDelegate);
					break;
				case "info_player_start":
					parseVector(playerSpawn.origin, entity.origin, scaleFactor);
					playerSpawn.angle = parseInt(entity.angle, 10);
					break;
				case "trigger_push": // Game Specific
					// TODO: relying on globals - remove reliance
					entity.aabb = {};
					parseAABBFromBrush(entity.aabb, entity.brushes[0], scaleFactor);
					triggerVolumes.push(TriggerVolume.create(entity));
					break;
			}
		}

		return playerSpawn;
	};

	return exports;
})();

// Quick and dirty trigger volume!
let TriggerVolume = (function(){
	let exports = {};

	exports.create = (params) => {
		let triggerVolume = {};
		triggerVolume.box = Physics.Box.create({
			min: vec3.fromValues(params.aabb.xMin, params.aabb.yMin, params.aabb.zMin),
			max: vec3.fromValues(params.aabb.xMax, params.aabb.yMax, params.aabb.zMax)
		});
		triggerVolume.triggered = false;
		triggerVolume.resetTimer = 0;
		triggerVolume.update = (elapsed) => {
			if (triggerVolume.triggered) {
				triggerVolume.resetTimer -= elapsed;
				if (triggerVolume.resetTimer <= 0) {
					triggerVolume.resetTimer = 0;
					triggerVolume.triggered = false;
				}
			}
		};
		triggerVolume.speed = params.speed;
		let angleC = params.angle.split(' ');
		let launchDirection = vec3.fromValues(parseFloat(angleC[0]), parseFloat(angleC[1]), parseFloat(angleC[2]));
		vec3.normalize(launchDirection, launchDirection);
		triggerVolume.launchDirection = launchDirection;
		triggerVolume.tryIntersectBox = (box) => {
			if (!triggerVolume.triggered && Physics.Box.intersect(box, triggerVolume.box)) {
				triggerVolume.triggered = true;
				triggerVolume.resetTimer = 1;
				return true;
			}
			return false;
		};
		return triggerVolume;
	};

	return exports;
})();

let CharacterController = (() => {
	let exports = {};
	
	// Used to store collisions, with minimum times and indices
	let CollisionInfo = (() => {
		let exports = {};

		exports.copy = (out, a) => {
			out.overlapCount = a.overlapCount;
			out.collisionsBuffer.length = out.overlapCount; 
			// Only stores relevant elements from buffer - previous matches left in buffer are discarded
			for(let i = 0; i < out.overlapCount; i++) { 
				out.collisionsBuffer[i] = a.collisionsBuffer[i];
			}
			for (let i = 0; i < 3; i++) {
				out.minTime[i] = a.minTime[i];
				out.minIndex[i] = a.minIndex[i]; 
			}
		};

		exports.create = () => {
			return {
				collisionsBuffer: [],
				minTime: [],
				minIndex: [],
				overlapCount: 0
			};
		};

		return exports;
	})();

	let useSideStep = false;
	let allowSideStepSlide = false;
	let sideStepDistance = 0.5;
	exports.useSideStep = (value) => {
		useSideStep = value;
		return "Use Side Step " + value;
	};
	exports.allowSideStepSlide = (value) => {
		allowSideStepSlide = value;
		return "Allow Side Step Slide " + value;
	};
	exports.setSideStepDistance = (value) => {
		sideStepDistance = Math.abs(sideStepDistance);
		return "Slide Step Distance " + value;
	};

	let playerCollisionInfo = CollisionInfo.create();
	let collisionInfoCache = CollisionInfo.create();
	let collisionInfoCache2 = CollisionInfo.create();
	let relevantBoxes = []; // Array used to store sub-set of boxes to consider for XZ calculations

	let checksEntersAxis = (out, box, playerBox, axis, collisionBufferIndex, targetPosition, playerPosition, elapsed) => {
		let delta = targetPosition[axis] - playerPosition[axis];
		if (Math.abs(delta) > 0 && Physics.Box.entersAxis(box, playerBox, axis, delta)) {
			checkMinTime(out, box, playerBox, axis, collisionBufferIndex, elapsed, delta);
			return true;
		}
		return false;
	};

	let checkMinTime = (out, box, playerBox, axis, collisionBufferIndex, elapsed, delta) => {
		let distance = 0;
		if (delta > 0) {
			// player max will cross box min
			distance = playerBox.max[axis] - box.min[axis];
		} else {
			// player min will cross box max
			distance = playerBox.min[axis] - box.max[axis];
		}
		let time = distance / Math.abs(delta / elapsed);
		if (time < out.minTime[axis]) {
			out.minTime[axis] = time;
			out.minIndex[axis] = collisionBufferIndex;
		}
	};

	let sweepForRevelantBoxes = (() => {
		let min = vec3.create();
		let max = vec3.create();
		let delta = vec3.create();
		let sweepBox = Physics.Box.create({ min: min, max: max });

		return (out, boxes, playerBox, targetPosition, currentPosition, stepHeight) => {
			// This could probably be broken into 2 util methods and moved to Fury
			// box.expand (by delta) & world.getAllOverlaps (box)
			vec3.subtract(delta, targetPosition, currentPosition);
			min[0] = Math.min(playerBox.min[0] + delta[0], playerBox.min[0]);
			min[1] = Math.min(playerBox.min[1] + delta[1], playerBox.min[1]);  
			min[2] = Math.min(playerBox.min[2] + delta[2], playerBox.min[2]);
			max[0] = Math.max(playerBox.max[0] + delta[0], playerBox.max[0]);
			max[1] = Math.max(playerBox.max[1] + delta[1], playerBox.max[1]) + stepHeight;  
			max[2] = Math.max(playerBox.max[2] + delta[2], playerBox.max[2]);
			sweepBox.recalculateExtents();
	
			let overlapCount = 0;
			for (let i = 0, l = boxes.length; i < l; i++) {
				if (Physics.Box.intersect(boxes[i], sweepBox)) {
					out[overlapCount] = boxes[i];
					overlapCount += 1;
				}
			}
			out.length = overlapCount;
		}; 
	})();

	let getTouchPointTarget = (closestBox, playerBox, axis, delta) => {
		if (delta <= 0) {
			// new target position max + extents
			return closestBox.max[axis] + playerBox.extents[axis];
		} else {
			// new target position min - extents
			return closestBox.min[axis] - playerBox.extents[axis];
		}
	};

	exports.create = (parameters) => {
		let controller = {};
	
		// private variables
		let targetPosition = vec3.create();	
		let lastPosition = vec3.create();
		let world = parameters.world;
		let playerPosition = parameters.playerPosition;
		let playerBox = parameters.playerBox;
		let stepHeight = parameters.stepHeight;

		// private methods 
		let tryStep = (axis, maxStepHeight, elapsed) => {
			let stepSuccess = false;
			let collisionsBuffer = playerCollisionInfo.collisionsBuffer;
			let minIndex = playerCollisionInfo.minIndex;
			if (collisionsBuffer[minIndex[axis]].max[1] < maxStepHeight) {
				// Try step!
				let targetY = targetPosition[1];
				targetPosition[1] = collisionsBuffer[minIndex[axis]].max[1] + playerBox.extents[1]; 
				// alt ^^: playerPosition[1] + collisionsBuffer[minIndex[axis]].max[1] - playerBox.min[1];
				CollisionInfo.copy(collisionInfoCache, playerCollisionInfo);
				if (checkForPlayerCollisions(playerCollisionInfo, relevantBoxes, elapsed) == 0) {
					stepSuccess = true;
					// Only step if it's completely clear to move to the target spot for ease
				} else {
					// TODO: If collision is only in axis of primary movement, consider sidestep 
					targetPosition[1] = targetY;
					CollisionInfo.copy(playerCollisionInfo, collisionInfoCache);
				}
			}
			return stepSuccess;
		};

		let trySideStep = (box, pma, sma, maxSideStepDistance, delta, elapsed) => {
			let sideStepSuccess = false;
			let targetPosSma = targetPosition[sma];
			let targetPosPma = targetPosition[pma];
			let tryStep = false;
			
			if (!allowSideStepSlide) {
				// Only side step as far as you would move anyway
				maxSideStepDistance = Math.min(maxSideStepDistance, Math.abs(delta));
			}
			
			let sideStepToMinDistance = Math.abs(box.min[sma] - playerBox.max[sma]);
			let sideStepToMaxDistance = Math.abs(box.max[sma] - playerBox.min[sma]);

			if (sideStepToMinDistance < maxSideStepDistance && sideStepToMinDistance < sideStepToMaxDistance) {
				if (box.min[sma] > playerBox.max[sma]) throw new Error("Box min was greater than player box max during side step calculation");
				// Redirect movement to sidestep towards box min (i.e. -ve)
				let sideStepDistance = Math.min(sideStepToMinDistance, Math.abs(delta));
				if (sideStepToMinDistance < Math.abs(delta)) {
					// Can full sidestep so use precise position
					targetPosition[sma] = box.min[sma] - playerBox.extents[sma];
				} else {
					targetPosition[sma] = playerPosition[sma] - sideStepDistance;	
				}
				targetPosition[pma] = playerPosition[pma] + Math.sign(delta) * (Math.abs(delta) - sideStepDistance);
				tryStep = true;
			} else if (sideStepToMaxDistance < maxSideStepDistance) {
				if (box.max[sma] < playerBox.min[sma]) throw new Error("Box max was less than player box min during side step calculation");
				// Redirect movement to sidestep towards box max (i.e. +ve)
				let sideStepDistance = Math.min(sideStepToMaxDistance, Math.abs(delta));
				if (sideStepToMaxDistance < Math.abs(delta)) {
					// Can full sidestep so use precise position
					targetPosition[sma] = box.max[sma] + playerBox.extents[sma];
				} else {
					targetPosition[sma] = playerPosition[sma] + sideStepDistance;  
				}
				targetPosition[pma] = playerPosition[pma] + Math.sign(delta) * (Math.abs(delta) - sideStepDistance);
				tryStep = true;
			}

			if (tryStep) {
				CollisionInfo.copy(collisionInfoCache2, playerCollisionInfo);
				if (checkForPlayerCollisions(playerCollisionInfo, relevantBoxes, elapsed) == 0) {
					sideStepSuccess = true;
				} else {
					targetPosition[sma] = targetPosSma;
					targetPosition[pma] = targetPosPma;
					CollisionInfo.copy(playerCollisionInfo, collisionInfoCache2);
				}
			}

			return sideStepSuccess;
		};

		let checkForPlayerCollisions = (out, boxes, elapsed) => {
			let overlapCount = 0;
			let collisionCount = 0;
			
			out.minIndex[0] = out.minIndex[1] = out.minIndex[2] = -1;
			out.minTime[0] = out.minTime[1] = out.minTime[2] = elapsed + 1;
		
			for (let i = 0, l = boxes.length; i < l; i++) {
				let box = boxes[i];
		
				let deltaX = targetPosition[0] - playerPosition[0];
				let deltaY = targetPosition[1] - playerPosition[1];
				let deltaZ = targetPosition[2] - playerPosition[2];
				let intersectsX = Physics.Box.intersectsAxisOffset(box, playerBox, 0, deltaX);
				let entersX = deltaX && Physics.Box.entersAxis(box, playerBox, 0, deltaX);
				let intersectsY = Physics.Box.intersectsAxisOffset(box, playerBox, 1, deltaY);
				let entersY = deltaY && Physics.Box.entersAxis(box, playerBox, 1, targetPosition[1] - playerPosition[1]);
				let intersectsZ = Physics.Box.intersectsAxisOffset(box, playerBox, 2, deltaZ);
				let entersZ = deltaZ && Physics.Box.entersAxis(box, playerBox, 2, targetPosition[2] - playerPosition[2]);
		
				if ((intersectsX || entersX) && (intersectsY || entersY) && (intersectsZ || entersZ)
					&& (entersX || entersY || entersZ)) {
					if (entersX) checkMinTime(out, box, playerBox, 0, overlapCount, elapsed, deltaX);
					if (entersY) checkMinTime(out, box, playerBox, 1, overlapCount, elapsed, deltaY);
					if (entersZ) checkMinTime(out, box, playerBox, 2, overlapCount, elapsed, deltaZ);
		
					out.collisionsBuffer[overlapCount] = box;
					collisionCount += 1;
					overlapCount += 1;
				} else if (intersectsX && intersectsY && intersectsZ) {
					out.collisionsBuffer[overlapCount] = box;
					overlapCount += 1;
				}
			}
		
			out.overlapCount = overlapCount;
		
			return collisionCount;
		};
		
		// Y Axis only version of checkForPlayerCollisions
		// Logic can be simplified when assuming no XZ movement
		let checkForPlayerCollisionsY = (out, boxes, elapsed) => {
			let collisionCount = 0;
			let overlapCount = 0;
			
			out.minIndex[0] = out.minIndex[1] = out.minIndex[2] = -1;
			out.minTime[0] = out.minTime[1] = out.minTime[2] = elapsed + 1;
		
			// Note enters axis does not do a box cast, merely checks current against new
			// i.e. you can move through boxes at high enough speed - TODO: box cast 
			for (let i = 0, l = boxes.length; i < l; i++) {
				if (Physics.Box.intersectsAxis(boxes[i], playerBox, 0) && Physics.Box.intersectsAxis(boxes[i], playerBox, 2)) {
					if (checksEntersAxis(out, boxes[i], playerBox, 1, overlapCount, targetPosition, playerPosition, elapsed)) {
						out.collisionsBuffer[overlapCount] = boxes[i];
						collisionCount += 1;
						overlapCount += 1;
					} else if (Physics.Box.intersectsAxis(boxes[i], playerBox, 1)) {
						out.collisionsBuffer[overlapCount] = boxes[i];
						overlapCount += 1;
					}
				}
			}
		
			out.overlapCount = overlapCount;
		
			return collisionCount;
		};

		// Public Methods
		let teleport = controller.teleport = (targetPosition) => {
			vec3.copy(playerPosition, targetPosition);
			// playerBox.center has changed because it's set to the playerPosition ref
			// TODO: Ensure this is the case currently it's up to consuming code to set it up correctly
			playerBox.recalculateMinMax();
		};

		controller.moveXZ = (contacts, velocity, elapsed, inputVector) => {
			vec3.copy(lastPosition, playerPosition);
			vec3.copy(targetPosition, playerPosition);
			vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3.X, velocity[0] * elapsed);
			vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3.Z, velocity[2] * elapsed);

			let requestedVx = velocity[0];
			let requestedVz = velocity[2];

			// As we might be checking collision repeatedly sweep out maximal set first
			sweepForRevelantBoxes(relevantBoxes, world.boxes, playerBox, targetPosition, playerPosition, stepHeight);
			// TODO: ^^ This could be replaced by a World partitioning system and a method to retrieve locally revelant collision boxes 

			checkForPlayerCollisions(playerCollisionInfo, relevantBoxes, elapsed);
		
			// Local variables to arrays for less typing
			let collisionsBuffer = playerCollisionInfo.collisionsBuffer;
			let minTime = playerCollisionInfo.minTime;
			let minIndex = playerCollisionInfo.minIndex;
		
			let maxStepHeight = playerBox.min[1] + stepHeight; 
			let resolvedX = minIndex[0] == -1, resolvedZ = minIndex[2] == -1;
		
			if (!resolvedX && !resolvedZ) {
				let fca = minTime[0] < minTime[2] ? 0 : 2; // First Collision Axis
		
				// Prioritise moving along the axis with the highest delta 
				// (for inanimate objects should prioritse move along first collision axis, however for a character intent is important)
				// (this allow us to slide into tight spaces more easily)
				let absDeltaZ = Math.abs(targetPosition[2] - playerPosition[2]);
				let absDeltaX = Math.abs(targetPosition[0] - playerPosition[0]);
				// If input vector is provided use it for intention as velocity is reduced by collisions
				if (inputVector) {
					absDeltaZ = Math.abs(inputVector[2]);
					absDeltaX = Math.abs(inputVector[0]);
				}
				let pma = absDeltaZ < absDeltaX ? 0 : 2; // Primary movement axis
				let sma = absDeltaZ < absDeltaX ? 2 : 0; // Secondary movement axis
		
				if (!tryStep(fca, maxStepHeight, elapsed)) {
					// Try moving along pma first
					let targetPosCache = targetPosition[sma];
					contacts[sma] = Math.sign(targetPosition[sma] - playerPosition[sma]);
					targetPosition[sma] = getTouchPointTarget(collisionsBuffer[minIndex[sma]], playerBox, sma, targetPosition[sma] - playerPosition[sma]);
					
					checkForPlayerCollisions(playerCollisionInfo, relevantBoxes, elapsed);
					
					if (minIndex[pma] != -1) {
						// Still impacting on prioritised collision axis
						if (!tryStep(pma, maxStepHeight, elapsed)) {
							// Step did not resolve all collision
							// No more sliding along in prioritised collision axis
							contacts[pma] = Math.sign(targetPosition[pma] - playerPosition[pma]);
							targetPosition[pma] = getTouchPointTarget(collisionsBuffer[minIndex[pma]], playerBox, pma, targetPosition[pma] - playerPosition[pma]);
		
							// Try sliding the deprioritised collisation axis instead (with minimal movement in prioritised collision axis)
							contacts[sma] = 0;
							targetPosition[sma] = targetPosCache;
							checkForPlayerCollisions(playerCollisionInfo, relevantBoxes, elapsed);
		
							if (minIndex[sma] != -1) {
								if (!tryStep(sma, maxStepHeight, elapsed)) {
									// No dice really in a corner
									contacts[sma] = Math.sign(targetPosition[sma] - playerPosition[sma]);
									targetPosition[sma] = getTouchPointTarget(collisionsBuffer[minIndex[sma]], playerBox, sma, targetPosition[sma] - playerPosition[sma]);
								}
							}
						}
					}
				}
		
			} else if (!resolvedX || !resolvedZ) {
				let fca = resolvedZ ? 0 : 2; // First Collision Axis
				let sca = resolvedZ ? 2 : 0; // Second Collision Axis (though there's no collision initially)
				
				// Check if collision is in larger axis of movement, if so should consider attempting to sidestep the object
				let shouldConsiderSidestep = useSideStep && Math.abs(targetPosition[fca] - playerPosition[fca]) > Math.abs(targetPosition[sca] - playerPosition[sca]);

				if (!tryStep(fca, maxStepHeight, elapsed)) { 
					if (!shouldConsiderSidestep 
						|| !trySideStep(collisionsBuffer[minIndex[fca]], fca, sca, sideStepDistance, targetPosition[fca] - playerPosition[fca], elapsed)) {
						// Try step and try side step failed, move up to object instead
						contacts[fca] = Math.sign(targetPosition[fca] - playerPosition[fca]);
						targetPosition[fca] = getTouchPointTarget(collisionsBuffer[minIndex[fca]], playerBox, fca, targetPosition[fca] - playerPosition[fca]);
						checkForPlayerCollisions(playerCollisionInfo, relevantBoxes, elapsed);
						
						if (minIndex[sca] != -1) {
							// Oh no now that we're not moving in fca we're hitting something in sca
							contacts[sca] = Math.sign(targetPosition[sca] - playerPosition[sca]);
							targetPosition[sca] = getTouchPointTarget(collisionsBuffer[minIndex[sca]], playerBox, sca, targetPosition[sca] - playerPosition[sca]);
						}
					}
				}
			} else {
				contacts[0] = contacts[2] = 0;
			}
		
			// Finally move the player to the approved target position
			teleport(targetPosition);
			
			// Cache Velocity
			velocity[0] = (playerPosition[0] - lastPosition[0]) / elapsed;
			velocity[2] = (playerPosition[2] - lastPosition[2]) / elapsed;	
			if (useSideStep) {
				// We actually want velocity to consider for next frame which if using sidestep is not necessarily the same
				// If using sidestep, compare to magnitude and direction of requested velocity
				if (Math.abs(velocity[0]) > Math.abs(requestedVx) || Math.sign(velocity[0]) != Math.abs(requestedVx)) {
					// Sidestepped larger than requested velocity or wrong direction - use the requested magnitude but in the direction of actual travel
					velocity[0] = Math.sign(velocity[0]) * Math.abs(requestedVx);
				}
				if (Math.abs(velocity[2]) > Math.abs(requestedVz) || Math.sign(velocity[2]) != Math.abs(requestedVz)) {
					// Sidestepped larger than requested velocity or wrong direction - use the requested magnitude but in the direction of actual travel
					velocity[2] = Math.sign(velocity[2]) * Math.abs(requestedVz);
				}
			}
		};

		controller.moveY = (contacts, velocity, elapsed) => {
			vec3.copy(lastPosition, playerPosition);	
			vec3.scaleAndAdd(targetPosition, playerPosition, Maths.vec3.Y, velocity[1] * elapsed);
			
			let collision = checkForPlayerCollisionsY(playerCollisionInfo, world.boxes, elapsed) > 0;
		
			if (collision) {
				let closestBox = playerCollisionInfo.collisionsBuffer[playerCollisionInfo.minIndex[1]];
				if (velocity[1] <= 0) {
					// Moving down, move playerPosition so player is extents above closestBox.max[1]
					playerPosition[1] = closestBox.max[1] + playerBox.extents[1];
					playerBox.recalculateMinMax();
					velocity[1] = (playerPosition[1] - lastPosition[1]) / elapsed;
					contacts[1] = -1;
				} else {
					// Moving up, move playerPosition so player is extents below  closestBox.min[1]
					playerPosition[1] = closestBox.min[1] - playerBox.extents[1];
					playerBox.recalculateMinMax();
					velocity[1] = (playerPosition[1] - lastPosition[1]) / elapsed;
					contacts[1] = 1;
				}
			} else {
				playerPosition[1] = targetPosition[1];
				playerBox.recalculateMinMax();
				contacts[1] = 0
			}
		};

		return controller;
	};

	return exports;
})();

let triggerVolumes = [];

let localX = vec3.create(), localZ = vec3.create();
let cameraTargetPosition = vec3.create();

let acceleration = 100;
let movementSpeed = 8;
let stopSpeed = 2;
let airMovementSpeed = 4;
let airAcceleration = 10;

let lookSpeed = 1;

// DeltaVs need to be instanteously applied (impulse / mass)
// They make no sense over multiple frames
let rocketDeltaV = 30;
let grounded = true, jumpDeltaV = 5; // Might be easier to configure jump as desired jump height against gravity rather than deltaV
let lastGroundedTime = 0, coyoteTime = 0.1, canCoyote = true, lastJumpAttemptTime = 0;
// coyoteTime used both as the time after leaving an edge you can still jump and the time before hitting the ground you can press the jump button and jump on landing
let gravity = 2 * 9.8;  // Increased gravity because games

// TODO: A player object with position, box and velocity might be preferable
let playerPosition = vec3.clone(camera.position);
let playerBox = Physics.Box.create({ center: playerPosition, size: vec3.fromValues(1, 2, 1) });
let playerVelocity = vec3.create();
let playerContacts = vec3.create();

let characterController = CharacterController.create({ 
	world: world,
	playerPosition: playerPosition,
	playerBox: playerBox,
	stepHeight: 0.3
});

let inputVector = vec3.create();
let localForward = vec3.create();
let hitPoint = vec3.create();

// Mouse look 
let mouseLookSpeed = 0.1;
let verticalLookAngle = 0;

// Request pointer lock when clicking on canvas
document.getElementById("fury").addEventListener('click', () => {
	if (!Fury.Input.isPointerLocked()) {
		let request = Fury.Input.requestPointerLock(); 
		if (request) {
			request.catch((error) => {
				window.setTimeout(Fury.Input.requestPointerLock, 1000);
			});
		} else {
			window.setTimeout(Fury.Input.requestPointerLock, 1000);
		}
	}
});
// document.addEventListener("pointerlockerror", lockError, false);

// Game Loop
let loop = function(elapsed) {
	// Rotation around axis
	let ry = 0, rx = 0;

	if (Fury.Input.isPointerLocked()) {
		ry -= mouseLookSpeed * elapsed * Fury.Input.MouseDelta[0];
		rx -= mouseLookSpeed * elapsed * Fury.Input.MouseDelta[1];
	}

	if (Fury.Input.keyDown("Left")) {
		ry += lookSpeed * elapsed;
	}
	if (Fury.Input.keyDown("Right")) {
		ry -= lookSpeed * elapsed;
	}
	if (Fury.Input.keyDown("Up")) {
		rx += lookSpeed * elapsed;
	}
	if (Fury.Input.keyDown("Down")) {
		rx -= lookSpeed * elapsed;
	}

	// Directly rotate camera
	Maths.quat.rotate(camera.rotation, camera.rotation, ry, Maths.vec3.Y);

	let clampAngle = 0.5 * Math.PI - 10 * Math.PI/180;
	let lastVerticalLookAngle = verticalLookAngle;
	verticalLookAngle = Fury.Maths.clamp(verticalLookAngle + rx, -clampAngle, clampAngle);
	quat.rotateX(camera.rotation, camera.rotation, verticalLookAngle - lastVerticalLookAngle);

	let inputX = 0, inputZ = 0;
	inputZ = Fury.Input.getAxis("s", "w"); // 0.05, Fury.Maths.Ease.inQuad
	inputX = Fury.Input.getAxis("d", "a"); // 0.05, Fury.Maths.Ease.inQuad
	// Note: Input smoothing removed from Fury 
	// TODO: Input smoother which listens for key presses and then smoothes on press and release
	// accounting for if full press or full release was reached on subsequent releases or presses.
	// or could just use SmoothDamp, c.f. https://github.com/delphic/asteria-combat/commit/f3c3376ab9e54eeba510f7badf1110eb53346c71

	// Calculate local axes for camera - ignoring roll
	// This would be easier with a character transform
	// Wouldn't need to zero the y component
	vec3.transformQuat(localX, Maths.vec3.X, camera.rotation);
	vec3.transformQuat(localZ, Maths.vec3.Z, camera.rotation);
	vec3.copy(localForward, localZ);	// Before 0ing out y component copy to forward
	localX[1] = 0;
	vec3.normalize(localX, localX);	// This should be unnecessary
	localZ[1] = 0;
	vec3.normalize(localZ, localZ);	// This should be unnecessary

	if (inputX !== 0 && inputZ !== 0) {
		// Normalize input vector if moving in more than one direction
		// TODO: Adjust for smoothing - i.e. actually normalise
		inputX /= Math.SQRT2;
		inputZ /= Math.SQRT2;
	}

	// Instant rocket launcher spawn impulse on mouse down
	if (Fury.Input.mouseDown(0, true)) {
		let temp = Maths.vec3.Pool.request();
		let hit = false;
		let closestDistance = 100;
		vec3.negate(localForward, localForward); // camera faces -z so invert
		// This is basically world.rayCast
		for (let i = 0, l = world.boxes.length; i < l; i++) {
			let s = Physics.Box.rayCast(temp, camera.position, localForward, world.boxes[i]);
			if (s && Math.abs(s) < closestDistance) {
				hit = true;
				closestDistance = Math.abs(s);
				vec3.copy(hitPoint, temp);
			}
		}
		vec3.negate(localForward, localForward); // point it away from facing direction again

		if (hit) {
			// Calculate closest point on box
			closestDistance = Physics.Box.rayCast(temp, hitPoint, localForward, playerBox);

			let velocityDelta = rocketDeltaV / (1 + closestDistance * closestDistance);	// 1 / (1 + dist) so rocketDeltaV is max velocity delta
			vec3.zero(temp);
			vec3.scaleAndAdd(temp, temp, localForward, velocityDelta);
			vec3.add(playerVelocity, playerVelocity, temp);

			if (grounded && playerVelocity[1] > 0) {
				grounded = false;
			}
		}
		Maths.vec3.Pool.return(temp);
	}

	// Look for trigger volume - this another example of external force
	let temp = Maths.vec3.Pool.request();
	let temp2 = Maths.vec3.Pool.request();
	for (let i = 0, l = triggerVolumes.length; i < l; i++) {
		triggerVolumes[i].update(elapsed);
		if (triggerVolumes[i].tryIntersectBox(playerBox)) {
			vec3.zero(temp);
			vec3.scaleAndAdd(temp, temp, triggerVolumes[i].launchDirection, triggerVolumes[i].speed);

			// Set velocity in direction of launch and up to 0, keep perpendicular velocity
			vec3.cross(temp2, triggerVolumes[i].launchDirection, Maths.vec3.Y);
			let dot = vec3.dot(temp2, playerVelocity);
			vec3.zero(playerVelocity);
			vec3.scaleAndAdd(playerVelocity, playerVelocity, temp2, dot);
			vec3.add(playerVelocity, playerVelocity, temp); 
			// TODO: Potentially should arrest rather than zero velocity in launch direction in XZ plane

			if (grounded && playerVelocity[1] > 0) {
				grounded = false;
			}
		}
	}
	Maths.vec3.Pool.return(temp);
	Maths.vec3.Pool.return(temp2);

	// Calculate Target Velocity
	if (grounded) {
		vec3.zero(inputVector);
		vec3.scaleAndAdd(inputVector, inputVector, localX, inputX);
		vec3.scaleAndAdd(inputVector, inputVector, localZ, inputZ);

		let vSqr = playerVelocity[0] * playerVelocity[0] + playerVelocity[2] * playerVelocity[2];
		let isSliding = vSqr > movementSpeed * movementSpeed + 0.001; // Fudge factor for double precision when scaling

		if (isSliding) {
			// Only deceleration
			if (Math.sign(playerVelocity[0]) != Math.sign(inputVector[0])) {
				playerVelocity[0] += acceleration * elapsed * inputVector[0];
			}
			if (Math.sign(playerVelocity[2]) != Math.sign(inputVector[2])) {
				playerVelocity[2] += acceleration * elapsed * inputVector[2];
			}
		} else {
			// Accelerate
			playerVelocity[0] += acceleration * elapsed * inputVector[0];
			playerVelocity[2] += acceleration * elapsed * inputVector[2];
		}

		let groundSpeed = Math.sqrt(playerVelocity[0] * playerVelocity[0] + playerVelocity[2] * playerVelocity[2]);
		let anyInput = inputX || inputZ;

		if (groundSpeed > movementSpeed && !isSliding && anyInput) {
			// Clamp to movementSpeed if not isSliding && anyInput down 
			// NOTE: groundSpeed can be greater than movement speed before any slowdown is applied as 
			// scaling by movementSpeed / groundSpeed is has precision issue, adding a threshold for the comparison
			// as with isSliding check can also resolve this without checking anyInput.
			vec3ScaleXZ(playerVelocity, playerVelocity, movementSpeed / groundSpeed);
		} else if (groundSpeed > 0 && (!anyInput || isSliding)) {
			// Apply slow down force
			// This tries to model someone at a run deciding to stop if in the 0 to max movement speed range
			// Greater than this they are considered sliding and a different formula is used.

			// Note: This isn't friction, friction is a constant force for rigidbodies
			// This is friction : https://sciencing.com/calculate-force-friction-6454395.html  (also https://www.geeksforgeeks.org/problems-on-friction-formula/)
			// F = mu * N (where mu is friction coefficient, varies by material, and rest or sliding) and N is the normal force
			// N = mg on flat surfaces (m = mass of object, a = acceleration due to gravity), mg cos A on inclined surfaces (A = angle of incline)  
			// Wood on wood sliding is ~0.2 * mass * 9.8 ~= 4N  so as F = m * dv / elasped
			// dv(friction) = 4 * elapsed / mass;

			let slowFactor = 2.5;	// Compeltely arbitary factor
			if (isSliding) {
				// Velocities larger than 24 m/s at 60fps (for 60 / slowFactor) are negated immediately when speed reduction proportional to v^2
				// So for velocities higher than this speed reduction proportional to v. Rationale is controller is "sliding" rather than coming to a 
				// controlled stop
				slowFactor *= 2 / groundSpeed;
			}
			
			let deltaV = groundSpeed * groundSpeed * slowFactor * elapsed;
			if (deltaV > groundSpeed) { 
				console.log("Warning: Calculated 'friction' greater than speed");
			}
			deltaV = Math.min(groundSpeed, deltaV);

			if(groundSpeed <= stopSpeed) {
				// Stop below a certain speed if not trying to move
				vec3.zero(playerVelocity);
			} else if (groundSpeed != 0) {
				// Apply deceleration
				vec3ScaleXZ(playerVelocity, playerVelocity, (groundSpeed - deltaV) / groundSpeed);
			} else {
				vec3.zero(playerVelocity);
			}
		}
	} else {
		// Apply Drag
		// F(drag) = (1/2)pvvC(drag)A
		// p = density of fluid, v = velocity relative to fluid, C(drag) = drag co-efficient
		// https://www.engineeringtoolbox.com/drag-coefficient-d_627.html person ~= 1.0 - 1.3, cube is 0.8, rectangluar box is ~ 2.1
		// F = m dv/dt => dv = F dt / m
		// Q: Is the force you experience in 'hitting' water, entirely difference in F(drag) or is there surface tension to add?
		// dv = pvvC(d)A * dt / 2m (with A ~= 1 and C(d) ~= 1, p(air) = 1.225 (one atmosphere at 15 degrees C), p(water) = 997)
		// dv = (v*v*1.225*dt)/2m

		// TODO: Also do this in water with much bigger coefficent

		let airSpeed = vec3.length(playerVelocity);
		let dragDv = (airSpeed * airSpeed * 1.225 * elapsed) / (2 * 100);	// Assumes air and mass of 100kg, drag coefficent of ~1 and surface area ~1 (it's probably less)
		// ^^ Technically surface area is different based on direction, so a more accurate model would break down vertical against others

		if (airSpeed < dragDv) {
			// This happens when elasped > 200 / 1.225 * airSpeed * airSpeed 
			// i.e. air speed > sqrt(200 * 60 / 1.225) ~= 99 m/s
			console.log("Warning: Calculated drag higher than air speed!");
			airSpeed = Math.max(0, airSpeed - dragDv);
		}

		// Update Air Velocity
		if (airSpeed !== 0) {
			vec3.scale(playerVelocity, playerVelocity, (airSpeed - dragDv) / airSpeed);
		} else {
			vec3.zero(playerVelocity);
		}		

		// Apply air movement (only deceleration allowed above maximum air movement speed)
		// Convert inputX and inputZ into global X / Z velocity delta
		vec3.zero(inputVector);
		vec3.scaleAndAdd(inputVector, inputVector, localX, inputX);
		vec3.scaleAndAdd(inputVector, inputVector, localZ, inputZ);

		let targetX = playerVelocity[0] + airAcceleration * elapsed * inputVector[0];
		let targetZ = playerVelocity[2] + airAcceleration * elapsed * inputVector[2];

		let canAccelerate = targetX * targetX + targetZ * targetZ < airMovementSpeed * airMovementSpeed;
		if (canAccelerate || Math.abs(targetX) < Math.abs(playerVelocity[0])) {
			playerVelocity[0] = targetX;
		}
		if (canAccelerate || Math.abs(targetZ) < Math.abs(playerVelocity[2])) {
			playerVelocity[2] = targetZ;
		}
	}

	// XZ Move
	characterController.moveXZ(playerContacts, playerVelocity, elapsed, inputVector);

	// Now Gravity / Jumping
	playerVelocity[1] -= gravity * elapsed;

	if (Fury.Input.keyDown("Space", true)) {
		if (grounded || canCoyote && (Fury.GameLoop.time - lastGroundedTime < coyoteTime)) {
			jump();
		} else {
			lastJumpAttemptTime = Fury.GameLoop.time;
		}
	}

	// Y Move - playerContacts[1] = -1 if hit ground
	characterController.moveY(playerContacts, playerVelocity, elapsed)
	if (playerContacts[1] == -1) {
		lastGroundedTime = Fury.GameLoop.time;
		if (!grounded && lastGroundedTime - lastJumpAttemptTime < coyoteTime) {
			jump();
		} else {
			grounded = true;
			canCoyote = true;
		}
	} else {
		if (grounded && playerVelocity[1] < 0) {
			grounded = false;
		}
	}

	// Smoothly move the camera - no jerks from sudden movement please!
	// Technically displacement isn't the issue, it's acceleration
	// Arguably the change due to falling if there is any, we should just do,
	// as that should always be smooth
	vec3.copy(cameraTargetPosition, playerPosition);
	vec3.scaleAndAdd(cameraTargetPosition, cameraTargetPosition, Maths.vec3.Y, 0.5);	// 0.5 offset
	if (vec3.squaredLength(cameraTargetPosition) < 0.1) {
		vec3.copy(camera.position, cameraTargetPosition);
	} else {
		vec3.lerp(camera.position, camera.position, cameraTargetPosition, 0.25);
	}

	scene.render();
};

let jump = () => {
	grounded = false;
	canCoyote = false;
	// Apply Jump Velocity!
	playerVelocity[1] = jumpDeltaV;
};

// Asset Loading
let lockCount = 0;
let loadCallback = () => {
	lockCount--;
	if (lockCount <= 0) {
		Fury.GameLoop.init({ loop: loop,  maxFrameTimeMs: 66 });
		Fury.GameLoop.start();
	}
};

let loadMapTextures = function(namedMaterials, texelsPerUnit) {
	let images = [];
	let keys = Object.keys(namedMaterials);
	for (let i = 0, l = keys.length; i < l; i++) {
		lockCount++;
		let textureName = keys[i];
		images[textureName] = new Image();
		images[textureName].onload = function() {
			namedMaterials[textureName].textures["uSampler"] = Fury.Texture.create({
				source: images[textureName],
				quality: "pixel"
			});
			namedMaterials[textureName].sScale *= texelsPerUnit / images[textureName].width;
			namedMaterials[textureName].tScale *= texelsPerUnit / images[textureName].height;

			loadCallback();
		};
		images[textureName].src = textureName + ".png";
	}
};

lockCount++
fetch("test.map").then(function(response) {
	return response.text();
}).then(function(text) {
	let map = MapLoader.parse(text);

	let instantiateAABB = (aabb, textureName) => {
		if (textureName && !namedMaterials.hasOwnProperty(textureName)) {
			namedMaterials[textureName] = Fury.Material.create({ shader: shader, properties: { tScale: 1, sScale: 1 } });
		}

		createCuboid(
			aabb.xMax - aabb.xMin,
			aabb.yMax - aabb.yMin,
			aabb.zMax - aabb.zMin,
			aabb.xMin + 0.5 * (aabb.xMax - aabb.xMin),
			aabb.yMin + 0.5 * (aabb.yMax - aabb.yMin),
			aabb.zMin + 0.5 * (aabb.zMax - aabb.zMin),
			namedMaterials[textureName]);
	};

	let playerSpawn = MapLoader.instantiate(map, 1/32, instantiateAABB);

	vec3.set(camera.position, playerSpawn.origin[0], playerSpawn.origin[1], playerSpawn.origin[2]);
	quat.fromEuler(camera.rotation, 0, playerSpawn.angle, 0);
	vec3.copy(playerPosition, camera.position);
	vec3.scaleAndAdd(camera.position, camera.position, Maths.vec3.Y, 0.5);	// 0.5 offset for camera

	loadMapTextures(namedMaterials, 32);
	lockCount--;
}).catch(function(error) {
	console.log("Failed to load test.map: " + error.message);
});
