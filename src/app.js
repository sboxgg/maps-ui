import * as THREE from 'three';
import {parseUrl, updateUrl, addError} from './funcs';
import Conf from './conf';

// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {NoclipControls} from "./NoclipControls";
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import {RoughnessMipmapper} from 'three/examples/jsm/utils/RoughnessMipmapper.js';

const randomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

let camera, scene, renderer;

const hammer2meters = unit => unit / 39.37;

const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
};

const render = ()=>{
    renderer.render(scene, camera);
};

const initCanvas = (locationData) => {
    const container = document.createElement('div');
    container.setAttribute('id', 'container');
    document.body.appendChild(container);

    const {
        orgId, assetId,
        x, y, z,
        yaw, pitch, roll,
    } = locationData;

    // console.log(123, {locationData});

    if (!orgId || !assetId) {
        throw new Error(`Cannot find map. Please supply orgId and assetId`)
    }

    const baseUrl = `${Conf.mediaHost}/${orgId}/${assetId}/`;

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 20000);

    const setCameraPos = (x, y, z) => {
        // console.log('setCameraPos', {x,y,z})
        if (x === undefined || y === undefined || z === undefined) {
            return;
        }
        camera.position.set(x, y, z);
    };
    const setCameraAngle = (pitch, yaw, roll) => {
        // console.log('setCameraAngle', {pitch, yaw, roll})
        if (pitch === undefined || yaw === undefined || roll === undefined) {
            return;
        }
        camera.rotation.set(
            pitch * Math.PI / 180,
            yaw * Math.PI / 180,
            roll * Math.PI / 180,
        );
    };


    setCameraPos(0, 0, 0);

    // setCameraPos( hammer2meters(x), hammer2meters(y), hammer2meters(z) );

    window.camera = camera;

    scene = new THREE.Scene();

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

                    if(!isReady) {
                        throw new Error(message || 'Error occurred when loading map. Please try again later.');
                    }

                    if (x !== undefined && y !== undefined && z !== undefined) {
                        setCameraPos(x, y, z);
                        if (pitch !== undefined && yaw !== undefined && roll !== undefined) {
                            setCameraAngle(pitch, yaw, roll);
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
                    console.log({err});
                    addError(`Problem occurred when loading map data: ${err.message}`);
                })
        });

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputEncoding = THREE.sRGBEncoding;
    // renderer.autoUpdate = true;
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const controls = new NoclipControls(camera, renderer.domElement);

    // const controls = new OrbitControls( camera, renderer.domElement );
    controls.addEventListener('change', render); // use if there is no animation loop
    controls.addEventListener('doneMoving', onControlsDoneMoving); // use if there is no animation loop
    controls.minDistance = 2;
    controls.maxDistance = 1000;
    // controls.target.set( 0, 0, - 0.2 );
    controls.update();
    // setInterval(controls.update, 100)

    requestAnimationFrame(animate);
    window.addEventListener('resize', onWindowResize);

    let prevTime = 0;

    function animate(time) {
        // console.log('animate')

        requestAnimationFrame(animate);

        const dt = (time - prevTime) / 1000;

        controls.update(dt);
        // this.stats.update();
        // this.mixer && this.mixer.update(dt);
        render();

        prevTime = time;

    }

    function onControlsDoneMoving() {
        // console.log('doneMoving', camera);

        let {x, y, z} = camera.position;
        let {
            x: pitch,
            y: yaw,
            z: roll,
        } = camera.rotation;

        x = Math.floor(x * 1000) / 1000;
        y = Math.floor(y * 1000) / 1000;
        z = Math.floor(z * 1000) / 1000;

        pitch = Math.round(pitch * 180 / Math.PI);
        yaw = Math.round(yaw * 180 / Math.PI);
        roll = Math.round(roll * 180 / Math.PI);

        updateUrl({
            x, y, z,
            pitch, yaw, roll,
        });

        render();
    }

};

const initIntro = ()=>{
    const $intro = document.querySelector('#intro');
    $intro.classList.remove('hide');

    const $tryItOut = document.querySelector('#try-it-out')

    // todo: hit API to fetch a random map
    const tryArr = [
        { orgId: 'facepunch', assetId: 'construct' },
    ];

    const tryObj = tryArr[randomInt(0, tryArr.length - 1)];

    const {orgId, assetId} = tryObj;

    const $a = document.createElement('a');
    $a.setAttribute('href', `/noclip/${orgId}.${assetId}`);
    $a.append(
        `${Conf.selfHost}/noclip/`,
        orgId,
        '.',
        assetId,
    );

    $tryItOut.append(
        'Try it out here: ',
        $a,
    );
};

const initWebTypeNoclip = (locationData)=>{
    initCanvas(locationData);
    render();
}

window.onload = (() => {
    let locationData = {};
    try {
        locationData = parseUrl();
    } catch(e) {}

    const {webType, orgId, assetId} = locationData;

    if(orgId && assetId) {
        switch(webType) {
            case 'noclip':
                initWebTypeNoclip(locationData);
                return;
        }
    }

    initIntro();
});
