// Render a Crate!
// Testing Fury's Scene, Shader, Mesh, Material and Texture Modules
// Compare to Arbitary Shader demo which just uses the GL Facade (renderer)

// globalize glMatrix
Fury.Maths.globalize();

// Init Fury
Fury.init("fury");

// Create shader
let shader = Fury.Shader.create({
	vsSource: `#version 300 es
in vec3 aVertexPosition;
in vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

out vec2 vTextureCoord;

void main(void) {
	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
	vTextureCoord = aTextureCoord;
}`,
	fsSource: `#version 300 es
precision highp float;

in vec2 vTextureCoord;

uniform sampler2D uSampler;

out vec4 fragColor;

void main(void) {
	fragColor = texture(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
}`,
	attributeNames: [ "aVertexPosition", "aTextureCoord" ],
	uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler" ],
	textureUniformNames: [ "uSampler" ],
	pMatrixUniformName: "uPMatrix",
	mvMatrixUniformName: "uMVMatrix",
	bindMaterial: function(material) {
		this.enableAttribute("aVertexPosition");
		this.enableAttribute("aTextureCoord");
	},
	bindBuffers: function(mesh) {
		this.setAttribute("aVertexPosition", mesh.vertexBuffer);
		this.setAttribute("aTextureCoord", mesh.textureBuffer);
		this.setIndexedAttribute(mesh.indexBuffer);
	}
});

let material = Fury.Material.create({ shader : shader });

// Create Mesh
let cubeConfig = Fury.Primitives.createCubiodMeshConfig(2, 2, 2);
let cube = Fury.Mesh.create(cubeConfig);

// Create Camera & Scene
let camera = Fury.Camera.create({ near: 0.1, far: 1000000, fov: 1.0472, ratio: 1, position: [ 0.0, 0.0, 6.0 ] });
let scene = Fury.Scene.create({ camera: camera });

// Add Crate to Scene
let crate = scene.add({ material: material, mesh: cube });

let loop = function(){
	let rotation = crate.transform.rotation;
	quat.rotateX(rotation, rotation, 0.01);
	quat.rotateY(rotation, rotation, 0.005);
	quat.rotateZ(rotation, rotation, 0.0025);
	scene.render();
	window.requestAnimationFrame(loop);
};

// Create Texture
let image = new Image();
image.onload = function() {
	material.textures["uSampler"] = Fury.Texture.create({ source: image, quality: "high" });
	loop();
};
image.src = "crate.gif";
