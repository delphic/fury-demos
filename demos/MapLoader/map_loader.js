// globalize glMatrix
Fury.Maths.globalize();

// Init Fury
Fury.init({ canvasId: "fury" });

// Create Camera & Scene
let camera = Fury.Camera.create({ 
	near: 0.1,
	far: 1000.0,
	fov: Fury.Maths.toRadian(60),
	ratio: 1.0,
	position: [ 0.0, 1.0, 0.0 ] 
});
let scene = Fury.Scene.create({ camera: camera, enableFrustumCulling: true });

// Physics world
let world = { boxes: [] };

let Maths = Fury.Maths;
let Physics = Fury.Physics;
let vec3Pool = Maths.vec3Pool;

// Fullscreen logic
let glCanvas = document.getElementById("fury");
glCanvas.style = "width: 100%; height: 100vh;";
document.body.style = "margin: 0; overflow-y: hidden;";
let cameraRatio = 1.0, resolutionFactor = 1.0;
let updateCanvasSize = (event) => {
	glCanvas.width = resolutionFactor * glCanvas.clientWidth;
	glCanvas.height = resolutionFactor * glCanvas.clientHeight;
	cameraRatio = glCanvas.clientWidth / glCanvas.clientHeight;
	if (camera && camera.ratio) camera.ratio = cameraRatio;
};
window.addEventListener('resize', updateCanvasSize);
updateCanvasSize();

// Create shader
let shader = Fury.Shader.create({
	vsSource: [
		"attribute vec3 aVertexPosition;",
		"attribute vec2 aTextureCoord;",

		"uniform mat4 uMVMatrix;",
		"uniform mat4 uPMatrix;",

		"uniform float uSScale;",
		"uniform float uTScale;",

		"varying vec2 vTextureCoord;",
		"void main(void) {",
			"gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
			"vTextureCoord = vec2(uSScale * aTextureCoord.s, uTScale * aTextureCoord.t);",
		"}"].join('\n'),
	fsSource: [
		"precision mediump float;",

		"varying vec2 vTextureCoord;",

		"uniform sampler2D uSampler;",

		"void main(void) {",
			"gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));",
		"}"].join('\n'),
	attributeNames: [ "aVertexPosition", "aTextureCoord" ],
	uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler", "uSScale", "uTScale" ],
	textureUniformNames: [ "uSampler" ],
	pMatrixUniformName: "uPMatrix",
	mvMatrixUniformName: "uMVMatrix",
	bindMaterial: function(material) {
		this.enableAttribute("aVertexPosition");
		this.enableAttribute("aTextureCoord");
		if (material.sScale) {
			this.setUniformFloat("uSScale", material.sScale);
		} else {
			this.setUniformFloat("uSScale", 1);
		}
		if (material.tScale) {
			this.setUniformFloat("uTScale", material.tScale);
		} else {
			this.setUniformFloat("uTScale", 1);
		}
	},
	bindBuffers: function(mesh) {
		this.setAttribute("aVertexPosition", mesh.vertexBuffer);
		this.setAttribute("aTextureCoord", mesh.textureBuffer);
		this.setIndexedAttribute(mesh.indexBuffer);
	},
	validateMaterial: function(material) {
		if (!material.sScale) {
			console.log("Warning: material does not have sScale property set");
		}
		if (!material.tScale) {
			console.log("Warning: material does not have tScale property set");
		}
	}
});

let namedMaterials = [];

// Creates a cuboid origin in centre of specifed width / height / depth
// x, y, z used to offset the UVs
// Texture coordinates 1:1 with world size
let createCuboidMesh = function(width, height, depth, x, y, z) {
	let sx = width / 2, sy = height / 2, sz = depth / 2;
	return {
		vertices: [
			// Front face
			-sx, -sy,  sz,
			 sx, -sy,  sz,
			 sx,  sy,  sz,
			-sx,  sy,  sz,

			// Back face
			-sx, -sy, -sz,
			-sx,  sy, -sz,
			 sx,  sy, -sz,
			 sx, -sy, -sz,

			// Top face
			-sx,  sy, -sz,
			-sx,  sy,  sz,
			 sx,  sy,  sz,
			 sx,  sy, -sz,

			// Bottom face
			-sx, -sy, -sz,
			 sx, -sy, -sz,
			 sx, -sy,  sz,
			-sx, -sy,  sz,

			// Right face
			 sx, -sy, -sz,
			 sx,  sy, -sz,
			 sx,  sy,  sz,
			 sx, -sy,  sz,

			// Left face
			-sx, -sy, -sz,
			-sx, -sy,  sz,
			-sx,  sy,  sz,
			-sx,  sy, -sz],
		textureCoordinates: [
			// Updated uvs as noted from naive to match trenchbroom's texture mapping
			// Front face - swapped x direction
			x+sx, y-sy,
			x-sx, y-sy,
			x-sx, y+sy,
			x+sx, y+sy,

			// Back face - swapped x direction
			x+sx, y-sy,
			x+sx, y+sy,
			x-sx, y+sy,
			x-sx, y-sy,

			// Top face - swapped x and z
			z+sz, x-sx,
			z-sz, x-sx,
			z-sz, x+sx,
			z+sz, x+sx,

			// Bottom face - swapped x and z
			z+sz, x+sx,
			z+sz, x-sx,
			z-sz, x-sx,
			z-sz, x+sx,

			// Right face
			z+sz, y-sy,
			z+sz, y+sy,
			z-sz, y+sy,
			z-sz, y-sy,

			// Left face - swaped z direction
			z+sz, y-sy,
			z-sz, y-sy,
			z-sz, y+sy,
			z+sz, y+sy ],
		indices: [
			0, 1, 2,      0, 2, 3,    // Front face
			4, 5, 6,      4, 6, 7,    // Back face
			8, 9, 10,     8, 10, 11,  // Top face
			12, 13, 14,   12, 14, 15, // Bottom face
			16, 17, 18,   16, 18, 19, // Right face
			20, 21, 22,   20, 22, 23  // Left face
		] };
};

let createCuboid = function(w, h, d, x, y, z, material) {
	let position = vec3.fromValues(x, y, z);
	let size = vec3.fromValues(w, h, d);
	let mesh = Fury.Mesh.create(createCuboidMesh(w, h, d, x, y, z));
	let box = Physics.Box.create({ center: position, size: size });
	// Note if you move the cuboid you have to recalculate min max

	// Add to scene and physics world
	world.boxes.push(box);
	return scene.add({ material: material, mesh: mesh, position: position, static: true });
};

// Quick and Dirty .map file loader
// Supports only AABB
// c.f. http://www.gamers.org/dEngine/quake/QDP/qmapspec.html
let MapLoader = (function(){
	let exports = {};

	let assertLineStartsWith = (lines, index, startsWith) => {
		if (!lines[index].startsWith(startsWith)) {
			throw new Error("Unexpected start to line " + index + " expected '" + startsWith + "' actual '" + lines[index] + "'");
		}
	};

	let parseVector = (out, str, scaleFactor) => {
		// Quake uses different coordinate system
		let split = str.split(' ');
		out[0] = scaleFactor * -parseFloat(split[1]);
		out[1] = scaleFactor * parseFloat(split[2]);
		out[2] = scaleFactor * -parseFloat(split[0]);
	};

	let parseAABBFromBrush = (out, brush, scaleFactor) => {
		let x1, x2, y1, y2, z1, z2;
		let xFound = false, yFound = false, zFound = false;
		for (let i = 0; i < 6; i++) {
			let plane = brush.planes[i]; 

			// Convert Points to AABB
			// These points define a plane, the correct way to solve is determine normal and point and then intersect the defined planes to determine
			// vertices, however because we're limiting ourselves to AABB we can take a shortcut, which is one axis will have the same value across
			// all three points, and this is one of that components min or max for the AABB
			if (plane.p1[0] == plane.p2[0] && plane.p2[0] == plane.p3[0]) {
				if (!xFound) {
					x1 = plane.p1[0];
					xFound = true;
				} else {
					x2 = plane.p1[0];
				}
			} else if (plane.p1[1] == plane.p2[1] && plane.p2[1] == plane.p3[1]) {
				if (!yFound) {
					y1 = plane.p1[1];
					yFound = true;
				} else {
					y2 = plane.p1[1];
				}
			} else if (plane.p1[2] == plane.p2[2] && plane.p2[2] == plane.p3[2]) {
				if (!zFound) {
					z1 = plane.p2[2];
					zFound = true;
				} else {
					z2 = plane.p2[2];
				}
			}
		}

		let xMin = Math.min(x1, x2), xMax = Math.max(x1, x2);
		let yMin = Math.min(y1, y2), yMax = Math.max(y1, y2);
		let zMin = Math.min(z1, z2), zMax = Math.max(z1, z2);

		xMin *= scaleFactor;
		xMax *= scaleFactor;
		yMin *= scaleFactor;
		yMax *= scaleFactor;
		zMin *= scaleFactor;
		zMax *= scaleFactor;

		out.xMin = xMin;
		out.xMax = xMax;
		out.yMin = yMin;
		out.yMax = yMax;
		out.zMin = zMin;
		out.zMax = zMax;
	}; 

	// take a brush and return an array of polygons,
	// each polygon in Fury mesh config format i.e. array of positions, textureCoordinates, normals, indices
	// with the additional property of "texture" for texture details of the plane
	let parsePolysFromBrush = (brush, scaleFactor) => {
		let result = [];
		let n = brush.planes.length;
		let planes = [];
		for (let i = 0; i < n; i++) {
			let { p1, p2, p3 } = brush.planes[i]; // need to swap y/z or maybe we should do this in the parse stage?
			planes.push(Plane.fromPoints(p1, p2, p3));
		}

		for (let i1 = 0; i1 < n; i1++) {
			let a = planes[i1];
			let texture = brush.planes[i1].texture;
			let vertices = [];
			let center = vec3Pool.request();
			for (let i2 = 0; i2 < n; i2++) {
				if (i2 != i1) {
					let b = planes[i2];
					for (let i3 = i2+1; i3 < n; i3++) {
						if (i3 != i1) {
							let c = planes[i3];
							let position = Plane.triangulate(a, b, c);
							if (position != null) {
								let pass = true;
								let i4 = 0;
								while (pass && i4 < n) {
									if (i4 != i3 && i4 != i2 && i4 != i1) {
										pass &= !Plane.isPointInFront(planes[i4], position);
										if (!pass) {
											console.log("Point " + JSON.stringify(position) + " rejected by plane " + i4 + ": "  + JSON.stringify(planes[i4]));
											pass = true;
										}
									}
									i4++;
								}
								if (pass) {
									vec3.scale(position, position, scaleFactor);
									vec3.add(center, center, position);
									vertices.push( { position: position, uv: [0,0], normal: vec3.clone(a), angle: 0 });
								}
							}
						}
					}
				}
			}
			// now have list of vertices on that plane 
			// (arguably when doing this for future planes, we could cache a bunch of these calculations)
			let l = vertices.length;
	
			if (l >= 3) {
				vec3.scale(center, center, 1 / l);
	
				let rotation = mat4.create();
				if (Maths.approximately(Math.abs(a[1]), 1.0, 0.001)) {
					mat4.lookAt(rotation, Maths.vec3Zero, a, Maths.vec3X);
				} else {
					mat4.lookAt(rotation, Maths.vec3Zero, a, Maths.vec3Y);
				}
		
				let temp = vec3Pool.request();
				for (let i = 0; i < l; i++) {
					// position relative to center
					vec3.subtract(temp, vertices[i].position, center);
					// transform so point it's in the plane 
					// I thought that would imply z == 0, but it seems to just make it
					// approximately equal but it can be offset, should double check this
					vec3.transformMat4(temp, temp, rotation);
					// calculate uv from position on plane
					// todo: take account of texture offset, angle and scale values
					vec2.copy(vertices[i].uv, temp); 
					// calculate winding angle using atan2
					vertices[i].angle = Math.atan2(temp[1], temp[0]) + Math.PI;
					// this works only because the shape is requried to be convex
				}
		
				vertices.sort((a, b) => { 
					if (a.angle < b.angle) {
						return -1;
					}
					if (b.angle < a.angle) {
						return 1;
					}
					return 0;
				});
		
				// walk sorted vertices to generate indices for poly
				let data = {
					vertices: [],
					textureCoordinates: [],
					normals: [],
					indices: [],
					texture: texture
				};
				let reverse = false;
				let offset = data.vertices.length;
				let c = 0, cw = 1, ccw = l -1;
				while (ccw != cw) {
					data.indices.push(offset + c, offset + ccw, offset + cw);
					if (!reverse) {
						c = cw;
						cw += 1;
					} else {
						c = ccw;
						ccw -= 1;
					}
					reverse = !reverse;
				}
				for (let i = 0; i < l; i++) {
					let { position, uv, normal } = vertices[i];
					data.vertices.push(position[0], position[1], position[2]);
					// ^^ vertices should really be called positions
					data.textureCoordinates.push(uv[0], uv[1]);
					data.normals.push(normal[0], normal[1], normal[2]);
				}
				result.push(data);
	
				console.log(JSON.stringify(data));
			} else {
				console.warn("Generated less than 3 vertices for plane " + i1);
			}
		}
		return result;
	};

	let instanitateWorldBrushes = (brushes, scaleFactor, instantiationDelegate) => {
		let aabb = {};
		for (let i = 0, l = brushes.length; i < l; i++) {
			// parseAABBFromBrush(aabb, brushes[i], scaleFactor);
			let polys = parsePolysFromBrush(brushes[i], scaleFactor);
			instantiationDelegate(polys);
		}
	};

	exports.parse = (data) => {
		// Parse line by line
		let lines = data.split('\n');

		let lineIndex = 0;
		// Parse Starting Comment Info
		let properties = {};
		let colonIndex = lines[lineIndex].indexOf(":"); 
		while (colonIndex !== -1) {
			let line = lines[lineIndex];
			let name = line.substring(3, colonIndex);
			let value = line.substring(colonIndex + 2).trim();
			properties[name] = value;
			lineIndex++;
			colonIndex = lines[lineIndex].indexOf(":");
		}

		let entities = [];
		// Parse Entities
		while (lines[lineIndex].startsWith("//")) { // Expect comment giving entity name
			let entity = {};
			entity.name = lines[lineIndex].substring(3).trim(); 
			lineIndex += 1;

			assertLineStartsWith(lines, lineIndex, "{");
			lineIndex += 1;

			// Parse Entity Properties
			while (!lines[lineIndex].startsWith("}") && !lines[lineIndex].startsWith("//")) {
				assertLineStartsWith(lines, lineIndex, '"');
				let propertyData = lines[lineIndex].split('"');
				entity[propertyData[1]] = propertyData[3];
				lineIndex++;
			}

			while (lines[lineIndex].startsWith("//")) {	// Expect comment giving brush name
				// Brushes Incoming!
				let brush = {};
				brush.name = lines[lineIndex].substring(3).trim();
				lineIndex++;
				assertLineStartsWith(lines, lineIndex, "{");
				lineIndex++;
				// Parse Brush Info
				brush.planes = [];
				while (!lines[lineIndex].startsWith("}")) {
					let planeInfo = lines[lineIndex].split(' ');
					let plane = {
						// Note - transforming from quake space x,y,z -> -y, z, -x
						p1: [-parseFloat(planeInfo[2]), parseFloat(planeInfo[3]), -parseFloat(planeInfo[1])],	// 1-> 3
						p2: [-parseFloat(planeInfo[7]), parseFloat(planeInfo[8]), -parseFloat(planeInfo[6])],  // 6 -> 8
						p3: [-parseFloat(planeInfo[12]), parseFloat(planeInfo[13]), -parseFloat(planeInfo[11])], // 11 -> 13
						texture: { 
							name: planeInfo[15],
							xOffset: planeInfo[16],
							yOffset: planeInfo[17],
							angle: planeInfo[18],
							xScale: planeInfo[19],
							yScale: planeInfo[20]
						}
					};
					brush.planes.push(plane);
					lineIndex++;
				}
				if (!entity.brushes) {
					entity.brushes = [];
				}
				entity.brushes.push(brush);
				// Consume brush closing line
				lineIndex++;
				// now expect comment for next brush or close
			}
			// Assert entity close
			assertLineStartsWith(lines, lineIndex, "}"); 
			entities.push(entity);
			lineIndex++;
		}

		// Return Map Object
		return {
			properties: properties,
			entities: entities
		};
	};

	exports.instantiate = (data, scaleFactor, instantiationDelegate) => {
		let playerSpawn = {
			origin: [0, 0, 0],
			angle: 0
		};

		for (let i = 0, l = data.entities.length; i < l; i++) {
			let entity = data.entities[i];
			switch (entity.classname) {
				case "worldspawn":
					instanitateWorldBrushes(entity.brushes, scaleFactor, instantiationDelegate);
					break;
				case "info_player_start":
					parseVector(playerSpawn.origin, entity.origin, scaleFactor);
					playerSpawn.angle = parseFloat(entity.angle);
					break;
			}
		}

		return playerSpawn;
	};

	return exports;
})();


let localX = vec3.create(), localZ = vec3.create();

let lookSpeed = 3.0;
let moveSpeed = 5.0;
let verticalLookAngle = 0;

// Game Loop
let loop = function(elapsed) {
	// Rotation around axis
	let ry = 0, rx = 0;

	if (Fury.Input.keyDown("Left")) {
		ry += lookSpeed * elapsed;
	}
	if (Fury.Input.keyDown("Right")) {
		ry -= lookSpeed * elapsed;
	}
	if (Fury.Input.keyDown("Up")) {
		rx += lookSpeed * elapsed;
	}
	if (Fury.Input.keyDown("Down")) {
		rx -= lookSpeed * elapsed;
	}

	// Directly rotate camera
	Maths.quatRotate(camera.rotation, camera.rotation, ry, Maths.vec3Y);

	let clampAngle = 0.5 * Math.PI - 10 * Math.PI/180;
	let lastVerticalLookAngle = verticalLookAngle;
	verticalLookAngle = Fury.Maths.clamp(verticalLookAngle + rx, -clampAngle, clampAngle);
	quat.rotateX(camera.rotation, camera.rotation, verticalLookAngle - lastVerticalLookAngle);

	let inputX = 0, inputY = 0, inputZ = 0;
	inputZ = Fury.Input.getAxis("s", "w"); // 0.05, Fury.Maths.Ease.inQuad
	inputY = Fury.Input.getAxis("e", "q"); // should be q up e down
	inputX = Fury.Input.getAxis("d", "a"); // 0.05, Fury.Maths.Ease.inQuad
	// Note: Input smoothing removed from Fury 
	// TODO: Input smoother which listens for key presses and then smoothes on press and release
	// accounting for if full press or full release was reached on subsequent releases or presses.
	// or could just use SmoothDamp, c.f. https://github.com/delphic/asteria-combat/commit/f3c3376ab9e54eeba510f7badf1110eb53346c71

	// Calculate local axes for camera - ignoring roll
	// This would be easier with a character transform
	// Wouldn't need to zero the y component
	vec3.transformQuat(localX, Maths.vec3X, camera.rotation);
	vec3.transformQuat(localZ, Maths.vec3Z, camera.rotation);

	if (inputX !== 0 && inputZ !== 0) {
		// Normalize input vector if moving in more than one direction
		// TODO: Adjust for smoothing - i.e. actually normalise
		inputX /= Math.SQRT2;
		inputZ /= Math.SQRT2;
	}

	vec3.scaleAndAdd(camera.position, camera.position, localZ, inputZ * moveSpeed * elapsed);
	vec3.scaleAndAdd(camera.position, camera.position, Maths.vec3Y, inputY * moveSpeed * elapsed);
	vec3.scaleAndAdd(camera.position, camera.position, localX, inputX * moveSpeed * elapsed);

	scene.render();
};


// Asset Loading
let lockCount = 0;
let loadCallback = () => {
	lockCount--;
	if (lockCount <= 0) {
		Fury.GameLoop.init({ loop: loop,  maxFrameTimeMs: 66 });
		Fury.GameLoop.start();
	}
};

let loadMapTextures = function(namedMaterials, texelsPerUnit) {
	let images = [];
	let keys = Object.keys(namedMaterials);
	for (let i = 0, l = keys.length; i < l; i++) {
		lockCount++;
		let textureName = keys[i];
		images[textureName] = new Image();
		images[textureName].onload = function() {
			namedMaterials[textureName].textures["uSampler"] = Fury.Texture.create({
				source: images[textureName],
				quality: "pixel"
			});
			namedMaterials[textureName].sScale *= texelsPerUnit / images[textureName].width;
			namedMaterials[textureName].tScale *= texelsPerUnit / images[textureName].height;

			loadCallback();
		};
		images[textureName].src = textureName + ".png";
	}
};

lockCount++
let mapSrc = "rotated.map"; 
fetch(mapSrc).then(function(response) {
	return response.text();
}).then(function(text) {
	let map = MapLoader.parse(text);

	console.log("Map " + JSON.stringify(map));
 
	let instantiateAABB = (aabb, textureName) => {
		if (!namedMaterials.hasOwnProperty(textureName)) {
			namedMaterials[textureName] = Fury.Material.create({ shader: shader, properties: { tScale: 1, sScale: 1 } });
		}

		createCuboid(
			aabb.xMax - aabb.xMin,
			aabb.yMax - aabb.yMin,
			aabb.zMax - aabb.zMin,
			aabb.xMin + 0.5 * (aabb.xMax - aabb.xMin),
			aabb.yMin + 0.5 * (aabb.yMax - aabb.yMin),
			aabb.zMin + 0.5 * (aabb.zMax - aabb.zMin),
			namedMaterials[textureName]);
	};

	let instantiatePolys = (data) => {
		for (let i = 0, l = data.length; i < l; i++) {
			let textureName = data[i].texture.name;
			if (!namedMaterials.hasOwnProperty(textureName)) {
				namedMaterials[textureName] = Fury.Material.create({ shader: shader, properties: { tScale: 1, sScale: 1 } });
			}
			let material = namedMaterials[textureName];

			// TODO: We should offset the vertices by the poly center for santiy
			// should also generate poly collision shape
			scene.add({ material: material, mesh: Fury.Mesh.create(data[i]), position: vec3.create(), static: true });
		}
	};

	let playerSpawn = MapLoader.instantiate(map, 1/32, instantiatePolys);

	loadMapTextures(namedMaterials, 32);
	lockCount--;
}); /*.catch(function(error) {
	console.log("Failed to load " + mapSrc + ": " + error.message);
}); */

let Plane = (function() {
	let exports = {};

	exports.isPointInFront = function(p, v) {
		let temp = vec3Pool.request();
		vec3.scale(temp, p, p[3]);
		vec3.subtract(temp, v, temp);
		return vec3.dot(temp, p) > 0;
	};

	// takes three planes, returns vec3? representing the point of intersection
	exports.triangulate = function(a, b, c) {
		let edge = vec3Pool.request();

		// calculate edge direction of intersection of planes a and b
		vec3.cross(edge, a, b); 
		// to get an edge direction you just cross the normals 
		// if the length of the vector is approximately 0 they are coplanar

		if (vec3.sqrLen(edge) > 0.000001 && Math.abs(vec3.dot(edge, c)) > 0.001 ) {
			// there is an intersection
			// calculate vector from origin to edge direction
			let point = vec3.create();
			vec3.scaleAndAdd(point, point, a, a[3]);
			vec3.scaleAndAdd(point, point, b, b[3]);
			
			// go from that point along edge direction until it intersects with plane c
			let diff = vec3Pool.request();
			vec3.scale(diff, c, c[3]);
			vec3.subtract(diff, diff, point);
			let distance =  vec3.dot(diff, c) / vec3.dot(edge, c);
			vec3Pool.return(diff);
			vec3Pool.return(edge);

			// write point of intersection into point and return
			return vec3.scaleAndAdd(point, point, edge, distance);
		}
		vec3Pool.return(edge);
		return null;
	};

	// Create a plane from three points
	// returns vec4, where xyz are the plane normal and w is the distance from origin to the plane
	exports.fromPoints = function(p1, p2, p3) {
		let v1 = vec3Pool.request();
		let v2 = vec3Pool.request();
		let normal = vec3Pool.request();
		vec3.subtract(v1, p3, p1);
		vec3.subtract(v2, p2, p1);
		vec3.cross(normal, v1, v2);
		let plane = create(normal, p1);
		vec3Pool.return(v1);
		vec3Pool.return(v2);
		vec3Pool.return(normal);
		return plane;
	};

	// Create a plane from a normal and a point on the plane
	// returns vec4, where xyz are the plane normal and w is the distance from origin to the plane
	let create = exports.create = function(normal, point) {
		let plane = vec4.create();
		vec3.normalize(plane, normal);
		plane[3] = vec3.dot(plane, point);
		return plane;
	};

	return exports;
})();