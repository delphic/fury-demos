// This is to test context loss and restoration
// This is broadly a dupilicate of Arbitrary Shader with additional logic for triggering
// context loss and then restoration followed by reinitialisation of state

// Shader Source
let vsSource = `#version 300 es
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

in vec3 aVertexPosition;
in vec2 aTextureCoordinates;

out vec2 vTextureCoordinates;
out vec2 vPos;

void main() { 
	vTextureCoordinates = aTextureCoordinates;
	vPos = vec2(aVertexPosition.x, aVertexPosition.y);
	gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
}`;

let fsSource = `#version 300 es
precision highp float;

in vec2 vTextureCoordinates;
in vec2 vPos;

uniform float uTime;
uniform vec2 uMousePos;
uniform int uMouseDown;
uniform sampler2D uTexture;

out vec4 fragColor;

void main() {
	float v1 = (sin(vTextureCoordinates.s + uTime) + 1.0) / 2.0;
	float v2 = (cos(vTextureCoordinates.t + uTime) + 1.0) / 2.0;
	float d = distance(uMousePos, vPos);
	vec2 tt = vec2(vTextureCoordinates.s + sin(uTime / 10.0), vTextureCoordinates.t + cos(uTime / 10.0));
	vec4 c1 = texture(uTexture, tt) * 1.1;
	float avg = (c1.r + c1.g + c1.b) / 3.0;
	float r = c1.r + v1 * pow(avg, 4.0) - pow(d, pow(avg, 2.0) + float(uMouseDown) * avg);
	float g = c1.g + v2 * pow(avg, 4.0) - pow(d, pow(avg, 2.0) + float(uMouseDown) * avg);
	float b = c1.g - pow(d,pow(avg, 2.0) + float(uMouseDown) * avg);
	fragColor = vec4(r, g, b, 1.0);
}`;

const r = Fury.Renderer;
const mat4 = Fury.Maths.mat4;
const Camera = Fury.Camera;

// Init
Fury.init('fury');
let canvas = document.getElementById('fury');

// Create Buffers
let quadBuffer = r.createBuffer([
	1.0,	1.0,	0.0,
	-1.0,	1.0,	0.0,
	1.0,	-1.0,	0.0,
	-1.0,	-1.0,	0.0
], 3);
let textureBuffer = r.createBuffer([
	1.0,	1.0,
	0.0,	1.0,
	1.0,	0.0,
	0.0,	0.0
], 2);

// Setup Shader
let vs = r.createShader("vertex", vsSource);
let fs = r.createShader("fragment", fsSource);
let shaderProgram = r.createShaderProgram(vs, fs);

r.initAttribute(shaderProgram, "aVertexPosition");
r.initAttribute(shaderProgram, "aTextureCoordinates");
r.initUniform(shaderProgram, "uModelViewMatrix"); // mat4
r.initUniform(shaderProgram, "uProjectionMatrix"); //mat4
r.initUniform(shaderProgram, "uTime"); // float
r.initUniform(shaderProgram, "uMousePos"); // vec2
r.initUniform(shaderProgram, "uMouseDown"); // bool

r.useShaderProgram(shaderProgram);

// Camera
let camera = Camera.create({
	type: "Orthonormal",
	near: 0.1,
	far: 100.0,
	height: 2.0
});

let projectionMatrix = mat4.create(), modelViewMatrix = mat4.create();
camera.getProjectionMatrix(projectionMatrix);
mat4.identity(modelViewMatrix);
mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -2.0]);

// Shader Events!
canvas.addEventListener("mousemove", function(event) {
	event.preventDefault();
	// transforming cursor coordinates to [-1.0, 1.0] range
	// [0,0] being in the left bottom corner to match the vertex coordinates
	let x = (event.pageX / 512) * 2.0 - 1.0;
	let y = 0.0 - ((event.pageY / 512) * 2.0 - 1.0);
	r.setUniformFloat2("uMousePos", x, y);
});

canvas.addEventListener("mousedown", function(event) {
	event.preventDefault();
	if (event.button == 0) {
		r.setUniformBoolean("uMouseDown", true);
	}
});
canvas.addEventListener("mouseup", function(event) {
	event.preventDefault();
	if (event.button == 0) {
		r.setUniformBoolean("uMouseDown", false);
	}
});

// Loop
let time = Date.now(), runningTime = 0, delta = 0;

// Bind Shader properties that do no change
r.enableAttribute("aVertexPosition");
r.enableAttribute("aTextureCoordinates");
r.setAttribute("aVertexPosition", quadBuffer);
r.setAttribute("aTextureCoordinates", textureBuffer);
r.setUniformMatrix4("uModelViewMatrix", modelViewMatrix);
r.setUniformMatrix4("uProjectionMatrix", projectionMatrix);

let loop = function(){
	delta = Date.now() - time;
	time += delta;
	runningTime += delta;
	r.setUniformFloat("uTime", runningTime/1000);
	r.clear();
	r.drawTriangleStrip(quadBuffer.numItems);
	window.requestAnimationFrame(loop);
};

// Create Texture
let texture, image = new Image();
image.onload = function() {
	texture = r.createTexture(image);
	r.setTexture(0, texture);
	loop();
	// window.setTimeout(testContextLoss, 1000); 
};
image.src = "concrete1.jpg";

// https://www.khronos.org/webgl/wiki/HandlingContextLost

// Handling context loss requires holding onto the configuration objects for materials / meshes / shaders,
// will require making one for textures 

// Despite assigning uniform locations to shaderPrograms and numItems / size to buffer objects 
// (against the advice of https://webglfundamentals.org/webgl/lessons/webgl-anti-patterns.html)
// as these need to be recreated anyway, and it seems the program can carry on fine as the objects 
// do not seem to be set to null. The only possible issue is that the extension might not doesn't
// accurately simulate context loss (and objects would be null if context was lost via a real mechanism)

// Once we handle context lost properly when we can try using powerPreference context creation parameter set to high-performance: 
// https://www.khronos.org/registry/webgl/specs/latest/1.0/#5.2.1
// We should also look at the other properties here... might want desynchronised true for example 
// and could as it suggests try fail is major performance cavet and then lower the settings levels

let ext = Fury.Renderer.getContextLossExtension(); // Note calling this again after loseContext returns null so you have to cache it
let testContextLoss = function() {
	ext.loseContext(); 
	// should trigger 'webglcontextlost' event on canvas element https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event

	// NOTE: in FF you can call loseContext and then immediately call restoreContext and it works (although not if you break point on the restore call)
	// However for chrome you need to intercept webglcontextlost event, prevent default and then once it's completed 
	// *then* you can call restoreContext and it work - this also works in FF so that's what we're doing
};

document.getElementById("test_button").addEventListener('click', testContextLoss)

let displayToggle = false;
canvas.addEventListener('webglcontextlost', function(e) {
	/* intercept the loss event and prevent default - https://www.khronos.org/registry/webgl/extensions/WEBGL_lose_context/ */ 
	e.preventDefault();
	console.log("webglcontextlost event received");
	// Allow event to complete
	window.setTimeout(() => { 
		ext.restoreContext();
		// should trigger 'webglcontextrestored' event event https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextrestored_event
	}, 1); // Is there a less hacky way to do this?
});

canvas.addEventListener('webglcontextrestored', function(e) {
	console.log("weblcontextrestored event received");

	// Note this could all be simplified with repeatable init functions 
	// but it is written out explicitly for clarity
	Fury.init("fury");
	// ^^ Reinit fury in order to re-acquire the extensions it uses on the next context (e.g. asio filtering)

	// Recreate shader and shader program
	vs = r.createShader("vertex", vsSource);
	fs = r.createShader("fragment", fsSource);
	shaderProgram = r.createShaderProgram(vs, fs);

	// Re-determine attribute and uniform locations
	r.initAttribute(shaderProgram, "aVertexPosition");
	r.initAttribute(shaderProgram, "aTextureCoordinates");
	r.initUniform(shaderProgram, "uModelViewMatrix"); // mat4
	r.initUniform(shaderProgram, "uProjectionMatrix"); //mat4
	r.initUniform(shaderProgram, "uTime"); // float
	r.initUniform(shaderProgram, "uMousePos"); // vec2
	r.initUniform(shaderProgram, "uMouseDown"); // bool

	// inform renderer to use shader program
	r.useShaderProgram(shaderProgram);

	// Recreate and rebind buffers & matrices
	quadBuffer = r.createBuffer([
		1.0,	1.0,	0.0,
		-1.0,	1.0,	0.0,
		1.0,	-1.0,	0.0,
		-1.0,	-1.0,	0.0
	], 3);
	textureBuffer = r.createBuffer([
		1.0,	1.0,
		0.0,	1.0,
		1.0,	0.0,
		0.0,	0.0
	], 2);

	r.setAttribute("aVertexPosition", quadBuffer);
	r.setAttribute("aTextureCoordinates", textureBuffer);
	r.setUniformMatrix4("uModelViewMatrix", modelViewMatrix);
	r.setUniformMatrix4("uProjectionMatrix", projectionMatrix);
	
	// re-enable the attributes
	r.enableAttribute("aVertexPosition");
	r.enableAttribute("aTextureCoordinates");

	// Recreate the texture and set
	texture = r.createTexture(image);
	r.setTexture(0, texture);
});

