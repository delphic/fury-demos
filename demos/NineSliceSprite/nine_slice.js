let scaleFactor = 2;
let camera, scene;
let materials = {};

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
	Fury.Renderer.clearColor(0.1, 0.1, 0.3, 1.0);

	loadAssets(()=> {	
		let sliceConfig = { width: 8, height: 8, top: 2, right: 2, bottom: 2, left: 2 };
		let borderConfig = { width: 4, height: 4, top: 1, right: 1, bottom: 1, left: 1 };

		// let mesh = Fury.Mesh.create(createIndexedQuadMeshConfig(64, 32));
		let mesh = Fury.Mesh.create(buildSliceMeshConfig(48, 18, sliceConfig, Anchor.topCenter));
		scene.add({ mesh: mesh, material: materials["slice_test.png"], position: [0, -16, 0], scale: [2.0, 2.0, 1.0] });

		let rinkMaterial = Fury.Material.clone(materials["border.png"]);
		rinkMaterial.color = [ 1.0, 0.0, 0.4, 1.0 ];
		let borderMesh = Fury.Mesh.create(buildSliceMeshConfig(48,48, borderConfig, Anchor.middleCenter));
		scene.add({ mesh: borderMesh, material: rinkMaterial, position: [0, 32, 0] });

		let topLeftMaterial = Fury.Material.clone(materials["border.png"]);
		topLeftMaterial.color = [ 0.0, 1.0, 0.4, 1.0 ];
		let topLeftMesh = Fury.Mesh.create(buildSliceMeshConfig(32,32, borderConfig, Anchor.topLeft));
		scene.add({ mesh: topLeftMesh, material: topLeftMaterial, position: [0, 32, 0] });

		let topRightMaterial = Fury.Material.clone(materials["border.png"]);
		topRightMaterial.color = [ 1.0, 0.4, 0.0, 1.0 ];
		let topRightMesh = Fury.Mesh.create(buildSliceMeshConfig(16, 16, borderConfig, Anchor.topRight));
		scene.add({ mesh: topRightMesh, material: topRightMaterial, position: [0, 32, 0]});

		let bottomLeftMaterial = Fury.Material.clone(materials["border.png"]);
		bottomLeftMaterial.color = [ 0.4, 0.0, 1.0, 1.0 ];
		let bottomLeftMesh = Fury.Mesh.create(buildSliceMeshConfig(16, 16, borderConfig, Anchor.bottomLeft));
		scene.add({ mesh: bottomLeftMesh, material: bottomLeftMaterial, position: [0,32,0]});

		let bottomRightMaterial = Fury.Material.clone(materials["border.png"]);
		bottomRightMaterial.color = [0.4, 1.0, 0.0, 1.0 ];
		let bottomRightMesh = Fury.Mesh.create(buildSliceMeshConfig(32, 32, borderConfig, Anchor.bottomRight));
		scene.add({ mesh: bottomRightMesh, material: bottomRightMaterial, position: [0,32,0]});

		Fury.GameLoop.init({ loop: loop });
		Fury.GameLoop.start();
	});
};

const { RenderMode } = Fury.Renderer; 

let createUIQuadMeshConfig = function(w, h) {
	return {
		positions: [ 
			w, h, 0.0,
			0, h, 0.0, 
			w, 0, 0.0,
			0, 0, 0.0 ],
		uvs: [
			1.0, 1.0,
			0.0, 1.0,
			1.0, 0.0,
			0.0, 0.0 ],
		indices: [
			0, 1, 2, 2, 1, 3
		],
		renderMode: RenderMode.Triangles
	};
};

let Anchor = {
	"topLeft": 0,
	"topCenter": 1,
	"topRight": 2,
	"middleLeft": 3,
	"middleCenter": 4,
	"middleRight": 5,
	"bottomLeft": 6,
	"bottomCenter": 7,
	"bottomRight": 9 
};

let PositionRounding = {
	"none": 0,
	"integer": 1,
};

let calculateAnchorOffsetX = function(anchor, targetWidth) {
	switch (anchor || 0) {
		case Anchor.topRight:
		case Anchor.middleRight:
		case Anchor.bottomRight:
			return anchorOffsetX = -targetWidth;
		case Anchor.topCenter:
		case Anchor.middleCenter:
		case Anchor.bottomCenter:
			return anchorOffsetX = -targetWidth / 2;
		case Anchor.topLeft:
		case Anchor.middleLeft:
		case Anchor.bottomLeft:
		default:
			return anchorOffsetX = 0;
	}
};

let calculateAnchorOffsetY = function(anchor, targetHeight) {
	switch (anchor || 0) {
		case Anchor.topLeft:
		case Anchor.topCenter:
		case Anchor.topRight:
			return -targetHeight;
		case Anchor.middleLeft:
		case Anchor.middleCenter:
		case Anchor.middleRight:
			return  -targetHeight / 2;
		case Anchor.bottomLeft:
		case Anchor.bottomCenter:
		case Anchor.bottomRight:
		default:
			return 0;
	}
};

let buildSliceMeshConfig = (
	targetWidth,
	targetHeight,
	{ width, height, top, right, bottom, left },
	anchor,
	positionRounding
	) => {
	let anchorOffsetX = calculateAnchorOffsetX(anchor, targetWidth);
	let anchorOffsetY = calculateAnchorOffsetY(anchor, targetHeight);

	if (positionRounding) {
		anchorOffsetX = Math.floor(anchorOffsetX);
		anchorOffsetY = Math.floor(anchorOffsetY);
	}

	let positions = [];
	let uvs = [];
	let indices = [];

	let reference = createUIQuadMeshConfig(1,1);
	let extendPositions = (offsetX, offsetY, scaleX, scaleY) => {
		for (let i = 0, l = reference.positions.length; i < l; i += 3) {
			positions.push(scaleX * reference.positions[i] + offsetX + anchorOffsetX);
			positions.push(scaleY * reference.positions[i + 1] + offsetY + anchorOffsetY);
			positions.push(reference.positions[i + 2]);
		}
	}
	let extendUvs = (offsetU, offsetV, scaleU, scaleV) => {
		for (let i = 0, l = reference.uvs.length; i < l; i += 2) {
			uvs.push(scaleU * reference.uvs[i] + offsetU);
			uvs.push(scaleV * reference.uvs[i + 1] + offsetV);
		}
	}
	let extendIndices = (offset) => {
		for (let i = 0, l = reference.indices.length; i < l; i++) {
			indices.push(reference.indices[i] + offset);
		}
	};

	// left - bottom
	let positionCount = 0;
	extendPositions(0, 0, left, bottom);
	extendUvs(0, 0, left / width, bottom / height);
	extendIndices(positionCount);
	positionCount += 4;
	// bottom
	extendPositions(left, 0, targetWidth - left - right, bottom);
	extendUvs(left / width, 0, (width - left - right) / width, bottom / height);
	extendIndices(positionCount);
	positionCount += 4;
	// right - bottom
	extendPositions(targetWidth - right, 0, right, bottom);
	extendUvs((width - right) / width, 0, right / width, bottom / height);
	extendIndices(positionCount);
	positionCount += 4;
	// left
	extendPositions(0, bottom, left, targetHeight - top - bottom);
	extendUvs(0, bottom / height, left/width, (height - bottom - top) / height);
	extendIndices(positionCount);
	positionCount += 4;
	// middle
	extendPositions(left, bottom, targetWidth - left - right, targetHeight - top - bottom);
	extendUvs(left / width, bottom / height, (width - left - right) / width, (height - bottom - top) / height);
	extendIndices(positionCount);
	positionCount += 4;
	// right
	extendPositions(targetWidth - right, bottom, right, targetHeight - top - bottom);
	extendUvs((width - right) / width, bottom / height, right / width, (height - bottom - top) / height);
	extendIndices(positionCount);
	positionCount += 4;
	// left - top
	extendPositions(0, targetHeight - top, left, top);
	extendUvs(0, (height - top) / height, left / width, top / height);
	extendIndices(positionCount);
	positionCount += 4;
	// top
	extendPositions(left, targetHeight - top, targetWidth - left - right, top);
	extendUvs(left / width, (height - top) / height, (width - left - right) / width, top / height);
	extendIndices(positionCount);
	positionCount += 4;
	// right - top
	extendPositions(targetWidth - right, targetHeight - top, right, top);
	extendUvs((width - right) / width, (height - top) / height, right / width, top / height);
	extendIndices(positionCount);
	positionCount += 4;

	return {
		positions: positions,
		uvs: uvs,
		indices: indices,
		renderMode: RenderMode.Triangles
	};
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