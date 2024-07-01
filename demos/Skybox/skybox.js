// Skybox demo
// Uses cubemap texture created from 6 canvas elements
// projected onto a quad at the far clip plane. 

let camera, scene;
let skybox;
let canvases = [];
let material;
let cubeCanvas;
let cubeMaterial;

let vsShader = `#version 300 es
in vec4 aPosition;
out vec4 vPosition;

void main() {
	vPosition = aPosition;
	gl_Position = aPosition;
	gl_Position.z = 1.0;
}`;
let fsShader = `#version 300 es
precision highp float;

uniform samplerCube uSkybox;
uniform mat4 uViewInverse;

in vec4 vPosition;

out vec4 outColor;

void main() {
	vec4 t = uViewInverse * vPosition;
	outColor = texture(uSkybox, normalize(t.xyz / t.w));
}`;

window.onload = (event) => { 
	Fury.Maths.globalize();
	Fury.init({ canvasId: "fury" });

	Fury.Renderer.setDepthFunction("LEQUAL");

	camera = Fury.Camera.create({ near: 0.1, far: 1000000.0, fov: 1.0472, ratio: 4/3, position: vec3.fromValues(0.0, 0.0, 6.0) });
	scene = Fury.Scene.create({ camera: camera });

	let shader = Fury.Shader.create({
		vsSource: vsShader,
		fsSource: fsShader,
		attributeNames: [ "aPosition" ],
		uniformNames: [ "uSkybox", "uViewInverse" ],
		textureUniformNames: [ "uSkybox" ],
		bindMaterial: function(material) {
			this.enableAttribute("aPosition");
		},
		bindBuffers: function(mesh) {
			this.setAttribute("aPosition", mesh.vertexBuffer);
			this.setIndexedAttribute(mesh.indexBuffer);
		},
		bindInstance: function(object) {
			this.setUniformMatrix4("uViewInverse", object.viewInverseMatrix)
		}
	});

	let debug = false;
	let neg_x = createSkyboxFace("skyblue", "seagreen", "-X", debug);
	let pos_x = createSkyboxFace("skyblue", "seagreen", "+X", debug);
	let neg_y = createSkyboxFace("seagreen", "seagreen", "-Y", debug);
	let pos_y = createSkyboxFace("skyblue", "skyblue", "+Y", debug); 
	let neg_z = createSkyboxFace("skyblue", "seagreen", "-Z", debug);
	let pos_z = createSkyboxFace("skyblue", "seagreen", "+Z", debug);
	// we could in fact reuse the same canvas, if did the texture upload as part of the createFace
	// but this wouldn't work with our Renderer.createTextureCube

	cubeCanvas = createSkyboxFace("red", "red", "", false);
	let cubeTexture = Fury.Renderer.createTexture(cubeCanvas, true, true);
	let cubeMesh = Fury.Mesh.create(Fury.Primitives.createCubeMeshConfig(1.0, 1.0, 1.0));
	cubeMaterial = Fury.Material.create({ shader: Fury.Shaders.UnlitTextured, texture: cubeTexture });
	scene.add({ mesh: cubeMesh, material: cubeMaterial });

	canvases = [
		neg_x, pos_x, neg_y, pos_y, neg_z, pos_z
	];

	let texture = Fury.Renderer.createTextureCube(canvases);
	let quadConfig = Fury.Primitives.createCenteredQuadMeshConfig(2, 2);
	let mesh = Fury.Mesh.create(quadConfig);
	material = Fury.Material.create({ shader: shader, texture: texture });
	skybox = scene.add({ mesh: mesh, material: material, static: true }); // todo: ideally we'd force render this last
	skybox.viewInverseMatrix = mat4.create();
	Fury.GameLoop.init({ loop: loop });
	Fury.GameLoop.start();
};


/**
 * Create a canvas image for skybox cubemap 
 * @param {string | CanvasGradient | CanvasPattern} topStyle 
 * @param {string | CanvasGradient | CanvasPattern} bottomStyle 
 * @param {string} text 
 * @param {bool} display 
 * @return {CanvasElement}
 */
let createSkyboxFace = function(topStyle, bottomStyle, text, display) {
	let canvas = document.createElement("canvas");
	if (!display) {
		canvas.style = "display: none";
	}
	canvas.width = 1024;
	canvas.height = 1024;

	drawSkyboxFace(canvas, topStyle, bottomStyle, text);
	
	if (display) {
		document.body.appendChild(canvas);
	}

	return canvas;
};

/**
 * Draw skybox image on provided canvas
 * @param {HTMLCanvasElement} canvas 
 * @param {string | CanvasGradient | CanvasPattern} topStyle 
 * @param {string | CanvasGradient | CanvasPattern} bottomStyle 
 * @param {string} text 
 */
let drawSkyboxFace = function(canvas, topStyle, bottomStyle, text) {
	let s = canvas.width;
	let ctx = canvas.getContext("2d");
	ctx.fillStyle = topStyle;
	ctx.fillRect(0, 0, s, s/2);
	ctx.fillStyle = bottomStyle;
	ctx.fillRect(0,s/2, s, s/2);
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.font = s/4 + "px Serif";
	ctx.fillStyle = "black";
	ctx.strokeStyle = "white";
	ctx.fillText(text, s/2, s/2);
	ctx.strokeText(text, s/2, s/2);
}

let verticalLookAngle = 0;
let colorIndex = 0;
let colors = [ "skyblue", "midnightblue" ];
let cubeColors = [ "red", "black" ];

let loop = function(elapsed) {
	if (Fury.Input.keyDown("Space", true)) {
		colorIndex = (colorIndex + 1) %  colors.length;
		let ground = "seagreen";
		let sky = colors[colorIndex];
		let text = ["-X", "+X", "-Y", "+Y", "-Z", "+Z"];
		for (let i = 0, l = canvases.length; i < l; i++) {
			let topStyle = i == 2 ? ground : sky;
			let bottomStyle = i == 3 ? sky : ground;
			drawSkyboxFace(canvases[i], topStyle, bottomStyle, text[i]);
			// Drawing this many canvases causes a notable hitch, which suggests that
			// this approach is only good for static skyboxes, and you'd want to put
			// logic in the shader for anything dynamic 
			// Although I'm assuming it's the drawSkyboxFace that's the problem, not the recreation of the texture
			// we should profile, and see if you update the existing texture rather than creating a new one it
			// performs better.
		}
		material.textures["uSkybox"] = Fury.Renderer.createTextureCube(canvases);

		drawSkyboxFace(cubeCanvas, cubeColors[colorIndex], cubeColors[(colorIndex + 1)%cubeColors.length], "");
		cubeMaterial.textures["uSampler"] = Fury.Renderer.createTexture(cubeCanvas, true, true);
	}

	moveCamera(elapsed);
	rotateCamera(elapsed);

	let projectionMatrix = mat4.create();
	camera.getProjectionMatrix(projectionMatrix);
	
	let out = mat4.create();
	let fwd = [0,0,-1];
	vec3.transformQuat(fwd, fwd, camera.rotation);
	mat4.targetTo(
		out,
		Fury.Maths.vec3Zero,
		fwd,
		Fury.Maths.vec3Y);

	// Why do textures seem backwards horizontally, is this a property of cubemaps?
	// Are you just seeing the texture 'from the inside'? The axes seem correct.

	mat4.invert(out, out);
	// remove translation if it had any
	out[12] = 0;
	out[13] = 0;
	out[14] = 0;
	mat4.mul(out, projectionMatrix, out);
	mat4.invert(skybox.viewInverseMatrix, out);

	scene.render();
};

let moveCamera = function(elapsed) {
	let inputX = 0, inputZ = 0;

	inputZ = Fury.Input.getAxis("s", "w"); // 0.05, Fury.Maths.Ease.inQuad
	inputX = Fury.Input.getAxis("d", "a"); // 0.05, Fury.Maths.Ease.inQuad

	let localX = [0,0,0], localZ = [0,0,0];
	vec3.transformQuat(localX, Fury.Maths.vec3X, camera.rotation);
	vec3.transformQuat(localZ, Fury.Maths.vec3Z, camera.rotation);
	localX[1] = 0;
	vec3.normalize(localX, localX);	// This should be unnecessary
	localZ[1] = 0;
	vec3.normalize(localZ, localZ);	// This should be unnecessary

	if (inputX !== 0 && inputZ !== 0) {
		// Normalize input vector if moving in more than one direction
		inputX /= Math.SQRT2;
		inputZ /= Math.SQRT2;
	}

	let speed = 5.0;
	vec3.scaleAndAdd(camera.position, camera.position, localX, elapsed * speed * inputX);
	vec3.scaleAndAdd(camera.position, camera.position, localZ, elapsed * speed * inputZ);
};

let rotateCamera = function(elapsed) {
	// Rotation around axis
	let ry = 0, rx = 0;
	let mouseLookSpeed = 1.0;
	let lookSpeed = 1.0;

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
	Fury.Maths.quatRotate(camera.rotation, camera.rotation, ry, Fury.Maths.vec3Y);

	let clampAngle = 0.5 * Math.PI - 10 * Math.PI/180;
	let lastVerticalLookAngle = verticalLookAngle;
	verticalLookAngle = Fury.Maths.clamp(verticalLookAngle + rx, -clampAngle, clampAngle);
	quat.rotateX(camera.rotation, camera.rotation, verticalLookAngle - lastVerticalLookAngle);
}