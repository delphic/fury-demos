// Voxel Mesher

// Data is meshed by adding quads for each visible voxel face to a mesh
// One mesh per cubic 'chunk' of voxels.
// Uses texture coordinates and an atlas to allow for multiple voxel types in
// a single texture.
// Has option of outputing texture coordinates as a tile lookup rather than uv mapping

// TODO: Separate Mesher logic from worker logic (so that can be done sync or async)
importScripts('vorld.js');

// Basic Cube Geometry JSON
var cubeJson = {
	positions: [ 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0 ],
	normals: [ 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0],
	uvs: [ 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0 ],
	indices: [ 0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23 ]
};

var cubeFaces = {
	front: 0,
	back: 1,
	top: 2,
	bottom: 3,
	right: 4,
	left: 5
};

// Atlas Info
var atlas = VorldConfig.getAtlasInfo();

var buildMesh = function(vorld, chunkI, chunkJ, chunkK) {
	var mesh = {
		positions: [],
		normals: [],
		uvs: [],
		indices: []
	};

	var chunk = Vorld.getChunk(vorld, chunkI, chunkJ, chunkK);

	forEachBlock(chunk, function(block, i, j, k, x, y, z) {
		// Exists?
		if(!block) { return; }

		// For Each Direction : Is Edge? Add quad to mesh!
		// Front
		if(!Vorld.getBlockByIndex(vorld, i, j, k+1, chunkI, chunkJ, chunkK)) {
			addQuadToMesh(mesh, block, cubeFaces.front, x, y, z);
		}
		// Back
		if(!Vorld.getBlockByIndex(vorld, i, j, k-1, chunkI, chunkJ, chunkK)){
			addQuadToMesh(mesh, block, cubeFaces.back, x, y, z);
		}
		// Top
		if(!Vorld.getBlockByIndex(vorld, i, j+1, k, chunkI, chunkJ, chunkK)){
			addQuadToMesh(mesh, block, cubeFaces.top, x, y, z);
		}
		// Bottom
		if(!Vorld.getBlockByIndex(vorld, i, j-1, k, chunkI, chunkJ, chunkK)){
			addQuadToMesh(mesh, block, cubeFaces.bottom, x, y, z);
		}
		// Right
		if(!Vorld.getBlockByIndex(vorld, i+1, j, k, chunkI, chunkJ, chunkK)){
			addQuadToMesh(mesh, block, cubeFaces.right, x, y, z);
		}
		// Left
		if(!Vorld.getBlockByIndex(vorld, i-1, j, k, chunkI, chunkJ, chunkK)){
			addQuadToMesh(mesh, block, cubeFaces.left, x, y, z);
		}
	});

	return mesh;
};

var addQuadToMesh = function(mesh, block, faceIndex, x, y, z) {
	var tile, offset, n = mesh.positions.length / 3;
	var positions, normals, uvs;

	if(faceIndex == cubeFaces.top) {
		tile = (atlas.arraySize - 1) - atlas.tileIndices[block].top;
	} else if (faceIndex == cubeFaces.bottom) {
		tile = (atlas.arraySize - 1) - atlas.tileIndices[block].bottom;
	} else {
		tile = (atlas.arraySize - 1) - atlas.tileIndices[block].side;
	}

	offset = faceIndex * 12;
	positions = cubeJson.positions.slice(offset, offset + 12);
	for(var i = 0; i < 4; i++) {
		positions[3*i] = positions[3*i] + x;
		positions[3*i + 1] = positions[3*i +1] + y;
		positions[3*i + 2] = positions[3*i + 2] + z;
	}

	normals = cubeJson.normals.slice(offset, offset + 12);

	offset = faceIndex * 8;
	uvs = cubeJson.uvs.slice(offset, offset + 8);

	if (!mesh.tileIndices) {
		mesh.tileIndices = [];
	}
	tileIndices = [ tile, tile, tile, tile ];

	concat(mesh.positions, positions);
	concat(mesh.normals, normals);
	concat(mesh.uvs, uvs);
	concat(mesh.tileIndices, tileIndices);
	mesh.indices.push(n,n+1,n+2, n,n+2,n+3);
};

var concat = function(a, b) {
	// GC efficient concat
	for(var i = 0, l = b.length; i < l; i++) {
		a.push(b[i]);
	}
};

// delegate should be a function taking block, i, j, k, x, y, z
var forEachBlock = function(chunk, delegate) {
	for(i = 0; i < chunk.size; i++) {
		x = i - Math.floor(chunk.size/2.0);
		for(j = 0; j < chunk.size; j++) {
			y = j - Math.floor(chunk.size/2.0);
			for(k = 0; k < chunk.size; k++) {
				z = k - Math.floor(chunk.size/2.0);
				delegate(Chunk.getBlock(chunk, i, j, k), i, j, k, x, y, z);
			}
		}
	}
};

onmessage = function(e) {
	let vorld = e.data.chunkData;
	let bounds = e.data.bounds;

	let count = 0;
	let totalRange = (bounds.iMax - bounds.iMin + 1) * (bounds.jMax - bounds.jMin + 1) * (bounds.kMax - bounds.kMin + 1);

	for (let i = bounds.iMin; i <= bounds.iMax; i++) {
		for (let j = bounds.jMin; j <= bounds.jMax; j++) {
			for (let k = bounds.kMin; k <= bounds.kMax; k++) {
				count++;
				let chunk = Vorld.getChunk(vorld, i, j, k);
				if (chunk) {
				  let indices = chunk.indices;
				  let mesh = buildMesh(vorld, indices[0], indices[1], indices[2]);
				  if (mesh.indices.length > 0) {
					  this.postMessage({
						  mesh: mesh,
						  offset: [indices[0] * vorld.chunkSize, indices[1] * vorld.chunkSize, indices[2] * vorld.chunkSize],
						  progress: count / totalRange
					  });
				  } else {
					  this.postMessage({ progress: count / totalRange });
				  }
				} else {
					this.postMessage({ progress: count / totalRange });
				}
			}
		}
	}
	postMessage({ complete: true });
};
