// Porting WebGL2 Fundementals Lesson to Fury
// https://webgl2fundamentals.org/webgl/lessons/webgl-skinning.html

Fury.init("fury");
Fury.Maths.globalize();

const vs = `#version 300 es
in vec4 a_position;
in vec4 a_weight;
in uvec4 a_boneNdx;

uniform mat4 projection;
uniform mat4 modelView;

uniform sampler2D boneMatrixTexture;
 
mat4 getBoneMatrix(uint boneNdx) {
	return mat4(
		texelFetch(boneMatrixTexture, ivec2(0, boneNdx), 0),
		texelFetch(boneMatrixTexture, ivec2(1, boneNdx), 0),
		texelFetch(boneMatrixTexture, ivec2(2, boneNdx), 0),
		texelFetch(boneMatrixTexture, ivec2(3, boneNdx), 0));
}

void main() {
	gl_Position = projection * modelView * 
		(getBoneMatrix(a_boneNdx[0]) * a_position * a_weight[0] +
		 getBoneMatrix(a_boneNdx[1]) * a_position * a_weight[1] +
		 getBoneMatrix(a_boneNdx[2]) * a_position * a_weight[2] +
		 getBoneMatrix(a_boneNdx[3]) * a_position * a_weight[3]);
}`;

const fs = `#version 300 es
precision highp float;
uniform vec4 color;
out vec4 outColor;
void main () {
	outColor = color;
}`;

const gl = Fury.Renderer.getContext();
const INDEX_TYPE = gl.UNSIGNED_BYTE; 
gl.disable(gl.CULL_FACE);

const shader = Fury.Shader.create({
	vsSource: vs,
	fsSource: fs,
	attributeNames: [ "a_position", "a_weight", "a_boneNdx" ],
	uniformNames: [ "projection", "modelView", "color" ],
	textureUniformNames: [ "boneMatrixTexture" ],
	pMatrixUniformName: "projection",
	mvMatrixUniformName: "modelView",
	bindMaterial: function(material) {
		this.enableAttribute("a_position");
		this.enableAttribute("a_weight");
		this.enableAttribute("a_boneNdx");
		this.setUniformVector4("color", material.color);
	},
	bindBuffers: function(mesh) {
		this.setAttribute("a_position", mesh.vertexBuffer);
		this.setAttribute("a_weight", mesh.weightBuffer);
		this.setAttributeInteger("a_boneNdx", mesh.boneNdxBuffer, INDEX_TYPE);
		this.setIndexedAttribute(mesh.indexBuffer);
	}
});

// Mesh Data
const meshData = {
	position: [
		0,  1, 0,  // 0
		0, -1, 0,  // 1
		2,  1, 0,  // 2
		2, -1, 0,  // 3
		4,  1, 0,  // 4
		4, -1, 0,  // 5
		6,  1, 0,  // 6
		6, -1, 0,  // 7
		8,  1, 0,  // 8
		8, -1, 0,  // 9
	],
	boneNdx: new Uint8Array([
		0, 0, 0, 0,  // 0
		0, 0, 0, 0,  // 1
		0, 1, 0, 0,  // 2
		0, 1, 0, 0,  // 3
		1, 0, 0, 0,  // 4
		1, 0, 0, 0,  // 5
		1, 2, 0, 0,  // 6
		1, 2, 0, 0,  // 7
		2, 0, 0, 0,  // 8
		2, 0, 0, 0,  // 9
	]),
	weight: [
		1,  0,  0,  0,  // 0
		1,  0,  0,  0,  // 1
		.5, .5,  0,  0,  // 2
		.5, .5,  0,  0,  // 3
		1,  0,  0,  0,  // 4
		1,  0,  0,  0,  // 5
		.5, .5,  0,  0,  // 6
		.5, .5,  0,  0,  // 7
		1,  0,  0,  0,  // 8
		1,  0,  0,  0,  // 9
	],
	indices: [
		0, 1, 2,
		1, 3, 2,
		2, 3, 4,
		3, 5, 4,
		4, 5, 6,
		5, 7, 6,
		6, 7, 8,
		7, 9, 8,
	],
};

let mesh = Fury.Mesh.create({
	positions: meshData.position,
	weight: meshData.weight,
	boneNdx: meshData.boneNdx,
	indices: meshData.indices,
	// renderMode: "lines",
	customAttributes: [
		{ name: "weightBuffer", source: "weight", size: 4 },
		{ name: "boneNdxBuffer", source: "boneNdx", size: 4 },
	]
});

let texture = Fury.Renderer.createDataTexture(); 
// Arguably should provide an interface on Texture module

const numBones = 4;
const boneArray = new Float32Array(numBones * 16);

const boneMatrices = [];	// the uniform data
const bones = [];			// the value before multiplying by inverse bind matrix
const bindPose = [];		// the bind matrix

for (let i = 0, l = numBones; i < l; i++) {
	boneMatrices.push(new Float32Array(boneArray.buffer, i * 4 * 16, 16));
	bindPose.push(mat4.create());
	bones.push(mat4.create());
}


let distance = 4.0;
let computeBoneMatrices = function(out, angle, distance) {
	const m = mat4.create();
	const offset = vec3.scaleAndAdd(vec3.create(), vec3.ZERO, vec3.X, distance);
	const translate = mat4.fromTranslation(mat4.create(), offset);
	mat4.rotateZ(out[0], m, angle);
	mat4.multiply(m, translate, out[0]);
	mat4.rotateZ(out[1], m, angle);
	mat4.multiply(m, translate, out[1]);
	mat4.rotateZ(out[2], m, angle);
};
computeBoneMatrices(bindPose, 0, 0);

const bindPoseInv = bindPose.map((m) => mat4.invert(mat4.create(), m));

let camera = Fury.Camera.create({ near: 0.1, far: 1000000, fov: 1.0472, ratio: 1, position: [ 0.0, 0.0, 6.0 ] });
camera.angle = 0;
let scene = Fury.Scene.create({ camera: camera });

let material = Fury.Material.create({
	shader: shader,
	texture: texture,
	properties: {
		bones: boneArray,
		color: [ 1.0, 0.0, 0.0, 1.0 ]
	}
});

scene.add({ material: material, mesh: mesh });


let loop = function(time) {
	// Orbit Camera
	if (Fury.Input.keyDown("Left")) {
		camera.angle += 0.01;
	}
	if (Fury.Input.keyDown("Right")) {
		camera.angle -= 0.01;
	}
	camera.position = [ 20 * Math.sin(camera.angle), 0, 20 * Math.cos(camera.angle) ];
	let lookAt = mat4.targetTo(mat4.create(), camera.position, vec3.ZERO, vec3.Y);
	mat4.decompose(camera.rotation, vec3.create(), vec3.create(), lookAt);

	// Allow altering of distance
	if (Fury.Input.keyDown("Up")) {
		distance += 0.1;
	}
	if (Fury.Input.keyDown("Down")) {
		distance -= 0.1;
	}

	// Animate the Bones!
	const t = time * 0.001;
	const angle = Math.sin(0.5 * t) * 0.5;

	computeBoneMatrices(bones, angle, distance); 

	bones.forEach((bone, ndx) => {
		mat4.multiply(boneMatrices[ndx], bone, bindPoseInv[ndx]);
	});
	Fury.Renderer.updateDataTexture(texture, boneArray, 4, numBones);
	
	// Update Matrix Texture
	material.dirty = true; // Force material rebind as uniform data has been changed

	// TODO: ^^ we should probably have scene force rebind on new frame anyway, it's strange
	// behavior cause as soon as there's another material in the scene it'll have to get rebound on next frame
	// so it's a edge case for when you're only using one material 
	// Also on looking at 'shouldRebindMaterial' and 'shouldRebindShader' in scene and I don't think they're quite right
	// I think what it's wanting to do is "only rebind texture if material has changed" but that's not quite what it'll do
	// if you change material *and* that material is dirty, it wouldn't rebind textures.

	scene.render();
	requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
