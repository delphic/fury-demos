// Add a bunch of crates and a bunch of teapots to the scene

let assetsToLoad = 3;

let cubeJson = Fury.Primitives.createCubiodMeshConfig(2, 2, 2);
let teapotJson = null;
fetch("./teapot.json").then((response) => { 
	return response.json();
}).then((json) => {
	teapotJson = json; 
	assetsToLoad--;
	if (assetsToLoad == 0) {
		awake();
	}
});

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
	bindMaterial: function(material) { },
	bindBuffers: function(mesh) {
		this.enableAttribute("aVertexPosition");
		this.enableAttribute("aTextureCoord");
		this.setAttribute("aVertexPosition", mesh.vertexBuffer);
		this.setAttribute("aTextureCoord", mesh.textureBuffer);
		this.setIndexedAttribute(mesh.indexBuffer);
	}
});

let cubeMaterialConfig = { shader : shader };
let teapotMaterialConfig = { shader : shader };

// Create Camera & Scene
let camera = Fury.Camera.create({ near: 0.1, far: 1000000, fov: 1.0472, ratio: 1.0, position: [ 0, 0, 550 ] });
let scene = Fury.Scene.create({ camera: camera });

let rotation = quat.create();

let awake = function() {
	// Create Prefabs
	Fury.Prefab.create({ name: "cube", meshConfig: cubeJson, materialConfig: cubeMaterialConfig });
	Fury.Prefab.create({ name: "teapot", meshConfig: teapotJson, materialConfig: teapotMaterialConfig });

	// Note this needs to happen after materials loaded so that when they are copied the textures have loaded.
	// Perhaps textures should be stored at the Fury (Fury.Engine) level and thus loading callbacks will provide the texture to all materials
	// who have that texture id and this will work even if they've been copied prior to texture load

	// Add Crates and teapots
	let cubeScale = [ 5, 5, 5 ];
	for (let i = 0; i < 11; i++) {
		for (let j = 0; j < 11; j++) {
			for (let k = 0; k < 11; k++) {
				let position = [ (50 * i) - 275, (50 * j) - 275, (50 * k) - 275 ];
				if ((i + j + k) % 2){
					scene.instantiate({ name: "cube", rotation: rotation, position: position, scale: cubeScale });
				} else {
					scene.instantiate({ name: "teapot", rotation: rotation, position: position });
				}
			}
		}
	}

	loop();
};

let loop = function() {
	quat.rotateX(rotation, rotation, 0.01);
	quat.rotateY(rotation, rotation, 0.005);
	quat.rotateZ(rotation, rotation, 0.0025);
	scene.render();
	window.requestAnimationFrame(loop);
};

// Create Texture
let image1 = new Image(), image2 = new Image();
image1.onload = function() {
	cubeMaterialConfig.texture = Fury.Texture.create({ source: image1, quality: "high" });
	assetsToLoad--;
	if (!assetsToLoad) { awake(); }
};
image2.onload = function() {
	teapotMaterialConfig.texture = Fury.Texture.create({ source: image2, quality: "high" });
	assetsToLoad--;
	if (!assetsToLoad) { awake(); }
};
image2.src = "metal.jpg";
image1.src = "crate.gif";