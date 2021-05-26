import * as THREE from "three";
import {radToDeg, degToRad} from "three/src/math/MathUtils";

const heregex = require('heregex');

const regextract = (regex, str, throw_on_error=true)=>{
    let arr = [];
    let should_throw = true;
    if(!str && throw_on_error) {
        throw new Error(`No str passed to regextract(). regex: ${regex.source}`);
    }
    if(!throw_on_error && (str === null || str === undefined)) {
        return [];
    }
    str.replace(regex, (z, ..._arr)=>{
        arr = _arr;
        should_throw = false;
    });
    if(throw_on_error && should_throw) {
        throw new Error(`Regextract failed.\n${regex.source}\n${str.slice(0, 80)}`);
    }
    return arr;
};

const parseUrl = (url=document.location.pathname)=>{
    try {
        const regex = heregex`
            ^
            \/?
            (noclip)\/
            ([a-z]+)\.([a-z0-9_-]+)  # orgId.assetId
            (?:
                @(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)  # optional @x,y,z as floats
                (?:
                    ,(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)  # optional ,pitch,yaw as floats
                )?
            )?
            ${'i'}
        `;
        const [
            webType,
            orgId, assetId,
            x, y, z,
            pitch, yaw,
        ] = regextract(regex, url);

        const out = {
            webType,
            orgId, assetId,
        };

        if(x !== undefined && y !== undefined && z !== undefined) {
            out.x = parseFloat(x);
            out.y = parseFloat(y);
            out.z = parseFloat(z);

            if(pitch !== undefined && yaw !== undefined) {
                out.pitch = degToRad(parseFloat(pitch));
                out.yaw = degToRad(parseFloat(yaw));
            }
        }

        return out;
    } catch(e) {
        console.error(e);
        const err = new Error('Could not determine asset from URL');
        throw err;
    }
};


const updateUrl = (newLocationObj) => {
    const prevLocationObj = parseUrl();
    const keys = ['webType', 'orgId', 'assetId', 'x', 'y', 'z', 'pitch', 'yaw'];
    let isChanged = false;

    newLocationObj = Object.assign({}, prevLocationObj, newLocationObj);

    for(let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if(newLocationObj[key] !== undefined && newLocationObj[key] !== prevLocationObj[key]){
            isChanged = true;
            break;
        }
    }

    if(!isChanged) {
        return;
    }

    const {
        webType,
        orgId, assetId,
        x, y, z,
        pitch, yaw,
    } = newLocationObj;

    const qs = new URLSearchParams(document.location.search);

    const newUrlPieces = [];
    newUrlPieces.push(`/${webType}`);
    newUrlPieces.push(`/${orgId}.${assetId}`);

    if(x !== undefined && y !== undefined && z !== undefined){
        newUrlPieces.push(`@${x},${y},${z}`);

        if(pitch !== undefined && yaw !== undefined) {
            newUrlPieces.push(`,${pitch},${yaw}`);
        }
    }

    const newUrl = newUrlPieces.join('') + (!qs.keys().next().done ? '?' + qs : '');
    history.pushState(newLocationObj, '', newUrl);
};

const addError = (err)=>{
    if(err instanceof Error) {
        err = err.message;
    }
    const $errors = document.querySelector('#errors');
    $errors.classList.remove('hide');
    const $li = document.createElement('li');
    $li.innerText = err;
    $errors.appendChild($li);
};

const randomInt = (min, max)=>{
    return Math.floor(Math.random() * (max - min)) + min;
}

const pitchYawToVector = (pitch, yaw) => {
    const x = -Math.cos(pitch) * Math.sin(yaw);
    const y = Math.sin(pitch);
    const z = -Math.cos(pitch) * Math.cos(yaw);
    return new THREE.Vector3(x, y, z);
};

module.exports = {
    regextract,
    updateUrl,
    parseUrl,
    addError,
    randomInt,
    pitchYawToVector,
}