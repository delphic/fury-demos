// Test of bit packing values in a integer buffer and unpacking them in a shader
// Note this can also be done using float buffers and arithmetic
// which probably have higher GPU performance where use case makes this viable

// Init Fury
Fury.init("fury");

// Build Colored Unit Equilateral Triangle Mesh
let h = Math.sqrt(3) / 2;
let vertices = [
	- h / 2, - h / 3, 0,
	0, 2 * h / 3, 0,
	h / 2, - h / 3, 0, 
];
let indices = [ 0, 2, 1 ];
// Bit packed colors
let colors = new Uint32Array([
	255 << 8 | 255 << 16,
	255 << 16 | 255 << 24,
	255 << 8 | 255 << 24
]);
let meshConfig = {
	vertices: vertices,
	indices: indices,
	colors: colors,
	customAttributes: [{ name: "colorBuffer", source: "colors", size: 1 }]
};

let mesh = Fury.Mesh.create(meshConfig);

let vs = `#version 300 es
in vec3 aPosition;
in uint aColor;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

out vec3 vColor;

void main(void) {
	gl_Position = uPMatrix * uMVMatrix * vec4(aPosition, 1.0);
	
	uint r = aColor >> 24;
	uint g = aColor << 8 >> 24;
	uint b = aColor << 16 >> 24;
	vColor = vec3(r, g, b);
	vColor.r = vColor.r / 255.0;
	vColor.g = vColor.g / 255.0;
	vColor.b = vColor.b / 255.0;
}`;
let fs = `#version 300 es
precision highp float;

in vec3 vColor;

out vec4 fragColor;

void main(void) {
	fragColor = vec4(vColor, 1.0);
}`;
let shader = Fury.Shader.create({
	vsSource: vs,
	fsSource: fs,
	attributeNames: [ "aPosition", "aColor" ],
	uniformNames: [ "uMVMatrix", "uPMatrix" ],
	pMatrixUniformName: "uPMatrix",
	mvMatrixUniformName: "uMVMatrix",
	bindMaterial: function(material) {
		this.enableAttribute("aPosition");
		this.enableAttribute("aColor");
	},
	bindBuffers: function(mesh) {
		this.setAttribute("aPosition", mesh.vertexBuffer);
		this.setAttributeInteger("aColor", mesh.colorBuffer, this.DataType.UNSIGNED_INT);
		this.setIndexedAttribute(mesh.indexBuffer);
	}
});

let material = Fury.Material.create({ shader: shader });

let camera = Fury.Camera.create({ near: 0.1, far: 10000.0, fov: 1.0472, ratio: 1.0, position: [ 0.0, 0.0, 2.0 ] });
let scene = Fury.Scene.create({ camera: camera });

scene.add({ material: material, mesh: mesh });
scene.render();