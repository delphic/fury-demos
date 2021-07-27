// Basic First Person Character Controller
// Test bed for AABB physics testing

// globalize glMatrix
Fury.Maths.globalize();

// Init Fury
Fury.init("fury");

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
var shader = Fury.Shader.create({
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
	}
});

var unlitColorShader = Fury.Shader.create({
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
		// TOOD: ^^ A method to call when creating materials from the shader definition
		// to ensure they have any additional properties might be nice
	},
	bindBuffers: function(mesh) {
		this.setAttribute("aVertexPosition", mesh.vertexBuffer);
		this.setIndexedAttribute(mesh.indexBuffer);
	}
});

var redMaterial = Fury.Material.create({ shader: unlitColorShader });
redMaterial.color = vec3.fromValues(1,0,0);

var namedMaterials = [];

// Creates a cuboid origin in centre of specifed width / height / depth
// x, y, z used to offset the UVs
// Texture coordinates 1:1 with world size
var createCuboidMesh = function(width, height, depth, x, y, z) {
	let sx = width / 2, sy = height / 2, sz = depth / 2;
	return {
		vertices: [
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
		textureCoordinates: [
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

// Create Camera & Scene
var camera = Fury.Camera.create({ near: 0.1, far: 1000000.0, fov: Fury.Maths.toRadian(60), ratio: cameraRatio, position: vec3.fromValues(0.0, 1.0, 0.0) });
var scene = Fury.Scene.create({ camera: camera, enableFrustumCulling: true });

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

var createDebugCube = function(size, position) {
	let mesh = Fury.Mesh.create(createCuboidMesh(size[0], size[1], size[2], position[0], position[1], position[2]));
	return scene.add({ material: redMaterial, mesh: mesh, position: position });
}

var createCuboid = function(w, h, d, x, y, z, material) {
	let position = vec3.fromValues(x, y, z);
	let size = vec3.fromValues(w, h, d);
	let mesh = Fury.Mesh.create(createCuboidMesh(w, h, d, x, y, z));
	let box = Physics.Box.create({ center: position, size: size });
	// Note if you move the cuboid you have to recalculate min max

	// Add to scene and physics world
	world.boxes.push(box);
	return scene.add({ material: material, mesh: mesh, position: position, static: true });
};

let createDebugText = function() {
	let p = document.createElement("p");
	document.body.appendChild(p);

	p.style = "position: absolute; top: 0; right: 0; font-size: 32px; font-family: monospace; color: white; padding: 5px; margin: 0;";
	p.textContent = "Test!";

	return p;
};

// Quick and Dirty .map file loader
// Supports only AABB
// c.f. http://www.gamers.org/dEngine/quake/QDP/qmapspec.html
var MapLoader = (function(){
	let exports = {};

	exports.load = (data, shader, namedMaterials) => {
		// Map to JSON would probably be a better way to do this, like token read char by char and just parse the data

		// TODO: Should actually parse worldspawn and then this is just an entity data followed by brushes loop
		let blocks = data.split("{");
		let brushStartOffset = 2; // Assume starting comment with format details then worldspawn class details
		let entityStartOffset = 0;

		let brushData = {};

		let parseBrush = (out, brushLines) => {
			// First entry is blank, then 6 with position data
			let x1, x2, y1, y2, z1, z2;
			let xFound = false, yFound = false, zFound = false;
			let textureName = ""; // No support for different textures on different planes... yet

			for (let j = 1; j < 7; j++) {
				let brushInfo = brushLines[j].split(' ');
				let point1 = [parseInt(brushInfo[1], 10), parseInt(brushInfo[2], 10), parseInt(brushInfo[3], 10)];	// 1-> 3
				let point2 = [parseInt(brushInfo[6], 10), parseInt(brushInfo[7], 10), parseInt(brushInfo[8], 10)];  // 6 -> 8
				let point3 = [parseInt(brushInfo[11], 10), parseInt(brushInfo[12], 10), parseInt(brushInfo[13], 10)]; // 11 -> 13
				// 15 -> 20 contains texture name, x_off, y_off, rot_angle, x_scale, y_scale

				// Convert Points to AABB
				// These points define a plane, the correct way to solve is determine normal and point and then intersect the defined planes to determine
				// vertices, however because we're limiting ourselves to AABB we can take a shortcut, which is one axis will have the same value across
				// all three points, and this is one of that components min or max for the AABB
				if (point1[0] == point2[0] && point2[0] == point3[0]) {
					if (!xFound) {
						x1 = point1[0];
						xFound = true;
					} else {
						x2 = point1[0];
					}
				} else if (point1[1] == point2[1] && point2[1] == point3[1]) {
					if (!yFound) {
						y1 = point1[1];
						yFound = true;
					} else {
						y2 = point1[1];
					}
				} else if (point1[2] == point2[2] && point2[2] == point3[2]) {
					if (!zFound) {
						z1 = point2[2];
						zFound = true;
					} else {
						z2 = point2[2];
					}
				}

				if (!textureName) {
					// TODO: Support multiple textureNames per brush
					// To do this would need to detect when this is multiple textures
					// and then create just quads instead of meshes
					textureName = brushInfo[15];
				}
			}

			let scaleFactor = 1/32;

			// NOTE: Map coordinate system is +Z is up, +y is right, +x is back
			// so need to convert to -x = forwards (+z), +y = right (-x), +z = up (+y)
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
			out.textureName = textureName;
		};

		for(let i = brushStartOffset; i < blocks.length; i++) {
			let brushLines = blocks[i].split('\n');
			// Size will always be 10 until we get to last entry when it'll be 11 (closing "}")

			parseBrush(brushData, brushLines);

			if (brushData.textureName && !namedMaterials.hasOwnProperty(brushData.textureName)) {
				namedMaterials[brushData.textureName] = Fury.Material.create({ shader: shader });
			}

			createCuboid(
				brushData.xMax-brushData.xMin,
				brushData.yMax-brushData.yMin,
				brushData.zMax-brushData.zMin,
				brushData.xMin + 0.5 * (brushData.xMax-brushData.xMin),
				brushData.yMin + 0.5 * (brushData.yMax-brushData.yMin),
				brushData.zMin + 0.5 * (brushData.zMax-brushData.zMin),
				namedMaterials[brushData.textureName]);

			if (brushLines.length == 11) {
				// Has closing "}" - have reached the end of world spawn brushes
				entityStartOffset = i + 1;
				break;
			}
		}

		let origin = [];
		let angle = 0;
		let entities = [];

		for(let i = entityStartOffset; i < blocks.length; i++) {
			let entityData = blocks[i].split('\n');
			if (entityData[1][0] == '"') { // Is entity not brush
				let entity = {};
				for (let j = 1; j < entityData.length; j++) {
					if (entityData[j][0] == '"') { // Is property so parse
						let entityLine = entityData[j].split('"');
						entity[entityLine[1]] = entityLine[3];
					}
				}
				entities.push(entity);

				switch (entity.classname) {
					case "info_player_start":
						angle = parseInt(entity.angle, 10);
						let oc = entity.origin.split(' ');
						let scaleFactor = 1/32;
						// Coord transform - TODO: Move to method
						origin = [ scaleFactor * -parseInt(oc[1], 10), scaleFactor * parseInt(oc[2], 10), scaleFactor * -parseInt(oc[0], 10) ];
						break;
				}
			} else {
				// Brush for previous entity
				let brush = {}
				let lastEntity = entities[entities.length - 1];
				if (!lastEntity.brushes) {
					lastEntity.brushes = [];
				}
				parseBrush(brush, entityData);
				lastEntity.brushes.push(brush);
			}
		}

		for (let i = 0, l = entities.length; i < l; i++) {
			if (entities[i].classname == "trigger_push") {
				// NOTE: Relying on global
				triggerVolumes.push(TriggerVolume.create(entities[i]));
			}
		}

		return {
			origin: origin,
			angle: angle
		};
	};

	return exports;
})();

// Quick and dirty trigger volume!
let TriggerVolume = (function(){
	let exports = {};

	exports.create = (params) => {
		let triggerVolume = {};
		triggerVolume.box = Physics.Box.create({
			min: vec3.fromValues(params.brushes[0].xMin, params.brushes[0].yMin, params.brushes[0].zMin),
			max: vec3.fromValues(params.brushes[0].xMax, params.brushes[0].yMax, params.brushes[0].zMax)
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
		// TODO: Move this to launch_direction for clarity
		let angleC = params.angle.split(' ');
		let angleDirection = vec3.fromValues(parseFloat(angleC[0]), parseFloat(angleC[1]), parseFloat(angleC[2]));
		vec3.normalize(angleDirection, angleDirection);
		triggerVolume.angle = angleDirection;
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

let playerPosition = vec3.clone(camera.position);
let playerBox = Physics.Box.create({ center: playerPosition, size: vec3.fromValues(1, 2, 1) });

let debugText = createDebugText();

let triggerVolumes = [];

// Used to store collisions, with minimum times and indices
let playerCollisionInfo = (() => {
	let collisionsBuffer = []; 	// used to store reference to the world boxes which were collided with
	let minTime = [];
	let minIndex = [];

	let bufferCache = [];
	let timeCache = [];
	let indexCache = [];
	let overlapCache = 0;
	return {
		collisionsBuffer: collisionsBuffer,
		minTime: minTime,
		minIndex: minIndex,
		overlapCount: 0,
		cache: function() {
			overlapCache = this.overlapCount;
			for(let i = 0; i < overlapCache; i++) { // Only stores relevant elements from buffer
				bufferCache[i] = collisionsBuffer[i];
			}
			for (let i = 0; i < 3; i++) {
				timeCache[i] = minTime[i];
				indexCache[i] = minIndex[i]; 
			}
		},
		restore: function() {
			this.overlapCount = overlapCache;
			for (let i = 0; i < overlapCache; i++) {
				collisionsBuffer[i] = bufferCache[i];
			}
			for (let i = 0; i < 3; i++) {
				minTime[i] = timeCache[i];
				minIndex[i] = indexCache[i];
			}
		}
	};
})();


let localX = vec3.create(), localZ = vec3.create();
let lastPosition = vec3.create();
let targetPosition = vec3.create();	// Would be nice to have a pool we could use.
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
let grounded = true, jumpDeltaV = 5, stepHeight = 0.3; // Might be easier to configure jump as desired jump height against gravity rather than deltaV
let lastGroundedTime = 0, coyoteTime = 0.1, canCoyote = true, lastJumpAttemptTime = 0;
// coyoteTime used both as the time after leaving an edge you can still jump and the time beyond hitting the ground you can press the jump button and jump on landing
let gravity = 2 * 9.8;  // Increased gravity because games

let velocity = vec3.create();

let getInputAxis = (plusKey, minusKey, smoothTime, ease) => {
	let  result = 0;
	let now = Date.now();
	if (Fury.Input.keyDown(plusKey)) {
		let pressedTime = now - Fury.Input.keyDownTime(plusKey);
		let r = Maths.clamp01(pressedTime / (smoothTime * 1000));
		if (ease) {
			result += ease(r);
		} else {
			result += r;
		}
	} 
	if (Fury.Input.keyDown(minusKey)) {
		let pressedTime = now - Fury.Input.keyDownTime(minusKey);
		let r = Maths.clamp01(pressedTime / (smoothTime * 1000));
		if (ease) {
			result -= ease(r);
		} else {
			result -= r;
		}
	}
	return result;
};
let inputVector = vec3.create();
let localForward = vec3.create();
let hitPoint = vec3.create();
let temp = vec3.create();
let temp2 = vec3.create(); // TODO: vec3 Pool

// let debugCube = createDebugCube(vec3.fromValues(0.1,0.1,0.1), hitPoint);	// Using hitpoint so it moves to where-ever last hit!

// Mouse look 
let mouseLookSpeed = 0.1;
let verticalLookAngle = 0;

// Game Loop
let lastTime = 0;

let start = function(){
	lastTime = Date.now();
	requestAnimationFrame(loop); 
};

let loop = function(){
	var elapsed = Date.now() - lastTime;
	lastTime += elapsed;

	if (elapsed == 0) {
		console.error("elapsed time of 0, skipping frame");
		requestAnimationFrame(loop);
		return;
	}

	if (elapsed > 66) {
		// Low FPS or huge elapsed from alt-tabs cause
		// physics issues so clamp elapsed for sanity
		elapsed = 66;
		// Could run multiple logic updates, however would
		// have to pause timer and resume when lost focus
	}
	elapsed /= 1000;

	// Rotation around axis
	let ry = 0, rx = 0;

	if (!Fury.Input.isPointerLocked()) {
		if (Fury.Input.mouseDown(0)) {
			Fury.Input.requestPointerLock();
		}
	} else {
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
	Maths.quatRotate(camera.rotation, camera.rotation, ry, Maths.vec3Y);

	let clampAngle = 0.5 * Math.PI - 10 * Math.PI/180;
	let lastVerticalLookAngle = verticalLookAngle;
	verticalLookAngle = Fury.Maths.clamp(verticalLookAngle + rx, -clampAngle, clampAngle);
	quat.rotateX(camera.rotation, camera.rotation, verticalLookAngle - lastVerticalLookAngle);

	let inputX = 0, inputZ = 0;
	inputZ = getInputAxis("s", "w", 0.05, Fury.Maths.Ease.inQuad);
	inputX = getInputAxis("d", "a", 0.05, Fury.Maths.Ease.inQuad);

	// Calculate local axes for camera - ignoring roll
	// This would be easier with a character transform
	// Wouldn't need to zero the y component
	vec3.transformQuat(localX, Maths.vec3X, camera.rotation);
	vec3.transformQuat(localZ, Maths.vec3Z, camera.rotation);
	vec3.copy(localForward, localZ);	// Before 0ing out y component copy to forward
	localX[1] = 0;
	vec3.normalize(localX, localX);	// This should be unnecessary
	localZ[1] = 0;
	vec3.normalize(localZ, localZ);	// This should be unnecessary

	if (inputX !== 0 && inputZ !== 0) {
		// Normalize input vector if moving in more than one direction
		inputX /= Math.SQRT2;
		inputZ /= Math.SQRT2;
	}

	// Placeholder - instead of rocket launcher spawn impulse on mouse down
	if (Fury.Input.mouseDown(0, true)) {
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
			vec3.add(velocity, velocity, temp);

			if (grounded && velocity[1] > 0) {
				grounded = false;
			}
		}
	}

	// Look for trigger volume - this another example of external force
	for (let i = 0, l = triggerVolumes.length; i < l; i++) {
		triggerVolumes[i].update(elapsed);
		if (triggerVolumes[i].tryIntersectBox(playerBox)) {
			vec3.zero(temp);
			vec3.scaleAndAdd(temp, temp, triggerVolumes[i].angle, triggerVolumes[i].speed);

			// Set velocity in direction of angle and up to 0, keep perpendicular velocity
			vec3.cross(temp2, triggerVolumes[i].angle, Maths.vec3Y);
			let dot = vec3.dot(temp2, velocity);
			vec3.zero(velocity);
			vec3.scaleAndAdd(velocity, velocity, temp2, dot);
			vec3.add(velocity, velocity, temp); 
			// TODO: Potentially should arrest rather than zero velocity in launch direction in XZ plane

			if (grounded && velocity[1] > 0) {
				grounded = false;
			}
		}
	}

	// Copy player position into temp variables
	vec3.copy(lastPosition, playerPosition);
	vec3.copy(targetPosition, playerPosition);

	// Calculate Target Position
	if (grounded) {
		vec3.zero(inputVector);
		vec3.scaleAndAdd(inputVector, inputVector, localX, inputX);
		vec3.scaleAndAdd(inputVector, inputVector, localZ, inputZ);

		let vSqr = velocity[0] * velocity[0] + velocity[2] * velocity[2];
		let isSliding = vSqr > movementSpeed * movementSpeed + 0.001; // Fudge factor for double precision when scaling

		if (isSliding) {
			// Only deceleration
			if (Math.sign(velocity[0]) != Math.sign(inputVector[0])) {
				velocity[0] += acceleration * elapsed * inputVector[0];
			}
			if (Math.sign(velocity[2]) != Math.sign(inputVector[2])) {
				velocity[2] += acceleration * elapsed * inputVector[2];
			}
		} else {
			// Accelerate
			velocity[0] += acceleration * elapsed * inputVector[0];
			velocity[2] += acceleration * elapsed * inputVector[2];
		}

		let groundSpeed = Math.sqrt(velocity[0] * velocity[0] + velocity[2] * velocity[2]);
		let anyInput = inputX || inputZ;

		if (groundSpeed > movementSpeed && !isSliding && anyInput) {
			// Clamp to movementSpeed if not isSliding && anyInput down 
			// NOTE: groundSpeed can be greater than movement speed before any slowdown is applied as 
			// scaling by movementSpeed / groundSpeed is has precision issue, adding a threshold for the comparison
			// as with isSliding check can also resolve this without checking anyInput.
			vec3ScaleXZ(velocity, velocity, movementSpeed / groundSpeed);
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
				vec3.zero(velocity);
			} else if (groundSpeed != 0) {
				// Apply deceleration
				vec3ScaleXZ(velocity, velocity, (groundSpeed - deltaV) / groundSpeed);
			} else {
				vec3.zero(velocity);
			}
		}

		vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3X, velocity[0] * elapsed);
		vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3Z, velocity[2] * elapsed);
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

		let airSpeed = vec3.length(velocity);
		let dragDv = (airSpeed * airSpeed * 1.225 * elapsed) / (2 * 100);	// Assumes air and mass of 100kg, drag coefficent of ~1 and surface area ~1 (it's probably less)
		// ^^ Technically surface area is different based on direction, so a more accurate model would break down vertical against others
		// Update Air Velocity
		if (airSpeed !== 0) {
			vec3.scale(velocity, velocity, (airSpeed - dragDv) / airSpeed);
		} else {
			vec3.zero(velocity);
		}
		if (airSpeed < dragDv) {
			// This happens when elasped > 200 / 1.225 * airSpeed * airSpeed 
			// i.e. air speed > sqrt(200 * 60 / 1.225) ~= 99 m/s
			console.log("Warning: Calculated drag higher than air speed!");
		}
		airSpeed = Math.min(0, airSpeed - dragDv);

		// Apply air movement (only deceleration allowed above maximum air movement speed)
		// Convert inputX and inputZ into global X / Z velocity delta
		vec3.zero(inputVector);
		vec3.scaleAndAdd(inputVector, inputVector, localX, inputX);
		vec3.scaleAndAdd(inputVector, inputVector, localZ, inputZ);

		let targetX = velocity[0] + airAcceleration * elapsed * inputVector[0];
		let targetZ = velocity[2] + airAcceleration * elapsed * inputVector[2];

		let canAccelerate = targetX * targetX + targetZ * targetZ < airMovementSpeed * airMovementSpeed;
		if (canAccelerate || Math.abs(targetX) < Math.abs(velocity[0])) {
			velocity[0] = targetX;
		}
		if (canAccelerate || Math.abs(targetZ) < Math.abs(velocity[2])) {
			velocity[2] = targetZ;
		}

		vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3X, velocity[0] * elapsed);
		vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3Z, velocity[2] * elapsed);
	}

	// XZ Move
	characterMoveXZ(elapsed);

	// Cache X-Z movement
	velocity[0] = (playerPosition[0] - lastPosition[0]) / elapsed;
	velocity[2] = (playerPosition[2] - lastPosition[2]) / elapsed;


	velocity[1] -= gravity * elapsed;

	if (Fury.Input.keyDown("Space", true)) {
		if (grounded || canCoyote && (Date.now() - lastGroundedTime < 1000 * coyoteTime)) {
			jump();
		} else {
			lastJumpAttemptTime = Date.now();
		}
	}

	// Y Move
	characterMoveY(elapsed);

	// Smoothly move the camera - no jerks from sudden movement please!
	// Technically displacement isn't the issue, it's acceleration
	// Arguably the change due to falling if there is any, we should just do,
	// as that should always be smooth
	vec3.copy(cameraTargetPosition, playerPosition);
	vec3.scaleAndAdd(cameraTargetPosition, cameraTargetPosition, Maths.vec3Y, 0.5);	// 0.5 offset
	if (vec3.squaredLength(cameraTargetPosition) < 0.1) {
		vec3.copy(camera.position, cameraTargetPosition);	// TODO: an offset from player position please
	} else {
		vec3.lerp(camera.position, camera.position, cameraTargetPosition, 0.25);
	}

	if (debugText) {
		// Show X-Z Velocity
		debugText.textContent = Math.sqrt(velocity[0] * velocity[0] + velocity[2] * velocity[2]).toFixed(2);
	}

	scene.render();

	Fury.Input.handleFrameFinished();
	window.requestAnimationFrame(loop);
};

let jump = () => {
	grounded = false;
	canCoyote = false;
	// Apply Jump Velocity!
	velocity[1] = jumpDeltaV;
};

let movePlayer = (targetPosition) => {
	// Move player to new position for physics checks
	vec3.copy(playerPosition, targetPosition);
	// playerBox.center has changed because it's set to the playerPosition ref
	playerBox.calculateMinMax(playerBox.center, playerBox.extents);
};

let checksEnteredAxis = (out, box, axis, collisionIndex, elapsed) => {
	// Checks for minimum against out and writes to it
	let delta = playerPosition[axis] - lastPosition[axis];
	if (Math.abs(delta) > 0 && Physics.Box.enteredAxis(box, playerBox, axis, delta)) {
		let distance = 0;
		if (delta > 0) {
			// player max crossed box min
			distance = delta - (playerBox.max[axis] - box.min[axis]);
		} else {
			// player min crossed box max
			distance = -delta - (box.max[axis] - playerBox.min[axis]);
		}
		let time = distance / Math.abs(delta / elapsed);	
		if (time < out.minTime[axis]) {
			out.minTime[axis] = time;
			out.minIndex[axis] = collisionIndex;
		}
		return true;
	}
	return false;
};

let checksEntersAxis = (out, box, axis, collisionBufferIndex, elapsed) => {
	let delta = targetPosition[axis] - playerPosition[axis];
	if (Math.abs(delta) > 0 && Physics.Box.entersAxis(box, playerBox, axis, delta)) {
		checkMinTime(out, box, axis, collisionBufferIndex, elapsed, delta);
		return true;
	}
	return false;
};

let checkMinTime = (out, box, axis, collisionBufferIndex, elapsed, delta) => {
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

let checkForPlayerCollisions = (out, elapsed) => {
	let overlapCount = 0;
	let collisionCount = 0;
	
	out.minIndex[0] = out.minIndex[1] = out.minIndex[2] = -1;
	out.minTime[0] = out.minTime[1] = out.minTime[2] = elapsed + 1;

	for (let i = 0, l = world.boxes.length; i < l; i++) {
		let box = world.boxes[i];

		let deltaX = targetPosition[0] - playerPosition[0];
		let deltaY = targetPosition[1] - playerPosition[1];
		let deltaZ = targetPosition[2] - playerPosition[2];
		let intersectsX = Physics.Box.intersectsAxisOffset(box, playerBox, 0, deltaX);
		let entersX = deltaX && Physics.Box.entersAxis(box, playerBox, 0, deltaX);
		let intersectsY = Physics.Box.intersectsAxisOffset(box, playerBox, 1, deltaY);
		let entersY = deltaY && Physics.Box.entersAxis(box, playerBox, 1, targetPosition[1] - playerPosition[1]);
		let intersectsZ = Physics.Box.intersectsAxisOffset(box, playerBox, 2, deltaZ);
		let entersZ = deltaZ && Physics.Box.entersAxis(box, playerBox, 2, targetPosition[2] - playerPosition[2]);

		if ((intersectsX || entersX) && (intersectsY || entersY) && (intersectsZ || entersZ)) {
			if (entersX) checkMinTime(out, box, 0, overlapCount, elapsed, deltaX);
			if (entersY) checkMinTime(out, box, 1, overlapCount, elapsed, deltaY);
			if (entersZ) checkMinTime(out, box, 2, overlapCount, elapsed, deltaZ);

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

// Like checks for player collisions but uses enters rather than entered 
// i.e. checks target position against boxes rather than current position
// also only checks Y axis (assumes no movement in x or z)
let checkForPlayerCollisionsY = (out, elapsed) => {
	let collisionCount = 0;
	let overlapCount = 0;
	
	out.minIndex[0] = out.minIndex[1] = out.minIndex[2] = -1;
	out.minTime[0] = out.minTime[1] = out.minTime[2] = elapsed + 1;

	// Note enters axis does not do a box cast, merely checks current against new
	// i.e. you can move through boxes at high enough speed - TODO: box cast 
	for (let i = 0, l = world.boxes.length; i < l; i++) {
		if (Physics.Box.intersectsAxis(world.boxes[i], playerBox, 0) && Physics.Box.intersectsAxis(world.boxes[i], playerBox, 2)) {
			if (checksEntersAxis(out, world.boxes[i], 1, overlapCount, elapsed)) {
				out.collisionsBuffer[overlapCount] = world.boxes[i];			
				collisionCount += 1;
				overlapCount += 1;
			} else if (Physics.Box.intersectsAxis(world.boxes[i], playerBox, 1)) {
				out.collisionsBuffer[overlapCount] = world.boxes[i];
				overlapCount += 1;
			}
		}
	}

	out.overlapCount = overlapCount;

	return collisionCount;
};

let getTouchPointTarget = (closestBox, axis, delta, stepAttempt) => {
	if (delta <= 0) {
		// new target position max + extents
		return closestBox.max[axis] + playerBox.extents[axis];
	} else {
		// new target position min - extents
		return closestBox.min[axis] - playerBox.extents[axis];
	}
};

let characterMoveXZ = (elapsed) => {
	checkForPlayerCollisions(playerCollisionInfo, elapsed);

	// Local variables to arrays for less typing
	let collisionsBuffer = playerCollisionInfo.collisionsBuffer;
	let minTime = playerCollisionInfo.minTime;
	let minIndex = playerCollisionInfo.minIndex;

	let maxStepHeight = playerBox.min[1] + stepHeight; 
	let resolvedX = minIndex[0] == -1, resolvedZ = minIndex[2] == -1;

	if (!resolvedX && !resolvedZ) {
		// NOTE: Not bothering with step logic if entering both x and z boxes
		// because frankly I can't be bothered with the number of permutations

		let fca = minTime[0] < minTime[2] ? 0 : 2; // First Collision Axis
		let sca = minTime[0] < minTime[2] ? 2 : 0; // Second Collision Axis
 
		// Try moving along fca first
		let targetPosCache = targetPosition[fca];
		targetPosition[fca] = getTouchPointTarget(collisionsBuffer[minIndex[fca]], fca, targetPosition[fca] - lastPosition[fca]);
		
		checkForPlayerCollisions(playerCollisionInfo, elapsed);
		
		if (minIndex[sca] != -1) {
			// No sliding along in second collision axis
			targetPosition[sca] = getTouchPointTarget(collisionsBuffer[minIndex[sca]], sca, targetPosition[sca] - lastPosition[sca]);

			// Try sliding the first collisation axis instead (with minimal movement in second collision axis)
			targetPosition[fca] = targetPosCache;
			checkForPlayerCollisions(playerCollisionInfo, elapsed);
			if (minIndex[fca] != -1) {
				// No dice really in a corner
				targetPosition[fca] = getTouchPointTarget(collisionsBuffer[minIndex[fca]], fca, targetPosition[fca] - lastPosition[fca]);
			}
		}
	} else if (!resolvedX || !resolvedZ) {
		let fca = resolvedZ ? 0 : 2; // First Collision Axis
		let sca = resolvedZ ? 2 : 0; // Second Collision Axis (though there's no collision initially)

		let stepSuccess = false;
		if (collisionsBuffer[minIndex[fca]].max[1] < maxStepHeight) {
			// Try step!
			let targetY = targetPosition[1];
			targetPosition[1] = playerPosition[1] + collisionsBuffer[minIndex[fca]].max[1] - playerBox.min[1];
			playerCollisionInfo.cache();
			if (checkForPlayerCollisions(playerCollisionInfo, elapsed) == 0) {
				stepSuccess = true;
				// Only step if it's completely clear to move to the target spot for ease
			} else {
				targetPosition[1] = targetY;
				playerCollisionInfo.restore();
			}
		}
		
		if (!stepSuccess) {
			targetPosition[fca] = getTouchPointTarget(collisionsBuffer[minIndex[fca]], fca, targetPosition[fca] - lastPosition[fca]);
			checkForPlayerCollisions(playerCollisionInfo, elapsed);
			
			if (minIndex[sca] != -1) {
				// Oh no now that we're not moving in fca we're hitting something in sca
				targetPosition[sca] = getTouchPointTarget(collisionsBuffer[minIndex[sca]], sca, targetPosition[sca] - lastPosition[sca]);
			}
		}
	} 
	// Finally move the player to the approved target position
	movePlayer(targetPosition);
};

let characterMoveY = (elapsed) => {
	// Now lets do it again for gravity / grounded
	vec3.copy(lastPosition, playerPosition);

	vec3.scaleAndAdd(targetPosition, playerPosition, Maths.vec3Y, velocity[1] * elapsed);
	
	let collision = checkForPlayerCollisionsY(playerCollisionInfo, elapsed) > 0;

	if (collision) {
		let closestBox = playerCollisionInfo.collisionsBuffer[playerCollisionInfo.minIndex[1]];
		if (velocity[1] <= 0) {
			// Moving down, move playerPosition so player is extents above closestBox.max[1]
			playerPosition[1] = closestBox.max[1] + playerBox.extents[1];

			lastGroundedTime = Date.now();
			if (!grounded && lastGroundedTime - lastJumpAttemptTime < 1000 * coyoteTime) {
				jump();
			} else {
				grounded = true;
				canCoyote = true;
			}
		} else {
			// Moving up, move playerPosition so player is extents below  closestBox.min[1]
			playerPosition[1] = closestBox.min[1] - playerBox.extents[1];
		}
		velocity[1] = 0;
	} else {
		vec3.copy(playerPosition, targetPosition);
		if (grounded && velocity[1] < 0) {
			grounded = false;
		}
	}
};

// Asset Loading
let lockCount = 0;
let loadCallback = () => {
	lockCount--;
	if (lockCount <= 0) {
		start();
	}
};

let loadMapTextures = function() {
	let images = [];
	let keys = Object.keys(namedMaterials);
	for (let i = 0, l = keys.length; i < l; i++) {
		lockCount++;
		let textureName = keys[i];
		images[textureName] = new Image();
		images[textureName].onload = function() {
			namedMaterials[textureName].textures["uSampler"] = Fury.Renderer.createTexture(images[textureName], "pixel", false, true);
			// Scale should be 32 texels per unit
			namedMaterials[textureName].sScale = 32 / images[textureName].width;
			namedMaterials[textureName].tScale = 32 / images[textureName].height;

			loadCallback();
		};
		images[textureName].src = textureName + ".png";
	}
};

lockCount++
fetch("test.map").then(function(response) {
	return response.text();
}).then(function(text) {
	let playerSpawn = MapLoader.load(text, shader, namedMaterials);

	vec3.set(camera.position, playerSpawn.origin[0], playerSpawn.origin[1], playerSpawn.origin[2]);
	quat.fromEuler(camera.rotation, 0, playerSpawn.angle, 0);	// Q: Should we rotate the player too?
	vec3.copy(playerPosition, camera.position);
	vec3.scaleAndAdd(camera.position, camera.position, Maths.vec3Y, 0.5);	// 0.5 offset fpr camera

	loadMapTextures();
	lockCount--;
}).catch(function(error) {
	console.log("Failed to load test.map: " + error.message);
});
