

const path = require('path');
const express = require('express');
const glob = require('glob-promise');
const app = express();
const port = 3001;

let GLTF_DIR = process.argv[2];

if(!GLTF_DIR) {
    console.log(`No GLTF_DIR env variable set. Using mock data instead.`);
    GLTF_DIR = `${__dirname}/mock/`
}

console.log(`Using GLTF_DIR=${GLTF_DIR}`);

app.use((req, res, next)=>{
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

app.use(express.static(GLTF_DIR));

app.get('/api/getMap', async(req, res)=>{
    const {id} = req.query;
    if(!id) {
        throw new Error('Missing required param { id } ')
    }
    const [orgId, assetId] = id.split('.');
    if(!orgId || !assetId) {
        throw new Error(`id should be in the format "orgId.assetId"`);
    }

    const assetDir = `${GLTF_DIR}/${orgId}/${assetId}/`;

    const files = await glob(`${assetDir}/*.{glb,gltf}`);
    const out = {
        isReady: true,
        orgId,
        assetId,
        models: files.map((file)=>{
            return path.relative(assetDir, file);
        }),
    };
    res.json(out);
});

app.listen(port, ()=>{
    console.log(`local gltf serve and API endpoint listening on port ${port}`);
});





