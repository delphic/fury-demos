let createQuad = function(size) {
	return Fury.Mesh.create(Fury.Primitives.createSpriteQuadMeshConfig(size, size));
};
let spriteData = null;

let setFrame = function(index) {
	let frameData = spriteData.frames[index].frame;
	let w = spriteData.meta.size.w, h = spriteData.meta.size.h;
	material.scale[0] = frameData.w / w;
	material.scale[1] = frameData.h / h;
	material.offset[0] = frameData.x / w;
	material.offset[1] = (h - (frameData.y + frameData.h)) / h;
	material.dirty = true;
};

Fury.init({ canvasId: "fury" });

let material = Fury.Material.create({ 
	shader : Fury.Shaders.Sprite, 
	properties: { 
		alpha: true,
		offset: [0, 0],
		scale: [1, 1]
	}
});

let camera = Fury.Camera.create({
	type: Fury.Camera.Type.Orthonormal,
	near: 0.1,
	far: 1000000.0,
	height: 1.0,
	ratio: 1,
	position: [ 0.0, 0.0, 1.0 ]
});

let scene = Fury.Scene.create({ camera: camera });

let sprite = scene.add({ material: material, mesh: createQuad(1) });

let time = 0, lastTime = 0, lastSwitchTime =  0;
let currentSpriteIndex = 0;

let loop = function() {
	let now = Date.now();
	let elapsed = now - lastTime;
	time += elapsed;

	if (time - lastSwitchTime > spriteData.frames[currentSpriteIndex].duration) {
		lastSwitchTime = time;
		currentSpriteIndex = (currentSpriteIndex + 1) % spriteData.frames.length;
		setFrame(currentSpriteIndex);
	}

	scene.render();

	lastTime = now;
	window.requestAnimationFrame(loop);
};

var init = function() {
	fetch("LenaShoot.json").then(response => response.json()).then(json => {
		spriteData = json;
		let image = new Image();
		image.onload = () => {
			material.setTexture(Fury.Texture.create({ source: image }));
			
			setFrame(currentSpriteIndex);
			
			lastTime = Date.now();
			loop();
		};
		image.src = spriteData.meta.image;
	});
};

init();
