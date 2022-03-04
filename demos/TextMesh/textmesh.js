const { Atlas, TextMesh } = Fury;

let microFontDef = {
	"id": "micro",
	"path": "micro-font.png",
	"width": 22,
	"height": 4, 
	"map": "ABCDEFGHIJKLMNOPQRSTUVabcdefghijklmnopqrstuvWXYZ0123456789_.,!?:; wxyz()[]{}'\"/\\|=-+*<>%",
	"tileWidth": 4,
	"tileHeight": 6
};

let miniFontDef = {
	"id": "mini",
	"path": "mini-font.png",
	"width": 22,
	"height": 4,
	"map": "ABCDEFGHIJKLMNOPQRSTUVabcdefghijklmnopqrstuvWXYZ0123456789_.,!?:; wxyz()[]{}'\"/\\|=-+*<>%",
	"tileWidth": 6,
	"tileHeight": 8,
	"customTileWidths": [
		{ "width": 5, "tiles": "abcdeghknopqstuvxyz.,!?:;=" },
		{ "width": 4, "tiles": "fr0123456789 {}'\"/\\|-+*<>" },
		{ "width": 3, "tiles": "jl()[]" },
		{ "width": 2, "tiles": "i" }
	]
};

let scaleFactor = 2;
let camera, scene;
let atlases = {};

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

	loadAssets(()=>{
		TextMesh.create({
			text: "The Quick Brown Fox Jumped Over the Lazy Dog!",
			scene: scene,
			atlas: atlases["mini"],
			position: vec3.fromValues(0,-16,0),
			alignment: TextMesh.Alignment.center
		});

		TextMesh.create({
			text: "The Quick Brown Fox Jumped Over the Lazy Dog!",
			scene: scene,
			atlas: atlases["micro"],
			position: vec3.fromValues(0,16,0),
			alignment: TextMesh.Alignment.center
		});

		Fury.GameLoop.init({ loop: loop });
		Fury.GameLoop.start();
	});

};

let loadAssets = (callback) => {
	let assetsLoading = 0;
	let onAssetLoadComplete = () => {
		assetsLoading--;
		if (assetsLoading <= 0) {
			callback();
		}
	};

	assetsLoading++;
	Atlas.load(microFontDef, (atlas) => {
		atlases[microFontDef.id] = atlas;
		onAssetLoadComplete();
	});

	assetsLoading++;
	Atlas.load(miniFontDef, (atlas) => {
		atlases[miniFontDef.id] = atlas;
		onAssetLoadComplete();
	});
};

let loop = function(elapsed) {
	// TODO: maybe some animation effects / color lerps?
	scene.render();
};