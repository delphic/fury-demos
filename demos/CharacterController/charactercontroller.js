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

var material = Fury.Material.create({ shader : shader });
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
			// Front face
			x-sx, y-sy,
			x+sx, y-sy,
			x+sx, y+sy,
			x-sx, y+sy,

			// Back face
			x-sx, y-sy,
			x-sx, y+sy,
			x+sx, y+sy,
			x+sx, y-sy,

			// Top face
			x-sx, z+sz,
			x-sx, z-sz,
			x+sx, z-sz,
			x+sx, z+sz,

			// Bottom face
			x+sx, z+sz,
			x-sx, z+sz,
			x-sx, z-sz,
			x+sx, z-sz,

			// Right face
			z+sz, y-sy,
			z+sz, y+sy,
			z-sz, y+sy,
			z-sz, y-sy,

			// Left face
			z-sz, y-sy,
			z+sz, y-sy,
			z+sz, y+sy,
			z-sz, y+sy ],
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
let playerBox = Physics.Box.create({ center: playerPosition, size: vec3.fromValues(0.5, 2, 0.5) });

let debugText = createDebugText();

let triggerVolumes = [];

// Used to store collisions, with minimum times and indices
let playerCollisionInfo = {
	collisionsBuffer: [],	// used to store reference to the world boxes which were collided with
	minTime: [],
	minIndex: []
};

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
let gravity = 2 * 9.8;

let initialLaunchXZSpeed = 0;
let launchVelocity = vec3.create();

let velocity = vec3.create();

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

	// TODO: Add smoothing?
	let inputX = 0, inputZ = 0;
	if (Fury.Input.keyDown("w")) {
		inputZ -= 1;
	}
	if (Fury.Input.keyDown("s")) {
		inputZ += 1;
	}
	if (Fury.Input.keyDown("a")) {
		inputX -= 1;
	}
	if (Fury.Input.keyDown("d")) {
		inputX += 1;
	}

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
		// Normalize input vector in moving in more than one direction
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
			//if (s) {
			//	console.log("HIT!: " + Maths.vec3ToString(temp) + " origin: " + Maths.vec3ToString(camera.position) + " direction: " + Maths.vec3ToString(localForward) + " s: " + s);
			//}
		}
		vec3.negate(localForward, localForward); // point it away from facing direction again

		if (hit) {
			// Calculate closest point on box
			closestDistance = Physics.Box.rayCast(temp, hitPoint, localForward, playerBox);

			let velocityDelta = rocketDeltaV / (1 + closestDistance * closestDistance);	// 1 / (1 + dist) so rocketDeltaV is max velocity delta
			vec3.zero(temp);
			vec3.scaleAndAdd(temp, temp, localForward, velocityDelta);
			vec3.add(velocity, velocity, temp);

			vec3.add(launchVelocity, launchVelocity, temp);
			initialLaunchXZSpeed = Math.sqrt(launchVelocity[0] * launchVelocity[0] + launchVelocity[2] * launchVelocity[2]);

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

			vec3.add(launchVelocity, launchVelocity, temp);
			initialLaunchXZSpeed = Math.sqrt(launchVelocity[0] * launchVelocity[0] + launchVelocity[2] * launchVelocity[2]);

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

		// BUG - FEATURE LOSS - really hard to jump small distance whilst moving, this is probably just due to the instant acceleration
			// TODO: Add input smoothing / acceleration curve and then test small jumps

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

	if (grounded && Fury.Input.keyDown("Space", true)) {	// TODO: Grace time (both if you land soon after and soon after you've left the ground)
		grounded = false;
		vec3.zero(launchVelocity);
		// Apply Jump Velocity!
		velocity[1] = jumpDeltaV;

	} else {	// Attempt to move down anyway (basically check for grounded if not grounded || jumping)
		velocity[1] -= gravity * elapsed; // Increased gravity because games
	}

	// So the entered checks allow you to move out of objects you're clipping with
	// the lack here means that if you're overlapping with something you fall through the floor

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

let movePlayer = (targetPosition) => {
	// Move player to new position for physics checks
	vec3.copy(playerPosition, targetPosition);
	// playerBox.center has changed because it's set to the playerPosition ref
	playerBox.calculateMinMax(playerBox.center, playerBox.extents);
};

let checksEnteredAxis = (out, box, axis, collisionIndex, elapsed, enteredPredicate) => {
	// Checks for minimum against out and writes to it
	let delta = playerPosition[axis] - lastPosition[axis];
	if (Math.abs(delta) > 0 && enteredPredicate(box, playerBox, delta)) {
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
	}
};

let checkForPlayerCollisions = (out, elapsed) => {
	let overlapCount = 0;
	
	out.minIndex[0] = out.minIndex[1] = out.minIndex[2] = -1;
	out.minTime[0] = out.minTime[1] = out.minTime[2] = elapsed + 1;

	for (let i = 0, l = world.boxes.length; i < l; i++) {
		if (Physics.Box.intersect(playerBox, world.boxes[i])) {
			out.collisionsBuffer[overlapCount] = world.boxes[i];

			// Calculate collision time and which axis
			// TODO: Update Physics.Box to have an enteredAxis function
			checksEnteredAxis(out, world.boxes[i], 0, overlapCount, elapsed, Physics.Box.enteredX);
			checksEnteredAxis(out, world.boxes[i], 1, overlapCount, elapsed, Physics.Box.enteredY);
			checksEnteredAxis(out, world.boxes[i], 2, overlapCount, elapsed, Physics.Box.enteredZ);

			overlapCount += 1;
			// Could record if you actually collided or were stuck here
		}
	}

	out.overlapCount = overlapCount;

	return overlapCount;
};

let characterMoveXZ = (elapsed) => {
	movePlayer(targetPosition);
	checkForPlayerCollisions(playerCollisionInfo, elapsed);

	let minXTime = playerCollisionInfo.minTime[0];
	let minZTime = playerCollisionInfo.minTime[2];
	let minXIndex = playerCollisionInfo.minIndex[0];
	let minZIndex = playerCollisionInfo.minIndex[2];
	let collisionsBuffer = playerCollisionInfo.collisionsBuffer;

	let maxStepHeight = playerBox.min[1] + stepHeight; 
	let resolvedX = minXIndex == -1, resolvedZ = minZIndex == -1;

	// Note with all of these we're just stopping rather than 
	// moving 'up to' the collision.
	if (!resolvedX && !resolvedZ) {
		// NOTE: Not bothering with step logic if entering both x and z boxes
		// because frankly I can't be bothered with the number of permutations
		if (minXTime < minZTime) {
			// Try resolve X first
			let targetX = targetPosition[0];
			targetPosition[0] = lastPosition[0];
			movePlayer(targetPosition);
			checkForPlayerCollisions(playerCollisionInfo, elapsed);
	
			if (playerCollisionInfo.minIndex[2] != -1) {
				// No sliding along in z direction
				targetPosition[2] = lastPosition[2];
	
				// Try sliding the x instead with no z movement
				targetPosition[0] = targetX;
				movePlayer(targetPosition);
				checkForPlayerCollisions(playerCollisionInfo, elapsed);
				if (playerCollisionInfo.minIndex[0] != -1) {
					// No dice really in a corner
					targetPosition[0] = lastPosition[0];
					movePlayer(targetPosition);
				}
			}
		} else {
			// Try resolve Z first
			let targetZ = targetPosition[2];
			targetPosition[2] = lastPosition[2];
			movePlayer(targetPosition);
			checkForPlayerCollisions(playerCollisionInfo, elapsed);

			if (playerCollisionInfo.minIndex[0] != -1) {
				// No sliding along in x direction
				targetPosition[0] = lastPosition[0];

				// Try sliding along z direction instead
				targetPosition[2] = targetZ;
				movePlayer(targetPosition);
				checkForPlayerCollisions(playerCollisionInfo, elapsed, targetPosition);
				if (playerCollisionInfo.minIndex[2] != -1) {
					// No dice really in a corner
					targetPosition[2] = lastPosition[2];
					movePlayer(targetPosition);
				}
			}
		}
	} else if (!resolvedX) {
		let stepSuccess = false;
		if (collisionsBuffer[minXIndex].max[1] < maxStepHeight) {
			// Try step!
			playerPosition[1] += collisionsBuffer[minXIndex].max[1] - playerBox.min[1];
			movePlayer(playerPosition); // Update bounds
			if (checkForPlayerCollisions(playerCollisionInfo, elapsed) == 0) {
				stepSuccess = true;
				// Only step if it's completely clear to move to the target spot for ease
			} else {
				playerPosition[1] = lastPosition[1];
			}
		}
		
		if (!stepSuccess) {
			targetPosition[0] = lastPosition[0];		
			movePlayer(targetPosition);
			checkForPlayerCollisions(playerCollisionInfo, elapsed);
			if (playerCollisionInfo.minIndex[2] != -1) {
				// Oh no now that we're not moving in x we're hitting something in z
				targetPosition[2] = lastPosition[2];
				movePlayer(targetPosition);
			}
		}
	} else if (!resolvedZ) {
		let stepSuccess = false;
		if (collisionsBuffer[minZIndex].max[1] < maxStepHeight) {
			// Try step!
			playerPosition[1] += collisionsBuffer[minZIndex].max[1] - playerBox.min[1];
			movePlayer(playerPosition); // Update bounds
			if (checkForPlayerCollisions(playerCollisionInfo, elapsed) == 0) {
				stepSuccess = true;
				// Only step if it's completely clear to move to the target spot for ease
			} else {
				playerPosition[1] = lastPosition[1];
			}
		}

		if (!stepSuccess) {
			targetPosition[2] = lastPosition[2];
			movePlayer(targetPosition);
			checkForPlayerCollisions(playerCollisionInfo, elapsed, targetPosition);
			if (playerCollisionInfo.minIndex[0] != -1) {
				// Oh no now that we're not moving in z we're hitting something in x
				targetPosition[0] = lastPosition[0];
				movePlayer(targetPosition);
			}
		}
	}
};

let characterMoveY = (elapsed) => {
	// Now lets do it again for gravity / grounded
	let collision = false;

	vec3.copy(lastPosition, playerPosition);
	
	vec3.scaleAndAdd(playerPosition, playerPosition, Maths.vec3Y, velocity[1] * elapsed);
	// playerBox.center has changed because it's set to the playerPosition ref
	playerBox.calculateMinMax(playerBox.center, playerBox.extents);
	
	for (let i = 0, l = world.boxes.length; i < l; i++) {
		// TODO: Use a box cast instead of a box for high speeds
		if (Physics.Box.intersect(playerBox, world.boxes[i])) {
			collision = true;
			// Only moving on one axis don't need to do the slide checks
			break;
		}
	}

	if (collision) {
		// TODO: Would be nice to move up to the object instead
		// To do this figure out which axes you moved in on - and move out to touch point
		// in order of which would would have entered first - ratio of move to overlap
		// Penetration vector.
		// need list of overlapping colliders though

		vec3.copy(playerPosition, lastPosition);
		if (velocity[1] <= 0) {
			// Only external forces currently set initial launch speed
			// so if we're grounded ensure launch speed is zero (another event could)
			// set it to a non-zero value even if we're grounded

			// TODO: Try putting in the ability to be pushed along the floor by
			// decaying initial launch speed by friction instead of zeroing and
			// add it to normal to normal XZ movement (will need to cache launch direction too)
			initialLaunchXZSpeed = 0;
			vec3.zero(launchVelocity);

			// NOTE: this is called multiple times as we reach the point where we can't move the minimum
			// distance as implied by acceleration by gravity from 0, because we don't move up to the object
			// we just stop.. as stated above we should move *upto* the object.
			grounded = true;
			// ^^ TODO: Need to convert this into isGrounded check, and will need to
			// change dx / dz to be against slopes if/when we introduce them

			// BUG: This isn't always being set to true
		}
		velocity[1] = 0;
	} else if (grounded && velocity[1] < 0) {
		grounded = false;
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

lockCount++;
let image = new Image();
image.onload = function() {
	material.textures["uSampler"] = Fury.Renderer.createTexture(image, "high");
	loadCallback();
};
image.src = "debug.png";

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
