# Local setup

## Installation
Install nodejs and then install the needed modules:
```
npm install
```


## Run local environment with mock data
You'll need two servers running. One to serve the maps UI, and another to serve the model files and work as an API.

UI (port 3000):
```
npm run dev
```

API+Models (port 3001):
```
npm run local-api
```

Mock data only includes a good small testing map:

http://localhost:3000/noclip/opossum.bobomb_map

## How to serve locally installed models:
If you're building .glb/.gltf/etc models locally, you can serve them by configuring the directory for those models like this:

```
npm run local-api -- "path/to/models"
```
