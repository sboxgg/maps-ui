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

let cameraPerspective, cameraRadar, scene, rendererPerspective, rendererRadar;
let $radarCursor;
let controls;

const RADAR_SIZE = 200;
const RADAR_Y_OFFSET = 40;

const hammer2meters = unit => unit / 39.37;

window.radToDeg = radToDeg;
window.degToRad = degToRad;

const onWindowResize = () => {
    cameraPerspective.aspect = window.innerWidth / window.innerHeight;
    cameraPerspective.updateProjectionMatrix();
    rendererPerspective.setSize(window.innerWidth, window.innerHeight);

    cameraRadar.aspect = 1;
    cameraPerspective.updateProjectionMatrix();
    rendererRadar.setSize(RADAR_SIZE, RADAR_SIZE);

    render();
};

const render = () => {
    rendererPerspective.render(scene, cameraPerspective);
    updateRadar();
    // cameraRadar.rotation.z += 0.01;
    rendererRadar.render(scene, cameraRadar);
};

const $debug = document.querySelector('#debug');

const updateRadar = () => {
    // grab x,y and rotation from perspective camera
    const { x, y, z } = cameraPerspective.position;

    const {
        pitch,
        yaw,
    } = controls;

    // 270deg so the faces at the top are facing the camera
    cameraRadar.rotation.x = degToRad(270);

    cameraRadar.position.x = x;
    cameraRadar.position.y = y + RADAR_Y_OFFSET;
    cameraRadar.position.z = z; // i got some weird rotations I think. shouldn't this be y?

    // * -1 since the map is upsidedown
    $radarCursor.style.transform = `rotateZ(${-1 * yaw}rad)`;
    cameraRadar.updateProjectionMatrix();

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

    cameraPerspective = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.25,
        20000
    );
    cameraRadar = new THREE.OrthographicCamera(
        -1 * RADAR_SIZE,
        RADAR_SIZE,
        RADAR_SIZE,
        -1 * RADAR_SIZE,
        0.1,
        20000
    );

    const setCameraPos = (x, y, z) => {
        // console.log(`setCameraPos(${x},${y},${z})`)
        if (x === undefined || y === undefined || z === undefined) {
            return;
        }
        cameraPerspective.position.set(x, y, z);
        // console.log('set camera perspective pos', {x,y,z})
        cameraRadar.position.set(x, y + RADAR_Y_OFFSET, z);
        cameraRadar.updateProjectionMatrix();
    };
    const setCameraAngle = (pitch, yaw) => {
        if (pitch === undefined || yaw === undefined) {
            return;
        }

        // rotate to face supplied pitch/yaw
        var vec = pitchYawToVector(pitch, yaw);
        vec.add(cameraPerspective.position);
        cameraPerspective.lookAt(vec);
        cameraPerspective.updateProjectionMatrix();
        render();
    };

    setCameraPos(0, 0, 0);
    // setCameraPos( hammer2meters(x), hammer2meters(y), hammer2meters(z) );

    window.cameraPerspective = cameraPerspective;
    window.cameraRadar = cameraRadar;

    scene = new THREE.Scene();

    scene.add(cameraPerspective);
    scene.add(cameraRadar);

    new RGBELoader()
        .setDataType(THREE.UnsignedByteType)
        .setPath('assets/environment/')
        .load('venice_sunset_1k.hdr', function (texture) {

            const envMap = pmremGenerator.fromEquirectangular(texture).texture;

            // scene.background = envMap;
            scene.environment = envMap;
            scene.background = new THREE.Color(0xa0a0a0);


            var light = new THREE.AmbientLight(0xffffff, 100000);
            scene.add(light);

            const light2 = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
            scene.add(light2);

            texture.dispose();
            pmremGenerator.dispose();

            render();

            const roughnessMipmapper = new RoughnessMipmapper(rendererPerspective);

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

    rendererPerspective = new THREE.WebGLRenderer({antialias: true});
    rendererPerspective.setPixelRatio(window.devicePixelRatio);
    rendererPerspective.setSize(window.innerWidth, window.innerHeight);
    rendererPerspective.toneMapping = THREE.ACESFilmicToneMapping;
    rendererPerspective.toneMappingExposure = 1;
    rendererPerspective.outputEncoding = THREE.sRGBEncoding;
    // rendererPerspective.autoUpdate = true;
    container.appendChild(rendererPerspective.domElement);


    rendererRadar = new THREE.WebGLRenderer({antialias: true});
    rendererRadar.setPixelRatio(window.devicePixelRatio);
    rendererRadar.setSize(RADAR_SIZE, RADAR_SIZE);
    rendererRadar.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRadar.toneMappingExposure = 1;
    rendererRadar.outputEncoding = THREE.sRGBEncoding;
    // rendererRadar.autoUpdate = true;
    containerRadar.appendChild(rendererRadar.domElement);
    containerRadar.appendChild($radarCursor);

    const pmremGenerator = new THREE.PMREMGenerator(rendererPerspective);
    pmremGenerator.compileEquirectangularShader();

    controls = new NoclipControls(cameraPerspective, rendererPerspective.domElement);
    controls.setPitchYaw(pitch, yaw);

    // const controls = new OrbitControls( cameraPerspective, rendererPerspective.domElement );
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
        let {x, y, z} = cameraPerspective.position;
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
