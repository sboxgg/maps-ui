import * as THREE from 'three';
import {radToDeg, degToRad} from "three/src/math/MathUtils";
import {parseUrl, updateUrl, addError, pitchYawToVector} from './funcs';
import Conf from './conf';

window.THREE = THREE;

// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {NoclipControls} from "./NoclipControls";
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import {RoughnessMipmapper} from 'three/examples/jsm/utils/RoughnessMipmapper.js';

const randomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const cameras = {
    perspective: null,
    radar: null,
};
const qs = new URLSearchParams(document.location.search);
const isDebug = !!parseInt(qs.get('debug') ?? '');

let scene, renderer;
let $radarCursor;
let controls;

const RADAR_SIZE = 200;
const RADAR_Y_OFFSET = 40;
const RADAR_GUI_CORNER_OFFSET = 32;

const hammer2meters = unit => unit / 39.37;

window.radToDeg = radToDeg;
window.degToRad = degToRad;

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

const onWindowResize = () => {
    cameras.perspective.aspect = window.innerWidth / window.innerHeight;
    cameras.perspective.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    cameras.radar.aspect = 1;
    cameras.perspective.updateProjectionMatrix();

    windowWidth = window.innerWidth;
    windowHeight = window.innerHeight;

    render();
};

const render = () => {
    // render perspective
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight)
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight)
    renderer.render(scene, cameras.perspective);

    // render radar
    const radarLeft = windowWidth - RADAR_SIZE - RADAR_GUI_CORNER_OFFSET;
    const radarBottom = RADAR_GUI_CORNER_OFFSET;
    renderer.setViewport(radarLeft, radarBottom, RADAR_SIZE, RADAR_SIZE)
    renderer.setScissor(radarLeft, radarBottom, RADAR_SIZE, RADAR_SIZE)
    renderer.setScissorTest(true);
    renderer.render(scene, cameras.radar);
    updateRadarCursor();
    // cameras.radar.rotation.z += 0.01;
};

const $debug = document.querySelector('#debug');

const updateRadarCursor = () => {
    // grab x,y and rotation from perspective camera
    const { x, y, z } = cameras.perspective.position;

    const {
        pitch,
        yaw,
    } = controls;

    // 270deg so the faces at the top are facing the camera
    cameras.radar.rotation.x = degToRad(270);

    cameras.radar.position.x = x;
    cameras.radar.position.y = y + RADAR_Y_OFFSET;
    cameras.radar.position.z = z; // i got some weird rotations I think. shouldn't this be y?

    // * -1 since the map is upsidedown
    $radarCursor.style.transform = `rotateZ(${-1 * yaw}rad)`;
    cameras.radar.updateProjectionMatrix();

    if(isDebug) {
        $debug.innerText = `
            pitch: ${Math.round(radToDeg(pitch))}deg
            yaw: ${Math.round(radToDeg(yaw))}deg
            pitchRad: ${pitch.toFixed(3)}rad
            yawRad: ${yaw.toFixed(3)}rad
        `;
    }
}

const initNoclip = (locationData) => {
    const container = document.createElement('div');
    container.setAttribute('id', 'container');
    const containerRadar = document.createElement('div');
    containerRadar.setAttribute('id', 'radar');
    document.body.appendChild(container);
    document.body.appendChild(containerRadar);

    $radarCursor = document.querySelector('#radar-cursor');
    $radarCursor.classList.remove('hide');

    let {
        orgId, assetId,
        x, y, z,
        yaw, pitch,
    } = locationData;

    if(!x) x = 0;
    if(!y) y = 0;
    if(!z) z = 0;
    if(!pitch) pitch = 0;
    if(!yaw) yaw = 0;

    // console.log(123, {locationData});

    if (!orgId || !assetId) {
        throw new Error(`Cannot find map. Please supply orgId and assetId`)
    }

    const baseUrl = `${Conf.mediaHost}/${orgId}/${assetId}/`;

    cameras.perspective = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.25,
        20000
    );
    cameras.radar = new THREE.OrthographicCamera(
        -1 * RADAR_SIZE / 2,
        RADAR_SIZE / 2,
        RADAR_SIZE / 2,
        -1 * RADAR_SIZE / 2,
        0.1,
        2000
    );

    const setCameraPos = (x, y, z) => {
        // console.log(`setCameraPos(${x},${y},${z})`)
        if (x === undefined || y === undefined || z === undefined) {
            return;
        }
        cameras.perspective.position.set(x, y, z);
        // console.log('set camera perspective pos', {x,y,z})
        cameras.radar.position.set(x, y + RADAR_Y_OFFSET, z);
        cameras.radar.updateProjectionMatrix();
    };
    const setCameraAngle = (pitch, yaw) => {
        if (pitch === undefined || yaw === undefined) {
            return;
        }

        // rotate to face supplied pitch/yaw
        var vec = pitchYawToVector(pitch, yaw);
        vec.add(cameras.perspective.position);
        cameras.perspective.lookAt(vec);
        cameras.perspective.updateProjectionMatrix();
        render();
    };

    setCameraPos(0, 0, 0);
    // setCameraPos( hammer2meters(x), hammer2meters(y), hammer2meters(z) );

    window.cameras = cameras;

    scene = new THREE.Scene();

    scene.add(cameras.perspective);
    scene.add(cameras.radar);

    new RGBELoader()
        .setDataType(THREE.UnsignedByteType)
        .setPath('assets/environment/')
        .load('venice_sunset_1k.hdr', function (texture) {

            const envMap = pmremGenerator.fromEquirectangular(texture).texture;

            // scene.background = envMap;
            scene.environment = envMap;
            scene.background = new THREE.Color(0xa0a0a0);

            // var light = new THREE.AmbientLight(0xffffff, 100000);
            // scene.add(light);

            // const light2 = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
            // scene.add(light2);

            texture.dispose();
            pmremGenerator.dispose();

            render();

            const roughnessMipmapper = new RoughnessMipmapper(renderer);

            const loader = new GLTFLoader().setPath(baseUrl);

            const dataUrl = `${Conf.apiHost}/getMap?id=${orgId}.${assetId}`;

            fetch(dataUrl)
                .then(response => response.json())
                .then(data => {
                    const {
                        isReady,
                        message,
                        models,
                        spawns,
                    } = data;

                    if (!isReady) {
                        throw new Error(message || 'Error occurred when loading map. Please try again later.');
                    }

                    if (x !== undefined && y !== undefined && z !== undefined) {
                        setCameraPos(x, y, z);
                        if (pitch !== undefined && yaw !== undefined) {
                            setCameraAngle(pitch, yaw);
                        }
                    } else {
                        const spawn = spawns[randomInt(0, spawns.length - 1)];
                        const {
                            origin,
                            angles,
                        } = spawn;
                        // fixme: spawns xyz are wrong order
                        const PLAYER_EYE_OFFSET = 64;
                        setCameraPos(hammer2meters(origin.x), hammer2meters(origin.z + PLAYER_EYE_OFFSET), hammer2meters(origin.y));
                        setCameraAngle(angles.x, angles.y, angles.z);
                    }

                    for (let i = 0; i < models.length; i += 1) {
                        const model = models[i];
                        loader.load(model, function (gltf) {
                            // console.log(`adding ${model}`, gltf)
                            // gltf.scene.traverse( function ( child ) {
                            //   if ( child.isMesh ) {
                            //     // TOFIX RoughnessMipmapper seems to be broken with WebGL 2.0
                            //     // roughnessMipmapper.generateMipmaps( child.material );
                            //   }
                            // });
                            scene.add(gltf.scene);
                            roughnessMipmapper.dispose();
                            render();
                        });
                    }
                })
                .catch(err => {
                    console.error(err);
                    addError(`Problem occurred when loading map data: ${err.message}`);
                })
        });

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.autoClear = THREE.sRGBEncoding;
    // renderer.autoUpdate = true;
    container.appendChild(renderer.domElement);

    containerRadar.appendChild($radarCursor);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    controls = new NoclipControls(cameras.perspective, renderer.domElement);
    controls.setPitchYaw(pitch, yaw);

    // const controls = new OrbitControls( cameras.perspective, renderer.domElement );
    controls.addEventListener('change', render); // use if there is no animation loop
    controls.addEventListener('doneMoving', onControlsDoneMoving); // use if there is no animation loop
    // controls.minDistance = 2;
    // controls.maxDistance = 1000;
    // controls.target.set( 0, 0, - 0.2 );
    controls.update();
    // setInterval(controls.update, 100)

    requestAnimationFrame(animate);
    window.addEventListener('resize', onWindowResize);

    let prevTime = 0;

    function animate(time) {
        requestAnimationFrame(animate);
        const dt = (time - prevTime) / 1000;

        controls.update(dt);
        render();

        prevTime = time;
    }

    function onControlsDoneMoving() {
        let {x, y, z} = cameras.perspective.position;
        let {
            pitch,
            yaw
        } = controls;

        pitch = Math.round(radToDeg(pitch));
        yaw = Math.round(radToDeg(yaw));

        updateUrl({
            x, y, z,
            pitch, yaw,
        });

        render();
    }

};

const initIntro = () => {
    const $intro = document.querySelector('#intro');
    $intro.classList.remove('hide');

    const $tryItOut = document.querySelector('#try-it-out')

    // todo: hit API to fetch a random map
    const tryArr = [
        'facepunch.construct',
    ];

    const tryId = tryArr[randomInt(0, tryArr.length - 1)];

    const $a = document.createElement('a');
    $a.setAttribute('href', `/noclip/${tryId}`);

    const $asset = document.createElement('strong');
    $asset.append(tryId);

    $a.append(
        `${Conf.selfHost}/noclip/`,
        $asset,
    );

    $tryItOut.append(
        'Try it out here: ',
        $a,
    );
};

const initWebTypeNoclip = (locationData) => {
    const {
        orgId,
        assetId,
    } = locationData;

    if (orgId && assetId) {
        const $mapDetailsLink = document.querySelector('#map-details-link');
        const $a = document.createElement('a');
        $a.append('Map Details');
        $a.setAttribute('href', `https://asset-tracker.sbox.gg/assets/${orgId}.${assetId}`);
        $a.setAttribute('target', '_blank');
        $mapDetailsLink.append($a);
    }

    initNoclip(locationData);
    render();
}

window.onload = (() => {
    let locationData = {};
    try {
        locationData = parseUrl();
    } catch (e) {
    }

    const {webType, orgId, assetId} = locationData;

    if (orgId && assetId) {
        switch (webType) {
            case 'noclip':
                initWebTypeNoclip(locationData);
                return;
        }
    }

    initIntro();
});
