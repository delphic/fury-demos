// This is to test context loss and restoration
// This is a dupilicate of Arbitrary Shader with additional logic for triggering
// context loss and then restoration followed by reinitialisation of state

// Shader Source
var vsSource = [ "attribute vec3 aVertexPosition;",
	"attribute vec2 aTextureCoordinates;",
	"uniform mat4 modelViewMatrix;",
	"uniform mat4 projectionMatrix;",
	"varying vec2 vTextureCoordinates;",
	"varying vec2 pos;",
	"void main() { ",
		"vTextureCoordinates = aTextureCoordinates;",
		"gl_Position = projectionMatrix * modelViewMatrix * vec4(aVertexPosition, 1.0);",
		"pos = vec2(aVertexPosition.x, aVertexPosition.y);",
	"}"].join("\n");
var fsSource = [ "#ifdef GL_ES",
	"precision highp float;",
	"#endif",
	"varying vec2 vTextureCoordinates;",
	"varying vec2 pos;",
	"uniform float time;",
	"uniform vec2 mouse;",
	"uniform int mouseLeft;",
	"uniform sampler2D tex0;",
	"void main() {",
		"float v1 = (sin(vTextureCoordinates.s+time) + 1.0) / 2.0;",
		"float v2 = (cos(vTextureCoordinates.t+time) + 1.0) / 2.0;",
		"float d = distance(mouse, pos);",
		"vec2 tt = vec2(vTextureCoordinates.s+sin(time/10.0), vTextureCoordinates.t+cos(time/10.0));",
		"vec4 c1 = texture2D(tex0, tt) * 1.1;",
		"float avg = (c1.r+c1.g+c1.b)/3.0;",
		"float r = c1.r+v1*pow(avg,4.0) - pow(d,pow(avg,2.0) +float(mouseLeft)*avg);",
		"float g = c1.g+v2*pow(avg,4.0) - pow(d,pow(avg,2.0) +float(mouseLeft)*avg);",
		"float b = c1.g - pow(d,pow(avg,2.0) +float(mouseLeft)*avg);",
		"gl_FragColor = vec4(r, g, b, 1.0);",
	"}" ].join("\n");

// Init
Fury.init('fury');
var r = Fury.Renderer;
var mat4 = Fury.Maths.mat4;

// Create Buffers
var quadBuffer = r.createBuffer([
		1.0,	1.0,	0.0,
		-1.0,	1.0,	0.0,
		1.0,	-1.0,	0.0,
		-1.0,	-1.0,	0.0
	], 3);
var textureBuffer = r.createBuffer([
		1.0,	1.0,
		0.0,	1.0,
		1.0,	0.0,
		0.0,	0.0
	], 2);

// Setup Shader
var vs = r.createShader("vertex", vsSource);
var fs = r.createShader("fragment", fsSource);
var shaderProgram = r.createShaderProgram(vs, fs);

r.initAttribute(shaderProgram, "aVertexPosition");
r.initAttribute(shaderProgram, "aTextureCoordinates");
r.initUniform(shaderProgram, "modelViewMatrix"); // mat4
r.initUniform(shaderProgram, "projectionMatrix"); //mat4
r.initUniform(shaderProgram, "time"); // float
r.initUniform(shaderProgram, "mouse"); // vec2
r.initUniform(shaderProgram, "mouseLeft"); // bool

r.useShaderProgram(shaderProgram);

// Camera
var camera = Fury.Camera.create({
	type: "Orthonormal",
	near: 0.1,
	far: 100.0,
	height: 2.0
});

var projectionMatrix = mat4.create(), modelViewMatrix = mat4.create();
camera.getProjectionMatrix(projectionMatrix);
mat4.identity(modelViewMatrix);
mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -2.0]);

// Events!
$(document).keydown(function(event) {
	event.preventDefault();
	var key = event.which;
});

$(document).mousemove(function(event) {
	event.preventDefault();
	// transforming cursor coordinates to [-1.0, 1.0] range
	// [0,0] being in the left bottom corner to match the vertex coordinates
	var x = (event.pageX / 512)*2.0 - 1.0;
	var y = 0.0 - ((event.pageY / 512)*2.0 - 1.0);
	r.setUniformFloat2("mouse", x, y);
});

$(document).mousedown(function(event) {
	event.preventDefault();
	var key = event.which;
	if (key == 1) {
		r.setUniformBoolean("mouseLeft", true);
	}
});

$(document).mouseup(function(event) {
	event.preventDefault();
	var key = event.which;
	if (key == 1) {
		r.setUniformBoolean("mouseLeft", false);
	}
});

$(document).mouseleave(function(event) {
	event.preventDefault();
	r.setUniformFloat2("mouse", 0, 0);
});

// Loop
var time = Date.now(), runningTime = 0, delta = 0;

// Bind Shader properties that do no change
r.enableAttribute("aVertexPosition");
r.enableAttribute("aTextureCoordinates");
r.setAttribute("aVertexPosition", quadBuffer);
r.setAttribute("aTextureCoordinates", textureBuffer);
r.setUniformMatrix4("modelViewMatrix", modelViewMatrix);
r.setUniformMatrix4("projectionMatrix", projectionMatrix);


var loop = function(){
	delta = Date.now() - time;
	time += delta;
	runningTime += delta;
	r.setUniformFloat("time", runningTime/1000);
	r.clear();
	r.drawTriangleStrip(quadBuffer.numItems);
	window.requestAnimationFrame(loop);
};

// Create Texture
// This is a bit syntaxically messy
var texture, image = new Image();
image.onload = function() {
	texture = r.createTexture(image, "high");
	r.setTexture(0, texture); 	// Note don't actually need to set tex0 uniform to 0, unlike in WebGL playground demo code
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
var testContextLoss = function() {
	ext.loseContext(); 
	// should trigger 'webglcontextlost' event on canvas element https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event

	// NOTE: in FF you can call loseContext and then immediately call restoreContext and it works (although not if you break point on the restore call)
	// However for chrome you need to intercept webglcontextlost event, prevent default and then once it's completed 
	// *then* you can call restoreContext and it work - this also works in FF so that's what we're doing
};

document.getElementById("test_button").addEventListener('click', testContextLoss)

let canvas = document.getElementById("fury");
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
	r.initUniform(shaderProgram, "modelViewMatrix"); // mat4
	r.initUniform(shaderProgram, "projectionMatrix"); //mat4
	r.initUniform(shaderProgram, "time"); // float
	r.initUniform(shaderProgram, "mouse"); // vec2
	r.initUniform(shaderProgram, "mouseLeft"); // bool

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
	r.setUniformMatrix4("modelViewMatrix", modelViewMatrix);
	r.setUniformMatrix4("projectionMatrix", projectionMatrix);

	// re-eanble the attributes
	r.enableAttribute("aVertexPosition");
	r.enableAttribute("aTextureCoordinates");

	// Recreate the texture and set
	texture = r.createTexture(image, "high");
	r.setTexture(0, texture);
	
	// In chrome - the canvas remains blank until you mouseover / mouse off the trigger button
	// (seems like another element has to changes state, the button state changing on click release
	// sometimes seems to trigger the reset if the delay to  restore is low but if it is longer
	// you have to move the mouse out of the button) 

	// However it seems you can also cause it to display again without this by changing the display style
	let canvas = document.getElementById("fury");
	if (!displayToggle) {
		canvas.style = "display: inline-block;";
		// Note setting it to inline initially does not work (i.e. what it already was) 
		// if you wanted to set it back to inline would have to use setTimeout and wait (a ms seems sufficient though)
		// for this test we just alternate
	} else {
		canvas.style = "display: inline;"; // Toggle with swap that it changes back and forth with repeated tests
	}
	displayToggle = !displayToggle;
	// this implies you need to dirty the screen state somehow - which happens pretty easily if there are other elements
	// but if the canvas is the only element on the screen it doesn't happen other than changing tab and back again
});

