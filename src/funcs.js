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
                    ,(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)  # optional ,pitch,yaw,roll as floats
                )?
            )?
            ${'i'}
        `;
        const [
            webType,
            orgId, assetId,
            x, y, z,
            pitch, yaw, roll,
        ] = regextract(regex, url);

        const out = {
            webType,
            orgId, assetId,
        };

        if(x !== undefined && y !== undefined && z !== undefined) {
            out.x = parseFloat(x);
            out.y = parseFloat(y);
            out.z = parseFloat(z);

            if(pitch !== undefined && yaw !== undefined && roll !== undefined) {
                out.pitch = parseFloat(pitch);
                out.yaw = parseFloat(yaw);
                out.roll = parseFloat(roll);
            }
        }

        return out;
    } catch(e) {
        const err = new Error('Could not determine asset from URL');
        throw e;
    }
};


const updateUrl = (newLocationObj) => {
    const prevLocationObj = parseUrl();
    const keys = ['webType', 'orgId', 'assetId', 'x', 'y', 'z', 'pitch', 'yaw', 'roll'];
    let isChanged = false;

    // console.log(1111, newLocationObj)

    newLocationObj = Object.assign({}, prevLocationObj, newLocationObj);

    for(let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if(newLocationObj[key] !== undefined && newLocationObj[key] !== prevLocationObj[key]){
            isChanged = true;
            break;
        }
    }

    // console.log('updateUrl?', isChanged, {prevLocationObj, newLocationObj})

    if(!isChanged) {
        return;
    }

    const {
        webType,
        orgId, assetId,
        x, y, z,
        pitch, yaw, roll,
    } = newLocationObj;

    const newUrlPieces = [];
    newUrlPieces.push(`/${webType}`);
    newUrlPieces.push(`/${orgId}.${assetId}`);

    if(x !== undefined && y !== undefined && z !== undefined){
        newUrlPieces.push(`@${x},${y},${z}`);

        if(pitch !== undefined && yaw !== undefined && roll !== undefined) {
            newUrlPieces.push(`,${pitch},${yaw},${roll}`);
        }
    }

    const newUrl = newUrlPieces.join('');
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

module.exports = {
    regextract,
    updateUrl,
    parseUrl,
    addError,
    randomInt,
}