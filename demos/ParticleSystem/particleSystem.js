let camera, scene;
let texture;
let particleSystem;

window.onload = (event) => {
    Fury.Maths.globalize();
	Fury.init({ canvasId: "fury" });

	camera = Fury.Camera.create({ near: 0.1, far: 1000000.0, fov: 1.0472, ratio: 1.0, position: [ 0.0, 0.0, 6.0 ] });
	scene = Fury.Scene.create({ camera: camera });

    loadAssets(() => {
        particleSystem = ParticleSystem.create({ 
            emission: 100,
            burst: 250,
            maxCount: 500,
            scene: scene,
            texture: texture,
            scale: [ 0.1, 0.1, 0.1 ],
            color: [ 1.0, 0.0, 0.5 ]
        });
        
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

let ParticleSystem = (function(){
    /*
    Will start with a naive approach of just instantiating lots of prefabs
    We'll get improvements on the material bindings from them being prefabs
    but we may want to investigate ways of further minimising overhead

    Would be nice to be able to skip thinking about the render objects at all if the particle system were inactive

    Start by using Unlit Color shader - may need custom shdaer if we want to support colour over lifetime
        Start no-alpha, try cutout and then alpha blended

    Particle System concepts:
    position
    rotation
    sprite
    shape (point / sphere / cone)
    emission rate
    max particles
    bursts []

    particle:
    scale 
    speed (value or range)
    lifetime (value or range)
    */

    let exports = {};
    let meshConfig = null;

    let nextId = 0;
    let createMaterialConfig = function({ color, texture }) {
        return {
            shader: Fury.Shaders.UnlitColor,
            texture: texture,
            properties: { color: color }
        }
    };

    let createMeshConfig = function() {
        if (!meshConfig) {
            meshConfig = Fury.Primitives.createCenteredQuadMeshConfig(1.0, 1.0);
        }
        return meshConfig;
    }

    exports.create = ({ scene, maxCount, position = [0,0,0], scale = [1, 1, 1], texture, color, burst = 0, emission = 0 }) => {
        let prefabName = "particle-system-" + nextId++;
        Fury.Prefab.create({ 
            name: prefabName,
            meshConfig: createMeshConfig(),
            materialConfig: createMaterialConfig({ color: color, texture: texture })
        });

        let emit = function(particle) {
            particle.active = true;
            // TODO: Read these from config delegates
            vec3.copy(particle.transform.position, position);
            vec3.set(particle.velocity, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
            particle.lifetime = 3.0 * Math.random();
        };

        let particles = [];
        for (let i = 0; i < maxCount; i++) {
            let particle = scene.instantiate({ name: prefabName, position: vec3.clone(position), scale: vec3.clone(scale) });
            particle.active = false;
            particle.velocity = [ 0, 0, 0 ];
            particles.push(particle);

            if (i < burst) {
                emit(particle);
            }
        }

        let timeSinceLastSpawn = 0.0;

        let particleSystem = {};
        particleSystem.simulate = (elapsed) => {
            for (let i = 0, l = particles.length; i < l; i++) {
                let particle = particles[i];
                if (particle.active) {
                    // TODO: updates for individual material overrides, via bindInstance (new engine functionality)
                    // TODO: Velocity over lifetime delegate
                    vec3.scaleAndAdd(
                        particle.transform.position,
                        particle.transform.position,
                        particle.velocity,
                        elapsed
                    );
                    particle.lifetime = Math.max(0, particle.lifetime - elapsed);
                    if (particle.lifetime <= 0) {
                        particle.active = false;
                    }
                }
            }

            // Emission
            if (emission > 0) {
                timeSinceLastSpawn += elapsed;
                let emissionTau = 1 / emission;
                while (timeSinceLastSpawn > emissionTau) {
                    timeSinceLastSpawn -= emissionTau;
    
                    // TODO: Build list of inactive particles on update loop
                    // and if the length is zero build a heap, once, then use these.
                    let minParticleLifeTime = Number.MAX_VALUE;
                    let minParticle = null;
                    for (let i = 0, l = particles.length; i < l; i++) {
                        let particle = particles[i];
                        if (!particle.active) {
                            minParticle = particle;
                            break;
                        } else if (minParticleLifeTime > particle.lifetime) {
                            minParticleLifeTime = particle.lifetime;
                            minParticle = particle;
                        }
                    }
    
                    if (minParticle) {
                        emit(minParticle);
                    }
                }
            }

            // TODO: Bursts by time
        };

        return particleSystem;
    };

    return exports;
})();

let loop = (elapsed) => {
    particleSystem.simulate(elapsed);
    scene.render();  
};