// Render a Model
// Testing a model loader class
let { Maths, Camera, Scene, Shader, Renderer } = Fury;

// globalize glMatrix
Maths.globalize();

let configurations = {
	"frog": { uri: "frog.gltf", position: [ 0, 0, 1 ], sceneObjects: null },
	"cube": { uri: "colored_cube.gltf", position: [ 0, 0, 6 ], sceneObjects: null },
	"animation_test": { uri: "animation_test.gltf", position: [ 0, 0, 1.5], sceneObjects: null, animation_uri: "animation_test_animation.json" },
	"tiny_person": { uri: "tiny_person.gltf", position: [0, 0.5, 2 ], sceneObjects: null }
};
let currentConfig = null;

Fury.init("fury");

// TODO: Orbit camera view - zoom / rotate etc
let cameraPosition = vec3.create();
let cameraRotation = Maths.quatEuler(-30, 135, 0);

// TODO: clear color as scene property
Renderer.clearColor(0.1, 0.1, 0.2, 1.0);
let camera = Camera.create({ near: 0.01, far: 10000.0, fov: 1.0472, ratio: 1.0, position: cameraPosition, rotation: cameraRotation });
let scene = Scene.create({ camera: camera });

let textureShader = Shader.create({
	vsSource: `#version 300 es
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

in vec3 aVertexPosition;
in vec3 aVertexNormal;
in vec2 aTextureCoord;

out vec2 vTextureCoord;
out float vLightWeight;

void main(void) {
	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
	vTextureCoord = aTextureCoord;
	vLightWeight = 0.5 + 0.5 * max(dot(aVertexNormal, normalize(vec3(-1.0, 2.0, 1.0))), 0.0);
}`,
	fsSource: `#version 300 es
precision highp float;

uniform sampler2D uSampler;

in vec2 vTextureCoord;
in float vLightWeight;

out vec4 fragColor;

void main(void) {
	fragColor = vec4(vLightWeight * vec3(1.0, 1.0, 1.0), 1.0) * texture(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
}`,
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
let colorShader =  Shader.create({
	vsSource: `#version 300 es
in vec3 aVertexPosition;
in vec3 aVertexNormal;
in vec2 aTextureCoord;
in vec4 aColor0;
in vec4 aColor1;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

out vec2 vTextureCoord;
out float vLightWeight;
out vec4 vColor0;
out vec4 vColor1;

void main(void) {
	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
	vTextureCoord = aTextureCoord;
	vLightWeight = 0.5 + 0.5 * max(dot(aVertexNormal, normalize(vec3(-1.0, 2.0, 1.0))), 0.0);
	vColor0 = aColor0;
	vColor1 = aColor1;
}`,
	fsSource: `#version 300 es
precision highp float;

in vec4 vColor0;
in vec4 vColor1;
in vec2 vTextureCoord;
in float vLightWeight;

uniform sampler2D uSampler;

out vec4 fragColor;

void main(void) {
	fragColor = vec4(vLightWeight * vec3(1.0, 1.0, 1.0), 1.0) * vColor0;
}`,
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
		// todo: in example "VertexColouredCube"
		// aTextureCoord and aColor1 are coming back with attribute location of -1
		// but the render still works
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

let animationStart = Date.now(), animationName = null;
let vec3From = [], vec3To = [], vec4From = [], vec4To = [];

let loop = () => {
	// If model has animations play first
	if (currentConfig && currentConfig.model && currentConfig.model.animations) {
		if (!animationName) {
			animationName = Object.keys(currentConfig.model.animations)[0];
			animationStart = Date.now();	
		} else if (!currentConfig.model.animations[animationName]) {
			animationName = null;
		}
	} else {
		animationName = null;
	}

	if (animationName) {
		let model = currentConfig.model;
		let instance = currentConfig.instance;
		let animation = model.animations[animationName];
		let time = ((Date.now() - animationStart) / 1000) % animation.duration;

		for (let i = 0, l = animation.channels.length; i < l; i++) {
			let channel = animation.channels[i];
			let times = channel.times;
			let values = channel.values;
			let prev = 0, next = 0;
			while (times[next] < time && next < times.length) {
				prev = next;
				next = (next + 1) % times.length;
			}
			let from = times[prev], to = times[next];
			if (to < from) {
				to += animation.duration;
			}
			let delta = to - from;
			let ratio = 0;
			if (delta) {
				ratio = (time - from) / delta;
			}

			let transform = instance.transforms[channel.node];
			switch (channel.type) {
				case "translation":
					vec3.set(vec3From, values[prev * 3], values[prev * 3 + 1], values[prev * 3 + 2]);
					vec3.set(vec3To, values[next * 3], values[next * 3 + 1], values[next * 3 + 2]);
					vec3.lerp(transform.position, vec3From, vec3To, ratio);
					break;
				case "rotation":
					vec4.set(vec4From, values[prev * 4], values[prev * 4 + 1], values[prev * 4 + 2], values[prev * 4 + 3]);
					vec4.set(vec4To, values[next * 4], values[next * 4 + 1], values[next * 4 + 2], values[next * 4 + 3]);
					quat.slerp(transform.rotation, vec4From, vec4To, ratio);
					break;
				case "scale":
					vec3.set(vec3From, values[prev * 3], values[prev * 3 + 1], values[prev * 3 + 2]);
					vec3.set(vec3To, values[next * 3], values[next * 3 + 1], values[next * 3 + 2]);
					vec3.lerp(transform.scale, vec3From, vec3To, ratio);
					break;
			}
		}
	} else {
		// TODO: Input to move the camera instead
		if (currentConfig && currentConfig.sceneObjects) {
			let rotation = currentConfig.instance.transform.rotation;
			quat.rotateY(rotation, rotation, 0.005);
		}
	}

	scene.render();
	window.requestAnimationFrame(loop);
};

let selectConfig = (value) => {
	if (currentConfig != null && currentConfig.sceneObjects) {
		for (let i = 0, l = currentConfig.sceneObjects.length; i < l; i++) {
			currentConfig.sceneObjects[i].active = false;
		}
	} 
	currentConfig = configurations[value];
	vec3.copy(cameraPosition, currentConfig.position);
	vec3.transformQuat(cameraPosition, cameraPosition, cameraRotation);
	if (!currentConfig.sceneObjects) {
		// This is what we're here to test!
		let modelResourceProperties = {
			shader: textureShader,
			texturelessShader: colorShader,
			quality: "low"
		};
		Fury.Model.load(currentConfig.uri, (model) => {
			currentConfig.model = model;
			let instance = Fury.Model.instantiate(model, scene);
			currentConfig.instance = instance;
			currentConfig.sceneObjects = instance.sceneObjects;
		}, modelResourceProperties);
	} else {
		for (let i = 0, l = currentConfig.sceneObjects.length; i < l; i++) {
			currentConfig.sceneObjects[i].active = true;
		}
	}
};

let modelSelect = document.getElementById("model_select");
modelSelect.addEventListener("input", (e) => { selectConfig(modelSelect.value) });
selectConfig("frog");
window.requestAnimationFrame(loop);
