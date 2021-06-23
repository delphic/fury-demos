// Basic First Person Character Controller
// Test bed for AABB physics testing

// globalize glMatrix
Fury.Maths.globalize();

// Extend Maths
// See https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
Fury.Maths.calculateRoll = function(q) {
	// x-axis rotation
	let w = q[3], x = q[0], y = q[1], z = q[2];
	return Math.atan2(2 * (w*x + y*z), 1 - 2 * (x*x + y*y));
};

Fury.Maths.calculatePitch = function(q) {
	// y-axis rotation
	let w = q[3], x = q[0], y = q[1], z = q[2];
	let sinp = 2 * (w*y - z*x);
	return Math.asin(sinp);
	// returns pi/2 -> - pi/2 range only
	// which is not helpful at all.
};

Fury.Maths.calculateYaw = function(q) {
	// z-axis rotation
	let w = q[3], x = q[0], y = q[1], z = q[2];
	return Math.atan2(2 * (w*z + x*y), 1 - 2 * (y*y + z*z));
};

Fury.Maths.getRoll = function(q) {
	// Used to avoid gimbal lock
	let sinr_cosp = 2 * (q[3] * q[0] + q[1] * q[2]);
	let cosr_cosp = 1 - 2 * (q[0] * q[0] + q[1] * q[1]);
	return Math.atan(sinr_cosp / cosr_cosp);
	// If you want to know sector you need atan2(sinr_cosp, cosr_cosp)
	// but we don't in this case.
};

// TODO: Move to Fury.Maths
let lerp = (a,b,r) => { return r * (b - a) + a; };

let clamp = (x, min, max) => { return Math.max(Math.min(max, x), min); }

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

// Physics
let world = { boxes: [], spheres: [] };
// As these currently aren't polymorphic separate colldiers by type
// However with sensible prototype methods -> insterectType(other, self)
// we could use a single array

let Maths = Fury.Maths;
let Physics = Fury.Physics;

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
let playerSphere = Physics.Sphere.create({ center: playerPosition, radius: 1.0 });
let playerBox = Physics.Box.create({ center: playerPosition, size: vec3.fromValues(0.5, 2, 0.5) });

let debugText = createDebugText();

let triggerVolumes = [];

let localX = vec3.create(), localZ = vec3.create();
let lastPosition = vec3.create();
let targetPosition = vec3.create();	// Would be nice to have a pool we could use.
let cameraTargetPosition = vec3.create();

let acceleration = 100;
let movementSpeed = 8;
let stopSpeed = 2;
let airMovementSpeed = 8;
let airAcceleration = 10;

let lookSpeed = 1;
let prevInputX = 0, prevInputZ = 0;
// TODO: Add key down (key up) time tracking to Fury for more complex input logic
// (and framerate independent smoothing) but you have to tell it to track the keys
// rather than it just tracking everything?

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

// let debugCube = createDebugCube(vec3.fromValues(0.1,0.1,0.1), hitPoint);	// Using hitpoint so it moves to where-ever last hit!

// Mouse look / pointer lock
let mouseLookSpeed = 0.1;
let pointerLocked = false;
let mdx = 0, mdy = 0; // Store accumulating deltas
let handleMouseMove = function(event) {
	mdx += event.movementX;
	mdy += event.movementY;
};
let canvas = document.getElementById("fury");
canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
// ^^ TODO: Query Fury for canvs or move pointer lock requets to Fury.Input
// Requires use of fury game loop though to make input work, need to consume events end of frame
canvas.addEventListener("mousemove", handleMouseMove);
document.addEventListener('pointerlockchange', (event) => {
	pointerLocked = !!(document.pointerLockElement || document.mozPointerLockElement);
});

let lostFocus;
let lastTime = 0;

var loop = function(){
	if (lastTime == 0 || lostFocus) {
		// Better for first frame to have an elapsed time of 0 than Date.now eh?
		lastTime = Date.now();
		// If focus was lost we don't want to perform a huge update, set to 0.
		lostFocus = false;
	}
	var elapsed = Date.now() - lastTime;
	lastTime += elapsed;

	if (elapsed > 66) {
		// Low FPS or huge elapsed from alt-tabs cause
		// physics issues so clamp elapsed for sanity
		// Ideally we'd note when we paused but need to find the correct events for that
		elapsed = 66;
	}
	elapsed /= 1000;

	// Need to pause the timer when you blur to that this doesn't end up huge and you clip through the floor
	// :thinking: I wonder what happens to websockets when you alt tab.
	if (elapsed == 0) {
		// HACK: Stop FUBAR due to 0 elapsed in movement calculations
		requestAnimationFrame(loop);
		return;
	}

	let ry = 0, rx = 0;

	if (!pointerLocked) {
		if (Fury.Input.mouseDown(0)) {
			canvas.requestPointerLock();
		}
	} else {
		// Add the movement to rotations and clear the cache of movement delta
		ry -= mouseLookSpeed * elapsed * mdx;
		rx -= mouseLookSpeed * elapsed * mdy;
		mdx = 0;
		mdy = 0;
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

	// TODO: Check this against vorld-decay
	let roll = Fury.Maths.getRoll(camera.rotation); // Note doesn't lock in the right place if you're using atan2 version
	let clampAngle = 10 * Math.PI/180;
	if (Math.sign(roll) == Math.sign(-rx) || Math.abs(roll - rx) < 0.5*Math.PI - clampAngle) {
		quat.rotateX(camera.rotation, camera.rotation, rx);
	}

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
			launchVelocity[0] += localForward[0] * velocityDelta;
			launchVelocity[2] += localForward[2] * velocityDelta;
			launchVelocity[1] += localForward[1] * velocityDelta;

			initialLaunchXZSpeed = Math.sqrt(launchVelocity[0] * launchVelocity[0] + launchVelocity[2] * launchVelocity[2]);

			vec3.add(velocity, velocity, launchVelocity);

			if (grounded && velocity[1] > 0) {
				grounded = false;
			}
		}
	}

	// Look for trigger volume - this another example of external force
	for (let i = 0, l = triggerVolumes.length; i < l; i++) {
		triggerVolumes[i].update(elapsed);
		if (triggerVolumes[i].tryIntersectBox(playerBox)) {

			launchVelocity[0] += triggerVolumes[i].angle[0] * triggerVolumes[i].speed;
			launchVelocity[1] += triggerVolumes[i].angle[1] * triggerVolumes[i].speed;
			launchVelocity[2] += triggerVolumes[i].angle[2] * triggerVolumes[i].speed;

			initialLaunchXZSpeed = Math.sqrt(launchVelocity[0] * launchVelocity[0] + launchVelocity[2] * launchVelocity[2]);

			vec3.add(velocity, velocity, launchVelocity);
			// TODO: I wonder if set is better if grounded, only retain velocity if in the air
			// Probably - also lets change this to velocity due to external forces then put air velocity back in
			// and have grounded launch movement work to that (i.e. you can arrest velocity due to your own movement)

			if (grounded && velocity[1] > 0) {
				grounded = false;
			}
		}
	}

	// Playing Q3A - it seems like we had the right idea before, modify air velocity directly and then allow the player to
	// cumulatively add speed, the difference is q3a did not clamp the speed addtion at all, so you could only modify a small
	// amount but it could add up to far more

	// Copy player position into temp variables
	vec3.copy(lastPosition, playerPosition);
	vec3.copy(targetPosition, playerPosition);

	// Calculate Target Position
	if (grounded) {
		vec3.zero(inputVector);
		vec3.scaleAndAdd(inputVector, inputVector, localX, inputX);
		vec3.scaleAndAdd(inputVector, inputVector, localZ, inputZ);

		// Accelerate
		velocity[0] += acceleration * elapsed * inputVector[0];
		velocity[2] += acceleration * elapsed * inputVector[2];

		// Apply Friction
		let groundSpeed = Math.sqrt(velocity[0] * velocity[0] + velocity[2] * velocity[2]);
		let frictionFactor = 2.5;	// Compeltely arbitary factor
		let frictionDv = groundSpeed * groundSpeed * frictionFactor * elapsed;

		if (frictionDv > groundSpeed) console.error("Calculated Drag greater than speed");
		frictionDv = Math.min(groundSpeed, frictionDv);

		let ySpeed = velocity[1];
		velocity[1] = 0;
		if (groundSpeed > movementSpeed) {
			// Clamp to movementSpeed
			vec3.scale(velocity, velocity, movementSpeed / groundSpeed);
		} else if (!inputX && !inputZ) {
			// Not sure if this is a good idea or not
			// (only applying friction when not moving,
			// if applying whilst moving makes it hard to have enough friction to stop quickly, without impacting top speed,
			// arguably could / should have a deceleration amount)
			if( groundSpeed <= stopSpeed) {
				// Stop below a certain speed if not trying to move
				vec3.zero(velocity);
			} else if (groundSpeed != 0) {
				// Apply Friction
				vec3.scale(velocity, velocity, (groundSpeed - frictionDv) / groundSpeed);
			} else {
				vec3.zero(velocity);
			}
		}
		velocity[1] = ySpeed;

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
		// BUG / lack of feature: you can't be pushed back from a wall if you shoot above the camera point (i.e. being pushed down)

		// TODO: Also do this in water with much bigger coefficent

		let airSpeed = vec3.length(velocity);
		let dragDv = (airSpeed * airSpeed * 1.225 * elapsed) / (2 * 100);	// Assumes air and mass of 100kg, drag coefficent of ~1 and surface area ~1 (it's probably less)
		// ^^ Technically surface area is different based on direction, so maybe should break down vertical against others
		// Update Air Velocity
		if (airSpeed !== 0) {
			vec3.scale(velocity, velocity, (airSpeed - dragDv) / airSpeed);
		} else {
			vec3.zero(velocity);
		}
		if (airSpeed < dragDv) {
			// NOT sure if this is possible now but it clearly was when I had a bug in my code! (wasn't multiplying by dt)
			console.error("Drag higher than air speed!");
		}
		airSpeed = airSpeed - dragDv;

		// Convert inputX and inputZ into global X / Z velocity delta
		vec3.zero(inputVector);
		vec3.scaleAndAdd(inputVector, inputVector, localX, inputX);
		vec3.scaleAndAdd(inputVector, inputVector, localZ, inputZ);

		// If we wanted to keep forces external and not arrestable by air movement
		// this where we would transfer it to a new variable and sure that in the remainder
		// of this caculation

		// Add air movement velocity to current movement velocity
		// but clamped to a circle around launchVelocity of radius airMovementSpeed
		// (maxAirMovementSpeed is actually max air speed of component due to input)
		let airMinX = launchVelocity[0] - airMovementSpeed;
		let airMaxX = launchVelocity[0] + airMovementSpeed;
		velocity[0] = clamp(velocity[0] + airAcceleration * elapsed * inputVector[0], airMinX, airMaxX);
		let airMinZ = launchVelocity[2] - airMovementSpeed;
		let airMaxZ = launchVelocity[2] + airMovementSpeed;
		velocity[2] = clamp(velocity[2] + airAcceleration * elapsed * inputVector[2], airMinZ, airMaxZ);
		// ^^ This overrides drag... which isn't good... maybe min max should adjust
		// or we should apply drag to launchVelocity too

		// q3a testing - it feels like some jump pads have no clamping at all and allow free movement
		// whereas some are almost launch rails and you're stuck at whatever your initial velocity is until you land

		vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3X, velocity[0] * elapsed);
		vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3Z, velocity[2] * elapsed);
		// Note air velocity is set to moved distance later (post collision checks)
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

let characterMoveXZ = (elapsed) => {
	let collision = false, useBox = true;

	// Move player to new position for physics checks
	vec3.copy(playerPosition, targetPosition);

	if (useBox) {
		// playerBox.center has changed because it's set to the playerPosition ref
		playerBox.calculateMinMax(playerBox.center, playerBox.extents);
	}

	// We used to have the collision handling outside the loop, but has we need to continue
	// the loops I moved it inside, a world collision method which returned a list of boxes
	// that overlapped would be acceptable.
	// TODO: look at vorld-decay's voxel collision code, it doesn't get stuck on adjacent voxels
	// like this code can with adjancent boxes.
	let stepCount = 0, stepX = false, stepZ = false;
	for (let i = 0, l = world.boxes.length; i < l; i++) {
		if (useBox) {
			if (Physics.Box.intersect(playerBox, world.boxes[i])) {
				collision = true;

				// Check each axis individually and only stop movement on those which changed from
				// not overlapping to overlapping. In theory we should calculate distance and move
				// up to it for high speeds, however we'd probably want a skin depth, for the speeds
				// we're travelling, just stop is probably fine
				// BUG: You can get stuck on corners of flush surfaces when sliding along them
				// Should be resolvable if we find all colliding boxes first then respond with full information
				if (Physics.Box.enteredX(world.boxes[i], playerBox, playerPosition[0] - lastPosition[0])) {
					let separation = world.boxes[i].max[1] - playerBox.min[1];
					if (stepCount == 0 && !stepX && separation <= stepHeight) {
						// Step!
						stepCount = 1;
						stepX = true;
						playerPosition[1] += separation;
					} else {
						playerPosition[0] = lastPosition[0];
						if (stepX) {
							// If have stepping in this direction already cancel
							playerPosition[1] = lastPosition[1];
						}
					}
				}
				if (Physics.Box.enteredZ(world.boxes[i], playerBox, playerPosition[2] - lastPosition[2])) {
					let separation = world.boxes[i].max[1] - playerBox.min[1];
					if (stepCount == 0 && separation <= stepHeight) {
						// Step!
						stepCount = 1;
						stepZ = true;
						playerPosition[1] += separation;
					} else {
						playerPosition[2] = lastPosition[2];
						if (stepZ) {
							// If have stepped in this direction already cancel
							playerPosition[1] = lastPosition[1];
						}
					}
				}
				// Whilst we're only moving on x-z atm but if we change to fly camera we'll need this
				if (Physics.Box.enteredY(world.boxes[i], playerBox, playerPosition[1] - lastPosition[1])) {
					playerPosition[1] = lastPosition[1];
					// TODO: If stepped should reset those too?
				}

				// Note this only works AABB, for OOBB and other colliders we'd probably need to get
				// impact normal and then convert the movement to be perpendicular, and if there's multiple
				// collider collisions... ?

				// Update target position and box bounds for future checks
				vec3.copy(targetPosition, playerPosition);
				playerBox.calculateMinMax(playerBox.center, playerBox.extents);

				// TODO: if we've changed target y position because of steps we should technically re-evaluate all boxes on y axis
				// If collider and they are above us we should remove the step and cancel the x/z movement as appropriate

				// Have to check other boxes cause still moving, so no break - technically we could track which
				// axes we'd collided on and not check those in future if we wanted to try to optimize.
				// Also could break if all axes we moved in had returned true
				// Could also only check axes we were actually moving in
			}
		} else if (Physics.Box.intersectSphere(playerSphere, world.boxes[i])) {
			collision = true;
			vec3.copy(playerPosition, lastPosition);

			// Does it even make sense to step with a sphere collider?

			// Check Axis by Axis
			let didOverlap, nowOverlap;
			didOverlap = Physics.Box.intersectSphere(playerSphere, world.boxes[i]);

			camera.position[0] = targetPosition[0];
			nowOverlap = Physics.Box.intersectSphere(playerSphere, world.boxes[i]);
			if (!didOverlap && nowOverlap) {
				// Stop movement in axis
				playerPosition[0] = lastPosition[0];
			}

			camera.position[1] = targetPosition[1];
			// Don't have to reset other axis points because we're testing axis by axis
			nowOverlap = Physics.Box.intersectSphere(playerSphere, world.boxes[i]);
			if (!didOverlap && nowOverlap) {
				// Stop movement in axis
				playerPosition[1] = lastPosition[1];
			}

			camera.position[2] = targetPosition[2];
			nowOverlap = Physics.Box.intersectSphere(playerSphere, world.boxes[i]);
			if (!didOverlap && nowOverlap) {
				// Stop movement in axis
				playerPosition[2] = lastPosition[2];
			}

			// Update target position for future checks
			vec3.copy(targetPosition, playerPosition);

			// Have to check other boxes cause still moving, so no break - technically we could track which
			// axes we'd collided on and not check those in future if we wanted to try to optimize.
			// Also could break if all axes we moved in had returned true & could also
			// only check the axises we're moving in
		}
	}
	// Also need to support steps and slopes
};

let characterMoveY = (elapsed) => {
	// Now lets do it again for gravity / grounded
	let collision = false, useBox = true;

	vec3.copy(lastPosition, playerPosition);
	vec3.scaleAndAdd(playerPosition, playerPosition, Maths.vec3Y, velocity[1] * elapsed);

	if (useBox) {
		// playerBox.center has changed because it's set to the playerPosition ref
		playerBox.calculateMinMax(playerBox.center, playerBox.extents);
	}

	for (let i = 0, l = world.boxes.length; i < l; i++) {
		if (useBox) {
			// TODO: Use a box cast instead of a box for high speeds
			if (Physics.Box.intersect(playerBox, world.boxes[i])) {
				collision = true;
				// Only moving on one axis don't need to do the slide checks
				break;
			}
		} else if (Physics.Box.intersectSphere(playerSphere, world.boxes[i])) {
			collision = true;
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

// Create Texture
let lockCount = 0;
let loadCallback = () => {
	lockCount--;
	if (lockCount <= 0) {
		loop();
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
			// Low quality, lets see the pixely glory
			namedMaterials[textureName].textures["uSampler"] = Fury.Renderer.createTexture(images[textureName], "low");
			// Scale should be 32 texels per unit
			namedMaterials[textureName].sScale = 32 / images[textureName].width;
			namedMaterials[textureName].tScale = 32 / images[textureName].height;

			// TODO: texture alignment isn't quite right as UVs don't map to world position
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
