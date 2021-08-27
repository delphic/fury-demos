"use strict";

// Voxel Terrain Generator
// Multiple Octaves of Perlin Noise -> Cubes

var $ = window.$;
var Fury = window.Fury;
var VorldConfig = window.VorldConfig;
var VoxelShader = window.VoxelShader;
// globalize glMatrix
Fury.Maths.globalize();

var resolutionFactor = 1; // Lower this for low-spec devices
var cameraRatio = 16 / 9;
var updateCanvasSize = function() {
	// Remove any scaling of width / height as a result of using CSS to size the canvas
	var glCanvas = document.getElementById("fury");
	glCanvas.width = resolutionFactor * glCanvas.clientWidth;
	glCanvas.height = resolutionFactor * glCanvas.clientHeight;
	cameraRatio = glCanvas.clientWidth / glCanvas.clientHeight;
	if (camera && camera.ratio) {
		camera.ratio = cameraRatio;
	}
};
$(window).resize(function(){
	updateCanvasSize();
});
updateCanvasSize();

Fury.init("fury");
var Input = Fury.Input;

var shader = Fury.Shader.create(VoxelShader.create());

var atlasMaterial = Fury.Material.create({ shader: shader });
// Use upscaled texture to allow for reasonable resolution closeup
// when using mipmaps to prevent artifacts at distance.

// Regeneration Variables and form details
var neutralNoise = true; // Is noise between -0.5 and +0.5 or between 0 and 1
var areaHeight = 4, areaExtents = 6;
var octaves = [], numOctaves = 4;
var octaveWeightings = [ 0.5, 0.5, 1, 0.1 ];
var perlin = true;
var seedString = "XUVNREAZOZJFPQMSAKEMSDJURTQPWEORHZMD";

var shapingFunction = "inverse_y";
var adjustmentFactor = 0.01, yOffset = 0; // Shaping Function
var amplitude = 64, sdx = 64, sdz = 64, yDenominator = 16.0;

var baseWavelength = 128;
var getGenerationVariables = function() {
	octaves.length = 0;
	octaveWeightings.length = 0;
	numOctaves = parseInt($("#octaves").val(),10);
	for(var i = 0; i < numOctaves; i++) {
		octaveWeightings.push(parseFloat($("#ow"+i).val()));
	}
	perlin = $("input[name='noiseType']:checked").val() == "Perlin";
	seedString = $("#seed").val();
	neutralNoise = $("#neutralNoise").val() == "neutral";

	baseWavelength = parseInt($("#baseWavelength").val(), 10);
	areaExtents = parseInt($("#extents").val(), 10);	
	areaHeight = parseInt($("#height").val(), 10);

	shapingFunction = $("#shapingFunction").val();
	if (shapingFunction == "inverse_y") {
		yOffset = parseFloat($("#yOffset").val());
		adjustmentFactor = 1 / parseFloat($("#adjust").val());  // TODO: Change the internal function to m / (y + offset)
	} else if (shapingFunction == "negative_y") {
		yOffset = parseFloat($("#yOffset_n").val());
		yDenominator = parseFloat($("#yDenominator_n").val());
	} else if (shapingFunction == "gaussian") {
		yDenominator = parseFloat($("#yDenominator_g").val());
		amplitude = parseFloat($("#amplitude").val());
		sdx = parseFloat($("#sdx").val());
		sdz = parseFloat($("#sdz").val());
	}
};

var setParameterVisibility = function(shapingFunction) {
	switch(shapingFunction){
		case "inverse_y":
			$("#inverse_y").show();
			$("#negative_y").hide();
			$("#gaussian").hide();
			break;
		case "negative_y":
			$("#inverse_y").hide();
			$("#negative_y").show();
			$("#gaussian").hide();
			break;
		case "gaussian":
			$("#inverse_y").hide();
			$("#negative_y").hide();
			$("#gaussian").show();
			break;
		default:
			$("#inverse_y").hide();
			$("#negative_y").hide();
			$("#gaussian").hide();
			break;
	}
};

$(document).ready(function(){
	$("#showGenerationForm").click(function() {
		$("#generationForm").show();
		$("#showGenerationForm").hide();
	});
	$("#hideGenerationForm").click(function() {
		$("#generationForm").hide();
		$("#showGenerationForm").show();
	});
	$("#hideControls").click(function() {
		$("#controls").hide();
	});
	$("#octaves").change(function(event){
		$("#octavesDisplay").html(this.value);
		var html = "";
		for(var i = 0; i < this.value; i++) {
			var value = i < octaveWeightings.length ? octaveWeightings[i] : 1 / (1 + i);
			html += "<input id=\"ow"+i+"\" type=\"number\" value=\"" + value + "\" />";
		}
		$("#weightingsContainer").html(html);
	});
	$("#wavelengthPower").change(function(event){
		var power = parseInt(this.value, 10);
		$("#baseWavelength").val(Math.pow(2, power));
	});
	$("#regen").click(function(event){
		getGenerationVariables();
		
		let chunkLimit = 4225; 
		// Semi-arbitary number determined by testing with height 1 up to extents of 32
		// Using 1 octave of noise at wavelength 2 - as this is close to worse case mesh complexity.
		// Generated meshes will vary in complexity, depending on noise settings and shaping function.
		// e.g. if the shaping function culls most of the data, this number is over-zealous.
		// Also if using larger octaves of noise large areas will be blank, and this limit over-zealous. 
		let chunksToGenerate = (2 * areaExtents + 1) * (2 * areaExtents + 1) * areaHeight;
		let showWarning = chunksToGenerate > chunkLimit;
		let warningText;
		if (showWarning) {
			if (chunksToGenerate > 4 * chunkLimit) {
				warningText = "This will attempt to generate and display " + chunksToGenerate + " chunks, this likely to cause the tab to run out of memory regardless of generation settings, do you wish to proceed?"
			} else if (chunksToGenerate > 2 * chunkLimit) {
				warningText = "This will attempt to generate and display " + chunksToGenerate + " chunks, depending on generation settings this could to cause the tab to run out of memory, do you wish to proceed?";
			} else {
				warningText = "This will attempt to generate and display " + chunksToGenerate + " chunks, for 'noisy' generation settings this could cause the tab to run out of memeory, do you wish to proceed?";
			}
		}
		if (!showWarning || confirm(warningText)) {
			$("#generationForm").hide();
			$("#showGenerationForm").show();
			$("#progressDisplay").show();
			$("#generationParameters").hide();

			clear();
			generateVorld();
		}
	});
	$("#shapingFunction").change(function(event){
		setParameterVisibility(this.value);
	});

	// Set initial values
	$("#octaves").val(numOctaves);
	var html = "";
	for(var i = 0; i < octaveWeightings.length; i++) {
		html += "<input id=\"ow"+i+"\" type=\"number\" value=\"" + octaveWeightings[i] + "\" />";
	}
	$("#weightingsContainer").html(html);
	$("#seed").val(seedString);

	$("#neutralNoise").val(neutralNoise ? "neutral": "normalised");

	$("#wavelengthPower").val(7);
	$("#baseWavelength").val(baseWavelength);
	$("#extents").val(areaExtents);
	$("#height").val(areaHeight);

	$("#shapingFunction").val(shapingFunction);
	setParameterVisibility(shapingFunction);
	$("#yOffset").val(yOffset);
	$("#adjust").val(100);

	$("#yOffset_n").val(32);
	$("#yDenominator_n").val(16);

	$("#yDenominator_g").val(yDenominator);
	$("#amplitude").val(amplitude);
	$("#sdx").val(sdx);
	$("#sdz").val(sdz);
});

// Create Camera & Scene
var rotateRate = 0.1 * Math.PI, maxRotatePerFrame = 0.2 * rotateRate;
var zoomRate = 16;
var camera = Fury.Camera.create({
	near: 0.1,
	far: 1000000.0,
	fov: 1.0472,
	ratio: cameraRatio,
	position: vec3.fromValues(53.0, 55.0, 123.0),
	rotation: quat.fromValues(-0.232, 0.24, 0.06, 0.94)
});
var scene = Fury.Scene.create({ camera: camera, enableFrustumCulling: true });

var lastTime = Date.now();

var clear = function() {
	Vorld.clear(vorld);
	scene.clear();
	Fury.Scene.clearResources();
};

var awake = function() {
	// Note this needs to happen after materials loaded so that when they are copied the textures have loaded.
	// Perhaps textures should be stored at the Fury (Fury.Engine) level and thus loading callbacks will provide the texture to all materials
	// who have that texture id and this will work even if they've been copied prior to texture load
	// More sensible would giving Fury this awake / update functionality so we don't need to write it each time.
	generateVorld();
	loop();
};

let WorkerPool = (function() {
	let exports = {};

	let prototype = {
		maxWorkers: 8,
		isWorkerAvailable: function() {
			return this.inUseWorkerCount < this.maxWorkers;
		},
		requestWorker: function() {
			if (this.workerSrc) {
				for (let i = 0; i < this.maxWorkers; i++) {
					if (!this.workerInUse[i]) {
						if (!this.workers[i]) {
							this.workers[i] = new Worker(this.workerSrc);
							this.workers[i].workerIndex = i;
						}
						this.workerInUse[i] = true;
						this.inUseWorkerCount++;
						return this.workers[i];
					}
				}
			}
			return null;
		},
		returnWorker: function(worker) {
			this.workerInUse[worker.workerIndex] = false;
			this.inUseWorkerCount--;
		}
	};

	exports.create = function(config) {
		let pool = Object.create(prototype);
		pool.workerSrc = config.src;
		if (config.maxWorkers) pool.maxWorkers = config.maxWorkers;
		pool.inUseWorkerCount = 0;
		pool.workers = [];
		pool.workerInUse = [];

		return pool;
	};

	return exports;
})();

let generatorPool = WorkerPool.create({ src: 'generator.js', maxWorkers: 8 });
let mesherPool =  WorkerPool.create({ src: 'mesher.js', maxWorkers: 4 });

let vorld = Vorld.create({ chunkSize: 16 }); // Amalgamated Vorld Data

var generateVorld = function() {
	let startTime = Date.now();
	$("#progressStage").html("Generating Voxel Data");
	$("#progressBarInner").width("0%");

	let subsectionSize = 1;
	let generatedSubsections = 0;
	let totalToSubsectionsGenerate = Math.ceil((2 * areaExtents + 1) / subsectionSize) * Math.ceil((2 * areaExtents + 1) / subsectionSize);
	let generatedChunks = 0;
	let totalChunksToGenerate = (2 * areaExtents + 1) * (2 * areaExtents + 1) * areaHeight;

	let createGeneratorWorker = function(iMin, iMax, kMin, kMax, callback) {
		var generator = generatorPool.requestWorker();
		generator.onmessage = function(e) {
			if (e.data.stage) {
				$("#progressStage").html(e.data.stage);
			}
	
			if (e.data.progress !== undefined) {
				if (e.data.progress) {
					generatedChunks++;
				}
				$("#progressBarInner").width((generatedChunks / totalChunksToGenerate) * 100 + "%");
			}
	
			if (e.data.complete) {
				generatorPool.returnWorker(generator);
				callback(e.data.vorld); // TODO: rename chunkData as that's what it is, not full vorld? (although it does follow vorld format)
			}
		};
		generator.postMessage({
			seed: seedString,
			chunkSize: vorld.chunkSize,
			numOctaves: numOctaves,
			octaveWeightings: octaveWeightings,
			perlin: perlin,
			baseWavelength: baseWavelength,
			iMin: iMin,
			iMax: iMax,
			kMin: kMin,
			kMax: kMax,
			areaHeight: areaHeight,
			shapingFunction: shapingFunction,	// TODO: take shapingFunction Object
			adjustmentFactor: adjustmentFactor,
			yOffset: yOffset,
			amplitude: amplitude,
			sdx: sdx,
			sdz: sdz,
			yDenominator: yDenominator,
			neutralNoise: neutralNoise
		});
	};

	let i = -areaExtents, k = -areaExtents;

	let workerCompleteCallback = (chunkData) => {
		generatedSubsections++;
		tryCreateNextWorker(); 
		// Does this increase stack size or are we fine? If it does might need to use requestAnimationFrame
		// Or just queue up the requests on the pool
		if (!Vorld.tryMerge(vorld, chunkData)) {
			console.log("Unable to merge chunk data into main vorld instance");
		}

		if (generatedSubsections >= totalToSubsectionsGenerate) {
			console.log("----- Data Generation -----");
			console.log("Generated Chunks: " + generatedChunks + " / " + totalChunksToGenerate);
			console.log("Generated Sections: " + generatedSubsections + " / " + totalToSubsectionsGenerate);
			console.log("Generation Time: " + (Date.now() - startTime));
			generateMeshes(vorld);
		}
	}; 

	let tryCreateNextWorker = () => {
		if (i <= areaExtents && k <= areaExtents) {
			createGeneratorWorker(i, Math.min(i + subsectionSize - 1, areaExtents), k, Math.min(k + subsectionSize - 1, areaExtents), workerCompleteCallback);
			k += subsectionSize;
			if (k > areaExtents) {
				k = -areaExtents;
				i += subsectionSize;
			}
			return true;
		}
		return false;
	};

	// Create initial workers
	while (generatorPool.isWorkerAvailable() && tryCreateNextWorker()) { }
};

var generateMeshes = function(vorld) {
	let startTime = Date.now();
	let generatedMeshPositions = {}; // Sanity check on mesh generation

	$("#progressStage").html("Generating Meshes");
	$("#progressBarInner").width("0%");

	// Duplicated from chunk generation
	let subsectionSize = 4;
	let generatedSubsections = 0;
	let totalToSubsectionsGenerate = Math.ceil((2 * areaExtents + 1) / subsectionSize) * Math.ceil((2 * areaExtents + 1) / subsectionSize);
	let generatedChunks = 0;
	let generatedMeshCount = 0;
	let totalChunksToGenerate = (2 * areaExtents + 1) * (2 * areaExtents + 1) * areaHeight;

	let createMesherWorker = function(iMin, iMax, kMin, kMax, callback) {
		// Increase size to include adjancy info
		let chunkData = Vorld.createSlice(vorld, iMin - 1, iMax + 1, 0, areaHeight - 1, kMin - 1, kMax + 1);

		let mesher = mesherPool.requestWorker();
		mesher.onmessage = function(e) {
			if (e.data.mesh) {
				generatedMeshCount++;
				let mesh = Fury.Mesh.create(e.data.mesh);
				mesh.tileBuffer = Fury.Renderer.createBuffer(e.data.mesh.tileIndices, 1);
				// TODO: Use customBuffer parameter - will require update to shader see model demo for reference
	
				let key = e.data.offset[0] + "_" + e.data.offset[1] + "_" + e.data.offset[2];
				if (generatedMeshPositions[key]) {
					console.error("Generated more than one mesh for " + key);
				} else {
					generatedMeshPositions[key] = true;
				}
	
				scene.add({ mesh: mesh, material: atlasMaterial, position: vec3.clone(e.data.offset), static: true });
			}
			if (e.data.progress !== undefined) {
				if (e.data.progress) {
					generatedChunks++;
				}
				$("#progressBarInner").width(((generatedChunks / totalChunksToGenerate)  * 100) + "%");
			}
			if (e.data.complete) {
				mesherPool.returnWorker(mesher);
				callback();
			}
		};
		mesher.postMessage({
			chunkData: chunkData,
			bounds: {
				iMax: iMax,
				iMin: iMin,
				jMax: areaHeight - 1,
				jMin: 0,
				kMax: kMax,
				kMin: kMin
			}
		});
	};

	let i = -areaExtents, k = -areaExtents;

	let workerCompleteCallback = () => {
		generatedSubsections++;
		tryCreateNextWorker(); 
		// Does this increase stack size or are we fine? If it does might need to use requestAnimationFrame
		// Or just queue up the requests on the pool

		if (generatedSubsections >= totalToSubsectionsGenerate) {
			console.log("----- Mesh Generation -----");
			console.log("Evaluated Sections: " + generatedSubsections + " / " + totalToSubsectionsGenerate);
			console.log("Evaluated Chunks: " + generatedChunks + " / " + totalChunksToGenerate);
			console.log("Generated Meshes: " + generatedMeshCount);
			console.log("Mesh Generation Time: " + (Date.now() - startTime));

			$("#progressDisplay").hide();
			$("#generationParameters").show();
		}
	}; 

	let tryCreateNextWorker = () => {
		if (i <= areaExtents && k <= areaExtents) {
			createMesherWorker(i, Math.min(i + subsectionSize - 1, areaExtents), k, Math.min(k + subsectionSize - 1, areaExtents), workerCompleteCallback);
			k += subsectionSize;
			if (k > areaExtents) {
				k = -areaExtents;
				i += subsectionSize;
			}
			return true;
		}
		return false;
	};

	// Create initial workers
	while (mesherPool.isWorkerAvailable() && tryCreateNextWorker()) { }

	// Out of memory crashes for sufficently large extents
	// https://stackoverflow.com/questions/17491022/max-memory-usage-of-a-chrome-process-tab-how-do-i-increase-it
	// TODO: Investigate if can be overriden for electron apps. 
	// Also investigate if we're cleaning up after ourselves properly or we have hanging references
};

var framesInLastSecond = 0;
var timeSinceLastFrame = 0;

var loop = function(){
	var elapsed = Date.now() - lastTime;
	lastTime += elapsed;
	elapsed /= 1000;

	timeSinceLastFrame += elapsed;
	framesInLastSecond++;
	if(timeSinceLastFrame >= 1)
	{
		// This is where you'd set the value in an FPS counter, if there was one
		framesInLastSecond = 0;
		timeSinceLastFrame = 0;
	}
	handleInput(elapsed);
	scene.render();
	window.requestAnimationFrame(loop);
};

var localx = vec3.create();
var localy = vec3.create();
var localz = vec3.create();

// https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
var getRoll = function(q) {
	// Note: glMatrix is x,y,z,w where as wiki assumes w,x,y,z!
	let sinr_cosp = 2 * (q[3] * q[0] + q[1] * q[2]);
	let cosr_cosp = 1 - 2 * (q[0] * q[0] + q[1] * q[1]);
	return Math.atan(sinr_cosp / cosr_cosp);
	// If you want to know sector you need atan2(sinr_cosp, cosr_cosp)
	// but we don't in this case.
};

var handleInput = function(elapsed) {
	var q = camera.rotation;
	var p = camera.position;
	Fury.Maths.quatLocalAxes(q, localx, localy, localz);
	
	if (Input.mouseDown(2)) {
		let xRotation = Input.MouseDelta[0] * rotateRate*elapsed;
		if (Math.abs(xRotation) > maxRotatePerFrame) {
			xRotation = Math.sign(xRotation) * maxRotatePerFrame;
		}
		let yRotation = Input.MouseDelta[1] * rotateRate*elapsed;
		if (Math.abs(yRotation) > maxRotatePerFrame) {
			yRotation = Math.sign(yRotation) * maxRotatePerFrame;
		}
		Fury.Maths.quatRotate(q, q, -xRotation, Fury.Maths.vec3Y);

		let roll = getRoll(q);
		let clampAngle = 10 * Math.PI/180;
		if (Math.sign(roll) == Math.sign(yRotation) || Math.abs(roll - yRotation) < 0.5*Math.PI - clampAngle) {
			quat.rotateX(q, q, -yRotation);
		}
	}

	if(Input.keyDown("w")) {
		vec3.scaleAndAdd(p, p, localz, -zoomRate*elapsed);
	}
	if(Input.keyDown("s")) {
		vec3.scaleAndAdd(p, p, localz, zoomRate*elapsed);
	}
	if(Input.keyDown("a")) {
		vec3.scaleAndAdd(p, p, localx, -zoomRate*elapsed);
	}
	if(Input.keyDown("d")) {
		vec3.scaleAndAdd(p, p, localx, zoomRate*elapsed);
	}
	if (Input.keyDown("q")) {
		vec3.scaleAndAdd(p, p, localy, -zoomRate*elapsed);
	}
	if (Input.keyDown("e")) {
		vec3.scaleAndAdd(p, p, localy, zoomRate*elapsed);
	}

	Input.handleFrameFinished();
};

// Create Upscaled Texture
let image = new Image();
image.onload = function() {
	let upscaled = Fury.Utils.createScaledImage({ image: image, scale: 8 });
	let textureSize = upscaled.width, textureCount = Math.round(upscaled.height / upscaled.width);
	let textureArray = Fury.Renderer.createTextureArray(upscaled, textureSize, textureSize, textureCount, "pixel", true);
	atlasMaterial.setTexture(textureArray);
	awake();
};
image.src = "atlas_array.png";
