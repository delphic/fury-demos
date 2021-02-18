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
			"}"].join('\n'),
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

// Quick and Dirty .map file loader
// Supports only AABB
// c.f. http://www.gamers.org/dEngine/quake/QDP/qmapspec.html
var MapLoader = (function(){
	let exports = {};

	exports.load = (data, shader, namedMaterials) => {
		// Map to JSON would probably be a better way to do this, like token read char by char and just parse the data
		let blocks = data.split("{");
		let brushStartOffset = 2; // Assume starting comment with format details then worldspawn class details
		let numberOfEntities = 1;	// Assume single entity of info_player_start
		for(let i = 2; i <  blocks.length - numberOfEntities; i++) {
			let brushStr = blocks[i].split('\n');
			// Size will always be 10 until we get to last entry when it'll be 11 (closing "}")
			// First entry is blank, then 6 with position data
			let x1, x2, y1, y2, z1, z2;
			let xFound = false, yFound = false, zFound = false;
			let textureName = ""; // No support for different textures on different planes... yet

			for (let j = 1; j < 7; j++) {
				let brushInfo = brushStr[j].split(' ');
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
					textureName = brushInfo[15];
					if (!namedMaterials.hasOwnProperty(textureName))
					{
						namedMaterials[textureName] = Fury.Material.create({ shader: shader });
					}
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

			createCuboid(
				xMax-xMin,
				yMax-yMin,
				zMax-zMin,
				xMin + 0.5 * (xMax-xMin),
				yMin + 0.5 * (yMax-yMin),
				zMin + 0.5 * (zMax-zMin),
				namedMaterials[textureName]);
		}

		let entityData = blocks[blocks.length - 1].split('\n');
		// 0 = empty, 1 = "classname" "info_player_start", 2 = "origin" "0 0 0", 3 = "angle" "180", 4 = "}"
		// TODO: Assert that entityData[1].split('"') ... [1] == classname and [3] == "info_player_start" aka support more than one entity in the map
		// TODO: Assert that entityData[2].split('"')[1] == "origin"
		let angle = parseInt(entityData[3].split('"')[3], 10);
		let originComponents = entityData[2].split('"')[3].split(' ');
		let scaleFactor = 1/32;

		return {
			origin: [ scaleFactor * -parseInt(originComponents[1], 10), scaleFactor * parseInt(originComponents[2], 10), scaleFactor * -parseInt(originComponents[0], 10) ],	// again with the coord transform
			angle: angle
		};
	};

	return exports;
})();

let playerPosition = vec3.clone(camera.position);
let playerSphere = Physics.Sphere.create({ center: playerPosition, radius: 1.0 });
let playerBox = Physics.Box.create({ center: playerPosition, size: vec3.fromValues(0.5, 2, 0.5) });

let localX = vec3.create(), localZ = vec3.create();
let lastPosition = vec3.create();
let targetPosition = vec3.create();	// Would be nice to have a pool we could use.
let cameraTargetPosition = vec3.create();

let movementSpeed = 5;
let airMovementFactor = 0.5;
let lookSpeed = 1;
let prevInputX = 0, prevInputZ = 0;
// TODO: Add key down (key up) time tracking to Fury for more complex input logic
// (and framerate independent smoothing) but you have to tell it to track the keys
// rather than it just tracking everything?

// TODO: dv implementation is not frame rate independent, should probably make it so
let rocketDeltaV = 30;
let grounded = true, jumpDeltaV = 5, stepHeight = 0.3;
let airVelocity = vec3.create();
let inputVector = vec3.create();
let localForward = vec3.create();
let hitPoint = vec3.create();
let temp = vec3.create();

let debugCube = createDebugCube(vec3.fromValues(0.1,0.1,0.1), hitPoint);	// Using hitpoint so it moves to where-ever last hit!

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

	let roll = Fury.Maths.getRoll(camera.rotation); // Note doesn't lock in the right place if you're using atan2 version
	let clampAngle = 10 * Math.PI/180;
	if (Math.sign(roll) == Math.sign(-rx) || Math.abs(roll - rx) < 0.5*Math.PI - clampAngle) {
		quat.rotateX(camera.rotation, camera.rotation, rx);
	}

		// TODO: Add smoothing / acceleration
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
	// Smoothing (TODO: frame rate independent please, also Maths.lerp ?)
	//inputX = lerp(prevInputX, inputX, 0.5);
	//inputZ = lerp(prevInputZ, inputZ, 0.5);
	// Annnnd Cache
	//prevInputX = inputX;
	//prevInputZ = inputZ;
	// BUG: ^^ Adding this naive smoothing caused you a jump with no movement after a jump *with* movement
	// to cause you to jump in the direction you were moving for that previous jump

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
			// Note this is fine because cast is from CoM but if cast is from somewhere else
			// would need to recaculate this distance to hit point
			let velocityDelta = rocketDeltaV / (1 + closestDistance * closestDistance);	// 1 / (1 + dist) so rocketDeltaV is max velocity delta
			airVelocity[0] += localForward[0] * velocityDelta;
			airVelocity[1] += localForward[1] * velocityDelta;
			airVelocity[2] += localForward[2] * velocityDelta;

			// Note because we're putting launch force directly into air velocioty
			// we can very quickly negate it using air movement, this makes physical sense of course
			// and might actually match Q3A movement, but doesn't give the impression of being flung

			// TODO: Lets try "velocity from external forces" as a separate tracked vector, then play with how
			// it decays, perhaps by the same % as drag on total velocity or perhaps just run drag on it independently
			// with air velocity being velocityDueToExternalForces + movementInput (would allow us to not have to cache the y velocity separately)
			// will be interesting to know if we can put gravity in that vector or not.
			if (grounded && airVelocity[1] > 0) {
				grounded = false;
			}
		}
	}

	// Copy player position into temp variables
	vec3.copy(lastPosition, playerPosition);
	vec3.copy(targetPosition, playerPosition);

	// Calculate Target Position
	if (grounded) {
		vec3.scaleAndAdd(targetPosition, targetPosition, localZ, movementSpeed * elapsed * inputZ);
		vec3.scaleAndAdd(targetPosition, targetPosition, localX, movementSpeed * elapsed * inputX);
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

		let airSpeed = vec3.length(airVelocity);
		let dragDv = (airSpeed * airSpeed * 1.225 * elapsed) / (2 * 100);	// Assumes air and mass of 100kg, crag coefficent of ~1 and surface area ~1 (it's probably less)
		// ^^ Technically surface area is different based on direction, so maybe should break down vertical against others
		// Update Air Velocity
		if (airSpeed !== 0) {
			vec3.scale(airVelocity, airVelocity, (airSpeed - dragDv) / airSpeed);
		} else {
			vec3.zero(airVelocity);
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

		let airSpeedY = airVelocity[1];
		airVelocity[1] = 0;
		let maxAirSpeed = Math.max(vec3.length(airVelocity), movementSpeed * airMovementFactor);

		// Add velocity and make sure it's less than the maximum of current velocity and airMovementSpeed
		airVelocity[0] = airVelocity[0] + movementSpeed * airMovementFactor * inputVector[0];
		airVelocity[2] = airVelocity[2] + movementSpeed * airMovementFactor * inputVector[2];
		// This takes away from any launch velocity per frame permanently negating it, arguably we should
		// store velocity due to launch and recalculate airVelocity from that (presumably velocity due to launch)
		// will need to decay somehow and be cancelled by collisions

		if (vec3.length(airVelocity) > maxAirSpeed) {
			vec3.normalize(airVelocity, airVelocity);
			vec3.scale(airVelocity, airVelocity, maxAirSpeed);
		}
		airVelocity[1] = airSpeedY;

		vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3X, airVelocity[0] * elapsed);
		vec3.scaleAndAdd(targetPosition, targetPosition, Maths.vec3Z, airVelocity[2] * elapsed);
		// Note air velocity is set to moved distance later (post collision checks)
	}

	// TODO: Separate this next section into modules as per Vorld-decay
	// just keep them in the same file so we don't need to use browserify in demos

	// Move player to new position for physics checks
	vec3.copy(playerPosition, targetPosition);

	let collision = false, useBox = true;

	// This is basically character controller move
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


	// Now lets do it again for gravity / grounded
	collision = false;
	if (grounded && Fury.Input.keyDown("Space", true)) {	// TODO: Grace time (both if you land soon after and soon after you've left the ground)
		grounded = false;
		airVelocity[1] = jumpDeltaV;
		// Cache X-Z movement as airspeed
		airVelocity[0] = (playerPosition[0] - lastPosition[0]) / elapsed;
		airVelocity[2] = (playerPosition[2] - lastPosition[2]) / elapsed;
	} else {	// Attempt to move down anyway (basically check for grounded if not grounded || jumping)
		airVelocity[1] -= 9.8 * elapsed; // Increased gravity because games
		// Cache X-Z movement as airspeed
		airVelocity[0] = (playerPosition[0] - lastPosition[0]) / elapsed;
		airVelocity[2] = (playerPosition[2] - lastPosition[2]) / elapsed;
		// ^^ We're running this when not jumping, which basically just makes it 'last velocity'
		// but this is good cause it means if we run off a crate we'll take the velocity with us
		// as well as if we jump off it.
	}

	// So the entered checks allow you to move out of objects you're clipping with
	// the lack here means that if you're overlapping with something you fall through the floor

	// Another Character Controller Move
	vec3.copy(lastPosition, playerPosition);
	vec3.scaleAndAdd(playerPosition, playerPosition, Maths.vec3Y, airVelocity[1] * elapsed);
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
		if (!grounded && airVelocity[1] < 0) {
			// NOTE: this is called multiple times as we reach the point where we can't move the minimum
			// distance as implied by acceleration by gravity from 0, because we don't move up to the object
			// we just stop.. as stated above we should move *upto* the object.
			grounded = true;
			// ^^ TODO: Need to convert this into isGrounded check, and will need to
			// change dx / dz to be against slopes if/when we introduce them
		}
		airVelocity[1] = 0;
	} else if (grounded && airVelocity[1] < 0) {
		grounded = false;
	}

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

	scene.render();

	Fury.Input.handleFrameFinished();
	window.requestAnimationFrame(loop);
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
