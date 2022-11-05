let camera, scene;
let texture;
let particleSystem, burstSystem;
let gif;
let furyCanvas;
let encodeGif = false;

window.onload = (event) => {
	furyCanvas = document.getElementById("fury");
	Fury.Maths.globalize();
	Fury.init({ canvasId: "fury" });

	camera = Fury.Camera.create({ near: 0.1, far: 1000000.0, fov: 1.0472, ratio: 1.0, position: [ 0.0, 0.0, 6.0 ] });
	scene = Fury.Scene.create({ camera: camera });

	loadAssets(() => {
		let color = [ 1.0, 0.0, 0.5 ];
		let targetColor = [ 0.0, 0.0, 0.0 ];
		
		let shader = Fury.Shader.copy(Fury.Shaders.UnlitColor);
		shader.bindInstance = function(object) {
			if (object.color) {
				this.setUniformFloat3("uColor", object.color[0], object.color[1], object.color[2]);
			}
		};

		particleSystem = ParticleSystem.create({ 
			emission: 100,
			burst: 250,
			maxCount: 500,
			scene: scene,
			position: [ -2.0, 0.0, 0.0 ],
			scale: [ 0.1, 0.1, 0.1 ],
			materialConfig: {
				shader: shader,
				texture: texture,
				properties: { color: color }
			},
			setupParticle: (particle) => {
				particle.color = vec3.clone(color);
			},
			initParticle: (particle) => {
				vec3.set(particle.velocity, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
				particle.lifetime = 3.0 * Math.random();
			},
			updateParticle: (particle) => {
				// TODO: Lerp in HSV space not RGB
				vec3.lerp(particle.color, particle.material.color, targetColor, particle.elapsed / particle.lifetime);
			}
		});

		let burstColor = [ 0.0, 1.0, 0.5 ];
		burstSystem = ParticleSystem.create({
			bursts: [ { time: 0, count: 50 }, { time: 0.5, count: 50 }, { time: 1.0, count: 50 }, { time: 1.5, count: 50 } ],
			lifetime: 2.0,
			repeat: true,
			maxCount: 200,
			scene: scene,
			position: [ 2.0, 0.0, 0.0 ],
			scale: [ 0.05, 0.05, 0.05 ],
			materialConfig: {
				shader: shader,
				texture: texture,
				properties: { color: burstColor }
			},
			setupParticle: (particle) => {
				particle.color = vec3.clone(burstColor);
				particle.initialVelocity = vec3.create();
			},
			initParticle: (particle) => {
				particle.transform.position[0] += 0.1 * Math.random();
				vec3.set(particle.velocity, 0.1 * (Math.random() - 0.5), 3 * Math.random(), 0.0);
				vec3.copy(particle.initialVelocity, particle.velocity);
				particle.lifetime = 0.5 + 0.5 * Math.random();
			},
			updateParticle: (particle) => {
				vec3.scale(particle.velocity, particle.initialVelocity, 1.0 - particle.elapsed / particle.lifetime);
				vec3.lerp(particle.color, particle.material.color, targetColor, particle.elapsed / particle.lifetime);
			}
		});

		if (encodeGif) {
			gif = new GIF({workers: 2, quality: 5 });
			gif.on('finished', function(blob) {
				window.open(URL.createObjectURL(blob));
			});
		}
		
		Fury.GameLoop.init({ loop: loop });
		Fury.GameLoop.start();
	});
};

let loadAssets = (callback) => {
	let assetsLoading = 0;
	let onAssetLoaded = () => {
		assetsLoading--;
		if (!assetsLoading) {
			callback();
		}
	};

	assetsLoading++;
	let image = new Image();
	image.onload = function() {
		texture = Fury.Texture.create({ source: image, quality: "low" });
		onAssetLoaded();
	};
	image.src = "square-particle.png";
};

// TODO: Extract to Fury Utils and unit test
let Heap = (function(){
	let exports = {};

	let parentIndex = i =>  Math.floor(i / 2);
	let leftChildIndex = i => 2 * i;
	let rightChildIndex = i => 2 * i + 1;

	exports.create = () => {
		let heap = {};

		let items = [];
		let priorities = [];
		let count = 0;

		let swap = (i, j) => {
			let item = items[i];
			items[i] = items[j];
			items[j] = item;
			let priority = priorities[i];
			priorities[i] = priorities[j];
			priorities[j] = priority;
		};

		let minChildIndex = (i) => {
			let result = 0;
			if (rightChildIndex(i) >= count) {
				result = leftChildIndex(i);
			} else {
				if (priorities[leftChildIndex(i)] < priorities[rightChildIndex(i)]) {
					result = leftChildIndex(i);
				} else {
					resut = rightChildIndex(i);
				}
			}
			return result;
		};

		let selectIndex = (item, priority) => {
			for (let i = 0; i < count; i++) {
				if (items[i] == item && priority[i] == priority) {
					return i;
				}
			}
			console.error("Unable to find node with priority " + priority + " and item " + item);
			return -1;
		};

		let deleteAtIndex = (index) => {
			if (index < 0 && index >= count) {
				console.error("Can not delete index " + index + " for heap count " + count);
				return;
			}

			if (count == 1) {
				count--;
				items[index] = null;
				return;
			}

			count--;
			let i = index;
			items[index] = items[count];
			priorities[index] = priorities[count];
			let priority = priorities[index];
			while (leftChildIndex(i) < count || rightChildIndex(i) < count) {
				let minChildIdx = minChildIndex(i);
				if (priority <= priorities[minChildIdx]) {
					break;
				}
				swap(i, minChildIdx);
				i = minChildIdx;
			}
		};

		heap.insert = (item, priority) => {
			let i = count;
			items[i] = item;
			priorities[i] = priority;
			count++;
			while (i > 0 && priorities[parentIndex(i)] > priorities[i]) {
				swap(i, parentIndex(i));
				i = parentIndex(i);
			}
		};
		heap.extractMin = () => {
			let min = null;
			if (count > 0) {
				min = items[0];
				deleteAtIndex(0);
			}
			return min;
		};
		heap.delete = (item, priority) => {
			let idx = selectIndex(item, priority);
			if (idx >= 0) {
				deleteAtIndex(idx);
			}
		};
		heap.clear = () => {
			count = 0;
			items.length = 0;
			priorities.length = 0;
		};
		heap.count = () => count;

		return heap;
	};

	return exports;
})();

let ParticleSystem = (function(){
	/*
	CPU Particles

	Will start with a naive approach of just instantiating lots of instances of a prefab
	We'll get improvements on the material bindings from them being prefabs
	but we may want to investigate ways of further minimising overhead
	e.g. would be nice to be able to skip thinking about the render objects at all if the particle system were inactive
	without having to actually remove the particles from the scene.

	TODO: Test cutout, and alpha blended particles

	TODO: consider adding transform concept to particle system, to use as a parent for the particles

	TODO: create methods for some sensible default delegates - configurable with method parameters
	*/

	let exports = {};
	let meshConfig = null;

	let nextId = 0;

	let createMeshConfig = function() {
		if (!meshConfig) {
			meshConfig = Fury.Primitives.createCenteredQuadMeshConfig(1.0, 1.0);
		}
		return meshConfig;
	}

	exports.create = ({ 
		scene,
		maxCount,
		position = [ 0, 0, 0 ],
		scale = [ 1, 1, 1 ], // Initial Particle Scale not system scale
		burst = 0,
		emission = 0,
		bursts = null,
		lifetime = 0.0,
		repeat = false,
		materialConfig,
		setupParticle,
		initParticle,
		updateParticle,
	}) => {
		let prefabName = "particle-system-" + nextId++;
		Fury.Prefab.create({ 
			name: prefabName,
			meshConfig: createMeshConfig(),
			materialConfig: materialConfig
		});

		let particles = [];
		let inactiveParticles = [];
		let particleHeap = Heap.create();

		let determineParticleToEmit = () => {
			if (inactiveParticles.length) {
				return inactiveParticles.pop();
			} else {
				if (particleHeap.count() == 0) {
					for (let i = 0, l = particles.length; i < l; i++) {
						let particle = particles[i]
						particleHeap.insert(particle, particle.lifetime - particle.elapsed);
					}
				}
				return particleHeap.extractMin();
			}
		};

		let emitBurst = function(count) {
			for (let i = 0; i < count; i++) {
				let particle = determineParticleToEmit();
				if (particle) {
					emit(particle);
				} else {
					break;
				}
			}
		};

		let emit = function(particle) {
			particle.active = true;
			vec3.copy(particle.transform.position, position);
			vec3.copy(particle.transform.scale, scale);
			vec3.set(particle.velocity, 0, 0, 0);
			particle.lifetime = 1.0;
			particle.elapsed = 0;
			if (initParticle) {
				initParticle(particle);                
			}
		};

		for (let i = 0; i < maxCount; i++) {
			let particle = scene.instantiate({ name: prefabName, position: vec3.clone(position), scale: vec3.clone(scale) });
			particle.active = false;
			particle.velocity = [ 0, 0, 0 ];
			if (setupParticle) {
				setupParticle(particle);
			}
			particles.push(particle);

			// Assumes start active which maybe we shouldn't have
			if (i < burst) {
				emit(particle);
			} else {
				inactiveParticles.push(particle);
			}
		}

		let timeSinceLastEmission = 0.0;
		let systemElapsed = 0.0;

		let particleSystem = {};
		particleSystem.active = true;
		particleSystem.simulate = (elapsed) => {
			if (!particleSystem.active) {
				return;
			}

			for (let i = 0, l = particles.length; i < l; i++) {
				let particle = particles[i];
				if (particle.active) {
					if (updateParticle) {
						updateParticle(particle);
					}
					vec3.scaleAndAdd(
						particle.transform.position,
						particle.transform.position,
						particle.velocity,
						elapsed
					);
					particle.elapsed += elapsed;
					if (particle.lifetime <= particle.elapsed) {
						particle.active = false;
						inactiveParticles.push(particle);
					}
				}
			}

			particleHeap.clear(); 
			// Could arguably maintain this when emitting and deactivating
			// rather than clearing and rebuilding when needed
			// would need to update the priorities each frame also
			// probably would want to switch to this behaviour only once
			// it's proven required as it will have a greater overhead
			// that is unncessary if there are sufficient particles in the pool

			// Emission
			if (emission > 0) {
				timeSinceLastEmission += elapsed;
				let emissionTau = 1 / emission;
				let particlesToEmit = 0;
				while (timeSinceLastEmission > emissionTau) {
					timeSinceLastEmission -= emissionTau;
					particlesToEmit++;
				}
				emitBurst(particlesToEmit);
			}

			// Bursts by time
			if (bursts && bursts.length) {
				for (let i = 0, l = bursts.length; i < l; i++) {
					if (bursts[i].time < systemElapsed + elapsed && bursts[i].time >= systemElapsed) {
						emitBurst(bursts[i].count);
					}
				}
			}
			systemElapsed += elapsed;
			// Check for repeat
			if (lifetime && repeat && systemElapsed > lifetime) {
				particleSystem.restart();
			}
			// TODO: Test auto deactivate
			if (lifetime && !repeat && inactiveParticles.length == particles.length) {
				particleSystem.active = false;
			}
		};

		particleSystem.restart = () => {
			particleSystem.active = true;
			systemElapsed = 0.0;
			if (burst) {
				emitBurst(burst);
			}
		};

		return particleSystem;
	};

	return exports;
})();

let gifLengthRemaining = 3.0;
let loop = (elapsed) => {
	particleSystem.simulate(elapsed);
	burstSystem.simulate(elapsed);
	scene.render();

	if (encodeGif && gifLengthRemaining > 0.0) {
		gif.addFrame(furyCanvas, { copy: true, delay: elapsed * 1000 })
		gifLengthRemaining -= elapsed;

		if (gifLengthRemaining <= 0.0) {
			gif.render();
		}
	}
};