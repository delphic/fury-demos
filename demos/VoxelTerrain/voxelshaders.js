var VoxelShader = (function() {
	var exports = {};

	var shaderSource = {
		vs: function() {
			return [
				"#version 300 es",
				"in vec3 aVertexPosition;",
				"in vec2 aTextureCoord;",
				"in vec3 aVertexNormal;",
				"in float aTileIndex;",

				"uniform mat4 uMVMatrix;",
				"uniform mat4 uPMatrix;",

				//"out vec4 vWorldPosition;",
				"out vec2 vTextureCoord;",
				"out vec3 vNormal;",
				"out float vLightWeight;",
				"out float vTileIndex;",

				"void main(void) {",
					"gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);",
					"vTextureCoord = aTextureCoord;",
					"vNormal = aVertexNormal;",
					"vTileIndex = aTileIndex;",

					// Greedy Meshing - UV generation - artifacts at seams (using padding on the atlas does not help - changing to low (nearest filtering, fixes soo it's mipmaps *still*))
					// Q - can we use more than one sampler?
					// Also of course it's the mips, the seams are because using fract - same problem as when trying to use not texture arrays.
					// Normally would mulitply this by the world / model matrix but as models
					// are all axis aligned and we're going to be using frac value anyway, it's unnecessary
					// "vWorldPosition = vec4(aVertexPosition, 1.0);",

					"vLightWeight = 0.5 + 0.5 * max(dot(aVertexNormal, normalize(vec3(-1.0, 2.0, 1.0))), 0.0);",
				"}"].join('\n');
		},
		fs: function() {
			return [
				"#version 300 es",
				"precision highp float;",
				"precision highp sampler2DArray;",

				"in vec2 vTextureCoord;",
				//"in vec4 vWorldPosition;",
				"in vec3 vNormal;",
				"in float vLightWeight;",
				"in float vTileIndex;",

				"uniform sampler2DArray uSampler;",

				"out vec4 fragColor;",

				"void main(void) {",
						//"vec3 pos = vWorldPosition.xyz;",

						//"vec2 uv = fract(abs(vNormal.x) * pos.zy + abs(vNormal.y) * pos.xz + abs(vNormal.z) * pos.xy);",
						// Using fract results in seams at edges - presumably because the sampled positions are far apart and hence using a different mipmap level

						//"vec2 uv = abs(vNormal.x) * pos.zy + abs(vNormal.y) * pos.xz + abs(vNormal.z) * pos.xy;",
						// Using world position with fract requires not clamp the texture, so tiles with non-symmetical edges bleed e.g. top and bottom of grass tiles. 
						// However this feels good enough to test a greedy meshing algorithm (especially with 8x upscale)

						//"vec4 color = texture(uSampler, vec3(uv, vTileIndex));",
						// Could 'solve' this in greedy geometry generation,
						// e.g. sub-divide tiles without symmetry or use generate all quads for non-symmetrical and use shader with fract value.
						// Or we could 'solve it' by finding a way to use nearset on MAG and MIPS on far
						// could also 'solve it' by not having non-symmetrical tiles, i.e. have grass sides be grass all the way down
						
						// Further experimentation, NEAREST MAG + MIP MIN work as long as ansio extension is not used, however this extension is needed for large distances
						// Finding some way to blend between two different samplers on the same uploaded texture based on depth might work.

						"vec4 color = texture(uSampler, vec3(vTextureCoord, vTileIndex));",
						// Just using UVs when everything is a quad obviously works fine but that's a lot of geometry, especially from transparent quads

						"fragColor = vec4(vLightWeight * color.rgb, color.a);",
				"}"].join('\n');
			}
	};

	exports.create = function() {
		var vsSource = shaderSource.vs();
		var fsSource = shaderSource.fs();

		var shader = {
			vsSource: vsSource,
			fsSource: fsSource,
				attributeNames: [ "aVertexPosition", "aVertexNormal", "aTextureCoord", "aTileIndex" ],
				uniformNames: [ "uMVMatrix", "uPMatrix", "uSampler" ],
				textureUniformNames: [ "uSampler" ],
				pMatrixUniformName: "uPMatrix",
				mvMatrixUniformName: "uMVMatrix",
				bindMaterial: function(material) {
					this.enableAttribute("aVertexPosition");
					this.enableAttribute("aTextureCoord");
					this.enableAttribute("aVertexNormal");
					this.enableAttribute("aTileIndex");
				},
				bindBuffers: function(mesh) {
					this.setAttribute("aVertexPosition", mesh.vertexBuffer);
					this.setAttribute("aTextureCoord", mesh.textureBuffer);
					this.setAttribute("aVertexNormal", mesh.normalBuffer);
					this.setAttribute("aTileIndex", mesh.tileBuffer);
					this.setIndexedAttribute(mesh.indexBuffer);
				}
		};
		return shader;
	};
	return exports;
})();
