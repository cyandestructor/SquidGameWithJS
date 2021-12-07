import * as THREE from 'https://cdn.skypack.dev/three';
import { FBXLoader } from 'https://cdn.skypack.dev/three/examples/jsm/loaders/FBXLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000 );
const clock = new THREE.Clock();
const loader = new FBXLoader();

const listener = new THREE.AudioListener();
camera.add( listener );

const renderer = new THREE.WebGLRenderer();
renderer.setClearColor(new THREE.Color(1, 1, 1));
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const player = {
    mixer: null,
    handler: null,
    actions: {
        idle: null,
        walking: null,
        death: null
    },
    victory: false,
    death: false
};

const gunSound = new THREE.Audio(listener);
const victorySound = new THREE.Audio(listener);

const doll = {
    handler: null
};

const keys = {};

let loadedAssets = 0;
const totalAssets = 10;

function onStartSkybox() {
    const ctLoader = new THREE.CubeTextureLoader();
    ctLoader.setPath( 'textures/sky/' );

    ctLoader.load( [
        'px.jpg', 'nx.jpg',
        'py.jpg', 'ny.jpg',
        'pz.jpg', 'nz.jpg'
    ], (cubeTexture) => {
        scene.background = cubeTexture;
        loadedAssets++;
    });
}

function onStartFloor() {
    const textureLoader = new THREE.TextureLoader();

    const textureRepeat = 100;
    textureLoader.load('textures/sand/albedo.jpg', (albedo) => {
        loadedAssets++;
        albedo.wrapS = THREE.RepeatWrapping;
        albedo.wrapT = THREE.RepeatWrapping;
        albedo.repeat.multiplyScalar(textureRepeat);
        textureLoader.load('textures/sand/normal.jpg', (normal) => {
            loadedAssets++;
            normal.wrapS = THREE.RepeatWrapping;
            normal.wrapT = THREE.RepeatWrapping;
            normal.repeat.multiplyScalar(textureRepeat);
            const geometry = new THREE.PlaneGeometry( 1, 1 );
            const material = new THREE.MeshStandardMaterial( {
                map: albedo,
                normalMap: normal
            } );
            const plane = new THREE.Mesh( geometry, material );
            plane.scale.multiplyScalar(100);
            plane.rotation.x = THREE.Math.degToRad(-90);
            scene.add( plane );
        });
    });
}

function onStartDoll() {
    loader.load('models/doll/doll.fbx', (model) => {
        model.name = 'Doll';
        model.position.set(3, 0, -30);
        model.rotation.y = THREE.Math.degToRad(180);
        model.scale.multiplyScalar(0.25);

        doll.handler = model;
        scene.add(model);
        loadedAssets++;
    });
}

function onStartPlayer() {
    loader.load('models/player/character.fbx', (model) => {
        model.name = 'Player';
        model.scale.multiplyScalar(0.01);

        player.handler = model;
        player.mixer = new THREE.AnimationMixer(model);

        loader.load('models/player/animations/walking.fbx', (asset) => {
            const walkingAnimation = asset.animations[0];
            player.actions.walking = player.mixer.clipAction(walkingAnimation);
            loadedAssets++;
        });

        loader.load('models/player/animations/idle.fbx', (asset) => {
            const idleAnimation = asset.animations[0];
            player.actions.idle = player.mixer.clipAction(idleAnimation);
            player.actions.idle.play();
            loadedAssets++;
        });

        loader.load('models/player/animations/death.fbx', (asset) => {
            const deathAnimation = asset.animations[0];
            player.actions.death = player.mixer.clipAction(deathAnimation);
            player.actions.death.clampWhenFinished = true;
            player.actions.death.loop = THREE.LoopOnce;
            loadedAssets++;
        });

        scene.add(player.handler);
        loadedAssets++;
    });
}

function onStart() {
    const light = new THREE.AmbientLight(0xffffff, 0.75); // soft white light
    scene.add( light );

    const directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
    scene.add( directionalLight );

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('sfx/gun.wav', (buffer) => {
        gunSound.setBuffer(buffer);
        loadedAssets++;
    });

    audioLoader.load('sfx/victory.wav', (buffer) => {
        victorySound.setBuffer(buffer);
        loadedAssets++;
    });

    onStartSkybox();
    onStartFloor();
    onStartDoll();
    onStartPlayer();
}

let lastState = 'idle';
function onUpdatePlayer(dt) {
    let state = 'idle';
    const playerSpeed = 2;

    player.mixer.update(dt);

    if (!player.death) {
        if (keys['w']) {
            player.handler.position.z -= playerSpeed * dt;
            player.handler.rotation.y = THREE.Math.degToRad(180);
            state = 'walking';
        }
        if (keys['s']) {
            player.handler.position.z += playerSpeed * dt;
            player.handler.rotation.y = THREE.Math.degToRad(0);
            state = 'walking';
        }

        const crossFadeTime = 0.2;
        if (lastState != state) {
            const lastAnimation = player.actions[lastState];
            const newAnimation = player.actions[state];

            lastAnimation.reset();
            newAnimation.reset();

            lastAnimation.crossFadeTo(newAnimation, crossFadeTime).play();

            lastState = state;
        }
    }

    if (player.handler.position.z <= doll.handler.position.z && !player.victory) {
        player.victory = true;
        victorySound.play();
    }
}

let light = 'Green';
let greenTimer = THREE.Math.randFloat(3, 5);
let redTimer = 3;
let toleranceTimer = 0.4;
let playerLastPosition = new THREE.Vector3();
function onUpdateDoll(dt) {
    if (light === 'Green') {
        if (greenTimer <= 0) {
            if (toleranceTimer <= 0) {
                // Turn Red
                redTimer = 3;
                light = 'Red';

                playerLastPosition.copy(player.handler.position);
            }
            else {
                toleranceTimer -= dt;
            }
            
            doll.handler.rotation.y = 0;
        }
        else {
            greenTimer -= dt;
        }
    }
    else {
        if (redTimer <= 0) {
            // Turn green
            toleranceTimer = 0.4;
            greenTimer = THREE.Math.randFloat(3, 5);
            light = 'Green';

            doll.handler.rotation.y = THREE.Math.degToRad(180);
        }
        else {
            // Check if the player moves
            if (!playerLastPosition.equals(player.handler.position) && !player.death && !player.victory) {
                // The player dies
                killPlayer();
            }
            
            redTimer -= dt;
        }
    }
    console.log(light);
}

function killPlayer() {
    console.log('Player is death');
    gunSound.play();
    player.death = true;
    player.mixer.stopAllAction();
    player.actions.death.play();
}

function onUpdate(dt) {
    onUpdateDoll(dt);
    onUpdatePlayer(dt);
    camera.position.set(0, 1.8, player.handler.position.z + 5);
}

function render() {
    requestAnimationFrame(render);

    const dt = clock.getDelta();
    if (loadedAssets >= totalAssets) {
        onUpdate(dt);
        renderer.render(scene, camera);
    }
}

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

onStart();
render();