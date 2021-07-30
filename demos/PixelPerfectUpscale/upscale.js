// Helpers
var createQuad = function(size) {
	return Fury.Mesh.create({
		vertices: [ size * 0.5, size * 0.5, 0.0, size * -0.5,  size * 0.5, 0.0, size * 0.5, size * -0.5, 0.0, size * -0.5, size * -0.5, 0.0 ],
		textureCoordinates: [ 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0 ],
		renderMode: Fury.Renderer.RenderMode.TriangleStrip
	});
};

// globalize glMatrix
Fury.Maths.globalize();

// Init Fury
Fury.init("fury", { antialias: false });

// Create shader & material
var material = Fury.Material.create({ 
	shader : Fury.Shaders.Sprite,
	properties: { 
		alpha: true,
		scale: vec2.fromValues(1, 1),
		offset: vec2.fromValues(0, 0)
	}
});

var camera = Fury.Camera.create({
	type: Fury.Camera.Type.Orthonormal,
	near: 0.1,
	far: 1000000.0,
	height: 256.0, 		// TODO: Should explicitly be canvas height
	ratio: 1, 			// TODO: Should explicitly be canvas width/height
	position: vec3.fromValues(0.0, 0.0, 1.0)
});

var scene = Fury.Scene.create({ camera: camera });

var sprite = scene.add({ material: material, mesh: createQuad(64) });	// Size should match the pixel size of the sprite
var spriteData;

var time = 0, lastTime = 0;

var loop = function() {
	var elapsed = (Date.now()/1000 - lastTime);
	lastTime = Date.now()/1000;
	time += elapsed;

	// TODO: Alternate between rotation and translation - a JS coroutine could work here
	var position = sprite.transform.position;
	position[0] = 32 * Math.sin(time);
	position[1] = 32 * Math.cos(time/2);

	//var rotation = sprite.transform.rotation;
	//quat.rotateZ(rotation, rotation, 0.0025);
	
	scene.render();

	window.requestAnimationFrame(loop);
};

var init = function() {
	// Create Texture
	var image = new Image();
	image.onload = function() {
		material.textures["uSampler"] = Fury.Renderer.createTexture(image, "low", true);
		//var rotation = sprite.transform.rotation;
		//quat.rotateZ(rotation, rotation, Math.PI/4);
		loop();
	};
	image.src = "lena.png";
};

init();
