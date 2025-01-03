// Voxel Terrain Generator
// Multiple Octaves of Perlin Noise -> Cubes

// globalize glMatrix
Fury.Maths.globalize();

let resolutionFactor = 1; // Lower this for low-spec devices
let cameraRatio = 16 / 9;
let camera = null;
let updateCanvasSize = function() {
	// Remove any scaling of width / height as a result of using CSS to size the canvas
	let glCanvas = document.getElementById("fury");
	glCanvas.width = resolutionFactor * glCanvas.clientWidth;
	glCanvas.height = resolutionFactor * glCanvas.clientHeight;
	cameraRatio = glCanvas.clientWidth / glCanvas.clientHeight;
	if (camera && camera.ratio) {
		camera.ratio = cameraRatio;
	}
};
window.addEventListener("resize", updateCanvasSize);
updateCanvasSize();

Fury.init("fury");
let Input = Fury.Input;

let shader = Fury.Shader.create(VoxelShader.create());

let atlasMaterial = Fury.Material.create({ shader: shader });
// Use upscaled texture to allow for reasonable resolution closeup
// when using mipmaps to prevent artifacts at distance.

// Regeneration Variables and form details
let neutralNoise = true; // Is noise between -0.5 and +0.5 or between 0 and 1
let areaHeight = 4, areaExtents = 6;
let octaves = [], numOctaves = 4;
let octaveWeightings = [ 0.5, 0.5, 1, 0.1 ];
let perlin = true;
let seedString = "XUVNREAZOZJFPQMSAKEMSDJURTQPWEORHZMD";

let shapingFunction = "inverse_y";
let adjustmentFactor = 0.01, yOffset = 0; // Shaping Function
let amplitude = 64, sdx = 64, sdz = 64, yDenominator = 16.0;

let baseWavelength = 128;

let val = (id, value) => {
	if (value !== undefined) {
		document.getElementById(id).value = value;
		return value;
	} else {
		return document.getElementById(id).value;
	}
};

let show = (id) => {
	document.getElementById(id).style.display = '';
};

let hide = (id) => {
	document.getElementById(id).style.display = 'none';
};

let getGenerationVariables = function() {
	
	octaves.length = 0;
	octaveWeightings.length = 0;
	numOctaves = parseInt(val("octaves"),10);
	for(let i = 0; i < numOctaves; i++) {
		octaveWeightings.push(parseFloat(val("ow"+i)));
	}
	perlin = document.querySelector("input[name='noiseType']:checked").value == "Perlin";
	seedString = val("seed");
	neutralNoise = val("neutralNoise") == "neutral";

	baseWavelength = parseInt(val("baseWavelength"), 10);
	areaExtents = parseInt(val("extents"), 10);	
	areaHeight = parseInt(val("height"), 10);

	shapingFunction = val("shapingFunction");
	if (shapingFunction == "inverse_y") {
		yOffset = parseFloat(val("yOffset"));
		adjustmentFactor = 1 / parseFloat(val("adjust"));  // TODO: Change the internal function to m / (y + offset)
	} else if (shapingFunction == "negative_y") {
		yOffset = parseFloat(val("yOffset_n"));
		yDenominator = parseFloat(val("yDenominator_n"));
	} else if (shapingFunction == "gaussian") {
		yDenominator = parseFloat(val("yDenominator_g"));
		amplitude = parseFloat(val("amplitude"));
		sdx = parseFloat(val("sdx"));
		sdz = parseFloat(val("sdz"));
	}
};

let setParameterVisibility = function(shapingFunction) {
	switch(shapingFunction){
		case "inverse_y":
			show("inverse_y");
			hide("negative_y");
			hide("gaussian");
			break;
		case "negative_y":
			hide("inverse_y");
			show("negative_y");
			hide("gaussian");
			break;
		case "gaussian":
			hide("inverse_y");
			hide("negative_y");
			show("gaussian");
			break;
		default:
			hide("inverse_y");
			hide("negative_y");
			hide("gaussian");
			break;
	}
};

document.addEventListener("DOMContentLoaded", function(){
	document.getElementById("showGenerationForm").addEventListener("click", function() {
		show("generationForm");
		hide("showGenerationForm");
	});
	document.getElementById("hideGenerationForm").addEventListener("click", function() {
		hide("generationForm");
		show("showGenerationForm");
	});
	document.getElementById("hideControls").addEventListener("click", function() {
		hide("controls");
	});

	hide("generationParameters");
	hide("generationForm");

	let octavesElement = document.getElementById("octaves");
	octavesElement.addEventListener("change", function(event){
		document.getElementById("octavesDisplay").innerHTML = octavesElement.value;
		let html = "";
		for(let i = 0; i < this.value; i++) {
			let value = i < octaveWeightings.length ? octaveWeightings[i] : 1 / (1 + i);
			html += "<input id=\"ow"+i+"\" type=\"number\" value=\"" + value + "\" />";
		}
		document.getElementById("weightingsContainer").innerHTML = html;
	});
	let wavelengthPowerElement = document.getElementById("wavelengthPower");
	wavelengthPowerElement.addEventListener("change", function(event){
		let power = parseInt(wavelengthPowerElement.value, 10);
		document.getElementById("baseWavelength").value = Math.pow(2, power);
	});
	document.getElementById("regen").addEventListener("click", function(event){
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
			hide("generationForm");
			show("showGenerationForm");
			show("progressDisplay");
			hide("generationParameters");

			clear();
			generateVorld();
		}
	});
	let shapingFunctionElement = document.getElementById("shapingFunction");
	shapingFunctionElement.addEventListener("change", function(event){
		setParameterVisibility(shapingFunctionElement.value);
	});

	// Set initial values
	val("octaves", numOctaves);
	let html = "";
	for(let i = 0; i < octaveWeightings.length; i++) {
		html += "<input id=\"ow"+i+"\" type=\"number\" value=\"" + octaveWeightings[i] + "\" />";
	}
	document.getElementById("weightingsContainer").innerHTML = html;
	val("seed", seedString);

	val("neutralNoise", neutralNoise ? "neutral": "normalised");

	val("wavelengthPower", 7);
	val("baseWavelength", baseWavelength);
	val("extents", areaExtents);
	val("height", areaHeight);

	val("shapingFunction", shapingFunction);
	setParameterVisibility(shapingFunction);
	val("yOffset", yOffset);
	val("adjust", 100);

	val("yOffset_n", 32);
	val("yDenominator_n", 16);

	val("yDenominator_g", yDenominator);
	val("amplitude", amplitude);
	val("sdx", sdx);
	val("sdz", sdz);
});

// Create Camera & Scene
let rotateRate = 0.1 * Math.PI, maxRotatePerFrame = 0.2 * rotateRate;
let zoomRate = 16;
camera = Fury.Camera.create({
	near: 0.1,
	far: 1000000.0,
	fov: 1.0472,
	ratio: cameraRatio,
	position: vec3.fromValues(53.0, 55.0, 123.0),
	rotation: quat.fromValues(-0.232, 0.24, 0.06, 0.94)
});
let scene = Fury.Scene.create({ camera: camera, enableFrustumCulling: true });

let lastTime = Date.now();

let clear = function() {
	Vorld.clear(vorld);
	scene.clear();
	Fury.Scene.clearResources();
};

let awake = function() {
	// Note this needs to happen after materials loaded so that when they are copied the textures have loaded.
	// Perhaps textures should be stored at the Fury (Fury.Engine) level and thus loading callbacks will provide the texture to all materials
	// who have that texture id and this will work even if they've been copied prior to texture load
	// More sensible would giving Fury this awake / update functionality so we don't need to write it each time.
	generateVorld();
	loop();
};

let generatorPool = Fury.WorkerPool.create({ src: 'generator.js', maxWorkers: 8 });
let mesherPool =  Fury.WorkerPool.create({ src: 'mesher.js', maxWorkers: 4 });

let vorld = Vorld.create({ chunkSize: 16 }); // Amalgamated Vorld Data

let generateVorld = function() {
	let startTime = Date.now();
	document.getElementById("progressStage").innerHTML = "Generating Voxel Data";
	document.getElementById("progressBarInner").style.width = "0%";

	let subsectionSize = 1;
	let generatedSubsections = 0;
	let totalToSubsectionsGenerate = Math.ceil((2 * areaExtents + 1) / subsectionSize) * Math.ceil((2 * areaExtents + 1) / subsectionSize);
	let generatedChunks = 0;
	let totalChunksToGenerate = (2 * areaExtents + 1) * (2 * areaExtents + 1) * areaHeight;

	let createGeneratorWorker = function(iMin, iMax, kMin, kMax, callback) {
		let generator = generatorPool.requestWorker();
		generator.onmessage = function(e) {
			if (e.data.stage) {
				document.getElementById("progressStage").innerHTML = e.data.stage;
			}
	
			if (e.data.progress !== undefined) {
				if (e.data.progress) {
					generatedChunks++;
				}
				document.getElementById("progressBarInner").style.width = (generatedChunks / totalChunksToGenerate) * 100 + "%";
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

let generateMeshes = function(vorld) {
	let startTime = Date.now();
	let generatedMeshPositions = {}; // Sanity check on mesh generation


	document.getElementById("progressStage").innerHTML = "Generating Meshes";
	document.getElementById("progressBarInner").style.width = "0%";

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
				document.getElementById("progressBarInner").style.width = (generatedChunks / totalChunksToGenerate) * 100 + "%";
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

			hide("progressDisplay");
			show("generationParameters");
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

let framesInLastSecond = 0;
let timeSinceLastFrame = 0;

let loop = function(){
	let elapsed = Date.now() - lastTime;
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

let localx = vec3.create();
let localy = vec3.create();
let localz = vec3.create();

// https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
let getRoll = function(q) {
	// Note: glMatrix is x,y,z,w where as wiki assumes w,x,y,z!
	let sinr_cosp = 2 * (q[3] * q[0] + q[1] * q[2]);
	let cosr_cosp = 1 - 2 * (q[0] * q[0] + q[1] * q[1]);
	return Math.atan(sinr_cosp / cosr_cosp);
	// If you want to know sector you need atan2(sinr_cosp, cosr_cosp)
	// but we don't in this case.
};

let handleInput = function(elapsed) {
	let q = camera.rotation;
	let p = camera.position;
	Fury.Maths.quat.localAxes(q, localx, localy, localz);
	
	if (Input.mouseDown(2)) {
		let xRotation = Input.MouseDelta[0] * rotateRate*elapsed;
		if (Math.abs(xRotation) > maxRotatePerFrame) {
			xRotation = Math.sign(xRotation) * maxRotatePerFrame;
		}
		let yRotation = Input.MouseDelta[1] * rotateRate*elapsed;
		if (Math.abs(yRotation) > maxRotatePerFrame) {
			yRotation = Math.sign(yRotation) * maxRotatePerFrame;
		}
		Fury.Maths.quat.rotate(q, q, -xRotation, Fury.Maths.vec3.Y);

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
	let textureArray = Fury.Texture.createTextureArray({ 
		source: upscaled,
		width: textureSize,
		height: textureSize,
		imageCount: textureCount,
		quality: "pixel",
		clamp: true 
	});
	atlasMaterial.setTexture(textureArray);
	awake();
};
image.src = "atlas_array.png";
