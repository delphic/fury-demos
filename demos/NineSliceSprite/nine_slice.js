let scaleFactor = 2;
let camera, scene;
let materials = {};

const NineSlice = Fury.NineSlice;
const { Anchor } = NineSlice;

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
		position: [ 0.0, 0.0, 1.0 ],
		clearColor: [0.1, 0.1, 0.3, 1.0]
	});
	scene = Fury.Scene.create({ camera: camera });

	loadAssets(()=> {	
		let sliceConfig = { width: 8, height: 8, top: 2, right: 2, bottom: 2, left: 2 };
		let borderConfig = { width: 4, height: 4, top: 1, right: 1, bottom: 1, left: 1 };

		// let mesh = Fury.Mesh.create(createIndexedQuadMeshConfig(64, 32));
		let mesh = Fury.Mesh.create(NineSlice.buildMeshConfig(48, 18, sliceConfig, Anchor.topCenter));
		scene.add({ mesh: mesh, material: materials["slice_test.png"], position: [0, -16, 0], scale: [2.0, 2.0, 1.0] });

		let rinkMaterial = Fury.Material.clone(materials["border.png"]);
		rinkMaterial.color = [ 1.0, 0.0, 0.4, 1.0 ];
		let borderMesh = Fury.Mesh.create(NineSlice.buildMeshConfig(48,48, borderConfig, Anchor.middleCenter));
		scene.add({ mesh: borderMesh, material: rinkMaterial, position: [0, 32, 0] });

		let topLeftMaterial = Fury.Material.clone(materials["border.png"]);
		topLeftMaterial.color = [ 0.0, 1.0, 0.4, 1.0 ];
		let topLeftMesh = Fury.Mesh.create(NineSlice.buildMeshConfig(32,32, borderConfig, Anchor.topLeft));
		scene.add({ mesh: topLeftMesh, material: topLeftMaterial, position: [0, 32, 0] });

		let topRightMaterial = Fury.Material.clone(materials["border.png"]);
		topRightMaterial.color = [ 1.0, 0.4, 0.0, 1.0 ];
		let topRightMesh = Fury.Mesh.create(NineSlice.buildMeshConfig(16, 16, borderConfig, Anchor.topRight));
		scene.add({ mesh: topRightMesh, material: topRightMaterial, position: [0, 32, 0]});

		let bottomLeftMaterial = Fury.Material.clone(materials["border.png"]);
		bottomLeftMaterial.color = [ 0.4, 0.0, 1.0, 1.0 ];
		let bottomLeftMesh = Fury.Mesh.create(NineSlice.buildMeshConfig(16, 16, borderConfig, Anchor.bottomLeft));
		scene.add({ mesh: bottomLeftMesh, material: bottomLeftMaterial, position: [0,32,0]});

		let bottomRightMaterial = Fury.Material.clone(materials["border.png"]);
		bottomRightMaterial.color = [0.4, 1.0, 0.0, 1.0 ];
		let bottomRightMesh = Fury.Mesh.create(NineSlice.buildMeshConfig(32, 32, borderConfig, Anchor.bottomRight));
		scene.add({ mesh: bottomRightMesh, material: bottomRightMaterial, position: [0,32,0]});

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

	let loadImage = (src) => {
		assetsLoading++;
		var image = new Image();
		image.onload = function() {
			let texture = Fury.Texture.create({ source: image, quality: "low" });
			materials[src] = Fury.Material.create({
				shader: Fury.Shaders.Sprite,
				texture: texture,
				properties: {
					scale: [1,1],
					offset: [0,0],
					alpha: true
				}
				});
			onAssetLoadComplete();
		};
		image.src = src;
	};

	loadImage("slice_test.png");
	loadImage("border.png");
};

let loop = function(elapsed) {
	scene.render();
};