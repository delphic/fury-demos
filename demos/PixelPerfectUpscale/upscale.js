// Helpers
let createQuad = function(w, h) {
	return Fury.Mesh.create({
		positions: [ 
			w * 0.5, h * 0.5, 
			0.0, h * -0.5,  
			w * 0.5, 0.0, 
			w * 0.5, h * -0.5, 
			0.0, h * -0.5, 
			w * -0.5, 0.0 ],
		uvs: [ 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0 ],
		renderMode: Fury.Renderer.RenderMode.TriangleStrip
	});
};

let scaleFactor = 3;
let camera, scene;
let sprite, material;

let time = 0;
let testRotation = false;
let testTranslation = false;

window.onload = (event) => {
	// Init
	Fury.Maths.globalize(); // globalize glMatrix
	Fury.init({ canvasId: "fury", glContextAttributes: { antialias: false } });

	// Resize Canvas
	let canvas = document.getElementById("fury");
	canvas.setAttribute(
		"style",
		"height: " + (canvas.height * scaleFactor / window.devicePixelRatio) + "px;" +
		"width: " + (canvas.width * scaleFactor / window.devicePixelRatio) + "px;");
	
	// Create camera and scene
	camera = Fury.Camera.create({
		type: Fury.Camera.Type.Orthonormal,
		near: 0.1,
		far: 1000000.0,
		height: canvas.height,
		ratio: canvas.width / canvas.height,
		position: vec3.fromValues(0.0, 0.0, 1.0)
	});
	scene = Fury.Scene.create({ camera: camera });

	document.getElementById("btnTranslate").addEventListener('click', () => { testTranslation = !testTranslation; });
	document.getElementById("btnRotate").addEventListener('click', () => { testRotation = !testRotation });

	// Create material
	material = Fury.Material.create({ 
		shader : Fury.Shaders.Sprite,
		properties: { 
			alpha: true,
			scale: vec2.fromValues(1, 1),
			offset: vec2.fromValues(0, 0)
		}
	});

	loadTexture("lena.png");
};

let loadTexture = function(texturePath) {
	// Create Texture
	let image = new Image();
	image.onload = function() {	
		material.setTexture(Fury.Texture.create({ source: image, clamp: true }));
		
		sprite = scene.add({ material: material, mesh: createQuad(image.width, image.height) });

		if (testRotation) {
			let rotation = sprite.transform.rotation;
			quat.rotateZ(rotation, rotation, Math.PI/4);
		}
		Fury.GameLoop.init({ loop: loop });
		Fury.GameLoop.start();
	};
	image.src = texturePath;
};

let loop = function(elapsed) {
	time += elapsed;

	if (testTranslation) {
		let position = sprite.transform.position;
		position[0] = 32 * Math.sin(time);
		position[1] = 32 * Math.cos(time/2);
	}

	if (testRotation) {
		let rotation = sprite.transform.rotation;
		quat.rotateZ(rotation, rotation, 0.0025);
	}

	scene.render();
};