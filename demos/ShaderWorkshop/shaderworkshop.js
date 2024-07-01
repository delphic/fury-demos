// https://ace.c9.io/#nav=howto
let editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.getSession().setMode("ace/mode/glsl");

// globalize glMatrix
Fury.Maths.globalize();

// Init
Fury.init('fury');
const r = Fury.Renderer;
const Camera = Fury.Camera;

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
let fsSource = editor.getValue();

editor.getSession().on("change", function(e){
	fsSource = editor.getValue();
	setupShaderProgram();
});


// Setup Shader Code
let bindShaderProperties = function(){
	// Bind Shader properties that do no change
	r.enableAttribute("aVertexPosition");
	r.enableAttribute("aTextureCoordinates");
	r.setAttribute("aVertexPosition", quadBuffer);
	r.setAttribute("aTextureCoordinates", textureBuffer);
	r.setUniformMatrix4("uModelViewMatrix", modelViewMatrix);
	r.setUniformMatrix4("uProjectionMatrix", projectionMatrix);
};

let bindEvents = function(){
	let canvas = document.getElementById('fury');
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
};

let setupShaderProgram = function() {
	try
	{
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
		r.initUniform(shaderProgram, "uTexture"); // sampler

		r.useShaderProgram(shaderProgram);

		// r.deleteShader(vsSource);
		// r.deleteShader(fsSource);
		// ^^ Question: Is this a good idea? Why would you do it?
		bindShaderProperties();
		bindEvents();

		r.setTexture(0, texture);
		r.setUniformInteger("uTexture", 0);
	}
	catch (error)
	{

	}
};

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

// Loop
let time = Date.now(), runningTime = 0, delta = 0;

setupShaderProgram();


let loop = function(){
	delta = Date.now() - time;
	time += delta;
	runningTime += delta;
	r.setUniformFloat("uTime", runningTime / 1000);
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
};
image.src = "concrete1.jpg";
