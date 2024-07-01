// This is to test the basic rendering functions of Fury
// without any extra stuff (e.g. loading shaders and images from URIs, using an explicit scene, etc)

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

// Init
Fury.init('fury');
const r = Fury.Renderer;
const mat4 = Fury.Maths.mat4;
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

// Events!
document.getElementById('fury').addEventListener("mousemove", function(event) {
	event.preventDefault();
	// transforming cursor coordinates to [-1.0, 1.0] range
	// [0,0] being in the left bottom corner to match the vertex coordinates
	let x = (event.pageX / 512) * 2.0 - 1.0;
	let y = 0.0 - ((event.pageY / 512) * 2.0 - 1.0);
	r.setUniformFloat2("uMousePos", x, y);
});

document.addEventListener("mousedown", function(event) {
	event.preventDefault();
	if (event.button == 0) {
		r.setUniformBoolean("uMouseDown", true);
	}
});
document.addEventListener("mouseup", function(event) {
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
