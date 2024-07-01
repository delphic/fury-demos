// Alpha Testing Demo
// Supply White Ring Texture with transparent centre as ring.png

const { Camera, Material, Maths, Mesh, Primitives, Scene, Shader } = Fury;

 // Init Fury
Fury.init("fury");

// globalize glMatrix
Maths.globalize();

// Create shader
let shader = Shader.create({
	vsSource: `#version 300 es
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

in vec3 aVertexPosition;
in vec2 aTextureCoord;

out vec2 vTextureCoord;

void main(void) {
	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
	vTextureCoord = aTextureCoord;
}`,
	fsSource: `#version 300 es
precision highp float;

uniform sampler2D uSampler;
uniform vec4 uTint;

in vec2 vTextureCoord;

out vec4 fragColor;

void main(void) {
	fragColor = texture(uSampler, vec2(vTextureCoord.s, vTextureCoord.t)) * uTint;
}`,
	attributeNames: [ "aVertexPosition", "aTextureCoord" ],
	uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler", "uTint" ],
	textureUniformNames: [ "uSampler" ],
	pMatrixUniformName: "uPMatrix",
	mvMatrixUniformName: "uMVMatrix",
	bindMaterial: function(material) {
		this.setUniformVector4("uTint", material.tint);
	},
	bindBuffers: function(mesh) {
		this.enableAttribute("aVertexPosition");
		this.enableAttribute("aTextureCoord");
		this.setAttribute("aVertexPosition", mesh.vertexBuffer);
		this.setAttribute("aTextureCoord", mesh.textureBuffer);
		this.setIndexedAttribute(mesh.indexBuffer);
	},
	validateMaterial: function(material) {
		if (!material.tint || material.tint.length != 4) {
			console.log("Warning material.tint should be set to a vec4");
		}
	}
});

// Create Materials
let whiteMaterial = Material.create({ shader: shader, properties: { alpha: false, tint: [1.0, 1.0, 1.0, 1.0] } });
let redMaterial = Material.create({ shader : shader, properties: { alpha: true, tint: [1.0, 0.0, 0.0, 0.75] } });
let greenMaterial = Material.create({ shader: shader, properties: { alpha: true, tint: [0.0, 1.0, 0.0, 0.75] } });
let blueMaterial = Material.create({ shader: shader, properties: { alpha: true, tint: [0.0, 0.0, 1.0, 0.75] } });

// Create Mesh
let quad = Mesh.create(Primitives.createCenteredQuadMeshConfig(1.0, 1.0));
let cube = Mesh.create(Primitives.createCubiodMeshConfig(2.0, 2.0, 2.0));

// Create Camera & Scene
let camera = Camera.create({ near: 0.1, far: 1000000.0, fov: 1.0472, ratio: 1.0, position: vec3.fromValues(0.0, 0.0, 3.0) });
let scene = Scene.create({ camera: camera });

// Add Quads to Scene
let separation = 0.3, sin60 = Math.sin(Math.PI/6.0), sin30 = Math.sin(Math.PI/12.0);
let redRing = scene.add({ material: redMaterial, mesh: quad, position: [0, separation, 0] });
let greenRing = scene.add({ material: greenMaterial, mesh: quad, position: [separation * sin60, -separation * sin30, 0] });
let blueRing = scene.add({ material: blueMaterial, mesh: quad, position: [-separation * sin60, -separation * sin30, 0] });
let k = 0.5, time = 0, lastTime = Date.now();

// Add Non-alpha crate
let crate = scene.add({ material: whiteMaterial, mesh: cube, scale: [0.15, 0.15, 0.15] });

let loop = function() {
	time += (Date.now() - lastTime)/1000;
	lastTime = Date.now();
	redRing.transform.position[2] = -0.5 + Math.sin(k*time);
	greenRing.transform.position[2] = -0.5 + Math.sin((Math.PI/4.0) + k*time);
	blueRing.transform.position[2] = -0.5 + Math.sin((Math.PI/2.0) + k*time);
	let rotation = crate.transform.rotation;
	quat.rotateX(rotation, rotation, 0.01);
	quat.rotateY(rotation, rotation, 0.005);
	quat.rotateZ(rotation, rotation, 0.0025);
	scene.render();
	window.requestAnimationFrame(loop);
};

// Create Texture
let image1Loaded = false, image2Loaded = false;
let texture, image1 = new Image(), image2 = new Image();
image1.onload = function() {
	let texture = Fury.Texture.create({ source: image1, quality: "high", clamp: true });
	redMaterial.textures["uSampler"] = texture;
	greenMaterial.textures["uSampler"] = texture;
	blueMaterial.textures["uSampler"] = texture;
	image1Loaded = true;
	if(image1Loaded && image2Loaded) {
		loop();
	}
};
image2.onload = function() {
	let texture = Fury.Texture.create({ source: image2, quality: "high", clamp: true });
	whiteMaterial.textures["uSampler"] = texture;
	image2Loaded = true;
	if(image1Loaded && image2Loaded) {
		loop();
	}
}
image1.src = "ring.png";
image2.src = "crate.gif"
