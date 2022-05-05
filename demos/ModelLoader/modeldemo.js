// Render a Model
// Testing a model loader class
// globalize glMatrix
Fury.Maths.globalize();

let configurations = {
	"frog": { uri: "frog.gltf", position: [ 0, 0, 1 ], model: null },
	"cube": { uri: "colored_cube.gltf", position: [ 0, 0, 6 ], model: null }
};
let currentConfig = null;

Fury.init("fury");

// TODO: Orbit camera view - zoom / rotate etc
// TODO: Support models with multiple meshes
let cameraPosition = vec3.create();
let cameraRotation = Fury.Maths.quatEuler(-30, 135, 0);

let camera = Fury.Camera.create({ near: 0.01, far: 10000.0, fov: 1.0472, ratio: 1.0, position: cameraPosition, rotation: cameraRotation });
let scene = Fury.Scene.create({ camera: camera });

let textureShader = Fury.Shader.create({
	vsSource: [
		"attribute vec3 aVertexPosition;",
		"attribute vec3 aVertexNormal;",
		"attribute vec2 aTextureCoord;",

		"uniform mat4 uMVMatrix;",
		"uniform mat4 uPMatrix;",

		"varying vec2 vTextureCoord;",
		"varying float vLightWeight;",

		"void main(void) {",
			"gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
			"vTextureCoord = aTextureCoord;",
			"vLightWeight = 0.5 + 0.5 * max(dot(aVertexNormal, normalize(vec3(-1.0, 2.0, 1.0))), 0.0);",
		"}"].join('\n'),
	fsSource: [
		"precision mediump float;",

		"varying vec2 vTextureCoord;",
		"varying float vLightWeight;",

		"uniform sampler2D uSampler;",

		"void main(void) {",
			"gl_FragColor = vec4(vLightWeight * vec3(1.0, 1.0, 1.0), 1.0) * texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));",
		"}"].join('\n'),
	attributeNames: [ "aVertexPosition", "aVertexNormal", "aTextureCoord", ],
	uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler" ],
	textureUniformNames: [ "uSampler" ],
	pMatrixUniformName: "uPMatrix",
	mvMatrixUniformName: "uMVMatrix",
	bindMaterial: function(material) {
		this.enableAttribute("aVertexPosition");
		this.enableAttribute("aVertexNormal");
		this.enableAttribute("aTextureCoord");
	},
	bindBuffers: function(mesh) {
		this.setAttribute("aVertexPosition", mesh.vertexBuffer);
		this.setAttribute("aVertexNormal", mesh.normalBuffer);
		this.setAttribute("aTextureCoord", mesh.textureBuffer);
		this.setIndexedAttribute(mesh.indexBuffer);
	}
});
let colorShader =  Fury.Shader.create({
	vsSource: [
		"attribute vec3 aVertexPosition;",
		"attribute vec3 aVertexNormal;",
		"attribute vec2 aTextureCoord;",

		"attribute vec4 aColor0;",
		"attribute vec4 aColor1;",

		"uniform mat4 uMVMatrix;",
		"uniform mat4 uPMatrix;",

		"varying vec2 vTextureCoord;",
		"varying float vLightWeight;",

		"varying vec4 vColor0;",
		"varying vec4 vColor1;",

		"void main(void) {",
			"gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
			"vTextureCoord = aTextureCoord;",
			"vLightWeight = 0.5 + 0.5 * max(dot(aVertexNormal, normalize(vec3(-1.0, 2.0, 1.0))), 0.0);",
			"vColor0 = aColor0;",
			"vColor1 = aColor1;",
		"}"].join('\n'),
	fsSource: [
		"precision mediump float;",

		"varying vec4 vColor0;",
		"varying vec4 vColor1;",

		"varying vec2 vTextureCoord;",
		"varying float vLightWeight;",

		"uniform sampler2D uSampler;",

		"void main(void) {",
			"gl_FragColor = vec4(vLightWeight * vec3(1.0, 1.0, 1.0), 1.0) * vColor0;",
		"}"].join('\n'),
	attributeNames: [ "aVertexPosition", "aVertexNormal", "aTextureCoord", "aColor0", "aColor1" ],
	uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler" ],
	textureUniformNames: [ "uSampler" ],
	pMatrixUniformName: "uPMatrix",
	mvMatrixUniformName: "uMVMatrix",
	bindMaterial: function(material) {
		this.enableAttribute("aVertexPosition");
		this.enableAttribute("aVertexNormal");
		this.enableAttribute("aTextureCoord");
		this.enableAttribute("aColor0");
		this.enableAttribute("aColor1");
	},
	bindBuffers: function(mesh) {
		this.setAttribute("aVertexPosition", mesh.vertexBuffer);
		this.setAttribute("aVertexNormal", mesh.normalBuffer);
		this.setAttribute("aTextureCoord", mesh.textureBuffer);
		this.setAttribute("aColor0", mesh["COLOR_0"]);
		this.setAttribute("aColor1", mesh["COLOR_1"]);
		this.setIndexedAttribute(mesh.indexBuffer);
	}
});

let loop = () => {
	if (currentConfig && currentConfig.model) {
		let rotation = currentConfig.model.transform.rotation;
		quat.rotateY(rotation, rotation, 0.005);
	}
	scene.render();
	window.requestAnimationFrame(loop);
};

let selectConfig = (value) => {
	if (currentConfig != null && currentConfig.model) {
		currentConfig.model.active = false;
	} 
	currentConfig = configurations[value];
	vec3.copy(cameraPosition, currentConfig.position);
	vec3.transformQuat(cameraPosition, cameraPosition, cameraRotation);
	if (!currentConfig.model) {
		// This is what we're here to test!
		Fury.Model.load(currentConfig.uri, (model) => {
			// Load texture from model
			let texture = null;
			if (model.images.length) {
				texture = Fury.Texture.create({
					source: model.images[0],
					quality: "low",
					flipY: false
				});
			}

			let material = null;
			if (texture) {
				material = Fury.Material.create({ shader : textureShader });
				material.textures["uSampler"] = texture;
			} else {
				material = Fury.Material.create({ shader: colorShader });
			}

			let mesh = Fury.Mesh.create(model.meshData[0]);
			currentConfig.model = scene.add({ material: material, mesh: mesh });
			window.requestAnimationFrame(loop);
		});
	} else {
		currentConfig.model.active = true;
	}
};

let modelSelect = document.getElementById("model_select");
modelSelect.addEventListener("input", (e) => { selectConfig(modelSelect.value) });
selectConfig("frog");
