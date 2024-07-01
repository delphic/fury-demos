const { Maths, Scene, Camera, Input, Shader, GameLoop } = Fury;

// globalize glMatrix
Maths.globalize();

// Init Fury
Fury.init({ canvasId: "fury" });

// Create Camera & Scene
let camera = Camera.create({ 
	near: 0.1,
	far: 1000.0,
	fov: Fury.Maths.toRadian(60),
	ratio: 1.0,
	position: [ 0.0, 1.0, 0.0 ] 
});
let scene = Scene.create({ camera: camera, enableFrustumCulling: true });
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
let shader = Shader.create({
	vsSource: `#version 300 es
uniform mat4 uMMatrix;
uniform mat4 uVMatrix;
uniform mat4 uPMatrix;
uniform float uSScale;
uniform float uTScale;

in vec3 aVertexPosition;
in vec2 aTextureCoord;

out vec2 vTextureCoord;

void main(void) {
	gl_Position = uPMatrix * uVMatrix * uMMatrix * vec4(aVertexPosition, 1.0);
	vTextureCoord = vec2(uSScale * aTextureCoord.s, uTScale * aTextureCoord.t);
}`,
	fsSource: `#version 300 es
precision highp float;

uniform sampler2D uSampler;

in vec2 vTextureCoord;

out vec4 fragColor;

void main(void) {
	fragColor = texture(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
}`,
	attributeNames: [ "aVertexPosition", "aTextureCoord" ],
	uniformNames: [ "uMMatrix", "uVMatrix", "uPMatrix", "uSampler", "uSScale", "uTScale" ],
	textureUniformNames: [ "uSampler" ],
	pMatrixUniformName: "uPMatrix",
	mMatrixUniformName: "uMMatrix",
	vMatrixUniformName: "uVMatrix",
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

// Quick and Dirty .map file loader
// Converts from Quake coordinates to Fury coordinates when parsing 
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

	// take a brush and return an array of polygons,
	// each polygon in Fury mesh config format i.e. array of positions, textureCoordinates, normals, indices
	// with the additional property of "texture" for texture details of the plane
	let parsePolysFromBrush = (brush, scaleFactor) => {
		let result = [];
		let n = brush.planes.length;
		let planes = [];
		for (let i = 0; i < n; i++) {
			let { p1, p2, p3 } = brush.planes[i];
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
					positions: [],
					uvs: [],
					normals: [],
					indices: [],
					texture: texture
				};
				let reverse = false;
				let offset = data.positions.length; // todo: delete this as it's always 0?
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
					data.positions.push(position[0], position[1], position[2]);
					data.uvs.push(uv[0], uv[1]);
					data.normals.push(normal[0], normal[1], normal[2]);
				}
				result.push(data);
			} else {
				console.warn("Generated less than 3 vertices for plane " + i1);
			}
		}
		return result;
	};

	let instanitateWorldBrushes = (brushes, scaleFactor, instantiationDelegate) => {
		let aabb = {};
		for (let i = 0, l = brushes.length; i < l; i++) {
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

	if (Input.keyDown("Left")) {
		ry += lookSpeed * elapsed;
	}
	if (Input.keyDown("Right")) {
		ry -= lookSpeed * elapsed;
	}
	if (Input.keyDown("Up")) {
		rx += lookSpeed * elapsed;
	}
	if (Input.keyDown("Down")) {
		rx -= lookSpeed * elapsed;
	}

	// Directly rotate camera
	Maths.quatRotate(camera.rotation, camera.rotation, ry, Maths.vec3Y);

	let clampAngle = 0.5 * Math.PI - 10 * Math.PI/180;
	let lastVerticalLookAngle = verticalLookAngle;
	verticalLookAngle = Fury.Maths.clamp(verticalLookAngle + rx, -clampAngle, clampAngle);
	quat.rotateX(camera.rotation, camera.rotation, verticalLookAngle - lastVerticalLookAngle);

	let inputX = 0, inputY = 0, inputZ = 0;
	inputZ = Input.getAxis("s", "w");
	inputY = Input.getAxis("e", "q"); 
	inputX = Input.getAxis("d", "a");

	vec3.transformQuat(localX, Maths.vec3X, camera.rotation);
	vec3.transformQuat(localZ, Maths.vec3Z, camera.rotation);

	if (inputX !== 0 && inputZ !== 0) {
		// Normalize input vector if moving in more than one direction
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
		GameLoop.init({ loop: loop,  maxFrameTimeMs: 66 });
		GameLoop.start();
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
 
	let instantiatePolys = (data) => {
		for (let i = 0, l = data.length; i < l; i++) {
			let textureName = data[i].texture.name;
			if (!namedMaterials.hasOwnProperty(textureName)) {
				namedMaterials[textureName] = Fury.Material.create({ shader: shader, properties: { tScale: 1, sScale: 1 } });
			}
			let material = namedMaterials[textureName];

			// TODO: We should offset the vertices by the poly center for santiy
			// TODO: should generate poly collision shape
			scene.add({ material: material, mesh: Fury.Mesh.create(data[i]), position: vec3.create(), static: true });
		}
	};

	let playerSpawn = MapLoader.instantiate(map, 1/32, instantiatePolys);

	loadMapTextures(namedMaterials, 32);
	lockCount--;
}).catch(function(error) {
	console.log("Failed to load " + mapSrc + ": " + error.message);
});

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
		let point = null;
		let edge = vec3Pool.request();

		// calculate edge direction of intersection of planes a and b
		vec3.cross(edge, a, b); 
		// to get an edge direction you just cross the normals 
		// if the length of the vector is approximately 0 they are coplanar

		if (vec3.sqrLen(edge) > 0.000001 && Math.abs(vec3.dot(edge, c)) > 0.001 ) {
			// there is an intersection
			// calculate vector from origin to edge direction
			point = vec3.create();
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
			vec3.scaleAndAdd(point, point, edge, distance);
		}

		vec3Pool.return(edge);
		return point;
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

	// TODO: Match ergonomics of glMatrix, i.e. create() function returns blank
	// and have methods with an out paramter for setting from normal/point or from 3 points

	return exports;
})();