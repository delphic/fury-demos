// Render a Block using texture arrays!
// Using Fury's Scene, Shader, Mesh and Material Classes

// globalize glMatrix
Fury.Maths.globalize();

// Init Fury
Fury.init("fury");

// Create shader
let shader = Fury.Shader.create({
	vsSource: `#version 300 es
in vec3 aVertexPosition;
in vec3 aVertexNormal;
in vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

out vec3 vTextureCoord;

void main(void) {
	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
	vTextureCoord = vec3(aTextureCoord, 1.0 + aVertexNormal.y);
}`,
	fsSource: `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec3 vTextureCoord;

uniform sampler2DArray uSampler;

out vec4 fragColor;

void main(void) {
	fragColor = texture(uSampler, vTextureCoord);
}`,
	attributeNames: [ "aVertexPosition", "aVertexNormal", "aTextureCoord" ],
	uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler" ],
	textureUniformNames: [ "uSampler" ],
	pMatrixUniformName: "uPMatrix",
	mvMatrixUniformName: "uMVMatrix",
	bindMaterial: function(material) {
		this.enableAttribute("aVertexPosition");
		this.enableAttribute("aTextureCoord");
		this.enableAttribute("aVertexNormal");
	},
	bindBuffers: function(mesh) {
		this.setAttribute("aVertexPosition", mesh.vertexBuffer);
		this.setAttribute("aTextureCoord", mesh.textureBuffer);
		this.setAttribute("aVertexNormal", mesh.normalBuffer);
		this.setIndexedAttribute(mesh.indexBuffer);
	}
});

let material = Fury.Material.create({ shader : shader });

// Create Mesh
let cubeConfig = Fury.Primitives.createCubiodMeshConfig(2, 2, 2);
let cube = Fury.Mesh.create(cubeConfig);

// Create Camera & Scene
let camera = Fury.Camera.create({ near: 0.1, far: 1000000.0, fov: 1.0472, ratio: 1.0, position: [ 0.0, 0.0, 6.0 ] });
let scene = Fury.Scene.create({ camera: camera });

Fury.Renderer.clearColor(0.1, 0.1, 0.2, 1.0);

// Add Block to Scene
let block = scene.add({ material: material, mesh: cube });

let loop = function(){
	let rotation = block.transform.rotation;

	quat.rotateX(rotation, rotation, 0.01);
	quat.rotateY(rotation, rotation, 0.005);
	quat.rotateZ(rotation, rotation, 0.0025);

	scene.render();
	window.requestAnimationFrame(loop);
};

// Create Texture
let image = new Image();
image.onload = function() {
	material.textures["uSampler"] = Fury.Texture.createTextureArray({ 
		source: image,
		width: 64,
		height: 64,
		imageCount: 3,
		quality: "pixel",
		clamp: true
	});
	loop();
};
image.src = "block_texture.png";
